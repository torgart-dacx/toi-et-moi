import {
  Scene, PerspectiveCamera, WebGLRenderer, Vector3, Vector2, Color, Group, Quaternion,
  BufferGeometry, BufferAttribute, Float32BufferAttribute, Points, ShaderMaterial, AdditiveBlending,
  Sprite, SpriteMaterial, CanvasTexture, TextureLoader, SRGBColorSpace, Mesh, SphereGeometry,
  PlaneGeometry, CylinderGeometry, MeshBasicMaterial, BackSide, DoubleSide, CatmullRomCurve3,
  CubicBezierCurve3, MathUtils, Raycaster, WebGLRenderTarget, OrthographicCamera, Line,
  LineBasicMaterial, RepeatWrapping, LinearFilter, DataTexture, RedFormat, UnsignedByteType,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { BOOK, AFTERWORD, GALAXIES as CHAPTERS, ORDER } from './data.js';
import { Ambient } from './audio.js';
import inkRosesSmall from '../img/ink-roses_small.webp';
import inkRose from '../img/ink-rose.webp';
import inkSwords from '../img/ink-swords.webp';
import inkWave from '../img/ink-wave.webp';
import parchmentURL from '../img/parchment.webp';
import inkBoat from '../img/ink-boat.webp';
import skDejavu from '../img/sketch-dejavu.webp';
import skJeVeux from '../img/sketch-je-veux.webp';
import skStupenki from '../img/sketch-stupenki.webp';
import skEcho from '../img/sketch-echo.webp';
import skSevan from '../img/sketch-sevan.webp';
import phDejavu from '../img/photo-dejavu.webp';
import phJeVeux from '../img/photo-je-veux.webp';
import phStupenki from '../img/photo-stupenki.webp';
import phEcho from '../img/photo-echo.webp';
import phSevan from '../img/photo-sevan.webp';

const INK = { roses_small: inkRosesSmall, rose: inkRose, swords: inkSwords, wave: inkWave, boat: inkBoat };
const SKETCH = { dejavu: skDejavu, 'je-veux': skJeVeux, stupenki: skStupenki, echo: skEcho, sevan: skSevan };
// фотографии из сборника — на листах тех стихов, рядом с которыми они стоят в книге
const PHOTO = { dejavu: 'img/photo-dejavu.webp', 'je-veux': 'img/photo-je-veux.webp', stupenki: 'img/photo-stupenki.webp', echo: 'img/photo-echo.webp', sevan: 'img/photo-sevan.webp' };
const PHOTO_DATA = [phDejavu, phJeVeux, phStupenki, phEcho, phSevan];   // для WebGL (работает и с file://)
const SKETCH_POOL = [...Object.values(INK), ...Object.values(SKETCH)];

const $ = (s) => document.querySelector(s);
const UP = new Vector3(0, 1, 0);
const isTouch = matchMedia('(pointer:coarse)').matches;
const lowPower = isTouch || innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SHOT = new URLSearchParams(location.search).get('shot');
const SHEET_SCALE = 0.62, GAP = 34;
const audio = new Ambient();
const rnd = (a, b) => a + Math.random() * (b - a);

// ───────────── Рендер ─────────────
const scene = new Scene();
const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 2, 90000);
const renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
const DPR_MAX = Math.min(devicePixelRatio || 1, lowPower ? 1.25 : 1.5);
let dpr = DPR_MAX;
renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight);
$('#gl').appendChild(renderer.domElement);
const css = new CSS3DRenderer(); css.setSize(innerWidth, innerHeight); $('#css').appendChild(css.domElement);
const controls = new OrbitControls(camera, css.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.12; controls.rotateSpeed = 0.6; controls.panSpeed = 1.1;
controls.minDistance = 60; controls.maxDistance = 30000; controls.enabled = false; controls.autoRotateSpeed = 0.35;

// ───────────── Путь: вихрь, закрученный вверх ─────────────
const STOPS = [];
ORDER.forEach((p) => STOPS.push({ type: 'poem', poem: p, gi: p.gi }));
STOPS.push({ type: 'after', gi: 4 });
STOPS.push({ type: 'ded', gi: 4 });
const NS = STOPS.length, PN = NS - 1;   // посвящение не на спирали, а в её центре
const idOf = (s) => (s.type === 'poem' ? s.poem.id : s.type === 'after' ? 'posleslovie' : 'posvyashchenie');
const ctrlPts = [];
for (let k = 0; k < PN + 4; k++) {
  const a = k * 0.6, R = 1550 - k * 22 + Math.sin(k * 1.3) * 60;
  ctrlPts.push(new Vector3(Math.cos(a) * R, k * 340 + Math.sin(k * 0.9) * 40, Math.sin(a) * R));
}
const path = new CatmullRomCurve3(ctrlPts, false, 'centripetal');
const tOf = (k) => k / (ctrlPts.length - 1);
const stopT = (i) => tOf(i + 2);
const AXIS = new Vector3(0, ctrlPts[ctrlPts.length - 1].y / 2, 0);
const LAT = 230;
STOPS.forEach((s, i) => {
  if (s.type === 'ded') {
    const last = STOPS[i - 1];
    s.base = new Vector3(0, last.base.y + 560, 0);
    s.D = s.base.clone().sub(last.base).setY(0).normalize().addScaledVector(UP, -0.14).normalize();
    Object.assign(s, { si: i, t: last.t, T: s.D.clone(), N: new Vector3().crossVectors(s.D, UP).normalize(), side: 1, seed: Math.random() * 10 });
    return;
  }
  const t = stopT(i), P = path.getPoint(t), T = path.getTangent(t).normalize();
  const N = new Vector3().crossVectors(T, UP).normalize(), side = i % 2 ? 1 : -1;
  Object.assign(s, { si: i, t, T, N, side, seed: Math.random() * 10 });
  s.base = P.clone().addScaledVector(N, side * LAT);
  s.D = T.clone().addScaledVector(N, side * 0.42).addScaledVector(UP, -0.08).normalize();
});

// ───────────── Звёзды и пыль с глубиной резкости ─────────────
const starMats = [];
function starMaterial(dof, repel) {
  const m = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFocus: { value: 900 }, uScale: { value: 800 }, uPR: { value: dpr }, uDof: { value: dof }, uMouse: { value: 0 }, uFade: { value: 1 }, uRepel: { value: repel ? 1 : 0 }, uRayO: { value: new Vector3() }, uRayD: { value: new Vector3(0, 0, -1) } },
    vertexShader: /* glsl */`
      attribute float aSize; attribute float aPhase; attribute vec3 aColor;
      uniform float uTime, uFocus, uScale, uPR, uDof, uMouse, uRepel, uFade; uniform vec3 uRayO, uRayD;
      varying vec3 vColor; varying float vAlpha, vBlur;
      void main(){
        vec3 wp = position; wp.y += sin(uTime * 0.2 + aPhase * 6.0) * 12.0;
        vColor = aColor;
        if (uRepel > 0.5) {
          vec3 toP = wp - uRayO; float t = max(dot(toP, uRayD), 1.0);
          vec3 off = toP - uRayD * t; float d = length(off); float R = t * 0.08;
          float f = (1.0 - smoothstep(0.0, R, d)) * uMouse;
          wp += (off / (d + 0.001)) * f * R * 0.6; vColor *= 1.0 + f * 2.0;
        }
        vec4 mv = viewMatrix * vec4(wp, 1.0); float depth = -mv.z;
        float blur = clamp(abs(depth - uFocus) / (uFocus * 0.9), 0.0, 1.0) * uDof;
        gl_PointSize = min(clamp(aSize * uScale / max(depth, 1.0), 1.0, 22.0) * (1.0 + blur * 2.6), 56.0) * uPR;
        gl_Position = projectionMatrix * mv;
        vAlpha = (0.65 + 0.35 * sin(uTime * (0.7 + aPhase) + aPhase * 7.0)) / (1.0 + blur * blur * 6.0) * smoothstep(8.0, 90.0, depth) * uFade;
        vBlur = blur;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vColor; varying float vAlpha, vBlur;
      void main(){
        vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0; if (r > 1.0) discard;
        float core = exp(-r * r * 7.0) + exp(-r * r * 40.0) * 0.8;
        float disk = smoothstep(1.0, 0.82, r) * (0.45 + 0.55 * smoothstep(0.5, 0.95, r));
        gl_FragColor = vec4(vColor * mix(core, disk * 0.8, smoothstep(0.15, 0.6, vBlur)) * vAlpha, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  });
  starMats.push(m); return m;
}
function addPoints(n, place, colorFn, sizeFn, dof, repel) {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), ph = new Float32Array(n);
  const v = new Vector3(), c = new Color();
  for (let i = 0; i < n; i++) { place(v, i); pos.set([v.x, v.y, v.z], i * 3); colorFn(c, i, v); col.set([c.r, c.g, c.b], i * 3); size[i] = sizeFn(i); ph[i] = Math.random() * 6; }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('aColor', new Float32BufferAttribute(col, 3));
  g.setAttribute('aSize', new Float32BufferAttribute(size, 1)); g.setAttribute('aPhase', new Float32BufferAttribute(ph, 1));
  const p = new Points(g, starMaterial(dof, repel)); p.frustumCulled = false; scene.add(p); return p;
}
function nearPath(v, rMin, rMax, t = Math.random()) {
  const P = path.getPoint(t), T = path.getTangent(t);
  const N = new Vector3().crossVectors(T, UP).normalize(), B = new Vector3().crossVectors(N, T).normalize();
  const a = Math.random() * Math.PI * 2, r = rnd(rMin, rMax);
  return v.copy(P).addScaledVector(N, Math.cos(a) * r).addScaledVector(B, Math.sin(a) * r * 0.8);
}
const STAR_PAL = ['#ffffff', '#ffe9c4', '#ffd6f2', '#cfe0ff', '#fff4dc'].map((h) => new Color(h));
addPoints(lowPower ? 1600 : 3000, (v) => v.randomDirection().multiplyScalar(rnd(14000, 30000)).add(AXIS),
  (c) => c.copy(STAR_PAL[(Math.random() * 5) | 0]).multiplyScalar(rnd(0.45, 1)), () => (Math.random() < 0.03 ? rnd(200, 360) : rnd(50, 120)), 0.05, false);
addPoints(lowPower ? 1100 : 2200, (v) => nearPath(v, 180, 1500), (c, i, v) => {
  const g = Math.min(4, Math.max(0, Math.floor((v.y / (NS * 340)) * 5)));
  c.copy(new Color(CHAPTERS[g].color)).lerp(STAR_PAL[(Math.random() * 5) | 0], 0.55).multiplyScalar(rnd(0.5, 0.95));
}, () => (Math.random() < 0.05 ? rnd(14, 24) : rnd(4, 10)), 1, true);

// ───────────── Туманность, запечённая в текстуру ─────────────
const skyRT = new WebGLRenderTarget(lowPower ? 768 : 1024, lowPower ? 384 : 512, { magFilter: LinearFilter, minFilter: LinearFilter });
skyRT.texture.wrapS = RepeatWrapping;
{
  const bake = new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */`
      varying vec2 vUv;
      float h(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
      float nz(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
      float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<6;i++){ s+=a*nz(p); p*=2.03; a*=0.5; } return s; }
      void main(){
        float lon = (vUv.x - 0.5) * 6.2831853, lat = (vUv.y - 0.5) * 3.1415926;
        vec3 d = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
        float n1 = fbm(d * 2.4 + 3.1), n2 = fbm(d * 4.6 - 1.7);
        float band = exp(-pow(d.y * 2.2 + sin(d.x * 3.0) * 0.3, 2.0));
        gl_FragColor = vec4(pow(smoothstep(0.34, 0.86, n1), 1.7) * (0.5 + 0.6 * band), pow(smoothstep(0.42, 0.92, n2), 1.9) * (0.4 + 0.7 * band), pow(smoothstep(0.72, 1.0, n1 * n2 * 1.7), 3.0), 1.0);
      }`,
  }));
  const bs = new Scene(); bs.add(bake);
  renderer.setRenderTarget(skyRT); renderer.render(bs, new OrthographicCamera(-1, 1, 1, -1, 0, 1)); renderer.setRenderTarget(null);
  bake.geometry.dispose(); bake.material.dispose();
}
const skyMat = new ShaderMaterial({
  side: BackSide, depthWrite: false,
  uniforms: { uFade: { value: 1 }, uTex: { value: skyRT.texture }, uBg: { value: new Color('#0b0620') }, uC1: { value: new Color('#6a55ff') }, uC2: { value: new Color('#ff4fc3') } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    varying vec3 vDir; uniform sampler2D uTex; uniform vec3 uBg, uC1, uC2; uniform float uFade;
    void main(){
      vec3 d = normalize(vDir);
      vec2 uv = vec2(atan(d.z, d.x) / 6.2831853 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.1415926 + 0.5);
      vec3 n = texture2D(uTex, uv).rgb;
      gl_FragColor = vec4((uBg + uC1 * n.r + uC2 * n.g + vec3(n.b * 0.14)) * uFade, 1.0);
    }`,
});
const sky = new Mesh(new SphereGeometry(60000, 40, 24), skyMat);
sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);

// Облака туманности: большие мягкие спрайты вокруг вихря — дают глубину и цвет
const CLOUD_TEX = [0, 1, 2].map((v) => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const x = 128 + (Math.random() - 0.5) * 120, y = 128 + (Math.random() - 0.5) * 90, r = 30 + Math.random() * 70;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,255,255,${0.10 + Math.random() * 0.12})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
});
// Поток света по спирали вихря — на карте он вращается и течёт вверх
const ST_N = lowPower ? 1800 : 3800;
const stMat = new ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uRot: { value: 0 }, uVis: { value: 0.25 }, uScale: { value: 800 }, uPR: { value: dpr }, uFade: { value: 1 }, uK: { value: PN + 3 },
    uCol: { value: CHAPTERS.map((g) => new Color(g.color).lerp(new Color('#ffffff'), 0.35)) } },
  vertexShader: `attribute float aU; attribute float aR; attribute float aPh; attribute float aSp;
    uniform float uTime, uRot, uVis, uScale, uPR, uFade, uK; uniform vec3 uCol[5]; varying vec3 vC; varying float vA;
    void main(){
      float u = fract(aU + uTime * aSp); float k = u * uK; float a = k * 0.6 + uRot;
      float R = 1550.0 - k * 22.0 + aR * cos(aPh + uTime * 0.6);
      vec3 p = vec3(cos(a) * R, k * 340.0 + aR * 0.6 * sin(aPh + uTime * 0.6), sin(a) * R);
      vec4 mv = modelViewMatrix * vec4(p, 1.0); float d = -mv.z;
      gl_PointSize = clamp(10.0 * uScale / max(d, 1.0), 1.0, 7.0) * uPR; gl_Position = projectionMatrix * mv;
      int ci = int(clamp(u * 5.0, 0.0, 4.0)); vC = uCol[ci];
      vA = uVis * uFade * smoothstep(80.0, 500.0, d) * smoothstep(0.0, 0.04, u) * (1.0 - smoothstep(0.96, 1.0, u)) * (0.6 + 0.4 * sin(uTime * 2.0 + aPh * 9.0));
    }`,
  fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0; if (r > 1.0) discard; gl_FragColor = vec4(vC * exp(-r * r * 4.0) * vA, 1.0); }`,
  transparent: true, depthWrite: false, blending: AdditiveBlending,
});
{
  const g = new BufferGeometry(), f = (fn) => new Float32BufferAttribute(Float32Array.from({ length: ST_N }, fn), 1);
  g.setAttribute('position', new Float32BufferAttribute(new Float32Array(ST_N * 3), 3));
  g.setAttribute('aU', f(() => Math.random())); g.setAttribute('aR', f(() => rnd(-480, 480) * Math.random()));
  g.setAttribute('aPh', f(() => rnd(0, 6.28))); g.setAttribute('aSp', f(() => rnd(0.004, 0.011)));
  const st = new Points(g, stMat); st.frustumCulled = false; scene.add(st);
}
let stRot = 0, ovK = 0;
const clouds = [];
for (let i = 0; i < (lowPower ? 18 : 34); i++) {
  const y = Math.random() * (PN * 340 + 800) - 300, a = Math.random() * Math.PI * 2, r = 1800 + Math.random() * 2600;
  const gi = Math.min(4, Math.max(0, Math.floor((y / (PN * 340)) * 5)));
  const col = new Color(Math.random() < 0.5 ? CHAPTERS[gi].color : CHAPTERS[gi].color2).lerp(new Color('#6a55ff'), 0.25);
  const m = new SpriteMaterial({ map: CLOUD_TEX[i % 3], color: col, blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.0 });
  const sp = new Sprite(m); const sz = 2600 + Math.random() * 3800; sp.scale.set(sz * 1.4, sz, 1);
  sp.position.set(Math.cos(a) * r, y, Math.sin(a) * r); scene.add(sp);
  clouds.push({ sp, a, r, y, base: 0.10 + Math.random() * 0.12, spin: (Math.random() - 0.5) * 0.02, ph: Math.random() * 6 });
}

// ───────────── Процедурные текстуры ─────────────
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; }
const GLOW = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
const FEATHER = canvasTex(128, 512, (g) => {
  const sx = (y) => 64 + Math.sin((y / 512) * Math.PI) * 9 - 4;
  for (let y = 26; y < 448; y += 2.2) {
    const k = (y - 26) / 422, prof = Math.sin(Math.pow(k, 0.85) * Math.PI) * 50 + 6 * k;
    [-1, 1].forEach((s) => {
      if (Math.random() < 0.025) return;
      const x0 = sx(y), len = prof * rnd(0.9, 1.05);
      g.strokeStyle = `rgba(255,255,255,${0.28 + 0.3 * Math.random()})`; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(x0, y); g.quadraticCurveTo(x0 + s * len * 0.5, y - 14, x0 + s * len, y - 30 - k * 10); g.stroke();
    });
  }
  for (let i = 0; i < 70; i++) { const y = rnd(400, 470), x0 = sx(y); g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x0, y); g.quadraticCurveTo(x0 + rnd(-30, 30), y - rnd(0, 20), x0 + rnd(-40, 40), y - rnd(-10, 30)); g.stroke(); }
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(sx(500), 500); for (let y = 500; y >= 14; y -= 8) g.lineTo(sx(y), y); g.stroke();
});
const PETAL = canvasTex(96, 128, (g) => {
  g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 3; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(48, 122); g.bezierCurveTo(4, 92, 10, 30, 48, 6); g.bezierCurveTo(86, 30, 92, 92, 48, 122); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.08)'; g.fill(); g.lineWidth = 1.6; g.beginPath(); g.moveTo(48, 118); g.quadraticCurveTo(44, 64, 50, 18); g.stroke();
});
const FLUFF = canvasTex(64, 64, (g) => { // пушинка: тонкие лучики от центра
  g.translate(32, 32);
  for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2 + rnd(-0.1, 0.1), l = rnd(18, 30); g.strokeStyle = `rgba(255,255,255,${rnd(0.25, 0.6)})`; g.lineWidth = 0.9; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * l, Math.sin(a) * l); g.stroke(); }
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 8); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(-8, -8, 16, 16);
});
const FLAME = canvasTex(64, 128, (g) => {
  g.translate(32, 92); g.scale(1, 2.3);
  const gr = g.createRadialGradient(0, -6, 0, 0, 0, 30);
  gr.addColorStop(0, 'rgba(255,240,215,.9)'); gr.addColorStop(0.25, 'rgba(255,205,140,.75)'); gr.addColorStop(0.55, 'rgba(230,120,50,.45)'); gr.addColorStop(1, 'rgba(200,70,20,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 30, 0, Math.PI * 2); g.fill();
});
const WAX = canvasTex(64, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#d9c49e'); gr.addColorStop(0.12, '#b89a72'); gr.addColorStop(1, '#3d2b20');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 7; i++) { const x = rnd(0, w), l = rnd(20, 90); g.fillStyle = 'rgba(230,210,175,.35)'; g.fillRect(x, 0, rnd(3, 6), l); g.beginPath(); g.arc(x + 2.5, l, 3.5, 0, 7); g.fill(); }
});

// ───────────── Ветер с порывами ─────────────
const wind = new Vector3(); let gust = 0;
function updateWind(T) {
  // спокойный фон + редкие мягкие порывы (сумма медленных волн, обрезанная снизу)
  const g1 = Math.max(0, Math.sin(T * 0.21) * Math.sin(T * 0.13 + 1.7)), g2 = Math.max(0, Math.sin(T * 0.37 + 0.4)) ** 3;
  gust = Math.min(1, g1 * 1.4 + g2 * 0.8);
  const a = T * 0.05 + Math.sin(T * 0.11) * 1.2;
  wind.set(Math.cos(a), 0.25 * Math.sin(T * 0.3), Math.sin(a)).multiplyScalar(18 + gust * 150);
}

// ───────────── Перья и лепестки (плоскости, кружатся) ─────────────
const fallers = [];
function addFaller(tex, w, h, n, tint, opacity, rMin, rMax, fall) {
  const geo = new PlaneGeometry(w, h);
  for (let i = 0; i < n; i++) {
    const m = new Mesh(geo, new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: DoubleSide, color: tint, opacity, blending: AdditiveBlending }));
    const home = nearPath(new Vector3(), rMin, rMax);
    m.rotation.set(rnd(0, 6), rnd(0, 6), rnd(0, 6)); m.scale.setScalar(rnd(0.7, 1.3)); scene.add(m);
    fallers.push({ op0: opacity, m, home, y0: home.y, off: new Vector3(), v: new Vector3(), fall: rnd(fall * 0.6, fall * 1.4), resp: rnd(0.5, 1.2), ph: rnd(0, 6), spin: new Vector3(rnd(-0.6, 0.6), rnd(-0.8, 0.8), rnd(-0.5, 0.5)) });
  }
}
addFaller(FEATHER, 46, 184, lowPower ? 20 : 40, new Color('#fff3ea'), 0.9, 240, 1300, 16);
addFaller(PETAL, 26, 34, lowPower ? 30 : 60, new Color('#ffd2e6'), 0.8, 160, 1200, 22);

// Пух: много мелких пушинок одним объектом Points (дёшево)
const FL_N = lowPower ? 450 : 1100;
const flPos = new Float32Array(FL_N * 3), flHome = new Float32Array(FL_N * 3), flOff = new Float32Array(FL_N * 3), flVel = new Float32Array(FL_N * 3), flResp = new Float32Array(FL_N);
{
  const v = new Vector3(), size = new Float32Array(FL_N), ph = new Float32Array(FL_N);
  for (let i = 0; i < FL_N; i++) { nearPath(v, 120, 1400); flHome.set([v.x, v.y, v.z], i * 3); flPos.set([v.x, v.y, v.z], i * 3); size[i] = rnd(10, 26); ph[i] = rnd(0, 6); flResp[i] = rnd(0.6, 1.6); }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(flPos, 3)); // без копии — позиции обновляются каждый кадр g.setAttribute('aSize', new Float32BufferAttribute(size, 1)); g.setAttribute('aPhase', new Float32BufferAttribute(ph, 1));
  var fluffMat = new ShaderMaterial({
    uniforms: { uMap: { value: FLUFF }, uScale: { value: 800 }, uPR: { value: dpr }, uTime: { value: 0 }, uFade: { value: 1 } },
    vertexShader: `attribute float aSize; attribute float aPhase; uniform float uScale, uPR, uTime; varying float vA; varying float vRot;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = -mv.z;
        gl_PointSize = clamp(aSize * uScale / max(d, 1.0), 1.0, 48.0) * uPR; gl_Position = projectionMatrix * mv;
        vA = smoothstep(30.0, 220.0, d) * (1.0 - smoothstep(2600.0, 4200.0, d)) * (0.55 + 0.45 * sin(uTime * 0.8 + aPhase * 5.0)); vRot = aPhase + uTime * 0.3; }`,
    fragmentShader: `uniform sampler2D uMap; uniform float uFade; varying float vA; varying float vRot;
      void main(){ vec2 c = gl_PointCoord - 0.5; float s = sin(vRot), co = cos(vRot); c = mat2(co, -s, s, co) * c;
        vec4 t = texture2D(uMap, c + 0.5); gl_FragColor = vec4(vec3(1.0, 0.97, 0.92) * t.a * vA * 0.75 * uFade, 1.0); }`,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  });
  var fluff = new Points(g, fluffMat); fluff.frustumCulled = false; scene.add(fluff);
}

// ───────────── Свечи (приглушённые) ─────────────
const candles = [];
const waxGeo = new CylinderGeometry(18, 20, 1, 16, 1);
const waxMat = new MeshBasicMaterial({ map: WAX, color: '#b5a08a' });
function addCandle(pos, h) {
  const g = new Group(); g.position.copy(pos);
  const body = new Mesh(waxGeo, waxMat); body.scale.y = h; body.position.y = -h / 2; g.add(body);
  const flame = new Sprite(new SpriteMaterial({ map: FLAME, blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
  flame.scale.set(18, 38, 1); flame.position.y = 16; g.add(flame);
  const halo = new Sprite(new SpriteMaterial({ map: GLOW, color: '#ff9440', blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.14 }));
  halo.scale.setScalar(300); halo.position.y = 14; g.add(halo);
  scene.add(g); candles.push({ g, flame, halo, ph: rnd(0, 6), y0: pos.y });
}
STOPS.forEach((s, i) => {
  addCandle(s.base.clone().addScaledVector(s.N, -s.side * rnd(140, 260)).addScaledVector(UP, -rnd(240, 340)).addScaledVector(s.T, rnd(-60, 120)), rnd(70, 150));
  if (!lowPower && i % 3 === 0) addCandle(nearPath(new Vector3(), 500, 1100, s.t + rnd(-0.01, 0.01)), rnd(60, 120));
});

// ───────────── Листы-пергамент ─────────────
const measure = document.createElement('div'); measure.id = 'measure'; document.body.appendChild(measure);
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
function deckle(el) { // неровный «рваный» край пергамента
  const pts = [], n = 16, j = () => rnd(0, 0.9).toFixed(2);
  for (let i = 0; i <= n; i++) pts.push(`${((i / n) * 100).toFixed(1)}% ${j()}%`);
  for (let i = 1; i <= n; i++) pts.push(`${(100 - +j()).toFixed(2)}% ${((i / n) * 100).toFixed(1)}%`);
  for (let i = n - 1; i >= 0; i--) pts.push(`${((i / n) * 100).toFixed(1)}% ${(100 - +j()).toFixed(2)}%`);
  for (let i = n - 1; i >= 1; i--) pts.push(`${j()}% ${((i / n) * 100).toFixed(1)}%`);
  el.style.clipPath = `polygon(${pts.join(',')})`;
  el.style.setProperty('--tilt', rnd(-0.6, 0.6).toFixed(2) + 'deg');
}
function sheetEl(part, lang, g, poem, isLast) {
  const el = document.createElement('article');
  el.className = 'sheet sheet-' + lang; el.lang = lang; el.style.setProperty('--c', g.color);
  const tag = lang === 'fr' ? 'Original · FR' : poem.fr ? 'Перевод · RU' : 'RU';
  const photo = isLast && PHOTO[poem.id] ? `<img class="photo" src="${PHOTO[poem.id]}" alt="" width="210" height="210">` : '';
  const rose = isLast && poem.id === 'fleur' ? '<img class="rose-small" src="img/ink-roses_small.webp" alt="" width="96" height="118">' : '';
  el.innerHTML = photo + `<div class="tag">${tag}</div><h3>${esc(part.title)}</h3><div class="verse">${part.lines.map((l) => (l === '' ? '<p class="gap"></p>' : `<p>${esc(l)}</p>`)).join('')}</div>`
    + (part.sign ? `<div class="sign">${esc(part.sign)}</div>` : '')
    + (isLast && poem.note ? `<div class="note"><span>Заметка автора</span>${esc(poem.note)}</div>` : '') + rose;
  deckle(el);
  return el;
}
let narrow = innerWidth / innerHeight < 0.95 || innerWidth < 760;
function layoutStop(s) {
  const { objs, sizes } = s;
  if (objs.length === 1) { objs[0].position.set(0, 0, 0); return; }
  const [a, b] = sizes;
  if (!narrow) { const H = Math.max(a.h, b.h); objs[0].position.set(-(a.w / 2 + GAP / 2), (H - a.h) / 2, 0); objs[1].position.set(b.w / 2 + GAP / 2, (H - b.h) / 2, 0); }
  else { objs[0].position.set(0, (b.h + GAP) / 2, 0); objs[1].position.set(0, -(a.h + GAP) / 2, 0); }
}
function measureStop(s) {
  if (!s.clones) return;
  s.clones.forEach((c, i) => { measure.appendChild(c); if (c.offsetHeight > 0) s.sizes[i] = { w: c.offsetWidth * SHEET_SCALE, h: c.offsetHeight * SHEET_SCALE }; c.remove(); });
  layoutStop(s);
}
function stopBox(s, k) {
  const { objs, sizes } = s;
  if (objs.length === 1) return { w: sizes[0].w, h: sizes[0].h, off: new Vector3() };
  if (!narrow) return { w: sizes[0].w + sizes[1].w + GAP, h: Math.max(sizes[0].h, sizes[1].h), off: new Vector3() };
  return { w: sizes[k].w, h: sizes[k].h, off: objs[k].position.clone() };
}
const pickables = [];
const sketches = [];
function addSketch(src, pos, size, color, opacity) {
  const spr = new Sprite(new SpriteMaterial({ color, blending: AdditiveBlending, transparent: true, depthWrite: false, opacity }));
  spr.visible = false; spr.position.copy(pos); spr.scale.set(size, size, 1); scene.add(spr);
  new TextureLoader().load(src, (t) => { t.colorSpace = SRGBColorSpace; spr.material.map = t; spr.material.needsUpdate = true; spr.scale.set(size * (t.image.width / t.image.height), size, 1); spr.visible = true; });
  sketches.push({ spr, base: opacity, ph: rnd(0, 6) });
  return spr;
}
function buildSheets() {
  STOPS.forEach((s, si) => {
    const g = CHAPTERS[s.gi], els = []; s.base0 = s.base.clone();
    if (s.type === 'poem') { const p = s.poem; if (p.fr) els.push(sheetEl(p.fr, 'fr', g, p, !p.ru)); if (p.ru) els.push(sheetEl(p.ru, 'ru', g, p, true)); }
    else {
      const el = document.createElement('article'); el.className = 'sheet sheet-after'; el.style.setProperty('--c', g.color);
      el.innerHTML = `<div class="tag">Послесловие</div><h3>${AFTERWORD.title}</h3>` + AFTERWORD.paragraphs.map((t, i) => `<p class="${i === 3 ? 'quote' : ''}">${esc(t)}</p>`).join('');
      if (s.type === 'ded') { el.className = 'sheet sheet-ded'; el.innerHTML = `<p class="ded">${esc(BOOK.dedication)}</p><img class="rose-small" src="img/ink-roses_small.webp" alt="" width="96" height="118">`; }
      deckle(el); els.push(el);
    }
    els.forEach((el) => measure.appendChild(el));
    s.sizes = els.map((el) => ({ w: el.offsetWidth * SHEET_SCALE, h: el.offsetHeight * SHEET_SCALE }));
    s.clones = els.map((el) => el.cloneNode(true));
    const group = new Group(); group.position.copy(s.base);
    s.objs = els.map((el, k) => { el.dataset.stop = si; el.dataset.k = k; const o = new CSS3DObject(el); o.scale.setScalar(SHEET_SCALE); group.add(o); return o; });
    s.els = els; s.group = group; scene.add(group); layoutStop(s);
    // тёплое свечение за листом и огонёк для карты
    const mark = new Sprite(new SpriteMaterial({ map: GLOW, color: new Color('#ffd9a0').lerp(new Color(g.color), 0.3), blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 }));
    mark.scale.setScalar(520); mark.position.copy(s.base); mark.userData.si = si; scene.add(mark); s.mark = mark; pickables.push(mark);
    // эскизы вокруг: собственный рисунок стиха и эскиз его фотографии, у остальных — мотив из сборника
    const tint = new Color('#ffe6c4').lerp(new Color(g.color), 0.3);
    const own = [];
    if (s.type === 'poem' && s.poem.ink) own.push(INK[s.poem.ink]);
    if (s.type === 'poem' && SKETCH[s.poem.id]) own.push(SKETCH[s.poem.id]);
    if (s.type !== 'poem') own.push(INK.roses_small);
    const list = own.length ? own : [SKETCH_POOL[si % SKETCH_POOL.length]];
    list.forEach((src, k) => {
      const pos = s.base.clone().addScaledVector(s.N, -s.side * LAT * (2.6 + k * 0.9)).addScaledVector(s.T, 240 + k * 220).addScaledVector(UP, 60 + k * 260 - 120);
      addSketch(src, pos, own.length ? 600 - k * 80 : 440, tint, own.length ? 0.55 : 0.28);
    });
  });
  CHAPTERS.forEach((g, gi) => {
    const first = STOPS.findIndex((s) => s.gi === gi), t = stopT(first) - 0.8 / (ctrlPts.length - 1);
    const el = document.createElement('div'); el.className = 'chapter-card'; el.style.setProperty('--c', g.color);
    el.innerHTML = `<div class="n">${['I', 'II', 'III', 'IV', 'V'][gi]}</div><div class="t">${esc(g.name)}</div><div class="s">${esc(g.sub)}</div>`;
    const o = new CSS3DObject(el); o.position.copy(path.getPoint(t)).addScaledVector(UP, 260); o.scale.setScalar(1.25);
    scene.add(o); chapterCards.push({ o, el, gi });
  });
}
const chapterCards = [];

// ───────────── Летающие слова ─────────────
const WORDS = ['fleur', 'mille ans', 'coup de foudre', 'люблю', 'дежавю', 'je veux', 'Севан', 'изумруды', 'rivière', 'эхо', 'tu es loin', 'le ciel',
  'étoiles', 'скучаю', 'пепел', 'волна', 'шипы', 'розы', 'мечи', 'прощание', 'l’espoir', 'printemps', 'весна', 'карнавал', 'l’amour', 'éternel', 'вечность', 'свобода души'];
const floaters = [];
function buildWords() {
  WORDS.forEach((w, i) => {
    const t = Math.min(0.97, Math.max(0.03, (i + 0.5) / WORDS.length));
    const tex = canvasTex(10, 10, () => {}), c = tex.image, g = c.getContext('2d'), fs = 56, font = `italic ${fs}px Georgia, Gelasio, "PT Serif", serif`;
    g.font = font; c.width = Math.ceil(g.measureText(w).width) + 30; c.height = fs * 1.5;
    g.font = font; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 10; g.fillText(w, 15, c.height / 2); tex.needsUpdate = true;
    const s = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0, color: new Color('#ffe9cf') }));
    const h = rnd(40, 66); s.scale.set((h * c.width) / c.height, h, 1);
    const p = nearPath(new Vector3(), 380, 1100, t); s.position.copy(p); scene.add(s);
    floaters.push({ s, p0: p.clone(), ph: rnd(0, 6), max: rnd(0.3, 0.6) });
  });
}

// ───────────── Метеоры ─────────────
const meteors = [];
for (let i = 0; i < 3; i++) {
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(6), 3));
  geo.setAttribute('color', new Float32BufferAttribute(new Float32Array([1, 1, 1, 0, 0, 0]), 3));
  const line = new Line(geo, new LineBasicMaterial({ vertexColors: true, blending: AdditiveBlending, transparent: true, depthWrite: false }));
  const head = new Sprite(new SpriteMaterial({ map: GLOW, blending: AdditiveBlending, depthWrite: false, transparent: true }));
  line.visible = head.visible = false; line.frustumCulled = false; scene.add(line, head);
  meteors.push({ line, head, life: 0, max: 1, p: new Vector3(), v: new Vector3(), tail: new Vector3() });
}
let nextMeteor = 3;
const _r = new Vector3(), _u = new Vector3(), _f = new Vector3();
function spawnMeteor() {
  const m = meteors.find((x) => x.life <= 0); if (!m) return;
  _r.setFromMatrixColumn(camera.matrixWorld, 0); _u.setFromMatrixColumn(camera.matrixWorld, 1); camera.getWorldDirection(_f);
  const d = 1600;
  m.p.copy(camera.position).addScaledVector(_f, d).addScaledVector(_r, rnd(-0.3, 1.2) * d * 0.8).addScaledVector(_u, rnd(0.3, 0.8) * d * 0.6);
  m.v.copy(_r).multiplyScalar(-rnd(0.6, 1.2)).addScaledVector(_u, -rnd(0.3, 0.7)).normalize().multiplyScalar(d * rnd(1, 1.6));
  m.life = m.max = rnd(0.7, 1.2); m.line.visible = m.head.visible = true; m.head.scale.setScalar(50);
}

// ───────────── Перелёты: плавная кривая + плавный поворот ─────────────
let flight = null;
const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);            // нулевые скорость и ускорение на концах
const easeOut = (t) => 1 - Math.pow(1 - t, 3) * (1 + 0 * t);
const camVel = new Vector3(), lastCamPos = new Vector3();
function viewOf(s, k) {
  const box = stopBox(s, k), tv = Math.tan(MathUtils.degToRad(camera.fov) / 2);
  // интерфейс при чтении спрятан — оставляем небольшие поля
  const availH = Math.max(0.6, (innerHeight - (narrow ? 70 : 60)) / innerHeight), availW = 0.92;
  const minDist = (innerHeight / 2) * SHEET_SCALE / (tv * (narrow ? 1.05 : 1.15));
  const fitDist = Math.max((box.h / availH) / 2 / tv, (box.w / availW) / 2 / (tv * camera.aspect), minDist);
  // длинный стих не сжимаем в мелкий шрифт: читаем крупно и прокручиваем
  const readScale = narrow ? 0.92 : Math.min(1, Math.max(0.82, innerHeight / 900));
  const readDist = Math.max((innerHeight / 2) * SHEET_SCALE / (tv * readScale), (box.w / availW) / 2 / (tv * camera.aspect));
  const dist = Math.min(fitDist, Math.max(readDist, minDist));
  const visH = 2 * dist * tv * availH, range = Math.max(0, (box.h - visH) / 2 + 12);
  const look = new PerspectiveCamera(); // у камеры взгляд вдоль −Z
  let target = s.base.clone().add(box.off);
  for (let i = 0; i < 3; i++) { look.position.copy(target).addScaledVector(s.D, -dist); look.lookAt(target); target = s.base.clone().add(box.off.clone().applyQuaternion(look.quaternion)); }
  const upV = UP.clone().applyQuaternion(look.quaternion);
  target.addScaledVector(upV, -4 * (2 * dist * tv) / innerHeight);
  const pos0 = target.clone().addScaledVector(s.D, -dist), target0 = target.clone();
  look.position.copy(pos0); look.lookAt(target0);
  // старт с начала стиха
  const pos = pos0.clone().addScaledVector(upV, range), tgt = target0.clone().addScaledVector(upV, range);
  return { pos, target: tgt, pos0, target0, upV, range, dist, dir: s.D.clone(), quat: look.quaternion.clone(), wpp: (2 * dist * tv) / innerHeight };
}
function flyTo(view, dur, done, arc = 0) {
  const p0 = camera.position.clone(), q0 = camera.quaternion.clone(), L = p0.distanceTo(view.pos);
  const moving = flight && camVel.lengthSq() > 1;
  const fwd = new Vector3(0, 0, -1).applyQuaternion(q0);
  // если летим — продолжаем текущую скорость, чтобы не было рывка
  const c1 = moving ? p0.clone().addScaledVector(camVel, dur / 3) : p0.clone().addScaledVector(fwd, L * 0.35);
  c1.addScaledVector(UP, arc * L);
  const c2 = view.pos.clone().addScaledVector(view.dir, -L * 0.35).addScaledVector(UP, arc * L);
  flight = { curve: new CubicBezierCurve3(p0, c1, c2, view.pos.clone()), q0, q1: view.quat, d0: p0.distanceTo(controls.target), d1: view.dist, t: 0, dur: reduceMotion ? 0.01 : dur, ease: moving ? easeOut : smoother, done };
  controls.enabled = false; controls.autoRotate = false;
  if (L > 400) audio.whoosh(Math.min(dur, 2.6));
}
const _q = new Quaternion(), _fw = new Vector3();
function updateFlight(dt) {
  if (!flight) return;
  flight.t = Math.min(1, flight.t + dt / flight.dur);
  const k = flight.ease(flight.t);
  flight.curve.getPoint(k, camera.position);
  // поворот слегка опережает движение — взгляд «ведёт» камеру
  _q.copy(flight.q0).slerp(flight.q1, smoother(Math.min(1, flight.t * 1.12)));
  camera.quaternion.copy(_q);
  _fw.set(0, 0, -1).applyQuaternion(_q);
  controls.target.copy(camera.position).addScaledVector(_fw, MathUtils.lerp(flight.d0, flight.d1, k));
  if (flight.t >= 1) { const d = flight.done; flight = null; d && d(); }
}

// ───────────── Навигация ─────────────
let current = -1, langK = 0, mode = 'intro', lastNavAt = 0;
function focusStop(si, k = null, opts = {}) {
  si = Math.max(0, Math.min(NS - 1, si));
  const s = STOPS[si];
  measureStop(s);
  if (si >= NS - 2 && !finaleOn) setTimeout(() => { try { prepareBurnables(); } catch (e) { /* подготовим в момент финала */ } }, 3200);
  if (k !== null) langK = k; else if (si !== current) langK = 0;
  if (langK >= s.objs.length) langK = 0;
  const jump = current < 0 ? 0 : Math.abs(si - current);
  current = si; mode = 'poem'; lastNavAt = performance.now();
  if (!poemHintShown) { poemHintShown = true; setTimeout(() => { if (mode === 'poem') $('#hint').classList.add('show'); }, 3500); setTimeout(() => $('#hint').classList.remove('show'), 12000); }
  const dur = opts.dur ?? (jump > 1 ? Math.min(4.6, 2.4 + jump * 0.14) : opts.quick ? 1.3 : 2.9);
  const v = viewOf(s, langK);
  if (jump > 0 || k !== null) audio.pageTurn();
  rest = null; flyTo(v, dur, () => { rest = v; restAt = now; scrollPos = scrollTarget = v.range; }, jump > 1 ? 0.1 : 0.02);
  history.replaceState(null, '', '#' + idOf(s));
  updateHud();
}
let rest = null, restAt = 0, scrollPos = 0, scrollTarget = 0;
const next = () => { if (finaleOn) return; if (current === NS - 1) finale(); else focusStop(current < 0 ? 0 : current + 1); };
const prev = () => focusStop(current < 0 ? 0 : current - 1);
function overviewView() {
  const tv = Math.tan(MathUtils.degToRad(camera.fov) / 2), H = ctrlPts[ctrlPts.length - 1].y + 1400, W = 3600;
  const dist = Math.max((H / 2) / tv, (W / 2) / (tv * camera.aspect)) * 1.12 + 1600;
  const dir = new Vector3(0.35, 0.22, 1).normalize();
  // на узком экране снизу лежит панель карты — приподнимаем вихрь, чтобы низ спирали был виден
  const target = AXIS.clone().addScaledVector(UP, narrow ? -H * 0.2 : 0), pos = target.clone().addScaledVector(dir, dist * (narrow ? 1.12 : 1));
  const look = new PerspectiveCamera(); look.position.copy(pos); look.lookAt(target); // у камеры взгляд вдоль −Z
  return { pos, target, dist, dir: dir.clone().negate(), quat: look.quaternion.clone() };
}
function overview(dur = 3.4) {
  mode = 'overview'; rest = null;
  flyTo(overviewView(), dur, () => { controls.enabled = true; controls.autoRotate = !reduceMotion; controls.autoRotateSpeed = 1.15; mapActAt = -1e9; });
  $('#hint').classList.remove('show'); $('#map-panel').classList.remove('used');
  history.replaceState(null, '', location.pathname + location.search);
  updateHud();
}

// ───────────── HUD ─────────────
function firstLine(p) { return ((p.ru || p.fr).lines[0] || '').replace(/[,.;:—–-]+$/, '') + '…'; }
function titleOf(s) {
  if (s.type === 'after') return 'Послесловие';
  if (s.type === 'ded') return 'Посвящение';
  const t = [s.poem.fr?.title, s.poem.ru?.title].filter((x) => x && x !== '***').filter((v, i, a) => a.indexOf(v) === i).join(' / ');
  return t || firstLine(s.poem);
}
function updateHud() {
  const nav = $('#nav');
  if (current >= 0 && mode === 'poem') {
    const s = STOPS[current], g = CHAPTERS[s.gi];
    $('#now-gal').textContent = g.name; $('#now-title').textContent = titleOf(s); $('#now-count').textContent = `${current + 1} / ${NS}`;
    nav.style.setProperty('--c', g.color);
    $('#btn-lang').hidden = !(narrow && s.objs.length > 1);
    if (!$('#btn-lang').hidden) $('#btn-lang').textContent = langK === 0 ? 'Перевод →' : '← Оригинал';
    $('#prev').disabled = current === 0; $('#next').disabled = false;
    $('#next').classList.toggle('finish', current === NS - 1); $('#next').setAttribute('aria-label', current === NS - 1 ? 'Завершить' : 'Следующий стих');
    audio.setScene(g.id, idOf(s));
  } else {
    $('#now-gal').textContent = 'Toi et Moi'; $('#now-title').textContent = 'карта пути'; $('#now-count').textContent = '';
    nav.style.setProperty('--c', '#ffd9a8'); $('#btn-lang').hidden = true; $('#prev').disabled = false; $('#next').disabled = false;
    $('#next').classList.remove('finish'); $('#next').setAttribute('aria-label', 'Следующий стих');
    if (!finaleOn) audio.setScene('space');
  }
  $('#btn-map').classList.toggle('on', mode === 'overview');
  // панель карты: «Начать с начала», «Вернуться к стиху» и подсказка, что по полю можно свободно летать
  const mp = $('#map-panel'), onMap = mode === 'overview' && !finaleOn;
  mp.classList.toggle('show', onMap);
  if (onMap) { const back = $('#mp-back'); back.hidden = current < 0; if (current >= 0) back.textContent = `← Вернуться к стиху ${current + 1}`; }
  document.querySelectorAll('.toc-item').forEach((el) => el.classList.toggle('active', +el.dataset.stop === current));
}
function buildToc() {
  const list = $('#toc-list');
  CHAPTERS.forEach((g, gi) => {
    const h = document.createElement('div'); h.className = 'toc-gal'; h.style.setProperty('--c', g.color);
    h.innerHTML = `<div class="toc-gal-h"><span class="dot"></span>${['I', 'II', 'III', 'IV', 'V'][gi]}. ${esc(g.name)}<small>${esc(g.sub)}</small></div>`;
    list.appendChild(h);
    STOPS.forEach((s, si) => {
      if (s.gi !== gi) return;
      const b = document.createElement('button'); b.className = 'toc-item'; b.dataset.stop = si; b.style.setProperty('--c', g.color);
      if (s.type === 'poem') {
        const p = s.poem, fr = p.fr && p.fr.title !== '***' ? p.fr.title : '', ru = p.ru && p.ru.title !== '***' ? p.ru.title : '';
        const main = ru || fr || firstLine(p), sub = fr && ru && fr !== ru ? fr : p.fr && p.ru ? 'FR + RU' : p.fr ? 'FR' : 'RU';
        b.innerHTML = `<span class="num">${si + 1}</span><span>${esc(main)}</span><small>${esc(sub)}</small>`;
        b.dataset.search = [p.fr?.title, p.ru?.title, ...(p.fr?.lines || []), ...(p.ru?.lines || []), p.fr?.sign, p.ru?.sign].filter(Boolean).join('\n');
      } else if (s.type === 'after') { b.innerHTML = `<span class="num">${si + 1}</span><span>Послесловие</span><small>L’amour, c’est la liberté de l’âme</small>`; b.dataset.search = AFTERWORD.paragraphs.join('\n'); }
      else { b.innerHTML = `<span class="num">${si + 1}</span><span>Посвящение</span><small>${esc(BOOK.dedication)}</small>`; b.dataset.search = BOOK.dedication; }
      b.onclick = () => { closeToc(); focusStop(si); };
      list.appendChild(b);
    });
  });
  const input = $('#toc-search');
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase(); let any = false;
    document.querySelectorAll('.toc-item').forEach((b) => {
      const hit = !q || b.dataset.search.toLowerCase().includes(q); b.hidden = !hit; any ||= hit;
      b.querySelector('.snip')?.remove();
      if (q && hit) {
        const line = b.dataset.search.split('\n').find((l) => l.toLowerCase().includes(q));
        if (line) { const i = line.toLowerCase().indexOf(q), em = document.createElement('em'); em.className = 'snip'; em.innerHTML = esc(line.slice(0, i)) + '<mark>' + esc(line.slice(i, i + q.length)) + '</mark>' + esc(line.slice(i + q.length)); b.appendChild(em); }
      }
    });
    document.querySelectorAll('.toc-gal').forEach((h) => { h.hidden = !!q; });
    $('#toc-empty').hidden = any;
  });
}
const openToc = () => { $('#toc').classList.add('open'); $('#toc').setAttribute('aria-hidden', 'false'); setTimeout(() => !isTouch && $('#toc-search').focus(), 250); };
const closeToc = () => { $('#toc').classList.remove('open'); $('#toc').setAttribute('aria-hidden', 'true'); };

// ───────────── Ввод ─────────────
const ndc = new Vector2(9, 9), ray = new Raycaster(); let mouseAct = 0, lastMove = -10, now = 0;
const trail = $('#trail'), tctx = trail.getContext('2d'), sparks = [];
function resizeTrail() { const d = Math.min(devicePixelRatio, 1.5); trail.width = innerWidth * d; trail.height = innerHeight * d; tctx.setTransform(d, 0, 0, d, 0, 0); }
resizeTrail();
let trailColor = '#ffd9a8', hoverEl = null, down = null;
let lastAct = 0;
const poke = () => { lastAct = now; };
addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') poke();
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); lastMove = now;
  if (!reduceMotion && mode !== 'intro' && e.pointerType === 'mouse' && sparks.length < 80) sparks.push({ x: e.clientX, y: e.clientY, vx: rnd(-0.8, 0.8), vy: rnd(-1, 0.4), l: 1, r: rnd(1, 2.6), c: Math.random() < 0.5 ? trailColor : '#fff6e4' });
  const sh = e.target.closest && e.target.closest('.sheet');
  if (sh !== hoverEl) { hoverEl?.classList.remove('hover'); hoverEl = sh; if (sh) { sh.classList.add('hover'); audio.chime(); } }
}, { passive: true });
css.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), sheet: e.target.closest('.sheet'), sc: scrollTarget, dragged: false }; poke(); }, true);
css.domElement.addEventListener('pointermove', (e) => {
  // перетаскивание пальцем/мышью прокручивает длинный стих
  if (!down || mode !== 'poem' || !rest || rest.range <= 0) return;
  const dy = e.clientY - down.y; if (Math.abs(dy) > 8) down.dragged = true;
  scrollTarget = MathUtils.clamp(down.sc + dy * rest.wpp, -rest.range, rest.range);
}, true);
css.domElement.addEventListener('pointerup', (e) => {
  if (!down) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y, moved = Math.hypot(dx, dy), quick = performance.now() - down.t < 700;
  if (mode === 'poem' && moved > 50 && quick) {
    const vertical = Math.abs(dy) > Math.abs(dx), fwd = vertical ? dy < 0 : dx < 0;
    const scrollable = rest && rest.range > 0 && vertical;
    // в длинном стихе свайп сначала листает текст; на краю — переходит к следующему
    if (!scrollable || (fwd && down.sc <= -rest.range + 2) || (!fwd && down.sc >= rest.range - 2)) fwd ? next() : prev();
  }
  else if (moved < 7) {
    if (down.sheet) { const si = +down.sheet.dataset.stop, k = +down.sheet.dataset.k; if (si !== current || (narrow && k !== langK)) focusStop(si, k); }
    else if (mode === 'overview') {
      ray.setFromCamera(new Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
      const hit = ray.intersectObjects(pickables)[0]; if (hit) focusStop(hit.object.userData.si);
    }
  }
  down = null;
}, true);
let wheelAcc = 0;
css.domElement.addEventListener('wheel', (e) => {
  if (mode === 'overview' && controls.enabled) { e.preventDefault(); e.stopImmediatePropagation(); mapWheel(e); return; }
  if (mode !== 'poem') return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (flight && flight.t < 0.45) return;
  const dy = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
  if (rest && rest.range > 0) {
    const room = dy > 0 ? scrollTarget > -rest.range + 1 : scrollTarget < rest.range - 1;
    if (room) { scrollTarget = MathUtils.clamp(scrollTarget - dy * rest.wpp * 0.9, -rest.range, rest.range); lastNavAt = performance.now(); wheelAcc = 0; return; }
  }
  // на краю длинного стиха — короткая пауза, чтобы инерция колеса не перелистывала сама
  const pause = rest && rest.range > 0 ? 1100 : 750;
  wheelAcc += dy;
  if (performance.now() - lastNavAt < pause) { wheelAcc = 0; return; }
  if (Math.abs(wheelAcc) > 60) { wheelAcc > 0 ? next() : prev(); wheelAcc = 0; }
}, { passive: false, capture: true });
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') { if (e.key === 'Escape') closeToc(); return; }
  if (mode === 'intro' || finaleOn) return;
  if (mode === 'overview' && FLY_KEYS[e.code] && !e.ctrlKey && !e.metaKey) { e.preventDefault(); flyKeys.add(e.code); mapTouch(); return; }
  const page = rest ? innerHeight * 0.6 * rest.wpp : 0;
  if (['ArrowDown', 'PageDown', ' '].includes(e.key) && rest && rest.range > 0 && scrollTarget > -rest.range + 1) { e.preventDefault(); scrollTarget = Math.max(-rest.range, scrollTarget - page); }
  else if (['ArrowUp', 'PageUp'].includes(e.key) && rest && rest.range > 0 && scrollTarget < rest.range - 1) { e.preventDefault(); scrollTarget = Math.min(rest.range, scrollTarget + page); }
  else if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); next(); }
  else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); prev(); }
  else if (e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') toggleFs();
  else if (e.key === 'Escape') { $('#toc').classList.contains('open') ? closeToc() : mode === 'overview' ? focusStop(Math.max(0, current)) : overview(); }
  else if (e.key === '/') { e.preventDefault(); openToc(); }
});
addEventListener('keyup', (e) => flyKeys.delete(e.code));
addEventListener('blur', () => flyKeys.clear());

// ───────────── Свободная камера на карте ─────────────
// колесо — полёт к точке под курсором с постоянной «отзывчивостью» (без вязкости у цели);
// WASD — вперёд/влево/назад/вправо, Q/E — вниз/вверх, Shift — быстрее; при любом действии вихрь перестаёт вращать камеру
const FLY_KEYS = { KeyW: [0, 0, -1], KeyS: [0, 0, 1], KeyA: [-1, 0, 0], KeyD: [1, 0, 0], KeyQ: [0, -1, 0], KeyE: [0, 1, 0], ShiftLeft: null, ShiftRight: null };
const flyKeys = new Set(), flyVel = new Vector3(), flyRem = new Vector3(), _fo = new Vector3(), _fd = new Vector3(), _fk = new Vector3();
let mapActAt = 0;
function mapTouch() { mapActAt = now; controls.autoRotate = false; $('#map-panel').classList.add('used'); }
controls.addEventListener('start', mapTouch);
function pivotDist() {
  // опора вращения — ближайший лист впереди (или ось вихря), чтобы рядом с листами вращение было «вокруг них»
  _fd.set(0, 0, -1).applyQuaternion(camera.quaternion); let best = 1e9;
  for (const s of STOPS) { _fk.copy(s.base).sub(camera.position); const z = _fk.dot(_fd); if (z > 80 && _fk.lengthSq() - z * z < (z * 0.45) ** 2) best = Math.min(best, z); }
  if (best === 1e9) best = Math.max(600, camera.position.distanceTo(controls.target));
  return MathUtils.clamp(best, 350, 30000);
}
// расстояние до того, что под курсором: лист на луче, иначе вихрь (цилиндр вокруг оси), иначе ось
function contentDist(o, d) {
  let best = 1e9;
  for (const s of STOPS) { _fk.copy(s.base).sub(o); const z = _fk.dot(d); if (z > 40 && _fk.lengthSq() - z * z < Math.max(300, z * 0.1) ** 2) best = Math.min(best, z); }
  if (best < 1e9) return best;
  const R = 1700, top = ctrlPts[ctrlPts.length - 1].y + 600, a = d.x * d.x + d.z * d.z, b = 2 * (o.x * d.x + o.z * d.z), c = o.x * o.x + o.z * o.z - R * R;
  if (a > 1e-6) { const D = b * b - 4 * a * c; if (D >= 0) { for (const z of [(-b - Math.sqrt(D)) / (2 * a), (-b + Math.sqrt(D)) / (2 * a)]) { const y = o.y + d.y * z; if (z > 40 && y > -600 && y < top) return z; } } }
  return Math.max(400, o.distanceTo(AXIS) * 0.6);
}
function mapWheel(e) {
  mapTouch();
  const dy = (e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY) * (e.ctrlKey ? 2.5 : 1), n = MathUtils.clamp(-dy / 100, -3, 3);
  ray.setFromCamera(new Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  const dir = ray.ray.direction, o = _fo.copy(camera.position).add(flyRem);   // считаем от точки, куда камера уже летит
  // вперёд — шаг от расстояния до цели под курсором (но не меньше 70: у самого листа не вязнет); назад — от удалённости от вихря
  const step = n > 0 ? MathUtils.clamp(contentDist(o, dir) * 0.24, 70, 3200) : MathUtils.clamp(o.distanceTo(AXIS) * 0.2, 200, 4000);
  flyRem.addScaledVector(dir, step * n);
}
function updateMapFly(dt) {
  if (mode !== 'overview' || !controls.enabled) { flyVel.set(0, 0, 0); flyRem.set(0, 0, 0); return; }
  if (flyKeys.size) {
    const fast = flyKeys.has('ShiftLeft') || flyKeys.has('ShiftRight') ? 2.6 : 1, sp = MathUtils.clamp(pivotDist() * 0.9, 400, 5000) * fast;
    for (const c of flyKeys) { const d = FLY_KEYS[c]; if (!d) continue; _fk.set(d[0], d[1], d[2]); if (d[1]) _fk.applyQuaternion(camera.quaternion).set(0, d[1], 0); else _fk.applyQuaternion(camera.quaternion); flyVel.addScaledVector(_fk, sp * dt * 6); }
    mapActAt = now;
  }
  if (flyVel.lengthSq() < 1 && flyRem.lengthSq() < 1) return;
  _fd.copy(flyVel).multiplyScalar(dt); _fk.copy(flyRem).multiplyScalar(1 - Math.exp(-dt * 5)); flyRem.sub(_fk); _fd.add(_fk);
  camera.position.add(_fd); controls.target.add(_fd);
  flyVel.multiplyScalar(Math.exp(-dt * 5));
  // опору вращения подтягиваем к тому, что впереди — вид не меняется, но вращение остаётся «рядом»
  _fd.set(0, 0, -1).applyQuaternion(camera.quaternion); controls.target.copy(camera.position).addScaledVector(_fd, pivotDist());
}
function drawTrail() {
  if (!sparks.length && !trail.dirty) return;
  tctx.clearRect(0, 0, innerWidth, innerHeight); trail.dirty = sparks.length > 0;
  tctx.globalCompositeOperation = 'lighter';
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]; s.x += s.vx + wind.x * 0.004; s.y += s.vy; s.l -= 0.025;
    if (s.l <= 0) { sparks.splice(i, 1); continue; }
    tctx.globalAlpha = s.l * 0.8; tctx.fillStyle = s.c; tctx.beginPath(); tctx.arc(s.x, s.y, s.r * s.l + 0.3, 0, 7); tctx.fill();
  }
  tctx.globalAlpha = 1;
}

// ───────────── Цвет главы ─────────────
const SPACE = { bg: new Color('#0b0620'), c1: new Color('#6a55ff'), c2: new Color('#ff4fc3') };
const CH = CHAPTERS.map((g) => ({ bg: new Color(g.bg), c1: new Color(g.color), c2: new Color(g.color2) }));
const cur = { bg: SPACE.bg.clone(), c1: SPACE.c1.clone(), c2: SPACE.c2.clone() };
function storyColors(dt) {
  let idx = 0, best = 1e12;
  for (const s of STOPS) { const d = camera.position.distanceToSquared(s.base); if (d < best) { best = d; idx = s.si; } }
  const far = mode === 'overview' || best > 3000 * 3000;
  if (finaleOn) return;
  const tgt = far ? SPACE : CH[STOPS[idx].gi], k = 1 - Math.exp(-dt * 1.0);
  cur.bg.lerp(tgt.bg, k); cur.c1.lerp(tgt.c1, k); cur.c2.lerp(tgt.c2, k);
  skyMat.uniforms.uBg.value.copy(cur.bg); skyMat.uniforms.uC1.value.copy(cur.c1).multiplyScalar(0.85); skyMat.uniforms.uC2.value.copy(cur.c2).multiplyScalar(0.75);
  trailColor = '#' + cur.c1.getHexString();
}

// ───────────── Кадр ─────────────
let last = performance.now(), T = 0, ftAvg = 16, dprTimer = 0, hudHidden = false;
const _sw = new Vector3();
const tmp = new Vector3(), camInv = camera.matrixWorldInverse;
const op = new Map();
function setOp(el, val) { if (op.get(el) !== val) { op.set(el, val); el.style.opacity = val; } }
function frame() {
  const t = performance.now(), dtRaw = (t - last) / 1000; last = t; now = t / 1000;
  const dt = Math.min(dtRaw, 0.05); T += dt;
  ftAvg += (dtRaw * 1000 - ftAvg) * 0.05; dprTimer += dt;
  if (dprTimer > 2 && !SHOT && !flight) {
    dprTimer = 0;
    if (ftAvg > 24 && dpr > 0.6) { dpr = Math.max(0.6, dpr - 0.2); renderer.setPixelRatio(dpr); }
    else if (ftAvg < 13 && dpr < DPR_MAX) { dpr = Math.min(DPR_MAX, dpr + 0.1); renderer.setPixelRatio(dpr); }
  }
  lastCamPos.copy(camera.position);
  updateFlight(dt);
  if (mode === 'poem' && !flight && rest && !finaleOn) {
    // камера чуть «дышит» вокруг листа — мир вокруг читателя плавно движется, текст остаётся на месте
    scrollPos += (scrollTarget - scrollPos) * Math.min(1, dt * 7);
    const k = reduceMotion ? 0 : MathUtils.smoothstep(now - restAt, 0, 3), A = rest.dist * 0.03 * k;
    _sw.copy(rest.upV).multiplyScalar(scrollPos - rest.range);
    camera.position.copy(rest.pos).add(_sw);
    _r.setFromMatrixColumn(camera.matrixWorld, 0);
    camera.position.addScaledVector(_r, Math.sin(T * 0.13) * A).addScaledVector(rest.upV, Math.sin(T * 0.09 + 1) * A * 0.5).addScaledVector(rest.dir, Math.sin(T * 0.07) * A * 0.6);
    controls.target.copy(rest.target).add(_sw);
    camera.lookAt(controls.target);
    $('#more').classList.toggle('show', rest.range > 0 && scrollPos > -rest.range + 20);
  } else $('#more').classList.remove('show');
  const hideHud = finaleOn || (mode === 'poem' && (flight || now - lastAct > 2.6)) && !$('#toc').classList.contains('open');
  if (hideHud !== hudHidden) { hudHidden = hideHud; document.body.classList.toggle('hud-hide', hideHud); }
  updateMapFly(dt);
  if (mode === 'overview' && controls.enabled && !reduceMotion && !controls.autoRotate && now - mapActAt > 14 && camera.position.distanceTo(AXIS) > 6000) controls.autoRotate = true;
  if (controls.enabled) controls.update();
  if (dt > 0) camVel.copy(camera.position).sub(lastCamPos).divideScalar(dt);
  camera.updateMatrixWorld();
  storyColors(dt); updateWind(T);
  const focusDist = Math.max(120, camera.position.distanceTo(controls.target));
  ray.setFromCamera(ndc, camera);
  mouseAct += ((now - lastMove < 1.6 ? 1 : 0) - mouseAct) * Math.min(1, dt * 3);
  const scale = (innerHeight / 2) / Math.tan(MathUtils.degToRad(camera.fov) / 2);
  for (const m of starMats) { const u = m.uniforms; u.uTime.value = T; u.uFocus.value = focusDist; u.uScale.value = scale; u.uPR.value = dpr; u.uRayO.value.copy(ray.ray.origin); u.uRayD.value.copy(ray.ray.direction); u.uMouse.value = mouseAct; }
  fluffMat.uniforms.uScale.value = scale; fluffMat.uniforms.uPR.value = dpr; fluffMat.uniforms.uTime.value = T;
  sky.position.copy(camera.position);
  // вихрь: на карте поток и облака закручиваются вокруг оси
  ovK += ((mode === 'overview' ? 1 : 0) - ovK) * Math.min(1, dt * 1.2);
  stRot += dt * (0.015 + ovK * 0.32);
  const su = stMat.uniforms; su.uTime.value = T; su.uRot.value = stRot; su.uVis.value = 0.22 + ovK * 0.9; su.uScale.value = scale; su.uPR.value = dpr;
  for (const c of clouds) {
    c.a += dt * (0.004 + ovK * 0.07); c.sp.position.set(Math.cos(c.a) * c.r, c.y, Math.sin(c.a) * c.r);
    c.sp.material.opacity = c.base * (0.8 + 0.2 * Math.sin(T * 0.1 + c.ph)) * fadeAll * (1 + ovK * 0.4); c.sp.material.rotation += c.spin * dt * (1 + ovK * 4);
  }
  if (finaleOn) updateFinale(dt);

  for (const s of STOPS) {
    if (!s.group) continue;
    const amp = reduceMotion ? 0 : s.si === current ? 0.08 : 1;
    s.group.position.copy(s.base); s.group.position.y += Math.sin(T * 0.45 + s.seed) * 12 * amp; s.group.position.x += Math.sin(T * 0.3 + s.seed * 2) * 8 * amp;
    let tq = camera.quaternion;
    if (finaleOn && s.fq) tq = _tq.copy(camera.quaternion).multiply(s.fq);
    else if (amp > 0.5) { // соседние листы чуть колышутся, как на сквозняке; читаемый лист неподвижен
      const sw = MathUtils.smoothstep(camera.position.distanceTo(s.base), 300, 1400);
      tq = _tq.copy(camera.quaternion).multiply(_qa.setFromAxisAngle(_axZ, Math.sin(T * 0.43 + s.seed) * 0.05 * sw)).multiply(_qb.setFromAxisAngle(_axX, Math.sin(T * 0.51 + s.seed * 1.7) * 0.09 * sw)).multiply(_qc.setFromAxisAngle(UP, Math.sin(T * 0.37 + s.seed * 0.6) * 0.16 * sw));
    }
    s.group.quaternion.slerp(tq, SHOT ? 1 : 1 - Math.exp(-dt * (finaleOn ? 9 : s.si === current ? 8 : 3)));
    tmp.copy(s.group.position).applyMatrix4(camInv);
    const d = -tmp.z, show = d > 90 && d < 3400 && Math.abs(tmp.x) < d * 1.6 + 400;
    for (const o of s.objs) o.visible = show && !s.gone && !finaleOn;
    if (show) {
      const fade = MathUtils.clamp((3400 - d) / 1400, 0, 1) * MathUtils.clamp((d - 90) / 160, 0, 1);
      const rel = Math.abs(d - focusDist) / focusDist;
      const o = (fade * (1 - Math.min(0.5, Math.max(0, rel - 0.2) * 0.55))).toFixed(2);
      for (const el of s.els) setOp(el, o);
    }
    const md = camera.position.distanceTo(s.base);
    s.mark.scale.setScalar(420 * Math.max(1, md / 5500));
    // на карте по огонькам бежит волна света вверх по вихрю
    const wave = 1 + ovK * 0.9 * Math.max(0, Math.sin(T * 2.2 - s.si * 0.45));
    s.mark.material.opacity = Math.min(1, (show ? 0.22 : mode === 'overview' ? 0.6 : 0.45) * (0.8 + 0.2 * Math.sin(T * 1.3 + s.seed)) * wave) * fadeAll;
  }
  for (const k of sketches) { k.spr.material.opacity = k.base * (0.8 + 0.2 * Math.sin(T * 0.6 + k.ph)) * fadeAll; k.spr.material.rotation = Math.sin(T * 0.15 + k.ph) * 0.06; }
  for (const c of chapterCards) {
    tmp.copy(c.o.position).applyMatrix4(camInv);
    const d = -tmp.z; c.o.visible = d > 120 && d < 4200;
    if (c.o.visible) { c.o.quaternion.slerp(camera.quaternion, 1 - Math.exp(-dt * 4)); setOp(c.el, (MathUtils.clamp((4200 - d) / 1500, 0, 1) * MathUtils.clamp((d - 120) / 300, 0, 1) * fadeAll).toFixed(2)); }
  }

  // перья и лепестки: падают, их подхватывают порывы, пружиной возвращаются к своему месту
  const motion = reduceMotion ? 0.15 : 1;
  for (const f of fallers) {
    f.v.x += (wind.x * f.resp - f.off.x * 0.25 - f.v.x * 0.8) * dt;
    f.v.y += (wind.y * f.resp - f.off.y * 0.25 - f.v.y * 0.8) * dt;
    f.v.z += (wind.z * f.resp - f.off.z * 0.25 - f.v.z * 0.8) * dt;
    f.off.addScaledVector(f.v, dt * motion);
    f.home.y -= f.fall * dt * motion; if (f.home.y < f.y0 - 380) f.home.y += 760;
    f.m.position.copy(f.home).add(f.off); f.m.position.x += Math.sin(T * 0.5 + f.ph) * 25;
    const spinK = dt * motion * (1 + gust * 2.5);
    f.m.rotation.x += f.spin.x * spinK; f.m.rotation.y += f.spin.y * spinK; f.m.rotation.z += f.spin.z * spinK;
    f.m.material.opacity = f.op0 * fadeAll;
  }
  // пух: тот же ветер, но легче
  for (let i = 0; i < FL_N; i++) {
    const j = i * 3, r = flResp[i];
    for (let a = 0; a < 3; a++) {
      const w = a === 0 ? wind.x : a === 1 ? wind.y + 8 : wind.z;
      flVel[j + a] += (w * r * 1.3 - flOff[j + a] * 0.12 - flVel[j + a] * 0.7) * dt;
      flOff[j + a] += flVel[j + a] * dt * motion;
      flPos[j + a] = flHome[j + a] + flOff[j + a];
    }
    flPos[j + 1] += Math.sin(T * 0.6 + i) * 6;
  }
  fluff.geometry.attributes.position.needsUpdate = true;
  for (const c of candles) {
    const fl = 1 + Math.sin(T * 9 + c.ph) * 0.05 + Math.sin(T * 21 + c.ph * 3) * 0.04 + gust * 0.06 * Math.sin(T * 30 + c.ph);
    c.flame.scale.set(18 * (2 - fl), 38 * fl, 1); c.flame.material.rotation = Math.sin(T * 2.5 + c.ph) * 0.05 + wind.x * 0.0012;
    c.halo.material.opacity = (0.12 + (fl - 1) * 0.6) * fadeAll; c.flame.material.opacity = 0.8 * fadeAll; c.g.position.y = c.y0 + Math.sin(T * 0.5 + c.ph) * 12 * motion;
    c.g.visible = camera.position.distanceTo(c.g.position) > 420;
  }
  for (const f of floaters) {
    f.s.position.copy(f.p0); f.s.position.y += Math.sin(T * 0.35 + f.ph) * 40 * motion; f.s.position.x += Math.cos(T * 0.25 + f.ph) * 30 * motion;
    const d = camera.position.distanceTo(f.s.position);
    f.s.material.opacity = f.max * MathUtils.smoothstep(d, 120, 400) * (1 - MathUtils.smoothstep(d, 2600, 4200)) * fadeAll;
  }
  nextMeteor -= dt;
  if (nextMeteor <= 0 && mode !== 'intro' && !reduceMotion && !finaleOn) { spawnMeteor(); nextMeteor = rnd(3, 7); }
  for (const m of meteors) {
    if (m.life <= 0) continue;
    m.life -= dt; m.p.addScaledVector(m.v, dt); m.tail.copy(m.p).addScaledVector(m.v, -0.15);
    const pa = m.line.geometry.attributes.position; pa.setXYZ(0, m.p.x, m.p.y, m.p.z); pa.setXYZ(1, m.tail.x, m.tail.y, m.tail.z); pa.needsUpdate = true;
    const a = Math.sin((1 - m.life / m.max) * Math.PI); m.line.material.opacity = a; m.head.material.opacity = a; m.head.position.copy(m.p);
    if (m.life <= 0) m.line.visible = m.head.visible = false;
  }

  if (!finaleDone) { renderer.render(scene, camera); css.render(scene, camera); }
  drawTrail();
  requestAnimationFrame(frame);
}

// ───────────── Запуск ─────────────
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); css.setSize(innerWidth, innerHeight); resizeTrail();
  const was = narrow; narrow = innerWidth / innerHeight < 0.95 || innerWidth < 760;
  if (was !== narrow) STOPS.forEach(layoutStop);
  if (mode === 'poem' && current >= 0) focusStop(current, langK, { dur: 0.6 });
  updateHud();
});
function soundUi() { $('#btn-sound').classList.toggle('on', audio.on); $('#btn-sound').setAttribute('aria-pressed', audio.on); $('#btn-sound .lbl').textContent = audio.on ? 'Звук' : 'Без звука'; }
$('#btn-sound').onclick = () => { if (!audio.ctx) audio.start(); else audio.setOn(!audio.on); soundUi(); updateHud(); };
$('#btn-toc').onclick = () => ($('#toc').classList.contains('open') ? closeToc() : openToc());
$('#toc-close').onclick = closeToc;
$('#btn-home').onclick = () => focusStop(0);
$('#prev').onclick = prev; $('#next').onclick = next;
$('#btn-lang').onclick = () => { if (current >= 0) focusStop(current, langK ? 0 : 1, { quick: true }); };
$('#btn-map').onclick = () => (mode === 'overview' ? focusStop(Math.max(0, current)) : overview());

function startCamera() {
  // старт: снизу и снаружи вихря, взгляд на его начало
  camera.position.copy(path.getPoint(0)).add(new Vector3(0, -1800, 0)).addScaledVector(path.getPoint(0).clone().setY(0).normalize(), 2600);
  camera.lookAt(path.getPoint(tOf(1.5)));
  controls.target.copy(path.getPoint(tOf(1.5)));
}
const fsOk = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
function toggleFs(force) {
  const el = document.documentElement, on = !!(document.fullscreenElement || document.webkitFullscreenElement);
  try {
    if (!on && force !== false) (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.(() => {});
    else if (on && force !== true) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)?.catch?.(() => {});
  } catch (e) { /* браузер не разрешил */ }
}
$('#btn-fs').hidden = !fsOk;
$('#btn-fs').onclick = () => toggleFs();
function enter(withSound) {
  if (fsOk && !SHOT) toggleFs(true);
  if (withSound) audio.start();
  soundUi(); document.body.classList.add('entered');
  const hash = decodeURIComponent(location.hash.slice(1));
  const si = STOPS.findIndex((s) => idOf(s) === hash);
  mode = 'poem'; current = -1; poke();
  // ссылка на конкретный стих открывает его сразу; иначе — сначала весь вихрь, как на «Карте»
  if (si >= 0) focusStop(si, null, { dur: reduceMotion ? 0.01 : 6 });
  else overview(reduceMotion ? 0.01 : 5.5);
}
let poemHintShown = false;
$('#mp-info').textContent = isTouch
  ? 'По всему полю можно свободно перемещаться: один палец — вращать вихрь, два пальца — приблизить и сдвинуть, нажмите на огонёк — откроется стих.'
  : 'По всему полю можно свободно перемещаться: колесо — лететь к точке под курсором, перетаскивание — вращать, правая кнопка — сдвиг, W A S D и Q/E — полёт. Клик по огоньку открывает стих.';
$('#mp-start').onclick = () => focusStop(0, null, { dur: reduceMotion ? 0.01 : 4.2 });
$('#mp-back').onclick = () => focusStop(Math.max(0, current));
$('#enter-sound').onclick = () => enter(true);
$('#enter-quiet').onclick = () => enter(false);

// ───────────── Финал ─────────────
// Камера делает оборот и поднимает взгляд вверх; в небе кружат буквы стихов; все листы поднимаются
// и сгорают от края (обугленная рваная кромка, подпал, языки пламени); пепел собирается в обложку.
let finaleOn = false, finaleDone = false, fadeAll = 1, fin = null;
const _fr = new Vector3(), _tq = new Quaternion(), _qa = new Quaternion(), _qb = new Quaternion(), _qc = new Quaternion(), _axZ = new Vector3(0, 0, 1), _axX = new Vector3(1, 0, 0), _w = new Vector3();
const ASH_N = lowPower ? 5000 : 11000;
const ashPos = new Float32Array(ASH_N * 3), ashVel = new Float32Array(ASH_N * 3), ashB = new Float32Array(ASH_N), ashKind = new Uint8Array(ASH_N);
const ashFrom = new Float32Array(ASH_N * 3), ashTo = new Float32Array(ASH_N * 3), ashOn = new Uint8Array(ASH_N);
let ashHead = 0;
const ashGeo = new BufferGeometry();
ashGeo.setAttribute('position', new BufferAttribute(ashPos, 3)); ashGeo.setAttribute('aB', new BufferAttribute(ashB, 1));
const ashMat = new ShaderMaterial({
  uniforms: { uScale: { value: 800 }, uPR: { value: dpr }, uFade: { value: 1 } },
  vertexShader: `attribute float aB; uniform float uScale, uPR; varying float vB;
    void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(6.5 * uScale / max(-mv.z, 1.0), 1.2, 6.0) * uPR; gl_Position = projectionMatrix * mv; vB = aB; }`,
  fragmentShader: `uniform float uFade; varying float vB; void main(){ if (vB <= 0.01) discard; vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0; if (r > 1.0) discard;
    vec3 col = mix(vec3(0.55, 0.47, 0.42), vec3(1.0, 0.62, 0.25), clamp(vB - 0.25, 0.0, 1.0)); col = mix(col, vec3(1.0, 0.9, 0.7), clamp(vB - 1.0, 0.0, 1.0));
    gl_FragColor = vec4(col * (1.0 - r * r) * min(1.0, vB) * uFade, 1.0); }`,
  transparent: true, depthWrite: false, blending: AdditiveBlending,
});
const ash = new Points(ashGeo, ashMat); ash.frustumCulled = false; scene.add(ash);
function emit(p, kind, vx = 0, vy = 0, vz = 0) {
  const j = ashHead; ashHead = (ashHead + 1) % ASH_N; ashOn[j] = 0;
  ashPos[j * 3] = p.x; ashPos[j * 3 + 1] = p.y; ashPos[j * 3 + 2] = p.z;
  const sp = kind ? 60 : 90;
  ashVel[j * 3] = vx + (Math.random() - 0.5) * sp + wind.x * 0.4; ashVel[j * 3 + 1] = vy + (kind ? 80 + Math.random() * 140 : Math.random() * 60);
  ashVel[j * 3 + 2] = vz + (Math.random() - 0.5) * sp + wind.z * 0.4;
  ashKind[j] = kind; ashB[j] = kind ? 1.4 + Math.random() * 0.7 : 1.05;
}

// ── текстура листа для сожжения: тот же пергамент и текст, нарисованные на canvas
let parchImg = null; { const im = new Image(); im.onload = () => { parchImg = im; }; im.src = parchmentURL; }
let roseImg = null; { const im = new Image(); im.onload = () => { roseImg = im; }; im.src = INK.roses_small; }
function wrapLines(g, text, maxW) {
  const out = []; let line = '';
  for (const word of text.split(' ')) { const t = line ? line + ' ' + word : word; if (g.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t; }
  out.push(line); return out;
}
function drawSheetCanvas(s, k) {
  const el = s.els[k], wC = s.sizes[k].w / SHEET_SCALE, hC = s.sizes[k].h / SHEET_SCALE, sc = lowPower ? 1 : 1.3;
  const c = document.createElement('canvas'); c.width = Math.round(wC * sc); c.height = Math.round(hC * sc);
  const g = c.getContext('2d'); g.scale(sc, sc);
  // рваный край
  g.beginPath(); const J = () => Math.random() * 4;
  for (let x = 0; x <= wC; x += 14) g.lineTo(x, J());
  for (let y = 0; y <= hC; y += 14) g.lineTo(wC - J(), y);
  for (let x = wC; x >= 0; x -= 14) g.lineTo(x, hC - J());
  for (let y = hC; y >= 0; y -= 14) g.lineTo(J(), y);
  g.closePath(); g.save(); g.clip();
  g.fillStyle = '#efe2c4'; g.fillRect(0, 0, wC, hC);
  if (parchImg) { g.fillStyle = g.createPattern(parchImg, 'repeat'); g.fillRect(0, 0, wC, hC); }
  const vg = g.createRadialGradient(wC / 2, hC * 0.45, Math.min(wC, hC) * 0.35, wC / 2, hC / 2, Math.hypot(wC, hC) * 0.62);
  vg.addColorStop(0, 'rgba(120,82,40,0)'); vg.addColorStop(1, 'rgba(120,82,40,.32)'); g.fillStyle = vg; g.fillRect(0, 0, wC, hC);
  g.restore();
  const ink = '#2f2117', L = 38, cw = wC - 76; let y = 34;
  const serif = 'Georgia, Gelasio, "PT Serif", serif';
  g.textBaseline = 'top';
  if (s.type === 'ded') {
    g.fillStyle = ink; g.font = `italic 30px ${serif}`; g.textAlign = 'center'; g.fillText(BOOK.dedication, wC / 2, 64);
    if (roseImg) drawRose(g, wC / 2 - 48, 120);
    return c;
  }
  const photo = el.querySelector('.photo');
  if (photo) { const gr = g.createRadialGradient(wC / 2, y + 105, 20, wC / 2, y + 105, 105); gr.addColorStop(0, 'rgba(150,110,70,.55)'); gr.addColorStop(1, 'rgba(150,110,70,0)'); g.fillStyle = gr; g.beginPath(); g.arc(wC / 2, y + 105, 105, 0, 7); g.fill(); y += 232; }
  const tag = el.querySelector('.tag'); if (tag) { g.fillStyle = '#8a6440'; g.font = '500 10.5px Manrope, sans-serif'; g.fillText(tag.textContent.toUpperCase().split('').join(String.fromCharCode(8202)), L, y); y += 28; }
  const h3 = el.querySelector('h3');
  if (h3) { g.fillStyle = '#24170e'; g.font = `28px ${serif}`; wrapLines(g, h3.textContent, cw).forEach((l) => { g.fillText(l, L, y); y += 32; }); y += 14; }
  el.querySelectorAll('.verse p, .sheet-after > p').forEach((p) => {
    if (p.classList.contains('gap')) { y += 14; return; }
    const quote = p.classList.contains('quote');
    g.fillStyle = ink; g.font = quote ? `40px "Ms Madi", ${serif}` : `${s.type === 'after' ? 18 : 18.5}px ${serif}`;
    g.textAlign = quote ? 'center' : 'left';
    wrapLines(g, p.textContent, cw).forEach((l) => { g.fillText(l, quote ? wC / 2 : L, y); y += quote ? 48 : 28.6; });
    g.textAlign = 'left'; if (s.type === 'after') y += 12;
  });
  const sign = el.querySelector('.sign'); if (sign) { y += 18; g.fillStyle = '#7a5a3c'; g.font = `italic 15px ${serif}`; g.fillText(sign.textContent, L, y); y += 24; }
  const note = el.querySelector('.note');
  if (note) { y += 18; g.strokeStyle = 'rgba(120,82,40,.35)'; g.beginPath(); g.moveTo(L, y); g.lineTo(wC - L, y); g.stroke(); y += 14;
    g.fillStyle = '#8a6440'; g.font = '500 10px Manrope, sans-serif'; g.fillText('ЗАМЕТКА АВТОРА', L, y); y += 20;
    g.fillStyle = '#4a3424'; g.font = `italic 15px ${serif}`; wrapLines(g, note.textContent.replace('Заметка автора', ''), cw).forEach((l) => { g.fillText(l, L, y); y += 22; }); }
  if (el.querySelector('.rose-small') && roseImg) drawRose(g, wC / 2 - 48, y + 22);
  return c;
}
function drawRose(g, x, y) {
  const t = document.createElement('canvas'); t.width = 96; t.height = 118; const tg = t.getContext('2d');
  tg.drawImage(roseImg, 0, 0, 96, 118); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = '#3a2618'; tg.fillRect(0, 0, 96, 118);
  g.drawImage(t, x, y);
}
// карта времени сгорания: от одного края, с шумом — даёт рваную, неровную кромку
function vnoise(x, y, seed) { const h = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); };
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v; }
function burnField(w, h) {
  const GW = 64, GH = Math.max(16, Math.round(64 * h / w)), seed = Math.random() * 100, side = Math.random();
  const f = new Float32Array(GW * GH); let mn = 1e9, mx = -1e9;
  const cx = Math.random(), cy = 1;   // очаг у нижнего края (как пламя снизу на референсе)
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const u = i / (GW - 1), v = j / (GH - 1);
    let d = side < 0.6 ? Math.hypot((u - cx) * (w / h) * 0.7, v - cy) : side < 0.8 ? u + (1 - v) * 0.4 : (1 - u) + (1 - v) * 0.4;
    let n = 0, a = 0.5, fr = 3; for (let o = 0; o < 4; o++) { n += a * vnoise(u * fr * (w / h), v * fr, seed + o); a *= 0.5; fr *= 2.1; }
    d += (n - 0.5) * 0.55; f[j * GW + i] = d; mn = Math.min(mn, d); mx = Math.max(mx, d);
  }
  const data = new Uint8Array(GW * GH);
  for (let k = 0; k < f.length; k++) f[k] = (f[k] - mn) / (mx - mn);
  // строка 0 сетки — верх листа, а у текстуры v=0 — низ: переворачиваем вручную
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) data[(GH - 1 - j) * GW + i] = Math.round(f[j * GW + i] * 255);
  const tex = new DataTexture(data, GW, GH, RedFormat, UnsignedByteType); tex.magFilter = tex.minFilter = LinearFilter; tex.needsUpdate = true;
  return { f, GW, GH, tex };
}
const burnMat = (map, field) => new ShaderMaterial({
  uniforms: { uTex: { value: map }, uField: { value: field }, uBurn: { value: -0.05 }, uTime: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D uTex, uField; uniform float uBurn, uTime; varying vec2 vUv;
    void main(){
      vec4 paper = texture2D(uTex, vUv); if (paper.a < 0.5) discard;
      float d = texture2D(uField, vUv).r - uBurn;         // >0 — ещё не сгорело
      if (d < -0.015) discard;
      vec3 col = paper.rgb;
      if (!gl_FrontFacing) {   // оборот листа: чистая бумага, текст лишь слегка просвечивает
        vec2 e = min(vUv, 1.0 - vUv); float ink = 1.0 - smoothstep(0.35, 0.7, dot(paper.rgb, vec3(0.333)));
        col = vec3(0.87, 0.79, 0.64) * (0.8 + 0.2 * smoothstep(0.0, 0.14, min(e.x, e.y))) * (1.0 - ink * 0.1);
      }
      col = mix(col, col * vec3(0.62, 0.42, 0.24), (1.0 - smoothstep(0.0, 0.24, d)) * 0.9);   // подпал
      col = mix(col, vec3(0.07, 0.045, 0.03), 1.0 - smoothstep(0.0, 0.055, d));               // обугленная кромка
      float rim = 1.0 - smoothstep(0.0, 0.016, abs(d + 0.004));
      float fl = 0.7 + 0.3 * sin(uTime * 19.0 + vUv.x * 47.0 + vUv.y * 29.0);
      col += vec3(1.0, 0.5, 0.12) * rim * 2.6 * fl * step(0.0, uBurn);                          // тлеющая кромка
      gl_FragColor = vec4(col, 1.0);
    }`,
  side: DoubleSide,
});
const FIRE = canvasTex(64, 128, (g) => { // язык пламени
  for (let i = 0; i < 3; i++) {
    g.save(); g.translate(32 + (i - 1) * 7, 120); g.scale(1 - i * 0.18, 1);
    const gr = g.createLinearGradient(0, 0, 0, -115);
    gr.addColorStop(0, 'rgba(255,210,120,.0)'); gr.addColorStop(0.08, 'rgba(255,200,90,.9)'); gr.addColorStop(0.45, 'rgba(255,120,30,.75)'); gr.addColorStop(1, 'rgba(180,40,10,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(-14, 0); g.bezierCurveTo(-18, -40, 6, -60, -2, -115 + i * 18); g.bezierCurveTo(10, -70, 20, -40, 14, 0); g.closePath(); g.fill(); g.restore();
  }
});
// фотографии сборника — отпечатки на плотной бумаге; в финале кружат вместе с листами и тоже сгорают
const photoImgs = PHOTO_DATA.map((src) => { const im = new Image(); im.src = src; return im; });
const PHOTO_CARDS = [];
function photoCardCanvas(im) {
  const W = 300, H = 340, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.beginPath(); const J = () => Math.random() * 3;
  for (let x = 0; x <= W; x += 12) g.lineTo(x, J()); for (let y = 0; y <= H; y += 12) g.lineTo(W - J(), y);
  for (let x = W; x >= 0; x -= 12) g.lineTo(x, H - J()); for (let y = H; y >= 0; y -= 12) g.lineTo(J(), y);
  g.closePath(); g.clip(); g.fillStyle = '#efe2c4'; g.fillRect(0, 0, W, H);
  if (parchImg) { g.fillStyle = g.createPattern(parchImg, 'repeat'); g.fillRect(0, 0, W, H); }
  const r = 118, cx = W / 2, cy = 150;
  if (im.complete && im.naturalWidth) { g.save(); g.filter = 'sepia(.35) contrast(1.05)'; g.drawImage(im, cx - r, cy - r, r * 2, r * 2); g.restore(); }
  g.strokeStyle = 'rgba(70,46,26,.55)'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, r + 5, 0, 7); g.stroke();
  g.fillStyle = 'rgba(90,62,34,.6)'; g.font = 'italic 17px Georgia, Gelasio, serif'; g.textAlign = 'center'; g.fillText('Toi et Moi', cx, 308);
  return c;
}
function preparePhotoCards() {
  if (PHOTO_CARDS.length) return;
  const copies = lowPower ? 1 : 2;
  for (let n = 0; n < copies; n++) photoImgs.forEach((im) => {
    const tex = new CanvasTexture(photoCardCanvas(im)); tex.colorSpace = SRGBColorSpace;
    const w = 300 * 1.25, h = 340 * 1.25, field = burnField(w, h), mat = burnMat(tex, field.tex);
    const mesh = new Mesh(new PlaneGeometry(w, h), mat), group = new Group(); group.add(mesh); mesh.visible = false; scene.add(group);
    PHOTO_CARDS.push({ card: true, group, burn: [{ mesh, mat, field, w, h, flames: [] }], gone: false, fq: new Quaternion(), base: new Vector3(), seed: Math.random() * 10 });
  });
}
function prepareBurnables() {
  preparePhotoCards();
  for (const s of STOPS) {
    if (!s.group || s.burn) continue;
    s.burn = s.objs.map((o, k) => {
      const tex = new CanvasTexture(drawSheetCanvas(s, k)); tex.colorSpace = SRGBColorSpace;
      const field = burnField(s.sizes[k].w, s.sizes[k].h);
      const mat = burnMat(tex, field.tex);
      const mesh = new Mesh(new PlaneGeometry(s.sizes[k].w, s.sizes[k].h), mat);
      mesh.position.copy(o.position); mesh.visible = false; s.group.add(mesh);
      return { mesh, mat, field, w: s.sizes[k].w, h: s.sizes[k].h, flames: [] };
    });
  }
}
// буквы стихов, кружащие в небе
const GLYPHS = [];
function buildGlyphs() {
  const src = ORDER.flatMap((p) => [...(p.fr?.lines || []), ...(p.ru?.lines || [])]).join('').replace(/[\s«»"“”.,!?:;—–\-()…*]/g, '');
  const chars = [...new Set(src.split(''))].slice(0, 60), texs = chars.map((ch) => canvasTex(64, 64, (g) => { g.font = 'italic 46px Georgia, Gelasio, "PT Serif", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#ffcf8a'; g.shadowBlur = 10; g.fillStyle = '#fff4dc'; g.fillText(ch, 32, 34); }));
  for (let i = 0; i < (lowPower ? 110 : 240); i++) {
    const s = new Sprite(new SpriteMaterial({ map: texs[(Math.random() * texs.length) | 0], color: new Color('#ffe2b0'), blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    s.visible = false; scene.add(s);
    GLYPHS.push({ s, a: Math.random() * 6.28, r: rnd(150, 1500), h: rnd(500, 2800), sp: rnd(0.1, 0.35) * (Math.random() < 0.5 ? -1 : 1), up: rnd(20, 70), sz: rnd(36, 95), ph: rnd(0, 6) });
  }
  // символы фотографий сборника — их тушевые эскизы — плывут среди букв
  const sk = Object.values(SKETCH), loader = new TextureLoader();
  sk.forEach((src) => loader.load(src, (tex) => {
    tex.colorSpace = SRGBColorSpace; const ar = tex.image.width / tex.image.height;
    for (let i = 0; i < (lowPower ? 2 : 3); i++) {
      const s = new Sprite(new SpriteMaterial({ map: tex, color: new Color('#ffd7a6'), blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
      s.visible = finaleOn; scene.add(s);
      GLYPHS.push({ s, a: Math.random() * 6.28, r: rnd(450, 1400), h: rnd(700, 2300), sp: rnd(0.06, 0.16) * (Math.random() < 0.5 ? -1 : 1), up: rnd(15, 40), sz: rnd(260, 460), ar, k: 0.42, rot: rnd(-0.3, 0.3), ph: rnd(0, 6), h0: 0 });
    }
  }));
  GLYPHS.forEach((g) => { g.h0 = g.h; });
}

// куда летит лист: сначала вихрь вокруг зрителя (и ниже горизонта), затем подъём в небо по всей высоте кадра
function finItem(s, off, near, rank, riseAt, burnAt, glow) {
  const elev = MathUtils.degToRad(near ? rnd(18, 78) : rnd(24, 82)), dist = near ? rnd(700, 1350) : rnd(1700, 3400);
  return { s, start: off, a0: Math.atan2(off.z, off.x), ang: 0, near, skyR: dist * Math.cos(elev), skyH: dist * Math.sin(elev),
    R: near ? rnd(480, 1050) : MathUtils.clamp(Math.hypot(off.x, off.z), 1400, 3200), y: near ? rnd(-560, 300) : MathUtils.clamp(off.y, -900, 800),
    spd: (near ? rnd(0.55, 1) : rnd(0.18, 0.38)) * (rank % 2 ? 1 : -1), ph: Math.random() * 6, riseAt, burnAt, burnDur: 3 + Math.random() * 0.9, glow,
    tilt: rnd(0.55, 0.85), flip: Math.random() < 0.6 ? rnd(1.1, 2.6) * (Math.random() < 0.5 ? -1 : 1) : 0, yaw: 0 };
}
function finale() {
  if (finaleOn) return;
  prepareBurnables();
  finaleOn = true; mode = 'finale'; rest = null; flight = null; controls.enabled = false; controls.autoRotate = false;
  document.body.classList.add('finale', 'hud-hide'); $('#map-panel').classList.remove('show');
  audio.finale('A'); audio.whoosh(4); audio.crumple(0.8);
  fin = { start: performance.now() / 1000, q0: camera.quaternion.clone(), camPos: camera.position.clone(), items: [], formed: false, dir: Math.random() < 0.5 ? 1 : -1 };
  const order = STOPS.filter((s) => s.group).sort((a, b) => camera.position.distanceTo(a.group.position) - camera.position.distanceTo(b.group.position));
  const MAXI = lowPower ? 12 : NS;
  order.forEach((s, rank) => {
    if (rank >= MAXI) { s.gone = true; return; }
    s.burn.forEach((b) => { b.mesh.visible = true; });
    const off = s.group.position.clone().sub(camera.position), near = rank < 10;
    const riseAt = 4.6 + rank * (lowPower ? 0.32 : 0.24) + Math.random() * 0.3, burnAt = riseAt + 1.6 + Math.random() * 0.6;
    const glow = new Sprite(new SpriteMaterial({ map: GLOW, color: '#ff8a30', blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    glow.scale.setScalar(near ? 900 : 1500); scene.add(glow);
    fin.items.push(finItem(s, off, near, rank, riseAt, burnAt, glow));
  });
  // фотографии: вылетают из темноты снизу и кружат ближе к зрителю
  PHOTO_CARDS.forEach((c, i) => {
    const a = Math.random() * 6.28, off = new Vector3(Math.cos(a) * rnd(1400, 2200), rnd(-1400, -700), Math.sin(a) * rnd(1400, 2200));
    c.gone = false; c.group.position.copy(camera.position).add(off); c.burn[0].mesh.visible = true;
    const riseAt = 5.2 + i * 0.9 + Math.random() * 0.5, burnAt = riseAt + 1.8 + Math.random() * 0.8;
    const glow = new Sprite(new SpriteMaterial({ map: GLOW, color: '#ff8a30', blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    glow.scale.setScalar(800); scene.add(glow);
    fin.items.push(finItem(c, off, true, i, riseAt, burnAt, glow));
  });
  fin.formAt = Math.max(...fin.items.map((it) => it.burnAt + it.burnDur)) + 0.5;
  for (const s of STOPS) s.fq = new Quaternion();
  GLYPHS.forEach((g) => { g.s.visible = true; });
  waxMat.transparent = true;
}
function updateFinale(dt) {
  const t = performance.now() / 1000 - fin.start; fin.t = t;  // реальное время — одинаково на любом устройстве
  const swirl = MathUtils.smoothstep(t, 0, 2.5);
  fadeAll = Math.max(0, 1 - Math.max(0, t - 2) / 5);
  for (const m of starMats) m.uniforms.uFade.value = Math.max(0.15, 1 - Math.max(0, t - 4) / 6);
  skyMat.uniforms.uFade.value = Math.max(0.12, 1 - Math.max(0, t - 3) / 7);
  fluffMat.uniforms.uFade.value = fadeAll; stMat.uniforms.uFade.value = fadeAll; waxMat.opacity = fadeAll;
  wind.multiplyScalar(1 + swirl * 2.5);
  // камера: оборот вокруг себя, затем взгляд вверх — туда, где кружат буквы и улетают горящие листы
  if (!reduceMotion) {
    const k = MathUtils.clamp(t / 7.5, 0, 1), turn = k * k * k * (k * (k * 6 - 15) + 10);
    const yaw = fin.dir * Math.PI * 2 * turn + Math.sin(t * 0.5) * 0.08 * (1 - MathUtils.smoothstep(t, fin.formAt - 1, fin.formAt));
    const pitch = 0.86 * MathUtils.smoothstep(t, 4.5, 8.5) + Math.sin(t * 0.7) * 0.03;
    camera.quaternion.copy(_qa.setFromAxisAngle(UP, yaw)).multiply(fin.q0); camera.rotateX(pitch - 0.0);
  }
  camera.position.copy(fin.camPos);
  // буквы стихов в небе
  const gv = MathUtils.smoothstep(t, 4, 7) * (fin.formed ? 1 - MathUtils.smoothstep(t, fin.formAt, fin.formAt + 2.5) : 1);
  for (const g of GLYPHS) {
    g.a += g.sp * dt; g.h += g.up * dt;
    g.s.position.set(fin.camPos.x + Math.cos(g.a) * g.r, fin.camPos.y + g.h, fin.camPos.z + Math.sin(g.a) * g.r);
    g.s.scale.set(g.sz * (g.ar || 1), g.sz, 1); g.s.material.opacity = gv * (g.k || 1) * (0.65 + 0.35 * Math.sin(t * 1.3 + g.ph));
    if (g.ar) g.s.material.rotation = g.rot + Math.sin(t * 0.4 + g.ph) * 0.15;
  }
  // звук: одна общая «стена огня» по числу горящих листов; фазы музыки
  let burning = 0; for (const it of fin.items) if (!it.s.gone && t > it.burnAt) burning++;
  const fl = Math.min(1, burning / 5); if (Math.abs(fl - (fin.fireLvl ?? -1)) > 0.05) { fin.fireLvl = fl; audio.setFire(fl); }
  if (t > 9 && !fin.phB) { fin.phB = true; audio.finale('B'); }
  if (t > fin.formAt - 3 && !fin.phC) { fin.phC = true; audio.finale('C'); }
  for (const it of fin.items) {
    const s = it.s;
    if (s.gone) { it.glow.material.opacity *= 0.9; continue; }
    // листы кружатся вихрем вокруг, затем поднимаются в небо
    it.ang += it.spd * dt * (0.4 + swirl * 1.8);
    const a = it.a0 + it.ang, k = MathUtils.smoothstep(t, 0, it.near ? 2.2 : 4);
    const up = MathUtils.smoothstep(t, it.riseAt, it.riseAt + 2.6);           // подъём в небо над зрителем
    const Rr = MathUtils.lerp(it.R, it.skyR, up), Yy = MathUtils.lerp(it.y, it.skyH, up) + Math.max(0, t - it.riseAt - 2.6) * 90;
    _fr.set(Math.cos(a) * Rr, Yy + Math.sin(t * 1.4 + it.ph) * 70, Math.sin(a) * Rr);
    _fr.lerpVectors(it.start, _fr, k);
    s.group.position.copy(fin.camPos).add(_fr); s.base.copy(s.group.position);
    // листы бьются на ветру: крен, качка и перелистывание (часть переворачивается через край целиком)
    it.yaw += (it.flip || 0) * dt * swirl;
    const yaw = it.flip ? it.yaw : Math.sin(t * 0.9 + it.ph) * 0.9 * swirl;
    s.fq.copy(_qa.setFromAxisAngle(_axZ, Math.sin(t * 1.9 + it.ph) * it.tilt * swirl)).multiply(_qb.setFromAxisAngle(_axX, (Math.sin(t * 1.3 + it.ph * 2) * 0.75 + Math.sin(t * 3.1 + it.ph) * 0.12) * swirl)).multiply(_qc.setFromAxisAngle(UP, yaw));
    if (s.card) s.group.quaternion.slerp(_tq.copy(camera.quaternion).multiply(s.fq), 1 - Math.exp(-dt * 9));
    if (it.near && t > it.riseAt && !it.lift) { it.lift = true; audio.crumple(0.45); }
    // горение от края
    if (t > it.burnAt) {
      const bk = (t - it.burnAt) / it.burnDur, B = bk * 1.1 - 0.02;
      it.glow.position.copy(s.group.position); it.glow.material.opacity = (0.45 + Math.random() * 0.3) * Math.min(1, Math.sin(Math.min(1, bk) * Math.PI) + 0.25);
      for (const b of s.burn) {
        b.mat.uniforms.uBurn.value = B; b.mat.uniforms.uTime.value = t;
        // фронт огня: языки пламени, искры и хлопья пепла
        const F = b.field, n = lowPower ? 3 : 7;
        for (let q = 0; q < n; q++) {
          const i = (Math.random() * F.GW) | 0, j = (Math.random() * F.GH) | 0, v = F.f[j * F.GW + i];
          if (Math.abs(v - B) > 0.05) continue;
          _w.set((i / (F.GW - 1) - 0.5) * b.w, (0.5 - j / (F.GH - 1)) * b.h, 2); b.mesh.localToWorld(_w);
          emit(_w, Math.random() < 0.6 ? 1 : 0);
          if (b.flames.length < (lowPower ? 8 : 16)) {
            const fl = new Sprite(new SpriteMaterial({ map: FIRE, blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
            scene.add(fl); b.flames.push({ s: fl, i, j, life: 0 });
          }
        }
        for (const fl of b.flames) {
          fl.life -= dt;
          if (fl.life <= 0) { // переносим язык пламени на текущий фронт
            for (let tries = 0; tries < 6; tries++) { const i = (Math.random() * F.GW) | 0, j = (Math.random() * F.GH) | 0; if (Math.abs(F.f[j * F.GW + i] - B) < 0.06) { fl.i = i; fl.j = j; break; } }
            fl.life = 0.25 + Math.random() * 0.35;
          }
          _w.set((fl.i / (F.GW - 1) - 0.5) * b.w, (0.5 - fl.j / (F.GH - 1)) * b.h, 4); b.mesh.localToWorld(_w);
          const h = (it.near ? 110 : 170) * (0.7 + Math.random() * 0.6) * Math.min(1, Math.sin(Math.min(1, bk) * Math.PI) * 1.6 + 0.3);
          fl.s.position.copy(_w).addScaledVector(UP, h * 0.35); fl.s.scale.set(h * 0.45, h, 1);
          fl.s.material.opacity = (0.75 + Math.random() * 0.25) * (bk < 1 ? 1 : 0); fl.s.material.rotation = (Math.random() - 0.5) * 0.25;
        }
      }
      if (bk >= 1.05) {
        for (const b of s.burn) { b.mesh.visible = false; b.flames.forEach((fl) => { fl.s.visible = false; }); for (let q = 0; q < (lowPower ? 60 : 140); q++) { _w.set((Math.random() - 0.5) * b.w, (Math.random() - 0.5) * b.h, 0); b.mesh.localToWorld(_w); emit(_w, 0); } }
        s.gone = true; audio.crumple(it.near ? 1 : 0.5);
      }
    }
  }
  // пепел и искры; к концу пепел слетается в рисунок обложки прямо в небе
  if (t > fin.formAt && !fin.formed) { fin.formed = true; formAshPicture(); audio.setFire(0); }
  const fk = fin.formed ? MathUtils.smoothstep(t, fin.formAt, fin.formAt + 3.4) : 0, ease = fk * fk * (3 - 2 * fk);
  for (let i = 0; i < ASH_N; i++) {
    if (ashB[i] <= 0.01) continue;
    const j = i * 3;
    if (ashOn[i]) {
      const w = (1 - ease) * 60;
      ashPos[j] = MathUtils.lerp(ashFrom[j], ashTo[j], ease) + Math.sin(t * 2 + i) * w;
      ashPos[j + 1] = MathUtils.lerp(ashFrom[j + 1], ashTo[j + 1], ease) + Math.cos(t * 1.7 + i) * w;
      ashPos[j + 2] = MathUtils.lerp(ashFrom[j + 2], ashTo[j + 2], ease);
      ashB[i] = 0.7 + ease * 0.55 + Math.sin(t * 3 + i * 0.37) * 0.08; continue;
    }
    ashVel[j] += wind.x * 0.25 * dt; ashVel[j + 1] += ((ashKind[i] ? 40 : 8) - ashVel[j + 1] * 0.4) * dt; ashVel[j + 2] += wind.z * 0.25 * dt;
    ashPos[j] += ashVel[j] * dt; ashPos[j + 1] += ashVel[j + 1] * dt; ashPos[j + 2] += ashVel[j + 2] * dt;
    ashB[i] = ashKind[i] ? ashB[i] - dt * 1.2 : Math.max(fin.formed ? 0 : 0.45, ashB[i] - dt * (fin.formed ? 0.8 : 0.15));
  }
  ashGeo.attributes.position.needsUpdate = true; ashGeo.attributes.aB.needsUpdate = true;
  ashMat.uniforms.uScale.value = (innerHeight / 2) / Math.tan(MathUtils.degToRad(camera.fov) / 2); ashMat.uniforms.uPR.value = dpr;
  if (fin.formed && t > fin.formAt + 3.6 && !document.body.classList.contains('fin-show')) document.body.classList.add('fin-show');
  ashMat.uniforms.uFade.value = fin.formed ? 1 - MathUtils.smoothstep(t, fin.formAt + 4.2, fin.formAt + 6.5) : 1;
  if (fin.formed && t > fin.formAt + 7) finaleDone = true;
}

// «Начать заново»: финал сворачивается, всё возвращается на места, камера улетает на карту к вращающемуся вихрю
function resetFinale() {
  if (!finaleOn) return;
  finaleOn = false; finaleDone = false; fadeAll = 1;
  document.body.classList.remove('finale', 'fin-show');
  $('#share-menu').hidden = true;
  for (const m of starMats) m.uniforms.uFade.value = 1;
  skyMat.uniforms.uFade.value = 1; fluffMat.uniforms.uFade.value = 1; stMat.uniforms.uFade.value = 1; waxMat.opacity = 1;
  ashB.fill(0); ashOn.fill(0); ashMat.uniforms.uFade.value = 1; ashGeo.attributes.aB.needsUpdate = true;
  GLYPHS.forEach((g) => { g.s.visible = false; g.s.material.opacity = 0; g.h = g.h0 ?? g.h; });
  for (const it of fin.items) { scene.remove(it.glow); it.glow.material.dispose(); }
  for (const s of [...STOPS, ...PHOTO_CARDS]) {
    if (s.burn) for (const b of s.burn) {
      b.flames.forEach((fl) => { scene.remove(fl.s); fl.s.material.dispose(); });
      b.mesh.removeFromParent(); b.mesh.geometry.dispose(); b.mat.uniforms.uTex.value.dispose(); b.field.tex.dispose(); b.mat.dispose();
    }
    s.burn = null; s.gone = false; s.fq = null;
  }
  for (const c of PHOTO_CARDS) scene.remove(c.group);
  PHOTO_CARDS.length = 0;
  for (const s of STOPS) if (s.base0) { s.base.copy(s.base0); s.group?.position.copy(s.base0); }
  fin = null; current = -1; langK = 0;
  audio.finale(null);
  overview(4.2);
}
function buildAshShape() {
  // рисунок как на обложке: надпись «Toi et Moi», розы, имя автора — точки для сборки пепла
  const W = 300, H = 370, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const img = new Image();
  img.onload = () => {
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    // как на обложке: надпись вверху (~20% высоты), розы 28–72%, имя автора ~81%
    g.font = '64px "Ms Madi", Georgia, serif'; const tw = g.measureText('Toi et Moi').width, fs = 64 * (0.56 * W) / tw;
    g.font = `${fs}px "Ms Madi", Georgia, serif`; g.fillText('Toi et Moi', 0.53 * W, 0.2 * H);
    const ih = 0.44 * H, iw = ih * img.width / img.height; g.drawImage(img, 0.58 * W - iw / 2, 0.28 * H, iw, ih);
    g.font = `${Math.round(0.064 * W)}px Georgia, Gelasio, serif`; g.fillText('Artem Torgashev', 0.5 * W, 0.815 * H);
    const d = g.getImageData(0, 0, W, H).data, pts = [];
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (d[(y * W + x) * 4 + 3] > 90) pts.push([x / W, y / H]);
    ashShape = pts;
  };
  img.src = INK.roses_small;
}
function formAshPicture() {
  const pts = ashShape; if (!pts || !pts.length) return;
  const rect = $('.fin-cover').getBoundingClientRect();
  const fwd = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion), D = 900, v = new Vector3();
  const live = [], used = new Set(); for (let i = 0; i < ASH_N; i++) if (ashB[i] > 0.05 && !ashKind[i]) { live.push(i); used.add(i); }
  // если пепла мало — досыпаем из темноты, чтобы рисунок был плотным
  const need = Math.min(ASH_N, Math.max(live.length, lowPower ? 2600 : 6000));
  for (let j = 0; j < ASH_N && live.length < need; j++) { if (used.has(j)) continue; v.set(rnd(-1, 1), rnd(-0.2, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(900, 2000)).add(camera.position); ashPos.set([v.x, v.y, v.z], j * 3); ashB[j] = 0.35; ashKind[j] = 0; live.push(j); }
  live.forEach((i, n) => {
    const p = pts[(Math.random() * pts.length) | 0];
    const sx = rect.left + p[0] * rect.width + rnd(-0.6, 0.6), sy = rect.top + p[1] * rect.height + rnd(-0.6, 0.6);
    v.set((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize();
    v.multiplyScalar(D / Math.max(0.2, v.dot(fwd))).add(camera.position);
    const j = i * 3; ashFrom.set([ashPos[j], ashPos[j + 1], ashPos[j + 2]], j); ashTo.set([v.x, v.y, v.z], j); ashOn[i] = 1;
  });
}
function buildFinale() {
  const p = ORDER[0];
  $('#fin-fr').innerHTML = p.fr.lines.map((l) => `<span>${esc(l)}</span>`).join('');
  $('#fin-ru').innerHTML = p.ru.lines.map((l) => `<span>${esc(l)}</span>`).join('');
  $('#restart').onclick = () => resetFinale();
  buildAshShape();
  // «Нравится»: сердце с искрами; отметка хранится в этом браузере
  const like = $('#like');
  const setLiked = (v) => { like.classList.toggle('liked', v); like.querySelector('.lbl').textContent = v ? 'Спасибо' : 'Нравится'; like.setAttribute('aria-pressed', v); };
  try { setLiked(localStorage.getItem('toi-et-moi-like') === '1'); } catch (e) { setLiked(false); }
  like.onclick = () => {
    const v = !like.classList.contains('liked'); setLiked(v);
    try { localStorage.setItem('toi-et-moi-like', v ? '1' : '0'); } catch (e) { /* хранилище недоступно */ }
    if (v) { for (let i = 0; i < 9; i++) { const h = document.createElement('i'); h.className = 'heart-burst'; h.textContent = '♥'; h.style.setProperty('--dx', rnd(-60, 60) + 'px'); h.style.setProperty('--dy', rnd(-90, -40) + 'px'); h.style.animationDelay = (i * 0.04) + 's'; like.appendChild(h); setTimeout(() => h.remove(), 1400); } audio.chime(); }
  };
  // «Поделиться»: системное меню, а если его нет — Telegram, VK, WhatsApp, копирование ссылки
  const meta = document.querySelector('meta[property="og:url"]')?.content;
  const url = meta || (location.origin + location.pathname), text = 'Toi et Moi — сборник стихов Артёма Торгашева';
  const menu = $('#share-menu');
  menu.querySelector('[data-net="tg"]').href = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  menu.querySelector('[data-net="vk"]').href = `https://vk.com/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`;
  menu.querySelector('[data-net="wa"]').href = `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`;
  menu.querySelector('[data-net="copy"]').onclick = async () => {
    try { await navigator.clipboard.writeText(url); toast('Ссылка скопирована'); } catch (e) { toast(url); }
  };
  $('#share').onclick = async () => {
    if (navigator.share) { try { await navigator.share({ title: 'Toi et Moi', text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    menu.hidden = !menu.hidden;
  };
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200); }

startCamera();
const fontLoads = document.fonts ? Promise.all(['18px Gelasio', 'italic 18px Gelasio', '18px "PT Serif"', 'italic 18px "PT Serif"', '40px "Ms Madi"', '14px Manrope']
  .map((f) => document.fonts.load(f, 'Aa Яя éà').catch(() => null))) : Promise.resolve();
const fontsReady = Promise.race([fontLoads.then(() => document.fonts.ready), new Promise((r) => setTimeout(r, 3500))]);
fontsReady.then(() => {
  buildSheets(); buildWords(); buildToc(); buildFinale(); buildGlyphs(); updateHud();
  document.body.classList.add('ready');
  requestAnimationFrame(frame);
  if (SHOT) {
    enter(false);
    if (SHOT === 'overview') { overview(); flight.dur = 0.01; }
    else if (SHOT.startsWith('poem:')) { const si = STOPS.findIndex((s) => idOf(s) === SHOT.slice(5)); focusStop(si, null, { dur: 0.01 }); }
    else if (SHOT === 'finale') { focusStop(NS - 1, null, { dur: 0.01 }); setTimeout(() => finale(), 600); }
    window.__fin = () => fin;
    window.__dbg = { get fps() { return 1000 / ftAvg; } };
  }
});
