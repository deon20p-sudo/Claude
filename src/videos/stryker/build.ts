// Geometry for the Stryker short: shared helpers (two-tone Lambert materials, merged static batches, lofts), the
// posable vehicles (Stryker with optional slat cage, a C-130-style cargo plane and a bigger jet transport, a tank, the
// rocket-propelled grenade) and the three sets (airfield + hangar + briefing board, desert town + motor pool, a
// backyard garden). Built from simple solids so the world ink pass gives clean silhouettes and creases.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { twoTone } from "./shade";
import { rng, rep, grassHD, ctex } from "./paint";
import { concreteHD, sandHD, hullHD, skinHD, corrugatedHD, plasterHD, clapboardHD, hescoHD, sandbagHD, mapTex, portraitTex, medalTex, taxiLineHD } from "./tex";
import { C130, BIG, HANGAR, BRIEF, TOWN, YARD, WARHEAD, GARDEN, STRYKER } from "./story";

export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
type MP = THREE.MeshLambertMaterialParameters;

// ---------------- materials ----------------
const mats = new Map<string, THREE.Material>();
/** cached two-tone Lambert; a map gets a repeat of `per` metres per tile when the geometry has metre UVs */
export const lam = (key: string, make: () => MP, liftK = 1) => {
  let m = mats.get(key) as THREE.MeshLambertMaterial | undefined;
  if (!m) { m = twoTone(new THREE.MeshLambertMaterial(make()), liftK); mats.set(key, m); }
  return m;
};
export const phong = (key: string, color: string, spec = "#9a9a9a", shin = 40) => {
  let m = mats.get(key) as THREE.MeshPhongMaterial | undefined;
  if (!m) { m = twoTone(new THREE.MeshPhongMaterial({ color, specular: spec, shininess: shin }), 0.3); mats.set(key, m); }
  return m;
};
const tiled = (t: THREE.Texture, metres: number) => rep(t, 1 / metres, 1 / metres);
export const basic = (key: string, make: () => THREE.MeshBasicMaterialParameters) => {
  let m = mats.get(key) as THREE.MeshBasicMaterial | undefined;
  if (!m) { m = new THREE.MeshBasicMaterial(make()); mats.set(key, m); }
  return m;
};

// ---------------- geometry helpers ----------------
const f32 = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
  const out = new Float32Array(a.count * a.itemSize);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
  return new THREE.Float32BufferAttribute(out, a.itemSize);
};
/** box from min to max with metre UVs (u along the face width, v up) */
export const boxAt = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  const uv = g.attributes.uv as THREE.BufferAttribute, n = g.attributes.normal as THREE.BufferAttribute;
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    const [su, sv] = ax > 0.5 ? [d, h] : ay > 0.5 ? [w, d] : [w, h];
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  return g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
};
export const cyl = (r0: number, r1: number, h: number, seg = 16, open = false) => new THREE.CylinderGeometry(r1, r0, h, seg, 1, open);
/** merged static meshes, one per material */
export class Batch {
  private g = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(geo: THREE.BufferGeometry, mat: THREE.Material, m?: THREE.Matrix4) {
    const src = geo.index ? geo.toNonIndexed() : geo;
    const x = new THREE.BufferGeometry();
    x.setAttribute("position", f32(src.attributes.position));
    if (src.attributes.normal) x.setAttribute("normal", f32(src.attributes.normal)); else { x.computeVertexNormals(); }
    x.setAttribute("uv", src.attributes.uv ? f32(src.attributes.uv) : new THREE.Float32BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
    if (m) x.applyMatrix4(m);
    const l = this.g.get(mat);
    if (l) l.push(x); else this.g.set(mat, [x]);
  }
  build(parent: THREE.Object3D, cast = true, recv = true) {
    for (const [mat, list] of this.g) {
      const mesh = new THREE.Mesh(mergeGeometries(list, false), mat);
      mesh.castShadow = cast; mesh.receiveShadow = recv; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      parent.add(mesh);
    }
    this.g.clear();
  }
}
const M4 = (x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s: number | [number, number, number] = 1) => {
  const sc = typeof s === "number" ? V(s, s, s) : V(...s);
  return new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, "YXZ")), sc);
};
/** a mesh with shadows, added to a parent */
export const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, m?: THREE.Matrix4, cast = true) => {
  const o = new THREE.Mesh(geo, mat);
  if (m) m.decompose(o.position, o.quaternion, o.scale);
  o.castShadow = cast; o.receiveShadow = true; parent.add(o); return o;
};
/** side profile (u = forward z, v = up y) extruded across x, centred on x = 0, with a soft bevel */
const sideExtrude = (pts: [number, number][], width: number, bevel = 0.05) => {
  const s = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v)));
  const g = new THREE.ExtrudeGeometry(s, { depth: width - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 8 });
  g.rotateY(-Math.PI / 2); // shape x -> world z, extrude z -> world -x
  g.translate(width / 2 - bevel, 0, 0);
  return g;
};
/** top planform (u = x, v = z) extruded upward by h, base at y0 */
const planExtrude = (pts: [number, number][], h: number, y0: number, bevel = 0.04) => {
  const s = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, -v)));
  const g = new THREE.ExtrudeGeometry(s, { depth: h - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1 });
  g.rotateX(-Math.PI / 2); g.translate(0, y0 + bevel, 0);
  return g;
};
/** smooth loft through cross-sections: sec(t) returns a ring of points (same count for every t) */
const loft = (sec: (t: number) => THREE.Vector3[], n: number, closedRing = false) => {
  const rings = Array.from({ length: n + 1 }, (_, i) => sec(i / n)), m = rings[0].length;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  rings.forEach((r, i) => r.forEach((p, j) => { pos.push(p.x, p.y, p.z); uv.push(j / (m - 1) * 4, i / n * 4); }));
  const cols = closedRing ? m : m - 1;
  for (let i = 0; i < n; i++) for (let j = 0; j < cols; j++) {
    const a = i * m + j, b = i * m + ((j + 1) % m), c = (i + 1) * m + j, d = (i + 1) * m + ((j + 1) % m);
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
};
const roundRect = (x0: number, y0: number, x1: number, y1: number, rb: number, rt: number, path: THREE.Path | THREE.Shape) => {
  path.moveTo(x0 + rb, y0); path.lineTo(x1 - rb, y0);
  path.quadraticCurveTo(x1, y0, x1, y0 + rb); path.lineTo(x1, y1 - rt);
  path.quadraticCurveTo(x1, y1, x1 - rt, y1); path.lineTo(x0 + rt, y1);
  path.quadraticCurveTo(x0, y1, x0, y1 - rt); path.lineTo(x0, y0 + rb);
  path.quadraticCurveTo(x0, y0, x0 + rb, y0);
  return path;
};

// ---------------- palette ----------------
const TAN = "#c8b183", TAN_D = "#a8946a", TYRE = "#3b3633", HUB = "#6d6656", GUN = "#3f4245";
export const hullMat = () => lam("hullTan", () => ({ map: tiled(hullHD("tan", TAN), 2.2) }));

// ---------------- Stryker ----------------
export class StrykerModel {
  root = new THREE.Group(); body = new THREE.Group(); wheels: THREE.Object3D[] = []; ramp = new THREE.Group(); cage = new THREE.Group();
  hatch = new THREE.Group();
  constructor(parent: THREE.Object3D) {
    const R = this.body, hm = hullMat(), dark = lam("tanDark", () => ({ color: TAN_D })), gun = phong("gunmetal", GUN, "#8a8a8a", 50);
    const tyre = lam("tyre", () => ({ color: TYRE })), hub = lam("hub", () => ({ color: HUB })), glass = phong("glassDark", "#2c3c46", "#cfe6ff", 80);
    this.root.add(R);
    // hull: side profile with a long sloped glacis, extruded 2.5 m wide
    const hullG = sideExtrude([[-3.45, 0.5], [-3.45, 2.12], [-3.32, 2.24], [2.05, 2.24], [3.45, 1.42], [3.5, 1.1], [3.12, 0.6], [2.6, 0.45], [-3.0, 0.45]], 2.5, 0.06);
    mesh(hullG, hm, R);
    // add-on armour tiles on the sides and the glacis (slightly proud, they read as panels under the ink)
    for (const s of [-1, 1]) {
      for (let i = 0; i < 5; i++) mesh(boxAt(s * 1.25 - 0.05, 1.02, -3.25 + i * 1.08, s * 1.25 + 0.05, 2.02, -3.25 + i * 1.08 + 1.02), hm, R);
      // stowage bin + fender lips over the wheel pairs
      for (const [z0, z1] of [[1.4, 3.05], [-2.85, -0.35]]) mesh(boxAt(s > 0 ? 1.2 : -1.42, 1.0, z0, s > 0 ? 1.42 : -1.2, 1.08, z1), dark, R);
    }
    // wheels: 8 run-flat tyres with hubs
    const tg = cyl(STRYKER.r, STRYKER.r, 0.48, 22); tg.rotateZ(Math.PI / 2);
    const hg = cyl(0.27, 0.27, 0.5, 12); hg.rotateZ(Math.PI / 2);
    for (const z of STRYKER.axles) for (const s of [-1, 1]) {
      const w = new THREE.Group(); w.position.set(s * 1.1, STRYKER.r, z);
      mesh(tg, tyre, w); mesh(hg, hub, w);
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; mesh(boxAt(-0.27, -0.03, -0.03, 0.27, 0.03, 0.03).translate(0, Math.sin(a) * 0.17, Math.cos(a) * 0.17), dark, w); }
      R.add(w); this.wheels.push(w);
    }
    // remote weapon station: pedestal, cradle, machine gun, sight box
    const rws = new THREE.Group(); rws.position.set(0.35, 2.24, 0.45); R.add(rws);
    mesh(cyl(0.22, 0.22, 0.2, 14).translate(0, 0.1, 0), dark, rws);
    mesh(boxAt(-0.3, 0.2, -0.32, 0.3, 0.48, 0.32), hm, rws);
    mesh(boxAt(0.12, 0.26, -0.15, 0.32, 0.46, 0.12), gun, rws);
    const barrel = cyl(0.035, 0.035, 1.05, 8); barrel.rotateX(Math.PI / 2); mesh(barrel.translate(-0.08, 0.38, 0.75), gun, rws);
    mesh(boxAt(-0.2, 0.3, -0.1, 0.04, 0.46, 0.38), gun, rws);
    // commander's cupola with an open hatch lid (the commander pops out of it)
    this.hatch.position.set(-0.55, 2.24, 0.75); R.add(this.hatch);
    const ring = new THREE.TorusGeometry(0.36, 0.06, 8, 20); ring.rotateX(Math.PI / 2);
    mesh(ring.translate(0, 0.06, 0), dark, this.hatch);
    mesh(cyl(0.34, 0.34, 0.08, 16).translate(0, 0.0, 0), lam("hatchHole", () => ({ color: "#2a2622" })), this.hatch, undefined, false);
    const lid = cyl(0.36, 0.36, 0.06, 16); lid.translate(0, 0, -0.36); lid.rotateX(-1.2); mesh(lid.translate(0, 0.1, -0.34), hm, this.hatch);
    // driver's hatch, vision blocks, headlights, smoke launchers, antennas, tow hooks
    mesh(boxAt(0.25, 2.24, 1.55, 0.85, 2.3, 2.0), dark, R);
    for (const x of [0.32, 0.55, 0.78]) mesh(boxAt(x - 0.08, 2.26, 1.96, x + 0.08, 2.36, 2.04), glass, R);
    for (const s of [-1, 1]) {
      mesh(boxAt(s * 1.0 - 0.13, 1.45, 3.2, s * 1.0 + 0.13, 1.6, 3.5), lam("lamp", () => ({ color: "#f2ead2" })), R);
      for (let k = 0; k < 3; k++) { const c = cyl(0.05, 0.05, 0.2, 8); c.rotateX(1.1); mesh(c.translate(s * (0.95 + k * 0.11), 2.3, 1.85), gun, R); }
      mesh(cyl(0.012, 0.016, 2.6, 5).translate(s * 1.0, 2.24 + 1.3, -3.0), gun, R);
      mesh(boxAt(s * 0.7 - 0.1, 0.6, 3.25, s * 0.7 + 0.1, 0.8, 3.45), gun, R);
    }
    // stowed gear on the roof: a jerrycan rack and a rolled tarp
    mesh(boxAt(-1.0, 2.24, -2.6, -0.2, 2.5, -1.7), lam("olive", () => ({ color: "#6d7a4c" })), R);
    const tarp = cyl(0.17, 0.17, 1.6, 10); tarp.rotateZ(Math.PI / 2); mesh(tarp.translate(0.35, 2.41, -2.9), lam("tarp", () => ({ color: "#8f7d58" })), R);
    // rear: dark doorway behind the ramp; the ramp is hinged at its bottom edge
    mesh(boxAt(-0.95, 0.62, -3.47, 0.95, 1.98, -3.44), lam("hullDark", () => ({ color: "#2a2622" })), R, undefined, false);
    this.ramp.position.set(0, 0.55, -3.47); R.add(this.ramp);
    mesh(boxAt(-1.0, 0, -0.12, 1.0, 1.5, 0), hm, this.ramp);
    // slat ("bar") armour: flat bars 0.38 m off the hull on brackets, sides + front (the rear ramp keeps clear)
    const bar = lam("slat", () => ({ color: "#8f7d55" })), c = STRYKER.cage, xw = 1.25 + c;
    const slats = new Batch();
    const ys = [0.98, 1.27, 1.56, 1.85, 2.12];
    for (const s of [-1, 1]) {
      for (const y of ys) slats.add(boxAt(s * xw - 0.025, y - 0.045, -3.3, s * xw + 0.025, y + 0.045, 3.45 + c), bar);
      for (const z of [-3.3, -2.2, -1.1, 0, 1.1, 2.2, 3.4]) {
        slats.add(boxAt(s * xw - 0.04, 0.9, z - 0.04, s * xw + 0.04, 2.2, z + 0.04), bar);
        slats.add(boxAt(Math.min(s * 1.25, s * xw), 1.5, z - 0.03, Math.max(s * 1.25, s * xw), 1.56, z + 0.03), bar);
      }
    }
    for (const y of [0.98, 1.27, 1.56, 1.85]) slats.add(boxAt(-xw, y - 0.045, 3.45 + c - 0.025, xw, y + 0.045, 3.45 + c + 0.025), bar);
    for (const x of [-xw, -0.9, 0, 0.9, xw]) slats.add(boxAt(x - 0.04, 0.9, 3.45 + c - 0.04, x + 0.04, 1.92, 3.45 + c + 0.04), bar);
    slats.build(this.cage);
    R.add(this.cage);
    this.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    parent.add(this.root);
  }
  /** place on the ground profile: pitch from the front / rear axle heights (cargo ramps), wheels roll with distance */
  pose(p: { x: number; z: number; yaw: number; cage: boolean; ramp: number; dist: number }, ground: (x: number, z: number) => number, bob = 0) {
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), a = STRYKER.axles[0], b = STRYKER.axles[3];
    const yf = ground(p.x + fx * a, p.z + fz * a), yr = ground(p.x + fx * b, p.z + fz * b);
    const pitch = Math.atan2(yf - yr, a - b);
    this.root.position.set(p.x, 0, p.z); this.root.rotation.set(0, p.yaw, 0);
    this.body.position.set(0, yr + (0 - b) * Math.tan(pitch) + bob, 0); this.body.rotation.set(-pitch, 0, 0);
    for (const w of this.wheels) w.rotation.x = p.dist / STRYKER.r;
    this.cage.visible = p.cage; this.ramp.rotation.x = -1.72 * p.ramp;
  }
}

// ---------------- cargo planes ----------------
export type PlaneSpec = {
  key: string; color: string; halfW: number; floor: number; top: number; rampLen: number; len: number; tail: number; rx: number; bottom: number; topY: number;
  wingY: number; wingZ: number; span: number; chord: number; sweep: number; engines: "prop" | "jet"; ttail: boolean; finTop: number;
};
export const C130_SPEC: PlaneSpec = { key: "c130", color: "#949ca1", halfW: C130.halfW, floor: C130.floor, top: C130.top, rampLen: C130.ramp, len: 22, tail: 8.5,
  rx: 2.2, bottom: 0.72, topY: 5.35, wingY: 5.35, wingZ: 12.5, span: 40.4, chord: 4.2, sweep: 0.05, engines: "prop", ttail: false, finTop: 11.6 };
export const BIG_SPEC: PlaneSpec = { key: "big", color: "#7a868c", halfW: BIG.halfW, floor: BIG.floor, top: BIG.top, rampLen: BIG.ramp, len: 36, tail: 13,
  rx: 3.45, bottom: 0.95, topY: 7.4, wingY: 7.45, wingZ: 19, span: 51.7, chord: 7.5, sweep: 0.45, engines: "jet", ttail: true, finTop: 16.8 };

export class PlaneModel {
  root = new THREE.Group(); tip = new THREE.Group(); body = new THREE.Group(); ramp = new THREE.Group(); props: THREE.Object3D[] = [];
  constructor(parent: THREE.Object3D, P: PlaneSpec, at: [number, number, number]) {
    const skin = lam("skin" + P.key, () => ({ map: tiled(skinHD(P.key, P.color), 2.6) })), skinD = lam("skinD" + P.key, () => ({ color: new THREE.Color(P.color).multiplyScalar(0.82).getStyle() }));
    const hold = lam("hold" + P.key, () => ({ map: tiled(quiltTex(), 1.6) })), floorM = lam("holdFloor", () => ({ map: tiled(rollerFloorTex(), 2.0) }));
    const glass = phong("cockpit", "#25323d", "#d8ecff", 90), dark = lam("planeDark", () => ({ color: "#3b3f44" })), tyre = lam("tyre", () => ({ color: TYRE }));
    this.root.position.set(...at); parent.add(this.root);
    // tipping pivot = the ramp toe on the ground
    this.tip.position.set(0, 0, -P.rampLen); this.root.add(this.tip);
    this.body.position.set(0, 0, P.rampLen); this.tip.add(this.body);
    const B = this.body, yc = (P.bottom + P.topY) / 2, ry = (P.topY - P.bottom) / 2;
    // fuselage: hollow extrusion of the cross-section with the cargo hold as the hole (outer skin + hold walls)
    const outer = new THREE.Shape(); roundRect(-P.rx, P.bottom, P.rx, P.topY, 0.7, P.rx * 0.85, outer);
    const hole = new THREE.Path(); roundRect(-P.halfW, P.floor, P.halfW, P.top, 0.08, 0.35, hole); outer.holes.push(hole);
    const fus = new THREE.ExtrudeGeometry(outer, { depth: P.len, bevelEnabled: false, curveSegments: 10 });
    mesh(fus, skin, B);
    // the hold is its own inward-facing box just inside the hole (quilted insulation walls, roller floor)
    const holdBox = new THREE.BoxGeometry(2 * P.halfW - 0.02, P.top - P.floor - 0.02, P.len - 0.5);
    holdBox.translate(0, (P.floor + P.top) / 2, P.len / 2 + 0.25);
    const hb = mesh(holdBox, hold, B, undefined, false); (hb.material as THREE.Material).side = THREE.BackSide;
    mesh(boxAt(-P.halfW + 0.02, P.floor - 0.02, 0.02, P.halfW - 0.02, P.floor + 0.012, P.len), floorM, B, undefined, false);
    // hold ribs (frames every 1.5 m) for depth inside the door
    for (let z = 1.5; z < P.len - 1; z += 1.5) for (const s of [-1, 1]) mesh(boxAt(s * P.halfW - 0.1 * s - 0.04, P.floor, z - 0.06, s * P.halfW - 0.1 * s + 0.04, P.top - 0.05, z + 0.06), skinD, B, undefined, false);
    // nose: a squashed sphere closing the front, cockpit glazing band
    const nose = new THREE.SphereGeometry(1, 28, 18); nose.scale(P.rx, ry, P.rx * 1.9); nose.translate(0, yc, P.len);
    mesh(nose, skin, B);
    for (const [x0, x1] of [[-0.85, -0.05], [0.05, 0.85], [-1.45, -0.95], [0.95, 1.45]]) {
      const k = P.rx / 2.2;
      mesh(boxAt(x0 * k, yc + ry * 0.45, P.len + P.rx * 1.05, x1 * k, yc + ry * 0.62, P.len + P.rx * 1.25).rotateX(0).translate(0, 0, 0), glass, B);
    }
    // upper tail cone: open at the bottom over the ramp (lofted half-shells rising to the fin)
    const tailG = loft((t) => {
      const cy = yc + (P.topY - 0.6 - yc) * t ** 1.3, rx = P.rx * (1 - 0.82 * t), r2 = ry * (1 - 0.8 * t), z = -P.tail * t;
      const pts: THREE.Vector3[] = [];
      for (let j = 0; j <= 16; j++) { const a = (-25 + (230 * j) / 16) * Math.PI / 180; pts.push(V(rx * Math.cos(a), cy + r2 * Math.sin(a), z)); }
      return pts;
    }, 12);
    const tm = mesh(tailG, lam("skinTail" + P.key, () => ({ map: tiled(skinHD(P.key, P.color), 2.6), side: THREE.DoubleSide })), B);
    tm.castShadow = true;
    mesh(new THREE.SphereGeometry(0.5, 10, 8).scale(P.rx * 0.18 / 0.5, ry * 0.2 / 0.5, 0.6).translate(0, P.topY - 0.55 + ry * 0.05, -P.tail), skin, B);
    // fin and stabilisers
    const finG = sideExtrude([[-P.tail + 0.3, P.topY - 0.8], [-P.tail - 1.6, P.finTop], [-P.tail + 1.4, P.finTop], [-P.tail + 4.2 + 0.6 * P.sweep * 6, P.topY - 0.3]], 0.42, 0.08);
    mesh(finG, skin, B);
    const stabY = P.ttail ? P.finTop - 0.25 : P.topY - 0.75, stabZ = P.ttail ? -P.tail - 0.4 : -P.tail + 0.6, half = P.ttail ? 9 : 8;
    mesh(planExtrude([[-half, stabZ - 2.6 - P.sweep * 3], [0, stabZ], [half, stabZ - 2.6 - P.sweep * 3], [half, stabZ - 4.2 - P.sweep * 3], [0, stabZ - 3.6], [-half, stabZ - 4.2 - P.sweep * 3]], 0.3, stabY), skin, B);
    // high wing, tapered (and swept for the jet)
    const S = P.span / 2, cz = P.wingZ, c = P.chord;
    mesh(planExtrude([[-S, cz - S * P.sweep + c * 0.3], [0, cz + c * 0.5], [S, cz - S * P.sweep + c * 0.3], [S, cz - S * P.sweep - c * 0.25], [0, cz - c * 0.5], [-S, cz - S * P.sweep - c * 0.25]], 0.55, P.wingY - 0.2), skin, B);
    // engines
    const ex = P.engines === "prop" ? [-11.2, -5.4, 5.4, 11.2] : [-15, -8.6, 8.6, 15];
    for (const x of ex) {
      const zf = cz - Math.abs(x) * P.sweep;
      if (P.engines === "prop") {
        const nac = cyl(0.55, 0.62, 5.2, 14); nac.rotateX(Math.PI / 2); mesh(nac.translate(x, P.wingY - 0.45, zf + 1.4), skin, B);
        const sp = new THREE.ConeGeometry(0.32, 0.7, 12); sp.rotateX(Math.PI / 2); mesh(sp.translate(x, P.wingY - 0.45, zf + 4.35), dark, B);
        const pr = new THREE.Group(); pr.position.set(x, P.wingY - 0.45, zf + 4.1); B.add(pr); this.props.push(pr);
        for (let k = 0; k < 4; k++) { const bl = boxAt(-0.11, 0, -0.03, 0.11, 2.0, 0.03); bl.rotateZ((k * Math.PI) / 2 + 0.3); mesh(bl, dark, pr); }
      } else {
        const nac = cyl(1.05, 1.05, 4.6, 18); nac.rotateX(Math.PI / 2); mesh(nac.translate(x, P.wingY - 2.0, zf + 2.2), skin, B);
        const inl = cyl(0.85, 0.85, 0.1, 18); inl.rotateX(Math.PI / 2); mesh(inl.translate(x, P.wingY - 2.0, zf + 4.52), dark, B);
        mesh(boxAt(x - 0.15, P.wingY - 1.2, zf - 0.5, x + 0.15, P.wingY, zf + 2.0), skin, B);
      }
    }
    // gear sponsons + main wheels, nose wheel
    const g0 = P.len * 0.36, g1 = P.len * 0.62;
    for (const s of [-1, 1]) {
      mesh(sideExtrude([[g0 - 1.2, 0.6], [g0 - 0.4, P.floor + 1.4], [g1 + 0.4, P.floor + 1.4], [g1 + 1.2, 0.6]], 0.9, 0.12).translate(s * (P.rx - 0.15), 0, 0), skin, B);
      for (const z of [g0 + 0.6, g1 - 0.6]) { const w = cyl(0.62, 0.62, 0.45, 18); w.rotateZ(Math.PI / 2); mesh(w.translate(s * (P.rx - 0.15), 0.62, z), tyre, B); }
    }
    { const w = cyl(0.45, 0.45, 0.35, 14); w.rotateZ(Math.PI / 2); mesh(w.translate(0, 0.45, P.len + 1.0), tyre, B); mesh(boxAt(-0.08, 0.45, P.len + 0.9, 0.08, P.bottom + 0.4, P.len + 1.1), dark, B); }
    // roundel decal (star in a circle) on the rear fuselage side
    for (const s of [-1, 1]) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), lam("roundel", () => ({ map: roundelTex(), transparent: true, alphaTest: 0.5 })));
      d.position.set(s * (P.rx + 0.01), yc + 0.4, P.len * 0.18); d.rotation.y = s * Math.PI / 2; B.add(d);
    }
    // cargo ramp: hinged at the hold floor on the door plane, resting on the ground
    this.ramp.position.set(0, P.floor, 0); B.add(this.ramp);
    mesh(boxAt(-P.halfW + 0.06, -0.14, -P.rampLen, P.halfW - 0.06, 0, 0), lam("rampTop", () => ({ map: tiled(rollerFloorTex(), 2.0) })), this.ramp);
    for (const s of [-1, 1]) mesh(boxAt(s * (P.halfW - 0.06) - 0.06, -0.34, -P.rampLen, s * (P.halfW - 0.06) + 0.06, 0, 0), skin, this.ramp);
    this.ramp.rotation.x = Math.asin(P.floor / P.rampLen);
    this.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }
  pose(tip: number, t: number) { this.tip.rotation.x = -tip; this.props.forEach((p, i) => (p.rotation.z = 0.02 * Math.sin(t + i))); }
}
const quiltTex = () => ctex("quilt", 256, 256, (g) => {
  g.fillStyle = "#8d9a7c"; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "rgba(60,70,50,0.45)"; g.lineWidth = 5;
  for (let p = 0; p <= 256; p += 64) { g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 256); g.moveTo(0, p); g.lineTo(256, p); g.stroke(); }
  g.fillStyle = "rgba(255,255,240,0.12)"; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) g.fillRect(i * 64 + 10, j * 64 + 10, 30, 20);
});
const rollerFloorTex = () => ctex("rollerFloor", 256, 256, (g) => {
  g.fillStyle = "#6c7176"; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#4b4f54"; for (const x of [30, 220]) g.fillRect(x - 10, 0, 20, 256);
  g.fillStyle = "#9aa0a6"; for (const x of [30, 220]) for (let y = 8; y < 256; y += 32) g.fillRect(x - 8, y, 16, 14);
  g.fillStyle = "rgba(30,30,35,0.35)"; for (let y = 0; y < 256; y += 64) g.fillRect(0, y, 256, 3);
});
const roundelTex = () => ctex("roundel", 256, 256, (g) => {
  g.fillStyle = "#2d3a5e"; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill();
  g.fillStyle = "#f4f2ea"; g.beginPath();
  for (let k = 0; k < 10; k++) { const a = (k * Math.PI) / 5 - Math.PI / 2, r = k % 2 ? 40 : 104; g.lineTo(128 + r * Math.cos(a), 128 + r * Math.sin(a)); }
  g.fill();
});

// ---------------- tank (shot 3) ----------------
export class TankModel {
  root = new THREE.Group(); body = new THREE.Group();
  constructor(parent: THREE.Object3D) {
    const olive = lam("tankOlive", () => ({ map: tiled(hullHD("olive", "#76804e"), 2.4) })), dark = lam("trackDark", () => ({ color: "#34322f" })), gun = phong("gunmetal", GUN);
    const B = this.body; this.root.add(B); parent.add(this.root);
    mesh(sideExtrude([[-3.9, 0.55], [-3.9, 1.4], [-3.6, 1.62], [2.7, 1.62], [3.95, 1.05], [3.6, 0.55]], 3.5, 0.06), olive, B);
    for (const s of [-1, 1]) {
      mesh(sideExtrude([[-3.8, 0.05], [-4.2, 0.55], [-3.8, 0.98], [3.8, 0.98], [4.3, 0.55], [3.8, 0.05]], 0.7, 0.05).translate(s * 1.55, 0, 0), dark, B);
      for (let i = 0; i < 7; i++) { const w = cyl(0.36, 0.36, 0.74, 14); w.rotateZ(Math.PI / 2); mesh(w.translate(s * 1.55, 0.42, -3.0 + i), lam("roadWheel", () => ({ color: "#5d5e55" })), B); }
      mesh(boxAt(s > 0 ? 1.18 : -1.95, 0.95, -3.9, s > 0 ? 1.95 : -1.18, 1.05, 3.6), olive, B); // track skirts top
    }
    mesh(planExtrude([[-1.7, -2.4], [1.7, -2.4], [1.95, 0.4], [1.0, 2.0], [-1.0, 2.0], [-1.95, 0.4]], 0.78, 1.62), olive, B);
    const g = cyl(0.1, 0.12, 5.4, 10); g.rotateX(Math.PI / 2); mesh(g.translate(0, 2.0, 4.6), gun, B);
    mesh(cyl(0.22, 0.22, 0.6, 12).rotateX(Math.PI / 2).translate(0, 2.0, 2.2), olive, B);
    mesh(boxAt(-0.9, 2.4, -1.2, -0.3, 2.62, -0.5), olive, B); mesh(boxAt(0.4, 2.4, -0.9, 0.9, 2.55, -0.3), gun, B);
    this.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }
}

// ---------------- rocket-propelled grenade ----------------
/** RPG round along +x (nose at +x), origin at the nose tip; `s` scales it (cartoon readability) */
export const rpgModel = (parent: THREE.Object3D, s = 1) => {
  const g = new THREE.Group(), olive = lam("rpgOlive", () => ({ color: "#6e7a46" })), metal = phong("rpgMetal", "#9a9c98", "#ffffff", 60), dark = lam("rpgDark", () => ({ color: "#3d3a33" }));
  const prof = [[0, 0], [0.012, 0.0], [0.03, 0.05], [0.045, 0.14], [0.06, 0.2], [0.075, 0.27], [0.085, 0.34], [0.085, 0.42], [0.05, 0.47], [0.035, 0.5]].map(([r, x]) => new THREE.Vector2(r, x));
  const war = new THREE.LatheGeometry(prof, 20); war.rotateZ(Math.PI / 2); // lathe axis y -> x (nose at 0, toward -x)
  mesh(war, olive, g);
  mesh(new THREE.SphereGeometry(0.014, 8, 6), metal, g); // piezo nose cap
  const tube = cyl(0.035, 0.035, 0.6, 12); tube.rotateZ(Math.PI / 2); mesh(tube.translate(-0.78, 0, 0), dark, g);
  for (let k = 0; k < 4; k++) { const fin = boxAt(-1.08, 0, -0.004, -0.92, 0.12, 0.004); fin.rotateX((k * Math.PI) / 2 + Math.PI / 4); mesh(fin, dark, g); }
  g.scale.setScalar(s); parent.add(g);
  return g;
};

// ---------------- props ----------------
const palm = (b: Batch, x: number, z: number, h: number, seed: number) => {
  const r = rng(seed), lean = (r() - 0.5) * 0.25, bark = lam("palmBark", () => ({ map: rep(barkTex(), 1, 3) })), leaf = lam("palmLeaf", () => ({ color: "#5f9442", side: THREE.DoubleSide }));
  const n = 6;
  for (let i = 0; i < n; i++) {
    const y0 = (h * i) / n, y1 = (h * (i + 1)) / n, x0 = x + lean * y0, x1 = x + lean * y1;
    const seg = cyl(0.2 - 0.01 * i, 0.19 - 0.01 * i, y1 - y0 + 0.04, 10);
    b.add(seg, bark, M4(x0 + (x1 - x0) / 2, (y0 + y1) / 2, z, 0, 0, -lean));
  }
  const tx = x + lean * h;
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + r(), len = 2.4 + r() * 0.8;
    const fr = loft((t) => { const w = 0.32 * Math.sin(Math.PI * Math.min(1, t * 1.1)) + 0.02, dr = t * len, dy = 0.6 * t - 1.5 * t * t; return [V(-w, dy, dr), V(0, dy + 0.06, dr), V(w, dy, dr)]; }, 8);
    b.add(fr, leaf, M4(tx, h, z, a, -0.15));
  }
  b.add(new THREE.SphereGeometry(0.28, 10, 8), lam("palmHead", () => ({ color: "#6b5a3a" })), M4(tx, h - 0.1, z));
};
const barkTex = () => ctex("bark", 128, 256, (g) => {
  g.fillStyle = "#9a7b52"; g.fillRect(0, 0, 128, 256);
  g.fillStyle = "rgba(70,50,30,0.5)"; for (let y = 0; y < 256; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y + 10); g.lineTo(128, y + 18); g.lineTo(0, y + 8); g.fill(); }
});
const cone = (b: Batch, x: number, z: number) => {
  b.add(new THREE.ConeGeometry(0.17, 0.62, 12).translate(x, 0.33, z), lam("cone", () => ({ color: "#f07a2a" })));
  b.add(cyl(0.11, 0.135, 0.12, 12).translate(x, 0.33, z), lam("coneBand", () => ({ color: "#f4f1e8" })));
  b.add(boxAt(x - 0.24, 0, z - 0.24, x + 0.24, 0.04, z + 0.24), lam("cone", () => ({ color: "#f07a2a" })));
};
const pallet = (b: Batch, x: number, z: number, yaw: number, h: number) => {
  const m = M4(x, 0, z, yaw), net = lam("cargoNet", () => ({ map: rep(netTex(), 1, 1) }));
  b.add(boxAt(-1.1, 0, -1.35, 1.1, 0.12, 1.35), lam("palletAl", () => ({ color: "#9aa0a3" })), m);
  b.add(boxAt(-1.0, 0.12, -1.25, 1.0, h, 1.25), net, m);
};
const netTex = () => ctex("net", 256, 256, (g) => {
  g.fillStyle = "#b39b6a"; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#8c7a52"; g.fillRect(0, 0, 128, 128); g.fillRect(128, 128, 128, 128);
  g.strokeStyle = "rgba(40,45,30,0.85)"; g.lineWidth = 5;
  for (let p = -256; p < 512; p += 48) { g.beginPath(); g.moveTo(p, 0); g.lineTo(p + 256, 256); g.moveTo(p + 256, 0); g.lineTo(p, 256); g.stroke(); }
});
const sandbags = (b: Batch, x0: number, z0: number, x1: number, z1: number, h: number) =>
  b.add(boxAt(x0, 0, z0, x1, h, z1), lam("sandbags", () => ({ map: rep(sandbagHD(), 1 / 1.6, 1 / 0.8) })));
const hesco = (b: Batch, x0: number, z0: number, x1: number, z1: number) => {
  const along = Math.abs(x1 - x0) > Math.abs(z1 - z0), n = Math.round(Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0)) / 1.1);
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, cx = x0 + (x1 - x0) * u, cz = z0 + (z1 - z0) * u;
    b.add(boxAt(cx - 0.54, 0, cz - 0.54, cx + 0.54, 1.4, cz + 0.54), lam("hesco", () => ({ map: rep(hescoHD(), 1 / 1.1, 1 / 1.4) })));
  }
  void along;
};

// ---------------- sets ----------------
export type Sets = { air: THREE.Group; town: THREE.Group; garden: THREE.Group; brief: { board: THREE.Object3D }; hose: THREE.Mesh; hoseMat: THREE.Material };
export const buildSets = (root: THREE.Object3D): Sets => {
  const air = new THREE.Group(), town = new THREE.Group(), garden = new THREE.Group();
  root.add(air, town, garden);
  // ======== AIRFIELD ========
  {
    const b = new Batch(), r = rng(3);
    const sand = lam("sandAir", () => ({ map: tiled(sandHD("sandAir", "#d6c196"), 14) }));
    b.add(planeUp(-900, 900, -900, 900, 0), sand);
    const conc = lam("concrete", () => ({ map: tiled(concreteHD(), 10) }));
    b.add(planeUp(-70, 90, -120, 60, 0.01), conc);
    b.add(planeUp(-400, 400, -68, -52, 0.012), conc);
    const line = lam("taxiLine", () => ({ map: taxiLineHD() }));
    b.add(planeUp(-400, 400, -60.15, -59.85, 0.02), line);
    b.add(planeUp(5.85, 6.15, -59.85, 50, 0.02), line);
    b.add(planeUp(-42.15, -41.85, -59.85, 50, 0.02), line);
    // hangar: corrugated walls, barrel roof (casts no shadow so the inside stays lit), open toward -x
    const [hx, , hz] = HANGAR, wallM = lam("hangarWall", () => ({ map: tiled(corrugatedHD("wall", "#c2c8c9"), 2.5) })), roofM = lam("hangarRoof", () => ({ map: tiled(corrugatedHD("roof", "#a95b47"), 2.5), side: THREE.DoubleSide }));
    b.add(boxAt(hx + 10, 0, hz - 15, hx + 10.4, 8, hz + 15), wallM);
    for (const s of [-1, 1]) b.add(boxAt(hx - 10, 0, hz + s * 15 - 0.2, hx + 10.4, 8, hz + s * 15 + 0.2), wallM);
    for (const s of [-1, 1]) b.add(boxAt(hx - 10.6, 0, s < 0 ? hz - 15 : hz + 9.5, hx - 10.2, 8, s < 0 ? hz - 9.5 : hz + 15), lam("hangarDoor", () => ({ map: tiled(corrugatedHD("door", "#8ea1ad"), 2.5) })));
    b.add(boxAt(hx - 10.2, 0, hz - 15, hx + 10.4, 0.02, hz + 15), lam("hangarFloor", () => ({ map: tiled(concreteHD(), 8), color: "#d7d7d2" })));
    // floor safety lines + tool chests + workbench + hanging lamps
    b.add(boxAt(hx - 9.5, 0.025, hz - 4.8, hx + 9.5, 0.03, hz - 4.6), lam("yellowPaint", () => ({ color: "#e6b93a" })));
    b.add(boxAt(hx - 9.5, 0.025, hz + 4.6, hx + 9.5, 0.03, hz + 4.8), lam("yellowPaint", () => ({ color: "#e6b93a" })));
    for (const z of [hz - 13.5, hz - 12.2, hz + 12.2]) b.add(boxAt(hx + 8.6, 0, z - 0.55, hx + 9.9, 1.25, z + 0.55), lam("toolRed", () => ({ color: "#c8423a" })));
    b.add(boxAt(hx + 8.5, 0.95, hz + 7, hx + 9.9, 1.05, hz + 11), lam("bench", () => ({ color: "#8a6a48" })));
    for (const z of [hz + 7.2, hz + 10.8]) b.add(boxAt(hx + 8.6, 0, z - 0.06, hx + 9.8, 0.95, z + 0.06), lam("bench", () => ({ color: "#8a6a48" })));
    // portraits + medals on the back wall
    for (const [era, z] of [["ww2", hz - 3.0], ["vietnam", hz + 3.0]] as const) {
      const pm = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.9), lam("portrait" + era, () => ({ map: portraitTex(era) })));
      pm.position.set(hx + 9.95, 3.2, z); pm.rotation.y = -Math.PI / 2; air.add(pm);
      const md = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.52), lam("medal", () => ({ map: medalTex(), transparent: true, alphaTest: 0.4 })));
      md.position.set(hx + 9.94, 1.85, z); md.rotation.y = -Math.PI / 2; air.add(md);
    }
    // a flag on the back wall between the portraits (stars + stripes pictogram)
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), lam("usflag", () => ({ map: flagTex() })));
    fl.position.set(hx + 9.95, 5.6, hz); fl.rotation.y = -Math.PI / 2; air.add(fl);
    // barrel roof: half cylinder along x
    const roof = new THREE.CylinderGeometry(15.4, 15.4, 21.2, 32, 1, true, -Math.PI / 2, Math.PI);
    roof.rotateZ(Math.PI / 2); roof.scale(1, 0.38, 1); roof.translate(hx + 0.1, 8, hz);
    const rm = new THREE.Mesh(roof, roofM); rm.castShadow = false; rm.receiveShadow = false; air.add(rm);
    const gable = new THREE.CircleGeometry(15.4, 32, 0, Math.PI); gable.scale(1, 0.38, 1); gable.rotateY(-Math.PI / 2); gable.translate(hx + 10.4, 8, hz);
    const gm = new THREE.Mesh(gable, lam("hangarGable", () => ({ map: tiled(corrugatedHD("wall", "#c2c8c9"), 2.5), side: THREE.DoubleSide }))); gm.castShadow = false; air.add(gm);
    for (const z of [hz - 7, hz, hz + 7]) for (const x of [hx - 4, hx + 4]) {
      b.add(cyl(0.02, 0.02, 3.5).translate(x, 11.3, z), lam("planeDark", () => ({ color: "#3b3f44" })));
      b.add(new THREE.ConeGeometry(0.55, 0.45, 14, 1, true).translate(x, 9.4, z), lam("lampShade", () => ({ color: "#3e5d4c", side: THREE.DoubleSide })));
    }
    // briefing board on an easel (shot 2) + a flagpole
    const [bx, , bz] = BRIEF;
    for (const s of [-1, 1]) b.add(boxAt(bx + s * 1.25 - 0.05, 0, bz - 0.15, bx + s * 1.25 + 0.05, 2.75, bz - 0.05), lam("bench", () => ({ color: "#8a6a48" })));
    b.add(boxAt(bx - 1.3, 0.95, bz - 0.12, bx + 1.3, 2.7, bz - 0.02), lam("bench", () => ({ color: "#8a6a48" })));
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.66), basic("map", () => ({ map: mapTex(), color: "#e8e8e8" })));
    board.position.set(bx, 1.825, bz + 0.0); air.add(board);
    b.add(cyl(0.05, 0.06, 9).translate(bx + 4.5, 4.5, bz - 1.5), lam("pole", () => ({ color: "#d9dcdc" })));
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.2), lam("usflag", () => ({ map: flagTex() })));
    flag.position.set(bx + 5.5, 8.2, bz - 1.5); flag.material.side = THREE.DoubleSide; air.add(flag);
    // apron life: cones, cargo pallets, a tow tug, distant hangars + tower + hills
    for (const [x, z] of [[4.6, -23], [-4.8, -21.5], [3.4, 6], [-3.6, 9], [-41.5, -24], [-54.5, -24]]) cone(b, x, z);
    for (let i = 0; i < 4; i++) pallet(b, 9 + i * 2.6, -20 + (i % 2) * 0.4, 0.05 * i, 1.2 + 0.4 * (i % 3));
    b.add(boxAt(-10, 0, -3, -7.5, 1.3, 1), lam("tug", () => ({ color: "#e0b43c" })));
    b.add(boxAt(-9.8, 1.3, -1.2, -7.8, 2.2, 0.8), lam("glassDarkL", () => ({ color: "#3d5160" })));
    for (let i = 0; i < 6; i++) {
      const x = -140 + i * 48, w = 34 + r() * 10;
      b.add(boxAt(x, 0, -170, x + w, 10 + r() * 4, -150), lam("farHangar" + (i % 3), () => ({ color: ["#c3c9ca", "#b7bfc4", "#cfc8b8"][i % 3] })));
    }
    b.add(boxAt(110, 0, -110, 118, 22, -102), lam("tower", () => ({ color: "#e4ddce" })));
    b.add(boxAt(108.5, 22, -111.5, 119.5, 26, -100.5), lam("towerGlass", () => ({ color: "#4f6f86" })));
    b.add(boxAt(108, 26, -112, 120, 26.6, -100), lam("tower", () => ({ color: "#e4ddce" })));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.4, d = 520 + r() * 120;
      b.add(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(140 + r() * 80, 30 + r() * 30, 90), lam("hill", () => ({ color: "#c7a77a" })), M4(Math.cos(a) * d, 0, Math.sin(a) * d, -a));
    }
    b.build(air);
  }
  // ======== DESERT TOWN + MOTOR POOL ========
  {
    const b = new Batch(), r = rng(7), X = TOWN;
    b.add(planeUp(X - 60, X + 120, -120, 120, 0.004), lam("sandTown", () => ({ map: tiled(sandHD("sandTown", "#dcc08a"), 12) })));
    b.add(planeUp(X - 4.5, X + 4.5, -120, 120, 0.01), lam("street", () => ({ map: tiled(sandHD("street", "#c9ad7d"), 9) })));
    const plasters = ["#e8d0a4", "#dcbf8e", "#efdcb8", "#d6b689", "#e7cfae", "#ccb08a"];
    const trims = ["#2f7d8c", "#3c6fb0", "#3d8f6a", "#b0573c", "#7a4f8f"];
    for (const side of [-1, 1]) {
      let z = -70;
      while (z < 70) {
        const w = 6 + r() * 4, h = r() < 0.4 ? 3.6 : 6.6 + r() * 1.4, d = 7 + r() * 3, k = Math.floor(r() * plasters.length);
        const x0 = side < 0 ? X - 5.2 - d : X + 5.2, x1 = x0 + d, zc = z + w / 2;
        const pm = lam("plaster" + k, () => ({ map: tiled(plasterHD("t" + k, plasters[k]), 5) }));
        b.add(boxAt(x0, 0, z, x1, h, z + w), pm);
        b.add(boxAt(x0 - 0.12, h, z - 0.12, x1 + 0.12, h + 0.55, z + w + 0.12), pm); // parapet
        const fx = side < 0 ? x1 : x0, out = -side, trim = trims[Math.floor(r() * trims.length)];
        const tm = lam("trim" + trim, () => ({ color: trim })), hole = lam("winHole", () => ({ color: "#2b2622" }));
        // door + windows as recesses with coloured frames and shutters
        b.add(boxAt(Math.min(fx, fx + out * 0.05), 0, zc - 0.6, Math.max(fx, fx + out * 0.05), 2.2, zc + 0.6), hole);
        b.add(boxAt(Math.min(fx, fx + out * 0.12), 2.2, zc - 0.75, Math.max(fx, fx + out * 0.12), 2.38, zc + 0.75), tm);
        const floors = h > 5 ? 2 : 1;
        for (let fl = 0; fl < floors; fl++) for (const dz of [-w / 2 + 1.2, w / 2 - 1.2]) {
          const y = fl === 0 ? 1.2 : 4.1;
          if (fl === 0 && Math.abs(dz) < 1.4) continue;
          b.add(boxAt(Math.min(fx, fx + out * 0.04), y, zc + dz - 0.45, Math.max(fx, fx + out * 0.04), y + 1.1, zc + dz + 0.45), hole);
          for (const s of [-1, 1]) b.add(boxAt(Math.min(fx, fx + out * 0.08), y, zc + dz + s * 0.5 - 0.22, Math.max(fx, fx + out * 0.08), y + 1.1, zc + dz + s * 0.5 + 0.22).translate(0, 0, s * 0.2), tm);
        }
        if (r() < 0.55) { // striped cloth awning over the door
          const aw = new THREE.PlaneGeometry(2.2, 1.3); aw.rotateY(out > 0 ? Math.PI / 2 : -Math.PI / 2); aw.rotateZ(out * 0.6);
          b.add(aw, lam("awning" + (k % 3), () => ({ map: awningTex(["#c8423a", "#2f7d8c", "#e0a83a"][k % 3]), side: THREE.DoubleSide })), M4(fx + out * 0.55, 2.75, zc));
        }
        if (r() < 0.5) b.add(cyl(0.55, 0.55, 1.1, 14).translate(x0 + d * 0.3, h + 1.1, z + w * 0.3), lam("waterTank", () => ({ color: "#3b5e8c" })));
        if (r() < 0.4) b.add(new THREE.SphereGeometry(0.45, 12, 6, 0, Math.PI * 2, 0, 0.9).rotateX(-1.0).translate(x0 + d * 0.7, h + 0.9, z + w * 0.7), lam("dish", () => ({ color: "#ecebe6", side: THREE.DoubleSide })));
        z += w + (r() < 0.3 ? 3 : 0.2);
      }
    }
    for (let i = 0; i < 9; i++) palm(b, X + (i % 2 ? 4.4 : -4.4), -60 + i * 15 + (i % 3), 6 + (i % 3), i + 3);
    for (let i = 0; i < 6; i++) b.add(cyl(0.09, 0.11, 7.5, 8).translate(X + 4.0, 3.75, -55 + i * 22), lam("pole", () => ({ color: "#8a6c4c" })));
    // motor pool: HESCO walls on three sides, sandbags, drums, workbench, the warhead on sandbags
    const [yx, , yz] = YARD;
    hesco(b, yx - 8, yz - 13, yx + 13, yz - 13);
    hesco(b, yx + 13, yz - 13, yx + 13, yz + 14);
    hesco(b, yx - 8, yz + 14, yx - 1, yz + 14);
    hesco(b, yx + 6, yz + 14, yx + 13, yz + 14);
    for (let i = 0; i < 5; i++) b.add(cyl(0.3, 0.3, 0.9, 14).translate(yx + 11.6 - (i % 3) * 0.65, 0.45, yz + 6 + Math.floor(i / 3) * 0.65), lam("drum" + (i % 2), () => ({ color: ["#3d6a4f", "#9a4d3a"][i % 2] })));
    b.add(boxAt(yx + 8.5, 0.9, yz - 11.6, yx + 12, 1.0, yz - 10.4), lam("bench", () => ({ color: "#8a6a48" })));
    for (const x of [yx + 8.7, yx + 11.8]) b.add(boxAt(x - 0.06, 0, yz - 11.5, x + 0.06, 0.9, yz - 10.5), lam("bench", () => ({ color: "#8a6a48" })));
    b.add(boxAt(yx + 6.0, 0, yz - 12.2, yx + 7.4, 1.2, yz - 11.0), lam("toolRed", () => ({ color: "#c8423a" })));
    const [wx, , wz] = WARHEAD;
    sandbags(b, wx - 1.2, wz - 0.55, wx + 1.0, wz + 0.55, 0.78);
    sandbags(b, wx - 2.6, wz - 0.5, wx - 1.3, wz + 0.6, 0.55);
    b.add(boxAt(yx - 2.6, 0, yz - 3.2, yx - 2.25, 0.32, yz - 2.85), lam("tyre", () => ({ color: TYRE }))); // spare slats + parts
    for (let i = 0; i < 6; i++) b.add(boxAt(yx - 4.2, 0.03 + i * 0.09, yz - 3.6 + i * 0.03, yx - 2.8, 0.1 + i * 0.09, yz - 3.5 + i * 0.03), lam("slat", () => ({ color: "#8f7d55" })));
    b.build(town);
  }
  // ======== GARDEN ========
  let hose: THREE.Mesh;
  const hoseMat = lam("hose", () => ({ color: "#3f9a4a" }));
  {
    const b = new Batch(), G = GARDEN;
    b.add(planeUp(G - 60, G + 60, -60, 60, 0.004), lam("lawn", () => ({ map: tiled(grassHD(), 6) })));
    // house with clapboard siding, gable roof, windows, door
    const sid = lam("siding", () => ({ map: tiled(clapboardHD("blue", "#a9c4d6"), 3) })), trim = lam("trimWhite", () => ({ color: "#f4f1e8" }));
    const hx0 = G - 12, hx1 = G - 4, hz0 = -14, hz1 = -2;
    b.add(boxAt(hx0, 0, hz0, hx1, 5.2, hz1), sid);
    const roofG = sideExtrude([[hz0 - 0.6, 5.0], [(hz0 + hz1) / 2, 7.8], [hz1 + 0.6, 5.0]], hx1 - hx0 + 1.0, 0.04);
    b.add(roofG, lam("shingles", () => ({ map: tiled(shingleTex(), 2.2) })), M4((hx0 + hx1) / 2, 0, 0, 0));
    for (const z of [hz0 + 2, hz0 + 5.5, hz1 - 2]) for (const y of [1.2, 3.4]) {
      b.add(boxAt(hx1, y - 0.08, z - 0.62, hx1 + 0.08, y + 1.28, z + 0.62), trim);
      b.add(boxAt(hx1 + 0.08, y + 0.05, z - 0.5, hx1 + 0.1, y + 1.15, z + 0.5), lam("winGlass", () => ({ color: "#4d6f8c" })));
    }
    b.add(boxAt(hx1, 0, hz0 + 7.6, hx1 + 0.1, 2.3, hz0 + 8.8), lam("doorRed", () => ({ color: "#b8463c" })));
    b.add(boxAt(hx1, 0, hz0 + 7.2, hx1 + 1.2, 0.25, hz0 + 9.2), lam("step", () => ({ color: "#cfc6b5" })));
    // tap on the wall
    b.add(boxAt(hx1, 0.45, -3.6, hx1 + 0.18, 0.6, -3.4), lam("brass", () => ({ color: "#c79a3a" })));
    // picket fence, flower bed, a tree
    for (let i = 0; i < 46; i++) b.add(boxAt(G + 5.8, 0, -16 + i * 0.5, G + 5.9, 1.0, -16 + i * 0.5 + 0.12), trim);
    b.add(boxAt(G + 5.75, 0.55, -16, G + 5.95, 0.65, 7), trim);
    b.add(boxAt(G + 1.5, 0.004, -2.6, G + 3.4, 0.08, 2.6), lam("soil", () => ({ color: "#6a4a32" })));
    const fc = ["#e8453c", "#f2c43a", "#c15ac8", "#f07ab0", "#ffffff"];
    for (let i = 0; i < 26; i++) {
      const x = G + 1.7 + (i % 3) * 0.6, z = -2.4 + (i / 26) * 4.8, h = 0.35 + (i % 4) * 0.06;
      b.add(cyl(0.012, 0.012, h).translate(x, h / 2, z), lam("stem", () => ({ color: "#4f8a3a" })));
      b.add(new THREE.SphereGeometry(0.09, 8, 6).translate(x, h, z), lam("flower" + (i % 5), () => ({ color: fc[i % 5] })));
    }
    b.add(cyl(0.22, 0.3, 3.2, 10).translate(G + 9, 1.6, -9), lam("trunk", () => ({ color: "#7a5a3c" })));
    for (const [dx, dy, dz, rr] of [[0, 4.2, 0, 2.2], [1.2, 3.5, 0.8, 1.6], [-1.1, 3.6, -0.6, 1.7], [0.2, 5.2, -0.3, 1.5]]) b.add(new THREE.IcosahedronGeometry(rr, 1).translate(G + 9 + dx, dy, -9 + dz), lam("leaves", () => ({ color: "#5c9a44" })));
    b.build(garden);
    // hose: tap -> across the lawn -> up into the kid's hand (dynamic tube so the step can squash it)
    hose = new THREE.Mesh(new THREE.BufferGeometry(), hoseMat); hose.castShadow = true; hose.receiveShadow = true; garden.add(hose);
  }
  return { air, town, garden, brief: { board: new THREE.Object3D() }, hose, hoseMat };
};
/** hose centre line from the tap to the nozzle in the kid's hand; `pinch` squashes it under the parent's foot */
export const hosePath = (hand: THREE.Vector3) => {
  const G = GARDEN;
  return new THREE.CatmullRomCurve3([V(G - 3.82, 0.5, -3.5), V(G - 3.6, 0.06, -3.4), V(G - 3.0, 0.05, -2.2), V(G - 2.2, 0.05, -1.6), V(G - 1.2, 0.05, -1.2),
    V(G - 0.6, 0.06, -0.5), V(hand.x - 0.15, 0.4, hand.z - 0.05), hand.clone()]);
};
export const hoseGeo = (hand: THREE.Vector3, pinchAt: number, pinch: number) => {
  const c = hosePath(hand), n = 80, rings = 8, pos: number[] = [], idx: number[] = [];
  const frames = c.computeFrenetFrames(n, false);
  for (let i = 0; i <= n; i++) {
    const u = i / n, p = c.getPointAt(u), N = frames.normals[i], B = frames.binormals[i];
    const k = 1 - pinch * Math.exp(-(((u - pinchAt) / 0.03) ** 2));
    for (let j = 0; j < rings; j++) {
      const a = (j / rings) * Math.PI * 2, r = 0.035;
      const off = N.clone().multiplyScalar(Math.cos(a) * r * k).add(B.clone().multiplyScalar(Math.sin(a) * r * (2 - k)));
      pos.push(p.x + off.x, Math.max(0.006, p.y + off.y), p.z + off.z);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < rings; j++) {
    const a = i * rings + j, b2 = i * rings + ((j + 1) % rings), c2 = (i + 1) * rings + j, d = (i + 1) * rings + ((j + 1) % rings);
    idx.push(a, c2, b2, b2, c2, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(((n + 1) * rings) * 2), 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
};
const awningTex = (col: string) => ctex("awning" + col, 256, 256, (g) => {
  for (let x = 0; x < 256; x += 64) { g.fillStyle = col; g.fillRect(x, 0, 32, 256); g.fillStyle = "#f3ecd8"; g.fillRect(x + 32, 0, 32, 256); }
});
const shingleTex = () => ctex("shingles", 256, 256, (g, r) => {
  for (let row = 0; row < 8; row++) for (let i = -1; i < 9; i++) {
    g.fillStyle = `hsl(8, 38%, ${30 + r() * 8}%)`; g.fillRect(i * 32 + (row % 2) * 16, row * 32, 31, 31);
  }
  g.fillStyle = "rgba(20,10,10,0.35)"; for (let row = 0; row < 8; row++) g.fillRect(0, row * 32 + 28, 256, 4);
});
const flagTex = () => ctex("usflag", 380, 200, (g) => {
  for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? "#f4f2ea" : "#b8323a"; g.fillRect(0, (i * 200) / 13, 380, 200 / 13 + 1); }
  g.fillStyle = "#2d3a6e"; g.fillRect(0, 0, 152, 108);
  g.fillStyle = "#f4f2ea";
  for (let i = 0; i < 9; i++) for (let j = 0; j < (i % 2 ? 5 : 6); j++) { g.beginPath(); g.arc(12 + j * 25 + (i % 2) * 12, 8 + i * 11.5, 3.2, 0, 7); g.fill(); }
});
/** horizontal quad at height y covering x0..x1, z0..z1, metre UVs */
export function planeUp(x0: number, x1: number, z0: number, z1: number, y: number) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(Array(6).fill([0, 1, 0]).flat(), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([x0, z1, x1, z1, x1, z0, x0, z1, x1, z0, x0, z0], 2));
  return g;
}
export { M4 };
