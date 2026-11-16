// "In this town, everyone has a number above their head." One entry per shot.
// `t` is the narration line (null = silent beat). No imports, so node tools can load it too.
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
  return (u, tl) => { const k = e(u, tl); return { p: V(p0, p1, k), l: V(l0, l1, k), fov: Array.isArray(f) ? L(f[0], f[1], k) : f, roll: Array.isArray(r) ? L(r[0], r[1], k) : r }; };
}
const push = (p, l, k = 0.1, o = {}) => mv(p, l, V(p, l, k), l, o);
const snapIn = (p, l, k = 0.3, o = {}) => mv(p, l, V(p, l, k), l, { ...o, ease: 'snap' });
const faceTo = (a, b) => Math.atan2(b[0] - a[0], b[2] - a[2]);

export const CONFIG = { monster: false, board: ['TOP FRIENDS', '1. THE MAYOR  412', '2. IVY  87', 'how many do you have?'] };
export const MON = [16, 11.2, -64];
export function stairPos(s) {
  const Ls = 3.8, per = 4 * Ls, k = ((s % per) + per) % per, side = Math.floor(k / Ls), f = k - side * Ls, h = 1.9;
  let x, z, ry;
  if (side === 0) { x = -h + f; z = h; ry = PI / 2; } else if (side === 1) { x = h; z = h - f; ry = PI; } else if (side === 2) { x = h - f; z = -h; ry = -PI / 2; } else { x = -h; z = -h + f; ry = 0; }
  return [300 + x, s * 0.33, z, ry];
}

const GOLD = '#ffd54a', RED = '#ff5038', GRN = '#7dff8a', WH = '#ffffff', GREY = '#c9d4e6';
const WARM = ['#ffd9b0', 1.5];
const LANT = [-1.7, 22.3, 1.7, '#ffb060', 30, 16];
const AFTER = [1, 0, 2, 1, 0, 1, 3, 0, 1, 2, 0, 1, 1];           // the town's numbers the morning after
const NUMS19 = [23, 41, 9, 15, 30, 12, 34, 8, 51, 17, 3, 26, 12, 44, 9, 61, 15, 29, 6];

const sam = (S, x, y, z, ry, o = {}, tag = '0', col = WH, size = 1, age = 1) => { S.sam.at(x, y, z, ry).set(o); if (tag !== null) S.tag(S.sam, tag, col, size, age); return S.sam; };
const ivy = (S, x, y, z, ry, o = {}, tag = 87, col = GOLD, size = 1, age = 1) => { S.ivy.at(x, y, z, ry).set(o); if (tag !== null) S.tag(S.ivy, tag, col, size, age); return S.ivy; };
// the crowd at the foot of the tower
function base(S, T, { back = 0, cheer = 0, up = 0, run = 0, nums } = {}) {
  [...S.kids, ...S.folk].forEach((c, j) => {
    const a = (-1 + 2 * j / 18) * 1.15, row = j % 3, r = 4.8 + row * 1.3 + back * 2.8;
    const x = Math.sin(a) * r, z = 3.5 + Math.cos(a) * r + run * (12 + row * 2);
    c.at(x, 0, z, run > 0.05 ? (j % 2 ? 0.3 : -0.3) : Math.atan2(-x, 3 - z));
    if (run > 0.05) c.walk(T * 13 + j, 0.95).set({ lean: 0.25, face: 'scared' });
    else c.set({ head: [0, -0.75 * up], armL: cheer ? [-2.7 + Math.sin(T * 9 + j) * 0.3, 0.3] : [0, 0.08], armR: cheer ? [-2.7 + Math.cos(T * 9 + j) * 0.3, 0.3] : [0, 0.08], face: cheer ? 'happy' : up ? 'scared' : 'neutral', dy: cheer ? Math.abs(Math.sin(T * 7 + j)) * 0.12 : 0 });
    const n = nums ? nums(j) : [NUMS19[j], WH]; if (n) S.tag(c, n[0], n[1]);
  });
}
const HANG = [0.9, 17.98, 3.62];
const hang = (S, tl, o = {}, tag = 87, col = GOLD, size = 1, age = 1) => ivy(S, ...HANG, PI, { armL: [-3.05, 0.05], armR: [-0.2, 0.3], legL: Math.sin(tl * 7) * 0.35, legR: -Math.sin(tl * 7) * 0.35, head: [0, -0.7], face: 'scared', ...o }, tag, col, size, age);
const bedCam = (o, k = 0.12) => push([6.6, 6.35, 41.45], [8.85, 4.2, 41.45], k, o);
// bench in the park (second bench): seat faces south-west
const BX = [0.955, 0, 0.296], BF = [-0.30, 0, 0.955], BC = [12, 0.44, 31];
const bench = (k) => [BC[0] + BX[0] * k, BC[1], BC[2] + BX[2] * k];
const benchCam = (d, h, o, k = 0.1, fn = push) => fn([BC[0] + BF[0] * d, h, BC[2] + BF[2] * d], [12, 1.2, 31], k, o);
// belfry, after the rescue
const SAMB = [-1.3, 19.3, 0.9], IVYB = [-0.15, 19.3, 1.15];
const fallCount = (tl, a, b, rate) => Math.max(b, Math.round(a - tl * rate));

export const SHOTS = [
  // ---------------------------------------------------------------- the rule
  { id: 'rule1', t: 'In this town,', env: 'day', crowd: true, cam: mv([-34, 44, 112], [5, 12, -12], [-24, 31, 86], [5, 13, -14], { fov: 46, ease: 'out' }) },
  { id: 'rule2', t: 'everyone has a number above their head.', env: 'day', crowd: true, cam: push([-0.5, 1.7, 13.8], [-6.0, 2.0, 7.0], 0.14, { fov: 46, roll: 2 }) },
  { id: 'counts', t: 'It counts your friends.', env: 'day',
    cam: snapIn([3.7, 1.7, 16.2], [3.7, 1.75, 9.5], 0.14, { fov: 46, roll: -3 }),
    act: (S, u, tl, T) => { S.folk[0].at(3.0, 0, 9.5, PI / 2).set({ armR: [-2.5 + Math.sin(T * 12) * 0.3, 0.3], face: 'happy' }); S.tag(S.folk[0], 12); S.folk[9].at(4.4, 0, 9.5, -PI / 2).set({ armL: [-2.5 + Math.cos(T * 12) * 0.3, 0.3], face: 'happy' }); S.tag(S.folk[9], 30); } },
  { id: 'up', t: 'Make a friend, it goes up.', env: 'day', sfx: [['up', 0.75]],
    cam: push([3.7, 1.8, 15.0], [3.7, 1.9, 9.5], 0.1, { fov: 44, roll: 4 }),
    act: (S, u, tl, T) => { const a = tl - 0.75; S.folk[0].at(3.0, 0, 9.5, PI / 2).set({ armR: [-1.6, 0.2], face: 'happy' }); S.folk[9].at(4.4, 0, 9.5, -PI / 2).set({ armL: [-1.6, 0.2], face: 'happy' }); S.tag(S.folk[0], a > 0 ? 13 : 12, a > 0 ? GRN : WH, 1, a > 0 ? a : 1); S.tag(S.folk[9], a > 0 ? 31 : 30, a > 0 ? GRN : WH, 1, a > 0 ? a : 1); } },
  { id: 'down', t: 'Lose one, it goes down.', env: 'day', sfx: [['down', 0.6]],
    cam: push([3.7, 1.8, 15.4], [3.7, 1.9, 9.5], 0.08, { fov: 46, roll: -5 }),
    act: (S, u, tl) => { const a = tl - 0.6; S.folk[0].at(L(3.0, 2.6, ss(0.3, 1, u)), 0, 9.5, -PI / 2).set({ face: 'worried', head: [0, 0.2] }); S.folk[9].at(L(4.4, 4.8, ss(0.3, 1, u)), 0, 9.5, PI / 2).set({ face: 'worried', head: [0, 0.2] }); S.tag(S.folk[0], a > 0 ? 12 : 13, a > 0 ? RED : WH, 1, a > 0 ? a : 1); S.tag(S.folk[9], a > 0 ? 30 : 31, a > 0 ? RED : WH, 1, a > 0 ? a : 1); } },
  { id: 'read', t: 'People read your number before your face.', env: 'day', crowd: true,
    cam: push([1.7, 1.3, 12.6], [0.5, 2.0, 9.0], 0.14, { fov: 42, roll: 3 }),
    act: (S, u, tl, T) => { S.folk[5].at(0.5, 0, 9.0, 0.25).set({ head: [0.3 * Math.sin(T * 1.3), -0.4], face: 'neutral' }); S.tag(S.folk[5], 26); } },
  { id: 'seats', t: 'High numbers get the best seats.', env: 'day',
    cam: push([12.9, 1.25, 25.4], [11.5, 1.35, 22], 0.12, { fov: 44, roll: -2 }),
    act: (S, u, tl, T) => { S.folk[9].at(11.09, 0.42, 22.18, 0.4).set({ sit: true, face: 'happy', head: [-0.4, 0], armL: [-0.6 + Math.sin(T * 6) * 0.2, 0.3] }); S.tag(S.folk[9], 61, GOLD); S.folk[2].at(11.91, 0.42, 21.82, 0.4).set({ sit: true, face: 'happy', head: [0.4, 0] }); S.tag(S.folk[2], 58, GOLD); } },
  { id: 'alone', t: 'Low numbers eat alone.', env: 'day',
    cam: benchCam(4.6, 1.25, { fov: 42, roll: 3 }, 0.12),
    act: (S) => { S.folk[4].at(...bench(0), -0.3).set({ sit: true, face: 'sad', head: [0, 0.3] }); S.tag(S.folk[4], 2, GREY); } },
  { id: 'mayor', t: 'The mayor has four hundred and twelve.', env: 'day', crowd: true,
    cam: snapIn([1.7, 1.0, 13.2], [0.45, 2.0, 9.0], 0.18, { fov: 46, roll: 4 }),
    act: (S, u, tl, T) => { S.mayor.at(0.5, 0, 9.0, 0.2).set({ face: 'happy', armL: [-2.4 + Math.sin(T * 5) * 0.2, 0.5], head: [Math.sin(T) * 0.1, -0.05] }); S.tag(S.mayor, 412, GOLD, 1.25); S.folk[10].at(-12, 0, 20, 0); S.folk[11].at(-13, 0, 20, 0); S.folk[12].at(-14, 0, 20, 0); } },
  { id: 'ivy', t: 'His daughter Ivy has eighty-seven.', env: 'day',
    cam: snapIn([0.5, 0.62, 34.0], [1.0, 1.2, 30], 0.24, { fov: 46, roll: -4 }),
    act: (S, u, tl, T) => { ivy(S, 0.8, 0, 30, -0.05, { face: 'happy', head: [Math.sin(T * 1.2) * 0.1, -0.08], armL: [0, 0.5], armR: [0, 0.5] }); } },
  { id: 'most', t: 'More than any kid in town.', env: 'day',
    cam: push([-0.6, 1.15, 13.6], [-5.0, 1.25, 8.6], 0.14, { fov: 48, roll: 2 }),
    act: (S, u, tl, T) => { ivy(S, -4.6, 0, 9.2, 0.75, { face: 'happy', armR: [-2.6 + Math.sin(T * 8) * 0.2, 0.4] }); [[-6.6, 10.2, 12], [-6.1, 8.0, 9], [-3.4, 7.4, 23], [-2.4, 8.8, 15], [-5.0, 7.2, 30]].forEach(([x, z, n], i) => { const c = S.kids[i]; c.at(x, 0, z, faceTo([x, 0, z], [-4.6, 0, 9.2])).set({ face: 'happy', armL: [-2.6 + Math.sin(T * 9 + i) * 0.3, 0.3], dy: Math.abs(Math.sin(T * 6 + i)) * 0.1 }); S.tag(c, n); }); } },

  // ---------------------------------------------------------------- Sam
  { id: 'sam', t: "And then there's Sam.", env: 'day',
    cam: snapIn([0.5, 0.62, 34.0], [1.05, 1.15, 30], 0.26, { fov: 46, roll: 5 }),
    act: (S, u, tl, T) => { sam(S, 0.8, 0, 30, -0.05, { face: 'smile', head: [Math.sin(T * 1.2) * 0.1, -0.05], armL: [0, 0.12], armR: [0, 0.12] }); S.dog.at(1.55, 0, 30.3, -0.2).sit(T); } },
  { id: 'zero', t: "Sam's number is zero.", env: 'day', sfx: [['down', 0.1]],
    cam: snapIn([0.95, 0.7, 32.4], [0.8, 1.5, 30], 0.3, { fov: 36, roll: -6 }),
    act: (S, u, tl) => { sam(S, 0.8, 0, 30, -0.05, { face: 'neutral', head: [0, -0.3] }, '0', WH, 1.3, tl); } },
  { id: 'life', t: 'It has been zero his whole life.', env: 'day', crowd: true,
    cam: mv([1.5, 1.0, 39.6], [-1.6, 1.5, 35.4], [1.7, 1.0, 40.4], [-1.6, 1.5, 36.4], { fov: 56, roll: -3 }),
    act: (S, u, tl, T) => { const z = L(36.2, 37.8, u); sam(S, -0.2, 0, z, 0.1, { face: 'neutral', head: [0, 0.15] }).walk(T * 7, 0.5); S.dog.at(-0.95, 0, z - 0.5, 0.1).run(T * 11, 0.6); } },
  { id: 'hello', t: 'Every morning, he says hello to everyone.', env: 'day',
    cam: mv([3.4, 1.4, 13.6], [3.2, 1.2, 8.0], [3.9, 1.4, 13.2], [3.7, 1.2, 8.0], { fov: 44, roll: -3 }),
    act: (S, u, tl, T) => { const x = L(1.2, 3.4, u); S.folk[1].at(x, 0, 8.9, PI / 2).walk(T * 5.2, 0.5); S.tag(S.folk[1], 44); sam(S, 4.3, 0, 7.0, faceTo([4.3, 0, 7.0], [x, 0, 8.9]), { armR: [-2.6 + Math.sin(T * 14) * 0.3, 0.35], face: 'happy' }); S.dog.at(5.0, 0, 7.2, -0.8).sit(T); } },
  { id: 'noone', t: 'Nobody says it back.', env: 'day',
    cam: push([3.4, 0.95, 9.9], [4.3, 1.25, 7.0], 0.16, { fov: 38, roll: 4 }),
    act: (S, u) => { sam(S, 4.3, 0, 7.0, -0.3, { armR: [L(-2.4, -0.2, ss(0, 0.7, u)), 0.3], face: u < 0.4 ? 'smile' : 'sad', head: [0, 0.2 * ss(0.3, 1, u)] }); } },
  { id: 'lookup', t: 'They look up.', env: 'day',
    cam: snapIn([3.7, 1.35, 7.4], [2.4, 1.75, 8.9], 0.2, { fov: 36, roll: -5 }),
    act: (S, u, tl, T) => { S.folk[1].at(2.4, 0, 8.9, faceTo([2.4, 0, 8.9], [4.3, 0, 7.0])).set({ head: [0, -0.45], face: 'neutral' }); S.tag(S.folk[1], 44); } },
  { id: 'see', t: 'They see the zero.', env: 'day',
    cam: snapIn([3.9, 0.55, 9.2], [4.3, 1.6, 7.0], 0.25, { fov: 32, roll: 6 }),
    act: (S, u, tl) => { sam(S, 4.3, 0, 7.0, -0.2, { face: 'smile' }, '0', WH, 1.4, tl); } },
  { id: 'walk', t: 'And they keep walking.', env: 'day',
    cam: push([6.2, 1.5, 5.4], [2.6, 1.0, 8.6], 0.08, { fov: 46, roll: -3 }),
    act: (S, u, tl, T) => { S.folk[1].at(L(2.4, -0.6, u), 0, L(8.9, 10.4, u), -1.1).walk(T * 6, 0.6); S.tag(S.folk[1], 44); sam(S, 4.3, 0, 7.0, -1.0, { face: 'sad', head: [0, 0.25] }); S.dog.at(5.0, 0, 7.2, -0.8).sit(T); } },
  { id: 'night1', t: 'So Sam does his kind things at night,', env: 'late', fill: WARM,
    cam: (u) => { const z = L(36, 33.4, u); return { p: [4.6, 0.9, z - 1.4], l: [0.4, 0.75, z - 0.4], fov: 46, roll: -4 }; },
    act: (S, u, tl, T) => { const z = L(36, 33.4, u); sam(S, 0.4, 0, z, PI, { armL: [-1.3, 0.1], armR: [-1.3, 0.1], face: 'smile' }).walk(T * 6, 0.4); S.sam.set({ armL: [-1.3, 0.1], armR: [-1.3, 0.1] }); S.prop(0.4, 0.62, z - 0.32); S.dog.at(1.2, 0, z + 0.5, PI).run(T * 10, 0.5); S.lights([[-3.7, 4, 36, '#ffdca0', 14, 16], [-3.7, 4, 24, '#ffdca0', 14, 16]]); } },
  { id: 'unseen', t: 'when nobody can see who did them.', env: 'late', fill: WARM, sh: [5, 0, -30, 20],
    cam: push([1.2, 0.9, -27.6], [4.5, 0.75, -30.5], 0.14, { fov: 40, roll: 5 }),
    act: (S, u, tl, T) => { sam(S, 4.15, 0, -30.5, PI / 2, { lean: 0.6 * ss(0, 0.5, u), armL: [-1.1, 0.1], armR: [-1.1, 0.1], face: 'smile' }); S.prop(4.75, L(0.6, 0.24, ss(0, 0.5, u)), -30.5); S.dog.at(4.5, 0, -32.1, 0.3).sit(T); S.lights([[2.8, 3.0, -30.5, '#ffdca0', 22, 14]]); } },
  { id: 'bed', t: 'Then he lies in bed, and looks up.', env: 'late', sh: [8.5, 4, 43, 14], fill: WARM,
    cam: bedCam({ fov: 44, roll: [5, 1] }),
    act: (S, u, tl) => { S.blanket(true); sam(S, 7.75, 4.02, 41.45, -PI / 2, { lie: true, face: 'up' }, null); S.lights([[10.5, 4.9, 41.8, '#ffb060', 6, 9]]); } },
  { id: 'still0', t: 'Still zero.', gap: 0.2, env: 'late', sh: [8.5, 4, 43, 14], fill: WARM,
    cam: snapIn([7.3, 6.1, 41.45], [8.9, 4.4, 41.45], 0.12, { fov: 42, roll: -5 }),
    act: (S, u, tl) => { S.blanket(true); S.sam.at(7.75, 4.02, 41.45, -PI / 2).set({ lie: true, face: 'sad' }); S.num('0', 8.9, 4.72, 41.45, 0.36, tl, WH); S.lights([[10.5, 4.9, 41.8, '#ffb060', 6, 9]]); } },

  // ---------------------------------------------------------------- the dare
  { id: 'storm', t: 'But one night, a storm rolled in,', env: 'storm', flash: [0.25, 1.5],
    cam: mv([-2.8, 2.2, 66], [3, 15, 0], [-2.6, 2.4, 58], [3.5, 16, 0], { fov: 54, roll: [4, 7] }),
    act: (S) => { S.lights([[9, 5.6, 43, '#ffb060', 40, 16], [-1.7, 22.3, 1.7, '#ffb060', 60, 22], [-3.7, 4.2, 48, '#ffdca0', 12, 14]]); } },
  { id: 'dare', t: 'and Ivy took a dare.', env: 'storm', fill: WARM,
    cam: push([3.4, 0.95, 11.2], [0.2, 1.2, 7.6], 0.14, { fov: 46, roll: -4 }),
    act: (S, u, tl, T) => { ivy(S, 0.2, 0, 7.4, 0.6, { face: 'happy', armR: [-0.3, 0.9], armL: [-0.3, 0.9] }); [[-1.5, 7.0, 12], [-0.9, 8.7, 9], [1.5, 6.3, 23]].forEach(([x, z, n], i) => { const c = S.kids[i]; c.at(x, 0, z, faceTo([x, 0, z], [0.2, 0, 7.4])).set({ face: 'happy', armR: i === 0 ? [-2.5, 0.2] : [0, 0.1], head: [0, i === 0 ? -0.5 : 0] }); S.tag(c, n); }); S.lights([[0, 3.2, 5, '#ffdca0', 10, 10]]); } },
  { id: 'climb', t: 'Climb the tower. Touch the bell.', env: 'storm', flash: [0.9],
    cam: mv([0.6, 1.2, 23], [0, 12, 0], [0.5, 1.2, 21], [0, 21, 0], { fov: 62, roll: [-10, -6], ease: 'io' }), act: (S) => { S.lights([LANT]); } },
  { id: 'cheer', t: 'Eighty-seven friends cheered her on.', env: 'storm', fill: WARM,
    cam: push([0, 3.4, 3.6], [0, 1.3, 9.2], 0.08, { fov: 62, roll: 4 }),
    act: (S, u, tl, T) => { base(S, T, { cheer: 1 }); S.lights([[0, 4, 6, '#ffdca0', 40, 18]]); } },
  { id: 'hit', t: 'Then the lightning hit.', env: 'storm', flash: [0.55], sh: [0, 20, 0, 13], fill: WARM,
    cam: snapIn([0.9, 21.0, 9.5], [0.3, 20.6, 1.5], 0.18, { fov: 38, roll: 6 }),
    act: (S, u, tl) => { const k = ss(0.55, 0.9, tl); ivy(S, 0.6, 19.3, L(1.3, 2.3, k), PI * (1 - k * 0.15), { armR: [-2.8, 0.2], armL: [k * -1.5, 0.6 * k], face: k > 0.1 ? 'scared' : 'happy', lean: -0.5 * k }, 87, GOLD); S.lights([LANT, [0, 22, 0, '#cfdcff', 300 * Math.exp(-Math.max(0, tl - 0.55) * 6) * (tl > 0.55 ? 1 : 0), 20]]); } },
  { id: 'ledge', t: 'And Ivy was hanging from the ledge by one hand.', env: 'storm', flash: [1.6], sfx: [['down', 0.2]],
    cam: mv([10.5, 17.2, 7.5], [0.9, 18.5, 3.6], [9.2, 17.6, 6.6], [0.9, 18.7, 3.6], { fov: 36, roll: [5, 9] }),
    act: (S, u, tl) => { hang(S, tl); S.lights([LANT, [3, 18, 7, '#cfdcff', 30, 14]]); } },
  { id: 'scream', t: 'She screamed for help.', env: 'storm', flash: [0.2], fill: WARM,
    cam: snapIn([0.9, 20.9, 2.5], [0.9, 19.05, 3.62], 0.16, { fov: 44, roll: -8 }),
    act: (S, u, tl) => { hang(S, tl, { face: 'shout', head: [0, -0.9] }, null); S.lights([LANT]); } },
  { id: 'looked', t: 'Eighty-seven friends looked up.', env: 'storm',
    cam: push([0.4, 19.9, 4.4], [0, 0, 9.4], 0.03, { fov: 58, roll: 5 }),
    act: (S, u, tl, T) => { hang(S, tl, {}, null); base(S, T, { up: 1 }); S.lights([[0, 5, 8, '#ffdca0', 60, 22]]); } },
  { id: 'back', t: 'And every single one took a step back.', env: 'storm', fill: WARM,
    cam: push([-8.5, 0.7, 9.5], [0, 1.3, 10], 0.04, { fov: 52, roll: -5 }),
    act: (S, u, tl, T) => { base(S, T, { up: 1, back: ss(0.2, 0.9, u) }); S.lights([[0, 4, 8, '#ffdca0', 40, 20]]); } },
  { id: 'fall', t: 'Her number started to fall.', env: 'storm', fill: WARM, sfx: [['tickdown', 0.3, 1.2]],
    cam: push([3.4, 18.6, 8.6], [0.9, 19.3, 3.62], 0.12, { fov: 30, roll: 4 }),
    act: (S, u, tl) => { const n = fallCount(Math.max(0, tl - 0.3), 87, 61, 22); hang(S, tl, {}, n, n < 87 ? RED : GOLD, 1.2); S.lights([LANT]); } },
  { id: 'sixty', t: 'Sixty.', env: 'storm', fill: WARM, sfx: [['down', 0]],
    cam: snapIn([7.2, 18.4, 6.4], [0.9, 19.1, 3.62], 0.18, { fov: 30, roll: -6 }),
    act: (S, u, tl) => { hang(S, tl, {}, 60, RED, 1.3, tl); S.lights([LANT]); } },
  { id: 'thirty', t: 'Thirty.', env: 'storm', sfx: [['down', 0]], sfx2: 1,
    cam: push([0, 1.0, 5.2], [0, 1.2, 14], 0.05, { fov: 56, roll: 6 }),
    act: (S, u, tl, T) => { base(S, T, { run: 0.25 + 0.5 * u, nums: () => null }); S.num(30, 0, 3.6, 12, 3.2, tl, RED); S.lights([[0, 4, 9, '#ffdca0', 40, 20]]); } },
  { id: 'nine', t: 'Nine.', env: 'storm', fill: WARM, sfx: [['down', 0]],
    cam: snapIn([-5.0, 18.6, 6.6], [0.9, 19.1, 3.62], 0.18, { fov: 30, roll: 8 }),
    act: (S, u, tl) => { hang(S, tl, { face: 'shout' }, 9, RED, 1.3, tl); S.lights([LANT]); } },
  { id: 'zero2', t: 'Zero.', gap: 0.05, env: 'storm', flash: [0.05], fill: WARM, sfx: [['down', 0]],
    cam: snapIn([0.9, 21.3, 2.3], [0.9, 19.45, 3.55], 0.12, { fov: 50, roll: -10 }),
    act: (S, u, tl) => { hang(S, tl, { face: 'scared', head: [0, -0.9] }, '0', RED, 0.8, tl); S.lights([LANT]); } },
  { id: 'empty', t: null, dur: 0.9, env: 'storm',
    cam: push([0.4, 19.9, 4.4], [0, 0, 9.4], 0.03, { fov: 58, roll: -4 }),
    act: (S, u, tl, T) => { hang(S, tl, {}, null); S.lights([[0, 5, 8, '#ffdca0', 60, 22]]); } },

  // ---------------------------------------------------------------- the one who came
  { id: 'onekid', t: 'Only one kid ran toward the tower.', env: 'storm', sfx: [['steps', 0, 6.5]],
    cam: mv([1.6, 0.4, 13.5], [0, 2.5, 5], [1.3, 0.4, 12], [0, 8, 2], { fov: 64, roll: [6, 9] }),
    act: (S, u, tl, T) => { const k = cl(u * 1.1); const z = L(15, 6, k); sam(S, 0, 0, z, PI, { lean: 0.3, face: 'worried' }).walk(T * 15, 1.0); S.dog.at(0.8, 0, z + 0.9, PI).run(T * 18, 1); [0, 1, 2, 3].forEach(i => { const c = S.folk[i]; c.at(-2.2 + i * 1.5, 0, L(9, 20, u) + i * 1.4, i % 2 ? 0.3 : -0.3).walk(T * 13 + i, 0.95).set({ lean: 0.25, face: 'scared' }); }); S.lights([LANT, [0, 3.2, 6, '#ffdca0', 12, 12]]); } },
  { id: 'nofriends', t: 'The kid with no friends at all.', env: 'storm', flash: [0.9], fill: WARM, sfx: [['steps', 0, 6.5]],
    cam: (u) => { const z = L(11, 7.5, u); return { p: [1.3, 0.75, z - 2.3], l: [0, 1.15, z], fov: 46, roll: -6 }; },
    act: (S, u, tl, T) => { const z = L(11, 7.5, u); sam(S, 0, 0, z, PI, { lean: 0.3, face: 'worried' }).walk(T * 15, 1.0); S.dog.at(0.8, 0, z + 0.9, PI).run(T * 18, 1); S.lights([[0, 3.2, 6, '#ffdca0', 12, 12]]); } },
  { id: 'steps212', t: 'Two hundred and twelve steps.', env: 'stairs', sfx: [['steps', 0, 7]],
    cam: (u) => { const s = L(40, 53, u); const [x, y, z] = stairPos(s); return { p: [300.2, y + 7.5, 0.2], l: [300 + (x - 300) * 0.3, y, z * 0.3], fov: 60, roll: L(-10, 30, u) }; },
    act: (S, u, tl, T) => { const s = L(40, 53, u); const [x, y, z, ry] = stairPos(s); sam(S, x, y, z, ry, { lean: 0.25 }).walk(T * 15, 0.9); const [dx, dy, dz, dr] = stairPos(s - 1.3); S.dog.at(dx, dy, dz, dr).run(T * 18, 1); S.lights([[300 + (x - 300) * 0.5, y + 2.4, z * 0.5, '#ffb060', 18, 14], [300, y + 6, 0, '#ffb060', 12, 16]]); } },
  { id: 'nostop', t: "He didn't stop once.", env: 'stairs', sfx: [['steps', 0, 7]],
    cam: (u) => { const s = L(60.2, 63.2, u); const [x, y, z] = stairPos(s); const [x2, y2, z2] = stairPos(s + 2.5); return { p: [300 + (x2 - 300) * 0.55, y2 + 0.55, z2 * 0.75], l: [x, y + 1.05, z], fov: 46, roll: 7 }; },
    act: (S, u, tl, T) => { const s = L(60.2, 63.2, u); const [x, y, z, ry] = stairPos(s); sam(S, x, y, z, ry, { lean: 0.2, face: 'worried' }).walk(T * 15, 0.9); S.lights([[300 + (x - 300) * 0.4, y + 2.4, z * 0.4, '#ffb060', 14, 12]]); } },
  { id: 'wrist', t: 'He grabbed her wrist,', env: 'storm', flash: [0.3], sh: [0, 20, 0, 13], fill: WARM,
    cam: snapIn([3.6, 20.2, 7.4], [0.9, 19.5, 3.1], 0.2, { fov: 34, roll: 7 }),
    act: (S, u, tl) => { hang(S, tl, { face: 'scared' }, '0', RED); sam(S, 0.9, 19.3, 2.3, 0, { lean: 1.0, armL: [-1.5, 0.1], armR: [-1.5, 0.1], face: 'pain', head: [0, -0.5] }); S.lights([LANT]); } },
  { id: 'pulled', t: 'and pulled with everything he had.', env: 'storm', sh: [0, 20, 0, 13], fill: WARM,
    cam: push([-1.6, 20.3, 6.6], [0.9, 19.7, 2.9], 0.16, { fov: 32, roll: -7 }),
    act: (S, u, tl) => { const k = ss(0.1, 1, u); S.ivy.at(HANG[0], HANG[1] + 0.75 * k, HANG[2] - 0.25 * k, PI).set({ armL: [-3.05, 0.05], armR: [-2.6, 0.2], legL: Math.sin(tl * 9) * 0.4, legR: -Math.sin(tl * 9) * 0.4, head: [0, -0.7], face: 'scared' }); S.tag(S.ivy, '0', RED); sam(S, 0.9, 19.3, 2.3 - 0.3 * k, 0, { lean: 1.0 - 0.7 * k, armL: [-1.5 - 0.6 * k, 0.1], armR: [-1.5 - 0.6 * k, 0.1], face: 'pain', head: [0, -0.4] }); S.lights([LANT]); } },
  { id: 'tumble', t: null, dur: 1.0, env: 'storm', flash: [0.1], sh: [0, 20, 0, 13], fill: WARM, sfx: [['stomp', 0.15]],
    cam: push([0.9, 20.6, 4.6], [-0.7, 19.9, 1.0], 0.1, { fov: 50, roll: 5 }),
    act: (S, u, tl, T) => { sam(S, ...SAMB, PI / 2, { sit: true, face: 'pain', lean: -0.2, head: [0, -0.2] }); ivy(S, ...IVYB, -PI / 2, { sit: true, face: 'scared', lean: -0.15 }, '0', RED); S.dog.at(-0.8, 19.3, 2.0, PI).sit(T); S.lights([LANT]); } },
  { id: 'above', t: 'Ivy looked at the space above his head.', env: 'storm', sh: [0, 20, 0, 13], fill: WARM,
    cam: push([-1.7, 20.0, 0.55], [-0.15, 20.2, 1.15], 0.16, { fov: 38, roll: 4 }),
    act: (S, u) => { ivy(S, ...IVYB, -PI / 2, { sit: true, face: 'wide', head: [0, -0.35 * ss(0, 0.6, u)] }, '0', RED); S.lights([LANT]); } },
  { id: 'still1', t: 'Still zero.', env: 'storm', sh: [0, 20, 0, 13], fill: WARM,
    cam: snapIn([0.6, 19.8, 1.4], [-1.3, 20.4, 0.9], 0.12, { fov: 44, roll: -5 }),
    act: (S, u, tl) => { sam(S, ...SAMB, PI / 2, { sit: true, face: 'smile' }, '0', WH, 0.9, tl); S.lights([LANT]); } },
  { id: 'own', t: 'Then she looked at her own.', env: 'storm', sh: [0, 20, 0, 13], fill: WARM,
    cam: push([-1.5, 19.7, 0.4], [-0.15, 20.45, 1.15], 0.12, { fov: 42, roll: 6 }),
    act: (S, u, tl) => { ivy(S, ...IVYB, -PI / 2, { sit: true, face: 'wide', head: [0, -0.6] }, (Math.floor(tl * 12) % 2) ? '0' : ' ', RED, 1.2); S.lights([LANT]); } },
  { id: 'one', t: 'One.', gap: 0.3, env: 'storm', sh: [0, 20, 0, 13], fill: WARM, sfx: [['up', 0.05]],
    cam: snapIn([-1.9, 19.6, 0.2], [-0.15, 20.5, 1.15], 0.15, { fov: 42, roll: -4 }),
    act: (S, u, tl) => { ivy(S, ...IVYB, -PI / 2, { sit: true, face: 'happy', head: [0, -0.6] }, 1, GRN, 1.0, tl); S.lights([LANT]); } },

  // ---------------------------------------------------------------- the morning after
  { id: 'morning', t: 'By morning, the whole town had changed.', env: 'day', crowd: true, cn: (i) => [AFTER[i], GREY],
    cam: push([-0.5, 1.7, 13.8], [-6.0, 2.0, 7.0], 0.12, { fov: 46, roll: -2 }) },
  { id: 'mayor412', t: "The mayor's four hundred and twelve?", env: 'day', sfx: [['tickdown', 0.2, 1.3]],
    cam: push([1.7, 1.0, 13.2], [0.45, 2.0, 9.0], 0.14, { fov: 46, roll: -4 }),
    act: (S, u, tl) => { const n = Math.max(3, Math.round(412 * Math.pow(1 - ss(0.1, 0.95, u), 2.2))); S.mayor.at(0.5, 0, 9.0, 0.2).set({ face: 'worried', head: [0, -0.4] }); S.tag(S.mayor, n, n < 412 ? RED : GOLD, 1.25); } },
  { id: 'three', t: 'Three.', env: 'day', sfx: [['down', 0]],
    cam: snapIn([1.2, 1.2, 12.0], [0.45, 2.15, 9.0], 0.25, { fov: 38, roll: 6 }),
    act: (S, u, tl) => { S.mayor.at(0.5, 0, 9.0, 0.2).set({ face: 'worried', head: [0, 0.25] }); S.tag(S.mayor, 3, RED, 1.4, tl); } },
  { id: 'never', t: 'Because the number never counted the friends you have.', env: 'day', crowd: true, cn: (i) => [AFTER[i], GREY],
    cam: snapIn([-2.3, 1.95, 12.9], [-6.45, 1.95, 6.6], 0.25, { fov: 54, roll: 5 }),
    act: (S) => { [10, 11, 12].forEach((i, j) => S.folk[i].at(-14 - j, 0, 22, 0)); } },
  { id: 'come', t: 'It counts the ones who would come for you.', env: 'storm', flash: [0.4], sh: [0, 20, 0, 13], fill: WARM,
    cam: push([3.4, 20.1, 7.0], [0.9, 19.5, 3.1], 0.18, { fov: 32, roll: -6 }),
    act: (S, u, tl) => { hang(S, tl, { face: 'scared' }, null); sam(S, 0.9, 19.3, 2.3, 0, { lean: 1.0, armL: [-1.5, 0.1], armR: [-1.5, 0.1], face: 'pain', head: [0, -0.5] }, null); S.lights([LANT]); } },
  { id: 'samzero', t: "And Sam's was still zero.", env: 'day',
    cam: benchCam(3.8, 1.1, { fov: 42, roll: 3 }, 0.1),
    act: (S, u, tl, T) => { sam(S, ...bench(-0.35), -0.3, { sit: true, face: 'neutral', head: [0, 0.2] }); S.dog.at(11.0, 0, 31.9, 0.9).sit(T, 0.5); } },
  { id: 'needed', t: 'Because nobody had ever come for Sam.', env: 'day',
    cam: push([10.8, 0.95, 33.2], [11.67, 1.25, 30.9], 0.16, { fov: 36, roll: -4 }),
    act: (S, u, tl, T) => { sam(S, ...bench(-0.35), -0.3, { sit: true, face: 'sad', head: [-0.4, 0.3], armR: [-0.7, 0.2] }); S.dog.at(11.0, 0, 31.9, 0.9).sit(T, 0.6); } },
  { id: 'sat', t: 'Until Ivy sat down next to him.', env: 'day',
    cam: benchCam(3.6, 1.1, { fov: 42, roll: -3 }, 0.12),
    act: (S, u, tl, T) => { sam(S, ...bench(-0.35), -0.3, { sit: true, face: 'wide', head: [0.5, 0] }); const k = ss(0, 0.5, u); ivy(S, ...V([13.6, 0, 31.6], bench(0.38), k), -0.3, k > 0.95 ? { sit: true, face: 'smile', head: [-0.5, 0] } : { face: 'smile' }, 1, GRN); if (k <= 0.95) S.ivy.walk(T * 9, 0.6); S.dog.at(11.0, 0, 31.9, 0.9).sit(T, 0.5); } },
  { id: 'first', t: 'And for the first time in his life,', env: 'day',
    cam: push([11.2, 0.8, 33.4], [11.67, 1.75, 30.9], 0.14, { fov: 34, roll: 5 }),
    act: (S, u, tl) => { sam(S, ...bench(-0.35), -0.3, { sit: true, face: 'wide', head: [0, -0.5] }, (Math.floor(tl * 10) % 3) ? '0' : ' ', WH, 1.3); } },
  { id: 'moved', t: "Sam's number moved.", env: 'day', sfx: [['tickdown', 0.1, 0.9]],
    cam: benchCam(4.6, 1.3, { fov: 42, roll: -5 }, 0.14, snapIn),
    act: (S, u, tl, T) => { sam(S, ...bench(-0.35), -0.3, { sit: true, face: 'wide', head: [0, -0.5] }, (Math.floor(tl * 14) % 2) ? '0' : ' ', WH, 1.3); ivy(S, ...bench(0.38), -0.3, { sit: true, face: 'wide', head: [-0.5, -0.4] }, 1, GRN); S.dog.at(11.0, 0, 31.9, 0.9).sit(T, 0.8); } },
  { id: 'notup', t: "It didn't go up.", env: 'day',
    cam: push([12.9, 1.0, 33.6], [12.2, 1.3, 31.0], 0.16, { fov: 36, roll: 6 }),
    act: (S, u, tl) => { sam(S, ...bench(-0.35), -0.3, { sit: true, face: 'worried', head: [0, -0.5] }, (Math.floor(tl * 14) % 2) ? '0' : ' ', RED, 1.3); ivy(S, ...bench(0.38), -0.3, { sit: true, face: 'worried', head: [-0.5, -0.4] }, 1, GRN); } },
  { id: 'minus', t: 'It went to minus one.', env: ['day', 'dusk', 0.7], sfx: [['down', 0.05], ['bark', 0.7], ['bark', 1.0]],
    cam: snapIn([11.3, 0.7, 33.6], [11.67, 1.8, 30.9], 0.3, { fov: 34, roll: -9 }),
    act: (S, u, tl, T) => { sam(S, ...bench(-0.35), -0.3, { sit: true, face: 'scared', head: [0, -0.5] }, '-1', RED, 1.6, tl); S.dog.at(11.0, 0, 31.9, 0.9).sit(T, 1.0); } },
  { id: 'somewhere', t: 'Somewhere above the town,', env: 'dusk',
    cam: mv([14, 3, 40], [2, 16, 4], [10, 6, 30], [0.5, 20, 2], { fov: 50, roll: [4, 8], ease: 'io' }) },
  { id: 'counting', t: 'someone had just started counting too.', env: 'dream', sh: [0, 20, 0, 13], fill: ['#ff7040', 0.25], hb: { bpm: 110 },
    cam: snapIn([1.6, 20.6, 10.5], [0.2, 21.0, 2.0], 0.3, { fov: 36, roll: -8 }),
    act: (S, u, tl) => { S.mayor.at(0.2, 19.3, 2.1, 0.1).set({ face: 'neutral', head: [0, 0.35], armL: [0, 0.1], armR: [0, 0.1] }); S.tag(S.mayor, 1, RED, 1.3, tl - 0.7); } },
  { id: 'end', t: null, dur: 1.5, env: 'black', hb: { bpm: 110 }, cam: () => ({ p: [0, 0, 0], l: [0, 0, -1], fov: 45 }) },
];
