/* =========================================================
 *  sprites.js — 宝可梦贴图加载 + 离线程序化兜底
 *  在线时用 PokeAPI 官方像素图；离线时用程序化绘制，保证可玩
 * ========================================================= */
(function () {
  'use strict';

  const D = window.DATA;
  const cache = new Map();

  /* 名称 → 全国图鉴编号（PokeAPI sprites 用数字文件名） */
  const NAME_IDS = {
    bulbasaur: 1, ivysaur: 2, venusaur: 3, charmander: 4, charmeleon: 5, charizard: 6,
    squirtle: 7, wartortle: 8, blastoise: 9, caterpie: 10, weedle: 13, pidgey: 16,
    rattata: 19, pikachu: 25, raichu: 26, sandshrew: 27, sandslash: 28, nidoking: 34,
    zubat: 41, oddish: 43, dugtrio: 51, persian: 53, psyduck: 54, golduck: 55,
    primeape: 57, arcanine: 59, poliwrath: 62, alakazam: 65, machop: 66, machamp: 68,
    tentacruel: 73, geodude: 74, golem: 76, slowbro: 80, dodrio: 85, seel: 86, lanturn: 171,
    dewgong: 87, shellder: 90, cloyster: 91, onix: 95, drowzee: 96, hypno: 97,
    marowak: 105, hitmonlee: 106, rhydon: 112, starmie: 121, jynx: 122, scyther: 123,
    electabuzz: 125, pinsir: 127, magikarp: 129, gyarados: 130, lapras: 131,
    eevee: 133, vaporeon: 134, aerodactyl: 142, snorlax: 143, articuno: 144,
    zapdos: 145, dragonite: 149, mewtwo: 150, walrein: 365,
    /* v3 扩充：新增可玩角色与野生池 */
    gastly: 92, haunter: 93, gengar: 94, machoke: 67, abra: 63, kadabra: 64,
    dratini: 147, dragonair: 148, graveler: 75, vulpix: 37, ninetales: 38,
    clefairy: 35, clefable: 36, scizor: 212, koffing: 109, weezing: 110,
    magnemite: 81, magneton: 82, pidgeotto: 17, pidgeot: 18,
    houndour: 228, houndoom: 229, ekans: 23, bellsprout: 69, poliwag: 60,
    voltorb: 100, cubone: 104, staryu: 120, spearow: 21, mankey: 56
  };

  function srcFor(id, shiny) {
    if (typeof id === 'string' && NAME_IDS[id]) id = NAME_IDS[id];
    return 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/' +
      (shiny ? 'shiny/' : '') + id + '.png';
  }

  function get(id) {
    let rec = cache.get(id);
    if (rec) return rec;
    rec = { ok: false, img: new Image(), id: id };
    rec.img.onload = function () { rec.ok = rec.img.naturalWidth > 0; };
    rec.img.onerror = function () { rec.ok = false; };
    rec.img.src = srcFor(id);
    cache.set(id, rec);
    return rec;
  }

  function preload(ids) { ids.forEach(get); }

  /* ---------- 程序化兜底：可爱的圆形小怪兽 ---------- */
  function drawFallback(ctx, type, size, t) {
    const col = D.TYPE_COLORS[type] || '#b9b7a3';
    const s = size / 2;
    const dark = shade(col, -0.42);
    const light = shade(col, 0.28);

    // 身体
    ctx.save();
    ctx.translate(0, size * 0.06);
    ctx.beginPath();
    ctx.ellipse(0, s * 0.18, s * 0.62, s * 0.58, 0, 0, Math.PI * 2);
    const g = ctx.createLinearGradient(0, -s, 0, s);
    g.addColorStop(0, light);
    g.addColorStop(1, col);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(1.4, size * 0.045);
    ctx.strokeStyle = dark;
    ctx.stroke();

    // 耳朵
    ctx.fillStyle = col;
    ctx.strokeStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-s * 0.42, -s * 0.34);
    ctx.lineTo(-s * 0.56, -s * 0.92);
    ctx.lineTo(-s * 0.12, -s * 0.56);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.42, -s * 0.34);
    ctx.lineTo(s * 0.56, -s * 0.92);
    ctx.lineTo(s * 0.12, -s * 0.56);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // 眼睛
    const blink = Math.sin(t * 1.7) > 0.985 ? 0.15 : 1;
    ctx.fillStyle = '#111722';
    ctx.beginPath();
    ctx.ellipse(-s * 0.24, -s * 0.06, s * 0.11, s * 0.14 * blink, 0, 0, Math.PI * 2);
    ctx.ellipse(s * 0.24, -s * 0.06, s * 0.11, s * 0.14 * blink, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-s * 0.2, -s * 0.11, s * 0.045, 0, Math.PI * 2);
    ctx.arc(s * 0.28, -s * 0.11, s * 0.045, 0, Math.PI * 2);
    ctx.fill();

    // 嘴
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(1, size * 0.03);
    ctx.beginPath();
    ctx.arc(0, s * 0.2, s * 0.16, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  function shade(hex, amt) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
    else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
  }

  /* ---------- 统一绘制入口 ---------- */
  function draw(ctx, id, type, x, y, size, flip, t, alpha) {
    const rec = get(id);
    ctx.save();
    ctx.translate(x, y);
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    if (flip) ctx.scale(-1, 1);

    if (rec.ok) {
      ctx.drawImage(rec.img, -size / 2, -size / 2, size, size);
    } else {
      drawFallback(ctx, type, size, t || 0);
    }
    ctx.restore();
  }

  window.Sprites = { get, preload, draw, srcFor };
})();