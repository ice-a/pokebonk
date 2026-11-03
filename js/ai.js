/* ============================================================
   AI 无限流事件（ai-infinite 分支）
   定时向 /api/generate（硅基流动）索要世界事件并应用到对局。
   API 不可用 / 未配 Key / 离线时自动降级为本地事件池 —— 照样可玩。

   客户端配置（localStorage）：
     pb.ai.enabled  = '0'   关闭事件流（默认开启）
     pb.ai.interval = 秒数  事件间隔（服务端 AI_EVENT_INTERVAL 下发值会覆盖默认）
     pb.ai.classic  = '1'   经典/生存模式也启用（无限流模式恒开）
   ============================================================ */
(function () {
  'use strict';

  /* 本地兜底事件池：与服务端同一套 effect 语义 */
  var FALLBACK = [
    { title: '星落商队', desc: '一支迷路的商队把补给留给了你。', effect: { type: 'coins', value: 40 }, danger: 1 },
    { title: '治愈之泉', desc: '地脉涌出清泉，伤口开始愈合。', effect: { type: 'heal', value: 60 }, danger: 1 },
    { title: '雷霆裁决', desc: '天雷落下，整片敌群化为焦土。', effect: { type: 'damageAll', value: 200 }, danger: 2 },
    { title: '顿悟时刻', desc: '无数战斗直觉在你脑中炸开。', effect: { type: 'xp', value: 80 }, danger: 2 },
    { title: '血月兽潮', desc: '血月升起，受惊的兽群向你涌来！', effect: { type: 'wave', value: 4 }, danger: 4 },
    { title: '时空祝福', desc: '未知的力量加速了你的招式。', effect: { type: 'blessing', value: 20 }, danger: 2 }
  ];

  var CLAMP = {
    coins: [10, 80], heal: [15, 120], damageAll: [80, 400],
    xp: [20, 150], wave: [2, 6], blessing: [10, 30]
  };

  var interval = Number(localStorage.getItem('pb.ai.interval')) || 45;
  var enabled = localStorage.getItem('pb.ai.enabled') !== '0';
  var classicToo = localStorage.getItem('pb.ai.classic') === '1';
  var clock = 0, busy = false, lastTitle = '';

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, Math.round(Number(v) || lo))); }

  function apply(ev) {
    var PB = window.PB;
    if (!PB || !ev) return;
    var e = ev.effect || {};
    var range = CLAMP[e.type];
    if (!range) return;
    var v = clamp(e.value, range[0], range[1]);
    PB.banner('🌀 ' + (ev.title || '异象'), ev.desc || '');
    if (e.type === 'coins') PB.addCoins(v);
    else if (e.type === 'heal') PB.heal(v);
    else if (e.type === 'damageAll') PB.damageAll(v);
    else if (e.type === 'xp') PB.xp(v);
    else if (e.type === 'wave') PB.wave(v);
    else if (e.type === 'blessing') PB.blessing(v);
    lastTitle = ev.title || lastTitle;
    try { console.log('[AI 无限流]', ev.title, e.type, v); } catch (err) { }
  }

  function fallbackEvent() {
    var pool = FALLBACK.filter(function (x) { return x.title !== lastTitle; });
    return pool[Math.floor(Math.random() * pool.length)] || FALLBACK[0];
  }

  function requestEvent(state) {
    return fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: state })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d && typeof d.interval === 'number' && d.interval >= 10) interval = d.interval;
      return (d && d.event && d.event.effect) ? d.event : null;
    }).catch(function () { return null; });
  }

  window.AIEvent = {
    tick: function (RUN, dt) {
      if (!enabled || !RUN || !window.PB) return;
      if (RUN.mode !== 'classic' && RUN.mode !== 'survival' && RUN.mode !== 'infinite') return;
      if (RUN.mode !== 'infinite' && !classicToo) return;
      clock += dt;
      if (clock < interval || busy) return;
      clock = 0; busy = true;
      var st = window.PB.state();
      st.lastTitle = lastTitle;
      requestEvent(st).then(function (ev) {
        apply(ev || fallbackEvent());
        busy = false;
      });
    },
    setEnabled: function (b) {
      enabled = !!b;
      try { localStorage.setItem('pb.ai.enabled', b ? '1' : '0'); } catch (e) { }
    },
    setIntervalSec: function (s) {
      interval = Math.max(10, Number(s) || 45);
      try { localStorage.setItem('pb.ai.interval', String(interval)); } catch (e) { }
    },
    enableClassic: function (b) {
      classicToo = !!b;
      try { localStorage.setItem('pb.ai.classic', b ? '1' : '0'); } catch (e) { }
    }
  };
})();
