// The whole film as data: one entry per shot. `t` is the narration line (null = silent beat).
// No imports, so this file loads in both the browser engine and the node tools.
const PI = Math.PI;
const L = (a, b, k) => a + (b - a) * k;
const V = (a, b, k) => [L(a[0], b[0], k), L(a[1], b[1], k), L(a[2], b[2], k)];
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ss = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const EASE = {
  lin: (u) => u, io: (u) => u * u * (3 - 2 * u), out: (u) => 1 - (1 - u) ** 3,
  snap: (u, tl) => { const a = cl(tl / 0.24); return 0.86 * (1 - (1 - a) ** 4) + 0.14 * u; },
};
function mv(p0, l0, p1, l1, o = {}) {
  const e = EASE[o.ease || 'lin'], f = o.fov || 45, r = o.roll || 0;
  return (u, tl) => { const k = e(u, tl); return { p: V(p0, p1, k), l: V(l0, l1, k), fov: Array.isArray(f) ? L(f[0], f[1], k) : f, roll: Array.isArray(r) ? L(r[0], r[1], k) : r, anchor: o.anchor }; };
}
const push = (p, l, k = 0.1, o = {}) => mv(p, l, V(p, l, k), l, o);
const snapIn = (p, l, k = 0.3, o = {}) => mv(p, l, V(p, l, k), l, { ...o, ease: 'snap' });
const faceTo = (a, b) => Math.atan2(b[0] - a[0], b[2] - a[2]);

export const MON = [16, 11.2, -64];
export const MONSTEP = [13.3, 2.5, -41];
export function stairPos(s) {
  const Ls = 3.8, per = 4 * Ls, k = ((s % per) + per) % per, side = Math.floor(k / Ls), f = k - side * Ls, h = 1.9;
  let x, z, ry;
  if (side === 0) { x = -h + f; z = h; ry = PI / 2; } else if (side === 1) { x = h; z = h - f; ry = PI; } else if (side === 2) { x = h - f; z = -h; ry = -PI / 2; } else { x = -h; z = -h + f; ry = 0; }
  return [300 + x, s * 0.33, z, ry];
}
// heartbeat helpers: seconds since the last beat, and a double-thump pulse 0..1
const hb = (T, bpm) => ((T * bpm / 60) % 1) * 60 / bpm;
const pulse = (T, bpm) => { const a = hb(T, bpm); return Math.exp(-a * 7) + 0.6 * Math.exp(-((a - 0.22) ** 2) * 260); };
const bellSwing = (age) => age < 0 ? 0 : 0.6 * Math.sin(age * 5.6) * Math.exp(-age * 0.8);

// ---- belfry staging
const WARM = ['#ffd9b0', 1.5];
const TOB = [-0.9, 19.3, -1.1], TOB_RY = Math.atan2(16 + 0.9, -64 + 1.1), TOBH = [-0.86, 20.42, -1.27];
const MINA_K = [0.05, 19.3, -0.85], MH = [0.05, 20.43, -0.9];
const HAND = [0.24, 19.37, -0.58];
const LANT = [-1.7, 22.3, 1.7, '#ffb060', 30, 16];
const tobSit = (S, o = {}) => S.tob.at(...TOB, TOB_RY).set({ sit: true, lean: 0.22, head: [0, 0.25], face: 'pain', armL: [-0.3, 0.2], armR: [-0.3, 0.2], ...o });
const minaN = (S, o = {}) => S.mina.at(...MINA_K, PI + 0.5).set({ armL: [0, 0.1], armR: [0, 0.1], face: 'worried', ...o });           // standing, facing north-west
const minaHand = (S, o = {}) => S.mina.at(...MINA_K, -0.7).set({ sit: true, armL: [-0.25, 0.05], armR: [-0.4, 0.1], face: 'wide', head: [0.25, 0.35], ...o });   // sitting, hand flat on the stone
const ropePull = (S, c, pull) => { S.rope(pull); c.set({ armL: [-2.75 + pull * 0.9, 0.12], armR: [-2.75 + pull * 0.9, 0.12], lean: pull * 0.25 }); };
const AWAKE = { a: 'stir', eye: 1 };
const handCam = (k, o) => push([-0.5, 19.66, 1.75], [0.12, 19.62, -0.8], k, o);
const tobCam = (d, o, k = 0.15, fn = push) => fn([TOBH[0] + 0.3 * d, TOBH[1] - 0.05, TOBH[2] - 0.97 * d], TOBH, k, o);
const minaCam = (d, o, k = 0.15, fn = push) => fn([MH[0] - 0.45 * d, MH[1] - 0.08, MH[2] - 0.89 * d], MH, k, o);
const bedCam = (o, k = 0.12) => push([6.6, 6.35, 41.45], [8.85, 4.2, 41.45], k, o);
const inBed = (S, face) => { S.blanket(true); S.mina.at(7.75, 4.02, 41.45, -PI / 2).set({ lie: true, face }); S.lights([[10.5, 4.9, 41.8, '#ffb060', 6, 9]]); };
const atWindow = (S, o = {}) => { S.mina.at(8.95, 4.03, 41.2, PI).set({ armL: [-1.2, 0.2], armR: [-1.2, 0.2], head: [0.1, -0.25], ...o }); S.lights([[9.6, 5.6, 43.4, '#ffb060', 8, 9]]); };

export const SHOTS = [
  // ---------------------------------------------------------------- the rule
  { id: 'rule1', t: 'In this town,', env: 'day', crowd: true, cam: mv([-34, 44, 112], [5, 12, -12], [-24, 31, 86], [5, 13, -14], { fov: 46, ease: 'out' }) },
  { id: 'rule2', t: 'a monster sleeps on the hill.', env: 'day', crowd: true, cam: push([-12, 9, 2], [15, 23, -58], 0.16, { fov: 46, roll: [2, 4] }) },
  { id: 'rule3', t: 'And it stays asleep,', env: 'day', cam: push([-7, -10, 15], [0, 0.5, 0], 0.16, { fov: 40, roll: -4, anchor: 'eye' }) },
  { id: 'rule4', t: 'as long as the bell rings every hour.', env: 'day', sfx: [['bell', 1.0]],
    cam: snapIn([1.1, 21.4, 13], [0.35, 21.6, 0], 0.22, { fov: 40, roll: 3 }),
    act: (S, u, tl, T) => { const a = tl - 1.0; S.bell(bellSwing(a)); S.tob.at(1.25, 19.3, 0.75, PI).set({ face: 'smile' }); ropePull(S, S.tob, a > -0.35 ? 0.7 * Math.exp(-Math.max(0, a) * 3) * cl((a + 0.35) / 0.3) : 0); S.ring(a); } },
  { id: 'dong1', t: null, dur: 1.1, env: 'day', crowd: true, cam: push([-1.0, 1.4, 34], [0.6, 17, 0], 0.08, { fov: 58, roll: -2 }),
    act: (S, u, tl) => { S.bell(bellSwing(tl + 0.9)); S.ring(tl + 0.75); } },
  { id: 'built', t: 'Nobody knows who built the tower.', env: 'day', crowd: true, cam: mv([6.5, 0.8, 11], [0, 5, 0.5], [6, 0.9, 10.2], [0, 19, 0], { fov: 62, roll: [7, 3], ease: 'io' }) },
  { id: 'slept', t: 'Nobody knows how long it has slept.', env: 'day', cam: push([-34, 9, -26], [15, 22, -58], 0.14, { fov: 42, roll: 4 }) },
  { id: 'trees', t: 'Long enough for trees to grow on its back.', env: 'day', cam: mv([-14, 33, -88], [15, 27, -58], [-9, 32, -86], [15, 27, -57], { fov: 44, roll: [-3, -6] }) },
  { id: 'know', t: 'They only know the rule.', env: 'day', crowd: true, cam: push([-0.5, 1.7, 13.6], [-6.3, 1.7, 6.8], 0.14, { fov: 42, roll: 2 }) },
  { id: 'onering', t: 'One ring. Every hour.', env: 'day',
    cam: snapIn([-2.3, 1.95, 12.9], [-6.45, 1.95, 6.6], 0.3, { fov: 54, roll: 5 }) },
  { id: 'daynight', t: 'Day and night.', env: (u) => u < 0.42 ? 'day' : 'night', crowd: true,
    cam: mv([-15, 2, 31], [3, 17, -6], [-14, 2, 29], [3, 17.5, -6], { fov: 56, roll: [-3, -5] }),
    act: (S, u, tl) => { S.ring(tl - 0.1); S.bell(bellSwing(tl)); } },
  { id: 'miss', t: 'Miss one,', env: 'day', cam: push([2.1, 20.1, 2.3], [0.1, 22.3, 0], 0.12, { fov: 52, roll: [-8, -11] }), act: (S, u, tl, T) => { S.rope(0, Math.sin(T * 2) * 0.03); } },
  { id: 'wakes', t: 'and it wakes up.', env: 'dream', sh: [8, 0, -25, 80],
    cam: snapIn([3, 1.5, -6], [13, 30, -42], 0.18, { fov: 64, roll: 9 }),
    act: (S, u) => { S.mon({ a: 'stand', b: 'roar', k: ss(0, 0.5, u), pos: MONSTEP, ry: -0.15, eye: 1, eyeCol: '#ffe070', glow: 1, glowCol: '#ffcf50' }); } },

  // ---------------------------------------------------------------- Tobias
  { id: 'pays', t: 'So the town pays one man to never miss.', env: 'day',
    cam: (u) => ({ p: [L(-1.0, 0.6, u), 1.5, 14.8], l: [L(-6.0, -2.6, u), 1.35, 9.6], fov: 40, roll: -2 }),
    act: (S, u, tl, T) => { S.tob.at(L(-6.6, -2.4, u), 0, 9.6, PI / 2).walk(T * 5.2, 0.5).set({ lean: 0.12, head: [0, 0.08] }); S.folk[10].at(-5.6, 0, 7.2, 0.3).set({ head: [0.4, 0] }); S.folk[12].at(-4.2, 0, 6.6, 0.1).set({ head: [0.2, 0] }); S.folk[5].at(-9, 0, 11.5, 1.2).walk(T * 5, 0.5); } },
  { id: 'tobias', t: 'Old Tobias. The bell-ringer.', env: 'day',
    cam: snapIn([1.6, 0.95, 12.8], [0.45, 1.68, 9.0], 0.2, { fov: 40, roll: 4 }),
    act: (S, u, tl, T) => { S.tob.at(0.5, 0, 9.0, 0.2).set({ lean: 0.08, head: [Math.sin(T * 0.9) * 0.08, -0.05], face: 'neutral' }); } },
  { id: 'hello', t: 'He never says hello back.', env: 'day',
    cam: mv([3.4, 1.5, 13.8], [3.1, 1.25, 8.0], [3.9, 1.5, 13.4], [3.7, 1.25, 8.0], { fov: 44, roll: -3 }),
    act: (S, u, tl, T) => { const x = L(1.5, 3.6, u); S.tob.at(x, 0, 8.8, PI / 2).walk(T * 5.2, 0.5).set({ lean: 0.12 }); S.folk[11].at(4.3, 0, 6.8, faceTo([4.3, 0, 6.8], [x, 0, 8.8])).set({ armR: [-2.6 + Math.sin(T * 14) * 0.3, 0.35], face: 'happy', head: [0, -0.05] }); S.folk[6].at(8.5, 0, 5.5, -1.2).walk(T * 5, 0.5); } },
  { id: 'shoes', t: 'He wears no shoes, even in the snow.', env: 'snow',
    cam: (u) => ({ p: [L(1.1, 1.6, u), 0.5, 11.4], l: [L(-0.7, -0.1, u), 0.32, 9.0], fov: 34, roll: 3 }),
    act: (S, u, tl, T) => { S.tob.at(L(-1.2, -0.25, u), 0.03, 9.0, PI / 2).walk(T * 5.2, 0.55); } },
  { id: 'clock1', t: 'And the clock on his tower', env: 'day', crowd: true, cam: push([-8, 6, 22], [0, 15.4, 3], 0.2, { fov: 40, roll: 4 }) },
  { id: 'clock2', t: 'has been stuck at ten past four', env: 'day', cam: snapIn([2.2, 14.0, 14.5], [0.3, 15.4, 3.1], 0.16, { fov: 30, roll: -3 }) },
  { id: 'years', t: 'for thirty years.', sh: [0, 8, 6, 40],
    env: (u) => { const c = (u * 3) % 1, seq = ['day', 'dusk', 'night', 'day']; const i = Math.floor(c * 3), k = c * 3 - i; return [seq[i], seq[i + 1], ss(0.15, 0.85, k)]; },
    cam: push([4, 11, 18], [0, 15.3, 3], 0.12, { fov: 40, roll: [2, 6] }) },
  { id: 'nofix', t: 'Nobody fixes it.', env: 'day', crowd: true, cam: push([9.5, 1.2, 16], [0, 9.5, 2], 0.08, { fov: 56, roll: 5 }) },
  { id: 'never', t: 'The bell is never late.', env: 'day', sfx: [['bell', 0.45]],
    cam: push([-0.5, 20.5, 2.75], [0.85, 21.25, -0.2], 0.08, { fov: 64, roll: 4 }),
    act: (S, u, tl) => { const a = tl - 0.45; S.bell(bellSwing(a)); S.tob.at(1.25, 19.3, 0.75, PI).set({ face: 'smile' }); ropePull(S, S.tob, 0.7 * Math.exp(-Math.max(0, a) * 3) * cl((a + 0.35) / 0.3)); } },

  // ---------------------------------------------------------------- Mina
  { id: 'mina', t: "And then there's Mina.", env: 'day',
    cam: snapIn([0.55, 0.62, 33.9], [1.05, 0.98, 30], 0.28, { fov: 44, roll: 5 }),
    act: (S, u, tl, T) => { S.mina.at(0.8, 0, 30, -0.05).set({ face: 'smile', head: [Math.sin(T * 1.2) * 0.1, -0.08], armL: [0, 0.12], armR: [0, 0.12] }); } },
  { id: 'counts', t: 'Mina counts everything.', env: 'day',
    cam: mv([1.5, 1.0, 39.4], [-1.9, 2.0, 35], [1.7, 1.0, 40.2], [-1.9, 2.0, 36], { fov: 58, roll: -3 }),
    act: (S, u, tl, T) => { S.mina.at(-0.2, 0, L(36.2, 37.6, u), 0.15).walk(T * 8, 0.6).set({ armR: [-1.9, 0.9], face: 'happy', head: [-0.5, -0.1] }); [[1, 33], [2, 25], [3, 17]].forEach(([n, z], i) => S.num(n, -8.6, 9.4, z, 2.6, tl - 0.15 - i * 0.38, '#ffe14a')); S.folk[2].at(-1.6, 0, L(22, 24, u), 0).walk(T * 5, 0.5); } },
  { id: 'stairs', t: 'Stairs.', env: 'day',
    cam: push([4.6, 1.3, 8.6], [0, 1.2, 4.2], 0.08, { fov: 40, roll: -6 }),
    act: (S, u, tl) => { const st = Math.min(3, Math.floor(u * 4.2)); const hop = Math.abs(Math.sin(u * 4.2 * PI)) * 0.25; S.mina.at(0, 0.225 * (st + 1) + hop, 4.75 - st * 0.5, PI).set({ face: 'happy', armL: [-0.6, 0.5], armR: [-0.6, 0.5], head: [-1.0, 0] }); for (let i = 0; i <= st; i++) S.num(i + 1, 1.3 - i * 0.15, 2.0 + i * 0.32, 4.75 - i * 0.5, 0.5, tl - i * 0.16, '#ffe14a'); } },
  { id: 'stars', t: 'Stars.', env: 'night', sh: [12, 0, 27, 16],
    cam: push([12.9, 0.5, 31.2], [11.4, 6.4, 22], 0.06, { fov: 62, roll: 5 }),
    act: (S, u, tl) => { S.mina.at(12, 0, 28.6, PI + 0.1).set({ armR: [-2.7, 0.3], head: [0, -0.5], face: 'happy' }); [[41, 7, 16, 8], [42, 13, 20, 4], [43, 16, 13, 10]].forEach(([n, x, y, z], i) => S.num(n, x, y, z, 2.6, tl - 0.05 - i * 0.14, '#ffe14a')); } },
  { id: 'crows', t: 'Crows on the wire.', env: 'day',
    cam: push([1.8, 5.2, 34.5], [-4, 7.0, 26], 0.1, { fov: 38, roll: 6 }),
    act: (S, u, tl) => { [20.5, 23.2, 25.6, 28.4, 31].forEach((z, i) => S.num(5 - i, -4, 7.8, z, 0.6, tl - 0.1 - (4 - i) * 0.16, '#ffe14a')); } },
  { id: 'night', t: 'And every night, when the whole town is asleep,', env: 'late',
    cam: mv([-30, 30, 74], [5, 6, 28], [-17, 19, 60], [7, 6, 40], { fov: 44, roll: [0, 3], ease: 'io' }),
    act: (S) => { S.lights([[9, 5.6, 43, '#ffb060', 40, 16]]); } },
  { id: 'awake', t: 'she lies awake, and counts the bells.', env: 'late', sh: [8.5, 4, 43, 14], fill: WARM,
    cam: bedCam({ fov: 42, roll: [6, 2] }), act: (S) => inBed(S, 'up') },
  { id: 'nine', t: 'Nine.', env: 'late', sfx: [['bell', 0.0, 0.5]], fill: WARM,
    cam: push([9.45, 5.2, 43.7], [1, 17, 4], 0.03, { fov: 56, roll: -3 }),
    act: (S, u, tl) => { atWindow(S); S.ring(tl + 0.3); S.num(9, -3.5, 26, 2, 4.2, tl - 0.02, '#ffe14a'); } },
  { id: 'ten', t: 'Ten.', env: 'late', sfx: [['bell', 0.0, 0.5]], fill: WARM,
    cam: push([7.9, 5.45, 36.8], [8.95, 5.0, 41.2], 0.08, { fov: 26, roll: 4 }),
    act: (S, u, tl) => { atWindow(S, { face: 'happy' }); S.num(10, 9.75, 5.7, 40.3, 0.5, tl - 0.02, '#ffe14a'); } },
  { id: 'eleven', t: 'Eleven.', env: 'late', sfx: [['bell', 0.0, 0.5]],
    cam: push([1.5, 2, 31], [7, 20, -24], 0.05, { fov: 56, roll: -4 }),
    act: (S, u, tl) => { S.ring(tl + 0.25); S.bell(bellSwing(tl + 0.4)); S.num(11, 5.5, 19, 2, 4.4, tl - 0.02, '#ffe14a'); } },
  { id: 'wrong', t: 'She has never counted wrong.', env: 'late', sh: [8.5, 4, 43, 14], fill: WARM,
    cam: push([7.5, 5.7, 41.45], [8.9, 4.2, 41.45], 0.14, { fov: 36, roll: -5 }), act: (S) => inBed(S, 'happy') },

  // ---------------------------------------------------------------- but one night
  { id: 'storm', t: 'But one night, in the middle of a storm,', env: 'storm', flash: [0.25, 1.75],
    cam: mv([-2.8, 2.2, 66], [3, 15, 0], [-2.6, 2.4, 58], [3.5, 16, 0], { fov: 54, roll: [4, 7] }),
    act: (S) => { S.lights([[9, 5.6, 43, '#ffb060', 40, 16], [-1.7, 22.3, 1.7, '#ffb060', 60, 22], [-3.7, 4.2, 48, '#ffdca0', 12, 14]]); } },
  { id: 'to11', t: 'she counts to eleven,', env: 'storm', sh: [8.5, 4, 43, 14], flash: [1.0], fill: WARM,
    cam: bedCam({ fov: 40, roll: [-6, -2] }, 0.2),
    act: (S, u, tl) => { inBed(S, 'up'); S.num(11, 8.5, 5.0, 40.95, 0.42, tl - 0.75, '#ffe14a'); } },
  { id: 'twelve', t: 'and waits for twelve.', env: 'storm', fill: WARM,
    cam: push([9.45, 5.2, 43.7], [1, 17, 4], 0.05, { fov: 56, roll: 3 }),
    act: (S) => { atWindow(S); S.lights([[9.6, 5.6, 43.4, '#ffb060', 8, 9], [-1.7, 22.3, 1.7, '#ffb060', 60, 22]]); } },
  { id: 'waits', t: 'And waits.', gap: 0.05, env: 'storm', flash: [0.5], fill: WARM,
    cam: push([8.3, 5.3, 37.6], [8.95, 5.02, 41.2], 0.1, { fov: 24, roll: -4 }),
    act: (S) => { atWindow(S, { face: 'worried', head: [0.1, -0.2] }); } },
  { id: 'still', t: null, dur: 1.0, env: 'storm',
    cam: push([0.7, 21.2, 9.5], [0, 22.0, 0], 0.07, { fov: 36, roll: 2 }),
    act: (S, u, tl, T) => { S.rope(0, Math.sin(T * 2.2) * 0.05); S.lights([LANT]); } },
  { id: 'nothing', t: 'Nothing.', gap: 0.25, env: 'storm', flash: [0.12],
    cam: push([0.6, 1.2, 23], [0, 19, 0], 0.05, { fov: 62, roll: -10 }), act: (S) => { S.lights([LANT]); } },
  { id: 'moves', t: 'On the hill, something moves.', env: 'storm', flash: [0.35, 1.25],
    cam: push([-12, 8, 0], [15, 24, -57], 0.12, { fov: 44, roll: 5 }),
    act: (S, u, tl) => { S.mon({ a: 'sit', b: 'stir', k: ss(0.25, 0.95, u), sway: Math.sin(tl * 9) * 0.02 * ss(0.1, 0.5, u) }); } },
  { id: 'eye', t: 'One eye opens.', gap: 0.05, env: 'storm', sh: [16, 30, -55, 30],
    cam: snapIn([-5, -9, 21], [0, 0, 0], 0.3, { fov: 36, roll: -6, anchor: 'eye' }),
    act: (S, u, tl) => { S.mon({ a: 'stir', eye: ss(0.3, 0.85, tl), glow: ss(0.5, 1.2, tl) * 0.5 }); } },
  { id: 'gasp', t: null, dur: 0.75, env: 'storm', flash: [0.05], sfx: [['growl', 0.0]], fill: WARM,
    cam: snapIn([8.4, 5.15, 37.9], [8.95, 5.04, 41.2], 0.3, { fov: 22, roll: 6 }),
    act: (S) => { atWindow(S, { armL: [-1.4, 0.3], armR: [-1.4, 0.3], face: 'scared', head: [0, 0] }); S.mon(AWAKE); } },

  // ---------------------------------------------------------------- the run
  { id: 'runs', t: 'Mina runs.', env: 'storm', sfx: [['steps', 0, 6.5]],
    cam: (u) => ({ p: [L(0.2, -0.3, u), 0.45, L(40.5, 38.5, u)], l: [L(3.8, 1.6, u), 0.8, L(43.8, 41.2, u)], fov: 50, roll: 8 }),
    act: (S, u, tl, T) => { S.mina.at(L(4.3, 1.4, u), 0, L(44, 41, u), faceTo([4.3, 0, 44], [1.4, 0, 41])).walk(T * 15, 1.0).set({ lean: 0.3, face: 'worried' }); S.lights([[4.4, 2.6, 44, '#ffb060', 22, 12], [-3.7, 4, 36, '#ffdca0', 16, 16]]); S.mon(AWAKE); } },
  { id: 'dark', t: 'Past dark houses.', env: 'storm', flash: [0.7], sfx: [['steps', 0, 6.5]],
    cam: (u) => { const z = L(36, 30.5, u); return { p: [5.2, 0.9, z - 1.6], l: [0.4, 0.75, z - 0.6], fov: 48, roll: -5 }; },
    act: (S, u, tl, T) => { const z = L(36, 30.5, u); S.mina.at(0.4, 0, z, PI).walk(T * 15, 1.0).set({ lean: 0.3, face: 'worried' }); S.lights([[-3.7, 4, 36, '#ffdca0', 14, 16], [-3.7, 4, 24, '#ffdca0', 14, 16]]); S.mon(AWAKE); } },
  { id: 'nobody', t: 'Nobody else wakes up.', env: 'storm', sfx: [['steps', 0, 6.5]],
    cam: mv([-9, 17, 30], [0.3, 0, 23], [-8, 15, 27], [0.3, 0, 20], { fov: 44, roll: 6 }),
    act: (S, u, tl, T) => { S.mina.at(0.3, 0, L(26.5, 19.5, u), PI).walk(T * 15, 1.0).set({ lean: 0.3 }); S.lights([[-3.7, 4.2, 24, '#ffdca0', 10, 14], [3.7, 4.2, 19, '#ffdca0', 10, 14]]); S.mon(AWAKE); } },
  { id: 'uptower', t: 'Up the tower.', env: 'storm', flash: [0.2], sfx: [['steps', 0, 6.5]],
    cam: mv([1.6, 0.4, 13.5], [0, 4, 3], [1.3, 0.4, 12], [0, 11, 1], { fov: 64, roll: [6, 9] }),
    act: (S, u, tl, T) => { const k = cl(u * 1.15); const z = L(10, 3.5, k), y = z < 5.25 ? Math.min(0.9, (5.25 - z) / 2 * 0.9) : 0; S.mina.at(0, y, z, PI).walk(T * 15, 1.0).set({ lean: 0.3 }); S.lights([LANT, [0, 3.2, 4.5, '#ffdca0', 6, 8]]); S.mon(AWAKE); } },
  { id: 'steps212', t: 'Two hundred and twelve steps.', env: 'stairs', sfx: [['steps', 0, 7]],
    cam: (u) => { const s = L(40, 53, u); const [x, y, z] = stairPos(s); return { p: [300.2, y + 7.5, 0.2], l: [300 + (x - 300) * 0.3, y, z * 0.3], fov: 60, roll: L(-10, 30, u) }; },
    act: (S, u, tl, T) => { const s = L(40, 53, u); const [x, y, z, ry] = stairPos(s); S.mina.at(x, y, z, ry).walk(T * 15, 0.9).set({ lean: 0.25 }); S.lights([[300 + (x - 300) * 0.5, y + 2.4, z * 0.5, '#ffb060', 18, 14], [300, y + 6, 0, '#ffb060', 12, 16]]); [198, 199, 200].forEach((n, i) => { const a = tl - i * 0.45; S.num(n, x, y + 2.0, z, 1.0, a < 0.45 || i === 2 ? a : -1, '#ffe14a'); }); } },
  { id: 'every', t: 'She counts every one.', env: 'stairs', sfx: [['steps', 0, 7]],
    cam: (u) => { const s = L(60.2, 63.2, u); const [x, y, z] = stairPos(s); const [x2, y2, z2] = stairPos(s + 2.5); return { p: [300 + (x2 - 300) * 0.55, y2 + 0.55, z2 * 0.75], l: [x, y + 1.0, z], fov: 46, roll: 7 }; },
    act: (S, u, tl, T) => { const s = L(60.2, 63.2, u); const [x, y, z, ry] = stairPos(s); S.mina.at(x, y, z, ry).walk(T * 15, 0.9).set({ lean: 0.2, face: 'worried' }); S.lights([[300 + (x - 300) * 0.4, y + 2.4, z * 0.4, '#ffb060', 14, 12]]); [210, 211, 212].forEach((n, i) => { const a = tl - i * 0.42; S.num(n, x, y + 1.62, z, 0.34, a < 0.42 || i === 2 ? a : -1, '#ffe14a'); }); } },

  // ---------------------------------------------------------------- the belfry
  { id: 'top', t: 'At the top, Tobias is on the floor.', env: 'storm', flash: [1.2], sh: [0, 20, 0, 13], fill: WARM,
    cam: mv([-2.3, 20.9, 2.6], [-0.5, 20.0, -1.2], [-2.0, 20.6, 2.1], [-0.5, 20.0, -1.2], { fov: 56, roll: [-4, -7], ease: 'out' }),
    act: (S, u, tl, T) => { tobSit(S, { lean: 0.45, head: [0, 0.4] }); S.lights([LANT]); S.mon({ a: 'stir', eye: 1, glow: pulse(T, 80) * 0.5 }); } },
  { id: 'fell', t: "He fell. He can't stand.", env: 'storm', sh: [0, 20, 0, 13], fill: WARM,
    cam: tobCam(2.6, { fov: 40, roll: -6 }),
    act: (S, u, tl, T) => { tobSit(S, { head: [Math.sin(T * 5) * 0.03, 0.1] }); S.mina.at(L(1.6, 0.8, u), 19.3, L(1.6, 0.9, u), faceTo([1.6, 0, 1.6], TOB)).walk(T * 14, 0.8).set({ face: 'scared' }); S.lights([LANT]); } },
  { id: 'shout1', t: '"Tobias!" she screams.', env: 'storm', flash: [0.1], sh: [0, 20, 0, 13], fill: WARM,
    cam: snapIn([-1.0, 20.3, -1.25], [0.6, 20.42, 0.6], 0.2, { fov: 40, roll: 6 }),
    act: (S) => { S.mina.at(0.6, 19.3, 0.6, faceTo([0.6, 0, 0.6], TOB)).set({ face: 'shout', armL: [-0.5, 0.6], armR: [-0.5, 0.6], lean: 0.2 }); S.lights([LANT]); } },
  { id: 'shout2', t: '"Ring the bell!"', env: 'storm', sh: [0, 20, 0, 13], fill: WARM,
    cam: snapIn([-0.6, 20.36, -0.85], [0.6, 20.44, 0.6], 0.3, { fov: 36, roll: -8 }),
    act: (S) => { S.mina.at(0.6, 19.3, 0.6, faceTo([0.6, 0, 0.6], TOB)).set({ face: 'shout', armL: [-2.6, 0.5], armR: [-0.5, 0.6], lean: 0.25, head: [0, -0.15] }); S.lights([LANT]); } },
  { id: 'noturn', t: "He doesn't even turn around.", env: 'storm', flash: [0.6], sh: [0, 20, 0, 13], fill: WARM,
    cam: push([-1.75, 20.7, 1.9], [-0.7, 20.2, -1.3], 0.15, { fov: 42, roll: 3 }),
    act: (S, u, tl, T) => { tobSit(S); S.lights([LANT]); S.mon({ a: 'stir', eye: 1, glow: pulse(T, 85) * 0.5 }); } },
  { id: 'grabs', t: 'She grabs his arm.', env: 'storm', sh: [0, 20, 0, 13], fill: WARM,
    cam: snapIn([-0.3, 20.3, -4.8], [-0.5, 20.2, -1.0], 0.16, { fov: 38, roll: 5 }),
    act: (S, u) => { tobSit(S, { head: [-0.5 * ss(0.3, 0.9, u), 0.1] }); minaN(S, { armR: [-1.4, 0.6], face: 'scared' }); S.lights([LANT]); } },
  { id: 'ears', t: 'He looks up, and points at his ears.', env: 'storm', sh: [0, 20, 0, 13], fill: WARM,
    cam: tobCam(3.3, { fov: 38, roll: 5 }, 0.1),
    act: (S, u, tl) => { tobSit(S, { head: [-0.45 + Math.sin(tl * 7) * 0.14 * ss(0.5, 0.8, u), -0.08], face: 'sad', armL: [-2.5, 0.45], lean: 0.1 }); minaN(S); S.lights([LANT]); } },
  { id: 'deaf', t: 'Tobias is deaf.', env: 'storm', flash: [0.05], sh: [0, 20, 0, 13], fill: WARM,
    cam: tobCam(2.6, { fov: 30, roll: -5 }, 0.38, snapIn),
    act: (S) => { tobSit(S, { head: [-0.3, -0.05], face: 'sad', armL: [-2.55, 0.25] }); minaN(S, { face: 'wide' }); S.lights([LANT]); } },
  { id: 'heard', t: 'He has never heard the bell.', env: 'storm', flash: [0.9], sh: [0, 20, 0, 13],
    cam: mv([-0.7, 19.5, 1.9], [0, 22.0, -0.1], [-0.5, 19.5, 1.6], [0, 22.3, -0.1], { fov: 66, roll: [-10, -14] }), act: (S) => { S.lights([LANT]); } },
  { id: 'notonce', t: 'Not once.', env: 'day', sh: [0, 20, 0, 13],
    cam: snapIn([0.55, 20.95, -1.6], [1.22, 20.98, 0.75], 0.25, { fov: 36, roll: 4 }),
    act: (S, u, tl, T) => { S.bell(bellSwing(tl + 0.4)); S.tob.at(1.25, 19.3, 0.75, PI).set({ face: 'happy' }); ropePull(S, S.tob, 0.35 + 0.3 * Math.sin(T * 6)); } },
  { id: 'how', t: 'So how does he know when to ring it?', env: 'storm', sh: [0, 20, 0, 13], fill: WARM,
    cam: minaCam(2.6, { fov: 34, roll: [3, -3] }, 0.2),
    act: (S, u, tl) => { minaN(S, { face: 'wide', head: [Math.sin(tl * 2.2) * 0.45, -0.1] }); S.lights([LANT]); } },
  { id: 'takes', t: 'He takes her hand,', env: 'storm', sh: [0, 20, 0, 13], fill: WARM,
    cam: push([-0.3, 20.2, -4.4], [-0.42, 20.05, -1.0], 0.25, { fov: 36, roll: -4 }),
    act: (S, u) => { tobSit(S, { head: [-0.5, 0.1], face: 'sad', armL: [-1.2, L(0.2, 0.7, ss(0, 0.7, u))] }); minaN(S, { armR: [-1.1, 0.7], face: 'wide' }); S.lights([LANT]); } },
  { id: 'presses', t: 'and presses it flat against the stone.', env: 'storm', sh: [0, 20, 0, 13], fill: WARM,
    cam: mv([1.6, 20.7, 1.1], [0.15, 19.6, -0.7], [1.3, 20.3, 0.7], [0.18, 19.5, -0.65], { fov: 42, roll: [8, 4] }),
    act: (S, u) => { tobSit(S, { head: [-0.5, 0.3], face: 'neutral' }); minaHand(S, { armL: [L(-1.0, -0.25, ss(0, 0.6, u)), 0.05], head: [0.5, 0.5] }); S.lights([LANT]); } },
  { id: 'thump', t: null, dur: 1.7, env: 'storm', hb: { bpm: 72, t0: 0.15 }, flash: [1.0], sh: [0, 20, 0, 13], fill: WARM,
    cam: handCam(0.12, { fov: 46, roll: 4 }),
    act: (S, u, tl) => { tobSit(S, { head: [-0.5, 0.3], face: 'neutral' }); minaHand(S); const a = ((tl - 0.15 + 10) % (60 / 72)); if (tl > 0.15) { S.rip(...HAND, a, '#ffb040', 2.2); S.rip(...HAND, a - 0.2, '#ff8a30', 1.5); } S.lights([LANT]); S.mon({ a: 'stir', eye: 1, glow: tl > 0.15 ? Math.exp(-a * 6) + 0.5 * Math.exp(-((a - 0.2) ** 2) * 300) : 0 }); } },
  { id: 'heart', t: 'A heartbeat.', env: 'storm', hb: { bpm: 72 }, sh: [0, 20, 0, 13], fill: WARM,
    cam: snapIn([-1.3, 20.2, 1.2], [0.05, 20.1, -0.85], 0.3, { fov: 34, roll: -6 }),
    act: (S) => { minaHand(S, { face: 'scared', head: [0.1, 0] }); S.lights([LANT]); } },
  { id: 'floor', t: 'Coming up through the floor.', env: 'storm', hb: { bpm: 76 },
    cam: mv([-11, 2.5, 15], [0, 6, 0], [-10, 2.5, 14], [0, 15, 0], { fov: 56, roll: [-5, -8], ease: 'io' }),
    act: (S, u, tl, T) => { for (let i = 0; i < 6; i++) { const ph = ((tl * 0.9 + i / 6) % 1); S.band(0, 0.3 + ph * 19, 0, 4.7 + 0.5 * Math.sin(ph * PI), '#ffb040', Math.sin(ph * PI) * 0.95); } S.lights([LANT]); S.mon({ a: 'stir', eye: 1, glow: pulse(T, 76) }); } },
  { id: 'fromhill', t: 'From the hill.', env: 'storm', flash: [0.3], hb: { bpm: 76 },
    cam: snapIn([-10, 6, -6], [15, 24, -56], 0.2, { fov: 46, roll: 6 }),
    act: (S, u, tl, T) => { S.mon({ a: 'stir', eye: 1, glow: pulse(T, 76) }); } },
  { id: 'noshoes', t: "That's why he wears no shoes.", env: 'storm', hb: { bpm: 80 }, sh: [0, 20, 0, 13], fill: WARM,
    cam: push([-0.1, 20.25, -4.5], [-0.78, 19.75, -1.6], 0.12, { fov: 40, roll: -5 }),
    act: (S, u, tl, T) => { tobSit(S, { face: 'neutral', head: [0, 0.3] }); const a = hb(T, 80); S.rip(-0.72, 19.37, -1.8, a, '#ffb040', 1.2); S.rip(-0.72, 19.37, -1.8, a - 0.2, '#ff8a30', 0.8); S.lights([LANT]); } },
  { id: 'noclock', t: 'He never needed the clock.', env: 'storm', flash: [0.2],
    cam: snapIn([2.6, 13.2, 13.5], [0.3, 15.4, 3.1], 0.25, { fov: 32, roll: 8 }), act: (S) => { S.lights([[2, 15.5, 6.5, '#aab8ff', 10, 10]]); } },
  { id: 'stirs', t: 'The monster stirs about once an hour,', env: 'day',
    cam: push([-22, 10, -22], [15, 24, -57], 0.12, { fov: 42, roll: -4 }),
    act: (S, u, tl) => { const k = Math.sin(cl(u * 1.2) * PI); S.mon({ a: 'sit', b: 'stir', k: k * 0.55, sway: Math.sin(tl * 8) * 0.015 * k, zzz: u < 0.25 || u > 0.9, glow: k * 0.6 }); } },
  { id: 'feels', t: 'and Tobias feels it coming.', env: 'day', sh: [0, 20, 0, 13],
    cam: push([-0.5, 19.75, 3.2], [1.1, 20.2, 0.6], 0.14, { fov: 54, roll: 5 }),
    act: (S, u, tl, T) => { S.tob.at(1.25, 19.3, 0.75, PI).set({ face: 'neutral', head: [0, 0.2] }); ropePull(S, S.tob, 0); const a = hb(T, 70); S.rip(1.25, 19.37, 0.75, a, '#ffb040', 1.5); S.rip(1.25, 19.37, 0.75, a - 0.2, '#ff8a30', 1.0); S.mon({ a: 'sit', b: 'stir', k: 0.4, glow: pulse(T, 70) * 0.6 }); } },
  { id: 'racing', t: 'But tonight, the heartbeat is racing.', env: 'storm', flash: [1.4], hb: { bpm: 150 }, sh: [0, 20, 0, 13], fill: WARM,
    cam: handCam(0.2, { fov: 42, roll: [-6, -10] }),
    act: (S, u, tl, T) => { tobSit(S, { head: [-0.5, 0.3], face: 'pain' }); minaHand(S, { face: 'scared' }); const a = hb(T, 150); S.rip(...HAND, a, '#ff5a20', 2.4, 0.5); S.rip(...HAND, a - 0.13, '#ff8a30', 1.6, 0.5); S.lights([LANT]); S.mon({ a: 'stir', b: 'stand', k: 0.25 * u, eye: 1, glow: pulse(T, 150), eyeCol: '#ff8a30' }); } },

  // ---------------------------------------------------------------- it stands
  { id: 'stands', t: 'Outside, the monster stands up.', env: 'storm', flash: [0.5, 1.35], sfx: [['growl', 0.2]],
    cam: mv([-10, 2, 0], [15, 22, -58], [-9, 2, 1], [15, 33, -58], { fov: 60, roll: [-5, -8], ease: 'io' }),
    act: (S, u, tl, T) => { S.mon({ a: 'stir', b: 'stand', k: ss(0.05, 0.9, u), eye: 1, glow: pulse(T, 150), eyeCol: '#ff8a30' }); } },
  { id: 'shadow', t: 'Its shadow covers the whole town.', env: 'stormN', flash: [0.25, 1.3], sh: [5, 0, -15, 110], sfx: [['stomp', 0.5], ['stomp', 1.5]],
    cam: mv([-10.5, 1.6, 7], [10, 24, -42], [-10, 1.6, 6], [10, 30, -42], { fov: 64, roll: [4, 8] }),
    act: (S, u, tl, T) => { const k = ss(0, 1, u); S.mon({ a: 'stand', b: 'stop', k: k * 0.5, pos: V(MON, MONSTEP, k), ry: L(-0.2, -0.05, k), eye: 1, glow: pulse(T, 150), eyeCol: '#ff8a30' }); S.lights([LANT]); } },
  { id: 'rope', t: 'Mina grabs the rope.', env: 'storm', sh: [0, 20, 0, 13], fill: WARM,
    cam: snapIn([-0.5, 20.75, 2.5], [1.2, 20.45, 0.2], 0.2, { fov: 40, roll: 6 }),
    act: (S) => { S.mina.at(1.25, 19.3, 0.5, PI).set({ face: 'worried', head: [0.9, -0.3] }); ropePull(S, S.mina, 0); S.lights([LANT]); } },
  { id: 'heavy', t: "It's too heavy.", env: 'storm', sh: [0, 20, 0, 13], fill: WARM,
    cam: push([-0.6, 20.0, 2.3], [1.05, 20.5, 0.2], 0.12, { fov: 50, roll: -4 }),
    act: (S, u, tl) => { const p = 0.06 + Math.abs(Math.sin(tl * 9)) * 0.06; S.mina.at(1.25, 19.3, 0.5, PI).set({ face: 'pain', head: [1.0, -0.2] }); ropePull(S, S.mina, p); S.bell(p * 0.12); S.lights([LANT]); } },
  { id: 'jumps', t: 'So she jumps,', env: 'storm', flash: [0.3], sh: [0, 20, 0, 13], fill: WARM,
    cam: snapIn([2.7, 19.6, 2.5], [1.25, 20.9, 0.2], 0.2, { fov: 54, roll: 10 }),
    act: (S, u) => { const j = Math.sin(cl(u * 1.1) * PI * 0.55) * 1.05; S.mina.at(1.25, 19.3 + j, 0.42, PI).set({ face: 'shout', legL: -0.5, legR: 0.4, head: [-0.9, -0.2] }); ropePull(S, S.mina, 0); S.lights([LANT]); } },
  { id: 'hangs', t: 'and hangs on with everything she has.', env: 'storm', sh: [0, 20, 0, 13], fill: WARM,
    cam: mv([-1.3, 20.0, 2.4], [0.95, 21.0, 0.1], [-1.1, 19.9, 2.2], [0.9, 21.2, 0.1], { fov: 58, roll: [-6, -10] }),
    act: (S, u, tl) => { const d = ss(0.1, 1, u) * 0.85; S.mina.at(1.25, 19.3 + 1.0 - d, 0.42, PI).set({ face: 'pain', legL: Math.sin(tl * 10) * 0.5, legR: -Math.sin(tl * 10) * 0.5, head: [1.0, -0.2] }); S.rope(d); S.mina.set({ armL: [-2.9, 0.1], armR: [-2.9, 0.1] }); S.bell(-d * 0.75); S.lights([LANT]); } },
  { id: 'dong2a', t: null, dur: 0.6, env: 'storm', flash: [0.0], sfx: [['bell', 0.0, 1.3]], sh: [0, 20, 0, 13],
    cam: snapIn([-1.6, 20.0, -1.9], [0, 22.1, 0], 0.2, { fov: 60, roll: 12 }),
    act: (S, u, tl) => { S.bell(-0.64 * Math.cos(tl * 5.6) * Math.exp(-tl * 0.5)); S.rope(0.85 * Math.exp(-tl * 4)); S.lights([[0, 21, 0, '#ffe2a0', 60 * Math.exp(-tl * 4) + 20, 18]]); } },
  { id: 'dong2b', t: null, dur: 1.3, env: 'storm', flash: [0.05, 0.75], sh: [5, 0, -15, 110],
    cam: push([-18, 9, 38], [3, 22, -8], 0.06, { fov: 56, roll: -5 }),
    act: (S, u, tl, T) => { S.ring(tl + 0.45, 1.5); S.bell(-0.64 * Math.cos((tl + 0.6) * 5.6) * Math.exp(-(tl + 0.6) * 0.5)); S.lights([LANT]); S.mon({ a: 'stop', pos: MONSTEP, ry: -0.05, eye: 1, glow: pulse(T, 150), eyeCol: '#ff8a30' }); } },
  { id: 'stops', t: 'The monster stops.', env: 'storm', flash: [0.15, 0.9], sh: [8, 0, -25, 80],
    cam: push([-1.5, 1.3, -10], [12, 27, -40], 0.07, { fov: 64, roll: 7 }),
    act: (S, u, tl, T) => { S.mon({ a: 'stop', pos: MONSTEP, ry: -0.05, eye: 1, glow: pulse(T, 110) * 0.8 }); S.ring(tl + 1.3, 1.5); } },
  { id: 'bakery', t: 'One foot in the air, above the bakery.', env: 'storm', flash: [1.2], sh: [8, 0, -30, 40],
    cam: mv([-5.5, 1.2, -22.5], [7.5, 5, -30.5], [-5.0, 1.2, -23.5], [7.5, 8.5, -30.5], { fov: 64, roll: [8, 5], ease: 'io' }),
    act: (S) => { S.mon({ a: 'stop', pos: MONSTEP, ry: -0.05, eye: 1, glow: 0.4 }); S.lights([[2.5, 3.2, -30.5, '#ffdca0', 30, 16]]); } },
  { id: 'sinks', t: 'Then slowly, it sinks back down.', env: 'storm', flash: [0.3, 1.5], sh: [5, 0, -15, 110],
    cam: push([-15, 5, 8], [14, 19, -54], 0.08, { fov: 52, roll: -3 }),
    act: (S, u, tl, T) => { const k = ss(0, 0.95, u); S.mon({ a: 'stop', b: 'sit', k, pos: V(MONSTEP, MON, ss(0, 0.6, u)), ry: L(-0.05, -0.2, k), eye: 1 - 0.4 * k, glow: pulse(T, 80) * (1 - k * 0.6) }); } },
  { id: 'closes', t: 'The eye closes.', env: 'storm', sh: [16, 30, -55, 30],
    cam: push([4, -8, 18], [0, 0, 0], 0.2, { fov: 36, roll: 5, anchor: 'eye' }),
    act: (S, u) => { S.mon({ a: 'sit', b: 'stir', k: 0.3, eye: 1 - ss(0.15, 0.8, u) }); } },
  { id: 'slows', t: 'Under her hand, the heartbeat slows.', env: 'storm', hb: { bpm: 52 }, sh: [0, 20, 0, 13], fill: WARM,
    cam: handCam(0.1, { fov: 44, roll: 3 }),
    act: (S, u, tl, T) => { tobSit(S, { head: [-0.5, 0.2], face: 'neutral' }); minaHand(S); const a = hb(T, 52); S.rip(...HAND, a, '#ffb040', 2.0); S.rip(...HAND, a - 0.22, '#ff8a30', 1.3); S.lights([LANT]); S.mon({ a: 'sit', glow: pulse(T, 52) * 0.7 }); } },
  { id: 'smiles', t: 'Tobias smiles.', env: 'storm', sh: [0, 20, 0, 13], fill: WARM,
    cam: tobCam(2.4, { fov: 32, roll: 4 }, 0.25),
    act: (S) => { tobSit(S, { head: [-0.4, -0.05], face: 'smile' }); minaN(S, { face: 'smile' }); S.lights([LANT]); } },

  // ---------------------------------------------------------------- cliffhanger
  { id: 'but', t: 'But Mina counts everything.', env: 'storm', sh: [0, 20, 0, 13], fill: WARM,
    cam: minaCam(2.7, { fov: 32, roll: -5 }, 0.3, snapIn),
    act: (S, u) => { minaN(S, { face: u < 0.45 ? 'smile' : 'neutral', head: [0, 0.3 * ss(0.4, 0.8, u)] }); S.lights([LANT]); } },
  { id: 'under', t: 'And under her hand,', env: 'storm', hb: { bpm: 52 }, hb2: { bpm: 96 }, sh: [0, 20, 0, 13], fill: WARM,
    cam: push([-0.45, 19.85, 1.5], [0.18, 19.62, -0.62], 0.22, { fov: 48, roll: [-8, -14] }),
    act: (S, u, tl, T) => { minaHand(S, { face: 'worried', head: [0.3, 0.5] }); tobSit(S, { head: [-0.5, 0.2], face: 'smile' }); S.rip(...HAND, hb(T, 52), '#ffb040', 1.9); S.rip(...HAND, hb(T, 96), '#ff2a18', 2.5, 0.6); S.lights([LANT]); } },
  { id: 'two', t: 'she counts two heartbeats.', env: 'storm', flash: [0.05], hb: { bpm: 52 }, hb2: { bpm: 100 }, sh: [0, 20, 0, 13], fill: WARM,
    cam: minaCam(2.6, { fov: 28, roll: 7 }, 0.38, snapIn),
    act: (S, u, tl) => { minaN(S, { face: 'scared' }); S.lights([LANT]); S.num(2, -0.35, 20.95, -1.5, 0.42, tl - 0.55, '#ff5038'); } },
  { id: 'onehill', t: 'One on the hill.', env: 'storm', flash: [0.2], hb: { bpm: 52 },
    cam: push([-12, 8, -2], [15, 22, -58], 0.1, { fov: 44, roll: -4 }),
    act: (S, u, tl, T) => { S.mon({ a: 'sit', glow: pulse(T, 52) }); S.num(1, 3, 33, -56, 5, tl - 0.1, '#ffb040'); } },
  { id: 'underneath', t: 'And one right underneath the town.', env: 'storm', hb2: { bpm: 110 }, sh: [0, 0, 0, 80],
    cam: mv([0, 62, 30], [0, 0, 2], [0, 92, 34], [0, 0, 2], { fov: 46, roll: [10, 22], ease: 'out' }),
    act: (S, u, tl, T) => { S.cracks(pulse(T, 110) * ss(0, 0.25, u), 0.25 + 0.5 * ss(0, 1, u)); S.num(2, 0, 34, 0, 9, tl - 0.5, '#ff5038'); S.lights([[0, 6, 0, '#ff3010', 200 * pulse(T, 110), 60]]); } },
  { id: 'thatone', t: 'And that one', env: 'storm', hb2: { bpm: 140 }, sh: [0, 0, 0, 100],
    cam: mv([0, 92, 34], [0, 0, 2], [0, 135, 44], [0, 0, 0], { fov: 46, roll: [22, 30] }),
    act: (S, u, tl, T) => { S.cracks(pulse(T, 140), 0.75 + 0.25 * u); S.lights([[0, 6, 0, '#ff3010', 240 * pulse(T, 140), 70]]); } },
  { id: 'faster', t: 'is getting faster.', env: 'storm', flash: [1.05], hb2: { bpm: 190 }, sh: [0, 20, 0, 13], fill: ['#ff5030', 0.5],
    cam: snapIn([-0.3, 20.35, -7.0], [-0.38, 20.3, -2.1], 0.14, { fov: 40, roll: [-6, -10] }),
    act: (S, u, tl, T) => { const p = pulse(T, 190); S.tob.at(-0.9, 19.3, -2.0, TOB_RY).set({ sit: true, face: 'scared', head: [0, 0.35] }); S.mina.at(0.15, 19.3, -2.25, PI - 0.1).set({ face: 'scared', head: [0, 0.4], armL: [-1.3, 0.2], armR: [-1.3, 0.2] }); S.cracks(p, 1); S.lights([[0, 12, -7, '#ff3010', 260 * p + 20, 30], LANT]); } },
  { id: 'end', t: null, dur: 1.5, env: 'black', hb2: { bpm: 190 }, cam: () => ({ p: [0, 0, 0], l: [0, 0, -1], fov: 45 }) },
];
