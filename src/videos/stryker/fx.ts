// Flat 2D effect cards for the Stryker short, drawn with the cast's own pen (plum ink, flat fills): map arrows,
// the four-day calendar, medal sparkle, welding sparks, rocket smoke, the hose's water stream, the warhead's
// electric signal and its fizzle, speed lines and dust. No text anywhere.
import { Pen, INK } from "./toon";

type P2 = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** arrows sweeping out of the home star across the map (1200 x 800 canvas = the board), k in 0..1 per arrow */
export const fxArrows = (p: Pen, ks: number[]) => {
  const home: P2 = [270, 250];
  const ends: P2[] = [[640, 200], [930, 280], [660, 470], [1020, 560], [360, 600]];
  ends.forEach((e, i) => {
    const k = clamp01(ks[i] ?? 0);
    if (k <= 0) return;
    const mid: P2 = [(home[0] + e[0]) / 2, Math.min(home[1], e[1]) - 120 - 40 * i];
    const pts: P2[] = [];
    const n = Math.max(2, Math.round(30 * k));
    for (let j = 0; j <= n; j++) {
      const t = (j / 30), s = 1 - t;
      pts.push([s * s * home[0] + 2 * s * t * mid[0] + t * t * e[0], s * s * home[1] + 2 * s * t * mid[1] + t * t * e[1]]);
    }
    p.line(pts, "#d8423a", 14);
    if (k > 0.97) {
      const [x, y] = pts[pts.length - 1], [x0, y0] = pts[pts.length - 3], a = Math.atan2(y - y0, x - x0);
      p.poly([[x + 30 * Math.cos(a), y + 30 * Math.sin(a)], [x + 26 * Math.cos(a + 2.4), y + 26 * Math.sin(a + 2.4)], [x + 26 * Math.cos(a - 2.4), y + 26 * Math.sin(a - 2.4)]], "#d8423a", 7);
    }
  });
};
/** a desk calendar of four days, each square getting a check mark (n = 0..4); 400 x 440 canvas */
export const fxCalendar = (p: Pen, n: number, pop: number) => {
  const g = p.g;
  g.save(); g.translate(200, 230); g.scale(pop, pop); g.translate(-200, -230);
  p.poly([[30, 60], [370, 60], [370, 410], [30, 410]], "#f7f3ea", 10);
  p.poly([[30, 60], [370, 60], [370, 130], [30, 130]], "#d8423a", 10);
  for (const x of [110, 290]) { p.poly([[x - 12, 30], [x + 12, 30], [x + 12, 90], [x - 12, 90]], "#9aa0a6", 6); }
  for (let i = 0; i < 4; i++) {
    const x = 60 + (i % 2) * 160, y = 160 + Math.floor(i / 2) * 120;
    p.poly([[x, y], [x + 120, y], [x + 120, y + 100], [x, y + 100]], "#ffffff", 6);
    if (i < n) p.stroke([[x + 22, y + 52], [x + 52, y + 80], [x + 102, y + 20]], 16, "#2f8a4f");
  }
  g.restore();
};
/** four-point sparkle on a 300 x 300 canvas, t in 0..1 (grows, twinkles, shrinks) */
export const fxSparkle = (p: Pen, t: number) => {
  const s = Math.sin(Math.PI * clamp01(t)), c = 150;
  if (s < 0.02) return;
  const R = 120 * s, r = 22 * s;
  p.poly([[c, c - R], [c + r, c - r], [c + R * 0.8, c], [c + r, c + r], [c, c + R], [c - r, c + r], [c - R * 0.8, c], [c - r, c - r]], "#fff6c2", 6);
  p.dot(c, c, 10 * s, "#ffffff");
};
/** welding spark spray on a 400 x 400 canvas (seeded per frame) */
export const fxSparks = (p: Pen, seed: number) => {
  const g = p.g, c = 200;
  let s = seed * 9301 + 49297;
  const r = () => { s = (s * 16807) % 2147483647; return (s % 10000) / 10000; };
  p.ell(c, c, 36, 36, "#fff9d8", 0);
  p.ell(c, c, 22, 22, "#ffffff", 0);
  g.lineCap = "round";
  for (let i = 0; i < 18; i++) {
    const a = rad(200 + r() * 160) + Math.PI * (r() < 0.25 ? 1 : 0), l = 60 + r() * 140, w = 5 + r() * 5;
    const x1 = c + Math.cos(a) * l, y1 = c + Math.sin(a) * l + 0.002 * l * l;
    g.strokeStyle = r() < 0.5 ? "#ffd54a" : "#fff3b0"; g.lineWidth = w;
    g.beginPath(); g.moveTo(c + Math.cos(a) * 30, c + Math.sin(a) * 30); g.lineTo(x1, y1); g.stroke();
  }
};
/** soft smoke puff (see-through card) on a 256 x 256 canvas; t = age 0..1 */
export const fxSmoke = (p: Pen, t: number, col = "238,232,222") => {
  const g = p.g, a = 0.85 * (1 - t) ** 1.2;
  for (const [x, y, rr] of [[128, 140, 70], [90, 120, 50], [168, 118, 54], [128, 96, 52]] as const) {
    const gr = g.createRadialGradient(x, y, 0, x, y, rr);
    gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(0.75, `rgba(${col},${a * 0.8})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill();
  }
};
/** cartoon dust cloud with ink outline (hard card) on a 300 x 200 canvas, t in 0..1 */
export const fxDust = (p: Pen, t: number) => {
  const k = 1 - t;
  if (k < 0.05) return;
  for (const [x, y, r] of [[80, 140, 50], [150, 120, 66], [225, 140, 48], [150, 160, 60]] as const)
    p.ell(x + (x - 150) * t * 0.5, y - t * 30, r * (0.6 + 0.6 * t) * Math.min(1, k * 2), r * (0.5 + 0.5 * t) * Math.min(1, k * 2), "#eadcc0", 7);
};
/** speed lines on a 600 x 300 canvas (horizontal streaks, seeded) */
export const fxSpeed = (p: Pen, seed: number) => {
  let s = seed * 7919 + 13;
  const r = () => { s = (s * 16807) % 2147483647; return (s % 10000) / 10000; };
  for (let i = 0; i < 9; i++) {
    const y = 20 + r() * 260, x0 = r() * 200, l = 180 + r() * 220;
    p.stroke([[x0, y], [x0 + l, y]], 6 + r() * 6, "rgba(255,255,255,0.95)");
  }
};
/** the hose's water stream on a 1000 x 500 canvas: an arc from the nozzle (left, 60,190) to the flowers (right).
 *  a..b = which part of the arc carries water (after the stop the tail leaves the nozzle and the arc empties) */
export const fxWater = (p: Pen, a: number, b: number, wob: number) => {
  if (b - a < 0.01) return;
  const P = (t: number): P2 => [60 + 860 * t, 190 - 210 * t + 330 * t * t + 6 * Math.sin(t * 18 + wob)];
  const pts: P2[] = [];
  for (let i = 0; i <= 40; i++) { const t = a + ((b - a) * i) / 40; pts.push(P(t)); }
  p.line(pts, "#bfe6ff", 22);
  p.stroke(pts.map(([x, y]) => [x, y - 4] as P2), 7, "#ffffff");
  for (let i = 0; i < 7; i++) {
    const t = a + (b - a) * ((i * 0.37 + wob * 0.05) % 1), [x, y] = P(t);
    p.ell(x + 10, y + 18, 7, 9, "#bfe6ff", 4);
  }
  if (b > 0.98) for (let i = 0; i < 4; i++) { const [x, y] = P(1); p.ell(x - 30 + i * 22, y + 4 - (i % 2) * 10, 10, 12, "#bfe6ff", 5); }
};
/** a drop hanging at the nozzle / a puff of the last drip, 200 x 200 */
export const fxDrip = (p: Pen) => { p.ell(100, 110, 18, 24, "#bfe6ff", 6); p.ell(94, 100, 5, 7, "#ffffff", 0); };
/** the electric firing signal: a bright spark with a zig-zag tail, 300 x 200, pointing toward -x of the card */
export const fxSignal = (p: Pen, seed: number) => {
  let s = seed * 104729 + 7;
  const r = () => { s = (s * 16807) % 2147483647; return (s % 10000) / 10000; };
  const pts: P2[] = [];
  for (let i = 0; i <= 8; i++) pts.push([90 + i * 22, 100 + (i % 2 ? -1 : 1) * (10 + 14 * r())]);
  p.line(pts, "#ffe14a", 9);
  p.ell(90, 100, 34, 34, "#fff3a0", 7);
  p.ell(90, 100, 16, 16, "#ffffff", 0);
};
/** fizzle: the signal dying in a curl of grey smoke with a few dim sparks, 300 x 300, t 0..1 */
export const fxFizzle = (p: Pen, t: number) => {
  const k = clamp01(t);
  for (let i = 0; i < 3; i++) {
    const r = 26 + 30 * k + i * 8, x = 150 + Math.sin(i * 2.1 + k * 3) * 20, y = 190 - 90 * k - i * 34;
    p.ell(x, y, r * (1 - 0.25 * i), r * 0.8 * (1 - 0.25 * i), `rgba(150,150,155,${(0.9 * (1 - k)).toFixed(3)})`, 0);
  }
  if (k < 0.5) for (let i = 0; i < 4; i++) { const a = rad(i * 90 + 45 + k * 90); p.dot(150 + Math.cos(a) * (30 + 60 * k), 200 + Math.sin(a) * (30 + 60 * k), 7 * (1 - 2 * k), "#ffd54a"); }
};
/** "?" free puzzled mark: three little tilted dashes over a head (no text), 200 x 200 */
export const fxPuzzle = (p: Pen, t: number) => {
  const k = Math.sin(Math.PI * clamp01(t));
  if (k < 0.05) return;
  for (const [a, l] of [[-30, 60], [0, 70], [30, 60]] as const) {
    const b = rad(a - 90);
    p.stroke([[100 + 30 * Math.cos(b), 170 + 30 * Math.sin(b)], [100 + (30 + l * k) * Math.cos(b), 170 + (30 + l * k) * Math.sin(b)]], 12, INK);
  }
};
