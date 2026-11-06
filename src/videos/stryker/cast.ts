// Our cast as lit flat cards in the 3D world (canvas pool, cardShade cards, contact blobs, unlit effect cards) and
// who stands where in every shot of the Stryker short. Expression changes land 0-3 frames before their word.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, soldier, KID, PARENT, fxBurst, fxCreak, fxContact, fxShadow, handFront, Outfit, Expr, FrontOpts, SideOpts, Prop } from "./toon";
import { fxArrows, fxCalendar, fxSparkle, fxSparks, fxSmoke, fxDust, fxSpeed, fxWater, fxSignal, fxFizzle, fxPuzzle, fxDrip } from "./fx";
import { FPS, SHOTS, C130, BIG, HANGAR, BRIEF, GENERAL, TOWN, YARD, WARHEAD, GARDEN, STUCK_F, RPG_PASS, PINCH_F, DUD_HIT, SAG_AT, TIP_TANK, V3, smooth, clamp01, strykerAt } from "./story";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>(); private free: Entry[] = []; private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) { const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw }; this.reqs.push(r); return r; }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g)); e.tex.needsUpdate = true; this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m (soles at y = 975)
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(BODY, this.mat); this.mesh.customDepthMaterial = this.dmat;
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat); this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    } else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = this.mesh.material === this.soft ? 2 : 0; }
  }
}

// ---------------- placements ----------------
export type Place = { key: string; draw: (p: Pen) => void; x: number; y: number; z: number; scale?: number; mirror?: boolean; yaw?: number; roll?: number; size?: [number, number, number] };
/** face = fixed yaw for an upright card (not camera-facing); flat = lying on the ground */
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean; face?: number };
export type Ctx = { pos: THREE.Vector3; right: THREE.Vector3; sun: THREE.Vector3; light: "day" | "golden"; hatch: THREE.Vector3 | null; hosePt: (u: number) => THREE.Vector3 };
export type Stage = { places: Place[]; fx: FxPlace[]; hand?: THREE.Vector3; pinch: number };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
const tier = (d: number): [number, number, number] => d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];
const LEAD = 2; // frames: reactions land 0-3 f before the word

// outfits: OCP-style troops (tan-green with blotches, desert boots, helmet, carbine), the general, engineers, loadmaster
const CAMO = ["#8c8a62", "#c6bb8e", "#77714f"];
export const TROOP = (v: number, extra: Partial<Outfit> = {}): Outfit => soldier(v, { jacket: "#a59f78", pants: "#958f6b", boots: "#b89a6a", hat: "helmet", belt: null, buttons: "#7c7656", rifle: true, carbine: true, camo: CAMO, ...extra });
const CREW = (v: number) => TROOP(v, { rifle: false });
const GENERAL_O: Outfit = { jacket: "#56613f", pants: "#56613f", boots: "#1f1d22", hat: "service", buttons: "#e8c45a", tie: "#3f4a30", stars: 2, build: "stout", skin: "#f5c9a0" };
const ENGINEER = (v: number): Outfit => ({ jacket: v % 2 ? "#3f6f9c" : "#e0732e", pants: "#2f4f73", boots: "#5a3b2a", hat: "hardhat", skin: ["#ffe2c2", "#c99067", "#ecd0b6"][v % 3] });
const LOADMASTER: Outfit = { jacket: "#7f845e", pants: "#7f845e", boots: "#4a3a2a", hat: "cranial", skin: "#ecd0b6", buttons: "#5f6446" };

// ---------------- light / view helpers ----------------
let SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
let LNAME: "day" | "golden" = "day";
const light2D = (cam: Ctx, mirror: boolean) => { const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y; return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4); };
const viewOf = (cam: Ctx, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1, c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};
const LID = [0.5, 1, 1, 0.5];
const lidAt = (f: number, i: number, swaps: number[] = []) => {
  for (const fs of swaps) { const k = f - (fs - LEAD) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) { const k = f - s; if (k >= 0 && k < 4) return LID[k]; s += Math.round(15 + 54 * hh(i * 31 + n, 13)); }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));
type Who = { i: number; o: Outfit; okey: string };
const tmp = new THREE.Vector3();
const person = (cam: Ctx, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts = {}, scale = 1): Place => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2 * scale, z)) / scale, [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = ((who.i * 5 + 3) % 7) + 1;
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return { key, x, y, z, scale, mirror, draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)), size: [w, h, k] };
};
const FRONT = { side: false, mirror: false };
const CONTACT: Record<"day" | "golden", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y))), len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h, tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c, w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x, y: y + 0.022, z, w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};
/** someone standing on the ground, front view, with a contact blob */
const stand = (out: Stage, cam: Ctx, who: Who, x: number, z: number, fo: FrontOpts, y = 0, scale = 1) => {
  out.places.push(person(cam, who, x, y, z, FRONT, { mode: "stand", ...fo }, {}, scale));
  blob(out, x, y, z, scale);
};
/** world point of a design-space point on an upright camera-facing card at (x, y, z) */
const cardPoint = (cam: Ctx, x: number, y: number, z: number, d: [number, number], scale = 1, mirror = false) => {
  const yaw = Math.atan2(cam.pos.x - x, cam.pos.z - z), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const lx = (d[0] - 300) * SU * scale * (mirror ? -1 : 1), ly = (975 - d[1]) * SU * scale;
  return new THREE.Vector3(x + rx * lx, y + ly, z + rz * lx);
};
const fx1 = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, h: number, extra: Partial<FxPlace> = {}) =>
  out.fx.push({ key, cw, ch, draw, x, y, z, w, h, ...extra });
/** commander's torso out of the open hatch of the current Stryker */
const commander = (out: Stage, cam: Ctx, f: number, fo: FrontOpts) => {
  if (!cam.hatch) return;
  const h = cam.hatch;
  out.places.push(person(cam, { i: 61, o: CREW(2), okey: "cmd" }, h.x, h.y - 1.12, h.z, FRONT, { mode: "stand", blink: lidAt(f, 61), ...fo }));
};
const dust = (out: Stage, key: string, x: number, z: number, age: number, s = 1) => {
  if (age < 0 || age >= 1) return;
  fx1(out, `dust${key}${q(age, 30)}`, 300, 200, (p) => fxDust(p, q(age, 30)), x, 0.45 * s, z, 1.6 * s, 1.07 * s);
};

// ---------------- the shots ----------------
export const stage = (id: number, f: number, cam: Ctx): Stage => {
  const out: Stage = { places: [], fx: [], pinch: 0 };
  LNAME = SHOTS[id - 1].light; SUN = cam.sun.clone().normalize();
  const t = f / FPS;
  const loadmaster = (x: number, z: number, fo: FrontOpts) => stand(out, cam, { i: 40, o: LOADMASTER, okey: "lm" }, x, z, { blink: lidAt(f, 40, [STUCK_F]), ...fo });
  switch (id) {
    case 1: { // directing the caged Stryker in, the clunk, the face-palm
      const wave = q(Math.sin(f * 0.35), 20);
      const fo: FrontOpts = f < STUCK_F - LEAD ? { prop: "wands", wave, expr: "smile" } : f < 146 - LEAD ? { prop: "wands", wave: 0, expr: "shock" } : { prop: "facepalm", expr: "nervous" };
      loadmaster(2.8, -16.1, fo);
      if (f >= STUCK_F && f < STUCK_F + 6) { const u = (f - STUCK_F) / 6; for (const s of [-1, 1]) fx1(out, `burst${q(u, 30)}`, 500, 500, (p) => fxBurst(p, q(u, 30)), s * C130.halfW, 2.0, C130.door - 0.15, 1.1, 1.1); }
      if (f >= STUCK_F) { const u = q(((f - STUCK_F) * 0.06) % 1, 30); if (f < STUCK_F + 50) fx1(out, `creak${u}`, 300, 300, (p) => fxCreak(p, u), -C130.halfW - 0.3, 2.6, C130.door - 0.4, 0.6, 0.6, { rot: -0.4 }); }
      commander(out, cam, f, { expr: f < STUCK_F - LEAD ? "smile" : f < 160 ? "shock" : "nervous" });
      break;
    }
    case 2: { // the general, the brigade, the map
      const [gx, , gz] = GENERAL;
      const fo: FrontOpts = { expr: f < 277 - LEAD ? "neutral" : "stern", prop: f >= 305 ? "point" : null, blink: lidAt(f, 7), facing: f >= 305 ? -1 : 0 };
      stand(out, cam, { i: 7, o: GENERAL_O, okey: "gen" }, gx, gz, fo);
      for (let i = 0; i < 36; i++) {
        const col = i % 6, row = Math.floor(i / 6), x = 26.2 + col * 1.5 + (hh(i) - 0.5) * 0.1, z = -44 + row * 1.6;
        const v = (i * 7) % 4, expr: Expr = f > 296 - LEAD && i % 3 === 0 ? "grin" : i % 4 === 1 ? "stern" : "neutral";
        stand(out, cam, { i, o: TROOP(v), okey: `t${v}` }, x, z, { expr, blink: lidAt(f, i) });
      }
      const [bx, , bz] = BRIEF, ks = [0, 1, 2, 3, 4].map((k) => q(clamp01((f - (309 - LEAD) - k * 4) / 9), 20));
      if (f >= 307) fx1(out, `arrows${ks.join(",")}`, 1200, 800, (p) => fxArrows(p, ks), bx, 1.825, bz + 0.02, 2.5, 1.66, { face: 0 });
      if (f >= 334) {
        const pop = q(Math.min(1, (f - 334) / 4) * (1 + 0.15 * Math.exp(-(f - 338) / 3) * (f > 338 ? 1 : 0)), 20), n = Math.min(4, Math.floor((f - 334) / 3));
        fx1(out, `cal${n}|${pop}`, 400, 440, (p) => fxCalendar(p, n, pop), bx + 0.42, 1.32, bz + 0.12, 0.6, 0.66, { face: 0 });
      }
      break;
    }
    case 3: { // the tank tips the C-130 back onto its tail
      loadmaster(3.9, -17.6, { expr: f < TIP_TANK - LEAD ? "smile" : "shock", prop: f < TIP_TANK - LEAD ? "wands" : "cheer", wave: q(Math.sin(f * 0.35), 20) });
      if (f >= TIP_TANK && f < TIP_TANK + 7) { const u = (f - TIP_TANK) / 7; fx1(out, `burst${q(u, 30)}`, 500, 500, (p) => fxBurst(p, q(u, 30)), 0, 0.5, C130.door - C130.ramp, 2.2, 2.2); }
      dust(out, "t", 1.5, C130.door - C130.ramp - 0.5, (f - TIP_TANK) / 22, 2.2);
      dust(out, "t2", -1.8, C130.door - C130.ramp - 0.3, (f - TIP_TANK - 3) / 22, 1.8);
      break;
    }
    case 4: { // engineers, the wheels, nine soldiers board, sixty miles an hour
      const [hx, , hz] = HANGAR;
      if (f < 548) {
        if (f < 472 || f >= 500) stand(out, cam, { i: 50, o: ENGINEER(0), okey: "e0" }, hx - 1.7, hz - 3.3, { expr: f > 451 - LEAD ? "grin" : "smile", prop: "wrench", blink: lidAt(f, 50) });
        stand(out, cam, { i: 51, o: ENGINEER(1), okey: "e1" }, hx + 2.9, hz + 3.3, { expr: "smile_closed", prop: "point", facing: -1, blink: lidAt(f, 51) });
        if (f < 472) { const u = q((f * 0.21) % 1, 10); fx1(out, `spk${Math.floor(f / 2)}`, 400, 400, (p) => fxSparks(p, Math.floor(f / 2)), hx - 1.2, 1.4, hz - 1.45, 0.55, 0.55); void u; }
        const s = strykerAt(4, f)!, rear = s.x + 3.47;
        for (let i = 0; i < 9; i++) {
          const x = rear + 1.4 + i * 0.95 - (1.45 * (f - 503)) / FPS, z = hz + (i % 2 ? 0.3 : -0.3);
          if (f < 500 || x < rear - 0.2) continue;
          const v = i % 4, view = viewOf(cam, x, z, -1, 0);
          const ph = q((((f - 503) / FPS) * 1.6 + hh(i)) % 1, 30);
          out.places.push(person(cam, { i: 70 + i, o: TROOP(v), okey: `t${v}` }, x, x < rear + 0.6 ? Math.max(0, 0.35 * (rear + 0.6 - x)) : 0, z, view, { mode: "march", phase: ph, expr: "grin", lift: 40, blink: lidAt(f, 70 + i) }, { mode: "march", phase: ph, expr: "grin", stomp: 0.6, stride: view.fs * 0.8 }));
          blob(out, x, 0, z);
        }
      } else {
        const s = strykerAt(4, f)!;
        for (let k = 0; k < 4; k++) dust(out, `r${k}`, s.x + 4.0 + k * 2.4, -58.9 + (k % 2 ? 0.5 : 0), ((f - 548 + k * 3) % 12) / 12, 1.6);
        fx1(out, `speed${Math.floor(f / 2) % 6}`, 600, 300, (p) => fxSpeed(p, Math.floor(f / 2) % 6), s.x + 6.5, 1.3, -58.3, 7, 2.6, { face: 0, soft: true });
      }
      break;
    }
    case 5: { // portraits: sparkle on the medals
      const [hx, , hz] = HANGAR;
      for (const [k, z] of [[0, hz - 3.0], [1, hz + 3.0]] as const) {
        const u = (f - (686 + 6 * k)) / 18;
        if (u > 0 && u < 1) fx1(out, `sparkle${q(u, 20)}`, 300, 300, (p) => fxSparkle(p, q(u, 20)), hx + 9.85, 1.95, z + 0.1, 0.5, 0.5);
      }
      break;
    }
    case 6: { // inches to spare
      loadmaster(2.9, -15.6, { expr: f < 843 - LEAD ? "nervous" : "relief", prop: f < 843 - LEAD ? "wands" : "cheer", wave: q(Math.sin(f * 0.3) * 0.5, 20) });
      break;
    }
    case 7: { // Iraq: a rocket-propelled grenade whooshes past the front
      commander(out, cam, f, { expr: f < RPG_PASS - LEAD ? "neutral" : "shock", look: f < RPG_PASS - LEAD ? 0 : 1 });
      for (let k = 0; k < 14; k++) { // smoke trail left behind the rocket
        const fk = 902 + k * 1.6, age = (f - fk) / 26;
        if (age < 0 || age >= 1) continue;
        const x = TOWN + 15 - ((fk - 902) * 30) / 23;
        fx1(out, `smoke${q(age, 24)}`, 256, 256, (p) => fxSmoke(p, q(age, 24)), x, 3.0 + 0.6 * age, 4.2, 1.0 + 1.6 * age, 1.0 + 1.6 * age, { soft: true });
      }
      break;
    }
    case 8: { // welding the cage; the barbecue grill
      const [yx, , yz] = YARD;
      stand(out, cam, { i: 80, o: TROOP(1, { rifle: false }), okey: "w1" }, yx + 2.45, yz - 1.35, { prop: "torch", expr: "stern", facing: -1, blink: 0 });
      if (f < 1000) fx1(out, `spk${Math.floor(f / 2)}`, 400, 400, (p) => fxSparks(p, Math.floor(f / 2)), yx + 1.72, 1.45, yz - 1.25, 0.6, 0.6);
      stand(out, cam, { i: 81, o: TROOP(3, { rifle: false }), okey: "w2" }, yx - 2.35, yz - 2.4, { prop: "wrench", expr: "smile", blink: lidAt(f, 81) });
      stand(out, cam, { i: 82, o: TROOP(0, { rifle: false }), okey: "bbq" }, yx + 0.75, yz + 4.15, { prop: f > 1048 - LEAD ? "spatula" : null, expr: f > 1068 - LEAD ? "grin" : "smile", blink: lidAt(f, 82, [1068]) });
      if (f > 1056) for (let k = 0; k < 3; k++) { const age = ((f - 1056 + k * 9) % 27) / 27; fx1(out, `smoke${q(age, 24)}`, 256, 256, (p) => fxSmoke(p, q(age, 24), "250,250,250"), yx + 0.95, 2.45 + 0.5 * age, yz + 4.0, 0.3 + 0.3 * age, 0.3 + 0.3 * age, { soft: true }); }
      break;
    }
    case 9: { // wait, a grill? against rockets?
      const [yx, , yz] = YARD;
      stand(out, cam, { i: 83, o: TROOP(2), okey: "pz" }, yx - 1.45, yz + 4.3, { expr: f < 1122 - LEAD ? "puzzled" : "stern", look: f < 1122 - LEAD ? 1 : 0, headTilt: f < 1122 - LEAD ? -6 : 3, blink: lidAt(f, 83, [1099, 1122]) });
      stand(out, cam, { i: 82, o: TROOP(0, { rifle: false }), okey: "bbq" }, yx + 0.75, yz + 4.15, { prop: "spatula", expr: "grin", blink: lidAt(f, 82) });
      const u = (f - 1100) / 30;
      if (u > 0 && u < 1) fx1(out, `pz${q(u, 20)}`, 200, 200, (p) => fxPuzzle(p, q(u, 20)), yx - 1.45, 2.35, yz + 4.3, 0.42, 0.42);
      break;
    }
    case 10: { // the warhead and its firing signal
      const [wx, wy, wz] = WARHEAD;
      stand(out, cam, { i: 84, o: TROOP(1, { rifle: false }), okey: "inst" }, wx - 2.3, wz + 0.9, { prop: "point", expr: f < 1188 - LEAD ? "smile" : "neutral", blink: lidAt(f, 84) });
      const u = (f - (1237 - LEAD)) / (1293 - 1237);
      if (u >= 0 && u <= 1.15) {
        const L = 2.2 * 0.47, x = wx + 1.0 - L * Math.min(1, u);
        fx1(out, `sig${f % 4}`, 300, 200, (p) => fxSignal(p, f % 4), x + 0.13, wy + 0.2, wz + 0.05, 0.42, 0.28);
      }
      if (f >= 1290 && f < 1300) { const k = (f - 1290) / 10; fx1(out, `burst${q(k, 30)}`, 500, 500, (p) => fxBurst(p, q(k, 30), "#fff3b0", 8, 20, 120), wx + 1.0 - 2.2 * 0.5, wy + 0.2, wz + 0.05, 0.5, 0.5); }
      break;
    }
    case 11: { // the garden hose
      const G = GARDEN, kx = G + 0.0, kz = 0;
      const kidF: FrontOpts = { prop: "nozzle", facing: 1, expr: f < 1373 - LEAD ? "smile" : f < 1395 ? "puzzled" : "nervous", headTilt: f > 1395 ? 8 : 0, look: f > 1395 ? 1 : 0, blink: lidAt(f, 90, [1373]) };
      stand(out, cam, { i: 90, o: KID, okey: "kid" }, kx, kz, kidF, 0, 0.72);
      const hd = handFront(KID, ((90 * 5 + 3) % 7) + 1, "nozzle", 1);
      out.hand = cardPoint(cam, kx, 0, kz, hd, 0.72);
      // the parent strolls in and stands on the hose (whistling, innocent)
      const P0 = cam.hosePt(0.42), px = P0.x - 0.6 * (1 - smooth((f - 1296) / 18)), pz = P0.z;
      const walking = f < 1314;
      const view = walking ? viewOf(cam, px, pz, 1, 0) : FRONT;
      const ph = q(((f / FPS) * 1.6) % 1, 30);
      out.places.push(person(cam, { i: 91, o: PARENT, okey: "par" }, px, 0, pz, view, { mode: walking ? "stroll" : "stand", phase: ph, expr: f > 1330 ? "whistle" : "smile", blink: lidAt(f, 91) }, { mode: walking ? "march" : "stand", phase: ph, stomp: 0.5, stride: 0.6, expr: "smile" }));
      blob(out, px, 0, pz);
      out.pinch = smooth((f - 1312) / 4);
      // water: flows until "stops", then the tail leaves the nozzle and the arc empties
      const STOP = 1371, a = f < STOP ? 0 : clamp01((f - STOP) / 9), b = 1;
      const hpnt = out.hand;
      if (a < 1) {
        const w = 2.3, hgt = 1.15, rx = cam.right.x, rz = cam.right.z;
        const cx = hpnt.x + rx * (w / 2 - w * 0.06), cz = hpnt.z + rz * (w / 2 - w * 0.06), cy = hpnt.y - hgt * (0.5 - 190 / 500) + 0.02;
        fx1(out, `water${q(a, 20)}|${f % 3}`, 1000, 500, (p) => fxWater(p, q(a, 20), b, f % 3), cx, cy, cz, w, hgt);
      } else if (f > 1395 && f < 1420) fx1(out, "drip", 200, 200, fxDrip, hpnt.x + cam.right.x * 0.08, hpnt.y - 0.05 - 0.004 * (f - 1395) ** 1.6, hpnt.z + cam.right.z * 0.08, 0.1, 0.1);
      break;
    }
    case 12: { // the bars pinch the nose; the signal never makes it
      const [yx, , yz] = YARD;
      if (f >= PINCH_F && f < PINCH_F + 6) { const u = (f - PINCH_F) / 6; fx1(out, `burst${q(u, 30)}`, 500, 500, (p) => fxBurst(p, q(u, 30), "#fff3b0", 8, 20, 140), yx + 1.66, 1.42, yz + 0.6, 0.55, 0.55); }
      const s0 = 1506 - LEAD;
      if (f >= s0 && f < 1518) { const k = (f - s0) / (1518 - s0); fx1(out, `sig${f % 4}`, 300, 200, (p) => fxSignal(p, f % 4), yx + 1.66 + 0.18 - 0.06 * k, 1.47, yz + 0.62, 0.24, 0.16); }
      if (f >= 1516 && f < 1540) { const k = (f - 1516) / 24; fx1(out, `fizz${q(k, 24)}`, 300, 300, (p) => fxFizzle(p, q(k, 24)), yx + 1.82, 1.6, yz + 0.62, 0.42, 0.42); }
      commander(out, cam, f, { expr: f < PINCH_F - LEAD ? "nervous" : "shock" });
      break;
    }
    case 13: { // the dud bounces off; cheers
      const happy = f > 1599 - LEAD;
      commander(out, cam, f, { expr: happy ? "laugh" : "nervous", prop: happy ? "cheer" : null, wave: q(Math.sin(f * 0.5), 20) });
      const [yx, , yz] = YARD;
      stand(out, cam, { i: 82, o: TROOP(0, { rifle: false }), okey: "bbq" }, yx + 3.4, yz + 3.2, { prop: happy ? "cheer" : "spatula", expr: happy ? "relief_open" : "nervous", wave: q(Math.sin(f * 0.5 + 1), 20), blink: lidAt(f, 82) });
      for (const [fh, x] of [[DUD_HIT, yx + 2.25], [DUD_HIT + 12, yx + 2.7]] as const) dust(out, `d${fh}`, x, yz + 0.6, (f - fh) / 16, 0.8);
      break;
    }
    case 14: { // two and a half tons; wider
      loadmaster(2.9, -16.4, { expr: f < SAG_AT - LEAD ? "nervous" : f < 1758 ? "shock" : "neutral", prop: f < 1758 - LEAD ? null : "shrug", blink: lidAt(f, 40, [SAG_AT, 1758]) });
      if (f >= SAG_AT) { const u = q(((f - SAG_AT) * 0.08) % 1, 30); if (f < SAG_AT + 50) for (const z of [C130.door + 5, C130.door + 12]) fx1(out, `creak${u}`, 300, 300, (p) => fxCreak(p, u), -2.6, 1.6, z, 0.8, 0.8, { rot: 0.4 }); }
      commander(out, cam, f, { expr: f < SAG_AT - LEAD ? "nervous" : "shock" });
      break;
    }
    case 15: { // a bigger plane, just for the grill
      const wave = q(Math.sin(f * 0.3), 20);
      stand(out, cam, { i: 41, o: LOADMASTER, okey: "lm" }, BIG.x + 3.9, BIG.door - BIG.ramp - 2.0, { prop: f < 1885 ? "wands" : "cheer", wave, expr: "grin", blink: lidAt(f, 41) });
      stand(out, cam, { i: 40, o: LOADMASTER, okey: "lm" }, C130.x - 3.6, C130.door - C130.ramp - 2.5, { prop: "shrug", expr: "smile_closed", blink: lidAt(f, 40) });
      const s = strykerAt(15, f)!;
      for (let i = 0; i < 3; i++) {
        const z = s.z - 6 - i * 1.3, x = BIG.x + (i - 1) * 0.9, y = Math.max(0, Math.min(BIG.floor, ((z - (BIG.door - BIG.ramp)) / BIG.ramp) * BIG.floor));
        const view = viewOf(cam, x, z, 0, 1), ph = q(((f / FPS) * 1.6 + hh(i)) % 1, 30);
        out.places.push(person(cam, { i: 100 + i, o: TROOP(i, i === 1 ? { rifle: false } : {}), okey: `t${i}${i === 1 ? "b" : ""}` }, x, y, z, view,
          { mode: "march", phase: ph, expr: "grin", lift: 40, prop: i === 1 ? "spatula" : null }, { mode: "march", phase: ph, expr: "grin", stomp: 0.6, stride: view.fs * 0.8 }));
        blob(out, x, y, z);
      }
      break;
    }
  }
  return out;
};
export { FPS };
void TOWN;
