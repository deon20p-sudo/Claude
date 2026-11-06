// Timeline of "The Grill That Grounded a Stryker": shots timed to the voice words (voice/words.json), the story
// physics (vehicle paths, ramp climbs, the tipping cargo plane, rocket flights) and the camera grammar of the skill:
// continuous slow push-ins, smootherstep glides of 18-40 f, big reframes are cuts, impacts are 7-frame kicks that
// flip sign every frame, no hand-held float. Every visual reaction lands 0-3 frames before its word.
export const FPS = 30;
export const TOTAL = 1935;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 3;
export const lin = (pts: [number, number][], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1][1];
};

// ---------------- places ----------------
/** C-130 (airfield, origin area): nose toward +z, cargo door plane at z = C130.door, ramp toe on the ground behind it */
export const C130 = { x: 0, door: -10, floor: 1.05, ramp: 4.3, halfW: 1.56, top: 3.79 };
/** the bigger jet transport (end): same layout, scaled */
export const BIG = { x: -48, door: -12, floor: 1.3, ramp: 6.0, halfW: 2.75, top: 1.3 + 3.76 };
export const HANGAR: V3 = [40, 0, -10];
export const BRIEF: V3 = [30, 0, -53]; // map board base (board faces +z)
export const GENERAL: V3 = [31.25, 0, -51.7];
export const TOWN = 600; // desert town street runs along z at x = TOWN
export const YARD: V3 = [640, 0, 0]; // motor pool: the caged Stryker parks here facing +z
export const WARHEAD: V3 = [650, 0.92, -6]; // explanation warhead on sandbags, nose toward +x
export const GARDEN = -600; // backyard (hose)
export const STRYKER = { len: 6.95, halfW: 1.36, cage: 0.38, front: 3.45, axles: [2.45, 1.2, -0.95, -2.2], r: 0.55 };

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type Zone = "air" | "town" | "garden";
export type ShotDef = { id: number; a: number; b: number; light: Light; zone: Zone };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 186, light: "day", zone: "air" },        // hook: caged Stryker stuck in the C-130 door
  { id: 2, a: 186, b: 360, light: "day", zone: "air" },      // 1999, the general, a brigade, anywhere, four days
  { id: 3, a: 360, b: 410, light: "day", zone: "air" },      // a tank tips the cargo plane
  { id: 4, a: 410, b: 594, light: "day", zone: "air" },      // engineers, eight wheels, nine soldiers, sixty mph
  { id: 5, a: 594, b: 758, light: "day", zone: "air" },      // the name: two portraits
  { id: 6, a: 758, b: 856, light: "day", zone: "air" },      // squeezes in with inches to spare
  { id: 7, a: 856, b: 956, light: "day", zone: "town" },     // Iraq, a rocket-propelled grenade
  { id: 8, a: 956, b: 1096, light: "day", zone: "town" },    // the cage, the barbecue grill
  { id: 9, a: 1096, b: 1154, light: "day", zone: "town" },   // wait, a grill?
  { id: 10, a: 1154, b: 1305, light: "golden", zone: "town" }, // the warhead and its signal
  { id: 11, a: 1305, b: 1424, light: "golden", zone: "garden" }, // the garden hose
  { id: 12, a: 1424, b: 1543, light: "day", zone: "town" },  // the bars pinch the nose
  { id: 13, a: 1543, b: 1640, light: "day", zone: "town" },  // the dud bounces off
  { id: 14, a: 1640, b: 1775, light: "day", zone: "air" },   // two and a half tons, wider
  { id: 15, a: 1775, b: TOTAL, light: "golden", zone: "air" }, // a bigger plane, just for the grill
];
/** crossfades (frames) at place / time changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 7: 8, 10: 8, 11: 8, 12: 8, 14: 8, 15: 8 };
export const FLASH_AT = 186;
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- story physics ----------------
/** ground height under a wheel at (x, z): the cargo ramps climb to the hold floors */
export const groundY = (x: number, z: number) => {
  for (const P of [C130, BIG]) {
    if (Math.abs(x - P.x) < P.halfW + 0.4) {
      if (z >= P.door) return P.floor;
      if (z > P.door - P.ramp) return ((z - (P.door - P.ramp)) / P.ramp) * P.floor;
    }
  }
  return 0;
};
export type VPose = { x: number; z: number; yaw: number; cage: boolean; ramp: number; dist: number; show: boolean; speed?: number };
/** C-130 tip about the ramp toe (radians, nose up): the tank (shot 3) and the cage's extra weight (shot 14) */
export const TIP_TANK = 388, SAG_AT = 1705;
export const planeTip = (id: number, f: number) => {
  if (id === 3) { const u = (f - (TIP_TANK - 2)) / 8; return u <= 0 ? 0 : 0.13 * (u < 1 ? easeOut(u) : 1 + 0.12 * Math.sin((f - TIP_TANK - 6) * 0.9) * Math.exp(-(f - TIP_TANK - 6) / 6)); }
  if (id === 14) { const u = (f - (SAG_AT - 2)) / 10; return u <= 0 ? 0 : 0.035 * Math.min(1, easeOut(u)) * (1 + 0.15 * Math.sin((f - SAG_AT) * 0.8) * Math.exp(-Math.max(0, f - SAG_AT) / 8)); }
  return 0;
};
/** hook / shot 14: the caged Stryker drives up the ramp and the cage hits the door frame at STUCK_F */
export const STUCK_F = 124;
const stuckZ = C130.door - (STRYKER.front + STRYKER.cage) - 0.02;
const stuckPath = (f: number, fImpact: number) => {
  if (f < fImpact) return stuckZ - (1.5 * (fImpact - f)) / FPS;
  const k = f - fImpact;
  return stuckZ - 0.22 * (1 - Math.exp(-k / 3)) + 0.05 * Math.sin(k * 0.9) * Math.exp(-k / 5);
};
/** rocket-propelled grenade flights: shot 7 (whoosh past), shot 12 (into the cage, slow motion), shot 13 (dud drop) */
export const RPG_PASS = 912, PINCH_F = 1441, DUD_DROP = 1588, DUD_HIT = 1599;
export const CAGE_HIT: V3 = [YARD[0] + STRYKER.halfW + STRYKER.cage + 0.04, 1.42, YARD[2] + 0.6];
/** the main Stryker of each shot (null = none in the shot) */
export const strykerAt = (id: number, f: number): VPose | null => {
  const t = f / FPS;
  switch (id) {
    case 1: { const z = stuckPath(f, STUCK_F); return { x: 0, z, yaw: 0, cage: true, ramp: 0, dist: z, show: true }; }
    case 2: return null;
    case 3: return { x: -6.5, z: -30, yaw: 0, cage: false, ramp: 0, dist: 0, show: false };
    case 4: {
      if (f < 548) { // in the hangar: rolls 1.6 m toward the door, opens its ramp for nine soldiers
        const d = 1.6 * smooth((f - 474) / 26);
        return { x: HANGAR[0] - d, z: HANGAR[2], yaw: -Math.PI / 2, cage: false, ramp: smooth((f - 500) / 12) * (1 - smooth((f - 538) / 10)), dist: d, show: true };
      }
      const x = 21 + (26 * (574 - f)) / FPS; // 60 mph past the lens on the taxiway
      return { x, z: -60, yaw: -Math.PI / 2, cage: false, ramp: 0, dist: -x, show: true, speed: 26 };
    }
    case 5: return { x: HANGAR[0], z: HANGAR[2], yaw: -Math.PI / 2, cage: false, ramp: 0, dist: 0, show: true };
    case 6: { const z = C130.door - STRYKER.front + (1.3 * (f - 829)) / FPS; return { x: 0, z, yaw: 0, cage: false, ramp: 0, dist: z, show: true }; }
    case 7: { const z = 15 - (3.2 * (f - 856)) / FPS; return { x: TOWN - 0.4, z, yaw: Math.PI, cage: false, ramp: 0, dist: -z, show: true }; }
    case 8: case 9: case 10: case 12: case 13: return { x: YARD[0], z: YARD[2], yaw: 0, cage: true, ramp: 0, dist: 0, show: id !== 10 };
    case 14: { const z = stuckPath(f, 1600); return { x: 0, z, yaw: 0, cage: true, ramp: 0, dist: z, show: true }; }
    case 15: { const z = BIG.door - 14 + 11.5 * smooth((f - 1790) / 100); return { x: BIG.x, z, yaw: 0, cage: true, ramp: 0, dist: z, show: true }; }
  }
  return null;
  void t;
};
/** the tank of shot 3: drives onto the C-130 ramp, the plane tips back onto its tail */
export const tankAt = (f: number) => ({ x: 0, z: C130.door - C130.ramp - 4.4 + 3.6 * smooth((f - 360) / 30), yaw: 0 });

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mixC = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mixC(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
/** push-in factor since f0 (~rate per frame), `punch` for the first n frames with 8 f soft edges */
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
const rolled = (s: (f: number) => Shot, roll: number) => (f: number): Shot => ({ ...s(f), roll });
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

const Y = YARD, H = HANGAR;
const CAMS: Record<number, Key[]> = {
  1: [
    { f: 0, s: (f) => dolly([-6.8, 2.2, -28.5], [0.3, 2.1, -14.2], pushK(f, 0, 0.0028), { fov: 44, roll: -0.03 }) },
    { f: 110, cut: true, s: (f) => dolly([-2.5, 2.85, -18.6], [-1.15, 2.05, -10.4], pushK(f, 110, 0.003, 0.007, 20), { fov: 36, roll: 0.04 }) },
    { f: 145, cut: true, s: (f) => dolly([5.6, 1.7, -21.5], [2.4, 1.55, -15.3], pushK(f, 145, 0.0025), { fov: 40 }) },
  ],
  2: [
    { f: 186, s: (f) => dolly([30.5, 1.75, -47.4], [31.15, 1.62, -51.7], pushK(f, 186, 0.0022), { fov: 38 }) },
    { f: 283, cut: true, s: (f) => dolly([32.4, 3.0, -55.5], [30, 1.0, -37], pushK(f, 283, 0.002), { fov: 46, roll: -0.02 }) },
    { f: 305, cut: true, s: (f) => dolly([29.9, 1.85, -49.6], [29.9, 1.85, -53], pushK(f, 305, 0.0025), { fov: 42 }) },
    { f: 333, dur: 22, s: (f) => dolly([29.9, 1.85, -49.6], [29.9, 1.85, -53], pushK(f, 305, 0.0025) * 0.93, { fov: 42, roll: 0.035 }) },
  ],
  3: [{ f: 360, s: (f) => dolly([-9.5, 2.5, -27.5], [0, 2.7, -12.5], pushK(f, 360, 0.002, 0.006, 22), { fov: 46 }) }],
  4: [
    { f: 410, s: (f) => dolly([31.0, 2.2, -17.4], [39.4, 1.5, -10.6], pushK(f, 410, 0.0025), { fov: 44 }) },
    { f: 472, cut: true, s: (f) => dolly([38.9, 0.72, -15.4], [40.3, 0.62, -11.4], pushK(f, 472, 0.002), { fov: 40, roll: 0.03 }) },
    { f: 500, cut: true, s: (f) => dolly([46.8, 2.3, -6.0], [42.0, 1.25, -9.8], pushK(f, 500, 0.0025), { fov: 42 }) },
    { f: 548, cut: true, s: (f) => {
      const s = strykerAt(4, f)!, lx = Math.max(s.x - 3, 14);
      return { pos: [19.5, 1.3, -55.2], look: [lx, 1.25, -60], fov: 44, roll: -0.04 };
    } },
  ],
  5: [
    { f: 594, s: (f) => dolly([33.2, 0.95, -12.2], [40, 1.7, -10], pushK(f, 594, 0.002, 0.006, 30), { fov: 40 }) },
    { f: 636, cut: true, s: (f) => dolly([44.6, 3.0, -10], [49.6, 3.15, -10], pushK(f, 636, 0.002), { fov: 48 }) },
    { f: 700, dur: 30, s: (f) => dolly([46.4, 3.1, -11.9], [49.6, 3.1, -12.9], pushK(f, 700, 0.002), { fov: 40, roll: 0.03 }) },
    { f: 722, dur: 30, s: (f) => dolly([46.4, 3.1, -8.1], [49.6, 3.1, -7.1], pushK(f, 722, 0.002), { fov: 40, roll: -0.03 }) },
  ],
  6: [
    { f: 750, s: (f) => dolly([-7.0, 2.4, -21.5], [0, 2.4, -12.5], pushK(f, 750, 0.0025), { fov: 44 }) },
    { f: 815, cut: true, s: (f) => zoom([-2.9, 3.62, -13.0], [-0.2, 3.66, -9.9], 34, pushK(f, 815, 0.003), { roll: 0.03 }) },
  ],
  7: [
    { f: 850, s: (f) => dolly([TOWN + 1.8, 1.05, -2.5], [TOWN - 0.4, 1.7, 9], pushK(f, 850, 0.002), { fov: 42 }) },
    { f: 904, dur: 18, s: (f) => dolly([TOWN + 1.8, 1.05, -2.5], [TOWN - 0.4, 1.9, 7], pushK(f, 850, 0.002) * 0.85, { fov: 40, roll: 0.05 }) },
  ],
  8: [
    { f: 956, s: (f) => dolly(add(Y, [3.9, 1.6, 1.9]), add(Y, [1.75, 1.35, -0.6]), pushK(f, 956, 0.0025), { fov: 40 }) },
    { f: 1000, cut: true, s: (f) => dolly(add(Y, [6.2, 3.1, 9.5]), add(Y, [0, 1.35, 0]), pushK(f, 1000, 0.002, 0.006, 30), { fov: 44, roll: -0.02 }) },
    { f: 1046, cut: true, s: (f) => dolly(add(Y, [1.5, 1.7, 7.6]), add(Y, [0.7, 1.5, 4.1]), pushK(f, 1046, 0.0025, 0.006, 30), { fov: 38 }) },
  ],
  9: [
    { f: 1096, s: (f) => dolly(add(Y, [-1.7, 1.66, 6.9]), add(Y, [-1.45, 1.62, 4.3]), pushK(f, 1096, 0.003), { fov: 36, roll: 0.0 }) },
    { f: 1097, dur: 18, s: (f) => dolly(add(Y, [-1.7, 1.66, 6.9]), add(Y, [-1.45, 1.62, 4.3]), pushK(f, 1096, 0.003), { fov: 36, roll: 0.06 }) },
    { f: 1119, dur: 20, s: (f) => dolly(add(Y, [-1.6, 1.66, 6.4]), add(Y, [-1.45, 1.66, 4.3]), pushK(f, 1096, 0.003), { fov: 34, roll: -0.04 }) },
  ],
  10: [
    { f: 1150, s: (f) => dolly(add(WARHEAD, [2.9, 0.95, 3.9]), add(WARHEAD, [-0.6, 0.2, 0]), pushK(f, 1150, 0.002), { fov: 42 }) },
    { f: 1207, cut: true, s: (f) => dolly(add(WARHEAD, [0.05, 0.42, 1.75]), add(WARHEAD, [0.0, 0.02, 0]), pushK(f, 1207, 0.0018), { fov: 38 }) },
  ],
  11: [
    { f: 1301, s: (f) => dolly([GARDEN + 2.6, 1.75, 6.6], [GARDEN - 1.2, 0.95, -0.4], pushK(f, 1301, 0.0022), { fov: 44 }) },
    { f: 1370, cut: true, s: (f) => dolly([GARDEN + 0.85, 1.42, 2.25], [GARDEN + 0.05, 1.3, 0], pushK(f, 1370, 0.0025, 0.006, 25), { fov: 38, roll: 0.04 }) },
  ],
  12: [
    { f: 1420, s: (f) => dolly(add(CAGE_HIT, [2.3, 0.2, 2.6]), add(CAGE_HIT, [0.25, 0.0, -0.05]), pushK(f, 1420, 0.0018, 0.005, 25), { fov: 36 }) },
    { f: 1495, dur: 24, s: (f) => dolly(add(CAGE_HIT, [1.5, 0.12, 1.55]), add(CAGE_HIT, [0.3, 0.0, 0]), pushK(f, 1495, 0.002), { fov: 34, roll: 0.03 }) },
  ],
  13: [{ f: 1543, s: (f) => dolly(add(Y, [6.0, 2.0, 6.0]), add(Y, [1.8, 1.0, 0.6]), pushK(f, 1543, 0.0022), { fov: 44, roll: -0.02 }) }],
  14: [
    { f: 1636, s: (f) => dolly([-12.5, 3.2, -26.5], [0, 2.6, -12.5], pushK(f, 1636, 0.002), { fov: 46 }) },
    { f: 1698, cut: true, s: (f) => dolly([6.5, 1.3, -18.5], [0.5, 2.7, -11.5], pushK(f, 1698, 0.0025, 0.006, 25), { fov: 44, roll: 0.04 }) },
    { f: 1756, cut: true, s: (f) => dolly([0.15, 2.45, -2.2], [0, 2.1, -14], pushK(f, 1756, 0.003), { fov: 50 }) },
  ],
  15: [
    { f: 1771, s: (f) => dolly([BIG.x + 9.5, 2.4, -31], [BIG.x, 2.8, -15], pushK(f, 1771, 0.002), { fov: 46 }) },
    { f: 1872, cut: true, s: (f) => {
      const u = glide((f - 1872) / 63);
      const a: V3 = [BIG.x + 7.5, 2.6, -27], b: V3 = [BIG.x + 30, 22, -66];
      return { pos: a.map((v, i) => v + (b[i] - v) * u) as V3, look: [BIG.x + 18 * u, 3 + 1 * u, -12 + 4 * u], fov: 44 + 2 * u, roll: 0 };
    } },
  ],
};

// impact kicks: image offset flips sign every frame, decays to 0 in 7 f
const KICKS: [number, number][] = [[STUCK_F, 1.2], [TIP_TANK, 1.4], [RPG_PASS + 4, 0.6], [PINCH_F, 0.8], [DUD_HIT, 0.5], [DUD_HIT + 12, 0.3], [SAG_AT, 0.8], [1603, 0.0]];
export const kickAt = (f: number) => {
  let a = 0;
  for (const [f0, g] of KICKS) { const n = f - f0; if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5; }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(f);
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};

// ---------------- lens: depth of field ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 0 },
  { f: 110, cInf: 12 },                                   // door corner CU
  { f: 145, cInf: 11, focus: () => [2.8, 1.6, -16.1] },   // loadmaster MS
  { f: 186, cInf: 12, focus: () => [GENERAL[0], 1.65, GENERAL[2]] }, // general MS
  { f: 283, cInf: 0 },                                    // brigade wide
  { f: 305, cInf: 10 },                                   // map board CU
  { f: 360, cInf: 0 },                                    // tank wide
  { f: 472, cInf: 13 },                                   // wheels CU
  { f: 500, cInf: 8 },                                    // ramp, soldiers boarding
  { f: 548, cInf: 0 },                                    // speed pass
  { f: 594, cInf: 7 },                                    // hangar low front
  { f: 636, cInf: 0 },                                    // portraits
  { f: 700, cInf: 6 },
  { f: 750, cInf: 0 },                                    // squeeze wide
  { f: 815, cInf: 12 },                                   // inches CU
  { f: 852, cInf: 0 },                                    // town street
  { f: 956, cInf: 12 },                                   // welder CU
  { f: 1000, cInf: 0 },                                   // cage reveal
  { f: 1046, cInf: 12 },                                  // spatula soldier MS
  { f: 1096, cInf: 15 },                                  // puzzled CU
  { f: 1150, cInf: 6 },                                   // warhead wide
  { f: 1207, cInf: 14 },                                  // warhead CU
  { f: 1301, cInf: 5 },                                   // garden wide
  { f: 1370, cInf: 13 },                                  // nozzle CU
  { f: 1420, cInf: 14, focus: () => CAGE_HIT },           // pinch CU
  { f: 1543, cInf: 6 },                                   // dud
  { f: 1636, cInf: 0 },                                   // plane wide
  { f: 1698, cInf: 9 },
  { f: 1756, cInf: 0 },                                   // from inside the hold
  { f: 1771, cInf: 0 },                                   // big plane, crane out
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
