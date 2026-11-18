// 20-second sample in the style of roblox-director-prompt.md (opening only):
// "In my town, nobody ever gets lost. You see, everybody has an arrow over their head that points home."
const PI = Math.PI;
const L = (a, b, k) => a + (b - a) * k;
const V = (a, b, k) => [L(a[0], b[0], k), L(a[1], b[1], k), L(a[2], b[2], k)];
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ss = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const EASE = { lin: (u) => u, io: (u) => u * u * (3 - 2 * u), out: (u) => 1 - (1 - u) ** 3, snap: (u, tl) => { const a = cl(tl / 0.24); return 0.86 * (1 - (1 - a) ** 4) + 0.14 * u; } };
function mv(p0, l0, p1, l1, o = {}) {
  const e = EASE[o.ease || 'lin'], f = o.fov || 45, r = o.roll || 0;
  return (u, tl) => { const k = e(u, tl); return { p: V(p0, p1, k), l: V(l0, l1, k), fov: Array.isArray(f) ? L(f[0], f[1], k) : f, roll: Array.isArray(r) ? L(r[0], r[1], k) : r }; };
}
const push = (p, l, k = 0.12, o = {}) => mv(p, l, V(p, l, k), l, o);
const pull = (p, l, k = 0.12, o = {}) => mv(V(p, l, k), l, p, l, o);
const snapIn = (p, l, k = 0.3, o = {}) => mv(p, l, V(p, l, k), l, { ...o, ease: 'snap' });
// a cut inside one narration line: camera A until `at`, then camera B
const cut = (at, A, B) => (u, tl) => { const dur = u > 0 ? tl / u : 1; return u < at ? A(u / at, tl) : B((u - at) / (1 - at), tl - at * dur); };
const faceTo = (a, b) => Math.atan2(b[0] - a[0], b[2] - a[2]);

export const CONFIG = { monster: false, board: ['WELCOME HOME', 'FOLLOW', 'YOUR ARROW', 'it never lies'] };
export const MON = [16, 11.2, -64];
export function stairPos(s) { return [300, s * 0.33, 0, 0]; }

const A = (p) => ({ arrow: p });
const BAKERY = [8.6, 0, -30.5], TWINS = [-8.6, 0, 25], TOWER = [0, 0, 0], HOME = [8.5, 0, 44];
const HOMES = [[-8.6, 0, 17], [8.6, 0, 52.5], [-17, 0, -8.6], [25, 0, -8.6], [-8.6, 0, 41], [-25, 0, 8.6], [41, 0, 8.6], [-8.6, 0, -17], [17, 0, -8.6], [-33, 0, -8.6], [-8.6, 0, 57], [33, 0, 8.6], [8.6, 0, 60.5]];
const folkHome = (i) => [A(HOMES[i % HOMES.length]), '#ffffff'];
const W = '#ffffff', GOLD = '#ffd54a';
const kid = (S, x, y, z, ry, o = {}, arrow = TOWER, col = GOLD) => { S.sam.at(x, y, z, ry).set(o); if (arrow) S.tag(S.sam, A(arrow), col, 1.1); return S.sam; };
const wobble = (T, amp) => [Math.sin(T * 17) * amp, 0, Math.cos(T * 13) * amp];

export const SHOTS = [
  { id: 'l1', t: 'In my town, nobody ever gets lost.', env: 'day', crowd: true, cn: folkHome,
    cam: cut(0.35, mv([-24, 26, 60], [2, 8, 4], [-18, 20, 48], [2, 8, 4], { fov: 46, roll: -3 }), push([-1.0, 1.6, 15.4], [-4.2, 2.0, 9.2], 0.12, { fov: 46, roll: 3 })) },
  { id: 'l2', t: 'You see, everybody has an arrow over their head that points home.', env: 'day', crowd: true, cn: folkHome,
    cam: cut(0.5, snapIn([3.0, 2.1, 13.4], [3.0, 2.15, 9.0], 0.2, { fov: 40, roll: 4 }), pull([-4, 7, 26], [0, 2, 8], 0.2, { fov: 50, roll: -2 })),
    act: (S, u, tl, T) => { S.folk[0].at(3.0, 0, 9.0, 0.2).set({ armR: [-0.4, 0.2], face: 'happy' }); S.tag(S.folk[0], A(HOMES[0]), W, 1.2); } },
  { id: 'l3', t: "The baker's points at the bakery.", env: 'day',
    cam: cut(0.55, push([2.0, 1.2, -27.2], [3.6, 1.95, -29.8], 0.12, { fov: 40, roll: -4 }), snapIn([0.2, 1.7, -25.0], [5.3, 1.7, -30.5], 0.15, { fov: 44, roll: 5 })),
    act: (S, u, tl, T) => { S.folk[2].at(3.6, 0, -29.8, -0.9).set({ armL: [-1.8 + Math.sin(T * 6) * 0.2, 0.3], face: 'happy' }); S.tag(S.folk[2], A(BAKERY), W, 1.1); } },
  { id: 'l4', t: "The twins' arrows point at the same blue door.", env: 'day',
    cam: cut(0.5, push([-0.6, 1.1, 22.4], [-3.5, 1.1, 24.6], 0.12, { fov: 42, roll: 3 }), pull([0.6, 1.5, 27.5], [-5.3, 1.4, 25], 0.12, { fov: 46, roll: -3 })),
    act: (S, u, tl, T) => { [[-3.2, 24.2], [-3.9, 25.0]].forEach(([x, z], i) => { const c = S.folk[3 + i * 5]; c.at(x, 0, z, -0.8 + i * 0.3).set({ face: 'happy', dy: Math.abs(Math.sin(T * 7 + i)) * 0.1, armR: [-2.4 + Math.sin(T * 9 + i) * 0.3, 0.3] }); S.tag(c, A(TWINS), W, 1.0); }); } },
  { id: 'l5', t: 'When someone moves house, the whole street watches their arrow swing round.', env: 'day', sfx: [['tickdown', 1.2, 1.0]],
    cam: cut(0.45, push([0.6, 1.4, 36.4], [-1.6, 1.7, 33.0], 0.14, { fov: 42, roll: -5 }), snapIn([-0.6, 1.9, 36.8], [-1.6, 2.2, 33.0], 0.25, { fov: 38, roll: 6 })),
    act: (S, u, tl, T) => { const k = ss(0.35, 0.85, u); S.folk[1].at(-1.6, 0, 33.0, PI * 0.15).set({ armL: [-1.3, 0.1], armR: [-1.3, 0.1], face: k > 0.5 ? 'happy' : 'neutral' }); S.prop(-1.6 + Math.sin(PI * 0.15) * 0.4, 0.62, 33.0 + Math.cos(PI * 0.15) * 0.4); S.tag(S.folk[1], A(V([40, 0, 8.6], [-8.6, 0, 41], k)), k > 0.98 ? GOLD : W, 1.1); [[0.6, 31.4], [1.4, 34.2], [-3.4, 30.8]].forEach(([x, z], i) => { const c = S.folk[6 + i]; c.at(x, 0, z, faceTo([x, 0, z], [-1.6, 0, 33])).set({ face: 'happy', head: [0, -0.3] }); S.tag(c, folkHome(6 + i)[0], W); }); } },
  { id: 'l6', t: 'And everybody claps.', env: 'day', sfx: [['up', 0.1]],
    cam: push([-1.6, 1.3, 38.6], [-1.2, 1.6, 32.4], 0.12, { fov: 52, roll: 3 }),
    act: (S, u, tl, T) => { S.folk[1].at(-1.6, 0, 33.0, PI).set({ face: 'happy', armL: [-2.6 + Math.sin(T * 8) * 0.3, 0.4] }); S.tag(S.folk[1], A([-8.6, 0, 41]), GOLD, 1.1); [[0.6, 31.4], [1.4, 34.2], [-3.4, 30.8], [-0.4, 35.4], [-3.0, 34.6]].forEach(([x, z], i) => { const c = S.folk[6 + i]; c.at(x, 0, z, faceTo([x, 0, z], [-1.6, 0, 33])).set({ face: 'happy', armL: [-1.5, Math.abs(Math.sin(T * 14 + i)) * 0.7], armR: [-1.5, Math.abs(Math.sin(T * 14 + i)) * 0.7], dy: Math.abs(Math.sin(T * 7 + i)) * 0.08 }); S.tag(c, folkHome(6 + i)[0], W); }); } },
  { id: 'l7', t: 'Grandpa says, an arrow never lies.', env: 'day',
    cam: cut(0.4, push([10.2, 1.35, 33.8], [11.67, 1.35, 30.9], 0.1, { fov: 40, roll: -3 }), mv([10.9, 1.25, 32.6], [11.67, 1.45, 30.9], [10.95, 1.25, 32.5], [11.67, 1.45, 30.9], { fov: 34 })),
    act: (S, u, tl, T) => { S.mayor.at(11.67, 0.44, 30.9, -0.3).set({ sit: true, face: 'smile', head: [Math.sin(T * 1.1) * 0.15, -0.05], armR: [-1.2 + Math.sin(T * 3) * 0.3, 0.3] }); S.tag(S.mayor, A([-25, 0, 8.6]), W, 1.1); } },
  { id: 'l8', t: 'Every night, I have to say goodnight to mine. That is the rule.', env: 'late', sh: [8.5, 4, 43, 14], fill: ['#ffd9b0', 1.5],
    cam: cut(0.55, push([6.6, 6.35, 41.45], [8.85, 4.4, 41.45], 0.12, { fov: 44, roll: 4 }), snapIn([7.4, 5.7, 41.45], [8.85, 4.6, 41.45], 0.2, { fov: 40, roll: -4 })),
    act: (S, u, tl, T) => { S.blanket(true); kid(S, 7.75, 4.02, 41.45, -PI / 2, { lie: true, face: u > 0.55 ? 'smile' : 'up' }); S.lights([[10.5, 4.9, 41.8, '#ffb060', 6, 9]]); } },
  { id: 'l9', t: "But here's the thing.", env: 'day',
    cam: snapIn([3.2, 0.95, 46.8], [4.4, 1.05, 44.0], 0.28, { fov: 42, roll: 5 }),
    act: (S, u, tl, T) => { kid(S, 4.4, 0, 44.0, -0.9, { face: 'neutral', head: [0, -0.1] }); } },
  { id: 'l10', t: 'My arrow has never pointed at our house.', env: 'day',
    cam: pull([1.6, 1.3, 48.5], [5.0, 1.6, 44.2], 0.14, { fov: 50, roll: -3 }),
    act: (S, u, tl, T) => { kid(S, 4.4, 0, 44.0, -1.2, { face: 'sad', head: [0.4, 0] }); } },
  { id: 'l11', t: 'It points at the old clock tower.', env: 'dusk',
    cam: cut(0.4, push([5.8, 1.15, 46.6], [4.4, 1.45, 44.0], 0.12, { fov: 42, roll: 4 }), push([2.6, 1.2, 38], [0, 17, 0], 0.08, { fov: 54, roll: -6 })),
    act: (S, u, tl, T) => { kid(S, 4.4, 0, 44.0, PI + 0.1, { face: 'neutral', head: [0, -0.35] }); } },
  { id: 'l12', t: 'And tonight,', env: 'night',
    cam: push([2.5, 1.5, 25], [0, 16, 0], 0.08, { fov: 54, roll: -7 }), act: (S) => { S.lights([[-1.7, 22.3, 1.7, '#ffb060', 40, 22]]); } },
  { id: 'l13', t: 'it started to shake.', env: 'night', fill: ['#e9e4ff', 1.5], sfx: [['tickdown', 0.2, 1.0]], shake: 0.012,
    cam: snapIn([4.3, 1.35, 47.6], [4.4, 1.45, 44.0], 0.3, { fov: 40, roll: 9 }),
    act: (S, u, tl, T) => { kid(S, 4.4, 0, 44.0, 0, { face: 'scared', head: [0, -0.4] }, V(TOWER, TOWER, 0).map((v, i) => v + wobble(T, 6)[i] * ss(0.1, 0.4, tl)), '#ff5038'); S.lights([[6, 3, 46, '#ffdca0', 12, 12]]); } },
  { id: 'end', t: null, dur: 0.6, env: 'black', cam: () => ({ p: [0, 0, 0], l: [0, 0, -1], fov: 45 }) },
];
