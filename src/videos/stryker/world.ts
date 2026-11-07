// The whole short as one three.js scene: sky dome, camera-relative sun frozen per shot, fog = horizon colour,
// clouds, the three sets (airfield, desert town, garden; only the shot's zone is shown), the posable vehicles and
// the cast. update(id, f, camera) poses everything for shot `id` at frame f (a pure function of id + f).
import * as THREE from "three";
import { buildSets, Sets, StrykerModel, PlaneModel, TankModel, rpgModel, C130_SPEC, BIG_SPEC, hoseGeo, hosePath, V } from "./build";
import { cloudHD, ctex } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { FPS, SHOTS, C130, BIG, YARD, WARHEAD, TOWN, CAGE_HIT, RPG_PASS, PINCH_F, DUD_DROP, DUD_HIT, camAt, strykerAt, tankAt, planeTip, groundY, ShotDef, V3 } from "./story";

const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const haloTex = () => ctex("sunHalo", 256, 256, (g) => {
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
});
/** per-shot sun (degrees from the shot camera's mean forward axis; + = screen right) */
const SUN_SHOT: Record<number, { az?: number; el?: number }> = {
  1: { az: 70, el: 42 }, 2: { az: 110, el: 40 }, 4: { az: 120, el: 50 }, 5: { az: 140, el: 55 }, 7: { az: -60, el: 46 }, 8: { az: 65 },
  11: { az: 115, el: 14 }, 12: { az: 70, el: 50 }, 14: { az: 60, el: 44 }, 15: { az: 70, el: 38 },
};

export class World {
  root = new THREE.Group();
  private pool = new Pool(); private actors: Actor[] = []; private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>; private clouds: THREE.Mesh[] = [];
  private sets: Sets;
  private stryker: StrykerModel; private c130: PlaneModel; private big: PlaneModel; private tank: TankModel;
  private rpg: THREE.Group; private warhead: THREE.Group;
  private hoseKey = "";
  private frustum = new THREE.Frustum(); private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor() {
    const R = this.root;
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() }, c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el)); c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el)); c = mix(c, c4, smoothstep(e.z, e.w, el)); gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK); R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
    this.sunDisc.renderOrder = -0.5; this.sunHalo.renderOrder = 5;
    for (const m of [this.sunDisc, this.sunHalo]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6); this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    R.add(this.hemi, this.sun, this.sun.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      m.layers.set(NOINK); this.clouds.push(m); R.add(m);
    }
    this.sets = buildSets(R);
    this.stryker = new StrykerModel(R);
    this.c130 = new PlaneModel(this.sets.air, C130_SPEC, [C130.x, 0, C130.door]);
    this.big = new PlaneModel(this.sets.air, BIG_SPEC, [BIG.x, 0, BIG.door]);
    this.tank = new TankModel(this.sets.air);
    this.rpg = rpgModel(this.sets.town, 1.6);
    this.warhead = rpgModel(this.sets.town, 2.2);
    this.warhead.position.set(WARHEAD[0] + 1.0, WARHEAD[1] + 0.2, WARHEAD[2]); this.warhead.rotation.set(0, 0, 0.04);
  }

  /** camera-relative sun frozen per shot: the shot's mean view direction turned by az toward screen right, lifted by el */
  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) { const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1; fx += x / n; fz += z / n; }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(SUN_SHOT[id]?.az ?? L.az), el = THREE.MathUtils.degToRad(SUN_SHOT[id]?.el ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }
  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light], K = LOOK[s.light];
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.1; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    // ---- zones ----
    this.sets.air.visible = s.zone === "air"; this.sets.town.visible = s.zone === "town"; this.sets.garden.visible = s.zone === "garden";
    // ---- light rig ----
    const sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.1 + 6, 10, 70);
    if (s.light === "golden") Rr = Math.max(Rr, 24);
    if (id === 15) Rr = 60;
    this.sun.position.copy(focus).addScaledVector(sunDir, 200); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 450; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad; CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog, sun disc, clouds ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg)); su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = s.zone === "air" ? L.fogFar * 1.4 : L.fogFar;
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden";
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900); this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    this.clouds.forEach((m, i) => {
      const a = (i / 12) * Math.PI * 2 + 0.3 + id * 0.0, d = 640 + (i % 3) * 60, w = 140 + (i % 4) * 34;
      m.position.set(cam.position.x + Math.cos(a) * d + t * 1.5, 110 + (i % 4) * 36, cam.position.z + Math.sin(a) * d);
      m.scale.set(w, w / 2, 1); m.lookAt(cam.position.x, m.position.y, cam.position.z);
      (m.material as THREE.MeshBasicMaterial).map = this.cloudMaps[s.light][i % 4];
    });
    // ---- vehicles ----
    const sp = strykerAt(id, f);
    this.stryker.root.visible = !!sp && sp.show;
    if (sp) this.stryker.pose(sp, groundY, sp.speed ? 0.02 * Math.sin(f * 2.1) : 0);
    this.c130.root.visible = s.zone === "air";
    this.c130.pose(planeTip(id, f), t);
    this.big.root.visible = id === 15;
    this.big.pose(0, t);
    this.tank.root.visible = id === 3;
    if (id === 3) {
      const tp = tankAt(f), a = 2.4, b = -2.6, yf = groundYTipped(tp.x, tp.z + a, planeTip(id, f)), yr = groundYTipped(tp.x, tp.z + b, planeTip(id, f));
      const pitch = Math.atan2(yf - yr, a - b);
      this.tank.root.position.set(tp.x, 0, tp.z); this.tank.body.position.set(0, yr - b * Math.sin(pitch), 0); this.tank.body.rotation.set(-pitch, 0, 0);
    }
    this.poseRpg(id, f);
    this.warhead.visible = id === 10;
    // ---- hatch (commander) ----
    this.stryker.root.updateMatrixWorld(true);
    const hatch = this.stryker.root.visible ? this.stryker.hatch.getWorldPosition(new THREE.Vector3()) : null;
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const kidHand0 = V(-600 + 0.55, 1.0, 0);
    const hc = hosePath(kidHand0);
    const st = stage(id, f, { pos: cam.position, right, sun: sunDir, light: s.light, hatch, hosePt: (u) => hc.getPointAt(u) });
    if (s.zone === "garden" && st.hand) {
      const key = `${st.hand.x.toFixed(3)},${st.hand.y.toFixed(3)},${st.hand.z.toFixed(3)},${st.pinch.toFixed(2)}`;
      if (key !== this.hoseKey) { this.sets.hose.geometry.dispose(); this.sets.hose.geometry = hoseGeo(st.hand, 0.42, st.pinch * 0.75); this.hoseKey = key; }
    }
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 2.5))) continue;
      const a = this.actor(ai++), [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true; a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      a.mesh.castShadow = L.actorShadow;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e2 = this.fx(fi++);
      e2.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e2.use(!!p.soft); e2.mesh.visible = true; e2.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e2.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else if (p.face !== undefined) e2.mesh.rotation.set(0, p.face, p.rot ?? 0);
      else { e2.mesh.quaternion.copy(cam.quaternion); e2.mesh.rotateZ(p.rot ?? 0); }
      e2.mesh.scale.set(p.w, p.h, 1);
      fused.push(e2);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e2 of fused) e2.bind();
    return focus;
  }

  /** the rocket: shot 7 whoosh along -x past the vehicle's front, shot 12 slow push into the cage, shot 13 the dud drop */
  private poseRpg(id: number, f: number) {
    const r = this.rpg;
    r.visible = false;
    if (id === 7) {
      const u = (f - 902) / 33;
      if (u < 0 || u > 1.1) return;
      r.visible = true; r.position.set(TOWN + 6 - 12 * u, 2.8, 4.2); r.rotation.set(0, Math.PI, 0.02);
    } else if (id === 12 || id === 13) {
      r.visible = true;
      const [hx, hy, hz] = CAGE_HIT as V3;
      if (id === 12) {
        const u = Math.min(1, (f - 1424) / (PINCH_F - 1424));
        const wob = f > PINCH_F ? 0.05 * Math.sin((f - PINCH_F) * 0.9) * Math.exp(-(f - PINCH_F) / 10) : 0;
        r.position.set(hx + 2.6 * (1 - u) - 0.04, hy + 0.15 * (1 - u), hz); r.rotation.set(0, Math.PI, wob - 0.05 * (1 - u));
      } else {
        const tt = Math.max(0, f - DUD_DROP) / FPS, g = 9.8;
        let y = hy - 0.5 * g * tt * tt, x = hx + 0.25 * tt, rz = -2.2 * tt;
        if (f >= DUD_HIT) { const t2 = (f - DUD_HIT) / FPS; y = Math.max(0.09, 0.09 + 2.0 * t2 - 0.5 * g * t2 * t2); x = hx + 0.25 * (DUD_HIT - DUD_DROP) / FPS + 0.9 * Math.min(t2, 0.55); rz = -1.4 - 3.0 * Math.min(t2, 0.4); }
        if (f >= DUD_HIT + 12) { const t3 = (f - DUD_HIT - 12) / FPS; y = Math.max(0.09, 0.09 + 0.9 * t3 - 0.5 * g * t3 * t3); x = hx + 0.25 * (DUD_HIT - DUD_DROP) / FPS + 0.5 + 0.4 * Math.min(t3, 0.4); rz = -2.6 - 0.6 * Math.min(t3, 0.3); }
        r.position.set(x, y, hz); r.rotation.set(0, Math.PI, rz);
      }
    }
  }
}
/** ground under the tank on the tipping C-130 ramp (the ramp rotates with the plane about its toe) */
const groundYTipped = (x: number, z: number, tip: number) => {
  const toe = C130.door - C130.ramp;
  if (Math.abs(x - C130.x) > C130.halfW + 0.4 || z < toe) return 0;
  const base = groundY(x, z) - 0, dz = z - toe;
  return base * Math.cos(tip) + dz * Math.sin(tip);
};
void YARD;
