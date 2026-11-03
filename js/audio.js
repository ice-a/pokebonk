/* =========================================================
 *  audio.js — 纯 WebAudio 程序化音效（零素材依赖）
 * ========================================================= */
(function () {
  'use strict';

  let ac = null, master = null, muted = false;
  const MASTER_VOL = 0.22;

  function ensure() {
    if (ac) {
      if (ac.state === 'suspended') ac.resume();
      return ac;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = MASTER_VOL;
    master.connect(ac.destination);
    return ac;
  }

  function tone(opt) {
    if (muted) return;
    if (!ensure()) return;
    const now = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = opt.type || 'square';
    o.frequency.setValueAtTime(opt.f0, now);
    if (opt.f1 !== undefined) {
      o.frequency.exponentialRampToValueAtTime(Math.max(20, opt.f1), now + (opt.dur || 0.1));
    }
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(opt.vol === undefined ? 0.3 : opt.vol, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + (opt.dur || 0.1));
    o.connect(g); g.connect(master);
    o.start(now); o.stop(now + (opt.dur || 0.1) + 0.02);
  }

  function noise(opt) {
    if (muted) return;
    if (!ensure()) return;
    const dur = opt.dur || 0.15;
    const now = ac.currentTime;
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len) * (opt.vol || 0.4);
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = opt.filter || 'lowpass';
    bp.frequency.value = opt.freq || 1200;
    const g = ac.createGain();
    g.gain.value = 0.5;
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(now);
  }

  const bank = {
    shoot:    () => tone({ f0: 720, f1: 380, dur: 0.07, type: 'square', vol: 0.10 }),
    water:    () => tone({ f0: 420, f1: 900, dur: 0.06, type: 'sine', vol: 0.10 }),
    slash:    () => { noise({ dur: 0.09, vol: 0.5, filter: 'highpass', freq: 2400 }); tone({ f0: 300, f1: 900, dur: 0.06, type: 'sawtooth', vol: 0.06 }); },
    zap:      () => tone({ f0: 1800, f1: 500, dur: 0.12, type: 'sawtooth', vol: 0.08 }),
    rock:     () => tone({ f0: 160, f1: 60, dur: 0.2, type: 'triangle', vol: 0.18 }),
    hit:      () => tone({ f0: 240, f1: 120, dur: 0.05, type: 'square', vol: 0.07 }),
    kill:     () => { tone({ f0: 480, f1: 160, dur: 0.12, type: 'square', vol: 0.10 }); noise({ dur: 0.08, vol: 0.25 }); },
    pickup:   () => tone({ f0: 980, f1: 1500, dur: 0.06, type: 'sine', vol: 0.09 }),
    level:    () => { tone({ f0: 520, f1: 780, dur: 0.14, type: 'triangle', vol: 0.16 }); setTimeout(() => tone({ f0: 780, f1: 1180, dur: 0.2, type: 'triangle', vol: 0.14 }), 120); },
    hurt:     () => { tone({ f0: 220, f1: 70, dur: 0.18, type: 'sawtooth', vol: 0.16 }); noise({ dur: 0.12, vol: 0.3 }); },
    throwBall:() => tone({ f0: 300, f1: 760, dur: 0.14, type: 'sine', vol: 0.12 }),
    catch:    () => { tone({ f0: 900, f1: 1300, dur: 0.08, type: 'square', vol: 0.12 }); setTimeout(() => tone({ f0: 1300, f1: 1760, dur: 0.16, type: 'square', vol: 0.1 }), 90); },
    fail:     () => tone({ f0: 300, f1: 140, dur: 0.2, type: 'square', vol: 0.12 }),
    boss:     () => { tone({ f0: 90, f1: 55, dur: 0.7, type: 'sawtooth', vol: 0.22 }); noise({ dur: 0.6, vol: 0.35, freq: 400 }); },
    bossdie:  () => { tone({ f0: 300, f1: 60, dur: 0.9, type: 'sawtooth', vol: 0.2 }); noise({ dur: 0.8, vol: 0.4, freq: 700 }); },
    win:      () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone({ f0: f, dur: 0.18, type: 'triangle', vol: 0.16 }), i * 130)); },
    lose:     () => { [392, 330, 262].forEach((f, i) => setTimeout(() => tone({ f0: f, dur: 0.3, type: 'triangle', vol: 0.16 }), i * 180)); }
  };

  function play(name) {
    if (muted) return;
    const fn = bank[name];
    if (fn) { try { fn(); } catch (e) { /* 音频上下文受限时静默 */ } }
  }

  window.Sfx = {
    play,
    setMuted: v => { muted = !!v; if (!muted) ensure(); },
    isMuted: () => muted,
    unlock: () => ensure()
  };
})();