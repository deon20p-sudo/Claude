// "In This Town" - a tiny deterministic 3D animation engine.
// Every frame is a pure function of time, so frames can be rendered in any order.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { SHOTS, stairPos, MON, CONFIG } from './shots.js';

const qs = new URLSearchParams(location.search);
const W = +(qs.get('w') || 1080), H = Math.round(W * 16 / 9);
const canvas = document.getElementById('c');
canvas.width = W; canvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: qs.get('aa') !== '0', preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const PI = Math.PI;
const ONE = new THREE.Vector3(1, 1, 1);
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let rng = mulberry32(7);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const tint = (hex, amt) => { const c = new THREE.Color(hex); const k = 1 + (rng() - 0.5) * amt; c.multiplyScalar(k); return c; };

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 9 / 16, 0.25, 2500);

// ---------------------------------------------------------------- geometry builder
class Bld {
  constructor() { this.parts = []; this.base = new THREE.Matrix4(); }
  _add(g, color, m) {
    g = g.index ? g.toNonIndexed() : g;
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(this.base, m));
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    const cc = color.isColor ? color : new THREE.Color(color);
    for (let i = 0; i < n; i++) { c[i * 3] = cc.r; c[i * 3 + 1] = cc.g; c[i * 3 + 2] = cc.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (!g.attributes.normal) g.computeVertexNormals();
    this.parts.push(g);
  }
  geo(g, x, y, z, color, ry = 0, rx = 0, rz = 0) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), ONE);
    this._add(g, color, m);
  }
  box(w, h, d, x, y, z, color, ry = 0, rx = 0, rz = 0) { this.geo(new THREE.BoxGeometry(w, h, d), x, y, z, color, ry, rx, rz); }
  prism(w, h, d, x, y, z, color, ry = 0) {
    const a = [-w / 2, 0, -d / 2], b = [w / 2, 0, -d / 2], c = [w / 2, 0, d / 2], dd = [-w / 2, 0, d / 2], e = [0, h, -d / 2], f = [0, h, d / 2];
    const v = [a, dd, f, a, f, e, b, e, f, b, f, c, dd, c, f, b, a, e].flat();
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3)); g.computeVertexNormals();
    this.geo(g, x, y, z, color, ry);
  }
  mesh(mat, cast = true, recv = true) {
    if (!this.parts.length) return new THREE.Group();
    const m = new THREE.Mesh(mergeGeometries(this.parts, false), mat);
    m.castShadow = cast; m.receiveShadow = recv; return m;
  }
}
const B = { main: new Bld(), winA: new Bld(), winB: new Bld(), lamp: new Bld(), glow: new Bld() };
function at(x, y, z, ry, fn, rx = 0) {
  const bs = Object.values(B), olds = bs.map(b => b.base.clone());
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')), ONE);
  bs.forEach(b => b.base.multiply(m)); fn(); bs.forEach((b, i) => b.base.copy(olds[i]));
}

// ---------------------------------------------------------------- textures
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const grassTex = canvasTex(256, 256, (g) => {
  g.fillStyle = '#7fae55'; g.fillRect(0, 0, 256, 256);
  const r = mulberry32(3);
  for (let i = 0; i < 700; i++) { g.fillStyle = pick2(r, ['#77a64e', '#88b85c', '#6f9f49', '#8fbe63']); g.fillRect(r() * 256, r() * 256, 4 + r() * 14, 4 + r() * 14); }
});
function pick2(r, a) { return a[Math.floor(r() * a.length)]; }
grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(70, 70);

// ---------------------------------------------------------------- world
const WALLS = ['#f2e2c4', '#e9c9a0', '#f4d7b8', '#d9e4d0', '#f1c9b0', '#e6d3e3', '#cfe0ea', '#f7e9a8', '#e8b89a', '#f0efe6'];
const ROOFS = ['#8c3b2e', '#6b4a3a', '#3f5870', '#7a2f3a', '#4d6b4d', '#5a4a6a', '#a0522d'];
const DOORS = ['#5a3a22', '#2f4f6f', '#7a2f2f', '#2f5f3f'];
const STONE = '#b3a797';

function win(x, y, z, ry, forceA) {
  at(x, y, z, ry, () => {
    B.main.box(1.25, 1.45, 0.08, 0, 0, 0.04, '#f5efe2');
    ((forceA === undefined ? rng() < 0.62 : forceA) ? B.winA : B.winB).box(0.95, 1.15, 0.1, 0, 0, 0.07, '#ffffff');
    B.main.box(0.07, 1.15, 0.13, 0, 0, 0.08, '#f5efe2');
    B.main.box(0.95, 0.07, 0.13, 0, 0, 0.08, '#f5efe2');
    B.main.box(1.5, 0.1, 0.3, 0, -0.78, 0.13, '#e2d6c2');
  });
}
function tree(b, x, y, z, s = 1, rx = 0) {
  at(x, y, z, rng() * 6, () => {
    const g1 = tint(pick(['#4f8a3c', '#5c9a45', '#427a35', '#6aa64d']), 0.15);
    b.box(0.5 * s, 2.2 * s, 0.5 * s, 0, 1.1 * s, 0, '#6b4a2e');
    b.box(2.8 * s, 1.7 * s, 2.8 * s, 0, 2.9 * s, 0, g1);
    b.box(2.1 * s, 1.4 * s, 2.1 * s, 0, 4.2 * s, 0, tint(g1.getStyle(), 0.2));
    b.box(1.2 * s, 1.0 * s, 1.2 * s, 0, 5.3 * s, 0, tint(g1.getStyle(), 0.25));
  }, rx);
}
function lamppost(x, z) {
  const b = B.main;
  b.box(0.36, 0.3, 0.36, x, 0.15, z, '#2d2f36'); b.box(0.16, 4, 0.16, x, 2, z, '#2d2f36');
  b.box(0.7, 0.12, 0.7, x, 4.42, z, '#2d2f36'); B.lamp.box(0.46, 0.5, 0.46, x, 4.1, z, '#ffffff');
}
function house(x, z, ry, o = {}) {
  const w = o.w || 6.6 + rng() * 0.8, d = o.d || 6.2 + rng() * 0.8, floors = o.floors || (rng() < 0.45 ? 2 : 1);
  const h = floors * 3.0 + 0.5, rh = 2.4 + rng() * 1.2;
  const wall = o.wall || tint(pick(WALLS), 0.06), roof = o.roof || tint(pick(ROOFS), 0.12), door = pick(DOORS);
  const b = B.main;
  at(x, 0, z, ry, () => {
    b.box(w, h, d, 0, h / 2, 0, wall);
    b.box(w + 0.2, 0.45, d + 0.2, 0, 0.22, 0, '#9a8c7c');
    if (rng() < 0.5) b.prism(w + 0.9, rh, d + 0.9, 0, h, 0, roof); else b.prism(d + 0.9, rh, w + 0.9, 0, h, 0, roof, PI / 2);
    b.box(0.8, 2.0, 0.8, w * 0.25, h + rh * 0.75, -d * 0.15, '#a8573f'); b.box(0.95, 0.18, 0.95, w * 0.25, h + rh * 0.75 + 1.05, -d * 0.15, '#7a3f2e');
    const dx = o.doorX !== undefined ? o.doorX : (rng() < 0.5 ? 0 : -w * 0.22);
    b.box(1.2, 2.2, 0.12, dx, 1.35, d / 2 + 0.03, door); b.box(1.5, 2.4, 0.06, dx, 1.4, d / 2 + 0.01, '#f5efe2');
    b.box(0.1, 0.1, 0.1, dx + 0.4, 1.3, d / 2 + 0.1, '#e8c65a');
    b.box(1.8, 0.22, 0.8, dx, 0.11, d / 2 + 0.4, STONE);
    for (let f = 0; f < floors; f++) {
      const y = 1.95 + f * 3.0;
      for (const sx of [-1, 1]) {
        const wx = sx * w * 0.3;
        if (f === 0 && Math.abs(wx - dx) < 1.4) continue;
        win(wx, y, d / 2, 0);
        if (f === 0 && rng() < 0.6) { b.box(1.3, 0.25, 0.3, wx, y - 0.98, d / 2 + 0.2, '#7a5a3a'); b.box(1.2, 0.18, 0.24, wx, y - 0.8, d / 2 + 0.2, pick(['#e0546a', '#f2c744', '#d96bd0', '#f08a3c'])); }
      }
      if (f > 0 && Math.abs(dx) > 0.5) win(0, y, d / 2, 0);
      win(w / 2, y, 0, PI / 2); win(-w / 2, y, 0, -PI / 2);
      win(-w * 0.25, y, -d / 2, PI); win(w * 0.25, y, -d / 2, PI);
    }
    if (o.sign) o.sign(w, h, d);
    if (rng() < 0.6) b.box(2.2, 0.9, 0.7, w / 2 + 0.5, 0.45, d * 0.2, tint('#4f8a3c', 0.2));
  });
}

const dyn = {};   // dynamic objects
function buildWorld() {
  const b = B.main;
  // ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), new THREE.MeshLambertMaterial({ map: grassTex }));
  ground.rotation.x = -PI / 2; ground.receiveShadow = true; scene.add(ground);
  // streets and square
  const pave = (x, z, c) => b.box(2, 0.12, 2, x, 0, z, tint(c, 0.07));
  for (let x = -13; x <= 13; x += 2) for (let z = -13; z <= 13; z += 2) if (x * x + z * z < 170) pave(x, z, '#d9c9ae');
  for (let z = 13; z <= 83; z += 2) for (const x of [-2, 0, 2]) if (z > 13 || true) pave(x, z + 0.0, '#c9b89c');
  for (let z = -15; z >= -37; z -= 2) for (const x of [-2, 0, 2]) pave(x, z, '#c9b89c');
  for (const s of [-1, 1]) for (let x = 15; x <= 75; x += 2) for (const z of [-2, 0, 2]) pave(s * x, z, '#c9b89c');

  // tower
  for (let y = 0; y < 19; y++) b.box(6, 1, 6, 0, y + 0.5, 0, tint(STONE, 0.08));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let y = 0; y < 19; y += 2) b.box(0.9, 1, 0.9, sx * 2.62, y + 0.5, sz * 2.62, '#c9bfae');
  b.box(6.5, 0.5, 6.5, 0, 0.25, 0, '#958a7b');
  b.box(1.7, 2.7, 0.2, 0, 2.25, 3.02, '#5a3a22'); b.box(2.1, 3.0, 0.12, 0, 2.3, 3.0, '#857a6c'); b.box(0.14, 0.14, 0.14, 0.55, 2.2, 3.16, '#e8c65a');
  for (let i = 0; i < 4; i++) b.box(3.2, 0.9 - i * 0.225, 0.5, 0, (0.9 - i * 0.225) / 2, 3.25 + i * 0.5, tint('#a79b8b', 0.06));
  for (const y of [6.5, 10.5]) { b.box(0.5, 1.4, 0.1, 0, y, 3.02, '#2b2f3a'); b.box(0.1, 1.4, 0.5, 3.02, y, 0, '#2b2f3a'); b.box(0.1, 1.4, 0.5, -3.02, y, 0, '#2b2f3a'); b.box(0.5, 1.4, 0.1, 0, y, -3.02, '#2b2f3a'); }
  // clock faces, stuck at ten past four
  for (let k = 0; k < 4; k++) at(0, 15.2, 0, k * PI / 2, () => {
    b.geo(new THREE.CylinderGeometry(2.3, 2.3, 0.12, 28), 0, 0, 3.04, '#3a3f4c', 0, PI / 2);
    b.geo(new THREE.CylinderGeometry(2.05, 2.05, 0.14, 28), 0, 0, 3.08, '#f6eedb', 0, PI / 2);
    for (let i = 0; i < 12; i++) { const a = i * PI / 6; b.box(0.12, i % 3 ? 0.28 : 0.5, 0.06, Math.sin(a) * 1.72, Math.cos(a) * 1.72, 3.17, '#2b2f3a', 0, 0, -a); }
    const ha = (4 + 10 / 60) / 12 * 2 * PI, ma = 10 / 60 * 2 * PI;
    b.box(0.2, 1.05, 0.07, Math.sin(ha) * 0.5, Math.cos(ha) * 0.5, 3.2, '#1d2028', 0, 0, -ha);
    b.box(0.13, 1.7, 0.07, Math.sin(ma) * 0.8, Math.cos(ma) * 0.8, 3.23, '#1d2028', 0, 0, -ma);
    b.geo(new THREE.CylinderGeometry(0.16, 0.16, 0.2, 12), 0, 0, 3.22, '#a8573f', 0, PI / 2);
  });
  // a crow asleep on the minute hand (south face)
  b.box(0.3, 0.26, 0.42, 0.95, 16.45 + 0.02, 3.4, '#15161c'); b.box(0.2, 0.2, 0.2, 0.95, 16.68, 3.56, '#15161c'); b.box(0.07, 0.06, 0.14, 0.95, 16.66, 3.7, '#e8a13a');
  // belfry
  b.box(6.8, 0.3, 6.8, 0, 19.15, 0, '#958a7b');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.7, 4.3, 0.7, sx * 2.65, 21.45, sz * 2.65, '#c9bfae');
  for (const s of [-1, 1]) { b.box(4.6, 0.4, 0.35, 0, 19.5, s * 2.8, STONE); b.box(0.35, 0.4, 4.6, s * 2.8, 19.5, 0, STONE); }
  b.box(6.8, 0.8, 6.8, 0, 24.0, 0, '#958a7b');
  b.geo(new THREE.ConeGeometry(5.1, 6.2, 4), 0, 27.5, 0, '#8c3b2e', PI / 4);
  b.box(0.2, 1.6, 0.2, 0, 31.2, 0, '#2d2f36'); b.box(0.5, 0.5, 0.5, 0, 32.1, 0, '#e8c65a');
  b.box(0.5, 0.4, 5.6, 0, 23.45, 0, '#5a3a22');          // bell beam
  b.box(1.2, 0.02, 1.2, 1.75, 19.31, 1.75, '#1b1a1a');     // stair hatch
  b.box(0.12, 0.9, 0.12, -1.9, 23.15, 1.9, '#2d2f36'); B.glow.box(0.4, 0.5, 0.4, -1.9, 22.5, 1.9, '#ffffff'); // lantern

  // notice board in the square
  at(-6.5, 0, 6.5, 0.585, () => { b.box(0.18, 2.6, 0.18, -1.3, 1.3, 0, '#6b4a2e'); b.box(0.18, 2.6, 0.18, 1.3, 1.3, 0, '#6b4a2e'); b.box(3.0, 1.9, 0.14, 0, 1.95, 0, '#7a5a3a'); b.prism(3.4, 0.5, 0.6, 0, 2.9, 0, '#8c3b2e', PI / 2); });

  // houses
  const houses = [];
  for (const z of [17, 25, 33, 41, 49, 57, 65, 73]) houses.push([-8.6, z, PI / 2]);
  for (const z of [52.5, 60.5, 68.5]) houses.push([8.6, z, -PI / 2]);
  for (const x of [17, 25, 33, 41, 49, 57]) { houses.push([x, -8.6, 0]); houses.push([-x, -8.6, 0]); houses.push([-x, 8.6, PI]); if (x > 26) houses.push([x, 8.6, PI]); }
  for (const z of [-17, -25]) { houses.push([-8.6, z, PI / 2]); if (!(CONFIG.shop && z === -25)) houses.push([8.6, z, -PI / 2]); }
  houses.push([-8.6, -33, PI / 2]);
  for (const [x, z, ry] of houses) house(x, z, ry);
  if (CONFIG.shop) shop(); else {
  // bakery at the end of the north street
  house(8.6, -30.5, -PI / 2, { floors: 1, w: 7, d: 6.6, wall: '#f4d7b8', roof: '#a0522d', doorX: 0, sign: (w, h, d) => {
    for (let i = 0; i < 7; i++) b.box(1.0, 0.12, 1.5, -3 + i, 2.9, d / 2 + 0.7, i % 2 ? '#e0546a' : '#fff6ea', 0, 0.35);
    dyn.bakerySignAt = [8.6 - d / 2 - 0.1, 3.75, -30.5];
  } });
  }
  // second rows
  for (let gx = -62; gx <= 62; gx += 9) for (let gz = -44; gz <= 76; gz += 9) {
    if (Math.abs(gx) < 15.5 || Math.abs(gz) < 15.5) continue;
    if (gx > 3 && gx < 27 && gz > 10 && gz < 50) continue;                      // park + Mina's sightline
    const hx = (gx - 16) / 42, hz = (gz + 66) / 34; if (hx * hx + hz * hz < 1) continue;   // hill
    if (rng() < 0.22) { tree(b, gx + rng() * 3, 0, gz + rng() * 3, 1 + rng() * 0.6); continue; }
    house(gx + (rng() - 0.5) * 2, gz + (rng() - 0.5) * 2, pick([0, PI / 2, PI, -PI / 2]) + (rng() - 0.5) * 0.2);
  }
  // Mina's house (hollow bedroom upstairs, tall window facing the tower)
  if (!CONFIG.shop) minaHouse(); else minaHouse();
  // park
  b.geo(new THREE.CylinderGeometry(4.2, 4.2, 0.1, 20), 17, 0.03, 26, '#7fc0e0'); b.geo(new THREE.CylinderGeometry(4.6, 4.6, 0.08, 20), 17, 0.02, 26, '#b9ad9c');
  for (const [x, z] of [[23, 15], [24, 34], [22, 44], [14, 15.5]]) tree(b, x, 0, z, 1.1 + rng() * 0.4);
  for (const [x, z, ry] of [[11.5, 22, 0.4], [12, 31, -0.3]]) at(x, 0, z, ry, () => { b.box(1.8, 0.1, 0.5, 0, 0.5, 0, '#8a6a4a'); b.box(1.8, 0.5, 0.1, 0, 0.85, -0.25, '#8a6a4a'); b.box(0.1, 0.5, 0.4, -0.8, 0.25, 0, '#2d2f36'); b.box(0.1, 0.5, 0.4, 0.8, 0.25, 0, '#2d2f36'); });
  for (let i = 0; i < 26; i++) { const x = 6 + rng() * 18, z = 14 + rng() * 24; if ((x - 17) ** 2 + (z - 26) ** 2 < 26) continue; b.box(0.25, 0.3, 0.25, x, 0.15, z, pick(['#e0546a', '#f2c744', '#ffffff', '#d96bd0'])); }
  // lamp posts, telephone poles and the wire for the crows
  for (const z of [14, 24, 36, 48, 60, 72]) { lamppost(-3.7, z); lamppost(3.7, z + 5); }
  for (const x of [16, 30, 44]) { lamppost(x, 3.7); lamppost(-x, -3.7); }
  for (const z of [-16, -28]) lamppost(-3.7, z);
  for (const [x, z] of [[8, 8], [-8, -8], [8, -8], [-9.5, 9.5]]) lamppost(x, z);
  for (const z of [18, 34]) { b.box(0.28, 7.4, 0.28, -4.6, 3.7, z, '#5a4030'); b.box(1.8, 0.16, 0.16, -4.6, 6.9, z, '#5a4030'); }
  b.box(0.05, 0.05, 16, -4.0, 6.75, 26, '#1b1b1f');
  // the hill and far hills
  const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), new THREE.MeshLambertMaterial({ color: '#6c9a48' }));
  hill.scale.set(36, 12.6, 28); hill.position.set(16, -0.6, -66); hill.receiveShadow = true; hill.castShadow = true; scene.add(hill);
  for (let i = 0; i < 26; i++) { const a = rng() * 6.28, r = 0.75 + rng() * 0.3; const x = 16 + Math.cos(a) * 36 * r, z = -66 + Math.sin(a) * 28 * r; if (z > -44 && Math.abs(x) < 14) continue; const e = Math.max(0, 1 - r * r); tree(b, x, Math.sqrt(e) * 12 - 0.8, z, 0.9 + rng() * 0.7); }
  for (let i = 0; i < 9; i++) { const a = rng() * 6.28, r = 0.3 + rng() * 0.5; b.box(1.5 + rng() * 2, 1 + rng() * 1.5, 1.5 + rng() * 2, 16 + Math.cos(a) * 36 * r, Math.sqrt(1 - r * r) * 12 - 0.5, -66 + Math.sin(a) * 28 * r, tint('#8f8a80', 0.2), rng() * 3); }
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.28 + rng() * 0.2, r = 330 + rng() * 160; const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), farMat); m.scale.set(90 + rng() * 80, 26 + rng() * 40, 90 + rng() * 80); m.position.set(Math.cos(a) * r, -6, Math.sin(a) * r); scene.add(m); }
  // scattered trees outside town
  for (let i = 0; i < 150; i++) { const a = rng() * 6.28, r = 78 + rng() * 170; const x = Math.cos(a) * r, z = Math.sin(a) * r + 10; const hx = (x - 16) / 40, hz = (z + 66) / 32; if (hx * hx + hz * hz < 1) continue; if (Math.abs(x) < 4 && z > 0) continue; tree(b, x, 0, z, 1 + rng() * 1.2); }
  for (let i = 0; i < 40; i++) { const x = (rng() - 0.5) * 120, z = -40 + rng() * 120; if (Math.abs(x) < 14 || Math.abs(z) < 14) { if (!(x > 5 && x < 25 && z > 12 && z < 40)) continue; } const hx = (x - 16) / 40, hz = (z + 66) / 32; if (hx * hx + hz * hz < 1) continue; b.box(1.6 + rng(), 0.8, 1.2 + rng(), x, 0.4, z, tint('#4f8a3c', 0.25), rng() * 3); }

  // the inside of the tower (a separate stair shaft set, far from town)
  for (const [x, z, w, d] of [[0, 2.75, 6, 0.5], [0, -2.75, 6, 0.5], [2.75, 0, 0.5, 6], [-2.75, 0, 0.5, 6]]) for (let y = -6; y < 40; y += 2) b.box(w, 2, d, 300 + x, y + 1, z, tint('#8e8376', 0.1));
  for (let s = 0; s < 118; s += 0.76) { const [x, y, z, ry] = stairPos(s); b.box(1.25, 0.26, 0.86, x, y - 0.13, z, tint('#a79b8b', 0.1), ry + PI / 2); }
  for (let s = 6; s < 118; s += 7.6) { const [x, y, z] = stairPos(s); const ox = (x - 300) > 1 ? 2.45 : (x - 300) < -1 ? -2.45 : x - 300, oz = z > 1 ? 2.45 : z < -1 ? -2.45 : z; B.glow.box(0.22, 0.4, 0.22, 300 + ox, y + 2.6, oz, '#ffffff'); b.box(0.3, 0.12, 0.3, 300 + ox, y + 2.34, oz, '#2d2f36'); }
  b.box(6, 0.4, 6, 300, -6, 0, '#5a5248');

  const mainMesh = B.main.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })); scene.add(mainMesh);
  dyn.winA = B.winA.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }), false, false); scene.add(dyn.winA);
  dyn.winB = B.winB.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }), false, false); scene.add(dyn.winB);
  dyn.lamp = B.lamp.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }), false, false); scene.add(dyn.lamp);
  dyn.glow = B.glow.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }), false, false); scene.add(dyn.glow);

  // signs
  const boardTex = canvasTex(512, 320, (g, w, h) => {
    g.fillStyle = '#f6eedb'; g.fillRect(0, 0, w, h); g.strokeStyle = '#7a5a3a'; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
    const B_ = CONFIG.board; g.fillStyle = '#8c3b2e'; g.textAlign = 'center'; g.font = '900 54px Inter, Arial'; g.fillText(B_[0], w / 2, 78);
    g.fillStyle = '#2b2f3a'; g.font = '900 52px Inter, Arial'; g.fillText(B_[1], w / 2, 160); g.fillText(B_[2], w / 2, 228);
    g.font = '700 30px Inter, Arial'; g.fillStyle = '#8c3b2e'; g.fillText(B_[3], w / 2, 288);
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.75), new THREE.MeshLambertMaterial({ map: boardTex }));
  board.position.set(-6.5 + Math.sin(0.585) * 0.08, 1.95, 6.5 + Math.cos(0.585) * 0.08); board.rotation.y = 0.585; scene.add(board);
  const bakeTex = canvasTex(512, 128, (g, w, h) => { g.fillStyle = '#7a2f3a'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff6ea'; g.textAlign = 'center'; g.font = '900 92px Inter, Arial'; g.fillText('BAKERY', w / 2, 98); });
  const bs = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshLambertMaterial({ map: bakeTex }));
  if (dyn.bakerySignAt) { bs.position.set(...dyn.bakerySignAt); bs.rotation.y = -PI / 2; scene.add(bs);
  const bsb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.3, 4.6), lam('#5a3a22')); bsb.position.set(dyn.bakerySignAt[0] + 0.1, 3.75, -30.5); scene.add(bsb); }
}
const SHOP = { x: 5.3, z0: -35.4, z1: -25.8, win: [-34.3, -28.4, 0.6, 3.0], door: -27.1, signZ: -26.4, pivot: [3.55, 3.98, -26.4] };
function shop() {
  const b = B.main, x = SHOP.x, d = 6.6, h = 4.6, zc = (SHOP.z0 + SHOP.z1) / 2, L = SHOP.z1 - SHOP.z0, wall = '#f4d7b8';
  b.box(d, h, L, x + d / 2, h / 2, zc, wall); b.box(2.4, 0.12, L + 6, x - 1.2, 0, zc, '#d9c9ae'); b.box(d + 0.2, 0.45, L + 0.2, x + d / 2, 0.22, zc, '#9a8c7c');
  b.prism(L + 0.9, 2.6, d + 0.9, x + d / 2, h, zc, '#a0522d', PI / 2);
  const [wz0, wz1, wy0, wy1] = SHOP.win, wzc = (wz0 + wz1) / 2, ww = wz1 - wz0;
  b.box(0.16, wy1 - wy0 + 0.36, ww + 0.36, x - 0.02, (wy0 + wy1) / 2, wzc, '#5a3a22');          // frame
  b.box(0.5, 0.16, ww + 0.6, x - 0.22, wy0 - 0.12, wzc, '#7a5a3a');                               // sill
  b.box(0.6, 0.55, ww + 0.2, x - 0.25, wy0 - 0.45, wzc, '#c9605a');                                 // panel under window
  for (let i = 0; i < 9; i++) b.box(1.1, 0.1, ww / 9 + 0.02, x - 0.5, wy1 + 0.45, wz0 + (i + 0.5) * ww / 9, i % 2 ? '#e0546a' : '#fff6ea', 0, 0, 0.35); // awning
  b.box(0.12, 2.2, 1.15, x - 0.03, 1.35, SHOP.door, '#2f5f3f'); b.box(0.06, 2.4, 1.45, x - 0.01, 1.4, SHOP.door, '#f5efe2'); b.box(0.1, 0.1, 0.1, x - 0.1, 1.3, SHOP.door + 0.4, '#e8c65a');
  b.box(0.8, 0.22, 1.8, x - 0.4, 0.11, SHOP.door, STONE);
  win(x, 3.9, -32.6, -PI / 2); win(x, 3.9, -29.8, -PI / 2);
  // the sign bracket: one chain still on, the other snapped long ago
  const [px, py, pz] = SHOP.pivot;
  b.box(x - px + 1.0, 0.12, 0.12, (x + px - 1.0) / 2 + 0.5, py + 0.06, pz, '#2d2f36'); b.box(0.12, 0.7, 0.12, x - 0.06, py - 0.25, pz, '#2d2f36');
  b.box(0.06, 0.32, 0.06, px - 1.55, py - 0.16, pz, '#55565c'); b.box(0.08, 0.08, 0.08, px - 1.55, py - 0.34, pz, '#55565c');
  // the mirror-like window
  dyn.mirror = new Reflector(new THREE.PlaneGeometry(ww, wy1 - wy0), { clipBias: 0.003, textureWidth: W, textureHeight: H, color: 0xdfe5ea, multisample: 4 });
  dyn.mirror.position.set(x - 0.11, (wy0 + wy1) / 2, wzc); dyn.mirror.rotation.y = -PI / 2; scene.add(dyn.mirror);
  dyn.mirrorRender = dyn.mirror.onBeforeRender; dyn.mirror.onBeforeRender = () => {};
  const sheen = new THREE.Mesh(new THREE.PlaneGeometry(ww, wy1 - wy0), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, map: canvasTex(256, 128, (g) => { const gr = g.createLinearGradient(0, 0, 256, 128); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.45, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.10)'); gr.addColorStop(0.58, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.05)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 128); }) }));
  sheen.position.set(x - 0.13, (wy0 + wy1) / 2, wzc); sheen.rotation.y = -PI / 2; scene.add(sheen);
  // the hanging sign (dynamic)
  const sg = new THREE.Group(); sg.position.set(px, py, pz); scene.add(sg); dyn.hsign = sg;
  const chain = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), lam('#55565c')); chain.position.y = -0.25; sg.add(chain); dyn.chain = chain;
  const brd = new THREE.Group(); brd.position.y = -0.5; sg.add(brd); dyn.board = brd;
  const tex = canvasTex(512, 240, (g, w, hh) => { g.fillStyle = '#7a2f3a'; g.fillRect(0, 0, w, hh); g.strokeStyle = '#e8c65a'; g.lineWidth = 12; g.strokeRect(10, 10, w - 20, hh - 20); g.fillStyle = '#fff6ea'; g.textAlign = 'center'; g.font = '900 104px Inter, Arial'; g.fillText('BAKERY', w / 2, 156); });
  const bm = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.8, 0.08), [lam('#5a3a22'), lam('#5a3a22'), lam('#5a3a22'), lam('#5a3a22'), new THREE.MeshLambertMaterial({ map: tex }), new THREE.MeshLambertMaterial({ map: tex })]);
  bm.position.set(-0.85, -0.4, 0); bm.castShadow = true; brd.add(bm);
  const ring = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), lam('#55565c')); brd.add(ring);
}
function minaHouse() {
  const b = B.main, wall = '#f7e3a1';
  b.box(7, 3.2, 7, 8.5, 1.6, 44, wall); b.box(7.2, 0.45, 7.2, 8.5, 0.22, 44, '#9a8c7c');
  b.box(0.12, 2.2, 1.2, 4.97, 1.35, 44, '#7a2f2f'); b.box(0.06, 2.4, 1.5, 4.99, 1.4, 44, '#f5efe2'); b.box(0.8, 0.22, 1.8, 4.6, 0.11, 44, STONE);
  win(5, 1.95, 41.9, -PI / 2, true); win(5, 1.95, 46.1, -PI / 2, false); win(8.5, 1.95, 47.5, 0, false); win(12, 1.95, 44, PI / 2, false);
  b.box(7, 0.2, 7, 8.5, 3.3, 44, '#b08a5a');
  b.box(7, 4.6, 0.25, 8.5, 5.7, 47.375, wall); b.box(0.25, 4.6, 7, 11.875, 5.7, 44, wall); b.box(0.25, 4.6, 7, 5.125, 5.7, 44, wall);
  b.box(1.8, 4.6, 0.25, 5.9, 5.7, 40.625, wall); b.box(1.8, 4.6, 0.25, 11.1, 5.7, 40.625, wall);
  b.box(3.4, 0.8, 0.25, 8.5, 3.8, 40.625, wall); b.box(3.4, 0.6, 0.25, 8.5, 7.7, 40.625, wall);
  b.box(3.7, 0.12, 0.5, 8.5, 4.2, 40.55, '#f5efe2'); 
  b.box(0.14, 3.3, 0.3, 6.75, 5.8, 40.6, '#f5efe2'); b.box(0.14, 3.3, 0.3, 10.25, 5.8, 40.6, '#f5efe2'); b.box(3.7, 0.14, 0.3, 8.5, 7.42, 40.6, '#f5efe2');
  b.box(7, 0.2, 7, 8.5, 8.1, 44, '#e8dcc8');
  b.prism(7.9, 3.0, 7.9, 8.5, 8.2, 44, '#3f5870', PI / 2);
  b.box(0.8, 2.0, 0.8, 10.6, 10.2, 45.5, '#a8573f');
  // bedroom
  b.box(2.7, 0.5, 1.3, 8.3, 3.65, 41.45, '#7a5a3a'); b.box(2.6, 0.26, 1.2, 8.3, 3.9, 41.45, '#f2f2f2');
  b.box(0.7, 0.16, 0.95, 9.2, 4.1, 41.45, '#ffffff'); b.box(0.15, 1.3, 1.3, 9.7, 4.0, 41.45, '#7a5a3a');
  b.box(2.6, 0.04, 2.0, 8.2, 3.42, 44.2, '#c9605a'); b.box(2.2, 0.05, 1.6, 8.2, 3.43, 44.2, '#e8a08a');
  b.box(0.6, 0.7, 0.6, 10.5, 3.75, 41.3, '#8a6a4a'); b.box(0.12, 0.3, 0.12, 10.5, 4.25, 41.3, '#2d2f36'); B.glow.box(0.34, 0.3, 0.34, 10.5, 4.5, 41.3, '#ffffff');
  b.box(1.6, 1.6, 0.4, 7.0, 4.2, 47.0, '#8a6a4a'); for (let i = 0; i < 5; i++) b.box(0.22, 0.5 + rng() * 0.3, 0.3, 6.5 + i * 0.26, 5.3, 47.0, pick(['#e0546a', '#4a6fb5', '#f2c744', '#5c9a45']));
  b.box(0.05, 0.9, 1.2, 11.72, 6.0, 44, '#f5efe2'); b.box(0.06, 0.4, 0.4, 11.7, 6.1, 43.8, '#e0546a'); b.box(0.06, 0.3, 0.5, 11.7, 5.85, 44.2, '#4a6fb5');
  for (let i = 0; i < 4; i++) b.box(0.3, 0.3, 0.3, 6.2 + rng() * 1.5, 3.57, 42.8 + rng() * 2.5, pick(['#e0546a', '#4a6fb5', '#f2c744', '#5c9a45']), rng() * 3);
}
const matCache = {};
function lam(c) { const k = typeof c === 'string' ? c : '#' + c.getHexString(); return matCache[k] || (matCache[k] = new THREE.MeshLambertMaterial({ color: c })); }
const farMat = new THREE.MeshLambertMaterial({ color: '#6f9a6a' });

// ---------------------------------------------------------------- sky
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, sunAmt: { value: 1 } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunAmt; varying vec3 vDir;
  void main(){ vec3 d = normalize(vDir); float h = clamp(d.y,0.,1.); vec3 c = mix(hor, top, pow(h,0.55)); if(d.y<0.) c = mix(hor, hor*0.7, clamp(-d.y*5.,0.,1.));
    float s = max(dot(d, normalize(sunDir)),0.); c += sunCol*sunAmt*(pow(s,24.)*0.25 + pow(s,2200.)*6.);
    gl_FragColor = vec4(c,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), skyMat); sky.renderOrder = -10; scene.add(sky);
let stars, clouds;
{
  const r = mulberry32(11), n = 900, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = r() * 6.283, e = Math.asin(0.04 + r() * 0.96); p[i * 3] = Math.cos(a) * Math.cos(e) * 1000; p[i * 3 + 1] = Math.sin(e) * 1000; p[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 1000; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  stars = new THREE.Points(g, new THREE.PointsMaterial({ size: Math.max(1.5, W / 420), sizeAttenuation: false, color: 0xffffff, transparent: true, fog: false, depthWrite: false }));
  stars.renderOrder = -9; scene.add(stars);
  const cb = new Bld();
  for (let i = 0; i < 26; i++) { const a = r() * 6.283, rr = 220 + r() * 520, x = Math.cos(a) * rr, z = Math.sin(a) * rr, y = 95 + r() * 90; const n2 = 3 + Math.floor(r() * 4); for (let j = 0; j < n2; j++) cb.box(40 + r() * 50, 9 + r() * 9, 26 + r() * 30, x + (r() - 0.5) * 70, y + (r() - 0.5) * 8, z + (r() - 0.5) * 40, '#ffffff'); }
  clouds = cb.mesh(new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.92 }), false, false); scene.add(clouds);
}

// ---------------------------------------------------------------- lights and environments
const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1); sun.castShadow = true; { const sm = +(qs.get('sm') || 4096); sun.shadow.mapSize.set(sm, sm); } sun.shadow.bias = -0.0004; scene.add(sun); scene.add(sun.target);
const pts = [0, 1, 2, 3].map(() => { const p = new THREE.PointLight(0xffffff, 0, 20, 1.6); scene.add(p); return p; });
const fill = new THREE.PointLight(0xffffff, 0, 20, 1.6); scene.add(fill);
const FILL = { wind: ['#fff1dd', 0.55], day: ['#fff1dd', 0.55], dusk: ['#ffe2c8', 0.8], night: ['#e9e4ff', 1.5], late: ['#e9e4ff', 1.5], storm: ['#e6e4ff', 1.6], stormN: ['#e6e4ff', 1.6], dream: ['#ffb080', 0.4], snow: ['#ffffff', 0.4], stairs: ['#ffd9b0', 1.9] };
scene.fog = new THREE.Fog(0xffffff, 80, 400);
const C = (h, k = 1) => new THREE.Color(h).multiplyScalar(k);
const ENVS = {
  day: { top: C('#8ebbe6'), hor: C('#f8e6c8'), sunCol: C('#ffd0a0'), sunI: 3.4, sunDir: [-0.58, 0.33, 0.62], sunAmt: 1, hemiSky: C('#c2d6f2'), hemiGnd: C('#b08860'), hemiI: 1.25, fog: C('#f3e0c4'), fogN: 110, fogF: 620, stars: 0, winA: C('#587890'), winB: C('#4c6a82'), lamp: C('#efe9d8'), glow: C('#fff0c0'), cloud: C('#fff3e2'), far: C('#86a886'), rain: 0, snow: 0, exp: 1.0 },
  dusk: { top: C('#3b4c8c'), hor: C('#ff9a62'), sunCol: C('#ff8a48'), sunI: 2.0, sunDir: [-0.75, 0.13, 0.4], sunAmt: 1, hemiSky: C('#7477b8'), hemiGnd: C('#6a4540'), hemiI: 0.95, fog: C('#d08a6c'), fogN: 80, fogF: 480, stars: 0.5, winA: C('#ffcc66', 1.5), winB: C('#4c5a7c'), lamp: C('#ffe2a8', 1.6), glow: C('#ffd080', 1.8), cloud: C('#ff9d7a'), far: C('#5a5a86'), rain: 0, snow: 0, exp: 1.0 },
  night: { top: C('#060a1e'), hor: C('#1d2f60'), sunCol: C('#93b2ff'), sunI: 1.5, sunDir: [0.42, 0.62, 0.58], sunAmt: 0.6, hemiSky: C('#4a62b0'), hemiGnd: C('#1c2238'), hemiI: 1.15, fog: C('#16224a'), fogN: 70, fogF: 420, stars: 1, winA: C('#ffc75a', 2.0), winB: C('#27314f'), lamp: C('#ffe2a8', 2.2), glow: C('#ffcf80', 2.4), cloud: C('#1b274c'), far: C('#16224a'), rain: 0, snow: 0, exp: 1.2 },
  late: { top: C('#060a1e'), hor: C('#1d2f60'), sunCol: C('#93b2ff'), sunI: 1.5, sunDir: [0.42, 0.62, 0.58], sunAmt: 0.6, hemiSky: C('#4a62b0'), hemiGnd: C('#1c2238'), hemiI: 1.1, fog: C('#16224a'), fogN: 70, fogF: 420, stars: 1, winA: C('#2a3050'), winB: C('#1f2742'), lamp: C('#ffe2a8', 2.2), glow: C('#ffcf80', 2.4), cloud: C('#1b274c'), far: C('#16224a'), rain: 0, snow: 0, exp: 1.2 },
  storm: { top: C('#05070f'), hor: C('#18203a'), sunCol: C('#9fb6f2'), sunI: 2.4, sunDir: [0.42, 0.62, 0.58], sunAmt: 0, hemiSky: C('#4a60ac'), hemiGnd: C('#1a2034'), hemiI: 1.55, fog: C('#131d3a'), fogN: 50, fogF: 300, stars: 0, winA: C('#1e2540'), winB: C('#181e34'), lamp: C('#ffdca0', 1.8), glow: C('#ffcf80', 2.4), cloud: C('#0d1224'), far: C('#111a33'), rain: 1, snow: 0, exp: 1.3 },
  stormN: { top: C('#05070f'), hor: C('#1c2644'), sunCol: C('#b4c6ff'), sunI: 5.0, sunDir: [0.1, 0.34, -0.93], sunAmt: 0, hemiSky: C('#6a82cc'), hemiGnd: C('#222a42'), hemiI: 2.7, fog: C('#1a2546'), fogN: 80, fogF: 380, stars: 0, winA: C('#1e2540'), winB: C('#181e34'), lamp: C('#ffdca0', 1.8), glow: C('#ffcf80', 2.4), cloud: C('#0d1224'), far: C('#111a33'), rain: 1, snow: 0, exp: 1.05 },
  dream: { top: C('#2a0408'), hor: C('#ff5a22'), sunCol: C('#ff6a30'), sunI: 3.0, sunDir: [0.25, 0.25, -0.93], sunAmt: 1.5, hemiSky: C('#8a2a20'), hemiGnd: C('#2a0c0c'), hemiI: 0.9, fog: C('#b03a18'), fogN: 30, fogF: 240, stars: 0, winA: C('#2a1010'), winB: C('#200c0c'), lamp: C('#402020'), glow: C('#ff8040', 2), cloud: C('#5a1410'), far: C('#5a1a12'), rain: 0, snow: 0, exp: 1.0 },
  wind: { top: C('#9cc2e8'), hor: C('#f6e8cc'), sunCol: C('#ffd0a0'), sunI: 3.3, sunDir: [-0.62, 0.3, 0.52], sunAmt: 1, hemiSky: C('#c2d6f2'), hemiGnd: C('#b08860'), hemiI: 1.25, fog: C('#f0dfc4'), fogN: 90, fogF: 560, stars: 0, winA: C('#587890'), winB: C('#4c6a82'), lamp: C('#efe9d8'), glow: C('#fff0c0'), cloud: C('#fff3e2'), far: C('#86a886'), rain: 0, snow: 0, leaves: 1, exp: 1.0 },
  snow: { top: C('#b6c6d8'), hor: C('#eef2f6'), sunCol: C('#fff4e6'), sunI: 2.2, sunDir: [-0.5, 0.5, 0.6], sunAmt: 0.2, hemiSky: C('#dbe6f2'), hemiGnd: C('#c8d0dc'), hemiI: 1.5, fog: C('#e6ecf2'), fogN: 14, fogF: 90, stars: 0, winA: C('#587890'), winB: C('#4c6a82'), lamp: C('#efe9d8'), glow: C('#fff0c0'), cloud: C('#ffffff'), far: C('#dfe6ee'), rain: 0, snow: 1, exp: 1.0 },
  stairs: { top: C('#05070f'), hor: C('#0a0c14'), sunCol: C('#7f98d8'), sunI: 0.0, sunDir: [0.42, 0.62, 0.58], sunAmt: 0, hemiSky: C('#3a3a52'), hemiGnd: C('#2a1e16'), hemiI: 0.75, fog: C('#07080d'), fogN: 8, fogF: 46, stars: 0, winA: C('#1e2540'), winB: C('#181e34'), lamp: C('#ffdca0'), glow: C('#ffb860', 3), cloud: C('#0d1224'), far: C('#111a33'), rain: 0, snow: 0, exp: 1.05 },
};
function mixEnv(a, b, k) {
  const o = {};
  for (const key in a) { const x = a[key], y = b[key] === undefined ? x : b[key]; o[key] = x.isColor ? x.clone().lerp(y, k) : Array.isArray(x) ? x.map((v, i) => lerp(v, y[i], k)) : lerp(x, y, k); }
  return o;
}
const snowGround = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: '#f4f8fc' })); snowGround.rotation.x = -PI / 2; snowGround.position.y = 0.09; snowGround.receiveShadow = true; scene.add(snowGround);
function applyEnv(e, flash) {
  const f = clamp(flash, 0, 1.4), fc = new THREE.Color('#b8c6f6');
  skyMat.uniforms.top.value.copy(e.top).lerp(fc, clamp(f * 0.55)); skyMat.uniforms.hor.value.copy(e.hor).lerp(fc, clamp(f * 0.8));
  skyMat.uniforms.sunDir.value.set(...e.sunDir).normalize(); skyMat.uniforms.sunCol.value.copy(e.sunCol); skyMat.uniforms.sunAmt.value = e.sunAmt;
  hemi.color.copy(e.hemiSky).lerp(fc, clamp(f * 0.6)); hemi.groundColor.copy(e.hemiGnd); hemi.intensity = e.hemiI + f * 3.2;
  sun.color.copy(e.sunCol).lerp(fc, clamp(f * 0.7)); sun.intensity = e.sunI + f * 5;
  scene.fog.color.copy(e.fog).lerp(fc, clamp(f * 0.5)); scene.fog.near = e.fogN; scene.fog.far = e.fogF;
  stars.material.opacity = e.stars; stars.visible = e.stars > 0.01;
  dyn.winA.material.color.copy(e.winA); dyn.winB.material.color.copy(e.winB); dyn.lamp.material.color.copy(e.lamp); dyn.glow.material.color.copy(e.glow);
  clouds.material.color.copy(e.cloud).lerp(fc, clamp(f * 0.6)); farMat.color.copy(e.far);
  renderer.toneMappingExposure = e.exp;
  snowGround.visible = e.snow > 0.5;
}

// ---------------------------------------------------------------- characters
const faceCache = {};
function faceTex(name) {
  if (faceCache[name]) return faceCache[name];
  const t = canvasTex(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#1a1a1a'; g.fillStyle = '#1a1a1a'; g.lineWidth = 6;
    const eye = (x, y, w, h) => { g.fillStyle = '#1a1a1a'; g.beginPath(); g.ellipse(x, y, w, h, 0, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x - w * 0.25, y - h * 0.4, w * 0.32, h * 0.22, 0, 0, 7); g.fill(); g.fillStyle = '#1a1a1a'; };
    const big = (x, y, r, pr) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.lineWidth = 4; g.stroke(); g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(x, y + 1, pr, 0, 7); g.fill(); g.lineWidth = 6; };
    const line = (...p) => { g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.stroke(); };
    const arc = (x, y, r, a, b) => { g.beginPath(); g.arc(x, y, r, a, b); g.stroke(); };
    switch (name) {
      case 'neutral': eye(40, 56, 9, 13); eye(88, 56, 9, 13); line(52, 96, 76, 96); break;
      case 'smile': eye(40, 56, 9, 13); eye(88, 56, 9, 13); arc(64, 82, 20, 0.15 * PI, 0.85 * PI); break;
      case 'happy': arc(40, 62, 11, 1.1 * PI, 1.9 * PI); arc(88, 62, 11, 1.1 * PI, 1.9 * PI); g.beginPath(); g.arc(64, 82, 20, 0, PI); g.closePath(); g.fill(); g.fillStyle = '#e0546a'; g.beginPath(); g.arc(64, 96, 9, 0, PI); g.fill(); break;
      case 'sleep': arc(40, 52, 11, 0.1 * PI, 0.9 * PI); arc(88, 52, 11, 0.1 * PI, 0.9 * PI); g.beginPath(); g.arc(64, 94, 5, 0, 7); g.fill(); break;
      case 'wide': big(40, 56, 15, 8); big(88, 56, 15, 8); g.beginPath(); g.ellipse(64, 98, 7, 6, 0, 0, 7); g.fill(); break;
      case 'scared': big(40, 56, 17, 5); big(88, 56, 17, 5); line(24, 30, 50, 24); line(78, 24, 104, 30); g.beginPath(); g.ellipse(64, 100, 12, 15, 0, 0, 7); g.fill(); break;
      case 'worried': eye(40, 58, 9, 13); eye(88, 58, 9, 13); line(26, 40, 50, 30); line(78, 30, 102, 40); arc(64, 108, 16, 1.2 * PI, 1.8 * PI); break;
      case 'shout': line(28, 46, 50, 56, 28, 66); line(100, 46, 78, 56, 100, 66); g.beginPath(); g.roundRect(42, 76, 44, 38, 14); g.fill(); g.fillStyle = '#e0546a'; g.beginPath(); g.ellipse(64, 106, 13, 7, 0, 0, 7); g.fill(); break;
      case 'pain': line(28, 46, 50, 56, 28, 66); line(100, 46, 78, 56, 100, 66); line(46, 100, 55, 93, 64, 100, 73, 93, 82, 100); break;
      case 'sad': eye(40, 58, 9, 12); eye(88, 58, 9, 12); line(26, 42, 50, 34); line(78, 34, 102, 42); arc(64, 84, 16, 0.2 * PI, 0.8 * PI); break;
      case 'up': eye(40, 50, 9, 13); eye(88, 50, 9, 13); g.beginPath(); g.ellipse(64, 94, 6, 5, 0, 0, 7); g.fill(); break;
    }
  });
  return (faceCache[name] = t);
}
function makeChar(o) {
  const g = new THREE.Group(), s = o.scale || 1, hs = o.head || 1;
  const body = new THREE.Group(); body.scale.setScalar(s); g.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.7; body.add(hips);
  const torsoG = new THREE.Group(); hips.add(torsoG);
  const mk = (w, h, d, c, x, y, z, parent) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
  mk(0.62, 0.7, 0.32, o.shirt, 0, 0.35, 0, torsoG);
  if (o.coat) { mk(0.66, 0.2, 0.36, o.coat, 0, 0.08, 0, torsoG); mk(0.08, 0.6, 0.02, o.coat2 || '#ffffff', 0, 0.38, 0.17, torsoG); }
  const head = new THREE.Group(); head.position.y = 0.7; torsoG.add(head);
  const hg = new THREE.Group(); hg.scale.setScalar(hs); head.add(hg);
  const hm = new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.48, 0.5, 3, 0.09), lam(o.skin)); hm.position.y = 0.25; hm.castShadow = hm.receiveShadow = true; hg.add(hm);
  const faceMat = new THREE.MeshLambertMaterial({ map: faceTex('neutral'), transparent: true, alphaTest: 0.35 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46), faceMat); face.position.set(0, 0.25, 0.256); hg.add(face);
  const hair = o.hair;
  if (o.hairStyle === 'pigtails') { mk(0.56, 0.16, 0.54, hair, 0, 0.47, -0.01, hg); mk(0.56, 0.36, 0.12, hair, 0, 0.3, -0.24, hg); mk(0.56, 0.1, 0.08, hair, 0, 0.42, 0.24, hg); mk(0.16, 0.3, 0.16, hair, 0.34, 0.2, -0.06, hg); mk(0.16, 0.3, 0.16, hair, -0.34, 0.2, -0.06, hg); mk(0.1, 0.08, 0.1, '#e0546a', 0.3, 0.36, -0.06, hg); mk(0.1, 0.08, 0.1, '#e0546a', -0.3, 0.36, -0.06, hg); }
  else if (o.hairStyle === 'old') { mk(0.6, 0.1, 0.62, o.hat, 0, 0.5, 0.02, hg); mk(0.5, 0.08, 0.2, o.hat, 0, 0.47, 0.34, hg); mk(0.56, 0.2, 0.14, hair, 0, 0.32, -0.23, hg); mk(0.06, 0.2, 0.3, hair, 0.27, 0.3, -0.08, hg); mk(0.06, 0.2, 0.3, hair, -0.27, 0.3, -0.08, hg); mk(0.44, 0.15, 0.1, hair, 0, 0.0, 0.24, hg); mk(0.3, 0.1, 0.08, hair, 0, -0.1, 0.22, hg); }
  else if (o.hairStyle === 'bob') { mk(0.56, 0.16, 0.54, hair, 0, 0.47, -0.01, hg); mk(0.56, 0.4, 0.12, hair, 0, 0.28, -0.24, hg); mk(0.07, 0.34, 0.4, hair, 0.28, 0.3, -0.05, hg); mk(0.07, 0.34, 0.4, hair, -0.28, 0.3, -0.05, hg); }
  else if (o.hairStyle === 'hat') { mk(0.6, 0.12, 0.6, hair, 0, 0.5, 0, hg); mk(0.8, 0.05, 0.8, hair, 0, 0.44, 0, hg); }
  else if (o.hairStyle === 'flat') { mk(0.56, 0.14, 0.54, hair, 0, 0.47, -0.01, hg); mk(0.56, 0.2, 0.1, hair, 0, 0.36, -0.24, hg); }
  const limb = (x, y, c, c2, parent, w, d) => { const G = new THREE.Group(); G.position.set(x, y, 0); parent.add(G); mk(w, 0.56, d, c, 0, -0.26, 0, G); mk(w, 0.15, d, c2, 0, -0.615, 0, G); return G; };
  const armL = limb(0.45, 0.66, o.shirt, o.skin, torsoG, 0.26, 0.28), armR = limb(-0.45, 0.66, o.shirt, o.skin, torsoG, 0.26, 0.28);
  const legL = limb(0.16, 0, o.pants, o.shoes || o.skin, hips, 0.3, 0.3), legR = limb(-0.16, 0, o.pants, o.shoes || o.skin, hips, 0.3, 0.3);
  scene.add(g);
  const c = {
    name: o.name, g, s, body, hips, torsoG, head, armL, armR, legL, legR, faceMat,
    reset() { g.visible = false; g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); body.rotation.set(0, 0, 0); body.position.set(0, 0, 0); hips.rotation.set(0, 0, 0); torsoG.rotation.set(0, 0, 0); head.rotation.set(0, 0, 0); armL.rotation.set(0, 0, 0); armR.rotation.set(0, 0, 0); legL.rotation.set(0, 0, 0); legR.rotation.set(0, 0, 0); faceMat.map = faceTex(o.face || 'neutral'); return c; },
    at(x, y, z, ry = 0) { c.reset(); g.visible = true; g.position.set(x, y + 0.06, z); g.rotation.y = ry; return c; },
    walk(ph, amp = 0.75) { const sn = Math.sin(ph); legL.rotation.x = sn * amp; legR.rotation.x = -sn * amp; armL.rotation.x = -sn * amp * 0.85; armR.rotation.x = sn * amp * 0.85; body.position.y = Math.abs(Math.cos(ph)) * 0.05 * amp; return c; },
    set(p) {
      if (p.armL) armL.rotation.set(p.armL[0], 0, p.armL[1] || 0);
      if (p.armR) armR.rotation.set(p.armR[0], 0, -(p.armR[1] || 0));
      if (p.legL !== undefined) legL.rotation.x = p.legL; if (p.legR !== undefined) legR.rotation.x = p.legR;
      if (p.head) head.rotation.set(p.head[1] || 0, p.head[0] || 0, p.head[2] || 0);
      if (p.lean !== undefined) torsoG.rotation.x = p.lean;
      if (p.sit) { legL.rotation.x = -1.5; legR.rotation.x = -1.5; body.position.y = -0.55 * s; }
      if (p.lie) { body.rotation.x = -PI / 2; body.position.y = 0.16 * s; }
      if (p.dive !== undefined) { const k = p.dive; body.rotation.x = -PI / 2 * 0.95 * Math.min(1, k * 1.25); body.position.y = s * (0.16 * Math.min(1, k * 1.4) + 0.55 * Math.sin(PI * Math.min(1, k)) * (k < 1 ? 1 : 0)); body.position.z = s * 1.3 * k; armL.rotation.set(-2.9, 0, 0.15); armR.rotation.set(-2.9, 0, -0.15); legL.rotation.x = 0.2; legR.rotation.x = -0.1; }
      if (p.face) faceMat.map = faceTex(p.face);
      if (p.dy) body.position.y += p.dy;
      return c;
    },
  };
  return c.reset();
}

// ---------------------------------------------------------------- the monster
const MC = { body: '#8a98a6', body2: '#74828f', belly: '#aab5be', plate: '#566270', moss: '#6a9a45', horn: '#f0e6cc' };
const POSES = {
  sit: { hip: 5.6, thL: -2.0, shL: 2.3, thR: -2.0, shR: 2.3, lean: 0.72, head: 0.05, arm: -1.0, fore: -0.9, armZ: 0.12 },
  stir: { hip: 5.6, thL: -2.0, shL: 2.3, thR: -2.0, shR: 2.3, lean: 0.48, head: -0.25, arm: -0.6, fore: -1.1, armZ: 0.3 },
  stand: { hip: 20.4, thL: 0.05, shL: 0, thR: -0.05, shR: 0, lean: 0.2, head: 0.3, arm: 0.1, fore: -0.3, armZ: 0.14 },
  roar: { hip: 20.4, thL: 0.25, shL: 0, thR: -0.35, shR: 0.2, lean: 0.05, head: 0.45, arm: -2.3, fore: -0.7, armZ: 0.5 },
  stop: { hip: 20.4, thL: 0.12, shL: 0, thR: -1.15, shR: 0.6, lean: 0.12, head: 0.5, arm: -0.35, fore: -0.6, armZ: 0.35 },
};
const mon = {};
function buildMonster() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const seg = (parent, fn) => { const b = new Bld(); const save = B.main; B.main = b; fn(b); B.main = save; const m = b.mesh(mat); parent.add(m); return m; };
  const root = new THREE.Group(); scene.add(root); mon.root = root;
  const hips = new THREE.Group(); root.add(hips); mon.hips = hips;
  seg(hips, b => { b.box(11.4, 4.2, 6.6, 0, 0, 0, MC.body2); b.box(2, 2, 5, 0, -0.5, -5, MC.body2, 0, 0.5); b.box(1.4, 1.4, 4, 0, -1.6, -8.4, MC.plate, 0, 0.2); });
  const torso = new THREE.Group(); torso.position.set(0, 1.5, 0); hips.add(torso); mon.torso = torso;
  seg(torso, b => {
    b.box(13, 15, 8, 0, 7.5, 0, MC.body); b.box(9, 9.5, 0.7, 0, 6.6, 4.05, MC.belly);
    for (let i = 0; i < 5; i++) b.box(2.4, 2.8, 2.4, 0, 2.2 + i * 3.1, -4.5, MC.plate, 0, 0.7);
    b.box(4.2, 4.2, 8.8, 7.3, 13.2, 0, MC.body2); b.box(4.2, 4.2, 8.8, -7.3, 13.2, 0, MC.body2);
    b.box(12.4, 0.6, 7.4, 0, 15.2, -0.2, MC.moss); b.box(3.8, 0.6, 8.2, 7.3, 15.45, 0, MC.moss); b.box(3.8, 0.6, 8.2, -7.3, 15.45, 0, MC.moss);
    b.box(5, 4, 0.5, -3, 10, -4.2, MC.moss); b.box(4, 5, 0.5, 3.4, 5.5, -4.2, MC.moss); b.box(0.5, 4, 4, 6.6, 8, -1, MC.moss); b.box(0.5, 3, 3, -6.6, 5, 1, MC.moss);
    for (const [x, y, z, s] of [[-4, 15.5, -2, 1.2], [3.2, 15.5, -1.2, 0.95], [7.2, 15.7, 0.8, 1.05], [-7.3, 15.7, -0.6, 0.85], [-3, 11.5, -4.4, 1.0], [2.6, 8.4, -4.4, 1.25], [4.8, 13, -4.4, 0.8], [-1.2, 5, -4.4, 0.9], [0.4, 15.5, 2.2, 0.7]]) tree(b, x, y, z, s, -0.75);
  });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x000000 }); mon.glowMat = glowMat;
  { const b = new Bld(); for (const [x, y, w, h, r] of [[0, 8.6, 0.7, 4.6, 0.2], [1.5, 10.4, 0.6, 3.2, -0.7], [-1.4, 6.6, 0.6, 3.4, -0.6], [1.9, 6.2, 0.5, 2.6, 0.8], [-2.2, 10.2, 0.5, 2.8, 0.9], [0.2, 4.2, 0.5, 2.2, -0.3], [3.2, 8.4, 0.4, 2.0, 1.4], [-3.3, 8.2, 0.4, 2.0, 1.5]]) b.box(w, h, 0.3, x, y, 4.5, '#ffffff', 0, 0, r); torso.add(b.mesh(glowMat, false, false)); }
  const head = new THREE.Group(); head.position.set(0, 15.5, 1.2); torso.add(head); mon.head = head;
  seg(head, b => {
    b.box(5, 2.4, 5, 0, 0.2, 0, MC.body2); b.box(7.6, 6, 7.6, 0, 3.4, 1.5, MC.body); b.box(8.0, 1.3, 1.4, 0, 5.3, 5.0, MC.body2);
    b.box(6.6, 1.9, 5.8, 0, 0.6, 2.9, MC.body2); for (let i = 0; i < 5; i++) b.box(0.7, 0.9, 0.5, -2.4 + i * 1.2, 1.75, 5.5, MC.horn);
    for (const s of [-1, 1]) { b.box(1.4, 5, 1.4, s * 3.7, 7.6, 0.6, MC.horn, 0, 0, -s * 0.5); b.box(1.0, 4.4, 1.0, s * 5.9, 10.8, 0.6, MC.horn, 0, 0, -s * 0.95); b.box(0.6, 2.4, 0.6, s * 8.2, 12.0, 0.6, MC.horn, 0, 0, -s * 1.3); }
    b.box(6.2, 0.5, 6.2, 0, 6.6, 1.2, MC.moss); b.box(4.4, 2.6, 0.3, 0, 3.6, 5.26, '#0e1116');
    tree(b, -1.5, 6.8, 0.6, 0.6, -1.25);
  });
  mon.eyeMat = new THREE.MeshBasicMaterial({ color: 0xffb030 });
  mon.eye = new THREE.Mesh(new THREE.BoxGeometry(3.7, 1.9, 0.2), mon.eyeMat); mon.eye.position.set(0, 3.6, 5.44); head.add(mon.eye);
  const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.8, 0.26), new THREE.MeshBasicMaterial({ color: 0x050505 })); pupil.position.set(0, 3.6, 5.46); head.add(pupil); mon.pupil = pupil;
  mon.lid = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.7, 0.5), lam('#66737f')); mon.lid.position.set(0, 3.6, 5.52); head.add(mon.lid);
  mon.lash = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.32, 0.2), new THREE.MeshBasicMaterial({ color: 0x14181e })); mon.lash.position.set(0, 3.0, 5.82); head.add(mon.lash);
  const arm = (sx) => {
    const a = new THREE.Group(); a.position.set(sx * 7.9, 13.2, 0); torso.add(a);
    seg(a, b => b.box(3.5, 9.4, 3.9, 0, -4.5, 0, MC.body));
    const f = new THREE.Group(); f.position.set(0, -9, 0); a.add(f);
    seg(f, b => { b.box(3.2, 9, 3.5, 0, -4.5, 0, MC.body2); b.box(4, 3.3, 4, 0, -9.6, 0, MC.body); for (let i = 0; i < 3; i++) b.box(0.6, 1.6, 0.6, -1.2 + i * 1.2, -11.6, 1.2, MC.horn); });
    return [a, f];
  };
  [mon.armL, mon.foreL] = arm(1); [mon.armR, mon.foreR] = arm(-1);
  const leg = (sx) => {
    const t = new THREE.Group(); t.position.set(sx * 4.7, -0.5, 0); hips.add(t);
    seg(t, b => b.box(4.7, 10.4, 5.1, 0, -5, 0, MC.body));
    const sh = new THREE.Group(); sh.position.set(0, -10, 0); t.add(sh);
    seg(sh, b => { b.box(4.2, 10, 4.5, 0, -5, 0, MC.body2); b.box(5.2, 2.3, 7.8, 0, -9.6, 1.6, MC.body); for (let i = 0; i < 3; i++) b.box(0.9, 1.1, 1.3, -1.6 + i * 1.6, -10.2, 5.8, MC.horn); });
    return [t, sh];
  };
  [mon.legL, mon.shinL] = leg(1); [mon.legR, mon.shinR] = leg(-1);
  mon.footR = new THREE.Object3D(); mon.footR.position.set(0, -10.7, 2); mon.shinR.add(mon.footR);
  mon.chest = new THREE.Object3D(); mon.chest.position.set(0, 8, 4.6); torso.add(mon.chest);
  mon.zzz = [0, 1, 2].map(() => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex('Z', '#ffffff'), transparent: true, fog: false })); scene.add(sp); return sp; });
}
function applyMonster(o, T) {
  const a = POSES[o.a || 'sit'], b = POSES[o.b || o.a || 'sit'], k = o.k || 0, p = {};
  for (const key in a) p[key] = lerp(a[key], b[key], k);
  const pos = o.pos || MON, br = Math.sin(T * 1.6) * (o.eye > 0.5 ? 0.012 : 0.022);
  mon.root.position.set(pos[0], pos[1], pos[2]); mon.root.rotation.y = o.ry !== undefined ? o.ry : -0.2;
  mon.hips.position.y = p.hip; mon.torso.rotation.x = p.lean + br; mon.torso.rotation.z = o.sway || 0; mon.head.rotation.x = p.head + br * 0.6; mon.head.rotation.y = o.headYaw || 0;
  mon.armL.rotation.set(p.arm, 0, p.armZ); mon.armR.rotation.set(p.arm, 0, -p.armZ); mon.foreL.rotation.x = p.fore; mon.foreR.rotation.x = p.fore;
  mon.legL.rotation.x = p.thL; mon.shinL.rotation.x = p.shL; mon.legR.rotation.x = p.thR; mon.shinR.rotation.x = p.shR;
  const eo = clamp(o.eye || 0); mon.lid.scale.y = lerp(1, 0.05, eo); mon.lid.position.y = 3.6 + 1.3 * eo; mon.lash.visible = eo < 0.5; mon.lash.position.y = 3.0 + 2.2 * eo;
  mon.eyeMat.color.set(o.eyeCol || '#ffb030').multiplyScalar(1 + eo * 1.5);
  { const gv = clamp(o.glow || 0, 0, 1.6); mon.glowMat.color.set('#4c5661').lerp(new THREE.Color(o.glowCol || '#ff9a2a').multiplyScalar(2.6), clamp(gv)); }
  mon.root.updateMatrixWorld(true);
  const hw = new THREE.Vector3(0, 6, 3); mon.head.localToWorld(hw);
  mon.zzz.forEach((sp, i) => {
    sp.visible = !!o.zzz; if (!o.zzz) return;
    const ph = ((T * 0.45 + i / 3) % 1); sp.position.set(hw.x + 2 + ph * 7 + Math.sin(ph * 6 + i) * 0.8, hw.y + 3 + ph * 11, hw.z + 2);
    const sc = 2.2 + ph * 3.2; sp.scale.set(sc, sc, 1); sp.material.opacity = Math.sin(ph * PI) * 0.95;
  });
}

// ---------------------------------------------------------------- sprites, rings, weather
const textCache = {};
function textTex(txt, color = '#ffffff') {
  const key = txt + color; if (textCache[key]) return textCache[key];
  return (textCache[key] = canvasTex(512, 256, (g) => { g.clearRect(0, 0, 512, 256); g.font = '900 190px Inter, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 34; g.strokeStyle = '#101018'; g.strokeText(txt, 256, 134); g.fillStyle = color; g.fillText(txt, 256, 134); }));
}
const nums = [], rings = [], rips = [], tags = [], tagQ = [];
let numI = 0, ripI = 0;
function buildFx() {
  for (let i = 0; i < 12; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, fog: false })); sp.renderOrder = 50; scene.add(sp); nums.push(sp); }
  for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(0.955, 1, 96), new THREE.MeshBasicMaterial({ color: '#fff2c8', transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false })); m.rotation.x = -PI / 2; scene.add(m); rings.push(m); }
  for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 64), new THREE.MeshBasicMaterial({ color: '#ffb040', transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); m.rotation.x = -PI / 2; scene.add(m); rips.push(m); }
  for (let i = 0; i < 48; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, fog: false, depthWrite: false })); sp.renderOrder = 40; sp.visible = false; scene.add(sp); tags.push(sp); }
  { const g = new THREE.Group(); const m = (w, h, d, c, x, y, z) => { const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c)); q.position.set(x, y, z); q.castShadow = true; g.add(q); }; m(0.5, 0.22, 0.36, '#8a5a2a', 0, 0.11, 0); m(0.54, 0.05, 0.4, '#6b4a2e', 0, 0.22, 0); m(0.16, 0.16, 0.16, '#d8402f', -0.13, 0.3, 0.02); m(0.16, 0.16, 0.16, '#e0503c', 0.08, 0.3, -0.05); m(0.15, 0.15, 0.15, '#c9382a', 0.1, 0.3, 0.1); m(0.3, 0.12, 0.14, '#d9a35a', -0.02, 0.36, 0.0); scene.add(g); dyn.basket = g; g.visible = false; }
  // bell + rope
  const prof = [[0.02, 0.95], [0.3, 0.95], [0.5, 0.78], [0.62, 0.35], [0.72, -0.3], [0.88, -0.75], [1.08, -0.95], [1.1, -1.0]].map(p => new THREE.Vector2(p[0], p[1]));
  const bell = new THREE.Group(); bell.position.set(0, 23.3, 0); scene.add(bell); dyn.bell = bell;
  const bm = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), new THREE.MeshLambertMaterial({ color: '#e0a83a', side: THREE.DoubleSide, emissive: '#3a2400' })); bm.position.y = -1.1; bm.castShadow = true; bell.add(bm);
  const cl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), lam('#6b4a2e')); cl.position.y = -1.95; bell.add(cl);
  const yoke = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.3, 0.4), lam('#5a3a22')); yoke.position.y = -0.05; bell.add(yoke);
  dyn.rope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 3.6, 6), lam('#d8c49a')); dyn.rope.castShadow = true; scene.add(dyn.rope);
  dyn.knot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.14), lam('#b89a5a')); scene.add(dyn.knot);
  // crows on the wire
  dyn.crows = [20.5, 23.2, 25.6, 28.4, 31].map((z, i) => { const g = new THREE.Group(); const m = (w, h, d, c, x, y, zz) => { const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c)); q.position.set(x, y, zz); q.castShadow = true; g.add(q); }; m(0.3, 0.3, 0.5, '#17181f', 0, 0.2, 0); m(0.24, 0.24, 0.24, '#17181f', 0, 0.42, 0.18); m(0.08, 0.07, 0.16, '#e8a13a', 0, 0.4, 0.36); m(0.2, 0.06, 0.3, '#17181f', 0, 0.12, -0.3); g.position.set(-4.0, 6.76, z); g.rotation.y = PI / 2 + (i % 2 ? 0.3 : -0.2); scene.add(g); return g; });
  // blanket
  dyn.blanket = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.24, 1.2), lam('#4a6fb5')); dyn.blanket.position.set(8.02, 4.2, 41.45); dyn.blanket.castShadow = true; scene.add(dyn.blanket);
  // cracks under the town
  const cb = new Bld(), r = mulberry32(99);
  for (let k = 0; k < 9; k++) { let a = k / 9 * 6.283 + r() * 0.4, x = Math.cos(a) * 3.6, z = Math.sin(a) * 3.6; for (let i = 0; i < 16; i++) { a += (r() - 0.5) * 0.9; const len = 3 + r() * 4.5, nx = x + Math.cos(a) * len, nz = z + Math.sin(a) * len; cb.box(len + 0.3, 0.06, Math.max(0.25, 1.3 - i * 0.07), (x + nx) / 2, 0.16, (z + nz) / 2, '#ffffff', -a); if (r() < 0.35) { const a2 = a + (r() < 0.5 ? 1 : -1) * 0.9, l2 = 2 + r() * 4; cb.box(l2, 0.06, 0.35, nx + Math.cos(a2) * l2 / 2, 0.16, nz + Math.sin(a2) * l2 / 2, '#ffffff', -a2); } x = nx; z = nz; } }
  dyn.cracks = cb.mesh(new THREE.MeshBasicMaterial({ color: '#ff2a12', fog: false }), false, false); scene.add(dyn.cracks);
  dyn.underGlow = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, map: canvasTex(256, 256, (g) => { const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(255,60,20,1)'); gr.addColorStop(0.5, 'rgba(255,40,10,0.45)'); gr.addColorStop(1, 'rgba(255,30,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }) }));
  dyn.underGlow.rotation.x = -PI / 2; dyn.underGlow.position.y = 0.2; scene.add(dyn.underGlow);
  // rain + snow
  const rr = mulberry32(5), NR = 2600;
  dyn.rain = new THREE.InstancedMesh(new THREE.BoxGeometry(0.014, 0.8, 0.014), new THREE.MeshBasicMaterial({ color: '#b8c8ee', transparent: true, opacity: 0.42, fog: false }), NR); dyn.rain.frustumCulled = false; scene.add(dyn.rain);
  dyn.rainSeed = Array.from({ length: NR }, () => [rr(), rr(), rr(), 0.8 + rr() * 0.5]);
  const NL = 500; dyn.leaves = new THREE.InstancedMesh(new THREE.BoxGeometry(0.11, 0.015, 0.08), new THREE.MeshLambertMaterial({ color: '#ffffff' }), NL); dyn.leaves.frustumCulled = false; dyn.leaves.castShadow = false; scene.add(dyn.leaves);
  dyn.leafSeed = Array.from({ length: NL }, () => [rr(), rr(), rr(), 0.6 + rr() * 0.8, rr() * 6]);
  { const cs = ['#e0802a', '#c9502a', '#e8b030', '#a8602a', '#7a9a3a']; dyn.leafSeed.forEach((q, i) => dyn.leaves.setColorAt(i, new THREE.Color(cs[i % cs.length]))); }
  const NS = 1400;
  dyn.snow = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false }), NS); dyn.snow.frustumCulled = false; scene.add(dyn.snow);
  dyn.snowSeed = Array.from({ length: NS }, () => [rr(), rr(), rr(), 0.6 + rr() * 0.8]);
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
function weather(T, e) {
  const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
  const ox = cx + fwd.x * 9, oz = cz + fwd.z * 9, oy = cy + fwd.y * 6;
  dyn.rain.visible = e.rain > 0.5;
  if (dyn.rain.visible) {
    _q.setFromEuler(new THREE.Euler(0.05, 0, 0.16)); const Wd = 26, Hh = 22;
    dyn.rainSeed.forEach((s, i) => {
      const fall = (T * 22 * s[3] + s[2] * Hh) % Hh, y = oy + Hh / 2 - fall;
      const x = ox + ((((s[0] * Wd - ox - fall * 0.16) % Wd) + Wd) % Wd) - Wd / 2, z = oz + ((((s[1] * Wd - oz) % Wd) + Wd) % Wd) - Wd / 2;
      if ((x - cx) ** 2 + (z - cz) ** 2 < 9) _v.set(x, -500, z); else _v.set(x, y, z);
      _m.compose(_v, _q, _s); dyn.rain.setMatrixAt(i, _m);
    });
    dyn.rain.instanceMatrix.needsUpdate = true;
  }
  dyn.leaves.visible = (e.leaves || 0) > 0.5;
  if (dyn.leaves.visible) {
    const Wd = 16, Hh = 7, e2 = new THREE.Euler();
    dyn.leafSeed.forEach((q, i) => {
      const run = (T * 3.2 * q[3] + q[0] * Wd) % Wd, y = Math.max(0.05, oy - 1 + ((q[1] * Hh + Math.sin(T * 1.7 + q[4]) * 0.8) % Hh) - Hh / 2 + 2);
      const x = ox + ((((q[2] * Wd - ox) % Wd) + Wd) % Wd) - Wd / 2, z = oz + ((((run - oz) % Wd) + Wd) % Wd) - Wd / 2;
      e2.set(T * 3 * q[3] + q[4], T * 2 + q[4], T * 4 * q[3]); _q.setFromEuler(e2); _m.compose(_v.set(x, y, z), _q, _s); dyn.leaves.setMatrixAt(i, _m);
    });
    dyn.leaves.instanceMatrix.needsUpdate = true;
  }
  dyn.snow.visible = e.snow > 0.5;
  if (dyn.snow.visible) {
    _q.identity(); const Wd = 12, Hh = 8;
    dyn.snowSeed.forEach((s, i) => {
      const fall = (T * 1.3 * s[3] + s[2] * Hh) % Hh, y = oy + Hh / 2 - fall;
      const x = ox + ((((s[0] * Wd - ox + Math.sin(T + i) * 0.2) % Wd) + Wd) % Wd) - Wd / 2, z = oz + ((((s[1] * Wd - oz) % Wd) + Wd) % Wd) - Wd / 2;
      _m.compose(_v.set(x, y, z), _q, _s); dyn.snow.setMatrixAt(i, _m);
    });
    dyn.snow.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- cast + stage API
const rf = mulberry32(21);
const FOLK_COL = ['#d9534f', '#4a6fb5', '#5c9a45', '#f2c744', '#8e5fb5', '#e08a3c', '#3aa6a0', '#c96a9a', '#6a7a8a', '#b5553a', '#447a5a', '#d0b060', '#5a5ab0'];
const SKINS = ['#f2c9a0', '#e2b088', '#c98f66', '#8f5f40', '#f6d7b8'];
const S = { folk: [] };
function makeDog() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); const col = '#c98f4a', dark = '#8a5a2a';
  const mk = (w, h, d, c, x, y, z, parent) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
  mk(0.28, 0.28, 0.62, col, 0, 0.42, 0, body); mk(0.2, 0.1, 0.3, '#f4e6d0', 0, 0.3, 0.05, body);
  const head = new THREE.Group(); head.position.set(0, 0.56, 0.36); body.add(head);
  mk(0.3, 0.28, 0.28, col, 0, 0.08, 0.06, head); mk(0.16, 0.13, 0.16, '#f4e6d0', 0, 0.02, 0.25, head); mk(0.07, 0.06, 0.05, '#1a1a1a', 0, 0.06, 0.34, head);
  mk(0.08, 0.16, 0.06, dark, 0.13, 0.26, 0, head); mk(0.08, 0.16, 0.06, dark, -0.13, 0.26, 0, head); mk(0.05, 0.06, 0.02, '#1a1a1a', 0.08, 0.13, 0.21, head); mk(0.05, 0.06, 0.02, '#1a1a1a', -0.08, 0.13, 0.21, head);
  const legs = [[0.1, 0.22], [-0.1, 0.22], [0.1, -0.22], [-0.1, -0.22]].map(([x, z]) => { const G = new THREE.Group(); G.position.set(x, 0.3, z); body.add(G); mk(0.1, 0.32, 0.1, dark, 0, -0.15, 0, G); return G; });
  const tail = new THREE.Group(); tail.position.set(0, 0.52, -0.3); body.add(tail); mk(0.07, 0.3, 0.07, col, 0, 0.13, 0, tail); tail.rotation.x = -0.7;
  scene.add(g);
  const d = { g, reset() { g.visible = false; body.rotation.set(0, 0, 0); body.position.set(0, 0, 0); head.rotation.set(0, 0, 0); legs.forEach(l => l.rotation.x = 0); return d; },
    at(x, y, z, ry = 0) { d.reset(); g.visible = true; g.position.set(x, y + 0.06, z); g.rotation.y = ry; return d; },
    run(ph, amp = 0.8) { legs.forEach((l, i) => l.rotation.x = Math.sin(ph + (i % 3 ? 0 : PI)) * amp); body.position.y = Math.abs(Math.sin(ph)) * 0.06; tail.rotation.z = Math.sin(ph * 1.3) * 0.5; return d; },
    sit(T = 0, up = 0) { body.rotation.x = -0.5; body.position.y = -0.08; legs[2].rotation.x = legs[3].rotation.x = 1.1; legs[0].rotation.x = legs[1].rotation.x = 0.5; head.rotation.x = 0.4 - up; tail.rotation.z = Math.sin(T * 9) * 0.6; return d; } };
  return d.reset();
}
function buildCast() {
  S.leo = makeChar({ name: 'leo', scale: 0.62, head: 1.32, skin: '#f6d2ae', shirt: '#2fa39a', pants: '#2f3f5f', shoes: '#f2f2f2', hair: '#6b3f22', hairStyle: 'flat', face: 'smile' });
  S.pip = makeChar({ name: 'pip', scale: 0.5, head: 1.4, skin: '#f9dcc0', shirt: '#f7c81e', pants: '#d8402f', shoes: '#d8402f', hair: '#2a1d14', hairStyle: 'pigtails', face: 'smile' });
  for (let i = 0; i < 13; i++) S.folk.push(makeChar({ name: 'folk' + i, scale: i % 5 === 3 ? 0.66 : 0.92 + rf() * 0.12, head: i % 5 === 3 ? 1.3 : 1.05, skin: pick2(rf, SKINS), shirt: FOLK_COL[i], pants: pick2(rf, ['#3a4558', '#5a4a3a', '#2f3f5f', '#4a4a4a', '#6a5a4a']), shoes: '#2a2a2a', hair: pick2(rf, ['#2a1d14', '#6b3f22', '#c9a050', '#8a8a8a', '#3a2a20', '#a04a2a']), hairStyle: pick2(rf, ['flat', 'bob', 'hat', 'flat']), face: 'smile' }));
  S.dog = makeDog();
  S.all = [S.leo, S.pip, ...S.folk];
  dyn.ball = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 10), lam('#e0503c')); dyn.ball.castShadow = true; scene.add(dyn.ball);
}
const NUMS = [34, 8, 51, 17, 3, 26, 12, 44, 9, 61, 15, 29, 6];
const PATHS = [[-11, 6, 11, 7.5], [1.5, 14, 1.8, 60], [-1.5, 58, -1.2, 13], [14, 1.5, 55, 1.2], [-14, -1.5, -55, -1], [-1.5, -13, -1, -34], [-9, -7.5, 8, -9.5], [7.5, 9.5, -9.5, 9], [2.6, 20, 2.8, 50], [12, -2, 40, -1.5]];
function crowd(T, shot, u) {
  const cn = (i) => { const n = shot.cn ? shot.cn(i, u) : [NUMS[i], '#ffffff']; if (n) S.tag(S.folk[i], n[0], n[1]); };
  PATHS.forEach((p, i) => {
    const len = Math.hypot(p[2] - p[0], p[3] - p[1]), sp = 1.0 + (i % 3) * 0.15, tt = (T * sp + i * 7.3) % (2 * len), fwd = tt < len, k = (fwd ? tt : 2 * len - tt) / len;
    const ry = Math.atan2(p[2] - p[0], p[3] - p[1]) + (fwd ? 0 : PI);
    S.folk[i].at(lerp(p[0], p[2], k), 0, lerp(p[1], p[3], k), ry).walk(T * sp * 5.2 + i, 0.6); cn(i);
  });
  const bx = -6.5, bz = 6.5;
  [[-5.0, 9.0], [-3.9, 8.0], [-6.1, 9.7]].forEach((q, j) => { const c = S.folk[10 + j]; c.at(q[0], 0, q[1], Math.atan2(bx - q[0], bz - q[1])).set({ head: [Math.sin(T * 0.8 + j * 2) * 0.25, -0.12], armR: j === 0 ? [-1.3 + Math.sin(T * 3) * 0.1, 0.1] : [0, 0.05] }); cn(10 + j); });
}
let monState = null, lightsSet = false;
Object.assign(S, {
  mon(o) { monState = Object.assign({}, o); },
  bell(a) { dyn.bell.rotation.x = a; },
  rope(dy = 0, sway = 0) { dyn.rope.position.set(1.25 + sway, 21.6 - dy, 0); dyn.knot.position.set(1.25 + sway, 19.85 - dy, 0); },
  ring(age, big = 1) { rings.forEach((m, i) => { const a = age - i * 0.2; m.visible = a > 0 && a < 1.6; if (!m.visible) return; const r = 3 + a * 46 * big; m.scale.set(r, r, 1); m.position.set(0, 22.2, 0); m.material.opacity = 0.85 * (1 - a / 1.6); }); },
  rip(x, y, z, age, color = '#ffb040', maxR = 2.6, life = 0.9) { const m = rips[ripI++ % rips.length]; m.visible = age > 0 && age < life; if (!m.visible) return; const k = age / life, r = 0.1 + maxR * (1 - (1 - k) ** 2); m.scale.set(r, r, 1); m.position.set(x, y, z); m.material.color.set(color); m.material.opacity = 0.95 * (1 - k); },
  band(x, y, z, r, color, op) { const m = rips[ripI++ % rips.length]; m.visible = op > 0.01; m.scale.set(r, r, 1); m.position.set(x, y, z); m.material.color.set(color); m.material.opacity = op; },
  num(txt, x, y, z, size = 1, age = 1, color = '#ffffff') { if (age < 0) return; const sp = nums[numI++ % nums.length]; sp.visible = true; sp.material.map = textTex(String(txt), color); const k = size * (1 + 0.55 * Math.exp(-age * 9)); sp.scale.set(k * 2, k, 1); sp.position.set(x, y, z); sp.material.opacity = clamp(age * 12); },
  cracks(v, grow = 1) { dyn.cracks.visible = v > 0.001; dyn.underGlow.visible = v > 0.001; dyn.cracks.material.color.set('#ff3a18').multiplyScalar(0.5 + v * 3); dyn.cracks.scale.set(grow, 1, grow); const r = 16 + 46 * grow; dyn.underGlow.scale.set(r, r, 1); dyn.underGlow.material.opacity = 0.25 + 0.6 * v; },
  ball(x, y, z) { dyn.ball.visible = true; dyn.ball.position.set(x, y, z); },
  // sign: swing angle (rad), fallT = seconds since the chain snapped (or null)
  sign(swing = 0, fallT = null) {
    if (!dyn.hsign) return; const g = dyn.hsign, [px, py, pz] = SHOP.pivot; dyn.chain.visible = true; dyn.board.position.set(0, -0.5, 0);
    if (fallT === null || fallT < 0) { g.position.set(px, py, pz); g.rotation.set(Math.sin(swing * 0.7) * 0.25 * swing, 0, 1.131 + swing); return; }
    dyn.chain.visible = false; const T0 = 0.56, k = clamp((fallT - T0) / 0.22), drop = 0.5 * 9.8 * Math.min(fallT, T0) ** 2;
    const qa = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 1.131)), qb = new THREE.Quaternion().setFromEuler(new THREE.Euler(-PI / 2, 0, 0.3));
    g.quaternion.copy(qa).slerp(qb, k * k); g.position.set(lerp(px, px + 0.5, k), lerp(py - drop, 0.1, k), lerp(pz, pz - 0.9, k));
  },
  tag(c, txt, color = '#ffffff', size = 1, age = 1) { tagQ.push([c, txt, color, size, age]); },
  prop(x, y, z, ry = 0) { dyn.basket.visible = true; dyn.basket.position.set(x, y, z); dyn.basket.rotation.y = ry; },
  lights(arr) { lightsSet = true; pts.forEach((p, i) => { const a = arr[i]; if (!a) { p.intensity = 0; return; } p.position.set(a[0], a[1], a[2]); p.color.set(a[3]); p.intensity = a[4]; p.distance = a[5] || 20; }); },
  blanket(v) { dyn.blanket.visible = v; },
  crows(T) { dyn.crows.forEach((c, i) => { c.position.y = 6.76 + Math.max(0, Math.sin(T * 5 + i * 1.7)) * 0.05; }); },
  stair: stairPos,
});

// ---------------------------------------------------------------- the mirror: everyone's reflection is late, Leo's is early
const PARTS = ['g', 'body', 'hips', 'torsoG', 'head', 'armL', 'armR', 'legL', 'legR'];
const snap = (c) => ({ v: c.g.visible, map: c.faceMat.map, t: PARTS.map(k => [c[k].position.clone(), c[k].quaternion.clone()]) });
const restore = (c, q) => { c.g.visible = q.v; c.faceMat.map = q.map; PARTS.forEach((k, i) => { c[k].position.copy(q.t[i][0]); c[k].quaternion.copy(q.t[i][1]); }); };
const QUIET = ['lights', 'num', 'rip', 'band', 'ring', 'prop', 'sign', 'ball', 'bell', 'rope', 'cracks', 'blanket', 'tag', 'mon'];
function lagOf(c, shot) { const L = Object.assign({}, CONFIG.lags || {}, shot.lags || {}); return L[c.name] !== undefined ? L[c.name] : (CONFIG.lag ?? 1); }
function poseAt(Tq, shot, tl, dur) {
  const saved = QUIET.map(k => S[k]); QUIET.forEach(k => S[k] = () => S); const dSaved = S.dog;
  S.all.forEach(c => c.reset());
  if (shot.crowd) crowd(Tq, shot, tl / dur);
  if (shot.act) shot.act(S, tl / dur, tl, Tq, dur);
  QUIET.forEach((k, i) => S[k] = saved[i]); S.dog = dSaved;
}
function mirrorPass(T, shot, tl, dur) {
  const now = new Map(S.all.map(c => [c, snap(c)]));
  const lags = [...new Set(S.all.map(c => lagOf(c, shot)))].filter(l => l !== 0);
  const late = new Map();
  for (const l of lags) { poseAt(T - l, shot, tl - l, dur); S.all.forEach(c => { if (lagOf(c, shot) === l) late.set(c, snap(c)); }); }
  S.all.forEach(c => restore(c, late.get(c) || now.get(c)));
  scene.updateMatrixWorld(true); renderer.shadowMap.needsUpdate = true;
  dyn.mirrorRender(renderer, scene, camera);
  S.all.forEach(c => restore(c, now.get(c))); scene.updateMatrixWorld(true);
}

// ---------------------------------------------------------------- frame
let TL = null;
function locate(T) {
  const sh = TL.shots; let i = sh.findIndex(s => T < s.start + s.dur); if (i < 0) i = sh.length - 1;
  const s = sh[i], tl = Math.max(0, T - s.start); return { i, tl, u: clamp(tl / s.dur), dur: s.dur };
}
function flashAt(shot, tl) { let f = 0; for (const t0 of (shot.flash || [])) { const x = tl - t0; if (x >= 0) f += Math.exp(-x * 8) * 0.9 + 0.7 * Math.exp(-((x - 0.14) ** 2) * 500); } return f; }
const _p = new THREE.Vector3(), _l = new THREE.Vector3();
function renderAt(T) {
  const { i, tl, u, dur } = locate(T), shot = SHOTS[i];
  if (shot.env === 'black') { renderer.setClearColor(0x000000, 1); renderer.clear(); return i; }
  // reset stage
  S.all.forEach(c => c.reset()); S.dog.reset(); dyn.ball.visible = false; S.sign(0); tagQ.length = 0; tags.forEach(t => t.visible = false); dyn.basket.visible = false;
  nums.forEach(n => n.visible = false); rings.forEach(n => n.visible = false); rips.forEach(n => n.visible = false); numI = 0; ripI = 0;
  monState = null; lightsSet = false; S.bell(0); S.rope(0); S.cracks(0); S.blanket(false);
  let en = typeof shot.env === 'function' ? shot.env(u, tl) : shot.env || 'day';
  const e = Array.isArray(en) ? mixEnv(ENVS[en[0]], ENVS[en[1]], en[2]) : ENVS[en];
  const envName = Array.isArray(en) ? en[0] : en;
  applyEnv(e, flashAt(shot, tl));
  if (shot.crowd) crowd(T, shot, u);
  S.crows(T);
  if (shot.act) shot.act(S, u, tl, T, dur);
  if (!lightsSet) S.lights([]);
  if (!monState) monState = { a: 'sit', zzz: CONFIG.monster && ['day', 'dusk', 'night', 'late', 'snow'].includes(envName) };
  applyMonster(monState, T); mon.root.visible = !!CONFIG.monster;
  { const hv = new THREE.Vector3(); tagQ.forEach(([c, txt, color, size, age], i) => { const sp = tags[i]; if (!sp || !c.g.visible || age < 0) return; c.g.updateMatrixWorld(true); c.head.getWorldPosition(hv); const hs = c.head.children[0].scale.x; const k = 0.5 * size * (1 + 0.6 * Math.exp(-age * 9)); sp.visible = true; sp.material.map = textTex(String(txt), color); sp.scale.set(k * 2, k, 1); sp.position.set(hv.x, hv.y + 0.52 * hs * c.s + 0.1 + 0.36 * size, hv.z); }); }
  // camera
  const c = shot.cam(u, tl, T);
  _p.set(...c.p); _l.set(...c.l);
  if (c.anchor) { const a = new THREE.Vector3(); mon[c.anchor].getWorldPosition(a); _p.add(a); _l.add(a); }
  const dist = _p.distanceTo(_l), sk = (shot.shake === undefined ? (e.rain > 0.5 ? 0.007 : 0.0035) : shot.shake) * dist;
  _l.x += (Math.sin(T * 2.3) + Math.sin(T * 5.1 + 1)) * sk; _l.y += (Math.sin(T * 2.9 + 2) + Math.sin(T * 4.3)) * sk;
  camera.position.copy(_p); camera.up.set(0, 1, 0); camera.lookAt(_l);
  camera.rotateZ(((c.roll || 0) + Math.sin(T * 1.7) * 0.25) * PI / 180);
  camera.fov = c.fov || 45; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  sky.position.copy(camera.position); stars.position.copy(camera.position);
  { const fl = shot.fill || FILL[envName] || ['#ffffff', 0]; const d = Math.min(dist, 40); const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion), rt = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    fill.position.copy(camera.position).addScaledVector(up, d * 0.22).addScaledVector(rt, -d * 0.3); fill.color.set(fl[0]); fill.intensity = dist > 34 ? 0 : fl[1] * Math.pow(d, 1.6); fill.distance = d * 3.2; }
  // shadows (fixed per shot so they do not swim)
  const cm = shot.cam(0.5, dur * 0.5, T); let sc, R;
  if (shot.sh) { sc = new THREE.Vector3(shot.sh[0], shot.sh[1], shot.sh[2]); R = shot.sh[3]; }
  else { const pp = new THREE.Vector3(...cm.p), ll = new THREE.Vector3(...cm.l); if (cm.anchor) { const a = new THREE.Vector3(); mon[cm.anchor].getWorldPosition(a); pp.add(a); ll.add(a); } const d = pp.distanceTo(ll); if (d > 42) { sc = new THREE.Vector3(6, 0, -18); R = 135; } else { sc = ll; R = Math.max(13, d * 1.7); } }
  const sd = new THREE.Vector3(...e.sunDir).normalize();
  sun.position.copy(sc).addScaledVector(sd, 400); sun.target.position.copy(sc); sun.target.updateMatrixWorld();
  const scam = sun.shadow.camera; scam.left = -R; scam.right = R; scam.top = R; scam.bottom = -R; scam.near = 20; scam.far = 900; scam.updateProjectionMatrix();
  sun.shadow.normalBias = R / 4096 * 3.2; sun.castShadow = e.sunI > 0.05;
  weather(T, e);
  if (dyn.mirror && camera.position.distanceTo(dyn.mirror.position) < 90) mirrorPass(T, shot, tl, dur);
  renderer.render(scene, camera);
  return i;
}

// ---------------------------------------------------------------- boot
const label = document.createElement('canvas'); label.width = W; label.height = H;
async function boot() {
  buildWorld(); buildFx(); buildMonster(); buildCast();
  TL = await (await fetch('/build/timeline.json?' + Date.now())).json();
  window.TOTAL = TL.total; window.NSHOTS = TL.shots.length; window.TLS = TL.shots;
  window.renderAt = renderAt;
  window.grab = (T, q = 0.93) => { renderAt(T); return canvas.toDataURL('image/jpeg', q); };
  window.grabLabeled = (T, txt) => { renderAt(T); const g = label.getContext('2d'); g.drawImage(canvas, 0, 0); g.font = `900 ${Math.round(W / 9)}px Inter, Arial`; g.lineWidth = W / 60; g.strokeStyle = '#000'; g.fillStyle = '#ff0'; g.strokeText(txt, W * 0.04, W / 8); g.fillText(txt, W * 0.04, W / 8); return label.toDataURL('image/jpeg', 0.85); };
  window.dbg = (T) => { renderAt(T); const o = {}; for (const k of ['eye', 'footR', 'chest', 'head']) { const v = new THREE.Vector3(); mon[k].getWorldPosition(v); o[k] = v.toArray().map(x => +x.toFixed(1)); } o.cam = camera.position.toArray().map(x => +x.toFixed(1)); return o; };
  renderAt(0);
  window.READY = true;
}
boot().catch(e => { console.error('BOOT ERROR', e && e.stack || e); window.BOOT_ERROR = String(e && e.stack || e); });
