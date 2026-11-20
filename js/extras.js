// Живые взаимодействия с вселенной «Toi et Moi»: прогулка и голос автора · ожившие фотографии.
import { MathUtils } from 'three';

export const fx = { onHud: null };
let A;                                   // API движка (передаётся из main.js)
const $ = (s) => document.querySelector(s);
const rnd = (a, b) => a + Math.random() * (b - a);

export function initExtras(api) {
  A = api;
  initWalk(); initVoice(); initPhotos();
  fx.onHud = onHud;
  if (new URLSearchParams(location.search).has('shot')) window.__ex = { walk, voice };
}
export function updateExtras(dt) { updateWalk(dt); updateVoice(); }
function onHud() {
  const s = A.get.current >= 0 ? A.STOPS[A.get.current] : null, reading = A.get.mode === 'poem' && s;
  $('#btn-voice').hidden = !(reading && voiceFor(s).length);
  if (!$('#btn-voice').hidden) $('#btn-voice').classList.toggle('on', !!voice.el);
}

// ═════════════ Прогулка ═════════════
const walk = { on: false, steps: [], i: 0, phase: 'fly', t: 0, dwell: 1, waitVoice: false };
const words = (lines) => (lines || []).join(' ').match(/[\p{L}’'-]+/gu)?.length || 0;
function initWalk() {
  $('#btn-walk').onclick = () => (walk.on ? stopWalk() : startWalk(A.get.mode === 'poem' && A.get.current >= 0 ? A.get.current : 0));
  $('#wb-stop').onclick = () => stopWalk();
  $('#mp-walk').onclick = () => startWalk(0);
  // любое действие читателя останавливает прогулку
  const stop = (e) => { if (walk.on && !e.target.closest?.('#walk-bar, #btn-walk, #btn-sound, #btn-fs')) stopWalk(); };
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
// Записи уже обработаны заранее (у каждого стиха свой тембр и зал) — здесь только громкость.
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
}
function voiceFor(s, k = null) {
  if (!voice.map || !s || s.type !== 'poem') return [];
  const v = voice.map[s.poem.id]; if (!v) return [];
  const langs = k === null ? ['fr', 'ru'] : [s.objs[k]?.element?.lang || (k === 0 ? (s.poem.fr ? 'fr' : 'ru') : 'ru')];
  return langs.filter((l) => v[l]).map((l) => ({ url: 'voice/' + v[l] }));
}
function voiceChain(ctx, input) { const out = ctx.createGain(); out.gain.value = 1; input.connect(out); return { out, nodes: [out] }; }
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
  const src = ctx.createMediaElementSource(el), ch = voiceChain(ctx, src), g = ctx.createGain();
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

