/**
 * 排行榜 API — Vercel Serverless Function
 *
 * GET  /api/leaderboard?mode=all|classic|survival|infinite|pvp&limit=50
 *   resp: { ok, mode, count, ephemeral, entries: [{ name, score, mode, char, level, kills, elapsed, diff, ts }] }
 *
 * POST /api/leaderboard
 *   body: { entries: [entry] }   或直接 { name, score, mode, ... }
 *   resp: { ok, count, ephemeral, entries }
 *
 * 存储：Upstash Redis REST（Vercel KV / Upstash 集成都会注入下列变量）
 *   KV_REST_API_URL  + KV_REST_API_TOKEN
 *   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * 两者都没配时退化为「进程内内存」(ephemeral=true)：接口不报错、前端
 * 会与 localStorage 本地榜合并，所以无存储也能玩、也能看榜。
 */

const MODES = ['classic', 'survival', 'infinite', 'pvp'];
const LIMIT_MAX = 100;
const NAME_MAX = 16;
const SCORE_MAX = 999999;
const KEY_PREFIX = 'pb:lb:';

/* ---------- 存储后端 ---------- */
function kvConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

function memoryStore() {
  if (!globalThis.__PB_LB_MEM) {
    const m = {};
    MODES.forEach((k) => { m[k] = []; });
    globalThis.__PB_LB_MEM = m;
  }
  return globalThis.__PB_LB_MEM;
}

async function kvCommand(cfg, args, timeoutMs = 6000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(cfg.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(args),
      signal: ctrl.signal
    });
    if (!r.ok) throw new Error('kv_http_' + r.status);
    const d = await r.json();
    return d ? d.result : null;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- 校验 ---------- */
function sanitizeMode(v) {
  const s = String(v || '').trim();
  return MODES.indexOf(s) >= 0 ? s : 'classic';
}
function sanitizeName(v) {
  return String(v == null ? '' : v)
    .replace(/[\u0000-\u001f<>]/g, '')
    .trim()
    .slice(0, NAME_MAX);
}
function int(v, min, max, dflt) {
  const n = Math.round(Number(v));
  if (!isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, n));
}
function sanitizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = sanitizeName(raw.name);
  if (!name) return null;
  const score = int(raw.score, 0, SCORE_MAX, 0);
  if (score <= 0) return null;
  return {
    name,
    score,
    mode: sanitizeMode(raw.mode),
    char: String(raw.char || '').replace(/[^a-z0-9]/gi, '').slice(0, 20),
    level: int(raw.level, 1, 99, 1),
    kills: int(raw.kills, 0, 99999, 0),
    elapsed: int(raw.elapsed, 0, 99999, 0),
    diff: String(raw.diff || 'normal').replace(/[^a-z]/gi, '').slice(0, 12) || 'normal',
    ts: int(raw.ts, 0, 9999999999999, 0) || Date.now()
  };
}

function parsePairList(flat) {
  const out = [];
  if (!Array.isArray(flat)) return out;
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const score = Number(flat[i + 1]);
    let obj = null;
    try { obj = JSON.parse(flat[i]); } catch (e) { obj = null; }
    if (!obj) continue;
    const e = sanitizeEntry(obj);
    if (!e) continue;
    if (!isFinite(score)) e.score = e.score;
    out.push(e);
  }
  return out.sort((a, b) => b.score - a.score);
}

/* ---------- 读写 ---------- */
async function readTop(mode, limit) {
  const cfg = kvConfig();
  if (!cfg) {
    const mem = memoryStore();
    const list = mode === 'all'
      ? MODES.reduce((acc, m) => acc.concat(mem[m] || []), [])
      : (mem[mode] || []).slice();
    list.sort((a, b) => b.score - a.score);
    return { entries: list.slice(0, limit), ephemeral: true };
  }
  if (mode === 'all') {
    const results = await Promise.all(MODES.map((m) =>
      kvCommand(cfg, ['ZREVRANGE', KEY_PREFIX + m, 0, limit - 1, 'WITHSCORES']).catch(() => [])
    ));
    let all = [];
    results.forEach((flat) => { all = all.concat(parsePairList(flat)); });
    all.sort((a, b) => b.score - a.score);
    return { entries: all.slice(0, limit), ephemeral: false };
  }
  const flat = await kvCommand(cfg, ['ZREVRANGE', KEY_PREFIX + mode, 0, limit - 1, 'WITHSCORES']);
  return { entries: parsePairList(flat), ephemeral: false };
}

async function writeEntries(entries) {
  const cfg = kvConfig();
  if (!cfg) {
    const mem = memoryStore();
    entries.forEach((e) => {
      const arr = mem[e.mode] || (mem[e.mode] = []);
      const key = e.name + '|' + e.score + '|' + e.char;
      if (!arr.some((x) => (x.name + '|' + x.score + '|' + x.char) === key)) arr.push(e);
      arr.sort((a, b) => b.score - a.score);
      mem[e.mode] = arr.slice(0, LIMIT_MAX);
    });
    return { written: entries.length, ephemeral: true };
  }
  for (const e of entries) {
    const key = KEY_PREFIX + e.mode;
    const member = JSON.stringify(e);
    await kvCommand(cfg, ['ZADD', key, e.score, member]);
    /* 每个榜只保留前 100 名（ZREMRANGEBYRANK 0 -101 删掉低分尾部） */
    await kvCommand(cfg, ['ZREMRANGEBYRANK', key, 0, -(LIMIT_MAX + 1)]).catch(() => null);
  }
  return { written: entries.length, ephemeral: false };
}

/* ---------- Handler ---------- */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const mode = sanitizeMode((req.query && req.query.mode) || 'all');
      const limit = int((req.query && req.query.limit) || 50, 1, LIMIT_MAX, 50);
      const { entries, ephemeral } = await readTop(mode === 'all' ? 'all' : mode, limit);
      return res.status(200).json({ ok: true, mode, count: entries.length, ephemeral, entries });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = null; }
      }
      const list = Array.isArray(body && body.entries) ? body.entries : [body];
      const clean = list.filter(Boolean).map(sanitizeEntry).filter(Boolean).slice(0, 10);
      if (!clean.length) {
        return res.status(400).json({ ok: false, error: 'bad-entry', message: '缺少有效的 name/score' });
      }
      const { ephemeral } = await writeEntries(clean);
      const top = await readTop(clean[0].mode, 50).catch(() => ({ entries: [], ephemeral }));
      return res.status(200).json({
        ok: true,
        count: top.entries.length,
        ephemeral,
        entries: top.entries
      });
    }

    return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'server', message: String(err && err.message || err) });
  }
};