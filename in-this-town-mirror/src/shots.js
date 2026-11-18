// "In this town, everyone's reflection waves back a second late. One kid's waves first."
// One entry per shot; `t` is the narration line (null = silent beat). No imports.
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
const push = (p, l, k = 0.1, o = {}) => mv(p, l, V(p, l, k), l, o);
const snapIn = (p, l, k = 0.3, o = {}) => mv(p, l, V(p, l, k), l, { ...o, ease: 'snap' });

export const CONFIG = { monster: false, shop: true, lag: 1.0, lags: { leo: -1.0 }, board: ['MIRROR RULES', 'WAVE. WAIT.', 'ONE SECOND.', 'that is still you'] };
export const MON = [16, 11.2, -64];
export function stairPos(s) { return [300, s * 0.33, 0, 0]; }

// ---- places
const GX = 5.19, GZ = -31.35, GY = 1.8;              // the shop window (a mirror)
const SX = 3.55, SZ = -26.4;                          // under the hanging sign
const LX = 4.15;                                      // standing distance from the glass
const R = PI / 2;                                     // facing the window
// camera looking at the window from the street, over the shoulder
const winCam = (z, h, d, side, o, k = 0.1, fn = push) => fn([GX - d - 1.4, h + 0.1, z + side * 1.4], [GX, h + 0.1, z], k * 0.8, o);
// waving: arm up between t0 and t0 + len
const wave = (t, t0, len = 1.5) => { const a = cl((t - t0) / 0.18) * cl((t0 + len - t) / 0.2); return [L(0, -2.65, a) + Math.sin(t * 13) * 0.28 * a, L(0.08, 0.35, a)]; };
const leo = (S, x, z, ry, o = {}) => S.leo.at(x, 0.06, z, ry).set(o);
const pip = (S, x, z, ry, o = {}) => S.pip.at(x, 0.06, z, ry).set(o);
// sign swing in the wind
const swing = (T, amp) => Math.sin(T * 2.3) * amp + Math.sin(T * 5.1) * amp * 0.3;
const WAVERS = [[-33.6, 0], [-32.4, 7], [-30.3, 2], [-29.2, 9]];

export const SHOTS = [
  // ---------------------------------------------------------------- the rule
  { id: 'rule1', t: 'In this town,', env: 'day', crowd: true, cam: mv([-30, 30, 10], [4, 4, -30], [-20, 20, 0], [4, 3, -30], { fov: 46, ease: 'out' }), act: (S, u, tl, T) => { S.sign(swing(T, 0.04)); } },
  { id: 'rule2', t: 'your reflection waves back one second late.', env: 'day',
    cam: winCam(-31.0, 1.5, 4.4, -2.6, { fov: 42, roll: 3 }, 0.12),
    act: (S, u, tl, T) => { S.folk[3].at(LX, 0.06, -31.0, R).set({ armR: wave(tl, 0.5, 2.2) }); S.sign(swing(T, 0.04)); } },
  { id: 'check', t: 'Every morning, the whole town stops at the bakery window.', env: 'day',
    cam: mv([-1.5, 2.2, -40], [GX, 1.5, -30], [-0.5, 2.0, -38.5], [GX, 1.5, -30.5], { fov: 50, roll: -2 }),
    act: (S, u, tl, T) => { WAVERS.forEach(([z, i], j) => S.folk[i].at(LX - 0.1 * j, 0.06, z, R).set({ armR: wave(tl, 0.6 + j * 0.35, 1.6) })); S.sign(swing(T, 0.05)); } },
  { id: 'wait', t: 'Wave. Wait. And there it is.', env: 'day',
    cam: winCam(-31.2, 1.7, 3.8, -2.0, { fov: 40, roll: 4 }, 0.14),
    act: (S, u, tl, T) => { S.folk[1].at(LX, 0.06, -31.2, R).set({ armR: wave(tl, 0.15, 3.0), face: 'happy' }); } },
  { id: 'still', t: "That's how you know you're still you.", env: 'day',
    cam: winCam(-32.0, 1.6, 3.4, 1.8, { fov: 40, roll: -4 }, 0.12),
    act: (S, u, tl, T) => { S.folk[7].at(LX, 0.06, -32.0, R).set({ face: 'smile', armL: [-0.6, 0.2], head: [Math.sin(tl * 2) * 0.15, 0] }); } },
  // plants
  { id: 'chain', t: 'The bakery sign has hung by one chain for thirty years.', env: 'day', sfx: [['creak', 0.4], ['creak', 2.1]],
    cam: push([0.8, 1.2, -22.6], [SX - 0.5, 3.1, SZ], 0.12, { fov: 44, roll: 5 }), act: (S, u, tl, T) => { S.sign(swing(T, 0.07)); } },
  { id: 'nobody', t: 'Nobody fixes it.', env: 'day', crowd: true,
    cam: snapIn([0.6, 2.2, -21.8], [SX - 0.6, 3.0, SZ], 0.16, { fov: 38, roll: -6 }), act: (S, u, tl, T) => { S.sign(swing(T, 0.07)); } },

  // ---------------------------------------------------------------- Leo
  { id: 'leo', t: "And then there's Leo.", env: 'day',
    cam: snapIn([1.3, 0.7, -27.6], [2.3, 1.05, -31.0], 0.25, { fov: 46, roll: 5 }),
    act: (S, u, tl, T) => { leo(S, 2.3, -31.0, -0.5, { face: 'smile', head: [Math.sin(T * 1.2) * 0.1, -0.05] }); S.sign(swing(T, 0.04)); } },
  { id: 'first', t: "Leo's reflection waves first.", env: 'day',
    cam: winCam(-31.0, 1.0, 2.3, -1.25, { fov: 40, roll: -3 }, 0.16),
    act: (S, u, tl) => { leo(S, LX, -31.0, R, { armR: wave(tl, 1.25, 2.0), face: tl > 1.2 ? 'wide' : 'smile' }); } },
  { id: 'whole', t: 'A whole second before he does.', env: 'day', sfx: [['ding', 0.25]],
    cam: winCam(-31.0, 1.05, 1.7, 0.9, { fov: 38, roll: 5 }, 0.2, snapIn),
    act: (S, u, tl) => { leo(S, LX, -31.0, R, { armR: wave(tl, 1.1, 1.4), face: 'wide' }); } },
  { id: 'doctor', t: 'Doctors checked. Nothing wrong with him.', env: 'day',
    cam: push([1.4, 1.2, -34.4], [LX - 0.3, 1.0, -31.2], 0.12, { fov: 42, roll: -4 }),
    act: (S, u, tl, T) => { leo(S, LX, -31.0, R + 0.3, { face: 'neutral', head: [-0.3, 0] }); S.folk[8].at(3.2, 0.06, -31.6, 1.2).set({ armL: [-1.4, 0.2], head: [0, 0.2], face: 'neutral' }); } },
  { id: 'follow', t: 'So Leo learned to follow it.', env: 'day',
    cam: winCam(-31.0, 1.2, 3.2, -1.8, { fov: 42, roll: 3 }, 0.12),
    act: (S, u, tl) => { leo(S, LX, -31.0, R, { face: 'smile', head: [0, 0.05] }); } },
  { id: 'duck', t: 'When it ducks, he ducks.', env: 'day', sfx: [['whoosh', 1.0]],
    cam: winCam(-31.0, 0.9, 2.7, 1.7, { fov: 40, roll: -5 }, 0.08),
    act: (S, u, tl) => { const k = ss(0.75, 0.95, tl) * (1 - ss(1.5, 1.8, tl)); leo(S, LX, -31.0, R, { dy: -0.32 * k, lean: 0.6 * k, armL: [-2.2 * k, 0.4], armR: [-2.2 * k, 0.4], face: k > 0.3 ? 'scared' : 'neutral' }); const bt = (tl - 0.6) / 0.8; if (bt > 0 && bt < 1) S.ball(LX, 1.05, L(-36, -26, bt)); } },
  { id: 'step', t: 'When it steps aside, he steps aside.', env: 'day', sfx: [['steps', 0.6, 9]],
    cam: winCam(-31.0, 1.0, 3.0, -2.4, { fov: 46, roll: 4 }, 0.1),
    act: (S, u, tl, T) => { const k = ss(0.7, 1.0, tl); leo(S, L(LX, LX - 0.9, k), -31.0, R, { face: 'neutral' }); const rt = (tl - 0.5) / 1.2; if (rt > 0 && rt < 1) S.folk[5].at(LX, 0.06, L(-37, -25, rt), 0).walk(T * 15, 1.0).set({ lean: 0.3 }); } },
  { id: 'never', t: 'It has never once been wrong.', env: 'day',
    cam: winCam(-31.2, 1.1, 2.0, 1.0, { fov: 38, roll: -3 }, 0.14),
    act: (S, u, tl) => { leo(S, LX, -31.2, R, { face: 'smile' }); } },
  { id: 'calm', t: 'And it has never once looked scared.', env: 'day',
    cam: snapIn([GX - 2.0, 1.05, -31.9], [GX, 1.05, -31.2], 0.25, { fov: 34, roll: 5 }),
    act: (S, u, tl) => { leo(S, LX, -31.2, R, { face: 'smile' }); } },
  { id: 'pip', t: 'His little sister Pip copies everything Leo does.', env: 'day',
    cam: push([1.6, 0.85, -27.6], [3.0, 0.8, -30.6], 0.14, { fov: 44, roll: -4 }),
    act: (S, u, tl, T) => { leo(S, 3.0, -31.4, -0.6, { armL: [-2.6 * ss(0.4, 0.6, tl) + Math.sin(T * 6) * 0.2, 0.5], face: 'happy' }); pip(S, 2.5, -30.1, -0.3, { armL: [-2.6 * ss(0.9, 1.1, tl) + Math.sin(T * 6 - 2) * 0.2, 0.5], face: 'happy' }); } },
  { id: 'everything', t: 'Everything.', env: 'day',
    cam: snapIn([0.9, 0.7, -27.6], [2.7, 0.6, -30.6], 0.2, { fov: 44, roll: 6 }),
    act: (S, u, tl) => { const k1 = ss(0.05, 0.25, tl), k2 = ss(0.45, 0.65, tl); leo(S, 3.0, -31.4, -0.6, { dy: -0.32 * k1, lean: 0.6 * k1, face: 'neutral' }); pip(S, 2.5, -30.1, -0.3, { dy: -0.24 * k2, lean: 0.6 * k2, face: 'happy' }); } },

  // ---------------------------------------------------------------- but one windy morning
  { id: 'windy', t: 'But one windy morning,', env: 'wind', crowd: true, sfx: [['gust', 0.0], ['creak', 0.8]],
    cam: mv([-0.5, 5.5, -15], [3.5, 2.6, -28], [0, 4.8, -17], [3.5, 2.6, -28], { fov: 48, roll: [3, 6] }), act: (S, u, tl, T) => { S.sign(swing(T, 0.22)); } },
  { id: 'walked', t: 'Leo and Pip walked to the bakery.', env: 'wind', sfx: [['steps', 0, 4]],
    cam: (u) => { const z = L(-20, -24.5, u); return { p: [0.6, 1.1, z + 3.3], l: [2.6, 1.0, z - 1], fov: 46, roll: -4 }; },
    act: (S, u, tl, T) => { const z = L(-20, -24.5, u); leo(S, 2.9, z, PI).walk(T * 6, 0.55); pip(S, 2.2, z + 0.6, PI).walk(T * 7, 0.55); S.sign(swing(T, 0.22)); } },
  { id: 'glance', t: 'Leo glanced at the window.', env: 'wind',
    cam: winCam(-30.8, 1.0, 2.7, -1.6, { fov: 40, roll: 3 }, 0.12),
    act: (S, u, tl, T) => { leo(S, 3.7, -30.8, R - 0.15, { face: 'smile' }); S.sign(swing(T, 0.22)); } },
  { id: 'scared', t: 'And for the first time ever, his reflection looked scared.', env: 'wind', sfx: [['sting', 1.05]],
    cam: winCam(-30.8, 1.05, 1.55, 0.75, { fov: 36, roll: -5 }, 0.2),
    act: (S, u, tl) => { leo(S, 3.7, -30.8, R - 0.15, { face: tl > 1.0 ? 'scared' : 'smile', head: [0, -0.15 * ss(2.2, 2.6, tl)] }); } },
  { id: 'lookup', t: 'It looked up.', env: 'wind',
    cam: winCam(-30.8, 1.1, 1.9, -0.9, { fov: 36, roll: 6 }, 0.2, snapIn),
    act: (S, u, tl) => { leo(S, 3.7, -30.8, R - 0.15, { face: tl > 0.9 ? 'scared' : 'worried', head: [-0.35 * ss(0.8, 1.1, tl), -0.6 * ss(0.8, 1.1, tl)] }); } },
  { id: 'atsign', t: 'At the sign.', env: 'wind', sfx: [['creak', 0.15]],
    cam: snapIn([1.4, 1.0, -30.0], [SX - 0.5, 2.8, SZ], 0.16, { fov: 42, roll: -7 }), act: (S, u, tl, T) => { S.sign(swing(T, 0.3)); } },
  { id: 'under', t: 'Pip was standing right underneath it.', env: 'wind',
    cam: push([1.4, 0.9, -23.4], [SX, 1.8, SZ], 0.12, { fov: 44, roll: 4 }),
    act: (S, u, tl, T) => { pip(S, SX, SZ, R + 0.5, { armR: wave(tl, 0.4, 3), face: 'happy', head: [0, -0.2] }); S.sign(swing(T, 0.3)); } },
  { id: 'pipwave', t: 'Waving at her reflection. Waiting for it to wave back.', env: 'wind',
    cam: mv([2.0, 1.0, -26.0], [GX, 0.9, -28.9], [2.2, 1.0, -26.4], [GX, 0.9, -28.9], { fov: 42, roll: -4 }),
    act: (S, u, tl, T) => { pip(S, SX, SZ, R + 0.5, { armR: wave(tl, -1, 9), face: 'happy' }); S.sign(swing(T, 0.32)); } },
  { id: 'snap', t: 'The chain snapped.', env: 'wind', sfx: [['snap', 0.55]],
    cam: snapIn([-0.5, 1.8, -22.0], [SX - 0.2, 3.6, SZ], 0.16, { fov: 30, roll: 9 }),
    act: (S, u, tl, T) => { S.sign(swing(T, 0.32), tl > 0.6 ? 0.01 : null); } },
  // the falling second, slowed
  { id: 'smiling', t: 'In the window, every other reflection was still smiling.', env: 'wind',
    cam: push([-3.0, 1.9, -38.0], [GX, 1.3, -31.2], 0.08, { fov: 42, roll: 4 }),
    act: (S, u, tl) => { WAVERS.forEach(([z, i], j) => S.folk[i].at(LX - 0.2, 0.06, z, R - 0.7).set({ face: 'scared', head: [0, -0.7], armL: [-1.0, 0.2] })); S.sign(0, 0.02); } },
  { id: 'lags', lags: { folk0: 3, folk7: 3, folk2: 3, folk9: 3 }, t: 'One second behind.', env: 'wind',
    cam: winCam(-31.0, 1.6, 5.0, 2.6, { fov: 42, roll: -5 }, 0.12),
    act: (S, u, tl) => { WAVERS.forEach(([z, i], j) => S.folk[i].at(LX - 0.2, 0.06, z, tl > -1.5 ? R - 0.7 : R).set(tl > -1.5 ? { face: 'scared', head: [0, -0.7] } : { face: 'happy', armR: wave(tl, -3, 9) })); S.sign(0, 0.03); } },
  { id: 'far', t: 'Leo was too far away to reach her.', env: 'wind',
    cam: mv([1.0, 1.5, -35.5], [SX, 0.9, SZ], [1.1, 1.5, -35.0], [SX, 0.9, SZ], { fov: 34, roll: 3 }),
    act: (S, u, tl) => { leo(S, 3.6, -31.5, 0, { face: 'scared', armL: [-1.4, 0.2], armR: [-1.4, 0.2] }); pip(S, SX, SZ, R + 0.5, { armR: wave(tl, -1, 9), face: 'happy' }); S.sign(0, 0.04); } },
  { id: 'notrun', t: "But his reflection didn't run to her.", env: 'wind',
    cam: winCam(-30.9, 0.9, 2.9, -2.2, { fov: 42, roll: -4 }, 0.1),
    act: (S, u, tl) => { const k = ss(1.0, 1.6, tl); S.leo.at(3.6, 0.06, L(-31.5, -30.0, k), 0).set(k > 0 ? { dive: k, face: 'shout' } : { face: 'scared' }); S.sign(0, 0.05); } },
  { id: 'sideways', t: 'It threw itself sideways, onto the street.', env: 'wind',
    cam: winCam(-30.9, 0.7, 2.4, 1.6, { fov: 42, roll: 7 }, 0.15, snapIn),
    act: (S, u, tl) => { const k = ss(0.0, 0.6, tl); S.leo.at(3.6, 0.06, L(-31.5, -30.0, k), 0).set(k > 0 ? { dive: k, face: 'shout' } : { face: 'scared' }); S.sign(0, 0.06); } },
  { id: 'nosense', t: 'It made no sense.', env: 'wind',
    cam: snapIn([2.0, 1.0, -28.6], [3.6, 1.05, -31.5], 0.2, { fov: 38, roll: -6 }),
    act: (S, u, tl) => { leo(S, 3.6, -31.5, 0, { face: 'wide', head: [-0.6, 0] }); S.sign(0, 0.07); } },
  { id: 'anyway', t: 'Leo did it anyway.', env: 'wind', sfx: [['thud', 0.55]],
    cam: push([0.9, 0.9, -34.0], [3.6, 0.5, -30.7], 0.1, { fov: 48, roll: 5 }),
    act: (S, u, tl) => { const k = ss(0.0, 0.6, tl); S.leo.at(3.6, 0.06, L(-31.5, -30.0, k), 0).set({ dive: k, face: 'shout' }); S.sign(0, 0.08); } },
  { id: 'always', t: 'Because Leo always follows his reflection.', env: 'wind',
    cam: push([1.4, 0.6, -27.6], [3.6, 0.3, -30.0], 0.1, { fov: 44, roll: -3 }),
    act: (S, u, tl) => { S.leo.at(3.6, 0.06, -30.0, 0).set({ dive: 1, face: 'pain' }); S.sign(0, 0.09); } },
  { id: 'andpip', t: 'And Pip,', gap: 0.05, env: 'wind',
    cam: snapIn([1.5, 0.6, -24.4], [SX, 0.65, SZ], 0.25, { fov: 40, roll: 6 }),
    act: (S, u, tl) => { pip(S, SX, SZ, -PI / 2 + 0.2, { face: 'wide', head: [0.3, 0] }); S.sign(0, 0.1); } },
  { id: 'followsleo', t: 'always follows Leo.', env: 'wind', sfx: [['thud', 0.6]],
    cam: push([0.4, 0.8, -23.0], [SX, 0.5, SZ + 0.8], 0.1, { fov: 52, roll: -5 }),
    act: (S, u, tl) => { const k = ss(0.1, 0.65, tl); S.pip.at(SX, 0.06, L(SZ, SZ + 1.7, k), 0).set({ dive: k, face: 'shout' }); S.sign(0, cl(tl - 0.6, -1, 0.6) >= 0 ? cl(tl - 0.6, 0, 0.6) : 0.11); } },
  { id: 'crash', t: null, dur: 1.2, env: 'wind', sfx: [['crash', 0.05]],
    cam: push([0.2, 0.6, -22.4], [3.2, 0.4, SZ + 0.4], 0.05, { fov: 54, roll: 8 }), shake: 0.03,
    act: (S, u, tl) => { S.pip.at(SX, 0.06, SZ + 1.7, 0).set({ dive: 1, face: 'pain' }); S.sign(0, 0.7 + tl); for (let i = 0; i < 4; i++) S.rip(3.2, 0.12, SZ, tl - i * 0.08, '#d9c3a0', 1.6 + i * 0.4, 1.0); } },
  { id: 'where', t: 'It hit the ground exactly where she had been standing.', env: 'wind',
    cam: push([2.4, 2.6, -23.8], [3.7, 0.2, SZ], 0.12, { fov: 46, roll: -4 }),
    act: (S, u, tl) => { S.pip.at(SX, 0.06, SZ + 1.7, 0).set({ dive: 1, face: 'wide' }); S.sign(0, 2.5); } },
  { id: 'quiet', t: 'The whole street went quiet.', env: 'wind', crowd: true, cn: () => null,
    cam: mv([-6, 3, -40], [3, 0.6, -28], [-5, 2.6, -38], [3, 0.6, -28], { fov: 46, roll: 3 }),
    act: (S) => { S.sign(0, 2.5); S.leo.at(3.6, 0.06, -30.0, 0).set({ dive: 1, face: 'wide' }); S.pip.at(SX, 0.06, SZ + 1.7, 0).set({ dive: 1, face: 'wide' }); } },

  // ---------------------------------------------------------------- after
  { id: 'hug', t: 'Leo ran to her, and Pip held on to him tight.', env: 'day',
    cam: push([0.8, 1.0, -22.6], [3.3, 0.75, -24.8], 0.12, { fov: 42, roll: 4 }),
    act: (S, u, tl, T) => { leo(S, 3.3, -25.0, PI + 0.1, { armL: [-1.4, 0.5], armR: [-1.4, 0.5], face: 'happy', head: [0, 0.3] }); pip(S, 3.35, -24.55, 0.1, { armL: [-1.6, 0.4], armR: [-1.6, 0.4], face: 'happy', head: [0, -0.4] }); S.sign(0, 2.5); } },
  { id: 'looked', t: 'Then Leo looked back at the window.', env: 'day',
    cam: winCam(-30.6, 1.1, 3.0, -1.8, { fov: 40, roll: -3 }, 0.1),
    act: (S, u, tl) => { leo(S, 3.6, -30.6, R, { face: 'neutral' }); pip(S, 3.3, -29.9, R, { face: 'smile' }); } },
  { id: 'understood', t: 'And finally understood.', env: 'day',
    cam: winCam(-30.6, 1.0, 1.6, 0.6, { fov: 36, roll: 4 }, 0.18),
    act: (S, u, tl) => { leo(S, 3.6, -30.6, R, { face: 'wide' }); } },
  { id: 'notfuture', t: "His reflection never knew the future.", env: 'day',
    cam: snapIn([GX - 1.6, 1.0, -31.2], [GX, 1.0, -30.6], 0.25, { fov: 34, roll: -5 }),
    act: (S, u, tl) => { leo(S, 3.6, -30.6, R, { face: 'neutral' }); } },
  { id: 'brave', t: 'It was just one second braver than him.', env: 'day',
    cam: winCam(-30.6, 1.05, 2.2, -1.1, { fov: 38, roll: 5 }, 0.16),
    act: (S, u, tl) => { leo(S, 3.6, -30.6, R, { face: 'smile' }); } },
  { id: 'today', t: 'And today, he had caught up.', env: 'day',
    cam: winCam(-30.6, 1.0, 1.9, 0.9, { fov: 36, roll: -4 }, 0.2),
    act: (S, u, tl) => { leo(S, 3.6, -30.6, R, { face: 'happy' }); } },
  { id: 'same', lags: { leo: 0 }, t: 'He waved.', env: 'day', sfx: [['chime', 0.35]],
    cam: winCam(-30.6, 1.1, 2.5, -1.4, { fov: 40, roll: 3 }, 0.14, snapIn),
    act: (S, u, tl) => { leo(S, 3.6, -30.6, R, { armR: wave(tl, 0.3, 9), face: 'happy' }); } },
  { id: 'together', lags: { leo: 0 }, t: 'And for the first time in his life,', env: 'day',
    cam: winCam(-30.6, 1.15, 1.7, 0.8, { fov: 36, roll: -5 }, 0.16),
    act: (S, u, tl) => { leo(S, 3.6, -30.6, R, { armR: wave(tl, -1, 9), face: 'happy' }); } },
  { id: 'samesecond', lags: { leo: 0 }, t: 'it waved back at exactly the same time.', env: 'day',
    cam: winCam(-30.4, 1.2, 3.6, -2.1, { fov: 42, roll: 2 }, 0.1),
    act: (S, u, tl) => { leo(S, 3.6, -30.6, R, { armR: wave(tl, -1, 9), face: 'happy' }); pip(S, 3.3, -29.9, R, { armR: wave(tl, 0.2, 9), face: 'happy' }); } },
  { id: 'pipalso', lags: { leo: 0 }, t: 'Pip waved too.', env: 'day',
    cam: winCam(-29.9, 0.75, 1.9, 1.1, { fov: 38, roll: 4 }, 0.12),
    act: (S, u, tl) => { pip(S, 3.3, -29.9, R, { armR: wave(tl, -1, 9), face: 'happy' }); leo(S, 3.6, -30.6, R, { armR: wave(tl, -1, 9), face: 'happy' }); } },
  { id: 'late', lags: { leo: 0 }, t: 'Her reflection was one second late.', env: 'day',
    cam: winCam(-29.9, 0.75, 2.0, -1.2, { fov: 38, roll: -5 }, 0.2, snapIn),
    act: (S, u, tl) => { pip(S, 3.3, -29.9, R, { armR: wave(tl, 0.1, 9), face: 'happy' }); } },
  { id: 'fine', lags: { leo: 0 }, t: 'Some things never change.', env: ['day', 'dusk', 0.4], gap: 0.6,
    cam: mv([-1.5, 2.2, -40], [GX, 1.4, -30], [-3.5, 4.0, -45], [GX, 1.6, -30], { fov: 50, roll: [-2, 2], ease: 'io' }),
    act: (S, u, tl) => { leo(S, 3.6, -30.6, R, { armR: wave(tl, -1, 9), face: 'happy' }); pip(S, 3.3, -29.9, R, { armR: wave(tl, -1, 9), face: 'happy' }); S.sign(0, 2.5); } },
  { id: 'end', t: null, dur: 1.2, env: 'black', cam: () => ({ p: [0, 0, 0], l: [0, 0, -1], fov: 45 }) },
];
