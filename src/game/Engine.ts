import * as THREE from "three";
import { bhFragment, bhVertex } from "./blackHoleShader";
import { CosmicAudio } from "./audio";

export interface HudState {
  earthYears: number;
  maxYears: number;
  dilation: number;
  distance: number;
  speed: number;
  fuel: number;
  cargo: number;
  uploaded: number;
  goal: number;
  docking: boolean;
  thrust: boolean;
  proximity: number;
}

export type EngineEvent =
  | { type: "message"; text: string }
  | { type: "collect"; value: number }
  | { type: "fuel" }
  | { type: "upload"; value: number }
  | { type: "survey"; name: string; value: number }
  | { type: "horizon" }
  | { type: "pause"; paused: boolean }
  | { type: "end"; reason: "tesseract" | "timeout" | "win"; score: number; years: number };

type Mode = "intro" | "play" | "tesseract" | "outro";

interface Orb {
  mesh: THREE.Group;
  r: number;
  angle: number;
  y: number;
  speed: number;
  value: number;
  kind: "quanta" | "fuel";
}

interface Planet {
  name: string;
  mesh: THREE.Group;
  r: number;
  angle: number;
  y: number;
  speed: number;
  radius: number;
  surveyed: boolean;
  line: string;
}

const GM = 6;
const MAX_YEARS = 60;
const GOAL = 150;
const ENDURANCE_R = 20;

function glowTexture(inner: string, outer: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.25, outer);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function planetTexture(base: [number, number, number], accent: [number, number, number], bands: number, seed: number) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d")!;
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  g.fillStyle = `rgb(${base.join(",")})`;
  g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < bands; i++) {
    const y = rnd() * 256;
    const h = 2 + rnd() * 18;
    const a = 0.08 + rnd() * 0.35;
    const mix = rnd();
    const col = base.map((b, k) => Math.round(b * (1 - mix) + accent[k] * mix));
    g.fillStyle = `rgba(${col.join(",")},${a})`;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 512; x += 16) g.lineTo(x, y + Math.sin(x * 0.02 + i) * h * 0.5 + (rnd() - 0.5) * 3);
    g.lineTo(512, y + h);
    g.lineTo(0, y + h);
    g.fill();
  }
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(${accent.join(",")},${rnd() * 0.18})`;
    g.beginPath();
    g.arc(rnd() * 512, rnd() * 256, rnd() * 10, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function atmosphere(color: THREE.Color, size: number) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(uColor*f*1.6, f); }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(size, 48, 32), mat);
}

export class Engine {
  canvas: HTMLCanvasElement;
  markerLayer: HTMLElement;
  onHud: (s: HudState) => void;
  onEvent: (e: EngineEvent) => void;
  audio = new CosmicAudio();

  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  bgScene = new THREE.Scene();
  bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  bgMat: THREE.ShaderMaterial;
  tessScene = new THREE.Scene();

  mode: Mode = "intro";
  paused = false;
  time = 0;
  raf = 0;
  last = performance.now();
  hudTimer = 0;

  ship = new THREE.Group();
  shipBody = new THREE.Group();
  engineGlows: THREE.Sprite[] = [];
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  quat = new THREE.Quaternion();
  bank = 0;
  fuel = 100;
  cargo = 0;
  uploaded = 0;
  earthYears = 0;
  dilation = 1;
  thrusting = false;
  docking = false;
  warp = 0;
  flags: Record<string, boolean> = {};

  endurance = new THREE.Group();
  enduranceRing = new THREE.Group();
  endAngle = 0.6;
  orbs: Orb[] = [];
  planets: Planet[] = [];
  dust!: THREE.Points;
  trail!: THREE.Points;
  trailPositions = new Float32Array(160 * 3);
  trailIndex = 0;
  glowGold = glowTexture("rgba(255,250,230,1)", "rgba(255,170,70,0.55)");
  glowBlue = glowTexture("rgba(230,245,255,1)", "rgba(90,170,255,0.55)");

  lattice = new THREE.Group();
  hyperLines!: THREE.LineSegments;
  hyperLines2!: THREE.LineSegments;
  hyperVerts: number[][] = [];
  hyperEdges: [number, number][] = [];

  keys: Record<string, boolean> = {};
  mouse = new THREE.Vector2();
  mouseDown = false;
  touchThrust = false;

  markerEnd: HTMLDivElement;
  markerOrb: HTMLDivElement;

  constructor(
    canvas: HTMLCanvasElement,
    markerLayer: HTMLElement,
    onHud: (s: HudState) => void,
    onEvent: (e: EngineEvent) => void
  ) {
    this.canvas = canvas;
    this.markerLayer = markerLayer;
    this.onHud = onHud;
    this.onEvent = onEvent;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    this.renderer.autoClear = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 800);
    this.camera.position.set(0, 3, 28);

    this.bgMat = new THREE.ShaderMaterial({
      vertexShader: bhVertex,
      fragmentShader: bhFragment,
      uniforms: {
        uRes: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uCamPos: { value: new THREE.Vector3() },
        uCamMat: { value: new THREE.Matrix4() },
        uTanHalfFov: { value: Math.tan(THREE.MathUtils.degToRad(30)) },
        uAspect: { value: 1 },
        uWarp: { value: 0 },
        uFade: { value: 0 },
      },
      depthWrite: false,
      depthTest: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.bgMat);
    quad.frustumCulled = false;
    this.bgScene.add(quad);

    this.buildLights();
    this.buildShip();
    this.buildEndurance();
    this.buildPlanets();
    this.buildDust();
    this.buildTrail();
    this.buildTesseract();
    for (let i = 0; i < 16; i++) this.orbs.push(this.spawnOrb("quanta"));
    for (let i = 0; i < 6; i++) this.orbs.push(this.spawnOrb("fuel"));

    this.markerEnd = this.makeMarker("ENDURANCE", "#e8e4dc");
    this.markerOrb = this.makeMarker("QUANTA", "#ffc27a");

    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointerup", this.onPointerUp);
    this.raf = requestAnimationFrame(this.loop);
  }

  buildLights() {
    const disk = new THREE.PointLight(0xffc48a, 3.2, 0, 0);
    disk.position.set(0, 0, 0);
    this.scene.add(disk);
    this.scene.add(new THREE.AmbientLight(0x404858, 0.6));
    const rim = new THREE.DirectionalLight(0x9fb8ff, 0.6);
    rim.position.set(-10, 20, -30);
    this.scene.add(rim);
  }

  buildShip() {
    const hull = new THREE.MeshStandardMaterial({ color: 0xd9d6cf, metalness: 0.35, roughness: 0.45 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1b1d22, metalness: 0.6, roughness: 0.3 });
    const accent = new THREE.MeshStandardMaterial({ color: 0x8a8578, metalness: 0.5, roughness: 0.5 });
    const b = this.shipBody;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.045, 0.3), hull);
    b.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.16, 4, 1), hull);
    nose.rotation.x = -Math.PI / 2;
    nose.rotation.y = Math.PI / 4;
    nose.scale.set(1, 1, 0.42);
    nose.position.z = -0.23;
    b.add(nose);
    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.08), dark);
    cockpit.position.set(0, 0.03, -0.1);
    b.add(cockpit);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.012, 0.11), hull);
    wing.position.set(0, -0.005, 0.07);
    b.add(wing);
    [-1, 1].forEach((s) => {
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.1), accent);
      tip.position.set(0.19 * s, 0.02, 0.08);
      b.add(tip);
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.07, 12), dark);
      eng.rotation.x = Math.PI / 2;
      eng.position.set(0.045 * s, 0, 0.17);
      b.add(eng);
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.glowBlue, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
      );
      glow.position.set(0.045 * s, 0, 0.215);
      glow.scale.setScalar(0.08);
      b.add(glow);
      this.engineGlows.push(glow);
    });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.152, 0.008, 0.04), accent);
    stripe.position.set(0, 0.024, 0.05);
    b.add(stripe);
    this.ship.add(b);
    this.ship.visible = false;
    this.scene.add(this.ship);
  }

  buildEndurance() {
    const hull = new THREE.MeshStandardMaterial({ color: 0xcfcac0, metalness: 0.4, roughness: 0.5 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.6, roughness: 0.4 });
    const R = 0.9;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const mod = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.24), i % 3 === 0 ? dark : hull);
      mod.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
      mod.rotation.y = -a;
      this.enduranceRing.add(mod);
      const link = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.24), dark);
      const a2 = a + Math.PI / 12;
      link.position.set(Math.cos(a2) * R * 0.98, 0, Math.sin(a2) * R * 0.98);
      link.rotation.y = -a2 + Math.PI / 2;
      this.enduranceRing.add(link);
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 12;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, R * 2, 6), dark);
      spoke.rotation.z = Math.PI / 2;
      spoke.rotation.y = -a;
      this.enduranceRing.add(spoke);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.3, 16), hull);
    this.enduranceRing.add(hub);
    this.endurance.add(this.enduranceRing);
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(1.45, 0.006, 8, 128),
      new THREE.MeshBasicMaterial({ color: 0xffd7a0, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending })
    );
    halo.rotation.x = Math.PI / 2;
    halo.name = "halo";
    this.endurance.add(halo);
    const beacon = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.glowGold, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 })
    );
    beacon.scale.setScalar(0.6);
    beacon.position.y = 0.2;
    this.endurance.add(beacon);
    this.endurance.rotation.x = 0.25;
    this.scene.add(this.endurance);
  }

  buildPlanets() {
    type PDef = Omit<Planet, "mesh" | "surveyed"> & { tex: THREE.Texture; atm: number };
    const defs: PDef[] = [
      {
        name: "MILLER", r: 5.6, angle: 2.2, y: 2.2, speed: 0.05, radius: 0.35,
        line: "Miller's world. Those aren't mountains... they're waves.",
        tex: planetTexture([30, 70, 105], [210, 230, 240], 50, 7), atm: 0x7fb6ff,
      },
      {
        name: "MANN", r: 28, angle: 4.1, y: -4, speed: 0.008, radius: 0.85,
        line: "Mann's world. Frozen clouds. Trust no one's data here.",
        tex: planetTexture([200, 210, 220], [120, 140, 165], 70, 31), atm: 0xdfefff,
      },
      {
        name: "EDMUNDS", r: 36, angle: 0.9, y: 5, speed: 0.005, radius: 1.0,
        line: "Edmunds' world. Breathable. Plan B lives here.",
        tex: planetTexture([150, 110, 70], [220, 190, 140], 60, 99), atm: 0xffd6a0,
      },
    ];
    for (const d of defs) {
      const g = new THREE.Group();
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(d.radius, 64, 48),
        new THREE.MeshStandardMaterial({ map: d.tex, roughness: 0.8, metalness: 0.05 })
      );
      g.add(m);
      g.add(atmosphere(new THREE.Color(d.atm), d.radius * 1.12));
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(d.radius * 1.9, 0.008, 6, 128),
        new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending })
      );
      ring.rotation.x = Math.PI / 2;
      ring.name = "surveyRing";
      g.add(ring);
      this.scene.add(g);
      this.planets.push({
        name: d.name, mesh: g, r: d.r, angle: d.angle, y: d.y, speed: d.speed, radius: d.radius, surveyed: false, line: d.line,
      });
    }
  }

  buildDust() {
    const N = 5000;
    const p = new Float32Array(N * 3);
    const c = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 3 + Math.pow(Math.random(), 0.7) * 45;
      const a = Math.random() * Math.PI * 2;
      const y = (Math.random() + Math.random() + Math.random() - 1.5) * (1 + r * 0.15);
      p[i * 3] = Math.cos(a) * r;
      p[i * 3 + 1] = y;
      p[i * 3 + 2] = Math.sin(a) * r;
      const w = Math.random();
      c[i * 3] = 0.8 + w * 0.2;
      c[i * 3 + 1] = 0.6 + w * 0.25;
      c[i * 3 + 2] = 0.45 + w * 0.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(p, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(c, 3));
    this.dust = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.035, vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false,
        map: this.glowGold,
      })
    );
    this.scene.add(this.dust);
  }

  buildTrail() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.trailPositions, 3));
    this.trail = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.05, color: 0x88c4ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, map: this.glowBlue,
      })
    );
    this.trail.frustumCulled = false;
    this.trail.visible = false;
    this.scene.add(this.trail);
  }

  buildTesseract() {
    this.tessScene.fog = new THREE.FogExp2(0x000000, 0.06);
    const amber = new THREE.LineBasicMaterial({ color: 0xffb066, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, fog: true });
    const pale = new THREE.LineBasicMaterial({ color: 0xffe2bf, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, fog: true });
    const cell = 2;
    const L = 60;
    const lines: number[] = [];
    const threads: number[] = [];
    for (let x = -8; x <= 8; x += cell) {
      for (let y = -6; y <= 6; y += cell) lines.push(x, y, 2, x, y, -L);
      for (let z = 2; z >= -L; z -= cell) lines.push(x, -6, z, x, 6, z);
    }
    for (let y = -6; y <= 6; y += cell) for (let z = 2; z >= -L; z -= cell) lines.push(-8, y, z, 8, y, z);
    for (let i = 0; i < 900; i++) {
      const x = (Math.random() - 0.5) * 16;
      const z = 2 - Math.random() * L;
      const y0 = -6;
      threads.push(x, y0, z, x + (Math.random() - 0.5) * 0.05, 6, z);
    }
    const g1 = new THREE.BufferGeometry();
    g1.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute("position", new THREE.Float32BufferAttribute(threads, 3));
    this.lattice.add(new THREE.LineSegments(g1, amber));
    this.lattice.add(new THREE.LineSegments(g2, pale));
    this.tessScene.add(this.lattice);

    const N = 1500;
    const dp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      dp[i * 3] = (Math.random() - 0.5) * 16;
      dp[i * 3 + 1] = (Math.random() - 0.5) * 12;
      dp[i * 3 + 2] = 2 - Math.random() * L;
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute("position", new THREE.BufferAttribute(dp, 3));
    this.lattice.add(
      new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.05, color: 0xffd29a, map: this.glowGold, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))
    );

    // 4D hypercube
    for (let i = 0; i < 16; i++) this.hyperVerts.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
    for (let i = 0; i < 16; i++) for (let j = i + 1; j < 16; j++) {
      const d = i ^ j;
      if (d && (d & (d - 1)) === 0) this.hyperEdges.push([i, j]);
    }
    const mk = (color: number, op: number) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.hyperEdges.length * 6), 3));
      const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending }));
      l.frustumCulled = false;
      l.position.z = -5;
      this.tessScene.add(l);
      return l;
    };
    this.hyperLines = mk(0xfff1d6, 1);
    this.hyperLines2 = mk(0xff9a4a, 0.5);
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowGold, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    core.scale.setScalar(2.4);
    core.position.z = -5;
    this.tessScene.add(core);
  }

  makeMarker(label: string, color: string) {
    const el = document.createElement("div");
    el.className = "marker";
    el.style.color = color;
    el.innerHTML = `<div style="display:flex;align-items:center;gap:8px;transform:translate(-9px,-9px)">
      <div class="mk-icon" style="width:18px;height:18px;border:1px solid ${color};transform:rotate(45deg);box-shadow:0 0 12px ${color}55"></div>
      <div><div>${label}</div><div class="mk-dist" style="opacity:.6"></div></div></div>`;
    el.style.display = "none";
    this.markerLayer.appendChild(el);
    return el;
  }

  spawnOrb(kind: "quanta" | "fuel", existing?: Orb): Orb {
    let r: number;
    if (kind === "quanta") r = 1.55 + Math.pow(Math.random(), 1.6) * 13;
    else r = 7 + Math.random() * 16;
    const angle = Math.random() * Math.PI * 2;
    const y = (Math.random() * 2 - 1) * Math.min(3, 0.3 + r * 0.22);
    const value = kind === "quanta" ? Math.round(3 + 24 / (r - 1)) : 0;
    let mesh = existing?.mesh;
    if (!mesh) {
      mesh = new THREE.Group();
      const color = kind === "quanta" ? 0xffc27a : 0x8fd0ff;
      const geo = kind === "quanta" ? new THREE.IcosahedronGeometry(0.11, 0) : new THREE.OctahedronGeometry(0.12, 0);
      const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.9 }));
      wire.name = "wire";
      mesh.add(wire);
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: kind === "quanta" ? this.glowGold : this.glowBlue, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
      );
      glow.scale.setScalar(0.5);
      mesh.add(glow);
      this.scene.add(mesh);
    }
    const s = kind === "quanta" ? 0.7 + Math.min(1.2, value / 25) : 1;
    mesh.scale.setScalar(s);
    mesh.visible = true;
    const o: Orb = existing ?? { mesh, r, angle, y, speed: 0, value, kind };
    o.r = r;
    o.angle = angle;
    o.y = y;
    o.value = value;
    o.speed = 0.35 / Math.sqrt(r);
    return o;
  }

  onKeyDown = (e: KeyboardEvent) => {
    this.keys[e.code] = true;
    if (e.code === "Space") e.preventDefault();
    if (e.code === "Escape" && this.mode === "play") this.setPaused(!this.paused);
  };
  onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };
  onPointerMove = (e: PointerEvent) => {
    this.mouse.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  };
  onPointerDown = (e: PointerEvent) => {
    this.onPointerMove(e);
    if (e.pointerType === "mouse" && e.button === 0) this.mouseDown = true;
  };
  onPointerUp = () => {
    this.mouseDown = false;
  };
  setTouchThrust(v: boolean) {
    this.touchThrust = v;
  }
  setPaused(p: boolean) {
    this.paused = p;
    this.onEvent({ type: "pause", paused: p });
  }
  setMuted(m: boolean) {
    this.audio.setMuted(m);
  }

  initAudio() {
    this.audio.init();
  }

  startGame() {
    this.audio.init();
    this.mode = "play";
    this.paused = false;
    this.fuel = 100;
    this.cargo = 0;
    this.uploaded = 0;
    this.earthYears = 0;
    this.flags = {};
    this.planets.forEach((p) => (p.surveyed = false));
    const ep = this.endurancePos();
    this.pos.copy(ep).multiplyScalar(1.07).add(new THREE.Vector3(0, 0.5, 0));
    const tangent = new THREE.Vector3(-Math.sin(this.endAngle), 0, Math.cos(this.endAngle));
    this.vel.copy(tangent).multiplyScalar(Math.sqrt(GM / this.pos.length()));
    const target = new THREE.Vector3(0, 0, 0).addScaledVector(tangent, 6);
    this.quat.setFromRotationMatrix(new THREE.Matrix4().lookAt(this.pos, target, new THREE.Vector3(0, 1, 0)));
    this.ship.visible = true;
    this.trail.visible = true;
    for (let i = 0; i < this.trailPositions.length; i += 3) {
      this.trailPositions[i] = this.pos.x;
      this.trailPositions[i + 1] = this.pos.y;
      this.trailPositions[i + 2] = this.pos.z;
    }
    const back = new THREE.Vector3(0, 0.5, 2).applyQuaternion(this.quat);
    this.camera.position.copy(this.pos).add(back.multiplyScalar(6));
    this.camera.quaternion.copy(this.quat);
    this.orbs.forEach((o) => this.spawnOrb(o.kind, o));
    this.onEvent({ type: "message", text: "TARS: Endurance undocked. Gargantua's quantum data is ours to take. Bring it home." });
  }

  toIntro() {
    this.mode = "intro";
    this.ship.visible = false;
    this.trail.visible = false;
    this.markerEnd.style.display = "none";
    this.markerOrb.style.display = "none";
  }

  endurancePos(out = new THREE.Vector3()) {
    return out.set(Math.cos(this.endAngle) * ENDURANCE_R, 0.4, Math.sin(this.endAngle) * ENDURANCE_R);
  }

  end(reason: "tesseract" | "timeout" | "win") {
    const score = reason === "tesseract" ? this.uploaded + this.cargo * 2 : this.uploaded;
    this.ship.visible = false;
    this.trail.visible = false;
    this.markerEnd.style.display = "none";
    this.markerOrb.style.display = "none";
    this.mode = reason === "tesseract" ? "tesseract" : "outro";
    if (reason === "tesseract") this.audio.boom();
    else this.audio.chime(reason === "win" ? 69 : 57, 0.15);
    this.onEvent({ type: "end", reason, score, years: this.earthYears });
  }

  resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.bgMat.uniforms.uRes.value.set(w, h);
  };

  loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused) this.time += dt;

    const u = this.bgMat.uniforms;
    u.uFade.value = Math.min(1, u.uFade.value + dt * 0.35);

    if (this.mode === "intro" || this.mode === "outro") this.updateCinematic(dt);
    else if (this.mode === "play" && !this.paused) this.updatePlay(dt);
    else if (this.mode === "tesseract") this.updateTesseract(dt);

    if (!this.paused) this.updateWorld(dt);

    this.renderer.clear();
    if (this.mode !== "tesseract") {
      this.camera.updateMatrixWorld();
      u.uTime.value = this.time;
      u.uCamPos.value.copy(this.camera.position);
      u.uCamMat.value.copy(this.camera.matrixWorld);
      u.uTanHalfFov.value = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      u.uAspect.value = this.camera.aspect;
      u.uWarp.value = this.warp;
      this.renderer.render(this.bgScene, this.bgCam);
      this.renderer.clearDepth();
      this.renderer.render(this.scene, this.camera);
    } else {
      this.renderer.render(this.tessScene, this.camera);
    }
  };

  updateCinematic(dt: number) {
    const t = this.time * 0.035;
    const r = 26 + Math.sin(this.time * 0.05) * 4;
    this.camera.position.set(Math.cos(t) * r, 2.0 + Math.sin(this.time * 0.07) * 1.4, Math.sin(t) * r);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(Math.sin(this.time * 0.03) * 2, 0, 0);
    this.camera.rotateZ(-0.12);
    this.camera.fov += (55 - this.camera.fov) * dt;
    this.camera.updateProjectionMatrix();
    this.warp *= 0.95;
    this.audio.update(dt, 1, 0.15, 0, false);
  }

  updateWorld(dt: number) {
    this.endAngle += dt * Math.sqrt(GM / ENDURANCE_R) / ENDURANCE_R;
    this.endurancePos(this.endurance.position);
    this.enduranceRing.rotation.y += dt * 0.6;
    const halo = this.endurance.getObjectByName("halo") as THREE.Mesh;
    (halo.material as THREE.MeshBasicMaterial).opacity = this.docking ? 0.9 : 0.25 + Math.sin(this.time * 3) * 0.1;

    for (const o of this.orbs) {
      o.angle += o.speed * dt;
      o.mesh.position.set(Math.cos(o.angle) * o.r, o.y + Math.sin(this.time + o.angle * 3) * 0.08, Math.sin(o.angle) * o.r);
      const w = o.mesh.getObjectByName("wire")!;
      w.rotation.x += dt * 1.3;
      w.rotation.y += dt * 0.9;
    }
    for (const p of this.planets) {
      p.angle += p.speed * dt;
      p.mesh.position.set(Math.cos(p.angle) * p.r, p.y, Math.sin(p.angle) * p.r);
      p.mesh.children[0].rotation.y += dt * 0.08;
      const ring = p.mesh.getObjectByName("surveyRing")!;
      ring.visible = this.mode === "play" && !p.surveyed;
      ring.rotation.z += dt * 0.4;
    }
    this.dust.rotation.y += dt * 0.004;
  }

  updatePlay(dt: number) {
    const k = this.keys;
    const dz = (v: number) => (Math.abs(v) < 0.06 ? 0 : (v - Math.sign(v) * 0.06) / 0.94);
    let yaw = -dz(this.mouse.x) * 1.7;
    let pitch = -dz(this.mouse.y) * 1.35;
    if (k.ArrowLeft) yaw += 1.4;
    if (k.ArrowRight) yaw -= 1.4;
    if (k.ArrowUp) pitch += 1.1;
    if (k.ArrowDown) pitch -= 1.1;
    let roll = 0;
    if (k.KeyA || k.KeyQ) roll += 1.8;
    if (k.KeyD || k.KeyE) roll -= 1.8;
    const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch * dt);
    const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw * dt);
    const qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll * dt);
    this.quat.multiply(qy).multiply(qx).multiply(qz).normalize();
    this.bank += (yaw * 0.35 - this.bank) * Math.min(1, dt * 4);

    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.quat);
    const wantThrust = k.KeyW || k.Space || this.mouseDown || this.touchThrust;
    const boost = k.ShiftLeft || k.ShiftRight;
    const retro = k.KeyS;
    let thrustAmt = 0;
    const acc = new THREE.Vector3();
    if (this.fuel > 0) {
      if (wantThrust) {
        thrustAmt = boost ? 1 : 0.6;
        acc.addScaledVector(fwd, boost ? 5.2 : 2.8);
        this.fuel -= dt * (boost ? 9 : 4);
      }
      if (retro) {
        const sp = this.vel.length();
        if (sp > 0.01) acc.addScaledVector(this.vel, -2.2 / sp);
        thrustAmt = Math.max(thrustAmt, 0.4);
        this.fuel -= dt * 3;
      }
      this.fuel = Math.max(0, this.fuel);
    }
    this.thrusting = thrustAmt > 0;

    const r = this.pos.length();
    const grav = this.pos.clone().multiplyScalar((-GM / (r * r * r)) * (1 + 2.2 / (r * r)));
    acc.add(grav);
    this.vel.addScaledVector(acc, dt);
    this.vel.multiplyScalar(1 - 0.02 * dt);
    const maxSp = 9;
    if (this.vel.length() > maxSp) this.vel.setLength(maxSp);
    this.pos.addScaledVector(this.vel, dt);

    const nr = this.pos.length();
    this.dilation = 1 / Math.sqrt(Math.max(0.002, 1 - 1 / nr));
    const yearsRate = 0.12 * Math.pow(this.dilation, 4);
    this.earthYears += yearsRate * dt;
    const proximity = THREE.MathUtils.clamp(1 - (nr - 1) / 12, 0, 1);
    this.warp = THREE.MathUtils.lerp(this.warp, Math.pow(proximity, 3) * 1.2, dt * 2);

    const ep = this.endurance.position;
    const dEnd = this.pos.distanceTo(ep);
    this.docking = dEnd < 1.5;
    if (this.docking) {
      if (this.cargo > 0) {
        const v = this.cargo;
        this.uploaded += v;
        this.cargo = 0;
        this.audio.chime(64, 0.14);
        this.onEvent({ type: "upload", value: v });
        this.onEvent({ type: "message", text: `TARS: ${v} quanta uploaded to Endurance. Professor Brand is crunching the equation.` });
      }
      if (this.fuel < 100) this.fuel = Math.min(100, this.fuel + dt * 30);
      this.vel.lerp(new THREE.Vector3(-Math.sin(this.endAngle), 0, Math.cos(this.endAngle)).multiplyScalar(Math.sqrt(GM / ENDURANCE_R)), dt * 0.8);
    }

    for (const o of this.orbs) {
      if (o.mesh.position.distanceTo(this.pos) < (o.kind === "quanta" ? 0.5 : 0.55)) {
        if (o.kind === "quanta") {
          this.cargo += o.value;
          this.audio.chime(72 + Math.min(12, Math.round(o.value / 4)), 0.08);
          this.onEvent({ type: "collect", value: o.value });
        } else {
          this.fuel = Math.min(100, this.fuel + 35);
          this.audio.chime(60, 0.08);
          this.onEvent({ type: "fuel" });
        }
        this.spawnOrb(o.kind, o);
      }
    }
    for (const p of this.planets) {
      const d = p.mesh.position.distanceTo(this.pos);
      if (!p.surveyed && d < p.radius * 2.0) {
        p.surveyed = true;
        this.cargo += 15;
        this.audio.chime(67, 0.12);
        this.onEvent({ type: "survey", name: p.name, value: 15 });
        this.onEvent({ type: "message", text: `TARS: ${p.line} +15 quanta.` });
      }
      if (d < p.radius + 0.08) {
        const n = this.pos.clone().sub(p.mesh.position).normalize();
        this.pos.copy(p.mesh.position).addScaledVector(n, p.radius + 0.08);
        const vn = this.vel.dot(n);
        if (vn < 0) this.vel.addScaledVector(n, -vn * 1.4);
      }
    }

    const say = (key: string, cond: boolean, text: string) => {
      if (cond && !this.flags[key]) {
        this.flags[key] = true;
        this.onEvent({ type: "message", text });
      }
    };
    say("r6", nr < 6, "TARS: We're deep in the well, Cooper. Every minute here costs years back home.");
    say("r3", nr < 3, "TARS: Honesty setting 90%: we should not be this close to the event horizon.");
    say("r1.6", nr < 1.7, "TARS: Cooper, this is no time for caution... but that is very much the horizon.");
    say("fuel", this.fuel < 20, "TARS: Fuel critical. Collect blue cells or dock with Endurance.");
    say("y30", this.earthYears > 30, "TARS: Thirty years have passed on Earth. Murph is older than you now.");
    say("y50", this.earthYears > 50, "TARS: Ten years left. Make them count.");
    say("full", this.cargo >= 60, "TARS: Cargo holds are heavy with data. Return to Endurance to upload.");

    if (nr < 1.12) {
      if (!this.flags.horizon) {
        this.flags.horizon = true;
        this.onEvent({ type: "horizon" });
      }
      this.end("tesseract");
      return;
    }
    if (this.uploaded >= GOAL) {
      this.end("win");
      return;
    }
    if (this.earthYears >= MAX_YEARS) {
      this.end("timeout");
      return;
    }

    this.ship.position.copy(this.pos);
    this.ship.quaternion.copy(this.quat);
    this.shipBody.rotation.z = this.bank;
    const flick = 0.85 + Math.random() * 0.3;
    this.engineGlows.forEach((g) => g.scale.setScalar((0.06 + thrustAmt * 0.22) * flick));

    const tail = new THREE.Vector3(0, 0, 0.24).applyQuaternion(this.quat).add(this.pos);
    const i3 = this.trailIndex * 3;
    this.trailPositions[i3] = tail.x + (Math.random() - 0.5) * 0.02;
    this.trailPositions[i3 + 1] = tail.y + (Math.random() - 0.5) * 0.02;
    this.trailPositions[i3 + 2] = tail.z + (Math.random() - 0.5) * 0.02;
    this.trailIndex = (this.trailIndex + 1) % (this.trailPositions.length / 3);
    this.trail.geometry.attributes.position.needsUpdate = true;
    (this.trail.material as THREE.PointsMaterial).opacity = 0.15 + thrustAmt * 0.5;

    const speed = this.vel.length();
    const offset = new THREE.Vector3(0, 0.22, 0.95 + speed * 0.04).applyQuaternion(this.quat);
    const desired = this.pos.clone().add(offset);
    const lerp = 1 - Math.exp(-dt * 7);
    this.camera.position.lerp(desired, lerp);
    this.camera.quaternion.slerp(this.quat, 1 - Math.exp(-dt * 5));
    const shake = Math.pow(proximity, 4) * 0.02 + thrustAmt * 0.002;
    this.camera.position.x += (Math.random() - 0.5) * shake;
    this.camera.position.y += (Math.random() - 0.5) * shake;
    const targetFov = 62 + speed * 1.6 + (boost && wantThrust ? 6 : 0);
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 3);
    this.camera.updateProjectionMatrix();

    this.audio.update(dt, Math.pow(this.dilation, 4), proximity, thrustAmt, true);

    this.updateMarker(this.markerEnd, ep, dEnd);
    let best: Orb | null = null;
    let bd = Infinity;
    for (const o of this.orbs) {
      if (o.kind !== "quanta") continue;
      const d = o.mesh.position.distanceTo(this.pos);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    if (best) this.updateMarker(this.markerOrb, best.mesh.position, bd, `+${best.value}`);

    this.hudTimer += dt;
    if (this.hudTimer > 0.1) {
      this.hudTimer = 0;
      this.onHud({
        earthYears: this.earthYears,
        maxYears: MAX_YEARS,
        dilation: this.dilation,
        distance: nr,
        speed,
        fuel: this.fuel,
        cargo: this.cargo,
        uploaded: this.uploaded,
        goal: GOAL,
        docking: this.docking,
        thrust: this.thrusting,
        proximity,
      });
    }
  }

  updateMarker(el: HTMLDivElement, world: THREE.Vector3, dist: number, extra = "") {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const v = world.clone().project(this.camera);
    const behind = v.z > 1;
    let x = v.x;
    let y = v.y;
    if (behind) {
      x = -x;
      y = -y;
    }
    const off = behind || Math.abs(x) > 0.92 || Math.abs(y) > 0.88;
    if (off) {
      const m = Math.max(Math.abs(x) / 0.92, Math.abs(y) / 0.85, 1e-3);
      x /= m;
      y /= m;
    }
    el.style.display = "block";
    el.style.opacity = off ? "0.55" : "1";
    el.style.transform = `translate(${((x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-y * 0.5 + 0.5) * h).toFixed(1)}px)`;
    const d = el.querySelector(".mk-dist") as HTMLElement;
    d.textContent = `${dist.toFixed(1)} RS ${extra}`;
  }

  updateTesseract(dt: number) {
    this.camera.position.set(0, 0, 4);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, -10);
    this.camera.rotateZ(Math.sin(this.time * 0.2) * 0.25);
    this.camera.fov += (75 - this.camera.fov) * dt;
    this.camera.updateProjectionMatrix();
    this.lattice.position.z = (this.time * 1.2) % 2;

    const t = this.time;
    const write = (lines: THREE.LineSegments, scale: number, phase: number) => {
      const a = t * 0.5 + phase;
      const b = t * 0.33 + phase;
      const c = t * 0.21;
      const pts = this.hyperVerts.map(([x, y, z, w]) => {
        let x1 = x * Math.cos(a) - w * Math.sin(a);
        let w1 = x * Math.sin(a) + w * Math.cos(a);
        const y1 = y * Math.cos(b) - z * Math.sin(b);
        let z1 = y * Math.sin(b) + z * Math.cos(b);
        const z2 = z1 * Math.cos(c) - w1 * Math.sin(c);
        w1 = z1 * Math.sin(c) + w1 * Math.cos(c);
        z1 = z2;
        const k = scale / (3 - w1);
        x1 *= k;
        return [x1, y1 * k, z1 * k];
      });
      const arr = lines.geometry.attributes.position.array as Float32Array;
      this.hyperEdges.forEach(([i, j], n) => {
        arr.set(pts[i], n * 6);
        arr.set(pts[j], n * 6 + 3);
      });
      lines.geometry.attributes.position.needsUpdate = true;
    };
    write(this.hyperLines, 2.4, 0);
    write(this.hyperLines2, 4.2, 1.3);
    this.audio.update(dt, 1, 0.6, 0, false);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointerup", this.onPointerUp);
    this.markerEnd.remove();
    this.markerOrb.remove();
    this.audio.ctx?.close();
    this.renderer.dispose();
  }
}
