// Генеративная музыка «Toi et Moi» на Web Audio — без аудиофайлов.
// Звучание камерного «волшебного» оркестра: арфа, челеста, флейта, валторны, мягкие струнные,
// виолончель, контрабас, литавры и тихий хор в тёплом зале. Размер 6/8.
// Драматургия: тепло (I) → тоска (II) → гнев с кульминацией на «Шипах и розах» (III) →
// надежда (IV) → меланхоличная развязка со светлым последним аккордом (V).
// Гармонии и мелодии сочиняются на лету; чужие мелодии не используются.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const Q = { maj: [0, 7, 12, 16, 19], min: [0, 7, 12, 15, 19], dom: [0, 7, 10, 16, 19], maj7: [0, 7, 11, 16, 19], sus: [0, 7, 12, 14, 19] };
const ch = (root, q) => ({ root, notes: Q[q].map((i) => root + i) });

const THEMES = {
  space:   { bpm8: 112, prog: [ch(38, 'sus'), ch(43, 'sus')], base: 0.12, harp: 0.5, mel: 'celesta', strings: 0.8 },
  // D Bm G Gm — тепло с «волшебной» минорной субдоминантой
  coup:    { bpm8: 144, prog: [ch(38, 'maj'), ch(47, 'min'), ch(43, 'maj'), ch(43, 'min')], base: 0.42, harp: 1, mel: 'celesta', strings: 1, horn: 0.5 },
  // Em Cmaj7 Am B7 — тоска
  riviere: { bpm8: 132, prog: [ch(40, 'min'), ch(36, 'maj7'), ch(45, 'min'), ch(47, 'dom')], base: 0.5, harp: 0.9, mel: 'flute', strings: 1, cello: 1 },
  // Dm Bb Gm A7 — гнев и драма
  epines:  { bpm8: 160, prog: [ch(38, 'min'), ch(46, 'maj'), ch(43, 'min'), ch(45, 'dom')], base: 0.75, harp: 0.8, mel: 'horn', strings: 1.1, cello: 1, horn: 1, drums: 1, choir: 0.8 },
  // G Em Eb D — надежда с хроматическим сдвигом
  espoir:  { bpm8: 128, prog: [ch(43, 'maj'), ch(40, 'min'), ch(39, 'maj'), ch(38, 'maj')], base: 0.45, harp: 1, mel: 'celesta', strings: 1, horn: 0.8, choir: 0.6 },
  // Am F Dm A — светлая печаль
  eternel: { bpm8: 104, prog: [ch(45, 'min'), ch(41, 'maj'), ch(38, 'min'), ch(45, 'maj')], base: 0.3, harp: 0.8, mel: 'flute', strings: 0.9, choir: 0.4 },
  // финал: романтично — D A Bm F#m G D G A, солирует скрипка, пышные струнные и арфа
  // финал в три фазы: драма (Bm G D F#7) → боль на пике (Em C F#7 Bm) → затухание (Bm G Em F#sus) с замедлением
  finA:    { bpm8: 150, prog: [ch(47, 'min'), ch(43, 'maj'), ch(38, 'maj'), ch(42, 'dom')], base: 0.82, harp: 0.9, mel: 'violin', strings: 1.2, cello: 1, horn: 0.9, drums: 1, choir: 0.6 },
  finB:    { bpm8: 140, prog: [ch(40, 'min'), ch(36, 'maj'), ch(42, 'dom'), ch(47, 'min')], base: 1, harp: 1, mel: 'violin', strings: 1.25, cello: 1, horn: 1, drums: 1, choir: 0.9 },
  finC:    { bpm8: 118, prog: [ch(47, 'min'), ch(43, 'maj'), ch(40, 'min'), ch(42, 'sus')], base: 0.5, harp: 0.85, mel: 'violin', strings: 1, cello: 0.8, choir: 0.45 },
  finale:  { bpm8: 96, prog: [ch(38, 'maj'), ch(45, 'maj'), ch(47, 'min'), ch(42, 'min'), ch(43, 'maj'), ch(38, 'maj'), ch(43, 'maj'), ch(45, 'dom')], base: 0.4, harp: 0.9, mel: 'violin', strings: 1.15, cello: 1, horn: 0.45, choir: 0.35 },
};
const PEAK = { skala: 0.72, shipy: 1, mechi: 0.9, proshchanie: 0.5, 'je-veux': 0.55, 'au-bord': 0.6, espoir: 0.55, lamour: 0.32, posleslovie: 0.22, posvyashchenie: 0.18, 'fin-burn': 0.62, 'fin-end': 0.34 };

export class Ambient {
  constructor() { this.ctx = null; this.on = false; this.drift = 0; this.fade = null; this.bpm = null; this._lastPaper = 0; this.theme = 'space'; this.want = { theme: 'space', intensity: 0.12 }; this.int = 0.12; this.bar = 0; this.mel = 74; }

  start() {
    if (this.ctx) { this.setOn(true); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC(); this._build();
    this.nextBar = this.ctx.currentTime + 0.15;
    this.timer = setInterval(() => this._tick(), 60);
    this.setOn(true);
  }

  _build() {
    const ctx = this.ctx;
    this.master = ctx.createGain(); this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.knee.value = 14; comp.ratio.value = 3; comp.attack.value = 0.02; comp.release.value = 0.4;
    // тёплый тон: приглушаем верх
    const shelf = ctx.createBiquadFilter(); shelf.type = 'highshelf'; shelf.frequency.value = 4200; shelf.gain.value = -8;
    const top = ctx.createBiquadFilter(); top.type = 'lowpass'; top.frequency.value = 9000; top.Q.value = 0.5; this.top = top;
    this.vol = ctx.createGain(); this.master.connect(this.vol).connect(shelf).connect(top).connect(comp).connect(ctx.destination);
    this.bus = ctx.createGain(); this.bus.gain.value = 0.8;
    const dry = ctx.createGain(); dry.gain.value = 0.5; this.bus.connect(dry).connect(this.master);
    // зал: предзадержка + длинный импульс с «затухающими» верхами
    const pre = ctx.createDelay(0.2); pre.delayTime.value = 0.035;
    this.reverb = ctx.createConvolver(); this.reverb.buffer = this._hall(4.6);
    const wet = ctx.createGain(); wet.gain.value = 0.7;
    this.bus.connect(pre).connect(this.reverb).connect(wet).connect(this.master);
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = nb;
    // эхо для финала: «всё уносится» — повторы тонут, чуть плывут вниз по высоте
    this.echoIn = ctx.createGain(); this.echoIn.gain.value = 0;
    this.echo = ctx.createDelay(2); this.echo.delayTime.value = 0.46;
    const fb = ctx.createGain(); fb.gain.value = 0.52; const efl = ctx.createBiquadFilter(); efl.type = 'lowpass'; efl.frequency.value = 1700;
    this.bus.connect(this.echoIn).connect(this.echo).connect(efl).connect(fb).connect(this.echo);
    const eOut = ctx.createGain(); eOut.gain.value = 0.85; efl.connect(eOut).connect(this.master); efl.connect(this.reverb);
    // огонь: один общий заранее записанный слой (треск + гул), громкость — от числа горящих листов
    this.fireG = ctx.createGain(); this.fireG.gain.value = 0;
    const fs = ctx.createBufferSource(); fs.buffer = this._fireBuf(8); fs.loop = true; fs.connect(this.fireG); fs.start();
    const fwet = ctx.createGain(); fwet.gain.value = 0.25; this.fireG.connect(this.master); this.fireG.connect(fwet).connect(this.reverb);
    // бумага: несколько вариантов перелистывания и смятия
    this.turnBufs = [0, 1, 2].map(() => this._paperBuf('turn'));
    this.crumpleBufs = [0, 1, 2].map(() => this._paperBuf('crumple'));
    // тембры
    const wave = (amps) => { const re = new Float32Array(amps.length + 1), im = new Float32Array(amps.length + 1); amps.forEach((a, i) => { im[i + 1] = a; }); return ctx.createPeriodicWave(re, im); };
    this.harpWave = wave([1, 0.42, 0.22, 0.12, 0.07, 0.04, 0.02]);
    this.stringWave = wave([1, 0.5, 0.33, 0.22, 0.14, 0.09, 0.06, 0.04, 0.025]);
    this.hornWave = wave([1, 0.6, 0.35, 0.18, 0.08, 0.04]);
    this.voxWave = wave([1, 0.3, 0.12, 0.05]);
  }

  _hall(sec) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let lp = 0;
      for (let i = 0; i < len; i++) {
        const k = i / len, a = 0.55 - 0.5 * k;                // чем дальше, тем глуше
        lp += (Math.random() * 2 - 1 - lp) * a;
        d[i] = lp * Math.pow(1 - k, 2.2) * (i < ctx.sampleRate * 0.012 ? i / (ctx.sampleRate * 0.012) : 1);
      }
    }
    return b;
  }

  setOn(v) {
    this.on = v; if (!this.ctx) return;
    if (v && this.ctx.state === 'suspended') this.ctx.resume();
    const t = this.ctx.currentTime; this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(v ? 1 : 0, t, v ? 1.6 : 0.25);
  }

  setScene(themeId, poemId) { const th = THEMES[themeId] ? themeId : 'space'; this.want = { theme: th, intensity: PEAK[poemId] ?? THEMES[th].base }; }
  setMood(id) { this.setScene(id); }
  _themes() { return THEMES; }

  _tick() {
    if (!this.ctx || !this.on) return;
    while (this.nextBar < this.ctx.currentTime + 0.35) {
      if (this.want.theme !== this.theme) { this.theme = this.want.theme; this.bar = 0; }
      this.int += (this.want.intensity - this.int) * 0.5;
      if (this.fade) this._fadeStep(this.nextBar);
      const th = THEMES[this.theme], e = 60 / (this.bpm || th.bpm8);
      this._bar(this.nextBar, e, e * 6, th.prog[this.bar % th.prog.length], th, this.int);
      this.nextBar += e * 6; this.bar++;
    }
  }

  _bar(t, e, dur, c, th, I) {
    const N = c.notes;
    // струнные: мягкий сустейн; в кульминации — тремоло
    this._strings(N.slice(1, 5).map((n) => n + 12), t, dur * 1.05, 0.05 * th.strings * (0.55 + I * 0.7), 650 + I * 900, I > 0.85);
    this._bass(c.root - (c.root > 42 ? 12 : 0), t, dur, 0.14 * (0.7 + I * 0.4));
    if (th.cello && Math.random() < 0.75) this._cello(c.root + 12 + [0, 7, 12, 4][(this.bar >> 1) % 4] - (c.notes[3] - c.root === 15 && (this.bar >> 1) % 4 === 3 ? 1 : 0), t + e * 3, e * 3.2, 0.06 + I * 0.04);
    if (th.horn) this._horns([N[1] + 12, N[3] + 12], t, dur, 0.035 * th.horn * (0.5 + I));
    if (th.choir) this._choir(N.slice(1, 4).map((n) => n + 12), t, dur, 0.022 * th.choir * (0.5 + I));
    // арфа: арпеджио вверх и обратно
    const arp = [0, 1, 2, 3, 4, 3].map((k) => N[k] + 12);
    const dense = I > 0.8;
    for (let i = 0; i < 6; i++) {
      const v = (i === 0 ? 0.3 : 0.18 + (i === 3 ? 0.05 : 0)) * th.harp * (0.7 + I * 0.4);
      this._harp(arp[i], t + i * e + (Math.random() - 0.5) * 0.012, v);
      if (dense) this._harp(arp[(i + 2) % 6] + 12, t + i * e + e / 2, v * 0.5);
    }
    // мелодия: шаговое движение по аккорду
    if (Math.random() < (th.mel === 'violin' ? 0.9 : 0.4 + I * 0.35)) {
      const pool = N.map((n) => n + 24).concat(N.map((n) => n + 36)).filter((n) => n > 64 && n < 88);
      const steps = th.mel === 'flute' ? [[0, 3], [3, 3]] : th.mel === 'horn' ? [[0, 4], [4, 2]] : th.mel === 'violin' ? [[0, 2], [2, 1], [3, 3]] : [[0, 1], [2, 1], [3, 1], [5, 1]];
      for (const [pos, len] of steps) {
        if (Math.random() < 0.25) continue;
        const near = pool.sort((a, b) => Math.abs(a - this.mel) - Math.abs(b - this.mel)).slice(0, 3);
        this.mel = near[(Math.random() * near.length) | 0] || this.mel;
        if (th.mel === 'flute') this._flute(this.mel, t + pos * e, len * e, 0.05 + I * 0.02);
        else if (th.mel === 'violin') { this._violin(this.mel, t + pos * e, len * e * 1.1, 0.045 + I * 0.03); if (pos === 0 && Math.random() < 0.5) this._celesta(this.mel + 12, t, 0.05); }
        else if (th.mel === 'horn') this._horns([this.mel - 12], t + pos * e, len * e, 0.05 + I * 0.03, true);
        else this._celesta(this.mel + 12, t + pos * e, 0.09 + I * 0.04);
      }
    }
    if (th.drums && I > 0.55) {
      this._timp(t, 0.42 * I); this._timp(t + e * 3, 0.26 * I);
      if (I > 0.85) { this._timp(t + e * 5, 0.2 * I); this._timp(t + e * 5.5, 0.16 * I); }
    }
  }

  f(m) { return mtof(m + this.drift); }

  _env(g, t, a, peak, hold, rel) {
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
    return t + a + hold + rel + 0.05;
  }

  _harp(m, t, v) {
    const ctx = this.ctx, f = this.f(m), g = ctx.createGain(), lp = ctx.createBiquadFilter(), len = 2.8 - (m - 50) * 0.02;
    lp.type = 'lowpass'; lp.Q.value = 0.3;
    lp.frequency.setValueAtTime(Math.min(5000, f * 7), t); lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.6), t + len * 0.6);
    [-3, 3].forEach((det) => { const o = ctx.createOscillator(); o.setPeriodicWave(this.harpWave); o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + len + 0.1); });
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(v * 0.3, t + 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    lp.connect(g).connect(this.bus);
  }

  _celesta(m, t, v) {
    const ctx = this.ctx, f = this.f(m), g = ctx.createGain();
    [[1, 1, 2.2], [4.0, 0.18, 0.5], [9.8, 0.05, 0.25]].forEach(([h, a, dec]) => {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.value = f * h;
      og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(a, t + 0.003); og.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(og).connect(g); o.start(t); o.stop(t + dec + 0.05);
    });
    g.gain.value = v; g.connect(this.bus);
  }

  _flute(m, t, dur, v) {
    const ctx = this.ctx, f = this.f(m), g = ctx.createGain();
    const end = this._env(g, t, 0.12, v, Math.max(0.05, dur - 0.2), 0.35);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const o2 = ctx.createOscillator(), g2 = ctx.createGain(); o2.type = 'sine'; o2.frequency.value = f * 2; g2.gain.value = 0.12;
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(7, t + 0.4);
    vib.connect(vg); vg.connect(o.detune); vg.connect(o2.detune);
    const n = ctx.createBufferSource(), nf = ctx.createBiquadFilter(), ng = ctx.createGain(); n.buffer = this.noise; n.loop = true;
    nf.type = 'bandpass'; nf.frequency.value = f * 2; nf.Q.value = 2; ng.gain.value = 0.06;
    o.connect(g); o2.connect(g2).connect(g); n.connect(nf).connect(ng).connect(g);
    [o, o2, vib, n].forEach((x) => { x.start(t); x.stop(end); });
    g.connect(this.bus);
  }

  // солирующая скрипка: мягкая атака, вибрато вступает с задержкой, лёгкое портаменто
  _violin(m, t, dur, v) {
    const ctx = this.ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter(), bp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.3; bp.type = 'peaking'; bp.frequency.value = 900; bp.gain.value = 4; bp.Q.value = 1;
    const end = this._env(g, t, 0.22, v, Math.max(0.1, dur - 0.3), 0.6);
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5.6; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(14, t + 0.45); vib.connect(vg);
    [-5, 5].forEach((det) => {
      const o = ctx.createOscillator(); o.setPeriodicWave(this.stringWave);
      o.frequency.setValueAtTime(this.f(m - 0.3), t); o.frequency.linearRampToValueAtTime(this.f(m), t + 0.08); o.detune.value = det;
      vg.connect(o.detune); o.connect(lp); o.start(t); o.stop(end);
    });
    vib.start(t); vib.stop(end);
    lp.connect(bp).connect(g).connect(this.bus);
  }

  _strings(notes, t, dur, lvl, cutoff, trem) {
    const ctx = this.ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter(), lp2 = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = cutoff; lp.Q.value = 0.2; lp2.type = 'lowpass'; lp2.frequency.value = cutoff * 1.6; lp2.Q.value = 0.2;
    const end = this._env(g, t, Math.min(1.3, dur * 0.4), lvl, dur * 0.45, 1.8);
    notes.forEach((m) => [-8, 0, 8].forEach((det) => {
      const o = ctx.createOscillator(); o.setPeriodicWave(this.stringWave); o.frequency.value = this.f(m); o.detune.value = det + (Math.random() - 0.5) * 4;
      const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 4.6 + Math.random() * 0.8; vg.gain.value = 5; vib.connect(vg).connect(o.detune);
      o.connect(lp); o.start(t); o.stop(end); vib.start(t); vib.stop(end);
    }));
    if (trem) {
      const tg = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 6.5; lg.gain.value = 0.35; tg.gain.value = 0.65; lfo.connect(lg).connect(tg.gain); lfo.start(t); lfo.stop(end);
      lp.connect(lp2).connect(tg).connect(g);
    } else lp.connect(lp2).connect(g);
    g.connect(this.bus);
  }

  _horns(notes, t, dur, lvl, solo) {
    const ctx = this.ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 0.4;
    lp.frequency.setValueAtTime(350, t); lp.frequency.linearRampToValueAtTime(solo ? 1100 : 850, t + 0.45); lp.frequency.linearRampToValueAtTime(600, t + dur);
    const end = this._env(g, t, solo ? 0.18 : 0.6, lvl, dur * 0.6, 0.8);
    notes.forEach((m) => [-4, 4].forEach((det) => {
      const o = ctx.createOscillator(); o.setPeriodicWave(this.hornWave); o.frequency.value = this.f(m); o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(end);
    }));
    lp.connect(g).connect(this.bus);
  }

  _choir(notes, t, dur, lvl) {
    const ctx = this.ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1200; lp.Q.value = 0.3;
    const end = this._env(g, t, 1.1, lvl, dur * 0.5, 2);
    notes.forEach((m) => [-10, 0, 10].forEach((det) => {
      const o = ctx.createOscillator(); o.setPeriodicWave(this.voxWave); o.frequency.value = this.f(m); o.detune.value = det;
      const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5.2 + Math.random(); vg.gain.value = 9; vib.connect(vg).connect(o.detune);
      o.connect(lp); o.start(t); o.stop(end); vib.start(t); vib.stop(end);
    }));
    lp.connect(g).connect(this.bus);
  }

  _bass(m, t, dur, lvl) {
    const ctx = this.ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 0.3;
    const end = this._env(g, t, 0.12, lvl, dur * 0.6, dur * 0.5);
    const o = ctx.createOscillator(); o.setPeriodicWave(this.stringWave); o.frequency.value = this.f(m);
    o.connect(lp).connect(g).connect(this.bus); o.start(t); o.stop(end);
  }

  _cello(m, t, dur, lvl) {
    const ctx = this.ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.3;
    const end = this._env(g, t, 0.4, lvl, dur * 0.6, 1);
    const o = ctx.createOscillator(); o.setPeriodicWave(this.stringWave); o.frequency.value = this.f(m);
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(10, t + 0.5); vib.connect(vg).connect(o.detune);
    o.connect(lp).connect(g).connect(this.bus); o.start(t); o.stop(end); vib.start(t); vib.stop(end);
  }

  _timp(t, lvl) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = 'sine'; o.frequency.setValueAtTime(74, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.6);
    lp.type = 'lowpass'; lp.frequency.value = 400;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(lvl, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    o.connect(lp).connect(g).connect(this.bus); o.start(t); o.stop(t + 1.9);
    const n = ctx.createBufferSource(), nf = ctx.createBiquadFilter(), ng = ctx.createGain();
    n.buffer = this.noise; nf.type = 'lowpass'; nf.frequency.value = 180;
    ng.gain.setValueAtTime(lvl * 0.4, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    n.connect(nf).connect(ng).connect(this.bus); n.start(t); n.stop(t + 0.3);
  }

  chime() {
    if (!this.ctx || !this.on) return;
    const th = THEMES[this.theme], c = th.prog[Math.max(0, this.bar - 1) % th.prog.length];
    this._celesta(c.notes[(Math.random() * 5) | 0] + 36, this.ctx.currentTime + 0.01, 0.07);
  }

  // ── финал: фазы музыки ──
  // 'A' — драма, 'B' — боль на пике, 'C' — затухание: замедление, глохнущий верх, эхо, уход высоты вниз; null — сброс
  finale(phase) {
    if (!this.ctx) { this.want = { theme: phase ? 'fin' + phase : 'space', intensity: phase ? THEMES['fin' + phase].base : 0.12 }; return; }
    const t = this.ctx.currentTime;
    if (phase === 'C') { this.fade = { t0: t, dur: 22 }; this.want = { theme: 'finC', intensity: 0.6 }; this.whoosh(7); return; }
    if (phase) { this.want = { theme: 'fin' + phase, intensity: THEMES['fin' + phase].base }; return; }
    this.fade = null; this.bpm = null; this.drift = 0;
    this.top.frequency.cancelScheduledValues(t); this.top.frequency.setTargetAtTime(9000, t, 0.4);
    this.echoIn.gain.cancelScheduledValues(t); this.echoIn.gain.setTargetAtTime(0, t, 0.3);
    this.echo.delayTime.cancelScheduledValues(t); this.echo.delayTime.setTargetAtTime(0.46, t, 0.3);
    this.vol.gain.cancelScheduledValues(t); this.vol.gain.setTargetAtTime(1, t, 0.8);
    this.setFire(0);
  }
  _fadeStep(at) {
    const k = Math.min(1, Math.max(0, (at - this.fade.t0) / this.fade.dur)), e = k * k * (3 - 2 * k);
    this.bpm = 118 - 56 * e;                               // ритардандо 118 → 62
    this.drift = -0.3 * e;                                 // высота уплывает вниз на ~30 центов
    this.want.intensity = 0.6 - 0.45 * e;                  // чувства гаснут
    const t = this.ctx.currentTime;
    this.top.frequency.setTargetAtTime(9000 - 7600 * e, t, 1.2);   // всё глуше, будто издалека
    this.echoIn.gain.setTargetAtTime(0.12 + 0.45 * e, t, 1.2);
    this.echo.delayTime.setTargetAtTime(0.46 + 0.2 * e, t, 2.5);    // повторы растягиваются и плывут вниз
    this.vol.gain.setTargetAtTime(1 - 0.6 * e, t, 1.5);              // и всё тише
  }
  setFire(level) {
    if (!this.ctx) return;
    this.fireG.gain.setTargetAtTime(this.on ? Math.min(1, level) * 0.16 : 0, this.ctx.currentTime, 0.5);
  }
  _play(buf, v, rate = 1) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime;
    if (t - this._lastPaper < 0.14) return;               // не больше ~7 бумажных звуков в секунду
    this._lastPaper = t;
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain(), p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    s.buffer = buf; s.playbackRate.value = rate; g.gain.value = v;
    if (p) { p.pan.value = (Math.random() - 0.5) * 1.2; s.connect(g).connect(p).connect(this.bus); } else s.connect(g).connect(this.bus);
    s.start(t + 0.01);
  }
  pageTurn() { if (this.turnBufs) this._play(this.turnBufs[(Math.random() * 3) | 0], 0.11, 0.9 + Math.random() * 0.2); }
  crumple(v = 1) { if (this.crumpleBufs) this._play(this.crumpleBufs[(Math.random() * 3) | 0], 0.09 * v, 0.85 + Math.random() * 0.3); }

  // заранее синтезированные звуки: дешёвые при проигрывании, без сотен узлов
  _fireBuf(sec) {
    const ctx = this.ctx, sr = ctx.sampleRate, n = Math.floor(sr * sec), b = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let lo = 0, lo2 = 0, hi = 0;
      const aLo = 1 - Math.exp(-2 * Math.PI * 260 / sr), aLo2 = 1 - Math.exp(-2 * Math.PI * 60 / sr), aHi = 1 - Math.exp(-2 * Math.PI * 1800 / sr);
      for (let i = 0; i < n; i++) {
        const x = Math.random() * 2 - 1; lo += (x - lo) * aLo; lo2 += (x - lo2) * aLo2; hi += (x - hi) * aHi;
        const tt = i / sr, sw = 0.6 + 0.25 * Math.sin(tt * 2 * Math.PI / sec * 3 + c) + 0.15 * Math.sin(tt * 2 * Math.PI / sec * 7);
        d[i] = (lo - lo2) * 2.2 * sw + (x - hi) * 0.05;   // гул пламени + шипение
      }
      // треск: короткие щелчки, иногда «хлопки»
      let t = 0; while (t < sec - 0.02) {
        t += -Math.log(1 - Math.random()) / 16;
        const i0 = Math.floor(t * sr), pop = Math.random() < 0.12, len = Math.floor(sr * (pop ? 0.012 : 0.002 + Math.random() * 0.005));
        const amp = (pop ? 0.9 : 0.25 + Math.random() * 0.5) * Math.pow(Math.random(), 1.5); let h = 0;
        for (let k = 0; k < len && i0 + k < n; k++) { const x = Math.random() * 2 - 1; h += (x - h) * (pop ? 0.35 : 0.7); d[i0 + k] += (pop ? h : x - h) * amp * Math.exp(-k / (len * 0.3)); }
      }
      // шов петли
      const fz = Math.floor(sr * 0.05); for (let k = 0; k < fz; k++) { const w = k / fz; d[k] *= w; d[n - 1 - k] *= w; }
    }
    return this._norm(b, 0.8);
  }
  _paperBuf(kind) {
    const ctx = this.ctx, sr = ctx.sampleRate, turn = kind === 'turn';
    const dur = turn ? 0.42 + Math.random() * 0.18 : 0.7 + Math.random() * 0.35, n = Math.floor(sr * dur), b = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let l1 = 0, l2 = 0, grain = 1;
      if (turn) {
        // шелест листа: полоса шума уходит сверху вниз, «зерно» бумаги, лёгкий щелчок в конце
        for (let i = 0; i < n; i++) {
          const k = i / n, f1 = 5200 - 3200 * k, f2 = 1300 - 800 * k;
          const a1 = 1 - Math.exp(-2 * Math.PI * f1 / sr), a2 = 1 - Math.exp(-2 * Math.PI * f2 / sr), x = Math.random() * 2 - 1;
          l1 += (x - l1) * a1; l2 += (x - l2) * a2;
          if (i % 140 === 0) grain = 0.55 + Math.random() * 0.45;
          const env = Math.pow(Math.sin(Math.PI * Math.min(1, k * 1.15)), 1.6) * (c ? 0.55 + 0.45 * k : 1 - 0.45 * k);
          d[i] = (l1 - l2) * env * grain;
        }
        const i0 = Math.floor(n * 0.82), L = Math.floor(sr * 0.006); let h = 0;
        for (let k = 0; k < L && i0 + k < n; k++) { const x = Math.random() * 2 - 1; h += (x - h) * 0.5; d[i0 + k] += (x - h) * 0.6 * Math.exp(-k / (L * 0.3)); }
      } else {
        // смятие: густые сухие хрусты пачками
        let t = 0; while (t < dur - 0.01) {
          const burst = Math.random() < 0.08; t += burst ? 0.03 + Math.random() * 0.06 : -Math.log(1 - Math.random()) / 220;
          const i0 = Math.floor(t * sr), L = Math.floor(sr * (0.0006 + Math.random() * 0.004)), k0 = t / dur;
          const amp = Math.pow(Math.random(), 2) * Math.sin(Math.PI * Math.min(1, k0 * 1.1)) * (0.4 + 0.6 * Math.random()); let h = 0;
          for (let k = 0; k < L && i0 + k < n; k++) { const x = Math.random() * 2 - 1; h += (x - h) * 0.3; d[i0 + k] += (x - h) * amp * Math.exp(-k / (L * 0.35)); }
        }
        for (let i = 0; i < n; i++) { const x = Math.random() * 2 - 1; l1 += (x - l1) * 0.12; l2 += (x - l2) * 0.02; d[i] += (l1 - l2) * 0.12 * Math.sin(Math.PI * i / n); }
      }
    }
    return this._norm(b, 0.9);
  }
  _norm(b, peak) {
    let m = 0; for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); }
    const k = m ? peak / m : 1; for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= k; }
    return b;
  }

  whoosh(sec = 2) {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx, t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = this.noise; s.loop = true; f.type = 'lowpass'; f.Q.value = 0.5;
    f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(900, t + sec * 0.5); f.frequency.exponentialRampToValueAtTime(220, t + sec);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035, t + sec * 0.45); g.gain.linearRampToValueAtTime(0.0001, t + sec);
    s.connect(f).connect(g).connect(this.bus); s.start(t); s.stop(t + sec + 0.1);
  }
}
