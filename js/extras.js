// Живые взаимодействия с вселенной «Toi et Moi»:
// созвездие мотивов · прогулка и голос автора · свечи, которые слышат дыхание ·
// слова, улетающие в небо · ожившие фотографии · розы на любимых стихах · открытки из строки.
import {
  Vector3, Vector2, Color, Sprite, SpriteMaterial, AdditiveBlending, NormalBlending, BufferGeometry,
  Float32BufferAttribute, Points, ShaderMaterial, QuadraticBezierCurve3, MathUtils, Plane, Ray,
} from 'three';
import { MOTIFS, motifsOf } from './motifs.js';
import parchURL from '../img/parchment.webp';

export const fx = { blow: 0, onHud: null };
let A;                                   // API движка (передаётся из main.js)
const $ = (s) => document.querySelector(s);
const rnd = (a, b) => a + Math.random() * (b - a);
const UP = new Vector3(0, 1, 0);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* приватный режим */ } },
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function initExtras(api) {
  A = api;
  initMotifs(); initWalk(); initVoice(); initCandles(); initWords(); initPhotos(); initRoses(); initPostcards();
  fx.onHud = onHud;
  if (new URLSearchParams(location.search).has('shot')) window.__ex = { fx, walk, voice, roses, flyers, tray, setMotif, blowAll: () => A.candles.filter((c) => c.g.visible).sort((a, b) => A.camera.position.distanceTo(a.g.position) - A.camera.position.distanceTo(b.g.position)).slice(0, 8).forEach((c, i) => blowOut(c, i * 0.12)) };
}
export function updateExtras(dt, T) {
  updateConstellation(dt, T); updateWalk(dt); updateVoice(); updateCandles(dt, T); updateFlyers(dt, T); updateRoses(dt, T); updateLineBtn();
}
function onHud() {
  const s = A.get.current >= 0 ? A.STOPS[A.get.current] : null, reading = A.get.mode === 'poem' && s;
  const rb = $('#btn-rose'); rb.hidden = !(reading && s.type === 'poem');
  if (!rb.hidden) { const on = roses.has(A.idOf(s)); rb.classList.toggle('on', on); rb.setAttribute('aria-pressed', on); }
  $('#btn-voice').hidden = !(reading && voiceFor(s).length);
  if (!$('#btn-voice').hidden) $('#btn-voice').classList.toggle('on', !!voice.el);
  document.querySelectorAll('.toc-item').forEach((el) => el.classList.toggle('fav', roses.has(A.idOf(A.STOPS[+el.dataset.stop]))));
  if (studio.on) studioPoem();
  if (A.get.mode !== 'poem') hideLineBtn();
}

// ═════════════ Созвездие мотивов ═════════════
const motifOf = new Map();
let active = null, conK = 0, con = null, conT = 0;
function initMotifs() {
  for (const s of A.STOPS) if (s.type === 'poem') motifOf.set(s.si, motifsOf(s.poem));
  // в листах подсвечиваем слова мотивов (видно, когда мотив выбран)
  const css = document.createElement('style');
  css.textContent = MOTIFS.map((m) => `body[data-motif="${m.id}"] .mw-${m.id}{background:linear-gradient(transparent 58%, ${m.color}66 58%, ${m.color}66 92%, transparent 92%);}`).join('\n');
  document.head.appendChild(css);
  for (const s of A.STOPS) for (const el of s.els || []) el.querySelectorAll('.verse p, h3').forEach((p) => markWords(p));
  chips();
  $('#mp-walk').onclick = () => startWalk(0);
}
function markWords(p) {
  const text = p.textContent; if (!text) return;
  const hits = [];
  for (const m of MOTIFS) {
    const g = new RegExp(m.re.source, 'giu'); let x;
    while ((x = g.exec(text))) { let e = x.index + x[0].length; while (e < text.length && /[\p{L}\p{M}’'-]/u.test(text[e])) e++; hits.push([x.index, e, m.id]); }
  }
  if (!hits.length) return;
  hits.sort((a, b) => a[0] - b[0]);
  let html = '', i = 0;
  for (const [a, b, id] of hits) { if (a < i) continue; html += esc(text.slice(i, a)) + `<span class="mw mw-${id}">${esc(text.slice(a, b))}</span>`; i = b; }
  p.innerHTML = html + esc(text.slice(i));
}
function membersOf(id) {
  if (id === 'mine') return A.STOPS.filter((s) => roses.has(A.idOf(s))).map((s) => s.si);
  return A.STOPS.filter((s) => motifOf.get(s.si)?.[id]).map((s) => s.si);
}
function chips() {
  const box = $('#mp-chips'); box.innerHTML = '';
  const list = [...MOTIFS.map((m) => ({ id: m.id, name: m.ru, color: m.color })), ...(roses.size ? [{ id: 'mine', name: 'Мои розы', color: '#ff4d7a' }] : [])];
  for (const m of list) {
    const b = document.createElement('button'); b.style.setProperty('--m', m.color); b.dataset.id = m.id;
    b.innerHTML = `<i></i>${esc(m.name)} <small>${membersOf(m.id).length}</small>`;
    b.classList.toggle('on', active === m.id);
    b.onclick = () => setMotif(active === m.id ? null : m.id);
    box.appendChild(b);
  }
  const on = box.querySelector('.on'); if (on) box.scrollLeft = on.offsetLeft - box.clientWidth / 2 + on.offsetWidth / 2;
}
function setMotif(id) {
  active = id; chips();
  if (id) document.body.dataset.motif = id; else delete document.body.dataset.motif;
  const m = MOTIFS.find((x) => x.id === id) || (id === 'mine' ? { ru: 'Мои розы', color: '#ff4d7a' } : null);
  const mem = id ? membersOf(id) : [];
  const n = mem.length, word = n % 10 === 1 && n % 100 !== 11 ? 'стих' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'стиха' : 'стихов';
  $('#mp-mtxt').innerHTML = id ? `<b>${esc(m.ru)}</b> — ${n} ${word}. Нити ведут от первого к последнему; нажмите на огонёк, чтобы прочитать.` : 'Выберите образ — нити свяжут стихи, где он звучит.';
  buildConstellation(id, mem, m?.color);
  A.audio.chime?.();
}
function buildConstellation(id, mem, color) {
  if (con) { A.scene.remove(con.pts); con.pts.geometry.dispose(); con.mat.dispose(); con.stars.forEach((s) => { A.scene.remove(s); s.material.dispose(); }); con = null; }
  if (!id || !mem.length) return;
  const pos = [], aU = [], aJ = [], segs = Math.max(1, mem.length - 1);
  for (let i = 0; i < mem.length - 1; i++) {
    const a = A.STOPS[mem[i]].base, b = A.STOPS[mem[i + 1]].base, mid = a.clone().add(b).multiplyScalar(0.5), L = a.distanceTo(b);
    const out = mid.clone().setY(0); if (out.lengthSq() < 1) out.set(1, 0, 0); out.normalize();
    const curve = new QuadraticBezierCurve3(a, mid.clone().addScaledVector(out, 380 + L * 0.22).addScaledVector(UP, 140), b);
    const n = Math.round(MathUtils.clamp(L / 9, 50, 320));
    for (let j = 0; j <= n; j++) { const u = j / n, p = curve.getPoint(u); pos.push(p.x + rnd(-10, 10), p.y + rnd(-10, 10), p.z + rnd(-10, 10)); aU.push((i + u) / segs); aJ.push(Math.random()); }
  }
  if (!pos.length) { const p = A.STOPS[mem[0]].base; pos.push(p.x, p.y, p.z); aU.push(0); aJ.push(0); }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('aU', new Float32BufferAttribute(aU, 1)); g.setAttribute('aJ', new Float32BufferAttribute(aJ, 1));
  const mat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uK: { value: 0 }, uReveal: { value: 0 }, uSegs: { value: segs }, uColor: { value: new Color(color) }, uScale: { value: 800 }, uPR: { value: A.get.dpr } },
    vertexShader: `attribute float aU; attribute float aJ; uniform float uTime, uK, uReveal, uSegs, uScale, uPR; varying float vA; varying float vH;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = -mv.z;
        float pulse = pow(0.5 + 0.5 * sin(aU * uSegs * 6.2832 * 1.5 - uTime * 2.6), 8.0);
        gl_PointSize = clamp((9.0 + 12.0 * pulse) * uScale / max(d, 1.0), 2.0, 18.0) * uPR; gl_Position = projectionMatrix * mv;
        vA = uK * step(aU, uReveal) * (0.35 + 0.65 * pulse) * (0.7 + 0.3 * sin(uTime * 3.0 + aJ * 30.0)); vH = pulse; }`,
    fragmentShader: `uniform vec3 uColor; varying float vA; varying float vH; void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0; if (r > 1.0) discard;
      gl_FragColor = vec4(mix(uColor, vec3(1.0, 0.97, 0.9), vH * 0.6) * exp(-r * r * 3.5) * vA, 1.0); }`,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  });
  const pts = new Points(g, mat); pts.frustumCulled = false; A.scene.add(pts);
  const stars = mem.map((si) => {
    const s = new Sprite(new SpriteMaterial({ map: A.GLOW, color: new Color(color).lerp(new Color('#ffffff'), 0.08), blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    s.position.copy(A.STOPS[si].base); s.userData.si = si; A.scene.add(s); return s;
  });
  con = { pts, mat, stars, mem: new Set(mem) }; conT = 0;
}
function updateConstellation(dt, T) {
  const on = A.get.mode === 'overview' && !A.get.finaleOn && !!con;
  conK += ((on ? 1 : 0) - conK) * Math.min(1, dt * 2);
  for (const s of A.STOPS) {
    const want = con && conK > 0.02 ? (con.mem.has(s.si) ? 1.5 : 0.3) : 1;
    s.markK = (s.markK ?? 1) + (MathUtils.lerp(1, want, conK) - (s.markK ?? 1)) * Math.min(1, dt * 3);
  }
  if (!con) return;
  conT += dt;
  const u = con.mat.uniforms; u.uTime.value = T; u.uK.value = conK; u.uReveal.value = Math.min(1.001, conT / 2.8); u.uPR.value = A.get.dpr;
  u.uScale.value = (innerHeight / 2) / Math.tan(MathUtils.degToRad(A.camera.fov) / 2);
  con.stars.forEach((s, i) => {
    const md = A.camera.position.distanceTo(s.position), lit = MathUtils.smoothstep(conT, (i / Math.max(1, con.stars.length - 1)) * 2.8, (i / Math.max(1, con.stars.length - 1)) * 2.8 + 0.4);
    s.scale.setScalar(640 * Math.max(1, md / 6000) * (1 + 0.12 * Math.sin(T * 2 + i)));
    s.material.opacity = 0.6 * conK * lit;
  });
}

// ═════════════ Прогулка ═════════════
const walk = { on: false, steps: [], i: 0, phase: 'fly', t: 0, dwell: 1, waitVoice: false };
const words = (lines) => (lines || []).join(' ').match(/[\p{L}’'-]+/gu)?.length || 0;
function initWalk() {
  $('#btn-walk').onclick = () => (walk.on ? stopWalk() : startWalk(A.get.mode === 'poem' && A.get.current >= 0 ? A.get.current : 0));
  $('#wb-stop').onclick = () => stopWalk();
  // любое действие читателя останавливает прогулку
  const stop = (e) => { if (walk.on && !e.target.closest?.('#walk-bar, #btn-walk, #btn-sound, #btn-fs, #btn-candle')) stopWalk(); };
  A.css.domElement.addEventListener('wheel', stop, { capture: true, passive: true });
  A.css.domElement.addEventListener('pointerdown', stop, true);
  $('#nav').addEventListener('pointerdown', stop, true);
  $('#toc').addEventListener('pointerdown', stop, true);
  addEventListener('keydown', (e) => { if (walk.on && !['Shift', 'Control', 'Alt', 'Meta', 'f', 'F'].includes(e.key)) stopWalk(); }, true);
}
function stepsFrom(si) {
  const out = [];
  for (let i = si; i < A.NS; i++) {
    const s = A.STOPS[i];
    if (A.get.narrow && s.objs.length > 1) s.objs.forEach((o, k) => out.push({ si: i, k }));
    else out.push({ si: i, k: 0 });
  }
  return out;
}
function dwellOf(st) {
  const s = A.STOPS[st.si];
  if (s.type !== 'poem') return s.type === 'ded' ? 7 : 26;
  const p = s.poem, fr = words(p.fr?.lines), ru = words(p.ru?.lines);
  if (A.get.narrow && s.objs.length > 1) return MathUtils.clamp(4 + (st.k === 0 ? fr || ru : ru) * 0.42, 7, 60);
  return MathUtils.clamp(4.5 + (fr + ru) * 0.3, 9, 75);
}
function startWalk(si) {
  if (A.get.finaleOn) return;
  walk.on = true; walk.steps = stepsFrom(Math.max(0, si)); walk.i = 0;
  document.body.classList.add('walking'); $('#walk-bar').hidden = false;
  A.toast(voice.map && Object.keys(voice.map).length ? 'Прогулка с голосом автора. Любое действие — остановка' : 'Прогулка началась. Любое действие — остановка');
  go();
}
function go() {
  if (!walk.on) return;
  const st = walk.steps[walk.i];
  if (!st) { stopWalk(); A.next(); return; }        // за посвящением — финал
  walk.phase = 'fly'; walk.t = 0;
  A.focusStop(st.si, st.k, { dur: walk.i === 0 ? 3.2 : 4 });
  $('#wb-t').textContent = A.titleOf(A.STOPS[st.si]);
}
function stopWalk() {
  if (!walk.on) return;
  walk.on = false; document.body.classList.remove('walking'); $('#walk-bar').hidden = true; stopVoice();
}
function updateWalk(dt) {
  if (!walk.on) return;
  const st = walk.steps[walk.i], rest = A.get.rest;
  if (walk.phase === 'fly') {
    if (rest && !A.get.flight && A.get.current === st.si) {
      walk.phase = 'read'; walk.t = 0; walk.dwell = dwellOf(st);
      const v = voiceFor(A.STOPS[st.si], st.k);
      walk.waitVoice = false;
      if (v.length && A.audio.on) { walk.waitVoice = true; playVoice(v, () => { walk.waitVoice = false; walk.dwell = Math.max(walk.dwell, walk.t + 1.6); }); }
    }
    return;
  }
  walk.t += dt;
  const p = Math.min(1, walk.t / walk.dwell);
  $('#wb-p').style.width = (((walk.i + p) / walk.steps.length) * 100).toFixed(1) + '%';
  if (rest && rest.range > 0) A.setScroll(rest.range - 2 * rest.range * MathUtils.smoothstep(p, 0.12, 0.9));
  if (walk.t >= walk.dwell && !walk.waitVoice) { walk.i++; go(); }
}

// ═════════════ Голос автора ═════════════
// voice/voices.json: { "fleur": { "fr": "fleur-fr.mp3", "ru": "fleur-ru.mp3" }, ... }
// Каждой главе — свой тембр и свой зал: тёплая близость, мечтательное эхо, глубокая драма, светлый воздух, собор вечности.
const PRESET = [
  { low: 3, mid: -1, pres: 2, air: 3, wet: 0.2, delay: 0 },
  { low: 2, mid: -1, pres: 1.5, air: 2.5, wet: 0.3, delay: 0.36 },
  { low: 5, mid: -2.5, pres: 3, air: 1, wet: 0.26, delay: 0, drive: 0.25 },
  { low: 2, mid: -1, pres: 2, air: 4, wet: 0.34, delay: 0.3 },
  { low: 3, mid: -1.5, pres: 1.5, air: 3, wet: 0.5, delay: 0.48 },
];
const voice = { map: null, el: null, nodes: [], dur: 0, total: 0, queue: [], done: null };
function initVoice() {
  if (location.protocol === 'file:') voice.map = {};
  else fetch('voice/voices.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((m) => { voice.map = m || {}; A.updateHud(); }).catch(() => { voice.map = {}; });
  $('#btn-voice').onclick = () => {
    if (voice.el) { stopVoice(); A.updateHud(); return; }
    if (!A.audio.ctx) A.audio.start();
    if (!A.audio.on) { A.audio.setOn(true); A.soundUi(); }
    const s = A.STOPS[A.get.current]; playVoice(voiceFor(s, A.get.narrow ? A.get.langK : null), () => A.updateHud()); A.updateHud();
  };
  if (new URLSearchParams(location.search).has('record')) initStudio();
}
function voiceFor(s, k = null) {
  if (!voice.map || !s || s.type !== 'poem') return [];
  const v = voice.map[s.poem.id]; if (!v) return [];
  const langs = k === null ? ['fr', 'ru'] : [s.objs[k]?.element?.lang || (k === 0 ? (s.poem.fr ? 'fr' : 'ru') : 'ru')];
  return langs.filter((l) => v[l]).map((l) => ({ url: 'voice/' + v[l], gi: s.gi }));
}
function voiceChain(ctx, gi, input) {
  // голос: срез гула → тепло → чище середина → присутствие → воздух → мягкая компрессия → свой зал
  const P = PRESET[gi] || PRESET[0], out = ctx.createGain(); out.gain.value = 1.15;
  const f = (type, freq, gain, q = 0.8) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = freq; b.gain.value = gain; b.Q.value = q; return b; };
  const hp = f('highpass', 75, 0, 0.7), low = f('lowshelf', 170, P.low), mid = f('peaking', 420, P.mid, 1), pres = f('peaking', 3000, P.pres, 0.9), air = f('highshelf', 9500, P.air);
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -24; comp.ratio.value = 3; comp.attack.value = 0.008; comp.release.value = 0.25; comp.knee.value = 10;
  let node = input.connect(hp).connect(low).connect(mid);
  if (P.drive) { const ws = ctx.createWaveShaper(), c = new Float32Array(1024), k = P.drive * 6; for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; c[i] = Math.tanh(x * (1 + k)) / Math.tanh(1 + k); } ws.curve = c; node = node.connect(ws); }
  node = node.connect(pres).connect(air).connect(comp);
  comp.connect(out);
  const rev = ctx.createConvolver(); rev.buffer = A.audio.reverb.buffer; const wet = ctx.createGain(); wet.gain.value = P.wet;
  comp.connect(rev).connect(wet).connect(out);
  const nodes = [hp, low, mid, pres, air, comp, rev, wet, out];
  if (P.delay) { const d = ctx.createDelay(1.5), fb = ctx.createGain(), lp = f('lowpass', 2600, 0), dg = ctx.createGain(); d.delayTime.value = P.delay; fb.gain.value = 0.28; dg.gain.value = 0.13; comp.connect(d).connect(lp).connect(fb).connect(d); lp.connect(dg).connect(out); nodes.push(d, fb, lp, dg); }
  return { out, nodes };
}
function playVoice(list, done) {
  stopVoice();
  const ctx = A.audio.ctx; if (!ctx || !list.length) { done && done(); return; }
  voice.queue = list.slice(); voice.done = done; voice.total = 0; voice.dur = 0;
  A.audio.duck(true); nextVoice();
}
function nextVoice() {
  const ctx = A.audio.ctx, item = voice.queue.shift();
  if (!item) { const d = voice.done; stopVoice(); d && d(); return; }
  const el = new Audio(item.url); el.preload = 'auto';
  const src = ctx.createMediaElementSource(el), ch = voiceChain(ctx, item.gi, src), g = ctx.createGain();
  g.gain.value = A.audio.on ? 1 : 0; ch.out.connect(g).connect(ctx.destination);
  voice.el = el; voice.nodes = [src, g, ...ch.nodes];
  el.onloadedmetadata = () => { voice.dur = el.duration || 0; voice.total += voice.dur; };
  el.onended = () => { disposeNodes(); voice.el = null; setTimeout(nextVoice, 700); };
  el.onerror = () => { disposeNodes(); voice.el = null; nextVoice(); };
  el.play().catch(() => { disposeNodes(); voice.el = null; nextVoice(); });
}
function disposeNodes() { voice.nodes.forEach((n) => { try { n.disconnect(); } catch (e) { /* уже */ } }); voice.nodes = []; }
function stopVoice() {
  if (voice.el) { voice.el.onended = voice.el.onerror = null; voice.el.pause(); }
  disposeNodes(); voice.el = null; voice.queue = []; voice.done = null;
  if (A?.audio.ctx) A.audio.duck(false);
}
function updateVoice() { if (voice.el && A.get.mode !== 'poem' && !walk.on) { stopVoice(); A.updateHud(); } }

// ── Студия записи: ?record ──
const studio = { on: false, lang: 'fr', rec: null, chunks: [], blob: null, stream: null, an: null, t0: 0, buf: null, src: null };
function initStudio() {
  studio.on = true; $('#studio').hidden = false;
  $('#st-close').onclick = () => { $('#studio').hidden = true; studio.on = false; };
  $('#st-rec').onclick = () => (studio.rec ? stopRec() : startRec());
  $('#st-play').onclick = () => playTake(true);
  $('#st-raw').onclick = () => playTake(false);
  $('#st-save').onclick = saveTake;
  studioDone(); studioPoem();
}
function studioPoem() {
  const s = A.STOPS[Math.max(0, A.get.current)];
  if (!s || s.type !== 'poem') { $('#st-poem').textContent = 'Откройте стих, который хотите прочитать'; $('#st-lang').innerHTML = ''; return; }
  $('#st-poem').textContent = `${s.si + 1}. ${A.titleOf(s)}`;
  const langs = [s.poem.fr && 'fr', s.poem.ru && 'ru'].filter(Boolean);
  if (!langs.includes(studio.lang)) studio.lang = langs[0];
  $('#st-lang').innerHTML = langs.map((l) => `<button class="pill ${l === studio.lang ? 'on' : ''}" data-l="${l}">${l === 'fr' ? 'Français' : 'Русский'}</button>`).join('');
  $('#st-lang').querySelectorAll('button').forEach((b) => { b.onclick = () => { studio.lang = b.dataset.l; studioPoem(); }; });
}
async function startRec() {
  try {
    if (!A.audio.ctx) A.audio.start();
    studio.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
  } catch (e) { A.toast('Нет доступа к микрофону'); return; }
  const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || '';
  studio.chunks = []; studio.rec = new MediaRecorder(studio.stream, mime ? { mimeType: mime, audioBitsPerSecond: 160000 } : undefined);
  studio.rec.ondataavailable = (e) => e.data.size && studio.chunks.push(e.data);
  studio.rec.onstop = async () => {
    studio.blob = new Blob(studio.chunks, { type: studio.rec.mimeType || 'audio/webm' });
    studio.stream.getTracks().forEach((t) => t.stop()); studio.rec = null; $('#studio').classList.remove('rec'); $('#st-rec').textContent = '● Записать заново';
    try { studio.buf = await A.audio.ctx.decodeAudioData(await studio.blob.arrayBuffer()); } catch (e) { studio.buf = null; }
    ['#st-play', '#st-raw', '#st-save'].forEach((q) => { $(q).disabled = false; });
  };
  const an = A.audio.ctx.createAnalyser(); an.fftSize = 1024; A.audio.ctx.createMediaStreamSource(studio.stream).connect(an); studio.an = an;
  A.audio.duck(true); studio.rec.start(); studio.t0 = performance.now();
  $('#studio').classList.add('rec'); $('#st-rec').textContent = '■ Стоп';
  const buf = new Float32Array(an.fftSize);
  const meter = () => {
    if (!studio.rec) { $('#st-level').style.width = '0'; A.audio.duck(false); return; }
    an.getFloatTimeDomainData(buf); let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v));
    $('#st-level').style.width = Math.min(100, m * 110) + '%';
    $('#st-time').textContent = ((performance.now() - studio.t0) / 1000).toFixed(0) + ' с';
    requestAnimationFrame(meter);
  };
  meter();
}
function stopRec() { studio.rec?.stop(); }
function playTake(processed) {
  if (!studio.buf) return; const ctx = A.audio.ctx;
  try { studio.src?.stop(); } catch (e) { /* уже */ }
  const src = ctx.createBufferSource(); src.buffer = studio.buf; studio.src = src;
  const s = A.STOPS[Math.max(0, A.get.current)];
  if (processed) { const ch = voiceChain(ctx, s.gi, src); ch.out.connect(ctx.destination); } else src.connect(ctx.destination);
  A.audio.duck(true); src.onended = () => A.audio.duck(false); src.start();
}
function saveTake() {
  if (!studio.blob) return;
  const s = A.STOPS[Math.max(0, A.get.current)], ext = /mp4/.test(studio.blob.type) ? 'm4a' : 'webm', name = `${A.idOf(s)}-${studio.lang}.${ext}`;
  const a = document.createElement('a'); a.href = URL.createObjectURL(studio.blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  const done = store.get('toi-voice-done', []); if (!done.includes(name)) done.push(name); store.set('toi-voice-done', done); studioDone();
}
function studioDone() { const d = store.get('toi-voice-done', []); $('#st-done').textContent = d.length ? `Сохранено: ${d.length} — ${d.join(', ')}` : ''; }

// ═════════════ Свечи слышат дыхание ═════════════
const mic = { on: false, stream: null, an: null, f: null, td: null, hold: 0, cool: 0 };
const smokes = [];
let flameScreen = new Vector3();
function initCandles() {
  for (const c of A.candles) { c.lit = 1; c.litT = 1; c.relight = 0; }
  $('#btn-candle').onclick = toggleMic;
  // клик по пламени задувает (и снова зажигает) свечу — для тех, кто без микрофона
  let d0 = null;
  A.css.domElement.addEventListener('pointerdown', (e) => { d0 = { x: e.clientX, y: e.clientY }; }, true);
  A.css.domElement.addEventListener('click', (e) => {
    if (!d0 || Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > 7 || e.target.closest('.sheet') || A.get.finaleOn) return;
    let best = null, bd = 34;
    for (const c of A.candles) {
      if (!c.g.visible) continue;
      c.flame.getWorldPosition(flameScreen); flameScreen.project(A.camera);
      if (flameScreen.z > 1) continue;
      const d = Math.hypot((flameScreen.x * 0.5 + 0.5) * innerWidth - e.clientX, (-flameScreen.y * 0.5 + 0.5) * innerHeight - e.clientY);
      if (d < bd) { bd = d; best = c; }
    }
    if (best) { if (best.litT > 0.5) blowOut(best, 0); else { best.litT = 1; A.audio.light(); } }
  });
}
async function toggleMic() {
  const b = $('#btn-candle');
  if (mic.on) { mic.stream?.getTracks().forEach((t) => t.stop()); mic.on = false; fx.blow = 0; b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); return; }
  try {
    if (!A.audio.ctx) A.audio.start();
    mic.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch (e) { A.toast('Микрофон недоступен. Свечу можно задуть кликом по пламени'); return; }
  const ctx = A.audio.ctx; mic.an = ctx.createAnalyser(); mic.an.fftSize = 1024; mic.an.smoothingTimeConstant = 0.3;
  ctx.createMediaStreamSource(mic.stream).connect(mic.an);
  mic.f = new Float32Array(mic.an.frequencyBinCount); mic.td = new Float32Array(mic.an.fftSize);
  mic.on = true; b.classList.add('on'); b.setAttribute('aria-pressed', 'true');
  A.toast('Подуйте на экран — пламя дрогнет, сильный выдох задует свечи');
}
function sensBlow() {
  // дыхание в микрофон — громкий широкополосный шум (у голоса и музыки спектр «тональный»)
  const an = mic.an, sr = A.audio.ctx.sampleRate, hz = sr / an.fftSize;
  an.getFloatTimeDomainData(mic.td); let e = 0; for (const v of mic.td) e += v * v;
  const db = 10 * Math.log10(e / mic.td.length + 1e-12);
  an.getFloatFrequencyData(mic.f);
  const i0 = Math.floor(200 / hz), i1 = Math.floor(5000 / hz); let lg = 0, ar = 0, lowP = 0, allP = 0;
  for (let i = i0; i < i1; i++) { const p = Math.pow(10, mic.f[i] / 10) + 1e-14; lg += Math.log(p); ar += p; allP += p; if (i * hz < 700) lowP += p; }
  const n = i1 - i0, flat = Math.exp(lg / n) / (ar / n);
  return MathUtils.smoothstep(db, -40, -18) * MathUtils.smoothstep(flat, 0.12, 0.32) * (0.6 + 0.4 * Math.min(1, (lowP / allP) * 3));
}
function blowOut(c, delay) {
  c.litT = 0; c.relight = A.get.now + delay + rnd(6, 10);
  setTimeout(() => { A.audio.puff(0.8); for (let i = 0; i < 3; i++) smoke(c, i * 0.25); }, delay * 1000);
}
function smoke(c, delay) {
  const s = new Sprite(new SpriteMaterial({ map: A.GLOW, color: new Color('#b9aab0'), blending: NormalBlending, depthWrite: false, transparent: true, opacity: 0 }));
  c.flame.getWorldPosition(s.position); A.scene.add(s);
  smokes.push({ s, t: -delay, life: rnd(3, 4.5), v: new Vector3(rnd(-8, 8), rnd(40, 70), rnd(-8, 8)), ph: rnd(0, 6) });
}
function updateCandles(dt, T) {
  if (mic.on) {
    const b = sensBlow();
    fx.blow += (b - fx.blow) * Math.min(1, dt * (b > fx.blow ? 14 : 3));
    mic.cool -= dt;
    if (fx.blow > 0.55) mic.hold += dt; else mic.hold = Math.max(0, mic.hold - dt * 2);
    if (mic.hold > 0.3 && mic.cool <= 0) {
      mic.cool = 2.5; mic.hold = 0;
      // гаснут видимые свечи — от ближних к дальним, волной
      const cam = A.camera.position, near = A.candles.filter((c) => c.g.visible && c.litT > 0.5 && cam.distanceTo(c.g.position) < 3200).sort((a, b) => cam.distanceTo(a.g.position) - cam.distanceTo(b.g.position));
      near.slice(0, 8).forEach((c, i) => blowOut(c, i * 0.12 + rnd(0, 0.06)));
    }
  }
  for (const c of A.candles) {
    if (c.litT === 0 && A.get.now > c.relight) { c.litT = 1; if (A.camera.position.distanceTo(c.g.position) < 2500) A.audio.light(0.6); }
    c.lit += (c.litT - c.lit) * Math.min(1, dt * (c.litT < c.lit ? 9 : 1.4));
  }
  for (let i = smokes.length - 1; i >= 0; i--) {
    const m = smokes[i]; m.t += dt;
    if (m.t < 0) continue;
    const k = m.t / m.life;
    if (k >= 1) { A.scene.remove(m.s); m.s.material.dispose(); smokes.splice(i, 1); continue; }
    m.s.position.addScaledVector(m.v, dt); m.s.position.x += Math.sin(T * 1.7 + m.ph) * 10 * dt;
    m.s.scale.setScalar(30 + k * 180); m.s.material.opacity = 0.32 * Math.sin(Math.PI * Math.min(1, k * 1.4)) * (1 - k); m.s.material.rotation += dt * 0.3;
  }
}

// ═════════════ Слова улетают ═════════════
const flyers = [], tray = [];
const _ray = new Ray(), _pl = new Plane(), _n = new Vector3(), _p = new Vector3(), _ndc = new Vector2();
function initWords() {
  A.css.domElement.addEventListener('dblclick', (e) => liftWord(e.clientX, e.clientY));
  // на телефоне — двойное касание
  let lastTap = null;
  A.css.domElement.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch') return;
    const t = performance.now();
    if (lastTap && t - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) { liftWord(e.clientX, e.clientY); lastTap = null; }
    else lastTap = { t, x: e.clientX, y: e.clientY };
  }, true);
  $('#wt-clear').onclick = () => { tray.length = 0; renderTray(); };
  $('#wt-card').onclick = () => openPostcard({ lines: [tray.join(' ')], trans: null, poem: null, lang: 'ru' });
}
// поиск строки и слова под точкой по их экранным прямоугольникам (надёжно и для 3D-листов на телефонах)
function lineAt(x, y) {
  const s = A.STOPS[A.get.current]; if (!s || A.get.mode !== 'poem') return null;
  for (const el of s.els) for (const p of el.querySelectorAll('.verse p:not(.gap), h3')) {
    const r = p.getBoundingClientRect(); if (x >= r.left - 4 && x <= r.right + 4 && y >= r.top - 2 && y <= r.bottom + 2) return p;
  }
  return null;
}
function wordAt(x, y) {
  const p = lineAt(x, y); if (!p) return null;
  const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT); let n, best = null, bd = 1e9;
  while ((n = tw.nextNode())) {
    for (const m of n.data.matchAll(/[\p{L}\p{M}’'-]+/gu)) {
      const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
      const b = r.getBoundingClientRect(), d = Math.hypot(Math.max(b.left - x, 0, x - b.right), Math.max(b.top - y, 0, y - b.bottom));
      if (d < bd) { bd = d; best = { range: r, word: m[0], rect: b }; }
    }
  }
  return bd < 14 ? { ...best, sheet: p.closest('.sheet') } : null;
}
function liftWord(x, y) {
  if (A.get.mode !== 'poem') return;
  const w = wordAt(x, y); if (!w) return;
  const sheet = w.sheet, r = w.range, rect = w.rect, word = w.word.replace(/^[’'-]+|[’'-]+$/g, '');
  if (word.length < 2 || !rect.width || r.startContainer.parentElement.closest('.flown')) return;
  getSelection()?.removeAllRanges();
  const span = document.createElement('span'); span.className = 'flown';
  try { r.surroundContents(span); } catch (err) { /* слово на границе тегов */ }
  setTimeout(() => span.classList.add('back'), 9000);
  setTimeout(() => { span.replaceWith(...span.childNodes); }, 12500);
  // точка слова в мире: луч из камеры через центр слова пересекаем с плоскостью листа
  const s = A.STOPS[+sheet.dataset.stop]; s.group.updateMatrixWorld();
  _n.set(0, 0, 1).applyQuaternion(s.group.quaternion); _pl.setFromNormalAndCoplanarPoint(_n, s.group.position);
  const hit = (sx, sy, out) => { _ndc.set((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1); _ray.origin.copy(A.camera.position); _ray.direction.set(_ndc.x, _ndc.y, 0.5).unproject(A.camera).sub(A.camera.position).normalize(); return _ray.intersectPlane(_pl, out); };
  const p = hit(rect.left + rect.width / 2, rect.top + rect.height / 2, new Vector3()); if (!p) return;
  const top = hit(rect.left + rect.width / 2, rect.top, new Vector3()), H = top ? top.distanceTo(p) * 2 : 20;
  const el = document.createElement('span'); el.textContent = word; el.style.fontSize = rect.height * 0.92 + 'px';
  $('#flyers').appendChild(el);
  const g = A.CHAPTERS[s.gi];
  el.style.setProperty('--lit', new Color('#fff3e0').lerp(new Color(g.color), 0.25).getStyle());
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('lit')));   // чернила отрываются от листа и загораются
  flyers.push({ el, p, v: new Vector3(rnd(-30, 30), rnd(95, 150), 0).addScaledVector(_n, rnd(10, 40)), H, px0: rect.height, t: 0, life: rnd(8, 10), rot: rnd(-0.3, 0.3), ph: rnd(0, 6) });
  A.audio.chime?.();
  tray.push(word); if (tray.length > 12) tray.shift(); renderTray();
}
function renderTray() {
  $('#words-tray').hidden = !tray.length;
  $('#wt-words').innerHTML = tray.map((w, i) => `<button data-i="${i}" title="Убрать слово">${esc(w)}</button>`).join('');
  $('#wt-words').querySelectorAll('button').forEach((b) => { b.onclick = () => { tray.splice(+b.dataset.i, 1); renderTray(); }; });
}
const _sp = new Vector3();
function updateFlyers(dt, T) {
  const tv = Math.tan(MathUtils.degToRad(A.camera.fov) / 2);
  for (let i = flyers.length - 1; i >= 0; i--) {
    const f = flyers[i]; f.t += dt;
    const k = f.t / f.life;
    if (k >= 1) { f.el.remove(); flyers.splice(i, 1); continue; }
    f.v.x += Math.sin(T * 0.9 + f.ph) * 14 * dt + A.wind.x * 0.25 * dt; f.v.z += A.wind.z * 0.25 * dt; f.v.y += 22 * dt;
    f.p.addScaledVector(f.v, dt * MathUtils.smoothstep(f.t, 0, 0.6));
    _sp.copy(f.p).project(A.camera);
    const depth = _sp.z < 1 ? A.camera.position.distanceTo(f.p) : -1;
    if (depth <= 0) { f.el.style.opacity = 0; continue; }
    const grow = 1 + k * 0.7, px = (f.H * grow * innerHeight) / (2 * depth * tv), sc = px / f.px0;
    const x = (_sp.x * 0.5 + 0.5) * innerWidth, y = (-_sp.y * 0.5 + 0.5) * innerHeight;
    f.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${sc.toFixed(3)}) rotate(${(f.rot * k + Math.sin(T + f.ph) * 0.05).toFixed(3)}rad)`;
    f.el.style.opacity = (Math.min(1, f.t * 3) * (1 - MathUtils.smoothstep(k, 0.55, 1))).toFixed(3);
    f.el.style.filter = `blur(${(MathUtils.smoothstep(k, 0.5, 1) * 2.5).toFixed(2)}px)`;
  }
}

// ═════════════ Ожившие фотографии ═════════════
function initPhotos() {
  document.addEventListener('click', (e) => {
    const img = e.target.closest?.('.sheet .photo'); if (!img) return;
    const sheet = img.closest('.sheet'), si = +sheet.dataset.stop;
    if (si !== A.get.current || A.get.flight) return;      // сначала лист прилетит, второй клик откроет фото
    openPhoto(A.STOPS[si]);
  }, true);
  const box = $('#photo-box');
  box.addEventListener('click', (e) => { if (!e.target.closest('.pb-stage')) closePhoto(); });
  box.querySelector('.pb-close').onclick = closePhoto;
  box.addEventListener('pointermove', (e) => { box.style.setProperty('--mx', ((e.clientX / innerWidth) * 2 - 1).toFixed(3)); box.style.setProperty('--my', ((e.clientY / innerHeight) * 2 - 1).toFixed(3)); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !box.hidden) { e.stopImmediatePropagation(); closePhoto(); } }, true);
}
function openPhoto(s) {
  const box = $('#photo-box'), p = s.poem, id = p.id;
  if (!A.PHOTO[id]) return;
  const ph = box.querySelector('.pb-photo'), sk = box.querySelector('.pb-sketch');
  ph.src = A.PHOTO[id]; sk.src = A.SKETCH[id] || '';
  [ph, sk].forEach((el) => { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; });
  box.querySelector('h4').textContent = A.titleOf(s);
  box.querySelector('.fr').textContent = p.fr?.lines.find(Boolean) || '';
  box.querySelector('.ru').textContent = p.ru?.lines.find(Boolean) || '';
  const dust = box.querySelector('.pb-dust'); dust.innerHTML = '';
  for (let i = 0; i < 26; i++) { const d = document.createElement('i'); d.style.left = rnd(5, 95) + '%'; d.style.top = rnd(20, 100) + '%'; d.style.animationDuration = rnd(4, 9) + 's'; d.style.animationDelay = rnd(0, 6) + 's'; dust.appendChild(d); }
  box.hidden = false; A.audio.pageTurn(); setTimeout(() => A.audio.chime?.(), 1200);
}
function closePhoto() { $('#photo-box').hidden = true; }

// ═════════════ Розы на любимых стихах ═════════════
const roses = new Set(store.get('toi-roses', []));
const roseObj = new Map();
function initRoses() {
  $('#btn-rose').onclick = () => {
    const s = A.STOPS[A.get.current]; if (!s || s.type !== 'poem') return;
    const id = A.idOf(s);
    if (roses.has(id)) { roses.delete(id); dropRose(s); A.toast('Роза убрана'); }
    else { roses.add(id); growRose(s, true); A.toast('Роза расцвела на этом витке — её видно и с карты'); }
    store.set('toi-roses', [...roses]); A.updateHud(); chips();
  };
  for (const s of A.STOPS) if (roses.has(A.idOf(s))) growRose(s, false);
}
function rosePos(s) {
  const h = Math.max(...s.sizes.map((z) => z.h));
  return s.base.clone().addScaledVector(UP, -h / 2 - 70).addScaledVector(s.N, -s.side * 120);
}
function growRose(s, anim) {
  const rose = new Sprite(new SpriteMaterial({ map: null, color: new Color('#ff7a98'), blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.95 }));
  A.loadTex(A.INK.rose, (t) => { rose.material.map = t; rose.material.needsUpdate = true; rose.userData.ar = t.image.width / t.image.height; });
  const glow = new Sprite(new SpriteMaterial({ map: A.GLOW, color: new Color('#ff3d6e'), blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 }));
  const p = rosePos(s); rose.position.copy(p); glow.position.copy(p); A.scene.add(glow, rose);
  const sparks = anim ? Array.from({ length: 16 }, () => { const sp = new Sprite(new SpriteMaterial({ map: A.GLOW, color: new Color(Math.random() < 0.5 ? '#ff9ab0' : '#ffe0c0'), blending: AdditiveBlending, depthWrite: false, transparent: true })); sp.position.copy(p); A.scene.add(sp); return { sp, v: new Vector3().randomDirection().multiplyScalar(rnd(80, 220)) }; }) : [];
  roseObj.set(s.si, { rose, glow, t: anim ? 0 : 5, s, sparks, out: false, ph: rnd(0, 6) });
  if (anim) A.audio.light(0.8);
}
function dropRose(s) { const r = roseObj.get(s.si); if (r) { r.out = true; r.t = 0; } }
const backOut = (x) => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
function updateRoses(dt, T) {
  for (const [si, r] of roseObj) {
    r.t += dt;
    const g = r.out ? 1 - Math.min(1, r.t / 0.8) : backOut(Math.min(1, r.t / 2.2));
    if (r.out && r.t > 0.8) { [r.rose, r.glow].forEach((o) => { A.scene.remove(o); o.material.dispose(); }); r.sparks.forEach((q) => { A.scene.remove(q.sp); q.sp.material.dispose(); }); roseObj.delete(si); continue; }
    const md = A.camera.position.distanceTo(r.rose.position), far = Math.max(1, md / 4500);
    r.rose.scale.set(300 * g * far * (r.rose.userData.ar || 0.8), 300 * g * far, 1);
    r.rose.material.rotation = Math.sin(T * 0.6 + r.ph) * 0.08; r.rose.material.opacity = 0.95 * A.get.fade;
    r.glow.scale.setScalar(760 * g * far * (1 + 0.1 * Math.sin(T * 1.6 + r.ph))); r.glow.material.opacity = (0.32 + (A.get.mode === 'overview' ? 0.35 : 0)) * A.get.fade;
    const vis = !A.get.finaleOn; r.rose.visible = r.glow.visible = vis;
    for (let i = r.sparks.length - 1; i >= 0; i--) {
      const q = r.sparks[i], k = r.t / 1.8;
      if (k >= 1) { A.scene.remove(q.sp); q.sp.material.dispose(); r.sparks.splice(i, 1); continue; }
      q.sp.position.addScaledVector(q.v, dt); q.v.multiplyScalar(Math.exp(-dt * 1.5)); q.sp.scale.setScalar(70 * (1 - k)); q.sp.material.opacity = 1 - k;
    }
  }
}

// ═════════════ Открытка из строки ═════════════
const pc = { poem: null, lang: 'ru', i0: 0, i1: 0, free: null, style: 'parch', format: 'card', tr: true, si: -1 };
let lineHover = null, lineHide = 0, press = null;
const parchImg = new Image(); parchImg.src = parchURL;
const inkImgs = {};
function inkImg(key) { if (!inkImgs[key]) { const im = new Image(); im.src = A.INK[key]; inkImgs[key] = im; } return inkImgs[key]; }
function initPostcards() {
  // наведение на строку → кнопка ✉ у её конца
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const p = e.target.closest?.('.sheet .verse p:not(.gap)');
    if (p && A.get.mode === 'poem' && +p.closest('.sheet').dataset.stop === A.get.current) { lineHover = p; lineHide = 0; }
  });
  document.addEventListener('pointerout', (e) => { if (lineHover && !e.relatedTarget?.closest?.('#pc-line') && e.target.closest?.('.verse p') === lineHover) lineHide = performance.now() + 900; });
  $('#pc-line').onclick = () => { if (lineHover) openFromLine(lineHover); hideLineBtn(); };
  // на телефоне — долгое нажатие на строку
  A.css.domElement.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    const p = lineAt(e.clientX, e.clientY); if (!p || p.tagName === 'H3') return;
    press = { p, x: e.clientX, y: e.clientY, h: setTimeout(() => { navigator.vibrate?.(15); openFromLine(p); press = null; }, 620) };
  }, true);
  const cancel = (e) => { if (press && (e.type !== 'pointermove' || Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10)) { clearTimeout(press.h); press = null; } };
  ['pointerup', 'pointercancel', 'pointermove'].forEach((t) => A.css.domElement.addEventListener(t, cancel, true));
  const m = $('#pc-modal');
  m.addEventListener('click', (e) => { if (e.target === m) closePostcard(); });
  m.querySelector('.pc-close').onclick = closePostcard;
  m.querySelectorAll('#pc-styles button').forEach((b) => { b.onclick = () => { pc.style = b.dataset.v; drawPostcard(); }; });
  m.querySelectorAll('#pc-formats button').forEach((b) => { b.onclick = () => { pc.format = b.dataset.v; drawPostcard(); }; });
  m.querySelectorAll('#pc-lines button').forEach((b) => {
    b.onclick = () => {
      const n = linesOf(pc.poem, pc.lang).length;
      if (b.dataset.v === 'up' && pc.i0 > 0 && pc.i1 - pc.i0 < 7) pc.i0--;
      if (b.dataset.v === 'down' && pc.i1 < n - 1 && pc.i1 - pc.i0 < 7) pc.i1++;
      if (b.dataset.v === 'one') pc.i0 = pc.i1 = pc.i0;
      drawPostcard();
    };
  });
  $('#pc-tr').onchange = (e) => { pc.tr = e.target.checked; drawPostcard(); };
  $('#pc-dl').onclick = () => cardBlob().then((b) => download(b));
  $('#pc-share').onclick = shareCard;
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !m.hidden) { e.stopImmediatePropagation(); closePostcard(); } }, true);
}
function hideLineBtn() { $('#pc-line').hidden = true; lineHover = null; }
function updateLineBtn() {
  const b = $('#pc-line');
  if (!lineHover || A.get.mode !== 'poem' || A.get.flight || (lineHide && performance.now() > lineHide && !b.matches(':hover'))) { if (!b.hidden) b.hidden = true; if (lineHide && performance.now() > lineHide) lineHover = null; return; }
  const r = document.createRange(); r.selectNodeContents(lineHover); const rects = r.getClientRects(), last = rects[rects.length - 1];
  if (!last) return;
  b.hidden = false; b.style.left = last.right + 'px'; b.style.top = (last.top + last.height / 2) + 'px';
}
const linesOf = (poem, lang) => (poem ? (lang === 'fr' ? poem.fr : poem.ru)?.lines || [] : []);
function openFromLine(p) {
  const sheet = p.closest('.sheet'), s = A.STOPS[+sheet.dataset.stop]; if (s.type !== 'poem') return;
  const lang = sheet.lang, ps = [...sheet.querySelectorAll('.verse p')], i = ps.indexOf(p);
  openPostcard({ poem: s.poem, lang, i0: i, i1: i, si: s.si });
}
function openPostcard(o) {
  Object.assign(pc, { poem: o.poem || null, lang: o.lang || 'ru', i0: o.i0 ?? 0, i1: o.i1 ?? 0, si: o.si ?? -1, free: o.poem ? null : o.lines });
  $('#pc-lines').hidden = $('#pc-lines-l').hidden = !pc.poem;
  $('#pc-tr-l').hidden = !(pc.poem && pc.poem.fr && pc.poem.ru);
  $('#pc-modal').hidden = false;
  document.fonts.load('italic 60px Gelasio').then(() => Promise.all(['60px "PT Serif"', 'italic 60px "PT Serif"', '80px "Ms Madi"', '30px Manrope'].map((f) => document.fonts.load(f)))).finally(drawPostcard);
  drawPostcard();
}
function closePostcard() { $('#pc-modal').hidden = true; }
function wrap(g, text, maxW) {
  const out = []; let line = '';
  for (const w of text.split(/\s+/)) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line); return out;
}
function tinted(img, color, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  if (img.complete && img.naturalWidth) { g.drawImage(img, 0, 0, w, h); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, w, h); }
  return c;
}
function drawPostcard() {
  document.querySelectorAll('#pc-styles button').forEach((b) => b.classList.toggle('on', b.dataset.v === pc.style));
  document.querySelectorAll('#pc-formats button').forEach((b) => b.classList.toggle('on', b.dataset.v === pc.format));
  const story = pc.format === 'story', W = story ? 1080 : 1800, H = story ? 1920 : 1200;
  const cv = $('#pc-canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const st = pc.style, poem = pc.poem;
  const P = {
    parch: { ink: '#2b1c10', sub: '#6b4f36', foot: '#5a4030', draw: 'rgba(70,40,20,.22)', div: '#6b3a24' },
    night: { ink: '#f6ead6', sub: '#cdb7e8', foot: '#d9c6a6', draw: 'rgba(255,200,140,.2)', div: '#ffcf9a' },
    rose: { ink: '#ffeef2', sub: '#f5b9c8', foot: '#f0c9d2', draw: 'rgba(255,170,190,.2)', div: '#ff9ab3' },
  }[st];
  // фон
  if (st === 'parch') {
    g.fillStyle = '#ead9b6'; g.fillRect(0, 0, W, H);
    if (parchImg.complete && parchImg.naturalWidth) { g.globalAlpha = 0.9; g.fillStyle = g.createPattern(parchImg, 'repeat'); g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(90,50,20,.42)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(90,60,30,.55)'; g.lineWidth = 2; g.strokeRect(46, 46, W - 92, H - 92); g.lineWidth = 1; g.strokeRect(58, 58, W - 116, H - 116);
  } else {
    const night = st === 'night', bg = g.createLinearGradient(0, 0, W * 0.3, H);
    bg.addColorStop(0, night ? '#1b0f3a' : '#3d0a1c'); bg.addColorStop(1, night ? '#07040f' : '#12030a'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    let seed = 7; const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) { const x = R() * W, y = R() * H, r = (0.2 + R() * 0.35) * Math.max(W, H), c = night ? (R() < 0.5 ? '106,85,255' : '255,79,195') : (R() < 0.5 ? '255,60,110' : '255,140,90'); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${c},.13)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
    for (let i = 0; i < (night ? 380 : 160); i++) { const r = R() * 1.8 + 0.3; g.fillStyle = `rgba(255,240,220,${0.25 + R() * 0.6})`; g.beginPath(); g.arc(R() * W, R() * H, r, 0, 7); g.fill(); }
    const cg = g.createRadialGradient(W / 2, H * 1.02, 0, W / 2, H * 1.02, H * 0.5); cg.addColorStop(0, 'rgba(255,150,70,.22)'); cg.addColorStop(1, 'rgba(255,150,70,0)'); g.fillStyle = cg; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = night ? 'rgba(255,220,180,.22)' : 'rgba(255,190,200,.25)'; g.lineWidth = 1.5; g.strokeRect(46, 46, W - 92, H - 92);
  }
  // рисунок тушью
  const key = poem?.ink || (st === 'rose' ? 'rose' : 'roses_small'), im = inkImg(key);
  if (im.complete && im.naturalWidth) {
    const h = (story ? 0.42 : 0.62) * H, w = h * (im.naturalWidth / im.naturalHeight);
    g.drawImage(tinted(im, P.draw, Math.round(w), Math.round(h)), story ? W - w * 0.78 : W - w * 0.86, story ? H - h - 120 : H - h * 0.92);
  }
  // текст
  const main = poem ? linesOf(poem, pc.lang).slice(pc.i0, pc.i1 + 1).filter(Boolean) : pc.free;
  const other = poem && pc.tr ? linesOf(poem, pc.lang === 'fr' ? 'ru' : 'fr').slice(pc.i0, pc.i1 + 1).filter(Boolean) : [];
  const maxW = W * (story ? 0.78 : 0.7), fam = (lang, it) => `${it ? 'italic ' : ''}%spx ${lang === 'fr' ? 'Gelasio, Georgia' : '"PT Serif", Georgia'}, serif`;
  let fs = story ? 80 : 96, lay;
  const layout = () => {
    g.font = fam(pc.lang, true).replace('%s', fs); const a = main.flatMap((l) => wrap(g, l, maxW));
    g.font = fam(pc.lang === 'fr' ? 'ru' : 'fr', pc.lang !== 'fr').replace('%s', Math.round(fs * 0.58)); const b = other.flatMap((l) => wrap(g, l, maxW));
    return { a, b, h: a.length * fs * 1.42 + (b.length ? 90 + b.length * fs * 0.58 * 1.5 : 0) };
  };
  while ((lay = layout()).h > H * (story ? 0.52 : 0.56) && fs > 30) fs -= 3;
  let y = (story ? H * 0.42 : H * 0.47) - lay.h / 2;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (st !== 'parch') { g.shadowColor = st === 'night' ? 'rgba(255,190,120,.55)' : 'rgba(255,120,150,.5)'; g.shadowBlur = 22; }
  g.fillStyle = P.ink; g.font = fam(pc.lang, true).replace('%s', fs);
  for (const l of lay.a) { g.fillText(l, W / 2, y + fs * 0.7); y += fs * 1.42; }
  if (lay.b.length) {
    y += 22; const dv = inkImg('roses_small');
    if (dv.complete && dv.naturalWidth) { const h = 72, w = h * dv.naturalWidth / dv.naturalHeight; g.shadowBlur = 0; g.drawImage(tinted(dv, P.div, Math.round(w), h), W / 2 - w / 2, y - 4); }
    else { g.fillStyle = P.div; g.fillText('❀', W / 2, y + 22); }
    y += 68; if (st !== 'parch') g.shadowBlur = 14;
    g.fillStyle = P.sub; const f2 = Math.round(fs * 0.58); g.font = fam(pc.lang === 'fr' ? 'ru' : 'fr', pc.lang !== 'fr').replace('%s', f2);
    for (const l of lay.b) { g.fillText(l, W / 2, y + f2 * 0.6); y += f2 * 1.5; }
  }
  g.shadowBlur = 0;
  // подпись
  const fy = H - (story ? 210 : 150);
  g.fillStyle = P.foot; g.font = `${story ? 84 : 76}px "Ms Madi", Georgia, serif`; g.fillText('Toi et Moi', W / 2, fy);
  g.font = `500 ${story ? 26 : 24}px Manrope, sans-serif`; g.globalAlpha = 0.85;
  const title = poem ? A.titleOf(A.STOPS[pc.si]) : 'Ваша строка';
  g.fillText(`${title.toUpperCase()}  ·  ARTEM TORGASHEV`.replace(/\s+·\s+$/, ''), W / 2, fy + (story ? 78 : 66));
  g.globalAlpha = 0.6; g.font = `${story ? 22 : 20}px Manrope, sans-serif`; g.fillText(A.siteUrl().replace(/^https?:\/\//, '').replace(/\/$/, ''), W / 2, fy + (story ? 118 : 100)); g.globalAlpha = 1;
}
function cardBlob() { return new Promise((res) => $('#pc-canvas').toBlob(res, 'image/png')); }
function download(blob) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `toi-et-moi-${pc.poem?.id || 'stroka'}.png`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000); A.toast('Открытка сохранена');
}
async function shareCard() {
  const blob = await cardBlob(), file = new File([blob], `toi-et-moi-${pc.poem?.id || 'stroka'}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Toi et Moi', text: 'Toi et Moi — ' + A.siteUrl() }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  download(blob); A.toast('Открытка сохранена — прикрепите её в мессенджере');
}
