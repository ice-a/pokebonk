/* ============================================================
   POKÉBONK · 核心循环 v2
   状态机：选人 → 选地区 → 实战(升级/暂停) → 结算
   依赖：DATA(data.js) / Sprites(sprites.js) / Sfx(audio.js) / Draw(engine.js)
   ============================================================ */
(function () {
  'use strict';

  /* ================= 基础工具 ================= */
  var D = window.DATA;
  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var randInt = function (a, b) { return Math.floor(rand(a, b + 1)); };
  var pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  var dist = function (ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); };
  var fmtTime = function (s) { s = Math.max(0, s); var m = Math.floor(s / 60), ss = Math.floor(s % 60); return m + ':' + (ss < 10 ? '0' : '') + ss; };
  var fmtElapsed = function (s) { s = Math.max(0, s); var m = Math.floor(s / 60), ss = Math.floor(s % 60), t = Math.floor((s * 10) % 10); return m + ':' + (ss < 10 ? '0' : '') + ss + '.' + t; };
  var esc = function (str) { return String(str).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* ================= 画布 ================= */
  var canvas = $('game'), ctx = canvas.getContext('2d');
  var W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  /* ================= 存档 ================= */
  var SAVE_KEY = 'pokebonk.save.v1';
  function loadSave() {
    try {
      var s = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
      return {
        wins: s.wins | 0, best: s.best | 0, kills: s.kills | 0, catches: s.catches | 0,
        bestTime: typeof s.bestTime === 'number' ? s.bestTime : null,
        dex: Array.isArray(s.dex) ? s.dex.slice() : []
      };
    } catch (e) { return { wins: 0, best: 0, kills: 0, catches: 0, bestTime: null, dex: [] }; }
  }
  function saveSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) { }
  }
  var SAVE = loadSave();

  /* ================= 音效 ================= */
  function sfx(name) { try { if (window.Sfx) window.Sfx.play(name); } catch (e) { } }

  /* ================= 输入 ================= */
  var keys = {}, pressed = {};
  window.addEventListener('keydown', function (e) {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) e.preventDefault();
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  function keyPressed() {
    for (var i = 0; i < arguments.length; i++) if (pressed[arguments[i]]) return true;
    return false;
  }
  var joy = { active: false, dx: 0, dy: 0 };
  (function bindTouch() {
    var joyEl = $('joy'), knob = $('joyknob');
    if (!joyEl) return;
    function pt(e) { var t = e.touches ? e.touches[0] : e; return { x: t.clientX, y: t.clientY }; }
    function move(e) {
      if (!joy.active) return;
      e.preventDefault();
      var r = joyEl.getBoundingClientRect(), p = pt(e);
      var dx = p.x - (r.left + r.width / 2), dy = p.y - (r.top + r.height / 2);
      var len = Math.sqrt(dx * dx + dy * dy) || 1, max = r.width / 2;
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      knob.style.left = (r.width / 2 + dx) + 'px'; knob.style.top = (r.height / 2 + dy) + 'px';
      knob.style.transform = 'translate(-50%,-50%)';
      joy.dx = dx / max; joy.dy = dy / max;
    }
    function end() {
      joy.active = false; joy.dx = 0; joy.dy = 0;
      knob.style.left = '50%'; knob.style.top = '50%';
    }
    joyEl.addEventListener('touchstart', function (e) { joy.active = true; move(e); }, { passive: false });
    joyEl.addEventListener('touchmove', move, { passive: false });
    joyEl.addEventListener('touchend', end);
    joyEl.addEventListener('mousedown', function (e) { joy.active = true; move(e); });
    window.addEventListener('mousemove', function (e) { if (joy.active) move(e); });
    window.addEventListener('mouseup', end);
    var bb = $('btn-ball'), bu = $('btn-ult');
    if (bb) {
      bb.addEventListener('touchstart', function (e) { e.preventDefault(); pressed['Space'] = true; }, { passive: false });
      bb.addEventListener('mousedown', function () { pressed['Space'] = true; });
    }
    if (bu) {
      bu.addEventListener('touchstart', function (e) { e.preventDefault(); pressed['KeyR'] = true; }, { passive: false });
      bu.addEventListener('mousedown', function () { pressed['KeyR'] = true; });
    }
    if ('ontouchstart' in window) { var t = $('touch'); if (t) t.classList.remove('hidden'); }
  })();

  /* ================= 屏幕管理 ================= */
  var STATE = 'charselect';
  function showScreen(id) {
    ['screen-charselect', 'screen-region', 'screen-levelup', 'screen-pause', 'screen-over', 'screen-duel', 'screen-board'].forEach(function (s) {
      $(s).classList.toggle('hidden', s !== id);
    });
    $('hud').classList.toggle('hidden', id !== null);
    var t = $('touch');
    if (t) t.classList.toggle('hidden', id !== null || !('ontouchstart' in window));
  }

  /* ================= 渲染小件 ================= */
  function drawShadow(x, y, rx, ry, a) {
    try {
      if (window.Draw && window.Draw.shadow) { window.Draw.shadow(ctx, x, y, rx, ry, a); return; }
    } catch (e) { }
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,' + (a || .25) + ')';
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function roundRect(x, y, w, h, r, fill, stroke) {
    try {
      if (window.Draw && window.Draw.roundRect) {
        ctx.beginPath(); window.Draw.roundRect(ctx, x, y, w, h, r);
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
        return;
      }
    } catch (e) { }
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function spriteImg(name, cls, size) {
    var src = '';
    try { if (window.Sprites) src = window.Sprites.srcFor(name); } catch (e) { }
    return '<img class="' + (cls || '') + '" src="' + esc(src) + '" alt="" ' +
      (size ? 'width="' + size + '" height="' + size + '"' : '') + ' onerror="this.style.opacity=0.15" />';
  }

  /* ============================================================
     角色选择
     ============================================================ */
  var csIdx = 0, csTab = 'all';
  function statBar(label, v, max, color) {
    return '<div class="stat-row"><span>' + label + '</span><b>' + v + '</b>' +
      '<div class="sb"><i style="width:' + clamp(v / max * 100, 4, 100) + '%;background:' + color + '"></i></div></div>';
  }
  function renderCharDetail() {
    var c = D.CHARACTERS[csIdx];
    var tc = D.TYPE_COLORS, tcn = D.TYPE_CN;
    var h = '';
    h += '<div class="cd-top"><div class="cd-sprite">' + spriteImg(c.chain[0], '', 84) + '</div><div>' +
      '<div class="cd-name">' + esc(c.name) + '</div>' +
      '<div class="cd-meta"><span class="tag"><span class="dot" style="background:' + tc[c.type] + '"></span>' + tcn[c.type] + '</span>' +
      '<span class="tag">' + esc(c.role) + '</span><span class="tag">' + esc(c.rarity) + '</span>' +
      '<span class="tag">' + esc(c.num) + '</span></div></div></div>';
    h += '<div class="cd-section"><h4>六维种族值</h4>' +
      statBar('HP', c.base.hp, 160, '#36d97a') + statBar('攻击', c.base.atk, 160, '#ff8a72') +
      statBar('防御', c.base.def, 160, '#ffd257') + statBar('特攻', c.base.spa, 160, '#8ab4ff') +
      statBar('特防', c.base.spd, 160, '#c79aff') + statBar('速度', c.base.spe, 160, '#7fe7ff') + '</div>';
    h += '<div class="cd-section"><h4>对局中属性</h4><div class="run-grid">' +
      '<div>最大HP <b>' + c.run.maxHp + '</b></div><div>护甲 <b>' + c.run.armor + '</b></div>' +
      '<div>闪避 <b>' + Math.round(c.run.dodge * 100) + '%</b></div><div>速度 <b>×' + c.run.speedMul.toFixed(2) + '</b></div>' +
      '<div>物理 <b>×' + c.run.physMul.toFixed(2) + '</b></div><div>特殊 <b>×' + c.run.specMul.toFixed(2) + '</b></div>' +
      '<div>回复 <b>' + c.run.regen + '/s</b></div><div>暴击 <b>' + Math.round(c.run.crit * 100) + '%</b></div></div></div>';
    h += '<div class="cd-section"><h4>职业被动</h4><div class="passive-box"><b>' + esc(c.passive.name) + '</b> · ' + esc(c.passive.desc) + '</div></div>';
    h += '<div class="cd-section"><h4>招式组</h4>';
    c.moves.forEach(function (mk) {
      var m = D.MOVES[mk], tc2 = D.TYPE_COLORS[m.type];
      var stats = ['伤害 ' + m.dmg, '冷却 ' + m.cd + 's'];
      if (m.range) stats.push('射程 ' + m.range);
      if (m.radius) stats.push('半径 ' + m.radius);
      if (m.shots) stats.push('连射 ×' + m.shots);
      if (m.pierce) stats.push('湮透 ' + Math.round(m.pierce * 100) + '%');
      h += '<div class="move-card"><div class="mc-icon" style="background:' + tc2 + '33">' + (m.cat === '物理' ? '💥' : '✨') + '</div>' +
        '<div style="flex:1"><div class="mc-name">' + esc(m.name) + '<span class="mc-kind">' + esc(m.kind) + ' · ' + esc(m.cat) + '</span></div>' +
        '<div class="mc-desc">' + esc(m.desc) + '</div><div class="mc-stats">' +
        stats.map(function (s) { return '<span>' + s + '</span>'; }).join('') + '</div></div>' +
        '<div class="mc-unlock">' + (m.unlockLv <= 1 ? '初始' : 'Lv.' + m.unlockLv) + '</div></div>';
    });
    h += '</div>';
    h += '<div class="cd-section"><h4>终极技</h4><div class="ult-box"><div class="u-key">R</div><div>' +
      '<div class="u-name">' + esc(c.ultimate.name) + '</div><div class="u-desc">' + esc(c.ultimate.desc) + '</div></div></div></div>';
    function chips(list, label) {
      if (!list || !list.length) return '<div class="cg">' + label + ' —</div>';
      return list.map(function (t) {
        return '<div class="cg"><span class="dot" style="background:' + tc[t] + '"></span>' + label + ' ' + tcn[t] + '</div>';
      }).join('');
    }
    h += '<div class="cd-section"><h4>属性克制</h4><div class="chart-row">' +
      chips(c.chart.weak, '弱点') + chips(c.chart.resist, '抵抗') + chips(c.chart.strong, '克制') + '</div></div>';
    h += '<div class="cd-section"><h4>进化链</h4><div class="evo-chain">';
    c.chain.forEach(function (nm, i) {
      h += '<div class="ev">' + spriteImg(nm, '', 52) + '<small>' + esc(i === 0 ? c.name : (c.evo[i - 1] ? c.evo[i - 1].name : nm)) + '</small></div>';
      if (c.evo[i]) h += '<div class="ev-lv">Lv.' + c.evo[i].at + '</div>';
    });
    h += '</div></div>';
    h += '<div class="cd-section"><h4>难度胜场</h4><div class="win-badges">' +
      D.DIFFICULTIES.map(function (d) {
        return '<div class="wb ' + (SAVE.wins > 0 ? 'won' : '') + '">' + esc(d.name) + (SAVE.wins > 0 ? ' ✓' : '') + '</div>';
      }).join('') + '</div></div>';
    $('cs-detail').innerHTML = h;
  }
  function renderRoster() {
    var h = '', list = D.CHARACTERS;
    if (csTab === 'mine') list = list.filter(function (c, i) { return SAVE.dex.indexOf(c.sprite) >= 0 || i === 0; });
    list.forEach(function (c) {
      var i = D.CHARACTERS.indexOf(c);
      h += '<div class="roster-cell ' + (i === csIdx ? 'sel' : '') + '" data-idx="' + i + '" title="' + esc(c.name) + '">' +
        spriteImg(c.chain[0], '', 48) +
        '<span class="rdot" style="background:' + D.TYPE_COLORS[c.type] + '"></span></div>';
    });
    for (var k = 0; k < 12; k++) h += '<div class="roster-cell locked"></div>';
    $('roster-grid').innerHTML = h;
    $('cs-progress').textContent = (csIdx + 1) + '/' + D.CHARACTERS.length;
    $('fav-count').textContent = SAVE.dex.length;
  }
  function selectChar(i) {
    csIdx = (i + D.CHARACTERS.length) % D.CHARACTERS.length;
    renderCharDetail(); renderRoster();
    sfx('click');
  }
  $('roster-grid').addEventListener('click', function (e) {
    var cell = e.target.closest ? e.target.closest('.roster-cell') : null;
    if (cell && cell.dataset.idx) selectChar(parseInt(cell.dataset.idx, 10));
  });
  $('cs-random').addEventListener('click', function () {
    selectChar(randInt(0, D.CHARACTERS.length - 1));
  });
  Array.prototype.forEach.call(document.querySelectorAll('.cs-tabs .tab'), function (t) {
    t.addEventListener('click', function () {
      csTab = t.dataset.tab;
      Array.prototype.forEach.call(document.querySelectorAll('.cs-tabs .tab'), function (x) { x.classList.toggle('on', x === t); });
      renderRoster();
    });
  });
  $('btn-confirm-char').addEventListener('click', gotoRegion);

  /* ============================================================
     地区选择
     ============================================================ */
  var rgIdx = 0, rgMode = 'classic', rgDiff = 0, rgTarget = 'pve';
  function renderRegionList() {
    var h = '';
    D.REGIONS.forEach(function (r, i) {
      h += '<button class="rg-item ' + (i === rgIdx ? 'sel' : '') + '" data-idx="' + i + '">' +
        '<div class="rg-name"><span class="rdot" style="width:10px;height:10px;border-radius:50%;display:inline-block;background:' + D.TYPE_COLORS[r.types[0]] + '"></span>' + esc(r.name) + '</div>' +
        '<div class="rg-types">' + r.types.map(function (t) {
          return '<span class="tag"><span class="dot" style="background:' + D.TYPE_COLORS[t] + '"></span>' + D.TYPE_CN[t] + '</span>';
        }).join('') + '</div></button>';
    });
    $('region-list').innerHTML = h;
  }
  function renderRegionDetail() {
    var r = D.REGIONS[rgIdx], c = D.CHARACTERS[csIdx];
    $('region-info').innerHTML = '<h2>' + esc(r.name) + '</h2><p>' + esc(r.desc) + '</p>';
    $('region-my').innerHTML = spriteImg(c.chain[0], '', 52) +
      '<div><div class="rm-name">' + esc(c.name) + ' · ' + esc(c.ultimate.name) + '</div>' +
      '<div class="rm-type">' + esc(c.role) + ' · ' + D.TYPE_CN[c.type] + '属性</div></div>' +
      '<button id="btn-change-char">更换</button>';
    $('btn-change-char').addEventListener('click', function () { STATE = 'charselect'; showScreen('screen-charselect'); });
    var gh = '';
    r.guardians.forEach(function (pool, i) {
      var isFinal = i === 3;
      gh += '<div class="rg-gline"><div class="g-area">' + (isFinal ? '森林圣地' : '区域 ' + (i + 1) + '/3') + '</div><div class="g-pool">' +
        pool.map(function (g) {
          var b = D.BOSSES[g];
          return '<span class="g-mon">' + spriteImg(b ? b.sprite : g, '', 22) + esc(b ? b.name : g) + '</span>';
        }).join('') + '</div></div>';
    });
    $('region-guardians').innerHTML = gh;
    $('diff-row').innerHTML = D.DIFFICULTIES.map(function (d, i) {
      return '<button class="mode-btn ' + (i === rgDiff ? 'on' : '') + '" data-diff="' + i + '"><b>' + esc(d.name) + '</b><span>' + esc(d.desc) + '</span></button>';
    }).join('');
    Array.prototype.forEach.call($('diff-row').children, function (b) {
      b.addEventListener('click', function () {
        rgDiff = parseInt(b.dataset.diff, 10);
        renderRegionDetail();
      });
    });
    renderMedals();
  }
  function renderMedals() {
    $('medal-diff').textContent = D.DIFFICULTIES[rgDiff].name;
    $('medal-row').innerHTML = D.MEDALS.map(function (m) {
      var cls = { bronze: 'm-bronze', silver: 'm-silver', gold: 'm-gold', champion: 'm-champion' }[m.id];
      return '<div class="medal ' + cls + '"><b>🏅 ' + esc(m.name) + '</b>' + esc(m.cond) + '</div>';
    }).join('');
  }
  $('region-list').addEventListener('click', function (e) {
    var it = e.target.closest ? e.target.closest('.rg-item') : null;
    if (it) { rgIdx = parseInt(it.dataset.idx, 10); renderRegionList(); renderRegionDetail(); sfx('click'); }
  });
  Array.prototype.forEach.call($('mode-row').children, function (b) {
    b.addEventListener('click', function () {
      rgMode = b.dataset.mode;
      Array.prototype.forEach.call($('mode-row').children, function (x) { x.classList.toggle('on', x === b); });
      sfx('click');
    });
  });
  $('btn-start-run').addEventListener('click', startRun);
  Array.prototype.forEach.call($('target-row').children, function (b) {
    b.addEventListener('click', function () {
      rgTarget = b.dataset.target;
      Array.prototype.forEach.call($('target-row').children, function (x) { x.classList.toggle('on', x === b); });
      $('btn-start-run').innerHTML = rgTarget === 'pvp' ? '开战！<kbd>Enter</kbd>' : '出发！<kbd>Enter</kbd>';
      sfx('click');
    });
  });
  $('btn-back-char').addEventListener('click', function () { STATE = 'charselect'; showScreen('screen-charselect'); });
  function gotoRegion() {
    STATE = 'regionselect';
    showScreen('screen-region');
    renderRegionList(); renderRegionDetail();
    sfx('confirm');
  }

  /* ============================================================
     对局状态
     ============================================================ */
  var RUN = null;
  var cam = { x: 0, y: 0, shake: 0 };
  var T = 0;

  function makePlayer(c) {
    var st = {
      maxHp: c.run.maxHp, armor: c.run.armor, dodge: c.run.dodge, speedMul: c.run.speedMul,
      physMul: c.run.physMul, specMul: c.run.specMul, regen: c.run.regen, crit: c.run.crit
    };
    if (c.id === 'snorlax') { st.armor += 20; st.maxHp += 60; }
    return {
      x: 0, y: 0, r: 30, hp: st.maxHp,
      level: 1, xp: 0, xpNext: 8,
      stats: st, moveDmgMul: 1, catchBonus: c.id === 'eevee' ? 0.20 : 0,
      takeMul: c.id === 'snorlax' ? 0.9 : 1,
      moves: c.moves.map(function (mk) {
        return { key: mk, def: D.MOVES[mk], lv: 1, cd: 0, dmgDealt: 0, unlocked: D.MOVES[mk].unlockLv <= 1 };
      }),
      ultCharge: 0, evoStage: 0, evoName: c.name,
      invuln: 0, hitFlash: 0, regenBuffT: 0, moving: false, faceLeft: false
    };
  }

  function startRun() {
    if (rgTarget === 'pvp') { startPvp(); return; }
    var c = D.CHARACTERS[csIdx], r = D.REGIONS[rgIdx], diff = D.DIFFICULTIES[rgDiff];
    RUN = {
      char: c, region: r, diff: diff, mode: rgMode,
      player: makePlayer(c),
      enemies: [], projectiles: [], coins: [], texts: [], rings: [], particles: [],
      party: [], decor: [],
      coinVal: 0, ballPrice: 18,
      area: 0, areaTimer: 600, kills: 0, areaKills: 0, quota: 16,
      guardian: null, guardianSpawned: false,
      elapsed: 0, waveT: 1.2, milestone: 0,
      totalDmg: 0, elementHits: 0, hitsTaken: 0, catches: 0, streak: 0, bestStreak: 0,
      evoCount: 0, coinsEarned: 0, score: 0,
      newDex: {}, over: false, win: false
    };
    for (var i = 0; i < 90; i++) {
      RUN.decor.push({ x: rand(-2600, 2600), y: rand(-2600, 2600), r: rand(18, 60), a: rand(.12, .3), kind: Math.random() < .5 ? 0 : 1 });
    }
    cam.x = 0; cam.y = 0; cam.shake = 0;
    buildMovesBar(); buildAreaTrack(); refreshParty();
    $('hud-name').textContent = c.name;
    $('hud-type').textContent = D.TYPE_CN[c.type];
    $('hud-type').style.background = D.TYPE_COLORS[c.type] + '55';
    $('ult-name').textContent = c.ultimate.name;
    $('hud-region').textContent = r.name;
    $('hud-diff').textContent = diff.name;
    $('hud-avatar').innerHTML = spriteImg(c.chain[0], '', 46);
    updateEvoHint();
    STATE = 'playing';
    showScreen(null);
    $('bossbar').classList.add('hidden');
    banner(r.name, rgMode === 'classic' ? '经典模式 · 区域 1/3' : (rgMode === 'survival' ? '生存模式 · 无限宝可梦群' : '无限流模式 · AI 异象降临'));
    sfx('confirm');
    updateHudCoins();
    render();
  }

  /* ---------- PvP 镜像对决 / 排行榜 ---------- */
  var PVP_LEVEL = { normal: 20, hard: 26, nightmare: 32 };
  var boardMode = 'all', boardReturn = 'charselect';

  function startPvp() {
    var c = D.CHARACTERS[csIdx], diff = D.DIFFICULTIES[rgDiff];
    var lvl = PVP_LEVEL[diff.id] || 20;
    STATE = 'duel';
    showScreen('screen-duel');
    sfx('confirm');
    DUEL.open(c, lvl, function () {
      STATE = 'regionselect';
      showScreen('screen-region');
    });
  }
  function buildBoardTabs() {
    var row = $('board-tabs');
    if (!row || row.dataset.built === '1' || !window.LB) return;
    row.dataset.built = '1';
    row.innerHTML = LB.MODES.map(function (m) {
      return '<button class="mode-btn' + (m.id === boardMode ? ' on' : '') + '" data-bm="' + m.id + '"><b>' + m.name + '</b></button>';
    }).join('');
    row.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-bm]') : null;
      if (!b) return;
      boardMode = b.dataset.bm;
      Array.prototype.forEach.call(row.children, function (x) { x.classList.toggle('on', x === b); });
      LB.renderList($('board-list'), boardMode);
      sfx('click');
    });
  }
  function openBoard(ret) {
    boardReturn = ret || 'charselect';
    STATE = 'board';
    showScreen('screen-board');
    buildBoardTabs();
    if (window.LB) LB.renderList($('board-list'), boardMode);
    sfx('click');
  }
  function closeBoard() {
    var r = boardReturn;
    STATE = r === 'duel' ? 'duel' : (r === 'regionselect' ? 'regionselect' : (r === 'over' ? 'over' : 'charselect'));
    showScreen(r === 'duel' ? 'screen-duel' : (r === 'regionselect' ? 'screen-region' : (r === 'over' ? 'screen-over' : 'screen-charselect')));
  }
  /* 结算：询问是否上传名字 */
  function offerUpload() {
    var box = $('upload-box');
    if (!box || !RUN) return;
    box.classList.add('hidden');
    box.innerHTML = '';
    if (!window.LB) return;
    window.LB.renderPrompt(box, {
      name: '', score: RUN.score, mode: RUN.mode,
      char: RUN.char.id, level: RUN.player.level,
      kills: RUN.kills, elapsed: Math.round(RUN.elapsed), diff: RUN.diff.id
    }, function () { });
  }

  /* ---------- HUD 部件 ---------- */
  function buildMovesBar() {
    if (!RUN) return;
    var h = '';
    RUN.player.moves.forEach(function (mv, i) {
      var m = mv.def;
      h += '<div class="mv ' + (mv.unlocked ? '' : 'locked') + '" data-i="' + i + '">' +
        '<div class="mv-ic" style="background:' + D.TYPE_COLORS[m.type] + '33">' + (m.cat === '物理' ? '💥' : '✨') + '</div>' +
        '<div class="mv-name">' + esc(m.name) + '</div>' +
        (mv.unlocked ? '<div class="mv-lv">Lv.' + mv.lv + '</div><div class="mv-cd" style="display:none"></div>'
          : '<div class="mv-lock">在 Lv.' + m.unlockLv + ' 解锁</div>') +
        '</div>';
    });
    $('moves').innerHTML = h;
  }
  function buildAreaTrack() {
    var h = '';
    if (RUN.mode !== 'classic') {
      h = '<div class="area-dot cur">∞</div><div class="area-dot boss">★</div>';
    } else {
      for (var i = 0; i < 3; i++) h += '<div class="area-dot ' + (i < RUN.area ? 'done' : (i === RUN.area ? 'cur' : '')) + '">' + (i + 1) + '</div>';
      h += '<div class="area-dot boss ' + (RUN.area >= 3 ? 'cur' : '') + '">圣地</div>';
    }
    $('hud-areatrack').innerHTML = h;
    $('hud-area').textContent = RUN.mode === 'classic' ? (RUN.area >= 3 ? '森林圣地' : '区域 ' + (RUN.area + 1) + '/3') :
      (RUN.mode === 'survival' ? '生存 · 无尽' : '无限流 · 无尽');
  }
  function updateEvoHint() {
    var c = RUN.char, next = c.evo[RUN.player.evoStage];
    $('hud-evohint').textContent = next ? '在 Lv.' + next.at + ' 进化' : '已完全进化';
  }
  function refreshParty() {
    $('party').innerHTML = RUN.party.map(function (p) {
      return '<div class="pm" title="' + esc(p.name) + '">' + spriteImg(p.sprite, '', 44) + '</div>';
    }).join('');
  }

  /* ---------- Banner ---------- */
  var bannerT = null;
  function banner(txt, sub) {
    var el = $('banner');
    $('banner-txt').textContent = txt;
    $('banner-sub').textContent = sub || '';
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    if (bannerT) clearTimeout(bannerT);
    bannerT = setTimeout(function () { el.classList.remove('show'); }, 2300);
  }

  /* ============================================================
     生成
     ============================================================ */
  function wildPool() {
    var types = RUN.region.types;
    var pool = D.WILD.filter(function (w) { return types.indexOf(w.type) >= 0; });
    return pool.length ? pool : D.WILD;
  }
  function spawnWild(n) {
    var p = RUN.player, diff = RUN.diff, t = RUN.elapsed;
    var scale = (1 + t / 150) * diff.enemyMul;
    var pool = wildPool();
    for (var i = 0; i < n; i++) {
      if (RUN.enemies.length >= 75) return;
      var ang = rand(0, Math.PI * 2), d = rand(720, 1050);
      var w = pick(pool);
      RUN.enemies.push({
        id: w.id, name: w.name, type: w.type, sprite: w.sprite,
        x: p.x + Math.cos(ang) * d, y: p.y + Math.sin(ang) * d,
        hp: w.hp * scale, maxHp: w.hp * scale, atk: w.atk * (1 + t / 240) * diff.enemyMul,
        spd: w.spd * rand(.9, 1.15), size: w.size, r: w.size * 1.35,
        xp: w.xp, boss: false, final: false,
        hitFlash: 0, touchCd: 0, stun: 0, vx: 0, vy: 0
      });
    }
  }
  function spawnGuardian(areaIdx) {
    var r = RUN.region, p = RUN.player;
    var pool = r.guardians[Math.min(areaIdx, r.guardians.length - 1)];
    var key = pick(pool), b = D.BOSSES[key];
    if (!b) return;
    var diff = RUN.diff;
    var hpMul = (1 + areaIdx * 0.18) * diff.enemyMul;
    var ang = rand(0, Math.PI * 2), d = 640;
    var e = {
      id: key, name: b.name, type: b.type, sprite: b.sprite,
      x: p.x + Math.cos(ang) * d, y: p.y + Math.sin(ang) * d,
      hp: b.hp * hpMul, maxHp: b.hp * hpMul, atk: b.atk * diff.enemyMul,
      spd: b.spd, size: b.r, r: b.r * 1.3,
      xp: 60 + areaIdx * 30, boss: true, final: !!b.final,
      hitFlash: 0, touchCd: 0, stun: 0, vx: 0, vy: 0
    };
    RUN.enemies.push(e);
    RUN.guardian = e; RUN.guardianSpawned = true;
    $('bossbar').classList.remove('hidden');
    $('bossbar-name').textContent = (b.final ? '圣地守护者 · ' : '区域守护者 · ') + b.name;
    banner(b.final ? '森林圣地降临！' : '守护者来袭！', b.name + ' · ' + D.TYPE_CN[b.type] + '属性');
    sfx(b.final ? 'bossdie' : 'alert');
  }

  /* ============================================================
     战斗
     ============================================================ */
  function nearestEnemy(x, y, maxD) {
    var best = null, bd = maxD ? maxD * maxD : Infinity;
    for (var i = 0; i < RUN.enemies.length; i++) {
      var e = RUN.enemies[i];
      var dx = e.x - x, dy = e.y - y, d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = e; }
    }
    return best;
  }
  function effMult(moveType, enemyType) {
    var row = D.effect[moveType];
    if (!row) return 1;
    var v = row[enemyType];
    return typeof v === 'number' ? v : 1;
  }
  function addText(x, y, txt, color) {
    RUN.texts.push({ x: x, y: y, txt: txt, color: color || '#fff', t: 0, life: .9 });
  }
  function addRing(x, y, r0, r1, color, life) {
    RUN.rings.push({ x: x, y: y, r0: r0, r1: r1, t: 0, life: life || .35, color: color || '#fff', w: 5 });
  }
  function burst(x, y, color, n) {
    for (var i = 0; i < (n || 8); i++) {
      var a = rand(0, Math.PI * 2), s = rand(60, 260);
      RUN.particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: rand(.25, .6), color: color, r: rand(2, 5) });
    }
  }
  function damageEnemy(e, rawDmg, moveType, isCrit, isElement, mv) {
    if (!e || e.hp <= 0) return 0;
    var p = RUN.player, c = RUN.char;
    var dmg = rawDmg;
    if (c.id === 'squirtle' && p.hp / p.stats.maxHp < .4) dmg *= 1.4;
    if (c.id === 'charmander' && p.hp / p.stats.maxHp < .33) dmg *= 1.5;
    if (c.id === 'eevee') dmg *= 1.08;
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg;
    e.hitFlash = .12;
    RUN.totalDmg += dmg;
    if (mv) mv.dmgDealt += dmg;
    addText(e.x, e.y - e.r * 1.2 + rand(-4, 4), (isCrit ? '✦' : '') + dmg, isCrit ? '#ffd257' : (isElement ? '#7fe7ff' : '#fff'));
    if (isElement) RUN.elementHits++;
    p.ultCharge = clamp(p.ultCharge + dmg / 22, 0, 100);
    if (e.hp <= 0) killEnemy(e);
    return dmg;
  }

  function killEnemy(e) {
    var idx = RUN.enemies.indexOf(e);
    if (idx >= 0) RUN.enemies.splice(idx, 1);
    RUN.kills++;
    RUN.streak++;
    if (RUN.streak > RUN.bestStreak) RUN.bestStreak = RUN.streak;
    if (RUN.mode === 'classic') RUN.areaKills++;
    gainXp(e.xp * (e.boss ? 2 : 1));
    var n = e.boss ? randInt(18, 32) : randInt(1, 3);
    var dropN = Math.min(n, 6), per = Math.ceil(n / dropN);
    for (var i = 0; i < dropN; i++) {
      RUN.coins.push({ x: e.x + rand(-20, 20), y: e.y + rand(-20, 20), vx: rand(-70, 70), vy: rand(-70, 70), t: 0, v: per });
    }
    burst(e.x, e.y, D.TYPE_COLORS[e.type] || '#fff', e.boss ? 22 : 8);
    sfx(e.boss ? 'bossdie' : 'die');
    clearGuardian(e);
  }

  function gainXp(n) {
    var p = RUN.player;
    p.xp += n;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level++;
      p.xpNext = Math.round(8 + p.level * 6.5);
      p.moves.forEach(function (mv) { if (mv.unlocked) mv.lv++; });
      p.moves.forEach(function (mv) {
        if (!mv.unlocked && p.level >= mv.def.unlockLv) {
          mv.unlocked = true;
          banner('新招式！', mv.def.name + ' · ' + mv.def.kind);
          sfx('levelup');
        }
      });
      buildMovesBar();
      var next = RUN.char.evo[p.evoStage];
      if (next && p.level >= next.at && p.evoStage < RUN.char.chain.length - 1) {
        p.evoStage++;
        p.evoName = next.name;
        RUN.evoCount++;
        p.stats.maxHp = Math.round(p.stats.maxHp * 1.18);
        p.hp = p.stats.maxHp;
        p.moveDmgMul *= 1.15;
        $('hud-avatar').innerHTML = spriteImg(RUN.char.chain[p.evoStage], '', 46);
        updateEvoHint();
        banner('进化！', next.name + ' · 全属性提升');
        addRing(p.x, p.y, 20, 320, '#ffd257', .6);
        burst(p.x, p.y, '#ffd257', 26);
        sfx('win');
      }
      openLevelUp();
    }
    updateHudBars();
  }

  /* ---------- 升级三选一 ---------- */
  var lvChoices = [];
  function openLevelUp() {
    var pool = D.UPGRADES.slice();
    lvChoices = [];
    for (var i = 0; i < 3 && pool.length; i++) {
      var k = Math.floor(Math.random() * pool.length);
      lvChoices.push(pool.splice(k, 1)[0]);
    }
    $('card-list').innerHTML = lvChoices.map(function (u, i) {
      return '<div class="card" data-i="' + i + '"><div class="cicon">' + u.icon + '</div>' +
        '<h3>' + esc(u.name) + '</h3><p>' + esc(u.desc) + '</p><div class="ckey"><kbd>' + (i + 1) + '</kbd> 选择</div></div>';
    }).join('');
    STATE = 'levelup';
    $('screen-levelup').classList.remove('hidden');
    $('screen-pause').classList.add('hidden');
  }
  function chooseUpgrade(i) {
    var u = lvChoices[i];
    if (!u) return;
    u.apply(RUN.player);
    $('screen-levelup').classList.add('hidden');
    STATE = 'playing';
    sfx('levelup');
    updateHudBars();
  }
  $('card-list').addEventListener('click', function (e) {
    var card = e.target.closest ? e.target.closest('.card') : null;
    if (card) chooseUpgrade(parseInt(card.dataset.i, 10));
  });

  /* ---------- 投球捕获 ---------- */
  function throwBall() {
    var p = RUN.player, price = RUN.ballPrice;
    if (RUN.coinVal < price) {
      addText(p.x, p.y - 70, '宝可币不足', '#ff8a72');
      sfx('no');
      return;
    }
    RUN.coinVal -= price;
    RUN.ballPrice = Math.ceil(price * 1.22);
    var e = nearestEnemy(p.x, p.y, 900);
    var ang = e ? Math.atan2(e.y - p.y, e.x - p.x) : (p.faceLeft ? Math.PI : 0);
    RUN.projectiles.push({
      x: p.x, y: p.y, vx: Math.cos(ang) * 620, vy: Math.sin(ang) * 620,
      dmg: 0, type: 'normal', r: 12, life: 1.4, ball: true, pierceLeft: 1, hit: {}
    });
    sfx('throw');
    updateHudCoins();
  }
  function tryCatch(e) {
    var p = RUN.player;
    var chance = .15 + (1 - e.hp / e.maxHp) * .75 + p.catchBonus;
    if (e.boss) chance *= .55;
    if (Math.random() < chance) {
      var idx = RUN.enemies.indexOf(e);
      if (idx >= 0) RUN.enemies.splice(idx, 1);
      RUN.catches++;
      RUN.newDex[e.sprite] = (RUN.newDex[e.sprite] || 0) + 1;
      if (SAVE.dex.indexOf(e.sprite) < 0) SAVE.dex.push(e.sprite);
      if (RUN.party.length < 6) {
        RUN.party.push({ sprite: e.sprite, name: e.name, type: e.type, cd: rand(.2, 1) });
        refreshParty();
      } else {
        RUN.coinVal += 15;
        RUN.coinsEarned += 15;
        addText(e.x, e.y - 40, '+15 ₽（队伍已满）', '#ffd257');
      }
      addText(e.x, e.y - 50, '捕获成功！', '#7fe7ff');
      addRing(e.x, e.y, 10, 120, '#7fe7ff', .4);
      burst(e.x, e.y, '#7fe7ff', 14);
      sfx('catch');
      clearGuardian(e);
    } else {
      addText(e.x, e.y - 50, '挣脱了！', '#ff8a72');
      e.hitFlash = .15;
      sfx('no');
    }
  }
  /* 守护者离场统一处理：击杀/捕获共用同一套进区与通关链 */
  function clearGuardian(e) {
    if (RUN.guardian !== e) return;
    RUN.guardian = null;
    $('bossbar').classList.add('hidden');
    if (e.final) {
      finishRun(true);
    } else if (RUN.mode === 'classic') {
      RUN.area++;
      RUN.areaKills = 0;
      RUN.quota = 16 + RUN.area * 8;
      RUN.areaTimer = 600;
      RUN.guardianSpawned = false;
      buildAreaTrack();
      if (RUN.area >= 3) {
        banner('进入森林圣地！', '最终守护者苏醒了…');
        setTimeout(function () {
          if (RUN && !RUN.over && RUN.mode === 'classic' && !RUN.guardian) spawnGuardian(3);
        }, 1400);
      } else {
        banner('区域清除！', '下一个区域：' + (RUN.area + 1) + '/3');
        sfx('win');
      }
    } else {
      RUN.guardianSpawned = false;
      banner('里程碑达成！', '星星沙子 +30');
      RUN.coinsEarned += 30;
    }
  }

  /* ---------- 终极技 ---------- */
  function useUlt() {
    var p = RUN.player;
    if (p.ultCharge < 100) return;
    p.ultCharge = 0;
    var R = 420, base = 220 * (1 + p.level * .12) * p.stats.specMul * p.moveDmgMul;
    addRing(p.x, p.y, 30, R, D.TYPE_COLORS[RUN.char.type], .55);
    addRing(p.x, p.y, 10, R * .7, '#fff', .4);
    burst(p.x, p.y, D.TYPE_COLORS[RUN.char.type], 34);
    cam.shake = 22;
    RUN.enemies.slice().forEach(function (e) {
      if (dist(p.x, p.y, e.x, e.y) < R + e.r) {
        var eff = effMult(RUN.char.type, e.type);
        var crit = Math.random() < p.stats.crit;
        damageEnemy(e, base * eff * (crit ? 1.75 : 1), RUN.char.type, crit, eff > 1);
        e.stun = Math.max(e.stun, 1.6);
        var a = Math.atan2(e.y - p.y, e.x - p.x);
        e.vx += Math.cos(a) * 320; e.vy += Math.sin(a) * 320;
      }
    });
    p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * .12);
    banner(RUN.char.ultimate.name, '终极技释放！');
    sfx('bossdie');
    updateHudBars();
  }

  /* ============================================================
     更新
     ============================================================ */
  function updateRun(dt) {
    var p = RUN.player, c = RUN.char;
    RUN.elapsed += dt;

    /* 移动 */
    var mx = 0, my = 0;
    if (keys['KeyW'] || keys['ArrowUp']) my -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) my += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) mx += 1;
    mx += joy.dx; my += joy.dy;
    var ml = Math.sqrt(mx * mx + my * my);
    if (ml > 1) { mx /= ml; my /= ml; }
    var speed = 265 * p.stats.speedMul;
    p.x += mx * speed * dt; p.y += my * speed * dt;
    p.moving = ml > .1;
    if (Math.abs(mx) > .1) p.faceLeft = mx < 0;

    /* 回复 */
    var regen = p.stats.regen * (c.id === 'bulbasaur' && p.regenBuffT > 0 ? 2 : 1);
    p.hp = Math.min(p.stats.maxHp, p.hp + regen * dt);
    p.regenBuffT = Math.max(0, p.regenBuffT - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);

    /* 刷怪 */
    RUN.waveT -= dt;
    if (RUN.waveT <= 0) {
      RUN.waveT = clamp(2.4 - RUN.elapsed / 120, .65, 2.4);
      spawnWild(randInt(2, 4));
    }
    if (RUN.mode === 'classic' && !RUN.guardianSpawned && RUN.area < 3) {
      RUN.areaTimer -= dt;
      if (RUN.areaKills >= RUN.quota || RUN.areaTimer <= 0) spawnGuardian(RUN.area);
    }
    if (RUN.mode !== 'classic') {
      var ms = Math.floor(RUN.elapsed / 120);
      if (ms > RUN.milestone) {
        RUN.milestone = ms;
        banner('里程碑！', '存活 ' + fmtTime(RUN.elapsed) + ' · 星星沙子 +30');
        RUN.coinsEarned += 30;
        if (!RUN.guardian) spawnGuardian(Math.min(3, ms));
      }
    }

    /* 敌人 AI */
    var i, j, k;
    for (i = RUN.enemies.length - 1; i >= 0; i--) {
      var e = RUN.enemies[i];
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.touchCd = Math.max(0, e.touchCd - dt);
      e.stun = Math.max(0, e.stun - dt);
      e.x += e.vx * dt; e.y += e.vy * dt;
      e.vx *= (1 - 3.2 * dt); e.vy *= (1 - 3.2 * dt);
      if (e.stun <= 0) {
        var a = Math.atan2(p.y - e.y, p.x - e.x);
        e.x += Math.cos(a) * e.spd * 26 * dt;
        e.y += Math.sin(a) * e.spd * 26 * dt;
      }
      if (dist(p.x, p.y, e.x, e.y) < p.r + e.r && e.touchCd <= 0 && p.invuln <= 0) {
        e.touchCd = .8;
        hurtPlayer(e);
      }
    }
    /* 敌人分离 */
    for (i = 0; i < RUN.enemies.length; i++) {
      for (j = i + 1; j < RUN.enemies.length; j++) {
        var ea = RUN.enemies[i], eb = RUN.enemies[j];
        var ddx = eb.x - ea.x, ddy = eb.y - ea.y, dd = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
        var min = ea.r + eb.r;
        if (dd < min) {
          var push = (min - dd) * .5;
          ddx /= dd; ddy /= dd;
          ea.x -= ddx * push; ea.y -= ddy * push;
          eb.x += ddx * push; eb.y += ddy * push;
        }
      }
    }

    /* 招式自动开火 */
    p.moves.forEach(function (mv) {
      if (!mv.unlocked) return;
      mv.cd -= dt;
      if (mv.cd > 0) return;
      var m = mv.def;
      var target = nearestEnemy(p.x, p.y, (m.range ? m.range * 22 : (m.radius || 5) * 30));
      if (!target) return;
      fireMove(mv, target);
      mv.cd = m.cd;
    });

    /* 队友输出 */
    RUN.party.forEach(function (ally) {
      ally.cd -= dt;
      if (ally.cd <= 0) {
        ally.cd = 1.5;
        var t = nearestEnemy(p.x, p.y, 700);
        if (t) {
          var aa = Math.atan2(t.y - p.y, t.x - p.x);
          RUN.projectiles.push({
            x: p.x + Math.cos(aa) * 40, y: p.y + Math.sin(aa) * 40,
            vx: Math.cos(aa) * 560, vy: Math.sin(aa) * 560,
            dmg: 8 + p.level * 2.2, type: ally.type, r: 8, life: 1.2,
            ball: false, pierceLeft: 1, hit: {}
          });
        }
      }
    });

    /* 弹丸 */
    for (j = RUN.projectiles.length - 1; j >= 0; j--) {
      var pr = RUN.projectiles[j];
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
      if (pr.life <= 0) { RUN.projectiles.splice(j, 1); continue; }
      for (k = RUN.enemies.length - 1; k >= 0; k--) {
        var e2 = RUN.enemies[k];
        if (pr.hit[k]) continue;
        if (dist(pr.x, pr.y, e2.x, e2.y) < pr.r + e2.r) {
          if (pr.ball) {
            RUN.projectiles.splice(j, 1);
            tryCatch(e2);
            break;
          }
          pr.hit[k] = true;
          var eff2 = effMult(pr.type, e2.type);
          var crit2 = Math.random() < p.stats.crit;
          damageEnemy(e2, pr.dmg * eff2 * (crit2 ? 1.75 : 1), pr.type, crit2, eff2 > 1, pr.ownerMove);
          pr.pierceLeft--;
          if (pr.pierceLeft <= 0) {
            RUN.projectiles.splice(j, 1);
            break;
          }
        }
      }
    }

    /* 金币 */
    for (k = RUN.coins.length - 1; k >= 0; k--) {
      var co = RUN.coins[k];
      co.t += dt;
      co.x += co.vx * dt; co.y += co.vy * dt;
      co.vx *= (1 - 2.5 * dt); co.vy *= (1 - 2.5 * dt);
      var dc = dist(p.x, p.y, co.x, co.y);
      if (dc < 170) {
        var ca = Math.atan2(p.y - co.y, p.x - co.x);
        co.x += Math.cos(ca) * 480 * dt; co.y += Math.sin(ca) * 480 * dt;
      }
      if (dc < 34) {
        RUN.coins.splice(k, 1);
        RUN.coinVal += co.v;
        RUN.coinsEarned += co.v;
        sfx('coin');
        updateHudCoins();
      }
    }

    /* 特效 */
    for (k = RUN.texts.length - 1; k >= 0; k--) {
      var tx = RUN.texts[k]; tx.t += dt; tx.y -= 46 * dt;
      if (tx.t > tx.life) RUN.texts.splice(k, 1);
    }
    for (k = RUN.rings.length - 1; k >= 0; k--) {
      var rg = RUN.rings[k]; rg.t += dt;
      if (rg.t > rg.life) RUN.rings.splice(k, 1);
    }
    for (k = RUN.particles.length - 1; k >= 0; k--) {
      var pt2 = RUN.particles[k];
      pt2.t += dt; pt2.x += pt2.vx * dt; pt2.y += pt2.vy * dt;
      pt2.vx *= (1 - 2 * dt); pt2.vy *= (1 - 2 * dt);
      if (pt2.t > pt2.life) RUN.particles.splice(k, 1);
    }

    /* 快捷键 */
    if (keyPressed('Space')) throwBall();
    if (keyPressed('KeyR')) useUlt();

    /* 相机 */
    cam.x = lerp(cam.x, p.x, 1 - Math.pow(.001, dt));
    cam.y = lerp(cam.y, p.y, 1 - Math.pow(.001, dt));
    cam.shake = Math.max(0, cam.shake - 42 * dt);

    updateHudLive();
  }

  function hurtPlayer(e) {
    var p = RUN.player, c = RUN.char;
    if (Math.random() < p.stats.dodge) {
      addText(p.x, p.y - 60, '闪避！', '#7fe7ff');
      sfx('no');
      return;
    }
    var mult = 1;
    if (c.chart.weak.indexOf(e.type) >= 0) mult = 1.35;
    else if (c.chart.resist.indexOf(e.type) >= 0) mult = .8;
    var dmg = e.atk * mult * p.takeMul * (1 - p.stats.armor / (p.stats.armor + 130));
    dmg = Math.max(1, Math.round(dmg));
    p.hp -= dmg;
    p.invuln = .55;
    p.hitFlash = .25;
    p.regenBuffT = 3;
    RUN.hitsTaken++;
    RUN.streak = 0;
    cam.shake = Math.max(cam.shake, 9);
    var v = $('vignette');
    v.classList.add('hit');
    setTimeout(function () { v.classList.remove('hit'); }, 180);
    addText(p.x, p.y - 64, '-' + dmg, '#ff6677');
    sfx('hurt');
    updateHudBars();
    if (p.hp <= 0) { p.hp = 0; finishRun(false); }
  }

  /* ---------- 招式开火 ---------- */
  function fireMove(mv, target) {
    var p = RUN.player, m = mv.def;
    var base = m.dmg * (1 + (mv.lv - 1) * .35) *
      (m.cat === '物理' ? p.stats.physMul : p.stats.specMul) * p.moveDmgMul;
    var ang = Math.atan2(target.y - p.y, target.x - p.x);
    var speed = 540;
    var rangePx = (m.range || 12) * 22;
    function shoot(a) {
      RUN.projectiles.push({
        x: p.x, y: p.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        dmg: base, type: m.type, r: m.kind === '光束' ? 16 : 10,
        life: rangePx / speed, ball: false,
        pierceLeft: 1 + Math.floor((m.pierce || 0) * 3 + (m.kind === '光束' ? 4 : 0)),
        hit: {}, ownerMove: mv
      });
    }
    switch (m.kind) {
      case '连射': {
        var n = m.shots || 3;
        for (var i = 0; i < n; i++) shoot(ang + (i - (n - 1) / 2) * .16);
        break;
      }
      case '旋转': {
        var R = (m.radius || 3) * 26;
        addRing(p.x, p.y, p.r, R, D.TYPE_COLORS[m.type], .3);
        RUN.enemies.slice().forEach(function (e) {
          if (dist(p.x, p.y, e.x, e.y) < R + e.r) {
            var eff = effMult(m.type, e.type);
            var crit = Math.random() < p.stats.crit;
            damageEnemy(e, base * eff * (crit ? 1.75 : 1), m.type, crit, eff > 1, mv);
            var a = Math.atan2(e.y - p.y, e.x - p.x);
            e.vx += Math.cos(a) * 210; e.vy += Math.sin(a) * 210;
          }
        });
        sfx('spin');
        return;
      }
      case '光环': {
        var AR = (m.radius || 5) * 30;
        addRing(p.x, p.y, p.r, AR, D.TYPE_COLORS[m.type], .35);
        RUN.enemies.slice().forEach(function (e) {
          if (dist(p.x, p.y, e.x, e.y) < AR + e.r) {
            var eff = effMult(m.type, e.type);
            var crit = Math.random() < p.stats.crit;
            var dealt = damageEnemy(e, base * eff * (crit ? 1.75 : 1), m.type, crit, eff > 1, mv);
            if (m.name === '寄生种子') p.hp = Math.min(p.stats.maxHp, p.hp + dealt * .3);
            if (m.name === '哈欠') e.stun = Math.max(e.stun, .8);
          }
        });
        return;
      }
      case '光束': {
        shoot(ang);
        addRing(p.x, p.y, 4, 26, D.TYPE_COLORS[m.type], .18);
        break;
      }
      default: shoot(ang);
    }
    sfx(m.cat === '物理' ? 'hit' : 'shoot');
  }

  /* ============================================================
     结算
     ============================================================ */
  function calcScore() {
    return Math.round((RUN.kills * 8 + RUN.catches * 40 + RUN.totalDmg / 8 + RUN.coinsEarned) * RUN.diff.sand);
  }
  function medalFor(timeSec) {
    var best = null;
    D.MEDALS.forEach(function (m) { if (timeSec <= m.limit) best = m; });
    return best || D.MEDALS[0];
  }
  function finishRun(win) {
    if (!RUN || RUN.over) return;
    RUN.over = true; RUN.win = win;
    STATE = 'over';
    var c = RUN.char, r = RUN.region, diff = RUN.diff;
    RUN.score = calcScore();
    if (win) SAVE.wins++;
    SAVE.kills += RUN.kills;
    SAVE.catches += RUN.catches;
    if (RUN.score > SAVE.best) SAVE.best = RUN.score;
    if (win && (SAVE.bestTime === null || RUN.elapsed < SAVE.bestTime)) SAVE.bestTime = RUN.elapsed;
    saveSave();

    $('over-title').textContent = win ? '胜利！' : '你倒下了！';
    $('ob-sub').textContent = r.name + ' · ' + (RUN.mode === 'classic' ? (RUN.area >= 3 ? '森林圣地' : '区域 ' + (RUN.area + 1) + '/3') : (RUN.mode === 'survival' ? '生存 ' : '无限流 ') + fmtTime(RUN.elapsed)) + ' · ' + diff.name;
    $('ob-name').textContent = c.name + (RUN.player.evoStage > 0 ? ' → ' + RUN.player.evoName : '') + ' · Lv.' + RUN.player.level;
    $('ob-avatar').innerHTML = spriteImg(c.chain[RUN.player.evoStage], '', 72);
    $('ob-chips').innerHTML =
      '<div class="ob-chip"><div class="v">' + fmtElapsed(RUN.elapsed) + '</div><div class="l">时间</div></div>' +
      '<div class="ob-chip"><div class="v">' + RUN.kills + '</div><div class="l">击败数</div></div>' +
      '<div class="ob-chip"><div class="v">' + Math.round(RUN.totalDmg) + '</div><div class="l">伤害</div></div>' +
      '<div class="ob-chip"><div class="v">' + RUN.score + '</div><div class="l">积分</div></div>';
    var medal = win ? medalFor(RUN.elapsed) : null;
    $('oc-rank').innerHTML =
      '<div class="oc-line"><span>星星沙子得分</span><b>' + RUN.score + '</b></div>' +
      '<div class="oc-line"><span>难度倍率</span><b>×' + diff.sand + '</b></div>' +
      '<div class="oc-line"><span>计时奖牌</span><b>' + (medal ? '🏅 ' + medal.name : '未获得') + '</b></div>' +
      '<div class="oc-line"><span>历史最佳积分</span><b>' + SAVE.best + '</b></div>' +
      '<div class="oc-line"><span>累计胜利</span><b>' + SAVE.wins + '</b></div>';
    var moveBars = RUN.player.moves.filter(function (m) { return m.unlocked && m.dmgDealt > 0; })
      .map(function (mv) {
        var pct = RUN.totalDmg > 0 ? Math.round(mv.dmgDealt / RUN.totalDmg * 100) : 0;
        return '<div class="mvbar"><div class="mb-top"><span>' + esc(mv.def.name) + ' Lv.' + mv.lv + '</span>' +
          '<span>伤害 ' + Math.round(mv.dmgDealt) + ' · ' + pct + '%</span></div>' +
          '<div class="mb-track"><i style="width:' + pct + '%"></i></div></div>';
      }).join('');
    $('oc-run').innerHTML =
      '<div class="oc-line"><span>元素反应</span><b>' + RUN.elementHits + '</b></div>' +
      '<div class="oc-line"><span>进化</span><b>' + RUN.evoCount + '</b></div>' +
      '<div class="oc-line"><span>最佳连胜</span><b>' + RUN.bestStreak + '</b></div>' +
      '<div class="oc-line"><span>受到攻击</span><b>' + RUN.hitsTaken + '</b></div>' +
      '<div class="oc-line"><span>捕获</span><b>' + RUN.catches + '</b></div>' +
      '<div class="oc-line"><span>宝可币收入</span><b>' + RUN.coinsEarned + '</b></div>' + moveBars;
    var newNames = Object.keys(RUN.newDex);
    $('oc-dex-sub').textContent = '新增 ' + newNames.length + ' · 累计 ' + SAVE.dex.length;
    $('oc-dex').innerHTML = newNames.length ? newNames.map(function (sp) {
      var nm = sp, lists = [D.WILD, D.BOSSES], li, lj;
      for (li = 0; li < lists.length; li++) for (lj = 0; lj < (lists[li] || []).length; lj++) {
        if (lists[li][lj] && (lists[li][lj].sprite === sp || lists[li][lj].id === sp) && lists[li][lj].name) nm = lists[li][lj].name;
      }
      return '<div class="dex-line">' + spriteImg(sp, '', 30) + '<span class="dx-n">' + esc(nm) + '</span>' +
        '<span class="dx-new">NEW</span><span class="dx-c">×' + RUN.newDex[sp] + '</span></div>';
    }).join('') : '<div class="dex-line"><span class="dx-c">本次没有新图鉴</span></div>';
    showScreen('screen-over');
    sfx(win ? 'win' : 'lose');
    offerUpload();
  }

  /* ============================================================
     HUD 刷新
     ============================================================ */
  function updateHudBars() {
    if (!RUN) return;
    var p = RUN.player;
    var hpPct = clamp(p.hp / p.stats.maxHp * 100, 0, 100);
    $('hud-hpfill').style.width = hpPct + '%';
    $('hud-hpfill').parentNode.classList.toggle('low', hpPct < 35);
    $('hud-hptext').textContent = Math.ceil(p.hp) + ' / ' + Math.round(p.stats.maxHp);
    $('hud-xpfill').style.width = clamp(p.xp / p.xpNext * 100, 0, 100) + '%';
    $('hud-xptext').textContent = Math.floor(p.xp) + ' / ' + p.xpNext;
    $('hud-level').textContent = 'Lv.' + p.level;
    $('ult-fill').style.height = clamp(p.ultCharge, 0, 100) + '%';
    $('ult-wrap').classList.toggle('ready', p.ultCharge >= 100);
  }
  function updateHudCoins() {
    $('hud-coins').textContent = RUN ? RUN.coinVal : 0;
    $('hud-ballprice').textContent = RUN ? RUN.ballPrice : 18;
  }
  function updateHudLive() {
    var p = RUN.player;
    if (RUN.mode === 'classic') {
      var remain = RUN.areaTimer;
      $('hud-timer').textContent = fmtTime(remain);
      $('hud-timer').classList.toggle('urgent', remain < 60);
      $('hud-elapsed').textContent = fmtElapsed(RUN.elapsed) + ' · ' + (SAVE.bestTime !== null ? '最佳 ' + fmtElapsed(SAVE.bestTime) : '本地图暂无纪录');
    } else {
      $('hud-timer').textContent = fmtTime(RUN.elapsed);
      $('hud-timer').classList.remove('urgent');
      $('hud-elapsed').textContent = '生存 ' + fmtElapsed(RUN.elapsed) + ' · 里程碑 ' + RUN.milestone;
    }
    $('hud-kills').textContent = RUN.kills;
    updateHudCoins();
    updateHudBars();
    var mvs = $('moves').children;
    RUN.player.moves.forEach(function (mv, i) {
      var el = mvs[i];
      if (!el) return;
      var cdEl = el.querySelector('.mv-cd');
      if (!cdEl) return;
      if (mv.cd > 0) { cdEl.style.display = 'flex'; cdEl.textContent = mv.cd.toFixed(1); }
      else cdEl.style.display = 'none';
    });
    if (RUN.guardian) {
      $('bossbar-fill').style.width = clamp(RUN.guardian.hp / RUN.guardian.maxHp * 100, 0, 100) + '%';
    }
  }

  /* ============================================================
     小地图
     ============================================================ */
  var mmCtx = $('minimap').getContext('2d');
  function drawMinimap() {
    if (!RUN) return;
    var S = 150, R = S / 2 - 12, range = 1650;
    mmCtx.clearRect(0, 0, S, S);
    mmCtx.save();
    mmCtx.translate(S / 2, S / 2);
    mmCtx.fillStyle = 'rgba(10,16,36,0.55)';
    mmCtx.beginPath(); mmCtx.arc(0, 0, R, 0, Math.PI * 2); mmCtx.fill();
    mmCtx.strokeStyle = 'rgba(150,170,255,0.35)';
    mmCtx.beginPath(); mmCtx.arc(0, 0, R, 0, Math.PI * 2); mmCtx.stroke();
    var p = RUN.player;
    function dot(x, y, color, r) {
      var dx = (x - p.x) / range * R, dy = (y - p.y) / range * R;
      if (dx * dx + dy * dy > R * R) return;
      mmCtx.fillStyle = color;
      mmCtx.beginPath(); mmCtx.arc(dx, dy, r, 0, Math.PI * 2); mmCtx.fill();
    }
    RUN.coins.forEach(function (c) { dot(c.x, c.y, '#ffd257', 1.6); });
    RUN.enemies.forEach(function (e) {
      dot(e.x, e.y, e.boss ? '#ff9d55' : '#ff5566', e.boss ? 4.4 : 2.4);
    });
    dot(p.x, p.y, '#7fe7ff', 3.6);
    mmCtx.fillStyle = 'rgba(200,215,255,0.85)';
    mmCtx.font = 'bold 9px sans-serif';
    mmCtx.textAlign = 'center'; mmCtx.textBaseline = 'middle';
    mmCtx.fillText('北', 0, -R + 7); mmCtx.fillText('南', 0, R - 7);
    mmCtx.fillText('西', -R + 8, 0); mmCtx.fillText('东', R - 8, 0);
    mmCtx.restore();
  }

  /* ============================================================
     世界渲染
     ============================================================ */
  function render() {
    var p = RUN.player, r = RUN.region;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = r.terrain;
    ctx.fillRect(0, 0, W, H);
    var sh = cam.shake > 0 ? cam.shake : 0;
    var ox = -cam.x + W / 2 + (sh ? rand(-sh, sh) : 0);
    var oy = -cam.y + H / 2 + (sh ? rand(-sh, sh) : 0);
    ctx.save();
    ctx.translate(ox, oy);
    var grid = 130;
    var x0 = Math.floor((cam.x - W / 2) / grid) * grid, x1 = cam.x + W / 2 + grid;
    var y0 = Math.floor((cam.y - H / 2) / grid) * grid, y1 = cam.y + H / 2 + grid;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    var gx, gy;
    for (gx = x0; gx < x1; gx += grid) { ctx.beginPath(); ctx.moveTo(gx, y0); ctx.lineTo(gx, y1); ctx.stroke(); }
    for (gy = y0; gy < y1; gy += grid) { ctx.beginPath(); ctx.moveTo(x0, gy); ctx.lineTo(x1, gy); ctx.stroke(); }
    RUN.decor.forEach(function (d) {
      if (Math.abs(d.x - cam.x) > W / 2 + 120 || Math.abs(d.y - cam.y) > H / 2 + 120) return;
      ctx.fillStyle = d.kind ? 'rgba(255,255,255,' + d.a * .5 + ')' : 'rgba(0,0,0,' + d.a + ')';
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
    });
    /* 金币 */
    RUN.coins.forEach(function (c) {
      drawShadow(c.x, c.y + 10, 10, 5, .22);
      ctx.fillStyle = '#ffd257';
      ctx.beginPath(); ctx.arc(c.x, c.y, 8 + Math.sin(T * 6 + c.t * 5) * 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a97c12'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('₽', c.x, c.y);
    });
    /* 敌人 */
    RUN.enemies.forEach(function (e) {
      drawShadow(e.x, e.y + e.r * 1.05, e.r * .95, e.r * .38, .28);
      var sz = e.r * 2.3;
      ctx.save();
      if (e.hitFlash > 0) ctx.globalAlpha = .65;
      try {
        if (window.Sprites) {
          window.Sprites.draw(ctx, e.sprite, e.type, e.x, e.y, sz, false, T, e.hitFlash > 0 ? .8 : 1);
        } else throw new Error('no sprites');
      } catch (err) {
        ctx.fillStyle = D.TYPE_COLORS[e.type] || '#c94';
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      if (!e.boss && e.hp < e.maxHp) {
        var bw = e.r * 2.2;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(e.x - bw / 2, e.y - e.r * 1.5, bw, 5);
        ctx.fillStyle = '#ff5566';
        ctx.fillRect(e.x - bw / 2, e.y - e.r * 1.5, bw * clamp(e.hp / e.maxHp, 0, 1), 5);
      }
    });
    /* 弹丸 */
    RUN.projectiles.forEach(function (pr) {
      var col = pr.ball ? '#ffffff' : (D.TYPE_COLORS[pr.type] || '#fff');
      ctx.save();
      ctx.globalAlpha = .95;
      ctx.fillStyle = col;
      ctx.shadowColor = col; ctx.shadowBlur = 12;
      if (pr.ball) {
        ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#e33';
        ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#222';
        ctx.fillRect(pr.x - pr.r, pr.y - 1.5, pr.r * 2, 3);
      } else {
        ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });
    /* 玩家 */
    drawShadow(p.x, p.y + p.r * 1.15, p.r * 1.1, p.r * .45, .3);
    ctx.save();
    if (p.hitFlash > 0) ctx.globalAlpha = .6 + Math.sin(T * 30) * .3;
    try {
      if (window.Sprites) {
        window.Sprites.draw(ctx, RUN.char.chain[p.evoStage], RUN.char.type, p.x, p.y + Math.sin(T * (p.moving ? 9 : 3)) * 3, p.r * 2.6, p.faceLeft, T, 1);
      } else throw new Error('no sprites');
    } catch (err) {
      ctx.fillStyle = D.TYPE_COLORS[RUN.char.type];
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    var pbw = 74;
    roundRect(p.x - pbw / 2, p.y - p.r * 2.1, pbw, 8, 4, 'rgba(0,0,0,0.55)');
    roundRect(p.x - pbw / 2, p.y - p.r * 2.1, pbw * clamp(p.hp / p.stats.maxHp, 0, 1), 8, 4,
      p.hp / p.stats.maxHp < .35 ? '#ff5566' : '#36d97a');
    /* 特效 */
    RUN.rings.forEach(function (rg) {
      var k = rg.t / rg.life, rNow = lerp(rg.r0, rg.r1, 1 - Math.pow(1 - k, 2));
      ctx.save();
      ctx.globalAlpha = (1 - k) * .8;
      ctx.strokeStyle = rg.color; ctx.lineWidth = rg.w * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(rg.x, rg.y, rNow, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    });
    RUN.particles.forEach(function (pt2) {
      ctx.save();
      ctx.globalAlpha = 1 - pt2.t / pt2.life;
      ctx.fillStyle = pt2.color;
      ctx.beginPath(); ctx.arc(pt2.x, pt2.y, pt2.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    RUN.texts.forEach(function (tx) {
      ctx.save();
      ctx.globalAlpha = 1 - tx.t / tx.life;
      ctx.font = 'bold 17px sans-serif';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(tx.txt, tx.x, tx.y);
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.txt, tx.x, tx.y);
      ctx.restore();
    });
    ctx.restore();
    drawMinimap();
  }

  /* ============================================================
     主循环
     ============================================================ */
  var lastT = performance.now();
  function frame(now) {
    var dt = clamp((now - lastT) / 1000, 0, .05);
    lastT = now;
    T += dt;

    if (STATE === 'charselect') {
      if (keyPressed('ArrowRight') || keyPressed('KeyD')) selectChar(csIdx + 1);
      if (keyPressed('ArrowLeft') || keyPressed('KeyA')) selectChar(csIdx - 1);
      if (keyPressed('Enter')) gotoRegion();
    } else if (STATE === 'regionselect') {
      if (keyPressed('ArrowRight') || keyPressed('KeyD')) { rgIdx = (rgIdx + 1) % D.REGIONS.length; renderRegionList(); renderRegionDetail(); }
      if (keyPressed('ArrowLeft') || keyPressed('KeyA')) { rgIdx = (rgIdx + D.REGIONS.length - 1) % D.REGIONS.length; renderRegionList(); renderRegionDetail(); }
      if (keyPressed('ArrowDown') || keyPressed('KeyS')) { rgDiff = (rgDiff + 1) % D.DIFFICULTIES.length; renderRegionDetail(); }
      if (keyPressed('ArrowUp') || keyPressed('KeyW')) { rgDiff = (rgDiff + D.DIFFICULTIES.length - 1) % D.DIFFICULTIES.length; renderRegionDetail(); }
      if (keyPressed('Enter')) startRun();
      if (keyPressed('Escape')) { STATE = 'charselect'; showScreen('screen-charselect'); }
    } else if (STATE === 'board') {
      if (keyPressed('Escape')) closeBoard();
    } else if (STATE === 'duel') {
      if (keyPressed('Escape')) DUEL.close();
    } else if (STATE === 'playing') {
      if (keyPressed('Escape') || keyPressed('KeyP')) {
        STATE = 'paused';
        $('screen-pause').classList.remove('hidden');
      }
      if (keyPressed('KeyM')) {
        try {
          if (window.Sfx) {
            window.Sfx.setMuted(!window.Sfx.isMuted());
            $('btn-mute').textContent = window.Sfx.isMuted() ? '🔇' : '🔊';
          }
        } catch (e) { }
      }
      if (window.AIEvent && window.AIEvent.tick) window.AIEvent.tick(RUN, dt);
      updateRun(dt);
      render();
    } else if (STATE === 'paused') {
      if (keyPressed('Escape') || keyPressed('KeyP')) {
        STATE = 'playing';
        $('screen-pause').classList.add('hidden');
      }
    } else if (STATE === 'levelup') {
      if (keyPressed('Digit1') || keyPressed('Numpad1')) chooseUpgrade(0);
      if (keyPressed('Digit2') || keyPressed('Numpad2')) chooseUpgrade(1);
      if (keyPressed('Digit3') || keyPressed('Numpad3')) chooseUpgrade(2);
    } else if (STATE === 'over') {
      if (keyPressed('Enter')) startRun();
      if (keyPressed('Escape')) {
        STATE = 'charselect';
        showScreen('screen-charselect');
        renderCharDetail(); renderRoster();
      }
    }

    pressed = {};
    requestAnimationFrame(frame);
  }

  /* 按钮 */
  $('btn-mute').addEventListener('click', function () {
    try {
      if (window.Sfx) {
        window.Sfx.setMuted(!window.Sfx.isMuted());
        $('btn-mute').textContent = window.Sfx.isMuted() ? '🔇' : '🔊';
      }
    } catch (e) { }
  });
  $('btn-pause').addEventListener('click', function () {
    if (STATE === 'playing') {
      STATE = 'paused';
      $('screen-pause').classList.remove('hidden');
    }
  });
  $('btn-resume').addEventListener('click', function () {
    STATE = 'playing';
    $('screen-pause').classList.add('hidden');
  });
  $('btn-quit').addEventListener('click', function () {
    $('screen-pause').classList.add('hidden');
    if (RUN) finishRun(false);
  });
  $('btn-retry').addEventListener('click', startRun);
  $('btn-menu').addEventListener('click', function () {
    STATE = 'charselect';
    showScreen('screen-charselect');
    renderCharDetail(); renderRoster();
  });
  /* 排行榜 / PvP 入口 */
  if ($('btn-board-cs')) $('btn-board-cs').addEventListener('click', function () { openBoard('charselect'); });
  if ($('btn-board-over')) $('btn-board-over').addEventListener('click', function () { openBoard('over'); });
  if ($('btn-board-duel')) $('btn-board-duel').addEventListener('click', function () { openBoard('duel'); });
  if ($('btn-board-back')) $('btn-board-back').addEventListener('click', closeBoard);
  if ($('btn-duel-back')) $('btn-duel-back').addEventListener('click', function () { DUEL.close(); });
  if ($('btn-duel-again')) $('btn-duel-again').addEventListener('click', function () { startPvp(); });
  $('ult-wrap').addEventListener('click', function () { if (STATE === 'playing') useUlt(); });

  /* ============================================================
     启动
     ============================================================ */
  try {
    if (window.Sprites && window.Sprites.preload) {
      var names = [];
      D.CHARACTERS.forEach(function (c) { c.chain.forEach(function (n) { names.push(n); }); });
      D.WILD.forEach(function (w) { names.push(w.sprite); });
      Object.keys(D.BOSSES).forEach(function (k) { names.push(D.BOSSES[k].sprite); });
      window.Sprites.preload(names);
    }
  } catch (e) { }
  showScreen('screen-charselect');
  renderCharDetail();
  renderRoster();
  requestAnimationFrame(frame);

  /* ============================================================
     AI 无限流挂钩（ai-infinite 分支）
     js/ai.js 通过 window.PB 读取对局状态并施加事件效果。
     ============================================================ */
  window.PB = {
    state: function () {
      if (!RUN || !RUN.player) return {};
      return {
        level: RUN.player.level, kills: RUN.kills, coins: RUN.coinVal,
        hp: Math.round(RUN.player.hp), maxHp: RUN.player.stats.maxHp,
        mode: RUN.mode, area: RUN.area, elapsed: Math.round(RUN.elapsed)
      };
    },
    addCoins: function (v) {
      if (!RUN) return;
      RUN.coinVal += v; RUN.coinsEarned += v;
      updateHudCoins();
    },
    heal: function (v) {
      if (!RUN || !RUN.player) return;
      var p = RUN.player;
      p.hp = Math.min(p.stats.maxHp, p.hp + v);
    },
    damageAll: function (v) {
      if (!RUN) return;
      RUN.enemies.slice().forEach(function (e) { damageEnemy(e, v); });
    },
    xp: function (v) { if (RUN) gainXp(v); },
    wave: function (v) { if (RUN) spawnWild(v); },
    blessing: function (v) {
      if (!RUN || !RUN.player) return;
      var p = RUN.player, mul = 1 + (v || 15) / 100;
      p.moveDmgMul *= mul;
      setTimeout(function () {
        if (RUN && RUN.player === p) p.moveDmgMul /= mul;
      }, 15000);
    },
    banner: function (t, s) { banner(t, s); }
  };
})();
