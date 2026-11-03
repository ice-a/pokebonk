/* 临时校验脚本：v3 数据完整性 + 排行榜 API 逻辑（不启动任何对局） */
global.window = {};
require('../js/data.js');
const D = window.DATA;

const errs = [];
const warn = [];

/* 1. 角色卡 */
const ids = new Set();
D.CHARACTERS.forEach((c) => {
  if (ids.has(c.id)) errs.push('重复角色 id: ' + c.id);
  ids.add(c.id);
  if (!c.chain || !c.chain.length) errs.push(c.id + ' 缺少进化链');
  if (!c.evo) errs.push(c.id + ' 缺少 evo 字段');
  if (!c.moves || c.moves.length !== 4) errs.push(c.id + ' 招式数不是 4');
  const lvs = [];
  c.moves.forEach((k) => {
    const m = D.MOVES[k];
    if (!m) errs.push(c.id + ' 引用了不存在的招式: ' + k);
    else lvs.push(m.unlockLv);
  });
  if (lvs.join(',') !== '1,2,4,7') warn.push(c.id + ' 解锁等级序列 ' + lvs.join(','));
  if (!D.TYPE_COLORS[c.type]) errs.push(c.id + ' 属性无颜色: ' + c.type);
  if (!D.TYPE_CN[c.type]) errs.push(c.id + ' 属性无中文: ' + c.type);
  if (!c.run || typeof c.run.maxHp !== 'number') errs.push(c.id + ' run 属性缺失');
  if (!c.base) errs.push(c.id + ' base 缺失');
  if (!c.passive || !c.passive.name) errs.push(c.id + ' 被动缺失');
  if (!c.ultimate || !c.ultimate.name) errs.push(c.id + ' 终极技缺失');
  if (!c.chart) errs.push(c.id + ' chart 缺失');
});

/* 2. 野生池 & 守护者 */
const wildIds = new Set();
D.WILD.forEach((w) => {
  if (wildIds.has(w.id)) errs.push('重复野生 id: ' + w.id);
  wildIds.add(w.id);
  if (!D.TYPE_COLORS[w.type]) errs.push('野生 ' + w.id + ' 属性无颜色');
  ['hp', 'atk', 'spd', 'xp', 'size'].forEach((f) => {
    if (typeof w[f] !== 'number') errs.push('野生 ' + w.id + ' 缺字段 ' + f);
  });
});
Object.keys(D.BOSSES).forEach((k) => {
  const b = D.BOSSES[k];
  if (!b.name || !b.type || typeof b.hp !== 'number') errs.push('BOSS ' + k + ' 字段缺失');
});
const regionBossMissing = [];
D.REGIONS.forEach((r) => {
  r.guardians.forEach((pool) => pool.forEach((bk) => {
    if (!D.BOSSES[bk]) regionBossMissing.push(r.id + ':' + bk);
  }));
});
if (regionBossMissing.length) errs.push('地区守护者未定义: ' + regionBossMissing.join(','));

/* 3. PvP 对手池 */
D.PVP_RIVALS.forEach((r) => {
  if (!D.CHARACTERS.some((c) => c.id === r.char)) errs.push('PvP 对手角色不存在: ' + r.char);
  if (typeof r.level !== 'number' || r.level < 1) errs.push('PvP 对手等级异常: ' + r.name);
});

/* 4. 招式库完整性 */
Object.keys(D.MOVES).forEach((k) => {
  const m = D.MOVES[k];
  if (!m.name || !m.kind || !m.type || !m.cat) errs.push('招式 ' + k + ' 字段缺失');
  if (!D.TYPE_COLORS[m.type]) errs.push('招式 ' + k + ' 属性未知: ' + m.type);
  if (typeof m.dmg !== 'number') errs.push('招式 ' + k + ' 缺少 dmg');
});

/* 5. 排行榜 API（内存模式） */
const api = require('../api/leaderboard.js');
function fakeRes() {
  const r = { code: 0, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.code = c; return r; };
  r.json = (o) => { r.body = o; return r; };
  r.end = () => r;
  return r;
}
(async () => {
  const modeCounts = {};
  D.CHARACTERS.forEach((c) => { modeCounts[c.type] = (modeCounts[c.type] || 0) + 1; });

  let res = fakeRes();
  await api({ method: 'POST', body: { entries: [{ name: '<script>测试', score: 1234, mode: 'pve', char: 'pikachu', level: 22 }] } }, res);
  if (!res.body || !res.body.ok) errs.push('POST 失败: ' + JSON.stringify(res.body));
  else {
    if (res.body.ephemeral !== true) errs.push('无 KV 时应为 ephemeral=true');
    const e = res.body.entries[0];
    if (e.name.indexOf('<') >= 0) errs.push('name 未过滤尖括号: ' + e.name);
    if (e.mode !== 'classic') errs.push('非法 mode 未兜底为 classic，实际: ' + e.mode);
    if (e.score !== 1234) errs.push('score 保留错误: ' + e.score);
  }

  res = fakeRes();
  await api({ method: 'POST', body: { entries: [{ name: '', score: 10 }] } }, res);
  if (!res.body || res.body.ok !== false || res.body.error !== 'bad-entry') errs.push('空名字应被拒绝');

  res = fakeRes();
  await api({ method: 'GET', query: { mode: 'classic', limit: 10 } }, res);
  if (!res.body || !res.body.ok || res.body.entries.length !== 1) errs.push('GET 未返回刚写入的记录: ' + JSON.stringify(res.body));

  res = fakeRes();
  await api({ method: 'DELETE' }, res);
  if (res.code !== 405) errs.push('非法方法应返回 405，实际 ' + res.code);

  console.log('角色卡数量:', D.CHARACTERS.length, '| 野生:', D.WILD.length, '| BOSS:', Object.keys(D.BOSSES).length, '| 招式:', Object.keys(D.MOVES).length, '| PvP 对手:', D.PVP_RIVALS.length);
  console.log('属性分布:', JSON.stringify(modeCounts));
  if (warn.length) console.log('提示:', warn.join(' | '));
  if (errs.length) {
    console.log('❌ 发现问题', errs.length);
    errs.forEach((e) => console.log('  - ' + e));
    process.exit(1);
  }
  console.log('✅ 数据与排行榜 API 校验全部通过');
})();