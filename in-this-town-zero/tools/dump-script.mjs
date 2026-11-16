// Writes build/script.json (narration lines + sound cues) from src/shots.js
import fs from 'fs';
import { SHOTS } from '../src/shots.js';
fs.mkdirSync(new URL('../build/', import.meta.url), { recursive: true });
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const out = SHOTS.map(s => {
  let env = typeof s.env === 'function' ? s.env(0.5, 0.5) : s.env; if (Array.isArray(env)) env = env[0];
  const c0 = s.cam(0, 0), c1 = s.cam(0.2, 0.25);
  const whoosh = dist(c0.p, c1.p) > 0.12 * dist(c0.p, c0.l);
  return { id: s.id, text: s.t, gap: s.gap ?? 0.1, dur: s.dur ?? null, env, flash: s.flash || [], sfx: s.sfx || [], hb: s.hb || null, hb2: s.hb2 || null, whoosh };
});
fs.writeFileSync(new URL('../build/script.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(out.length, 'shots,', out.filter(o => o.text).map(o => o.text).join(' ').split(/\s+/).length, 'words,', out.filter(o => o.whoosh).length, 'whooshes');
