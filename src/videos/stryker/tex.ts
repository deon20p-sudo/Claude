// Hand-painted canvas textures for the Stryker short (cached by key through paint.ts ctex): concrete apron with
// painted-in seams, desert sand, vehicle hull panels, aircraft skin, corrugated hangar metal, stucco, clapboard,
// HESCO fabric, sandbags, the briefing map and the two portraits. Seams are dark tints, never pure black (the world
// ink pass draws the real lines).
import { ctex, jit } from "./paint";
import { Pen, bodyFront, soldier, INK } from "./toon";

const seam = "rgba(52,44,40,0.55)";

/** 10 x 10 m tile of concrete slabs (2 x 2 slabs of 5 m), joints, patches, oil spots and tyre scuffs */
export const concreteHD = () => ctex("concreteHD", 1024, 1024, (g, r) => {
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    g.fillStyle = jit(r, "#a7a49d", 0.05, 4, 0.2); g.fillRect(i * 512, j * 512, 512, 512);
    for (let k = 0; k < 140; k++) { g.fillStyle = `rgba(${r() < 0.5 ? "255,255,250" : "60,55,50"},${0.04 + 0.05 * r()})`; const s = 4 + 30 * r(); g.fillRect(i * 512 + r() * 512, j * 512 + r() * 512, s, s * (0.3 + r())); }
  }
  g.fillStyle = "rgba(40,36,34,0.18)";
  for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 20 + 40 * r(), 12 + 20 * r(), r() * 3, 0, 7); g.fill(); }
  g.strokeStyle = "rgba(70,64,60,0.12)"; g.lineWidth = 26;
  for (let k = 0; k < 3; k++) { g.beginPath(); const y = r() * 1024; g.moveTo(0, y); g.bezierCurveTo(300, y + 80 * r(), 700, y - 80 * r(), 1024, y + 40 * r()); g.stroke(); }
  g.fillStyle = seam;
  for (const p of [0, 512]) { g.fillRect(p, 0, 7, 1024); g.fillRect(0, p, 1024, 7); }
});
/** yellow taxi line on concrete (one 10 m tile, line along v) */
export const taxiLineHD = () => ctex("taxiLine", 256, 1024, (g) => {
  g.fillStyle = "#e5b93a"; g.fillRect(0, 0, 256, 1024);
  g.fillStyle = "rgba(120,90,30,0.25)"; for (let y = 0; y < 1024; y += 37) g.fillRect(0, y, 256, 6);
});
export const sandHD = (key = "sandHD", base = "#dcc28e") => ctex(key, 1024, 1024, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 1024, 1024);
  for (let k = 0; k < 60; k++) {
    g.strokeStyle = `rgba(${r() < 0.5 ? "255,240,210" : "150,110,70"},${0.12 + 0.1 * r()})`; g.lineWidth = 6 + 10 * r();
    const y = r() * 1024, x = r() * 1024;
    g.beginPath(); g.moveTo(x - 120, y); g.quadraticCurveTo(x, y - 18 * r(), x + 120, y + 6); g.stroke();
  }
  for (let k = 0; k < 2500; k++) { g.fillStyle = r() < 0.5 ? "rgba(120,90,55,0.35)" : "rgba(255,245,220,0.35)"; g.fillRect(r() * 1024, r() * 1024, 2 + 3 * r(), 2 + 3 * r()); }
  for (let k = 0; k < 18; k++) { g.fillStyle = jit(r, "#a88a5c", 0.15); g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 6 + 10 * r(), 4 + 6 * r(), 0, 0, 7); g.fill(); }
});
/** armoured hull panels: base colour, panel seams every ~0.9 m, bolt rows, dust toward the bottom (v = 0) */
export const hullHD = (key: string, base: string) => ctex("hull" + key, 1024, 1024, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 1024, 1024);
  for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(${r() < 0.6 ? "255,250,235" : "70,55,40"},${0.03 + 0.05 * r()})`; g.fillRect(r() * 1024, r() * 1024, 40 + 200 * r(), 20 + 120 * r()); }
  g.fillStyle = "rgba(60,48,36,0.42)";
  for (const x of [0, 340, 700]) g.fillRect(x, 0, 6, 1024);
  for (const y of [0, 460]) g.fillRect(0, y, 1024, 6);
  g.fillStyle = "rgba(55,45,35,0.5)";
  for (const y of [30, 490]) for (let x = 20; x < 1024; x += 64) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
  const gr = g.createLinearGradient(0, 1024, 0, 700); gr.addColorStop(0, "rgba(150,120,80,0.45)"); gr.addColorStop(1, "rgba(150,120,80,0)");
  g.fillStyle = gr; g.fillRect(0, 700, 1024, 324);
});
/** aircraft skin: panels, rivet rows, a darker anti-glare tone variation */
export const skinHD = (key: string, base: string) => ctex("skin" + key, 1024, 1024, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = jit(r, base, 0.035, 2, 0.1); g.fillRect(i * 256 + 3, j * 256 + 3, 250, 250); }
  g.fillStyle = "rgba(40,44,50,0.35)";
  for (let p = 0; p <= 1024; p += 256) { g.fillRect(p, 0, 4, 1024); g.fillRect(0, p, 1024, 4); }
  g.fillStyle = "rgba(40,44,50,0.28)";
  for (let p = 0; p < 1024; p += 256) for (let q = 8; q < 1024; q += 18) { g.fillRect(p + 12, q, 3, 3); g.fillRect(q, p + 12, 3, 3); }
});
export const corrugatedHD = (key: string, base: string) => ctex("corr" + key, 512, 512, (g) => {
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 32) {
    const gr = g.createLinearGradient(x, 0, x + 32, 0);
    gr.addColorStop(0, "rgba(255,255,255,0.18)"); gr.addColorStop(0.5, "rgba(0,0,0,0.12)"); gr.addColorStop(1, "rgba(255,255,255,0.18)");
    g.fillStyle = gr; g.fillRect(x, 0, 32, 512);
  }
  g.fillStyle = "rgba(90,70,60,0.18)"; g.fillRect(0, 470, 512, 42);
});
/** stucco: blotchy plaster, a few hairline cracks, darker dust at the base (v = 0) */
export const plasterHD = (key: string, base: string) => ctex("plaster" + key, 1024, 1024, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 1024, 1024);
  for (let k = 0; k < 90; k++) { g.fillStyle = `rgba(${r() < 0.55 ? "255,248,232" : "120,90,60"},${0.04 + 0.06 * r()})`; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 20 + 90 * r(), 14 + 60 * r(), r() * 3, 0, 7); g.fill(); }
  g.strokeStyle = "rgba(90,70,55,0.45)"; g.lineWidth = 3;
  for (let k = 0; k < 5; k++) { let x = r() * 1024, y = r() * 1024; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (r() - 0.5) * 60; y += 20 + 25 * r(); g.lineTo(x, y); } g.stroke(); }
  const gr = g.createLinearGradient(0, 1024, 0, 820); gr.addColorStop(0, "rgba(140,105,70,0.5)"); gr.addColorStop(1, "rgba(140,105,70,0)");
  g.fillStyle = gr; g.fillRect(0, 820, 1024, 204);
});
export const clapboardHD = (key: string, base: string) => ctex("clap" + key, 512, 512, (g, r) => {
  for (let y = 0; y < 512; y += 32) {
    g.fillStyle = jit(r, base, 0.03, 2, 0.05); g.fillRect(0, y, 512, 32);
    g.fillStyle = "rgba(60,60,80,0.35)"; g.fillRect(0, y + 28, 512, 4);
    g.fillStyle = "rgba(255,255,255,0.25)"; g.fillRect(0, y, 512, 3);
  }
});
export const hescoHD = () => ctex("hesco", 512, 512, (g, r) => {
  g.fillStyle = "#cdb487"; g.fillRect(0, 0, 512, 512);
  for (let k = 0; k < 400; k++) { g.fillStyle = `rgba(${r() < 0.5 ? "255,240,210" : "120,95,60"},0.15)`; g.fillRect(r() * 512, r() * 512, 6, 6); }
  g.strokeStyle = "rgba(80,78,72,0.75)"; g.lineWidth = 5;
  for (let p = 0; p <= 512; p += 64) { g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 512); g.moveTo(0, p); g.lineTo(512, p); g.stroke(); }
});
export const sandbagHD = () => ctex("sandbag", 512, 256, (g, r) => {
  g.fillStyle = "#b9a374"; g.fillRect(0, 0, 512, 256);
  for (let row = 0; row < 4; row++) for (let i = -1; i < 4; i++) {
    const x = i * 160 + (row % 2) * 80, y = row * 64;
    g.fillStyle = jit(r, "#c9b384", 0.06, 3, 0.1);
    g.beginPath(); g.ellipse(x + 80, y + 32, 76, 28, 0, 0, 7); g.fill();
    g.strokeStyle = "rgba(90,70,45,0.6)"; g.lineWidth = 4; g.stroke();
    g.strokeStyle = "rgba(110,90,60,0.35)"; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 20, y + 32); g.lineTo(x + 140, y + 32); g.stroke();
  }
});
/** the briefing board: a cartoon world map with no text (blue sea, sand continents, a star for home) */
export const mapTex = () => ctex("worldmap", 1200, 800, (g) => {
  const p = new Pen(g);
  g.fillStyle = "#f3ead2"; g.fillRect(0, 0, 1200, 800);
  g.fillStyle = "#7fb6dc"; g.fillRect(40, 40, 1120, 720);
  const land = "#e5c784";
  const blob = (pts: [number, number][]) => p.poly(pts, land, 8);
  blob([[120, 160], [330, 120], [420, 190], [360, 300], [300, 330], [260, 420], [210, 360], [140, 300]]); // N America
  blob([[300, 440], [380, 470], [400, 560], [350, 690], [310, 650], [290, 540]]);                        // S America
  blob([[560, 150], [700, 130], [690, 220], [610, 260], [560, 230]]);                                    // Europe
  blob([[580, 300], [720, 290], [760, 400], [700, 600], [640, 610], [590, 450]]);                         // Africa
  blob([[720, 130], [1040, 140], [1100, 260], [980, 360], [880, 420], [800, 330], [720, 260]]);           // Asia
  blob([[960, 520], [1080, 510], [1100, 600], [990, 620]]);                                               // Australia
  // home star
  const star: [number, number][] = [];
  for (let k = 0; k < 10; k++) { const a = (k * Math.PI) / 5 - Math.PI / 2, rr = k % 2 ? 14 : 34; star.push([270 + rr * Math.cos(a), 250 + rr * Math.sin(a)]); }
  p.poly(star, "#d8423a", 6);
  g.strokeStyle = INK; g.lineWidth = 14; g.strokeRect(40, 40, 1120, 720);
});
/** framed portrait of a soldier of another era: WWII (olive steel helmet) or Vietnam (camouflage helmet cover).
 *  Drawn with the cast's own pen from the waist up, sepia or faded-colour background, wooden frame. */
export const portraitTex = (era: "ww2" | "vietnam") => ctex("portrait" + era, 600, 760, (g) => {
  g.fillStyle = "#6b4a2e"; g.fillRect(0, 0, 600, 760);
  g.fillStyle = "#8a6440"; g.fillRect(16, 16, 568, 728);
  g.fillStyle = era === "ww2" ? "#d9c7a2" : "#b9cfc4"; g.fillRect(48, 48, 504, 664);
  g.save(); g.beginPath(); g.rect(48, 48, 504, 664); g.clip();
  g.translate(300 - 300 * 1.25, 120 - 140 * 1.25); g.scale(1.25, 1.25);
  const o = soldier(era === "ww2" ? 1 : 2, { hat: era === "ww2" ? "helmet_ww2" : "helmet_vn", jacket: era === "ww2" ? "#6f6a45" : "#4f6b3e", rifle: false, belt: null, buttons: "#4a4630" });
  bodyFront(new Pen(g), o, { mode: "stand", expr: "neutral", seed: era === "ww2" ? 3 : 6, facing: era === "ww2" ? 1 : -1 });
  g.restore();
  g.strokeStyle = INK; g.lineWidth = 10; g.strokeRect(48, 48, 504, 664); g.strokeRect(5, 5, 590, 750);
  // medal on a blue ribbon under the frame is a separate prop; a small brass name plate without text
  g.fillStyle = "#d8b24a"; g.fillRect(230, 690, 140, 40); g.strokeStyle = INK; g.lineWidth = 6; g.strokeRect(230, 690, 140, 40);
});
/** Medal of Honor pictogram: light-blue ribbon, gold star (no text) */
export const medalTex = () => ctex("medal", 256, 320, (g) => {
  const p = new Pen(g);
  p.poly([[78, 10], [178, 10], [178, 110], [128, 140], [78, 110]], "#6aa4dc", 7);
  for (const x of [100, 128, 156]) p.dot(x, 60, 7, "#ffffff");
  const star: [number, number][] = [];
  for (let k = 0; k < 10; k++) { const a = (k * Math.PI) / 5 - Math.PI / 2, rr = k % 2 ? 40 : 92; star.push([128 + rr * Math.cos(a), 218 + rr * Math.sin(a)]); }
  p.poly(star, "#f0c64a", 8);
  p.ell(128, 218, 26, 26, "#6aa86a", 6);
});
