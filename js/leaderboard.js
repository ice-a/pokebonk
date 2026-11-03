/* ============================================================
   排行榜（客户端）v1
   - 本地 localStorage 永久兜底：无后端 / 离线 / API 未配 KV 时照样能上榜
   - 远端 /api/leaderboard 可用时与本地合并去重
   - 结算/对决结束后由 game.js / duel.js 调用 renderPrompt() 询问是否上传
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'pb.lb.v1';
  var NAME_KEY = 'pb.lb.name';
  var MAX_LOCAL = 50;
  var MAX_NAME = 16;
  var MAX_SCORE = 999999;

  var MODES = [
    { id: 'all', name: '全部' },
    { id: 'classic', name: '经典' },
    { id: 'survival', name: '生存' },
    { id: 'infinite', name: '无限流' },
    { id: 'pvp', name: '镜像 PvP' }
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(v, min, max, dflt) {
    var n = Math.round(Number(v));
    if (!isFinite(n)) n = dflt;
    return Math.max(min, Math.min(max, n));
  }
  function cleanName(v) {
    return String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, MAX_NAME);
  }
  function normMode(v) {
    v = String(v || '');
    for (var i = 0; i < MODES.length; i++) if (MODES[i].id === v) return v;
    return 'classic';
  }

  function normalize(e) {
    return {
      name: cleanName(e && e.name) || '无名训练家',
      score: num(e && e.score, 0, MAX_SCORE, 0),
      mode: normMode(e && e.mode),
      char: String((e && (e.char || e.charId)) || '').replace(/[^a-z0-9]/gi, '').slice(0, 20),
      level: num(e && e.level, 1, 99, 1),
      kills: num(e && e.kills, 0, 99999, 0),
      elapsed: num(e && e.elapsed, 0, 99999, 0),
      diff: String((e && e.diff) || 'normal').replace(/[^a-z]/gi, '').slice(0, 12),
      ts: num(e && e.ts, 0, 9999999999999, 0) || Date.now()
    };
  }

  function readLocal() {
    try {
      var a = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(a) ? a.map(normalize) : [];
    } catch (e) { return []; }
  }
  function writeLocal(a) {
    try { localStorage.setItem(KEY, JSON.stringify(a.slice(0, MAX_LOCAL))); } catch (e) { }
  }
  function sortDesc(a) {
    a.sort(function (x, y) { return y.score - x.score || x.ts - y.ts; });
    return a;
  }
  function keyOf(e) { return e.mode + '|' + e.name + '|' + e.score + '|' + e.char; }

  function saveLocal(entry) {
    var e = normalize(entry), a = readLocal(), seen = {}, out = [];
    a.push(e);
    sortDesc(a).forEach(function (x) {
      var k = keyOf(x);
      if (!seen[k]) { seen[k] = 1; out.push(x); }
    });
    writeLocal(out);
    return e;
  }
  function listLocal(mode) {
    var a = readLocal();
    if (mode && mode !== 'all') a = a.filter(function (x) { return x.mode === mode; });
    return sortDesc(a);
  }
  function mergeLists(local, remote, mode) {
    var seen = {}, out = [];
    (local || []).concat(remote || []).forEach(function (e) {
      var n = normalize(e);
      if (mode && mode !== 'all' && n.mode !== mode) return;
      var k = keyOf(n);
      if (!seen[k]) { seen[k] = 1; out.push(n); }
    });
    return sortDesc(out);
  }

  function savedName() {
    try { return cleanName(localStorage.getItem(NAME_KEY) || ''); } catch (e) { return ''; }
  }
  function rememberName(n) {
    try { localStorage.setItem(NAME_KEY, cleanName(n)); } catch (e) { }
  }

  function fetchTop(mode, limit) {
    mode = normMode(mode === 'all' ? 'all' : mode) === 'all' ? 'all' : normMode(mode);
    var local = listLocal(mode);
    var url = '/api/leaderboard?mode=' + encodeURIComponent(mode) + '&limit=' + (limit || 50);
    if (typeof fetch !== 'function') return Promise.resolve(local);
    return fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var remote = (d && d.entries) || [];
        return mergeLists(local, remote, mode);
      })
      .catch(function () { return local; });
  }

  function submit(entry) {
    var e = saveLocal(entry);
    rememberName(e.name);
    if (typeof fetch !== 'function') return Promise.resolve({ ok: true, offline: true, entry: e });
    return fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: [e] })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        return { ok: !!(d && d.ok), ephemeral: !!(d && d.ephemeral), count: (d && d.count) || 0, entry: e };
      })
      .catch(function () { return { ok: true, offline: true, entry: e }; });
  }

  /* ============================================================
     结算「上榜询问」面板：注入 HTML 并绑定事件
     container: 容器元素；entry: 待上传成绩；done(result) 回调
     ============================================================ */
  function renderPrompt(container, entry, done) {
    if (!container) return;
    var e = normalize(entry);
    var name = savedName();
    container.classList.remove('hidden');
    container.innerHTML =
      '<div class="up-head">上榜吗？</div>' +
      '<div class="up-sub">本局积分 <b>' + e.score + '</b> · 模式 ' + esc(modeName(e.mode)) +
      ' · 留个名字就能进排行榜</div>' +
      '<div class="up-row">' +
      '<input id="lb-name" maxlength="' + MAX_NAME + '" autocomplete="off" ' +
      'placeholder="训练家名字（最多 16 字）" value="' + esc(name) + '" />' +
      '<button class="primary" id="btn-upload">上传成绩</button>' +
      '<button id="btn-skip">不上传</button>' +
      '</div>' +
      '<div class="up-tip" id="up-tip"></div>';

    var input = container.querySelector('#lb-name');
    var tip = container.querySelector('#up-tip');

    function finish(res) { if (typeof done === 'function') done(res); }

    container.querySelector('#btn-skip').addEventListener('click', function () {
      container.classList.add('hidden');
      finish({ uploaded: false });
    });
    container.querySelector('#btn-upload').addEventListener('click', function () {
      var nm = cleanName(input.value);
      if (!nm) {
        input.focus();
        tip.textContent = '先写个名字吧（也可以点“不上传”）';
        tip.className = 'up-tip err';
        return;
      }
      e.name = nm;
      tip.textContent = '上传中…';
      tip.className = 'up-tip';
      submit(e).then(function (r) {
        if (!r.ok) {
          tip.textContent = '上传没成功，但成绩已存在本地排行榜';
          tip.className = 'up-tip err';
          return;
        }
        var note = r.offline ? '（离线模式：已写入本地排行榜）' :
          (r.ephemeral ? '（服务器未接存储：已写入本地排行榜）' : '');
        tip.textContent = '已上榜！' + note;
        tip.className = 'up-tip ok';
        setTimeout(function () { container.classList.add('hidden'); finish({ uploaded: true, entry: e, remote: r }); }, 900);
      });
    });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); container.querySelector('#btn-upload').click(); }
    });
    if (input) { try { input.focus(); } catch (err) { } }
  }

  function modeName(id) {
    for (var i = 0; i < MODES.length; i++) if (MODES[i].id === id) return MODES[i].name;
    return id;
  }

  /* 排行榜列表渲染（#board-list） */
  function renderList(el, mode) {
    if (!el) return Promise.resolve([]);
    el.innerHTML = '<div class="lb-loading">加载中…</div>';
    return fetchTop(mode, 50).then(function (list) {
      if (!list.length) {
        el.innerHTML = '<div class="lb-empty">还没有记录。打完一局，上传名字就能上榜。</div>';
        return list;
      }
      var h = '<div class="lb-row lb-head"><span class="lb-r">#</span><span class="lb-n">训练家</span>' +
        '<span class="lb-c">角色</span><span class="lb-m">模式</span><span class="lb-s">积分</span></div>';
      list.slice(0, 50).forEach(function (e, i) {
        var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
        var ch = e.char ? e.char : '';
        h += '<div class="lb-row' + (i < 3 ? ' top' + (i + 1) : '') + '">' +
          '<span class="lb-r">' + medal + '</span>' +
          '<span class="lb-n">' + esc(e.name) + '</span>' +
          '<span class="lb-c">' + esc(ch) + ' Lv.' + e.level + '</span>' +
          '<span class="lb-m">' + esc(modeName(e.mode)) + '</span>' +
          '<span class="lb-s">' + e.score + '</span>' +
          '</div>';
      });
      el.innerHTML = h;
      return list;
    });
  }

  window.LB = {
    MODES: MODES,
    normalize: normalize,
    savedName: savedName,
    rememberName: rememberName,
    listLocal: listLocal,
    fetchTop: fetchTop,
    submit: submit,
    renderPrompt: renderPrompt,
    renderList: renderList,
    modeName: modeName
  };
})();