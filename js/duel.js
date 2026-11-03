/* ============================================================
   PvP 镜像对决（客户端回合制）v1
   - 对手来自排行榜存档（mode=pvp）或内置 PVP_RIVALS 池
   - 逐回合自动结算，带节奏展示；结算后可上传名字上榜
   - 纯前端、离线可玩；不需要服务器参与判定
   ============================================================ */
(function () {
  'use strict';

  var D = window.DATA;
  var ROUND_MS = 420;
  var MAX_ROUNDS = 24;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id) { return document.getElementById(id); }
  function charById(id) {
    for (var i = 0; i < D.CHARACTERS.length; i++) if (D.CHARACTERS[i].id === id) return D.CHARACTERS[i];
    return null;
  }
  function rand(a, b) { return a + Math.random() * (b - a); }

  function effMult(atkType, defType) {
    var row = D.effect[atkType] || {};
    if (row[defType] !== undefined) return row[defType];
    return 1;
  }

  /* 双方 build：等级决定血量/攻击缩放，招式来自角色卡 */
  function buildSide(char, level) {
    var lv = Math.max(1, Math.min(60, Math.round(level || 1)));
    var lvMul = 1 + (lv - 1) * 0.16;
    var maxHp = Math.round(char.run.maxHp * lvMul);
    return {
      char: char, name: char.name, type: char.type, level: lv,
      hp: maxHp, maxHp: maxHp,
      atk: (10 + char.base.atk * 0.24) * lvMul,
      def: char.run.armor * 0.62 + char.base.def * 0.14,
      spd: char.run.speedMul,
      moves: char.moves.map(function (k) { return D.MOVES[k]; }).filter(Boolean),
      dmgDone: 0, hits: 0
    };
  }

  /* 自动决策：优先选对本方属性最有效的招式，属性克制为 0 的跳过 */
  function chooseMove(side, foe) {
    var best = null, bestVal = -1;
    (side.moves || []).forEach(function (m) {
      if (!m) return;
      var e = effMult(m.type, foe.type);
      if (e <= 0) return;
      var v = (m.dmg || 10) * (m.shots || 1) * e * (1 + (m.pierce || 0) * 0.2);
      if (v > bestVal) { bestVal = v; best = m; }
    });
    return best || (side.moves && side.moves[0]) || { name: '挣扎', type: 'normal', dmg: 8, shots: 1 };
  }

  function strike(attacker, defender) {
    var m = chooseMove(attacker, defender);
    var e = effMult(m.type, defender.type);
    var base = (m.dmg || 10) * (m.shots || 1);
    var raw = base * (1 + attacker.atk / 100) * e * rand(0.88, 1.12) - defender.def * 0.35;
    var dmg = Math.max(1, Math.round(raw));
    defender.hp = Math.max(0, defender.hp - dmg);
    attacker.dmgDone += dmg;
    attacker.hits += 1;
    return { move: m, dmg: dmg, eff: e };
  }

  function effLabel(e) {
    if (e >= 2) return { txt: '效果绝佳！', cls: 'good' };
    if (e > 0 && e <= 0.5) return { txt: '效果不好…', cls: 'weak' };
    if (e === 0) return { txt: '没有效果', cls: 'weak' };
    return { txt: '', cls: '' };
  }

  function sideCardHTML(side, mine) {
    var c = side.char;
    var pct = Math.max(0, side.hp / side.maxHp * 100);
    var img = window.Sprites ? window.Sprites.srcFor(c.chain[0]) : '';
    return '<div class="ds-card ' + (mine ? 'mine' : 'rival') + '">' +
      '<div class="ds-avatar"><img src="' + img + '" alt="' + esc(c.name) + '" onerror="this.style.opacity=0" /></div>' +
      '<div class="ds-info">' +
      '<div class="ds-name">' + esc(side.name) + ' <span class="ds-lv">Lv.' + side.level + '</span></div>' +
      '<div class="ds-type" style="background:' + (D.TYPE_COLORS[c.type] || '#888') + '55">' + esc(D.TYPE_CN[c.type] || c.type) + '</div>' +
      '<div class="bar hp"><i style="width:' + pct + '%"></i><span>' + Math.round(side.hp) + ' / ' + side.maxHp + '</span></div>' +
      '</div></div>';
  }

  var CURRENT = null;

  function pickRival(mode) {
    // 优先用排行榜里的真实玩家存档，其次内置对手池
    var pool = (D.PVP_RIVALS || []).slice();
    return window.LB ? window.LB.fetchTop('pvp', 30).then(function (list) {
      var usable = (list || []).filter(function (e) { return e && charById(e.char); });
      if (usable.length) {
        var e = usable[Math.floor(Math.random() * usable.length)];
        return {
          name: e.name + ' 的镜像', char: charById(e.char), level: e.level || 20,
          fromBoard: true, raw: e
        };
      }
      var r = pool[Math.floor(Math.random() * pool.length)];
      return { name: r.name, char: charById(r.char) || D.CHARACTERS[0], level: r.level, title: r.title, fromBoard: false };
    }) : Promise.resolve(null);
  }

  function open(myChar, myLevel, onExit) {
    if (!myChar) myChar = D.CHARACTERS[0];
    pickRival().then(function (rival) {
      if (!rival) {
        var r = (D.PVP_RIVALS || [])[0];
        rival = { name: r.name, char: charById(r.char) || D.CHARACTERS[0], level: r.level };
      }
      start(myChar, myLevel, rival, onExit);
    });
  }

  function start(myChar, myLevel, rival, onExit) {
    var me = buildSide(myChar, myLevel || 20);
    var foe = buildSide(rival.char, rival.level || 20);
    foe.name = rival.name;
    CURRENT = { me: me, foe: foe, round: 0, log: [], over: false, onExit: onExit, rivalSource: rival };

    $('duel-my').innerHTML = sideCardHTML(me, true);
    $('duel-rival').innerHTML = sideCardHTML(foe, false);
    $('duel-log').innerHTML = '';
    var res = $('duel-result');
    if (res) { res.classList.add('hidden'); res.innerHTML = ''; }
    $('duel-title').textContent = '镜像对决';
    $('duel-sub').textContent = rival.fromBoard ? '对手来自排行榜存档' : ('对手：' + (rival.title || '内置挑战者'));
    if (window.Sfx) { try { window.Sfx.play('confirm'); } catch (e) { } }

    setTimeout(function () { step(); }, 260);
  }

  function pushLog(html, cls) {
    var el = $('duel-log');
    if (!el) return;
    var d = document.createElement('div');
    d.className = 'dl-line ' + (cls || '');
    d.innerHTML = html;
    el.appendChild(d);
    el.scrollTop = el.scrollHeight;
  }

  function refreshBars() {
    var c = CURRENT;
    if (!c) return;
    $('duel-my').innerHTML = sideCardHTML(c.me, true);
    $('duel-rival').innerHTML = sideCardHTML(c.foe, false);
  }

  function step() {
    var c = CURRENT;
    if (!c || c.over) return;
    c.round++;

    var meFirst = c.me.spd >= c.foe.spd;
    var order = meFirst ? [['me', c.me, c.foe], ['foe', c.foe, c.me]] : [['foe', c.foe, c.me], ['me', c.me, c.foe]];

    for (var i = 0; i < order.length; i++) {
      var who = order[i][0], atk = order[i][1], def = order[i][2];
      if (atk.hp <= 0 || def.hp <= 0) continue;
      var r = strike(atk, def);
      var lab = effLabel(r.eff);
      var mine = who === 'me';
      pushLog(
        '<span class="dl-r">R' + c.round + '</span>' +
        '<span class="' + (mine ? 'dl-me' : 'dl-foe') + '">' + esc(mine ? '你·' : '对手·') + esc(atk.name) + '</span>' +
        ' 使出 <b>' + esc(r.move.name) + '</b> 造成 <b>' + r.dmg + '</b> 伤害' +
        (lab.txt ? ' <span class="dl-eff ' + lab.cls + '">' + lab.txt + '</span>' : ''),
        mine ? 'me' : 'foe'
      );
    }
    refreshBars();

    var done = c.me.hp <= 0 || c.foe.hp <= 0 || c.round >= MAX_ROUNDS;
    if (done) {
      finish();
      return;
    }
    setTimeout(step, ROUND_MS);
  }

  function scoreFor(c) {
    var win = c.foe.hp <= 0 && c.me.hp > 0;
    var left = Math.max(0, c.me.hp) / c.me.maxHp;
    var base = Math.round(c.me.dmgDone * 0.8);
    if (win) return Math.round(1000 + left * 400 + (MAX_ROUNDS - c.round) * 12 + base);
    return Math.round(base + c.round * 8 + left * 120);
  }

  function finish() {
    var c = CURRENT;
    if (!c || c.over) return;
    c.over = true;
    var win = c.foe.hp <= 0 && c.me.hp > 0;
    var draw = c.foe.hp > 0 && c.me.hp > 0; // 回合耗尽且双方未倒
    var score = scoreFor(c);

    pushLog('<span class="dl-end">' + (win ? '🏆 你赢了！' : (draw ? '⏱ 回合耗尽 · 平局' : '💀 你倒下了')) +
      '　积分 <b>' + score + '</b></span>', 'end');
    if (window.Sfx) { try { window.Sfx.play(win ? 'win' : 'lose'); } catch (e) { } }

    var entry = {
      name: '', score: score, mode: 'pvp',
      char: c.me.char.id, level: c.me.level,
      kills: 0, elapsed: c.round, diff: 'pvp'
    };
    c.entry = entry;

    var box = $('duel-result');
    if (box) {
      box.classList.remove('hidden');
      if (window.LB) {
        window.LB.renderPrompt(box, entry, function (r) {
          if (r && r.uploaded) pushLog('<span class="dl-ok">成绩已记录到排行榜 · 点“查看排行榜”看看名次</span>', 'ok');
        });
      } else {
        box.innerHTML = '<div class="up-head">本局积分 ' + score + '</div>';
      }
    }
  }

  function close() {
    var c = CURRENT;
    if (c && typeof c.onExit === 'function') c.onExit();
  }

  window.DUEL = {
    open: open,
    close: close,
    scoreFor: scoreFor,
    buildSide: buildSide,
    current: function () { return CURRENT; }
  };
})();