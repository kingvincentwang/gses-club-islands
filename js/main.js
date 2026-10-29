import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { SCHOOL, CATEGORIES, CLUBS, QUOTES } from './data.js';

const $ = (s) => document.querySelector(s);
const DAY = ['日', '一', '二', '三', '四', '五', '六'];
const catById = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 無痕模式 */ } },
};

/* =========================================================
 * 時間與社團狀態
 * ======================================================= */
let simOffset = 0;
const now = () => new Date(Date.now() + simOffset);
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const pad = (n) => String(n).padStart(2, '0');

function clubStatus(c, d = now()) {
  const dow = d.getDay();
  const m = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  const s = toMin(c.time[0]), e = toMin(c.time[1]);
  if (c.days.includes(dow)) {
    if (m >= s && m < e) return { state: 'live', progress: (m - s) / (e - s), left: Math.ceil(e - m) };
    if (m < s) return { state: s - m <= 60 ? 'soon' : 'today', in: Math.ceil(s - m) };
  }
  let k = 1;
  while (!c.days.includes((dow + k) % 7)) k++;
  return { state: c.days.includes(dow) ? 'done' : 'later', inDays: k, nextDow: (dow + k) % 7 };
}
function statusText(st, c) {
  switch (st.state) {
    case 'live': return `上課中・剩 ${st.left} 分`;
    case 'soon': return `${st.in} 分鐘後開始`;
    case 'today': return `今天 ${c.time[0]} 開始`;
    case 'done': return `今日已下課・下次週${DAY[st.nextDow]}`;
    default: return st.inDays === 1 ? `明天 ${c.time[0]} 上課` : `週${DAY[st.nextDow]} ${c.time[0]} 上課`;
  }
}
const chipHTML = (st, c) => `<span class="chip st-${st.state}">${statusText(st, c)}</span>`;
const dayText = (c) => c.days.map((d) => '週' + DAY[d]).join('、');
const gradeText = (c) => `${c.grade[0]}–${c.grade[1]} 年級`;

/* =========================================================
 * 基本場景
 * ======================================================= */
const host = $('#scene');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
host.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(innerWidth, innerHeight);
labelRenderer.domElement.className = 'labels';
host.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xffe9d6, 90, 260);
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.5, 900);
const HOME = { pos: new THREE.Vector3(0, 34, 62), target: new THREE.Vector3(0, -1, 0) };
camera.position.copy(HOME.pos);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(HOME.target);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 10;
controls.maxDistance = 200;
controls.maxPolarAngle = Math.PI * 0.47;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;

// 天空漸層
const skyU = { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } };
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(500, 32, 16),
  new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vW;
      void main(){ float h = normalize(vW + vec3(0.,20.,0.)).y; gl_FragColor = vec4(mix(bottom, top, pow(max(h,0.), .5)), 1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  }),
);
scene.add(sky);

const hemi = new THREE.HemisphereLight(0xfff4e0, 0x8fa9c9, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 220 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

/* =========================================================
 * 小工具
 * ======================================================= */
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); };
const matCache = new Map();
function mat(color, opts) {
  if (opts) return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...opts });
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85 }));
  return matCache.get(color);
}
function mesh(geo, color, opts) {
  const m = new THREE.Mesh(geo, typeof color === 'string' || typeof color === 'number' ? mat(color, opts) : color);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function at(obj, x, y, z) { obj.position.set(x, y, z); return obj; }
// 頂點擾動：同一位置的頂點位移相同，接縫不會裂開，做出手捏陶土感
function jitter(geo, amt, ySc = 0.3, seed = 0) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const h1 = hash(v.x + seed, v.y, v.z), h2 = hash(v.z, v.x + seed, v.y + 3.1);
    if (Math.hypot(v.x, v.z) > 0.001) { const k = 1 + (h1 - 0.5) * amt; v.x *= k; v.z *= k; }
    v.y += (h2 - 0.5) * amt * ySc;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}
function label(html, cls, onClick) {
  const el = document.createElement('div');
  el.className = cls;
  el.innerHTML = html;
  if (onClick) el.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  return new CSS2DObject(el);
}

const spinners = [];   // {obj, axis, speed}
const bobbers = [];    // {obj, base, amp, speed, phase}
const flags = [];      // 會飄的旗子
const clubHouses = []; // 社團小屋
const pickables = [];

/* =========================================================
 * 島嶼本體
 * ======================================================= */
function makeIsland(r, grass, seed) {
  const g = new THREE.Group();
  const R = rng(seed * 997);
  const top = mesh(jitter(new THREE.CylinderGeometry(r, r * 0.97, 0.7, 14, 1), 0.1, 0, seed), grass);
  top.position.y = -0.35;
  const soil = mesh(jitter(new THREE.CylinderGeometry(r * 0.97, r * 0.82, 1.5, 14, 1), 0.13, 0.25, seed + 1), '#c48c5c');
  soil.position.y = -1.45;
  const rockH = r * 1.75;
  const rock = mesh(jitter(new THREE.ConeGeometry(r * 0.82, rockH, 14, 4), 0.38, 0.35, seed + 2), '#a08a76');
  rock.rotation.x = Math.PI;
  rock.position.y = -2.2 - rockH / 2;
  g.add(top, soil, rock);
  // 岩塊點綴
  for (let i = 0; i < 6; i++) {
    const a = R() * Math.PI * 2, d = r * (0.55 + R() * 0.2);
    const b = mesh(new THREE.DodecahedronGeometry(0.6 + R() * 0.9, 0), R() > 0.5 ? '#8c7663' : '#b39a82');
    at(b, Math.cos(a) * d, -2.6 - R() * r * 0.6, Math.sin(a) * d).rotation.set(R() * 3, R() * 3, 0);
    g.add(b);
  }
  // 垂下的藤蔓
  for (let i = 0; i < 9; i++) {
    const a = R() * Math.PI * 2, len = 0.8 + R() * 2.2;
    const v = mesh(new THREE.CylinderGeometry(0.06, 0.03, len, 4), '#5d9e4f');
    at(v, Math.cos(a) * r * 0.93, -0.6 - len / 2, Math.sin(a) * r * 0.93);
    g.add(v);
  }
  // 草緣小草叢
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + R() * 0.3;
    const t = mesh(new THREE.ConeGeometry(0.18, 0.45, 4), '#6cb85e');
    at(t, Math.cos(a) * r * 0.9, 0.2, Math.sin(a) * r * 0.9);
    g.add(t);
  }
  // 周圍的小浮石
  for (let i = 0; i < 3; i++) {
    const a = R() * Math.PI * 2, d = r + 1.5 + R() * 2.5;
    const s = new THREE.Group();
    const rk = mesh(jitter(new THREE.ConeGeometry(0.7 + R() * 0.5, 1.6, 6, 1), 0.3, 0.3, seed + i), '#a08a76');
    rk.rotation.x = Math.PI;
    const gr = mesh(new THREE.CylinderGeometry(0.75 + R() * 0.4, 0.7, 0.25, 6), grass);
    gr.position.y = 0.85;
    s.add(rk, gr);
    at(s, Math.cos(a) * d, -2 - R() * 3, Math.sin(a) * d);
    g.add(s);
    bobbers.push({ obj: s, base: s.position.y, amp: 0.35, speed: 0.6 + R() * 0.5, phase: R() * 6 });
  }
  return g;
}

function tree(R, s = 1) {
  const t = new THREE.Group();
  const greens = ['#5fae5a', '#78c26a', '#4f9a55', '#8fcf6e', '#6fb06a'];
  t.add(at(mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.9, 6), '#8b5a3c'), 0, 0.45, 0));
  if (R() < 0.55) {
    t.add(at(mesh(new THREE.IcosahedronGeometry(0.75, 0), greens[(R() * 5) | 0]), 0, 1.35, 0));
    t.add(at(mesh(new THREE.IcosahedronGeometry(0.5, 0), greens[(R() * 5) | 0]), 0.35, 1.85, 0.1));
  } else {
    const c = greens[(R() * 5) | 0];
    t.add(at(mesh(new THREE.ConeGeometry(0.8, 1.2, 7), c), 0, 1.2, 0));
    t.add(at(mesh(new THREE.ConeGeometry(0.6, 1, 7), c), 0, 1.85, 0));
  }
  t.scale.setScalar(s);
  t.rotation.y = R() * 6;
  return t;
}
function flowers(R, n, r) {
  const g = new THREE.Group();
  const cols = ['#ff8fab', '#ffd166', '#ffffff', '#c77dff', '#ff9f68'];
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, d = R() * r;
    g.add(at(mesh(new THREE.SphereGeometry(0.09, 5, 4), cols[(R() * 5) | 0]), Math.cos(a) * d, 0.1, Math.sin(a) * d));
  }
  return g;
}
// 佔位：避免樹、屋重疊
function Placer(rMax) {
  const used = [];
  return {
    take(x, z, r) { used.push({ x, z, r }); },
    find(R, r, inner = 0, tries = 60) {
      for (let i = 0; i < tries; i++) {
        const a = R() * Math.PI * 2, d = inner + Math.sqrt(R()) * (rMax - inner);
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (used.every((u) => Math.hypot(u.x - x, u.z - z) > u.r + r)) { used.push({ x, z, r }); return { x, z }; }
      }
      return null;
    },
  };
}

/* =========================================================
 * 社團小屋
 * ======================================================= */
function makeHouse(club, cat) {
  const h = new THREE.Group();
  h.add(at(mesh(new THREE.BoxGeometry(1.6, 1.2, 1.4), '#fff3dc'), 0, 0.6, 0));
  const roof = mesh(new THREE.ConeGeometry(1.32, 0.95, 4), cat.roof);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 0.9);
  h.add(at(roof, 0, 1.67, 0));
  h.add(at(mesh(new THREE.BoxGeometry(0.42, 0.68, 0.06), '#8b5a3c'), 0, 0.34, 0.71));
  const winMat = new THREE.MeshStandardMaterial({ color: '#ffe9a8', emissive: '#ffbf3c', emissiveIntensity: 0.2, flatShading: true });
  for (const x of [-0.52, 0.52]) h.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.06), winMat), x, 0.78, 0.71));
  h.add(at(mesh(new THREE.BoxGeometry(0.22, 0.5, 0.22), '#b5654a'), 0.4, 1.9, -0.2));
  // 門牌編號
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const cx = cv.getContext('2d');
  cx.fillStyle = cat.roof; cx.beginPath(); cx.arc(32, 32, 30, 0, 7); cx.fill();
  cx.fillStyle = '#fff'; cx.font = 'bold 34px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(club.no, 32, 35);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  h.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), new THREE.MeshBasicMaterial({ map: tex })), 0, 0.82, 0.75));
  // 旗桿＋旗子
  h.add(at(mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 5), '#ddd'), 1.0, 1.3, 0.55));
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.45, 8, 1), new THREE.MeshStandardMaterial({ color: cat.roof, side: THREE.DoubleSide, flatShading: true }));
  flag.castShadow = true;
  flag.userData.base = flag.geometry.attributes.position.array.slice();
  at(flag, 1.4, 1.3, 0.55);
  h.add(flag);
  flags.push(flag);
  // 上課中光環
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.08, 6, 32), new THREE.MeshBasicMaterial({ color: '#ff5b61', transparent: true, opacity: 0.9 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; ring.visible = false;
  h.add(ring);

  const lb = label(`<b>${club.name}</b><span>${dayText(club)} ${club.time[0]}</span>`, 'hlabel', () => openClub(club));
  lb.position.set(0, 2.8, 0);
  h.add(lb);

  h.userData = { type: 'club', club, winMat, flag, ring, label: lb.element, live: false };
  clubHouses.push(h);
  pickables.push(h);
  return h;
}

/* =========================================================
 * 各島主題地標
 * ======================================================= */
const smoke = [];
const landmarks = {
  ball(g) {
    const court = new THREE.Group();
    court.add(at(mesh(new THREE.BoxGeometry(4.6, 0.08, 2.8), '#4f9fd6'), 0, 0.04, 0));
    for (const [w, d, x, z] of [[4.4, 0.06, 0, 1.3], [4.4, 0.06, 0, -1.3], [0.06, 2.6, 2.2, 0], [0.06, 2.6, -2.2, 0], [0.06, 2.6, 0, 0]])
      court.add(at(mesh(new THREE.BoxGeometry(w, 0.1, d), '#ffffff'), x, 0.05, z));
    court.add(at(mesh(new THREE.BoxGeometry(0.05, 0.6, 2.8), '#f5f5f5', { transparent: true, opacity: 0.75 }), 0, 0.5, 0));
    for (const z of [-1.45, 1.45]) court.add(at(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 5), '#777'), 0, 0.5, z));
    // 羽毛球
    const sh = new THREE.Group();
    sh.add(at(mesh(new THREE.SphereGeometry(0.18, 8, 6), '#ffffff'), 0, 0, 0));
    sh.add(at(mesh(new THREE.ConeGeometry(0.32, 0.6, 10, 1, true), '#fff8e8'), 0, 0.35, 0));
    sh.rotation.z = 0.5;
    at(sh, 0, 2.2, 0); court.add(sh);
    bobbers.push({ obj: sh, base: 2.2, amp: 0.4, speed: 1.6, phase: 0 });
    spinners.push({ obj: sh, axis: 'y', speed: 1.2 });
    g.add(court);
    // 籃球架
    const hoop = new THREE.Group();
    hoop.add(at(mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6), '#666'), 0, 1.3, 0));
    hoop.add(at(mesh(new THREE.BoxGeometry(0.9, 0.6, 0.06), '#ffffff'), 0, 2.6, 0.12));
    const rim = at(mesh(new THREE.TorusGeometry(0.22, 0.03, 5, 14), '#ff6b2c'), 0, 2.4, 0.4); rim.rotation.x = Math.PI / 2;
    hoop.add(rim);
    const ball = at(mesh(new THREE.IcosahedronGeometry(0.28, 1), '#f07a2c'), 0.5, 0.28, 1.2);
    hoop.add(ball);
    hoop.position.set(-3.6, 0, -1.2); hoop.rotation.y = 0.7;
    g.add(hoop);
  },
  wheel(g) {
    const track = mesh(new THREE.TorusGeometry(2.4, 0.42, 4, 36), '#8a8f99');
    track.rotation.x = -Math.PI / 2; track.scale.set(1.25, 1, 0.3); track.position.y = 0.06;
    g.add(track);
    g.add(at(mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.1, 30), '#a9e1f0'), 0, 0.05, 0)).children.at(-1).scale.set(1.25, 1, 1);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.add(at(mesh(new THREE.ConeGeometry(0.14, 0.4, 6), '#ff7a2c'), Math.cos(a) * 1.3, 0.25, Math.sin(a) * 1.0));
    }
    // 繞圈的小滑輪人（圓球＋鞋）
    const skater = new THREE.Group();
    skater.add(at(mesh(new THREE.CapsuleGeometry(0.2, 0.35, 3, 6), '#3d7fc4'), 0, 0.55, 0));
    skater.add(at(mesh(new THREE.SphereGeometry(0.18, 8, 6), '#ffd9b8'), 0, 1.0, 0));
    skater.add(at(mesh(new THREE.SphereGeometry(0.19, 8, 6, 0, 6.3, 0, 1.6), '#f2c230'), 0, 1.03, 0));
    skater.add(at(mesh(new THREE.BoxGeometry(0.45, 0.12, 0.2), '#e04848'), 0, 0.14, 0));
    g.add(skater);
    g.userData.skater = skater;
  },
  bake(g) {
    const cake = new THREE.Group();
    cake.add(at(mesh(jitter(new THREE.CylinderGeometry(1.3, 0.95, 1.3, 14), 0.04, 0), '#f6a5b5'), 0, 0.65, 0));
    for (let i = 0; i < 3; i++) cake.add(at(mesh(new THREE.SphereGeometry(1.35 - i * 0.35, 12, 8), '#fff4e6'), 0, 1.45 + i * 0.45, 0));
    cake.add(at(mesh(new THREE.SphereGeometry(0.25, 10, 8), '#e2343f'), 0, 2.85, 0));
    const R = rng(7);
    for (let i = 0; i < 18; i++) {
      const a = R() * 6.28, y = 1.5 + R() * 1.1, rr = 1.32 - (y - 1.45) * 0.55;
      cake.add(at(mesh(new THREE.BoxGeometry(0.12, 0.05, 0.05), ['#ff6fa1', '#6fd0ff', '#ffd23f', '#8bdc6a'][i % 4]), Math.cos(a) * rr, y, Math.sin(a) * rr));
    }
    g.add(cake);
    spinners.push({ obj: cake, axis: 'y', speed: 0.25 });
    // 烤箱小屋＋煙
    const oven = new THREE.Group();
    oven.add(at(mesh(new THREE.CylinderGeometry(0.9, 1.0, 1.1, 10), '#d89a6a'), 0, 0.55, 0));
    oven.add(at(mesh(new THREE.SphereGeometry(0.92, 10, 6, 0, 6.3, 0, 1.6), '#c47f52'), 0, 1.1, 0));
    oven.add(at(mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.9, 6), '#9e5b3d'), 0.3, 1.9, 0));
    oven.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.35, 12, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#ff9a3c' })), 0, 0.2, 1.0));
    oven.position.set(-3.4, 0, 1.6);
    oven.rotation.y = 0.6;
    g.add(oven);
    const smat = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, flatShading: true });
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), smat.clone());
      p.userData = { t: i / 6, origin: new THREE.Vector3(0.3, 2.4, 0) };
      oven.add(p); smoke.push(p);
    }
  },
  art(g) {
    const pal = new THREE.Group();
    pal.add(mesh(jitter(new THREE.CylinderGeometry(1.8, 1.8, 0.18, 18), 0.12, 0, 4), '#e8c49a'));
    const cols = ['#e63946', '#f4a261', '#ffd23f', '#2a9d8f', '#457b9d', '#9b5de5'];
    cols.forEach((c, i) => {
      const a = (i / cols.length) * Math.PI * 1.6 + 0.3;
      pal.add(at(mesh(new THREE.SphereGeometry(0.28, 8, 5), c), Math.cos(a) * 1.15, 0.12, Math.sin(a) * 1.15)).children.at(-1).scale.y = 0.45;
    });
    pal.rotation.set(-0.35, 0, 0.15); pal.position.y = 1.0;
    g.add(pal);
    bobbers.push({ obj: pal, base: 1.0, amp: 0.2, speed: 1, phase: 1 });
    const brush = new THREE.Group();
    brush.add(at(mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.4, 6), '#c0392b'), 0, 1.2, 0));
    brush.add(at(mesh(new THREE.ConeGeometry(0.14, 0.45, 6), '#3a2a1a'), 0, 2.6, 0));
    brush.rotation.z = -0.5; brush.position.set(1.6, 0.6, 0.6);
    g.add(brush);
    // 畫架
    const easel = new THREE.Group();
    for (const x of [-0.4, 0.4]) easel.add(at(mesh(new THREE.BoxGeometry(0.08, 2, 0.08), '#a0703c'), x, 1, 0)).children.at(-1).rotation.z = x * -0.25;
    easel.add(at(mesh(new THREE.BoxGeometry(1.2, 0.9, 0.06), '#ffffff'), 0, 1.35, 0.08));
    easel.add(at(mesh(new THREE.CircleGeometry(0.25, 10), '#ff8fab'), -0.15, 1.4, 0.12));
    easel.add(at(mesh(new THREE.CircleGeometry(0.18, 10), '#6fd0ff'), 0.25, 1.25, 0.12));
    easel.position.set(-3.2, 0, 1.4); easel.rotation.y = 0.8;
    g.add(easel);
  },
  dance(g) {
    g.add(at(mesh(new THREE.CylinderGeometry(2.3, 2.5, 0.5, 20), '#f3e1ff'), 0, 0.25, 0));
    g.add(at(mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.08, 20), '#b48ce8'), 0, 0.54, 0));
    const disco = mesh(new THREE.IcosahedronGeometry(0.55, 1), '#e6e6f0', { metalness: 0.9, roughness: 0.25 });
    at(disco, 0, 3.4, 0);
    g.add(disco, at(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 4), '#999'), 0, 4.4, 0));
    spinners.push({ obj: disco, axis: 'y', speed: 1.2 });
    const beams = new THREE.Group();
    ['#ff6fa1', '#6fd0ff', '#ffd23f'].forEach((c, i) => {
      const b = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3, 12, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
      const a = (i / 3) * Math.PI * 2;
      b.position.set(Math.cos(a) * 0.9, 2.0, Math.sin(a) * 0.9);
      b.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
      beams.add(b);
    });
    g.add(beams);
    spinners.push({ obj: beams, axis: 'y', speed: 0.8 });
    // 音符
    const note = new THREE.Group();
    note.add(at(mesh(new THREE.SphereGeometry(0.22, 8, 6), '#4a3426'), 0, 0, 0));
    note.add(at(mesh(new THREE.BoxGeometry(0.06, 0.8, 0.06), '#4a3426'), 0.2, 0.4, 0));
    at(note, -1.4, 2.2, 0.6); g.add(note);
    bobbers.push({ obj: note, base: 2.2, amp: 0.35, speed: 2, phase: 0 });
  },
  tech(g) {
    const bot = new THREE.Group();
    bot.add(at(mesh(new THREE.BoxGeometry(1.2, 1.2, 0.9), '#f2c230'), 0, 1.1, 0));
    bot.add(at(mesh(new THREE.BoxGeometry(0.9, 0.75, 0.75), '#e94f37'), 0, 2.1, 0));
    for (const x of [-0.2, 0.2]) bot.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: '#7ef9ff' })), x, 2.15, 0.39));
    bot.add(at(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4), '#777'), 0, 2.7, 0));
    bot.add(at(mesh(new THREE.SphereGeometry(0.1, 6, 5), '#e94f37'), 0, 2.98, 0));
    for (const x of [-0.75, 0.75]) bot.add(at(mesh(new THREE.BoxGeometry(0.28, 0.9, 0.28), '#3d7fc4'), x, 1.1, 0));
    for (const x of [-0.3, 0.3]) bot.add(at(mesh(new THREE.BoxGeometry(0.35, 0.5, 0.4), '#3d7fc4'), x, 0.25, 0));
    for (const [x, z] of [[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.2], [0.3, 0.2]]) bot.add(at(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 8), '#f2c230'), x, 1.74, z));
    g.add(bot);
    g.userData.bot = bot;
    const gear = (r, c) => {
      const gg = new THREE.Group();
      gg.add(mesh(new THREE.CylinderGeometry(r, r, 0.22, 16), c));
      const n = Math.round(r * 10);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const t = at(mesh(new THREE.BoxGeometry(0.22, 0.22, 0.26), c), Math.cos(a) * (r + 0.08), 0, Math.sin(a) * (r + 0.08));
        t.rotation.y = -a; gg.add(t);
      }
      gg.add(at(mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.3, 0.3, 8), '#555'), 0, 0, 0));
      gg.rotation.x = Math.PI / 2;
      return gg;
    };
    const g1 = gear(0.9, '#9aa5b1'), g2 = gear(0.55, '#e0a030');
    const w1 = new THREE.Group(); w1.add(g1); w1.position.set(-2.8, 1.3, 1.2); w1.rotation.y = 0.7;
    const w2 = new THREE.Group(); w2.add(g2); w2.position.set(-2.8 + 1.08, 1.3 + 0.75, 1.2 - 0.95); w2.rotation.y = 0.7;
    g.add(w1, w2);
    spinners.push({ obj: g1, axis: 'y', speed: 0.8 }, { obj: g2, axis: 'y', speed: -1.3 });
    for (const [x, z, c] of [[2.6, 1.6, '#e94f37'], [2.9, 0.8, '#3d7fc4'], [2.7, 1.2, '#4caf6a']]) {
      const brick = new THREE.Group();
      brick.add(at(mesh(new THREE.BoxGeometry(0.8, 0.4, 0.4), c), 0, 0.2, 0));
      for (const bx of [-0.2, 0.2]) brick.add(at(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.1, 8), c), bx, 0.45, 0));
      brick.position.set(x, c === '#4caf6a' ? 0.4 : 0, z);
      g.add(brick);
    }
  },
};

/* =========================================================
 * 中央校園島
 * ======================================================= */
const clockCanvas = document.createElement('canvas');
clockCanvas.width = clockCanvas.height = 256;
const clockTex = new THREE.CanvasTexture(clockCanvas);
clockTex.colorSpace = THREE.SRGBColorSpace;
function drawClock() {
  const c = clockCanvas.getContext('2d'), d = now();
  c.clearRect(0, 0, 256, 256);
  c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(128, 128, 120, 0, 7); c.fill();
  c.lineWidth = 10; c.strokeStyle = '#4a3426'; c.stroke();
  c.fillStyle = '#4a3426';
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; c.beginPath(); c.arc(128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96, i % 3 ? 5 : 9, 0, 7); c.fill(); }
  const hand = (a, len, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + Math.sin(a) * len, 128 - Math.cos(a) * len); c.stroke(); };
  const h = d.getHours() % 12 + d.getMinutes() / 60, m = d.getMinutes() + d.getSeconds() / 60;
  hand((h / 12) * Math.PI * 2, 55, 12, '#4a3426');
  hand((m / 60) * Math.PI * 2, 82, 8, '#4a3426');
  hand((d.getSeconds() / 60) * Math.PI * 2, 90, 3, '#f08a3c');
  c.fillStyle = '#f08a3c'; c.beginPath(); c.arc(128, 128, 9, 0, 7); c.fill();
  clockTex.needsUpdate = true;
}

const schoolWindows = [];
// 中央島的社團報名處：點攤位或標籤就開啟報名系統
function signupBooth() {
  const b = new THREE.Group();
  for (const [x, z] of [[-0.8, -0.5], [0.8, -0.5], [-0.8, 0.5], [0.8, 0.5]]) b.add(at(mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 5), '#a47243'), x, 1.1, z));
  b.add(at(mesh(new THREE.BoxGeometry(1.9, 0.8, 1.2), '#fff3dc'), 0, 0.4, 0));
  b.add(at(mesh(new THREE.BoxGeometry(2.0, 0.1, 1.3), '#a47243'), 0, 0.85, 0));
  // 紅白條紋遮雨棚
  for (let i = 0; i < 5; i++) {
    const s = mesh(new THREE.BoxGeometry(0.42, 0.08, 1.55), i % 2 ? '#ffffff' : '#e8484f');
    s.position.set(-0.84 + i * 0.42, 2.3, 0); s.rotation.x = 0.18;
    b.add(s);
  }
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96;
  const c = cv.getContext('2d');
  c.fillStyle = '#f08a3c'; c.fillRect(0, 0, 256, 96);
  c.fillStyle = '#fff'; c.font = 'bold 50px "Noto Sans TC", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('社團報名', 128, 52);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  b.add(at(new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.64), new THREE.MeshBasicMaterial({ map: tex })), 0, 0.42, 0.61));
  // 桌上的報名表與筆
  b.add(at(mesh(new THREE.BoxGeometry(0.5, 0.03, 0.36), '#ffffff'), -0.3, 0.92, 0.1));
  b.add(at(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 5), '#3d7fc4'), 0.2, 0.93, 0.1)).children.at(-1).rotation.z = Math.PI / 2;
  const arrow = mesh(new THREE.ConeGeometry(0.28, 0.5, 6), '#ffd23f');
  arrow.rotation.x = Math.PI;
  at(arrow, 0, 3.2, 0);
  b.add(arrow);
  bobbers.push({ obj: arrow, base: 3.2, amp: 0.25, speed: 3, phase: 0 });
  spinners.push({ obj: arrow, axis: 'y', speed: 1.5 });
  const lb = label('<span class="nudge">📝 社團報名處</span>', 'ilabel signup', openSignup);
  lb.position.set(0, 4.1, 0);
  b.add(lb);
  b.position.set(7.4, 0, 3.2);
  b.rotation.y = 1.0;
  b.userData = { type: 'signup' };
  pickables.push(b);
  return b;
}
function openSignup() {
  window.open(SCHOOL.signupUrl, '_blank', 'noopener');
  toast('📝 已在新分頁開啟社團報名系統');
}

function buildSchool(g) {
  const R = rng(42);
  // 跑道與操場
  const trackM = mesh(new THREE.TorusGeometry(5.8, 0.55, 3, 48), '#d9684a');
  trackM.rotation.x = -Math.PI / 2; trackM.scale.set(1, 0.62, 0.15); trackM.position.set(0, 0.03, 3.4);
  g.add(trackM);
  // 主建築（L 型校舍）
  const bldg = new THREE.Group();
  const wing = (w, d, x, z, ry) => {
    const b = new THREE.Group();
    b.add(at(mesh(new THREE.BoxGeometry(w, 2.6, d), '#fbeedd'), 0, 1.3, 0));
    b.add(at(mesh(new THREE.BoxGeometry(w + 0.2, 0.25, d + 0.3), '#d9684a'), 0, 1.35, 0));
    const roof = mesh(new THREE.CylinderGeometry(0.01, d * 0.72, w + 0.3, 4, 1), '#c95b3c');
    roof.rotation.set(0, 0, Math.PI / 2); roof.scale.set(1, 1, 0.6); roof.position.y = 3.05;
    b.add(roof);
    const wm = new THREE.MeshStandardMaterial({ color: '#cfe8ff', emissive: '#ffc94a', emissiveIntensity: 0.1, flatShading: true });
    schoolWindows.push(wm);
    for (let i = 0; i < Math.floor(w / 0.9); i++) {
      for (const y of [0.75, 1.95]) b.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 0.05), wm), -w / 2 + 0.6 + i * 0.9, y, d / 2 + 0.01));
    }
    b.position.set(x, 0, z); b.rotation.y = ry;
    return b;
  };
  bldg.add(wing(9, 2.2, 0, -3.4, 0), wing(5, 2.2, -5.6, -0.8, Math.PI / 2));
  // 鐘塔
  const tower = new THREE.Group();
  tower.add(at(mesh(new THREE.BoxGeometry(2, 5.2, 2), '#fff3e0'), 0, 2.6, 0));
  tower.add(at(mesh(new THREE.ConeGeometry(1.7, 1.6, 4), '#c95b3c'), 0, 6.0, 0)).children.at(-1).rotation.y = Math.PI / 4;
  tower.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.75, 32), new THREE.MeshBasicMaterial({ map: clockTex })), 0, 4.2, 1.02));
  tower.add(at(mesh(new THREE.BoxGeometry(0.7, 1.1, 0.06), '#8b5a3c'), 0, 0.55, 1.01));
  tower.position.set(0, 0, -3.0);
  bldg.add(tower);
  g.add(bldg);
  // 校旗
  g.add(at(mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.5, 6), '#dddddd'), 3.2, 2.25, -0.6));
  const sf = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8, 10, 1), new THREE.MeshStandardMaterial({ color: '#f08a3c', side: THREE.DoubleSide, flatShading: true }));
  sf.userData.base = sf.geometry.attributes.position.array.slice();
  at(sf, 3.9, 4.0, -0.6); g.add(sf); flags.push(sf);
  // 大榕樹
  const big = new THREE.Group();
  big.add(at(mesh(new THREE.CylinderGeometry(0.35, 0.55, 2.2, 7), '#7b4b2e'), 0, 1.1, 0));
  for (const [x, y, z, s] of [[0, 2.8, 0, 1.6], [1, 2.4, 0.4, 1.1], [-0.9, 2.5, -0.3, 1.2], [0.2, 3.5, -0.5, 1.0]])
    big.add(at(mesh(new THREE.IcosahedronGeometry(s, 0), '#5a9e4f'), x, y, z));
  big.position.set(6.2, 0, -3.2);
  g.add(big);
  const P = Placer(8.5);
  P.take(0, -3, 5.5); P.take(-5.6, -1, 2.5); P.take(0, 3.4, 5.8); P.take(6.2, -3.2, 2); P.take(3.2, -0.6, 0.8); P.take(7.4, 3.2, 1.8);
  if (SCHOOL.signupUrl) g.add(signupBooth());
  for (let i = 0; i < 10; i++) { const s = P.find(R, 0.9, 5); if (s) g.add(at(tree(R, 0.8 + R() * 0.4), s.x, 0, s.z)); }
  g.add(flowers(R, 40, 8.5));
  const lb = label(`<span>🏫</span> ${SCHOOL.name}・社團群島`, 'ilabel school', () => focusIsland('school'));
  lb.position.set(0, 8.2, -3);
  g.add(lb);
}

/* =========================================================
 * 建立群島
 * ======================================================= */
const world = new THREE.Group();
scene.add(world);
const islands = {}; // id -> {group, cat, pos, r, labelEl}
const CENTER_R = 10, SAT_R = 7.6, RING = 28;
const heights = [1.4, -0.8, 1.9, -0.4, 0.9, -1.4];

{
  const g = makeIsland(CENTER_R, '#86c96e', 1);
  buildSchool(g);
  g.userData = { type: 'island', id: 'school' };
  world.add(g);
  pickables.push(g);
  islands.school = { group: g, pos: new THREE.Vector3(), r: CENTER_R };
}

CATEGORIES.forEach((cat, i) => {
  const a = (i / CATEGORIES.length) * Math.PI * 2 - Math.PI / 2;
  const pos = new THREE.Vector3(Math.cos(a) * RING, heights[i], Math.sin(a) * RING);
  const g = makeIsland(SAT_R, cat.color, i + 2);
  g.position.copy(pos);
  g.userData = { type: 'island', id: cat.id };
  landmarks[cat.id](g);

  // 社團小屋沿外圈排列，留出橋頭缺口
  const clubs = CLUBS.filter((c) => c.category === cat.id);
  const P = Placer(SAT_R - 0.8);
  P.take(0, 0, 3.0);
  const inward = Math.atan2(-pos.z, -pos.x);
  const n = clubs.length, arc = Math.PI * 2 - 1.3;
  const step = Math.min(1.0, arc / Math.max(n, 1));
  const small = n > 8;
  clubs.forEach((c, k) => {
    const ang = inward + Math.PI + (k - (n - 1) / 2) * step;
    const rr = small ? (k % 2 ? SAT_R * 0.78 : SAT_R * 0.52) : SAT_R * 0.64;
    const h = makeHouse(c, cat);
    h.position.set(Math.cos(ang) * rr, 0, Math.sin(ang) * rr);
    h.rotation.y = Math.PI / 2 - ang; // 門朝外
    if (small) h.scale.setScalar(0.75);
    P.take(h.position.x, h.position.z, 1.4);
    g.add(h);
  });
  // 橋頭石板路
  for (let s = 0; s < 4; s++) {
    const d = SAT_R - 0.9 - s * 1.0;
    g.add(at(mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.08, 7), '#e8dccb'), Math.cos(inward) * d, 0.04, Math.sin(inward) * d));
    P.take(Math.cos(inward) * d, Math.sin(inward) * d, 0.6);
  }
  const R = rng(i * 31 + 5);
  for (let t = 0; t < 9; t++) { const s = P.find(R, 0.8, 2.5); if (s) g.add(at(tree(R, 0.7 + R() * 0.5), s.x, 0, s.z)); }
  g.add(flowers(R, 30, SAT_R - 0.8));

  const lb = label('', 'ilabel', () => focusIsland(cat.id));
  lb.element.style.setProperty('--c', cat.color);
  lb.position.set(0, 6.2, 0);
  g.add(lb);

  world.add(g);
  pickables.push(g);
  islands[cat.id] = { group: g, cat, pos, r: SAT_R, labelEl: lb.element, clubs };
});

// 吊橋
function bridge(a, b) {
  const g = new THREE.Group();
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
  const pt = (t, off = 0, lift = 0) => new THREE.Vector3().lerpVectors(a, b, t).addScaledVector(side, off).setY(THREE.MathUtils.lerp(a.y, b.y, t) - Math.sin(Math.PI * t) * 1.1 + lift);
  const n = Math.round(len / 0.55);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = pt(t), q = pt(Math.min(1, t + 0.01));
    const plank = mesh(new THREE.BoxGeometry(1.7, 0.12, 0.42), i % 3 ? '#b98654' : '#a47243');
    plank.position.copy(p);
    plank.lookAt(q.x, q.y, q.z);
    g.add(plank);
  }
  for (const off of [-0.85, 0.85]) {
    const pts = []; for (let i = 0; i <= 20; i++) pts.push(pt(i / 20, off, 0.75));
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.04, 4), '#e9d2a8'));
    for (const t of [0, 1]) {
      const p = pt(t, off, 0);
      g.add(at(mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.5, 6), '#8b5a3c'), p.x, p.y + 0.5, p.z));
    }
  }
  return g;
}
CATEGORIES.forEach((cat) => {
  const p = islands[cat.id].pos;
  const d = new THREE.Vector3(p.x, 0, p.z).normalize();
  const a = d.clone().multiplyScalar(CENTER_R - 0.5).setY(0.05);
  const b = p.clone().addScaledVector(d, -(SAT_R - 0.5)).setY(p.y + 0.05);
  world.add(bridge(a, b));
});

/* =========================================================
 * 雲海、天空、生物
 * ======================================================= */
const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.35, flatShading: true, roughness: 1 });
const SEA = 420;
const sea = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), cloudMat, SEA);
const seaData = [];
{
  const R = rng(99), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < SEA; i++) {
    const a = R() * Math.PI * 2, d = 8 + Math.sqrt(R()) * 170, sc = 3 + R() * 7;
    const o = { a, d, y: -20 - R() * 5 + (d < 40 ? -4 : 0), sc, sp: 0.004 + R() * 0.006 };
    seaData.push(o);
    p.set(Math.cos(a) * d, o.y, Math.sin(a) * d); s.set(sc * 1.5, sc * 0.6, sc);
    m.compose(p, q, s); sea.setMatrixAt(i, m);
  }
}
sea.receiveShadow = true;
scene.add(sea);

const puffs = [];
function cloudPuff(R) {
  const c = new THREE.Group();
  const n = 4 + ((R() * 4) | 0);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2 + R() * 1.4, 1), cloudMat);
    m.position.set((i - n / 2) * 1.4 + R(), R() * 0.8, R() * 1.2);
    m.scale.y = 0.7;
    c.add(m);
  }
  return c;
}
{
  const R = rng(1234);
  for (let i = 0; i < 18; i++) {
    const c = cloudPuff(R);
    const o = { a: R() * Math.PI * 2, d: 45 + R() * 70, y: -6 + R() * 26, sp: (0.008 + R() * 0.012) * (R() > 0.5 ? 1 : -1) };
    c.userData = o;
    scene.add(c);
    puffs.push(c);
  }
}

// 星星
const starGeo = new THREE.BufferGeometry();
{
  const R = rng(5), arr = [];
  for (let i = 0; i < 900; i++) {
    const t = R() * Math.PI * 2, u = 0.05 + R() * 0.95;
    arr.push(Math.cos(t) * Math.sqrt(1 - u * u) * 450, u * 450, Math.sin(t) * Math.sqrt(1 - u * u) * 450);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
}
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#fffbe0', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
scene.add(stars);

// 熱氣球
const balloons = [];
['#f08a3c', '#e9a8c8', '#8fd3e8'].forEach((c, i) => {
  const b = new THREE.Group();
  const env = mesh(new THREE.SphereGeometry(2, 12, 10), c);
  env.scale.set(1, 1.15, 1); env.position.y = 4;
  const band = mesh(new THREE.CylinderGeometry(2.02, 2.02, 0.5, 12, 1, true), '#fffaf0');
  band.position.y = 4;
  b.add(env, band);
  b.add(at(mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), '#a47243'), 0, 0.35, 0));
  for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) {
    const r = mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.2, 3), '#6b4a30');
    r.position.set(x * 1.6, 1.8, z * 1.6); r.lookAt(0, 4, 0); r.rotateX(Math.PI / 2);
    b.add(r);
  }
  b.userData = { a: (i / 3) * Math.PI * 2, d: 48 + i * 9, y: 10 + i * 4, sp: 0.03 + i * 0.008 };
  scene.add(b);
  balloons.push(b);
});

// 飛鳥
const birds = [];
{
  const bm = new THREE.MeshStandardMaterial({ color: '#4a3426', side: THREE.DoubleSide, flatShading: true });
  const wing = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.25, 0, 0, 0.25, 1, 0, 0], 3));
  wing.computeVertexNormals();
  for (let i = 0; i < 12; i++) {
    const b = new THREE.Group();
    const l = new THREE.Mesh(wing, bm), r = new THREE.Mesh(wing, bm);
    r.scale.x = -1;
    b.add(l, r);
    b.userData = { l, r, a: Math.random() * 6.28, d: 30 + Math.random() * 40, y: 8 + Math.random() * 12, sp: 0.08 + Math.random() * 0.05, ph: Math.random() * 6 };
    b.scale.setScalar(0.8);
    scene.add(b);
    birds.push(b);
  }
}

// 光點（特效）
const motes = new THREE.Points(
  (() => {
    const g = new THREE.BufferGeometry(), arr = [];
    for (let i = 0; i < 260; i++) arr.push((Math.random() - 0.5) * 90, -8 + Math.random() * 30, (Math.random() - 0.5) * 90);
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    return g;
  })(),
  new THREE.PointsMaterial({ color: '#fff1b8', size: 0.35, transparent: true, opacity: 0.8, depthWrite: false }),
);
scene.add(motes);

/* =========================================================
 * 雲寶（隱藏收集物）
 * ======================================================= */
const EGG_FACTS = [
  '羽球 A、B 兩班都由謝文忠老師指導，2–6 年級可以報名！',
  '直排輪 B 在週五中午上課，適合 1–4 年級的小朋友。',
  'kiki 創意烘焙會做葡式蛋塔和萬聖節木乃伊餅乾喔！',
  '木颯黏土捏塑可以捏出「卡皮巴拉的家」！',
  'MOSA MV 流行舞最多可以收 24 位同學。',
  '樂高動力機器人會做會跑的彈力車！',
  '中央校園島的鐘塔時鐘，和你現在的時間一模一樣。',
  '你找到了搭熱氣球的雲寶！眼力真好！',
];
const found = new Set(store.get('kx-eggs', []));
const eggs = [];
function makeEgg(id) {
  const e = new THREE.Group();
  const wm = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, emissive: '#ffffff', emissiveIntensity: 0.15 });
  for (const [x, y, s] of [[0, 0, 0.55], [-0.45, -0.1, 0.38], [0.45, -0.1, 0.4], [0.1, 0.3, 0.4]]) e.add(at(new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), wm), x, y, 0));
  const eye = new THREE.MeshBasicMaterial({ color: '#2b1d14' }), pink = new THREE.MeshBasicMaterial({ color: '#ff9db0' });
  for (const x of [-0.17, 0.17]) e.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), eye), x, 0.05, 0.5));
  for (const x of [-0.32, 0.32]) e.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), pink), x, -0.08, 0.45)).children.at(-1).scale.set(1.3, 0.7, 0.5);
  e.userData = { type: 'egg', id };
  pickables.push(e);
  eggs.push(e);
  if (found.has(id)) e.visible = false;
  return e;
}
CATEGORIES.forEach((cat, i) => {
  const g = islands[cat.id].group;
  const e = makeEgg(i);
  const a = i * 1.7 + 0.6;
  if (i % 2) at(e, Math.cos(a) * SAT_R * 0.55, -4.2, Math.sin(a) * SAT_R * 0.55); // 躲在島底
  else at(e, Math.cos(a) * SAT_R * 0.85, 0.6, Math.sin(a) * SAT_R * 0.85);         // 躲在島邊
  g.add(e);
  bobbers.push({ obj: e, base: e.position.y, amp: 0.25, speed: 1.4, phase: i });
});
{
  const e = makeEgg(6); at(e, 0, 7.4, -3); e.scale.setScalar(0.7);
  islands.school.group.add(e);
  bobbers.push({ obj: e, base: 7.4, amp: 0.15, speed: 1.4, phase: 2 });
  const e2 = makeEgg(7); at(e2, 0.9, 1.0, 0); e2.scale.setScalar(0.6);
  balloons[1].add(e2);
}

/* =========================================================
 * 日夜與即時狀態
 * ======================================================= */
const C = (h) => new THREE.Color(h);
const PAL = {
  day: { top: C('#4fa8f0'), bottom: C('#fff0df'), cloud: C('#ffffff') },
  dusk: { top: C('#7d7fd1'), bottom: C('#ffb98a'), cloud: C('#ffe0cc') },
  night: { top: C('#0d1b3d'), bottom: C('#3a3f72'), cloud: C('#8d95c4') },
};
let dayK = 1;
function updateSky() {
  const d = now();
  const h = d.getHours() + d.getMinutes() / 60;
  const el = Math.sin(((h - 6) / 12) * Math.PI); // 6 點日出、18 點日落
  dayK = THREE.MathUtils.clamp(el * 2.2 + 0.15, 0, 1);
  const duskK = h > 4.5 && h < 19.5 ? THREE.MathUtils.clamp(1 - Math.abs(el) * 3.5, 0, 1) : 0;
  const mix = (k) => PAL.night[k].clone().lerp(PAL.day[k], dayK).lerp(PAL.dusk[k], duskK * 0.7);
  skyU.top.value.copy(mix('top'));
  skyU.bottom.value.copy(mix('bottom'));
  scene.fog.color.copy(skyU.bottom.value);
  cloudMat.color.copy(mix('cloud'));
  cloudMat.emissive.copy(mix('cloud'));
  cloudMat.emissiveIntensity = 0.12 + 0.3 * dayK;
  const ang = ((h - 6) / 12) * Math.PI;
  if (dayK > 0.05) sun.position.set(Math.cos(ang) * 70, Math.max(el, 0.25) * 80, 35);
  else sun.position.set(-30, 70, -40);
  sun.color.set(duskK > 0.3 ? '#ffc58f' : dayK > 0.1 ? '#fff1d6' : '#9fb4ff');
  sun.intensity = 0.35 + 1.45 * dayK;
  hemi.intensity = 0.45 + 0.75 * dayK;
  stars.material.opacity = (1 - dayK) * 0.95;
  for (const w of schoolWindows) w.emissiveIntensity = 0.1 + (1 - dayK) * 1.6;
}

let lastStates = null;
function updateLive() {
  const d = now();
  const states = new Map(CLUBS.map((c) => [c, clubStatus(c, d)]));
  // 小屋
  for (const h of clubHouses) {
    const st = states.get(h.userData.club);
    const live = st.state === 'live';
    h.userData.live = live;
    h.userData.ring.visible = live;
    h.userData.winMat.emissiveIntensity = live ? 2.4 : 0.15 + (1 - dayK) * 1.3;
    const el = h.userData.label;
    el.classList.toggle('is-live', live);
    el.querySelector('span').textContent = live ? `● 上課中・剩 ${st.left} 分` : `${dayText(h.userData.club)} ${h.userData.club.time[0]}`;
    el.classList.toggle('show', focusId === h.userData.club.category);
  }
  // 島嶼標籤
  for (const cat of CATEGORIES) {
    const isl = islands[cat.id];
    const n = isl.clubs.filter((c) => states.get(c).state === 'live').length;
    isl.labelEl.innerHTML = `<span class="em">${cat.emoji}</span><b>${cat.name}</b><small>${isl.clubs.length} 社團</small>${n ? `<span class="lv">${n} 上課中</span>` : ''}`;
  }
  // 上課提醒
  if (lastStates) {
    for (const c of CLUBS) {
      const a = lastStates.get(c).state, b = states.get(c).state;
      if (a !== 'live' && b === 'live') toast(`🔔 ${c.name} 開始上課囉！`);
      if (a === 'live' && b !== 'live') toast(`👋 ${c.name} 下課了，明天見！`);
    }
  }
  lastStates = states;
  renderLivePanel(states, d);
  if (!$('#islandPanel').hidden && focusId) renderIsland(focusId, states);
}

function renderLivePanel(states, d) {
  const dow = d.getDay();
  const today = CLUBS.filter((c) => c.days.includes(dow)).sort((a, b) => toMin(a.time[0]) - toMin(b.time[0]));
  const liveN = today.filter((c) => states.get(c).state === 'live').length;
  $('#liveStats').innerHTML = `<div><b>${CLUBS.length}</b><span>全部社團</span></div><div><b>${today.length}</b><span>今日週${DAY[dow]}</span></div><div><b style="color:var(--live)">${liveN}</b><span>上課中</span></div>`;
  const item = (c) => {
    const st = states.get(c), cat = catById[c.category];
    return `<button class="litem" style="--c:${cat.roof}" data-club="${c.no}"><span class="em">${cat.emoji}</span><span><b>${c.name}</b><small>${c.time[0]}–${c.time[1]}・${c.teacher} 老師</small><br>${chipHTML(st, c)}${st.state === 'live' ? `<div class="prog"><i style="width:${(st.progress * 100).toFixed(1)}%"></i></div>` : ''}</span></button>`;
  };
  let html = '';
  if (today.length) html += `<p class="live-sub">今日社團</p>` + today.map(item).join('');
  else html += `<p class="live-sub">今天沒有社團課，好好休息！</p>`;
  const next = CLUBS.filter((c) => !c.days.includes(dow))
    .map((c) => ({ c, st: states.get(c) }))
    .sort((a, b) => a.st.inDays - b.st.inDays || toMin(a.c.time[0]) - toMin(b.c.time[0]))
    .slice(0, 4);
  if (next.length) html += `<p class="live-sub">接下來</p>` + next.map((o) => item(o.c)).join('');
  $('#liveList').innerHTML = html;
}

/* =========================================================
 * 鏡頭飛行
 * ======================================================= */
let fly = null;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function flyTo(pos, target, dur = 1.6) {
  fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos.clone(), t1: target.clone(), s: performance.now(), dur: dur * 1000 };
}
function islandWorld(id) { return islands[id].group.getWorldPosition(new THREE.Vector3()); }

let focusId = null;
function focusIsland(id, { panel = true } = {}) {
  focusId = id;
  const p = islandWorld(id);
  const out = id === 'school' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(p.x, 0, p.z).normalize();
  const dist = (id === 'school' ? 28 : 22) * (innerWidth < innerHeight ? 1.5 : 1);
  const camPos = p.clone().addScaledVector(out, dist).add(new THREE.Vector3(0, dist * 0.65, 0));
  // 手機：面板在下方，把島放在畫面上半
  const target = p.clone().add(new THREE.Vector3(0, innerWidth < 640 ? -3 : 0.5, 0));
  flyTo(camPos, target);
  controls.autoRotate = false;
  if (panel) { renderIsland(id); shiftView(true); }
  setGuide(id === 'school' ? `歡迎來到${SCHOOL.name}！從這裡走吊橋，可以通往 6 座社團島。` : `${islands[id].cat.emoji} ${islands[id].cat.desc}`);
  updateLive();
}
function goHome(view = 'full') {
  focusId = null;
  $('#islandPanel').hidden = true;
  shiftView(false);
  if (view === 'top') flyTo(new THREE.Vector3(0, 105, 0.1), new THREE.Vector3(0, 0, 0));
  else { flyTo(HOME.pos, HOME.target); controls.autoRotate = !paused; }
  setView(view);
  updateLive();
}
// 面板開啟時把畫面往右推，讓島嶼留在面板旁的空位
let viewShift = 0, viewShiftTarget = 0, autoCollapsed = false;
function shiftView(on) {
  const wide = innerWidth >= 640;
  viewShiftTarget = on && wide ? -Math.min(200, innerWidth * 0.18) : 0;
  document.body.classList.toggle('focused', on);
  const lp = $('#livePanel');
  if (on && wide && innerWidth < 1280 && !lp.classList.contains('collapsed')) { lp.classList.add('collapsed'); $('#liveToggle').textContent = '＋'; autoCollapsed = true; }
  if (!on && autoCollapsed) { lp.classList.remove('collapsed'); $('#liveToggle').textContent = '－'; autoCollapsed = false; }
}
function setView(v) {
  document.querySelectorAll('#viewSeg button').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
}

/* =========================================================
 * 面板內容
 * ======================================================= */
function clubCard(c, st) {
  const cat = catById[c.category];
  return `<button class="ccard" style="--c:${cat.roof}" data-club="${c.no}">
    <div class="row"><b>${cat.emoji} ${c.name}</b>${chipHTML(st, c)}</div>
    <div class="meta"><span>📅 ${dayText(c)} ${c.time[0]}–${c.time[1]}</span><span>👩‍🏫 ${c.teacher}</span><span>🎒 ${gradeText(c)}</span><span>👥 ${c.min}–${c.max} 人</span><span>💰 ${c.fee.toLocaleString()} 元</span></div>
  </button>`;
}
function renderIsland(id, states) {
  states ??= new Map(CLUBS.map((c) => [c, clubStatus(c)]));
  let html;
  if (id === 'school') {
    html = `<div class="ihead" style="--c:#ffd29a"><div class="em">🏫</div><h2>${SCHOOL.name}・中央島</h2><p>${SCHOOL.fullName}｜${SCHOOL.term}課後社團</p></div>
      <div class="ibody">${SCHOOL.signupUrl ? `<a class="signup-btn" href="${SCHOOL.signupUrl}" target="_blank" rel="noopener"><span>📝</span><span><b>前往社團報名系統</b><small>請使用學校 Google 帳號登入</small></span><span>↗</span></a>` : ''}${CATEGORIES.map((cat) => {
        const cl = CLUBS.filter((c) => c.category === cat.id);
        const n = cl.filter((c) => states.get(c).state === 'live').length;
        return `<button class="ccard" style="--c:${cat.color}" data-island="${cat.id}"><div class="row"><b>${cat.emoji} ${cat.name}</b>${n ? `<span class="chip st-live">${n} 上課中</span>` : `<span class="chip">${cl.length} 個社團</span>`}</div><div class="meta">${cl.map((c) => c.name).join('・') || '即將開放'}</div></button>`;
      }).join('')}</div>`;
  } else {
    const isl = islands[id];
    html = `<div class="ihead" style="--c:${isl.cat.color}"><div class="em">${isl.cat.emoji}</div><h2>${isl.cat.name}</h2><p>${isl.cat.desc}</p></div>
      <div class="ibody">${isl.clubs.map((c) => clubCard(c, states.get(c))).join('') || '<p class="empty">社團籌備中</p>'}</div>`;
  }
  $('#islandBody').innerHTML = html;
  $('#islandPanel').hidden = false;
}

function openClub(c) {
  const cat = catById[c.category], st = clubStatus(c);
  const tags = c.content.replace(/⋯等?/g, '').split(/[、／，,]|作品：|：/).map((s) => s.trim()).filter(Boolean);
  $('#clubBody').innerHTML = `
    <button class="close" data-close="clubModal" aria-label="關閉">✕</button>
    <div class="mhead" style="--c:${cat.color}">
      <small>${cat.emoji} ${cat.name}・編號 ${c.no}</small>
      <h2>${c.name}</h2>
      ${chipHTML(st, c)}
    </div>
    <div class="mbody" style="--c:${cat.roof}">
      ${st.state === 'live' ? `<div class="mstatus"><b>🔴 正在上課</b>・已進行 ${Math.round(st.progress * 100)}%<div class="prog"><i style="width:${(st.progress * 100).toFixed(1)}%"></i></div></div>` : ''}
      <div class="info">
        <div><span>上課時間</span><b>${dayText(c)}</b><br><small>${c.time[0]}–${c.time[1]}</small></div>
        <div><span>指導老師</span><b>${c.teacher}</b></div>
        <div><span>適合年級</span><b>${gradeText(c)}</b></div>
        <div><span>人數限制</span><b>${c.min}–${c.max} 人</b></div>
        <div><span>上課節數</span><b>${c.sessions} 節</b></div>
        <div><span>費用</span><b>${c.fee.toLocaleString()} 元</b></div>
      </div>
      <b>上課內容</b>
      <div class="tags">${tags.map((t) => `<span>${t}</span>`).join('')}</div>
      <div class="mbtns">
        <button class="pill primary" data-fly="${c.no}">🏝️ 飛到社團小屋</button>
        <button class="pill" data-ics="${c.no}">📅 加入行事曆</button>
      </div>
    </div>`;
  $('#clubModal').hidden = false;
}

function flyToHouse(c) {
  $('#clubModal').hidden = true;
  $('#listView').hidden = true;
  focusIsland(c.category);
  const h = clubHouses.find((x) => x.userData.club === c);
  if (h) {
    const p = h.getWorldPosition(new THREE.Vector3());
    const out = new THREE.Vector3(p.x, 0, p.z).normalize();
    flyTo(p.clone().addScaledVector(out, 9).add(new THREE.Vector3(0, 6, 0)), p.clone().add(new THREE.Vector3(0, 1, 0)), 1.8);
    h.userData.pop = 1;
  }
}

function downloadICS(c) {
  const d = now();
  let k = 0;
  while (!c.days.includes((d.getDay() + k) % 7)) k++;
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate() + k);
  const ymd = `${day.getFullYear()}${pad(day.getMonth() + 1)}${pad(day.getDate())}`;
  const t = (s) => s.replace(':', '') + '00';
  const by = c.days.map((x) => ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][x]).join(',');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//KSES//ClubIslands//ZH', 'BEGIN:VEVENT',
    `UID:kses-club-${c.no}-${ymd}@clubislands`, `DTSTAMP:${ymd}T000000`,
    `DTSTART;TZID=Asia/Taipei:${ymd}T${t(c.time[0])}`, `DTEND;TZID=Asia/Taipei:${ymd}T${t(c.time[1])}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${by};COUNT=${c.sessions}`,
    `SUMMARY:${SCHOOL.name}社團｜${c.name}`, `DESCRIPTION:指導老師：${c.teacher}\\n${c.content}`, `LOCATION:${SCHOOL.fullName}`,
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = `${c.name}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- 清單 ---------- */
const filt = { cat: 'all', day: 0, grade: 0, q: '', mode: 'cards' };
$('#catChips').innerHTML = `<button data-cat="all" class="on">全部</button>` + CATEGORIES.map((c) => `<button data-cat="${c.id}">${c.emoji} ${c.short}</button>`).join('');
$('#dayChips').innerHTML = `<button data-day="0" class="on">每天</button>` + [1, 2, 3, 4, 5].map((d) => `<button data-day="${d}">週${DAY[d]}</button>`).join('');
function renderList() {
  const q = filt.q.trim().toLowerCase();
  const list = CLUBS.filter((c) => (filt.cat === 'all' || c.category === filt.cat)
    && (!filt.day || c.days.includes(filt.day))
    && (!filt.grade || (filt.grade >= c.grade[0] && filt.grade <= c.grade[1]))
    && (!q || `${c.name}${c.teacher}${c.content}${catById[c.category].name}`.toLowerCase().includes(q)));
  if (!list.length) { $('#listBody').innerHTML = '<p class="empty">找不到符合的社團，換個條件試試看 🔍</p>'; return; }
  if (filt.mode === 'cards') {
    $('#listBody').innerHTML = `<div class="grid">${list.map((c) => clubCard(c, clubStatus(c))).join('')}</div>`;
  } else {
    const td = now().getDay();
    $('#listBody').innerHTML = `<div class="week">${[1, 2, 3, 4, 5].map((d) => `<div class="col"><h4 class="${d === td ? 'today' : ''}">週${DAY[d]}</h4>${
      list.filter((c) => c.days.includes(d)).sort((a, b) => toMin(a.time[0]) - toMin(b.time[0]))
        .map((c) => `<button class="wblock" style="--c:${catById[c.category].roof}" data-club="${c.no}"><b>${catById[c.category].emoji} ${c.name}</b>${c.time[0]}–${c.time[1]}<br>${c.teacher}・${gradeText(c)}</button>`).join('') || '<p class="empty" style="padding:10px">—</p>'
    }</div>`).join('')}</div>`;
  }
}
function openList() { $('#listView').hidden = false; setView('list'); renderList(); }

/* =========================================================
 * UI 事件
 * ======================================================= */
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-club],[data-island],[data-close],[data-fly],[data-ics],[data-cat],[data-day],[data-mode],[data-view]');
  if (!t) return;
  const byNo = (n) => CLUBS.find((c) => c.no === +n);
  if (t.dataset.club) openClub(byNo(t.dataset.club));
  else if (t.dataset.island) focusIsland(t.dataset.island);
  else if (t.dataset.fly) flyToHouse(byNo(t.dataset.fly));
  else if (t.dataset.ics) downloadICS(byNo(t.dataset.ics));
  else if (t.dataset.close) {
    $('#' + t.dataset.close).hidden = true;
    if (t.dataset.close === 'islandPanel') goHome();
    if (t.dataset.close === 'listView') setView(focusId ? 'full' : 'full');
  } else if (t.dataset.cat) { filt.cat = t.dataset.cat; t.parentNode.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === t)); renderList(); }
  else if (t.dataset.day) { filt.day = +t.dataset.day; t.parentNode.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === t)); renderList(); }
  else if (t.dataset.mode) { filt.mode = t.dataset.mode; t.parentNode.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === t)); renderList(); }
  else if (t.dataset.view) {
    stopTour();
    if (t.dataset.view === 'list') openList();
    else goHome(t.dataset.view);
  }
});
document.querySelectorAll('.overlay').forEach((o) => o.addEventListener('click', (e) => { if (e.target === o) { o.hidden = true; if (o.id === 'listView') setView('full'); } }));
$('#search').addEventListener('input', (e) => { filt.q = e.target.value; renderList(); });
$('#gradeSel').addEventListener('change', (e) => { filt.grade = +e.target.value; renderList(); });
$('#findBtn').addEventListener('click', openList);
$('#liveToggle').addEventListener('click', () => {
  const c = $('#livePanel').classList.toggle('collapsed');
  $('#liveToggle').textContent = c ? '＋' : '－';
  store.set('kx-live-collapsed', c);
});
if (store.get('kx-live-collapsed', innerWidth < 640)) { $('#livePanel').classList.add('collapsed'); $('#liveToggle').textContent = '＋'; }
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  for (const id of ['clubModal', 'listView', 'timeMachine']) if (!$('#' + id).hidden) { $('#' + id).hidden = true; return; }
  if (focusId) goHome();
});

let paused = false, fx = true;
$('#tgLabels').addEventListener('click', (e) => { document.body.classList.toggle('no-labels', !e.currentTarget.classList.toggle('on')); });
$('#tgPause').addEventListener('click', (e) => { paused = e.currentTarget.classList.toggle('on'); controls.autoRotate = !paused && !focusId; e.currentTarget.textContent = paused ? '播放' : '暫停'; });
$('#tgFx').addEventListener('click', (e) => { fx = e.currentTarget.classList.toggle('on'); motes.visible = fx; birds.forEach((b) => (b.visible = fx)); });

// 名言
let qi = Math.floor(Date.now() / 864e5) % QUOTES.length;
const showQuote = () => ($('#quoteText').textContent = QUOTES[qi]);
showQuote();
$('#quoteNext').addEventListener('click', () => { qi = (qi + 1) % QUOTES.length; showQuote(); });

// 導覽員
const TIPS = ['點一座島，開始探索！', '拖曳可以旋轉，滾輪或雙指可以縮放喔！', '紅色光圈的小屋，代表社團正在上課！', '按「🕒 即時」可以開啟時光機，看看別天的社團。', '雲海裡藏著雲寶，點到牠就能收集！'];
let ti = 0;
function setGuide(t) { $('#guideText').textContent = t; }
$('#guideImg').addEventListener('click', () => { ti = (ti + 1) % TIPS.length; setGuide(TIPS[ti]); });
function updateEggText() {
  $('#eggText').textContent = found.size >= eggs.length ? `🏆 8 隻雲寶全部找到了！你是群島探險王！` : `雲海裡藏了 ${eggs.length} 隻「雲寶」，已找到 ${found.size} 隻`;
}
updateEggText();

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 4100);
}

// 時光機
let tmDay = now().getDay();
$('#tmDays').innerHTML = [1, 2, 3, 4, 5, 6, 0].map((d) => `<button data-tm="${d}">${DAY[d]}</button>`).join('');
const tmSync = () => document.querySelectorAll('#tmDays button').forEach((b) => b.classList.toggle('on', +b.dataset.tm === tmDay));
$('#tmDays').addEventListener('click', (e) => { const b = e.target.closest('[data-tm]'); if (b) { tmDay = +b.dataset.tm; tmSync(); } });
$('#tmTime').addEventListener('input', (e) => { const v = +e.target.value; $('#tmTimeText').textContent = `${pad((v / 60) | 0)}:${pad(v % 60)}`; });
$('#tgTime').addEventListener('click', () => {
  const tm = $('#timeMachine');
  tm.hidden = !tm.hidden;
  if (!tm.hidden) {
    const d = now(); tmDay = d.getDay(); tmSync();
    const v = THREE.MathUtils.clamp(d.getHours() * 60 + d.getMinutes(), 420, 1260);
    $('#tmTime').value = v - (v % 5); $('#tmTime').dispatchEvent(new Event('input'));
  }
});
$('#tmApply').addEventListener('click', () => {
  const real = new Date(), v = +$('#tmTime').value;
  const target = new Date(real.getFullYear(), real.getMonth(), real.getDate() + (tmDay - real.getDay()), (v / 60) | 0, v % 60);
  simOffset = target - real;
  $('#tgTime').textContent = `🕒 模擬 週${DAY[tmDay]} ${$('#tmTimeText').textContent}`;
  $('#tgTime').classList.add('sim');
  $('#timeMachine').hidden = true;
  lastStates = null; tick(); toast(`🕰️ 時光機出發！現在是週${DAY[tmDay]} ${$('#tmTimeText').textContent}`);
});
$('#tmNow').addEventListener('click', () => {
  simOffset = 0;
  $('#tgTime').textContent = '🕒 即時';
  $('#tgTime').classList.remove('sim');
  $('#timeMachine').hidden = true;
  lastStates = null; tick();
});

// 島嶼導覽
let tour = null;
const TOUR = ['school', ...CATEGORIES.map((c) => c.id)];
function stopTour() { if (tour) { clearTimeout(tour.timer); tour = null; $('#tourBtn').textContent = '▶ 島嶼導覽'; } }
function tourStep() {
  if (!tour) return;
  if (tour.i >= TOUR.length) { stopTour(); goHome(); setGuide('導覽結束！想去哪座島，點一下就能出發。'); return; }
  focusIsland(TOUR[tour.i++]);
  tour.timer = setTimeout(tourStep, 6500);
}
$('#tourBtn').addEventListener('click', () => {
  if (tour) { stopTour(); return; }
  tour = { i: 0 };
  $('#tourBtn').textContent = '■ 停止導覽';
  tourStep();
});

// 天氣
const WMO = { 0: ['☀️', '晴朗'], 1: ['🌤️', '晴時多雲'], 2: ['⛅', '多雲'], 3: ['☁️', '陰天'], 45: ['🌫️', '有霧'], 48: ['🌫️', '有霧'], 51: ['🌦️', '毛毛雨'], 53: ['🌦️', '毛毛雨'], 55: ['🌦️', '毛毛雨'], 61: ['🌧️', '小雨'], 63: ['🌧️', '中雨'], 65: ['🌧️', '大雨'], 80: ['🌦️', '陣雨'], 81: ['🌧️', '陣雨'], 82: ['⛈️', '強陣雨'], 95: ['⛈️', '雷雨'], 96: ['⛈️', '雷雨'], 99: ['⛈️', '雷雨'] };
async function loadWeather() {
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${SCHOOL.lat}&longitude=${SCHOOL.lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTaipei&forecast_days=1`;
    const j = await (await fetch(u)).json();
    const [ic, tx] = WMO[j.current.weather_code] ?? ['🌤️', ''];
    $('#weatherText').textContent = `${ic} ${tx} ${Math.round(j.current.temperature_2m)}°C`;
    $('#weatherSub').textContent = `${Math.round(j.daily.temperature_2m_min[0])}°～${Math.round(j.daily.temperature_2m_max[0])}°・降雨 ${j.daily.precipitation_probability_max[0]}%・${SCHOOL.place}`;
  } catch {
    $('#weatherText').textContent = '🌤️ 天氣';
    $('#weatherSub').textContent = SCHOOL.place;
  }
}
loadWeather();
setInterval(loadWeather, 30 * 60 * 1000);

$('#clubCount').textContent = CLUBS.length;
$('#termText').textContent = SCHOOL.term;

/* =========================================================
 * 3D 點擊與滑過
 * ======================================================= */
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
let down = null, hoverIsland = null;
function pick(e) {
  ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  for (const hit of ray.intersectObjects(pickables, true)) {
    let o = hit.object;
    while (o && !o.userData.type) o = o.parent;
    if (o && o.visible !== false && (o.userData.type !== 'egg' || o.visible)) return o;
  }
  return null;
}
renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; stopTour(); });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
  const o = pick(e);
  if (!o) return;
  const u = o.userData;
  if (u.type === 'egg') collectEgg(o);
  else if (u.type === 'signup') openSignup();
  else if (u.type === 'club') { if (focusId !== u.club.category) focusIsland(u.club.category); openClub(u.club); }
  else if (u.type === 'island') focusIsland(u.id);
});
let hoverRAF = 0;
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || hoverRAF) return;
  hoverRAF = requestAnimationFrame(() => {
    hoverRAF = 0;
    const o = pick(e);
    renderer.domElement.style.cursor = o ? 'pointer' : 'grab';
    let isl = o;
    while (isl && isl.userData.type !== 'island') isl = isl.parent;
    hoverIsland = isl ? isl.userData.id : null;
  });
});

const burst = [];
function collectEgg(e) {
  const id = e.userData.id;
  if (found.has(id)) return;
  found.add(id);
  store.set('kx-eggs', [...found]);
  const p = e.getWorldPosition(new THREE.Vector3());
  e.visible = false;
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), new THREE.MeshBasicMaterial({ color: ['#ffd23f', '#ff8fab', '#6fd0ff', '#ffffff'][i % 4], transparent: true }));
    m.position.copy(p);
    m.userData.v = new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 8, (Math.random() - 0.5) * 8);
    m.userData.life = 1;
    scene.add(m); burst.push(m);
  }
  toast(`☁️ 找到雲寶 ${found.size}/${eggs.length}！`);
  setGuide(EGG_FACTS[id]);
  updateEggText();
  if (found.size === eggs.length) setTimeout(() => toast('🏆 恭喜！你是關西國小群島探險王！'), 900);
}

/* =========================================================
 * 動畫迴圈
 * ======================================================= */
const clock = new THREE.Clock();
let t = 0;
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!paused) t += dt;

  if (fly) {
    const k = Math.min(1, (performance.now() - fly.s) / fly.dur), e = ease(k);
    camera.position.lerpVectors(fly.p0, fly.p1, e);
    controls.target.lerpVectors(fly.t0, fly.t1, e);
    if (k >= 1) fly = null;
  }
  controls.update();
  if (Math.abs(viewShift - viewShiftTarget) > 0.5) {
    viewShift += (viewShiftTarget - viewShift) * Math.min(1, dt * 4);
    camera.setViewOffset(innerWidth, innerHeight, viewShift, 0, innerWidth, innerHeight);
  } else if (viewShift !== viewShiftTarget) {
    viewShift = viewShiftTarget;
    if (viewShift === 0) camera.clearViewOffset(); else camera.setViewOffset(innerWidth, innerHeight, viewShift, 0, innerWidth, innerHeight);
  }

  if (!paused) {
    world.position.y = Math.sin(t * 0.5) * 0.35;
    for (const s of spinners) s.obj.rotation[s.axis] += s.speed * dt;
    for (const b of bobbers) b.obj.position.y = b.base + Math.sin(t * b.speed + b.phase) * b.amp;
    for (const f of flags) {
      const p = f.geometry.attributes.position, base = f.userData.base;
      for (let i = 0; i < p.count; i++) { const x = base[i * 3]; p.setZ(i, Math.sin(x * 6 - t * 6) * 0.08 * (x + 0.4)); }
      p.needsUpdate = true;
    }
    // 島嶼滑過浮起
    for (const id in islands) {
      const isl = islands[id], g = isl.group;
      const target = isl.pos.y + (hoverIsland === id || focusId === id ? 0.6 : 0);
      g.position.y += (target - g.position.y) * Math.min(1, dt * 5);
    }
    for (const h of clubHouses) {
      const u = h.userData;
      if (u.live) { u.ring.material.opacity = 0.5 + Math.sin(t * 4) * 0.4; u.ring.scale.setScalar(1 + Math.sin(t * 4) * 0.08); }
      u.flag.position.y = THREE.MathUtils.lerp(u.flag.position.y, u.live ? 2.35 : 1.3, dt * 3);
      if (u.pop) { u.pop = Math.max(0, u.pop - dt * 0.8); h.scale.setScalar((h.scale.x > 0.8 ? 1 : 0.75) * (1 + Math.sin(u.pop * Math.PI * 3) * 0.15 * u.pop)); }
    }
    {
      const sk = islands.wheel.group.userData.skater;
      const a = t * 0.9;
      sk.position.set(Math.cos(a) * 3.0, 0.05, Math.sin(a) * 2.4);
      sk.rotation.y = -a;
    }
    const bot = islands.tech.group.userData.bot;
    if (bot) { bot.rotation.y = Math.sin(t * 0.8) * 0.6; bot.position.y = Math.abs(Math.sin(t * 2)) * 0.15; }
    for (const s of smoke) {
      const u = s.userData; u.t = (u.t + dt * 0.25) % 1;
      s.position.copy(u.origin).add(tmpP.set(Math.sin(u.t * 6) * 0.2, u.t * 2.5, 0));
      s.scale.setScalar(0.6 + u.t * 1.4); s.material.opacity = 0.7 * (1 - u.t);
    }
    // 雲海流動
    for (let i = 0; i < SEA; i++) {
      const o = seaData[i]; o.a += o.sp * dt;
      tmpP.set(Math.cos(o.a) * o.d, o.y + Math.sin(t * 0.3 + i) * 0.4, Math.sin(o.a) * o.d);
      tmpS.set(o.sc * 1.5, o.sc * 0.6, o.sc);
      tmpM.compose(tmpP, tmpQ, tmpS); sea.setMatrixAt(i, tmpM);
    }
    sea.instanceMatrix.needsUpdate = true;
    for (const c of puffs) { const u = c.userData; u.a += u.sp * dt; c.position.set(Math.cos(u.a) * u.d, u.y, Math.sin(u.a) * u.d); c.rotation.y = -u.a; }
    for (const b of balloons) { const u = b.userData; u.a += u.sp * dt; b.position.set(Math.cos(u.a) * u.d, u.y + Math.sin(t * 0.7 + u.d) * 1.2, Math.sin(u.a) * u.d); }
    for (const b of birds) {
      const u = b.userData; u.a += u.sp * dt;
      b.position.set(Math.cos(u.a) * u.d, u.y + Math.sin(t + u.ph) * 1.5, Math.sin(u.a) * u.d);
      b.rotation.y = -u.a;
      const f = Math.sin(t * 10 + u.ph) * 0.6; u.l.rotation.z = f; u.r.rotation.z = -f;
    }
    if (fx) motes.rotation.y += dt * 0.02;
    for (const e of eggs) if (e.visible) e.rotation.y = Math.sin(t * 1.5 + e.userData.id) * 0.5;
  }
  for (let i = burst.length - 1; i >= 0; i--) {
    const m = burst[i], u = m.userData;
    u.v.y -= 9.8 * dt; m.position.addScaledVector(u.v, dt); u.life -= dt * 0.9; m.material.opacity = u.life;
    if (u.life <= 0) { scene.remove(m); burst.splice(i, 1); }
  }
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

/* =========================================================
 * 每秒更新
 * ======================================================= */
function tick() {
  const d = now();
  $('#dateText').textContent = `${d.getMonth() + 1} 月 ${d.getDate()} 日・星期${DAY[d.getDay()]}`;
  $('#timeText').textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${simOffset ? '（模擬）' : ''}`;
  drawClock();
  if (d.getSeconds() % 5 === 0 || !lastStates) { updateSky(); updateLive(); }
}
setInterval(tick, 1000);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  if (viewShift) camera.setViewOffset(innerWidth, innerHeight, viewShift, 0, innerWidth, innerHeight);
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  labelRenderer.setSize(innerWidth, innerHeight);
});

// 直式螢幕：依畫面比例拉遠鏡頭
if (innerWidth < innerHeight) {
  const k = THREE.MathUtils.clamp(1.25 / camera.aspect, 1, 2.3);
  HOME.pos.multiplyScalar(k);
  camera.position.copy(HOME.pos);
}
tick();
animate();
requestAnimationFrame(() => setTimeout(() => $('#loading').classList.add('done'), 600));
