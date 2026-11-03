/* =========================================================
 *  engine.js — 数学工具 / 输入 / 绘制小工具
 * ========================================================= */
(function () {
  'use strict';

  const TAU = Math.PI * 2;

  const Utils = {
    TAU,
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    rand: (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a)),
    randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: arr => arr[Math.floor(Math.random() * arr.length)],
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    },
    dist2: (x1, y1, x2, y2) => {
      const dx = x2 - x1, dy = y2 - y1;
      return dx * dx + dy * dy;
    },
    dist: (x1, y1, x2, y2) => Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)),
    angleDiff(a, b) {
      let d = ((b - a + Math.PI) % TAU) - Math.PI;
      return d < -Math.PI ? d + TAU : d;
    },
    fmtTime(sec) {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return m + ':' + (s < 10 ? '0' : '') + s;
    }
  };

  /* -------------------- 输入 -------------------- */
  const Input = {
    keys: Object.create(null),
    touch: { active: false, id: null, sx: 0, sy: 0, dx: 0, dy: 0 },
    vec: { x: 0, y: 0 },

    init(canvasEl, joyEl, knobEl) {
      window.addEventListener('keydown', e => {
        const k = e.key.toLowerCase();
        this.keys[k] = true;
        if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].indexOf(k) >= 0) e.preventDefault();
      });
      window.addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
      window.addEventListener('blur', () => { this.keys = Object.create(null); this.touch.active = false; });

      // 虚拟摇杆
      function place(cx, cy) {
        const box = joyEl.getBoundingClientRect();
        const el = joyEl;
        el.style.left = (cx - box.width / 2) + 'px';
        el.style.top = (cy - box.height / 2) + 'px';
        el.style.bottom = 'auto';
      }
      const r = 52;
      joyEl.addEventListener('pointerdown', e => {
        this.touch.active = true;
        this.touch.id = e.pointerId;
        this.touch.sx = e.clientX; this.touch.sy = e.clientY;
        this.touch.dx = 0; this.touch.dy = 0;
        knobEl.style.transform = 'translate(-50%,-50%)';
        joyEl.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      joyEl.addEventListener('pointermove', e => {
        if (!this.touch.active || e.pointerId !== this.touch.id) return;
        let dx = e.clientX - this.touch.sx;
        let dy = e.clientY - this.touch.sy;
        const len = Math.hypot(dx, dy);
        if (len > r) { dx = dx / len * r; dy = dy / len * r; }
        this.touch.dx = dx / r;
        this.touch.dy = dy / r;
        knobEl.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
        e.preventDefault();
      });
      const end = e => {
        if (e.pointerId !== undefined && e.pointerId !== this.touch.id) return;
        this.touch.active = false;
        this.touch.dx = 0; this.touch.dy = 0;
        knobEl.style.transform = 'translate(-50%,-50%)';
      };
      joyEl.addEventListener('pointerup', end);
      joyEl.addEventListener('pointercancel', end);
      joyEl.addEventListener('pointerleave', end);
    },

    update() {
      let x = 0, y = 0;
      const k = this.keys;
      if (k['a'] || k['arrowleft']) x -= 1;
      if (k['d'] || k['arrowright']) x += 1;
      if (k['w'] || k['arrowup']) y -= 1;
      if (k['s'] || k['arrowdown']) y += 1;
      if (this.touch.active) { x += this.touch.dx; y += this.touch.dy; }
      const len = Math.hypot(x, y);
      if (len > 1) { x /= len; y /= len; }
      this.vec.x = x; this.vec.y = y;
      return this.vec;
    },

    isTouch() {
      return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    }
  };

  /* -------------------- 绘制工具 -------------------- */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function shadow(ctx, x, y, rx, ry, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 0.28 : alpha;
    ctx.fillStyle = '#04150a';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  window.Utils = Utils;
  window.Input = Input;
  window.Draw = { roundRect, shadow };
})();