// Headless renderer. Modes:
//   sheet  [--w 270] [--frac 0.5] [--from i] [--to j]   one labelled frame per shot -> build/sheet/
//   stills --times 1.2,3.4 [--w 540]                      -> build/stills/
//   render --from f0 --to f1 [--fps 30] [--w 1080] --out file.mp4
import http from 'http'; import fs from 'fs'; import path from 'path'; import { spawn } from 'child_process';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2), mode = args[0];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const w = +opt('w', mode === 'render' ? 1080 : mode === 'sheet' ? 270 : 540);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text().slice(0, 600)); });
page.on('pageerror', e => console.log('[pageerror]', String(e.stack || e).slice(0, 1200)));
await page.goto(`http://127.0.0.1:${port}/src/index.html?w=${w}&sm=${opt("sm", 4096)}`);
await page.waitForFunction('window.READY || window.BOOT_ERROR', null, { timeout: 120000 });
if (await page.evaluate('window.BOOT_ERROR')) { console.log(await page.evaluate('window.BOOT_ERROR')); process.exit(1); }
const total = await page.evaluate('window.TOTAL'), shots = await page.evaluate('window.TLS');
const save = (file, dataUrl) => fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
if (mode === 'sheet') {
  const dir = path.join(root, 'build/sheet'); fs.mkdirSync(dir, { recursive: true });
  const frac = +opt('frac', 0.5), from = +opt('from', 0), to = +opt('to', shots.length - 1);
  const t0 = Date.now();
  for (let i = from; i <= to; i++) { const s = shots[i]; save(path.join(dir, String(i).padStart(3, '0') + '.jpg'), await page.evaluate(([t, l]) => window.grabLabeled(t, l), [s.start + s.dur * frac, `${i} ${s.id}`])); }
  console.log('sheet', from, to, ((Date.now() - t0) / (to - from + 1)).toFixed(0), 'ms/frame');
} else if (mode === 'stills') {
  const dir = path.join(root, 'build/stills'); fs.mkdirSync(dir, { recursive: true });
  for (const t of opt('times', '0').split(',').map(Number)) save(path.join(dir, `t${t.toFixed(2)}.jpg`), await page.evaluate(t => window.grab(t, 0.92), t));
} else if (mode === 'render') {
  const fps = +opt('fps', 30), f0 = +opt('from', 0), f1 = +opt('to', Math.ceil(total * fps)), out = opt('out', 'build/seg.mp4');
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    const d = await page.evaluate(t => window.grab(t, 0.95), f / fps);
    if (!ff.stdin.write(Buffer.from(d.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - f0) % 150 === 0) console.log(out, f - f0, '/', f1 - f0, ((Date.now() - t0) / (f - f0 + 1)).toFixed(0), 'ms/frame');
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
}
await browser.close(); server.close();
