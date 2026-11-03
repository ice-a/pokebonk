/**
 * 硅基流动 AI 无限流事件生成器 — Vercel Serverless Function
 *
 * POST /api/generate
 *   body: { state: { level, kills, coins, hp, maxHp, mode, area, elapsed, lastTitle } }
 *   resp: { event: { title, desc, effect: { type, value }, danger }, model, source, interval }
 *
 * 环境变量（Vercel → 项目设置 → Environment Variables）：
 *   SILICONFLOW_API_KEY   必填。硅基流动 API Key（https://cloud.siliconflow.cn 申请）
 *   SILICONFLOW_BASE_URL  可选。默认 https://api.siliconflow.cn/v1
 *   SILICONFLOW_MODEL     可选。默认 Qwen/Qwen2.5-7B-Instruct（可换 deepseek-ai/DeepSeek-V2.5 等）
 *   AI_TEMPERATURE        可选。默认 0.9
 *   AI_MAX_TOKENS         可选。默认 300
 *   AI_EVENT_INTERVAL     可选。默认 45 —— 事件间隔秒数，会下发给客户端
 *
 * Prompt 全文见 prompts/infinite.md（与下方 SYSTEM_PROMPT 保持同步）。
 */

const BASE_URL = process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1';
const MODEL = process.env.SILICONFLOW_MODEL || 'Qwen/Qwen2.5-7B-Instruct';
const TEMPERATURE = Number(process.env.AI_TEMPERATURE || 0.9);
const MAX_TOKENS = Number(process.env.AI_MAX_TOKENS || 300);
const INTERVAL = Number(process.env.AI_EVENT_INTERVAL || 45);

const SYSTEM_PROMPT = [
  '你是《POKÉBONK》无限流模式的事件导演。游戏是像素风宝可梦幸存者类 roguelike：玩家在无尽宝可梦群中生存，杀敌升级、选卡强化、投球捕获。你的任务是周期性生成"无限流"世界事件，让每一局都像无限流小说的一个章节：奇遇、灾变、天降、异变轮番登场。',
  '',
  '【输入】玩家状态 JSON：level（等级）、kills（击杀）、coins（宝可币）、hp/maxHp（当前/最大血量）、mode（classic|survival）、area（区域 0-3）、elapsed（已进行秒数）、lastTitle（上一个事件名，避免重复）。',
  '',
  '【输出】只输出一个严格 JSON 对象——不要 markdown、不要解释、不要代码块围栏：',
  '{',
  '  "title": "事件名，≤12 字，无限流小说腔，如『血月临空』『星落商队』『雷霆裁决』",',
  '  "desc": "事件描述，≤40 字，第二人称，紧张或诡奇，贴合当前局势",',
  '  "effect": { "type": "coins|heal|damageAll|xp|wave|blessing", "value": 数值 },',
  '  "danger": 1 到 5 的整数',
  '}',
  '',
  '【effect 语义与数值区间】（type 必须从 6 种里选，value 落在区间内）',
  '- coins: 立即获得 value ₽（10~80）',
  '- heal: 回复 value 点 HP（15~120）',
  '- damageAll: 对场上所有敌人造成 value 伤害（80~400）',
  '- xp: 获得 value 经验（20~150）',
  '- wave: 立刻刷出 value 只来袭宝可梦（2~6）',
  '- blessing: 招式伤害提升 value%，持续 15 秒（10~30）',
  '',
  '【规则】',
  '1. 危险与收益对齐：danger≥4 的事件必须包含 wave 或明显代价；danger≤2 以收益为主。',
  '2. 玩家 hp/maxHp < 30% 时禁止给 wave，给救命资源（heal/coins）或绝地反击（damageAll）。',
  '3. title 不得与 lastTitle 相同；连续事件在收益与灾变间交替，不要连续两次纯收益。',
  '4. 形式：只输出 JSON 对象本身。'
].join('\n');

/** 服务端兜底钳制：防模型输出越界数值破坏平衡 */
const CLAMP = {
  coins: [10, 80],
  heal: [15, 120],
  damageAll: [80, 400],
  xp: [20, 150],
  wave: [2, 6],
  blessing: [10, 30]
};

function sanitize(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const eff = raw.effect || {};
  const type = String(eff.type || '');
  if (!CLAMP[type]) return null;
  const [lo, hi] = CLAMP[type];
  const value = Math.min(hi, Math.max(lo, Math.round(Number(eff.value) || lo)));
  return {
    title: String(raw.title || '未知异象').slice(0, 14),
    desc: String(raw.desc || '').slice(0, 60),
    effect: { type, value },
    danger: Math.min(5, Math.max(1, Math.round(Number(raw.danger) || 2)))
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' });

  const key = process.env.SILICONFLOW_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: 'missing-env',
      hint: '请在 Vercel 项目设置中添加 SILICONFLOW_API_KEY（客户端会自动降级为本地事件池）',
      interval: INTERVAL
    });
  }

  const state = (req.body && req.body.state) || {};
  const userMsg = JSON.stringify({
    level: state.level | 0, kills: state.kills | 0, coins: state.coins | 0,
    hp: state.hp | 0, maxHp: state.maxHp | 0,
    mode: String(state.mode || ''), area: state.area | 0,
    elapsed: state.elapsed | 0, lastTitle: String(state.lastTitle || '')
  });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: MODEL,
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMsg }
        ]
      })
    });
    const data = await r.json();
    if (!r.ok) {
      return res.status(502).json({ error: 'upstream', detail: (data && data.message) || r.status, interval: INTERVAL });
    }
    const text = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    const m = text.match(/\{[\s\S]*\}/);
    const event = m ? sanitize(safeJson(m[0])) : null;
    if (!event) {
      return res.status(502).json({ error: 'bad-model-output', raw: text.slice(0, 300), interval: INTERVAL });
    }
    return res.status(200).json({ event, model: MODEL, source: 'siliconflow', interval: INTERVAL });
  } catch (e) {
    return res.status(502).json({ error: String((e && e.message) || e), interval: INTERVAL });
  } finally {
    clearTimeout(timer);
  }
};

function safeJson(s) {
  try { return JSON.parse(s); } catch (e) { return null; }
}
