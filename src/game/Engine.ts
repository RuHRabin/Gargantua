import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { bhFragment, compositeFragment, quadVertex, wormholeFragment, wormholeVertex } from "./blackHoleShader";
import { CosmicAudio } from "./audio";
import { Campaign, MISSIONS, type CampaignSnapshot, type LevelResult } from "./campaign";
import { HazardField, type HazardEvent } from "./hazards";
import { BEARING_COUNT, RING_EDGES, SECTOR_COUNT, locateSector, sectorId, type SectorLocation } from "./exploration";
import { LESSON_BY_ID } from "./learning";
import {
  makeDecalTexture,
  makeDiskTexture,
  makeGlowTexture,
  makeHullTexture,
  makePlanetTexture,
  makeStarTexture,
} from "./textures";

export interface HudState {
  earthYears: number;
  maxYears: number;
  dilation: number;
  distance: number;
  speed: number;
  propellant: number;
  charge: number;
  water: number;
  hull: number;
  engineMode: EngineMode;
  ionActive: boolean;
  sail: boolean;
  sailEfficiency: number;
  autoRefine: boolean;
  autoRefining: boolean;
  weaponReady: number;
  threatDistance: number;
  threatKind: "asteroid" | "comet";
  arrays: boolean;
  solarRate: number;
  converting: boolean;
  scooping: boolean;
  cargo: number;
  uploaded: number;
  goal: number;
  docking: boolean;
  thrust: boolean;
  boost: boolean;
  proximity: number;
  combo: number;
  objective: string;
  fps: number;
  campaign: CampaignSnapshot;
  sector: SectorLocation;
  chartedSectors: number;
  totalSectors: number;
  stationCredits: number;
  target: string;
  targetDistance: number;
  autopilot: boolean;
  scanCooldown: number;
  quality: QualityMode;
}

export type QualityMode = "auto" | "cinematic" | "eco";
export type EngineMode = "chemical" | "ion" | "sail";

export type EngineEvent =
  | { type: "message"; text: string }
  | { type: "collect"; value: number }
  | { type: "fuel" }
  | { type: "upload"; value: number }
  | { type: "survey"; name: string; value: number }
  | { type: "bonus"; text: string }
  | { type: "horizon" }
  | { type: "pause"; paused: boolean }
  | { type: "discovery"; id: string }
  | { type: "mission"; result: LevelResult; campaignComplete: boolean }
  | { type: "station-docked" }
  | { type: "station-serviced"; report: StationServiceReport }
  | { type: "sector-charted"; sector: SectorLocation; firstEver: boolean; points: number }
  | { type: "hazard"; text: string; tone: "good" | "bad" }
  | { type: "end"; reason: "tesseract" | "timeout" | "win" | "wreck"; score: number; years: number; points: number; completed: number };

type Mode = "intro" | "play" | "debrief" | "tesseract" | "outro";

export interface StationServiceReport {
  propellant: number;
  charge: number;
  water: number;
  hull: number;
  uploaded: number;
  creditsSpent: number;
  creditsRemaining: number;
}

interface Orb {
  r: number;
  angle: number;
  y: number;
  speed: number;
  value: number;
  kind: "quanta" | "fuel";
  pos: THREE.Vector3;
  spin: number;
  scale: number;
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

interface Burst {
  points: THREE.Points;
  velocity: Float32Array;
  life: number;
  maxLife: number;
}

const GM = 6;
const MAX_YEARS = 60;
const GOAL = 150;
const ENDURANCE_R = 20;
const QUANTA_COUNT = 16;
const CELL_COUNT = 6;

// Reusable math objects keep transient allocations out of the flight calculations.
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3(1, 1, 1);
const _steer = new THREE.Vector3();
const _destination = new THREE.Vector3();
const _q2 = new THREE.Quaternion();
const _vz = new THREE.Vector3(0, 0, 1);

function mat(pos: [number, number, number], rot: [number, number, number] = [0, 0, 0], scl: [number, number, number] = [1, 1, 1]) {
  return new THREE.Matrix4().compose(
    _v1.set(pos[0], pos[1], pos[2]),
    _q1.setFromEuler(_euler.set(rot[0], rot[1], rot[2])),
    _v2.set(scl[0], scl[1], scl[2])
  );
}

/** Collects primitives per material and merges them, so a whole spacecraft costs a handful of draw calls. */
class PartSet {
  private map = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(geo: THREE.BufferGeometry, material: THREE.Material, matrix?: THREE.Matrix4) {
    let g = geo;
    if (matrix) g = g.applyMatrix4(matrix);
    if (g.index) {
      const n = g.toNonIndexed();
      g.dispose();
      g = n;
    }
    if (!g.getAttribute("uv")) {
      g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.getAttribute("position").count * 2), 2));
    }
    const list = this.map.get(material);
    if (list) list.push(g);
    else this.map.set(material, [g]);
  }
  build(parent: THREE.Object3D) {
    this.map.forEach((geos, material) => {
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!merged) return;
      if (geos.length > 1) geos.forEach((g) => g.dispose());
      parent.add(new THREE.Mesh(merged, material));
    });
    this.map.clear();
  }
}

export class Engine {
  canvas: HTMLCanvasElement;
  markerLayer: HTMLElement;
  reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  onHud: (s: HudState) => void;
  onEvent: (e: EngineEvent) => void;
  audio = new CosmicAudio();

  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  bgScene = new THREE.Scene();
  compScene = new THREE.Scene();
  tessScene = new THREE.Scene();
  bhMat: THREE.ShaderMaterial;
  compMat: THREE.ShaderMaterial;
  bhTarget: THREE.WebGLRenderTarget;

  starTex = makeStarTexture();
  diskTex = makeDiskTexture();
  hullTex = makeHullTexture();
  glowGold = makeGlowTexture("rgba(255,250,230,1)", "rgba(255,170,70,0.55)");
  glowBlue = makeGlowTexture("rgba(230,245,255,1)", "rgba(90,170,255,0.55)");

  mode: Mode = "intro";
  paused = false;
  hidden = false;
  time = 0;
  raf = 0;
  last = performance.now();
  hudTimer = 0;
  markerTimer = 0;
  audioTimer = 0;
  visualDirty = true;
  disposed = false;
  ready: Promise<void>;
  campaign = new Campaign();
  discoveries = new Set<string>();

  // adaptive quality
  renderScale = 0.56;
  quality = 1;
  qualityMode: QualityMode = "auto";
  frameAcc = 0;
  frameCount = 0;
  fps = 60;
  targetPixels = 750000;
  stableWindows = 0;
  cinematicTimer = 0;

  // ship state
  ship = new THREE.Group();
  shipBody = new THREE.Group();
  engineGlows: THREE.Sprite[] = [];
  enginePlumes: THREE.Mesh[] = [];
  rcsGlows: THREE.Sprite[] = [];
  navLights: THREE.Sprite[] = [];
  arrayPivots: THREE.Group[] = [];
  arrayPanels: THREE.Mesh[] = [];
  shipStrobe!: THREE.Sprite;
  scoopField!: THREE.Mesh;

  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  quat = new THREE.Quaternion();
  bank = 0;

  propellant = 100;
  charge = 100;
  water = 60;
  hull = 100;
  camPullback = 0;
  camBank = 0;
  engineMode: EngineMode = "chemical";
  ionActive = false;
  sail = false;
  sailAnim = 0;
  sailEfficiency = 0;
  sailMesh!: THREE.Group;
  sailFilm!: THREE.Mesh;
  autoRefine = true;
  autoRefining = false;
  stationServiceReady = false;
  firing = false;
  weaponCooldown = 0;
  hullFlash = 0;
  threatDistance = Infinity;
  threatKind: "asteroid" | "comet" = "asteroid";
  hazards!: HazardField;
  hazardEvents: HazardEvent[] = [];
  arrays = false;
  arrayAnim = 0;
  solarRate = 0;
  converting = false;
  scooping = false;
  cargo = 0;
  uploaded = 0;
  earthYears = 0;
  yearLimit = MAX_YEARS;
  dilation = 1;
  thrusting = false;
  boosting = false;
  docking = false;
  wasDocking = false;
  flightSectors = new Set<string>();
  chartedSectors = new Set<string>();
  currentSector: SectorLocation = locateSector(new THREE.Vector3(ENDURANCE_R, 0, 0));
  sectorTarget: SectorLocation | null = null;
  sectorTargetRadius = 0;
  stationCredits = 3;
  stationStock: { propellant: number; charge: number; water: number; repair: number } = { propellant: 400, charge: 500, water: 360, repair: 300 };
  combo = 1;
  comboTimer = 0;
  warp = 0;
  diveMinR = 99;
  wormholeCooldown = 0;
  humor = 75;
  objective = "ACQUIRE QUANTUM SIGNALS";
  flags: Record<string, boolean> = {};
  scanCooldown = 0;
  targetIndex = 0;
  autopilot = false;
  targetDistance = 0;
  surveyRings: THREE.Mesh[] = [];
  touchConvert = false;
  touchRetro = false;

  // world
  endurance = new THREE.Group();
  enduranceRing = new THREE.Group();
  endAngle = 0.6;
  orbs: Orb[] = [];
  quantaMesh!: THREE.InstancedMesh;
  cellMesh!: THREE.InstancedMesh;
  quantaGlow!: THREE.Points;
  cellGlow!: THREE.Points;
  planets: Planet[] = [];
  dust!: THREE.Points;
  trail!: THREE.Points;
  trailPositions = new Float32Array(120 * 3);
  trailIndex = 0;
  speedLines!: THREE.LineSegments;
  speedLinePositions = new Float32Array(90 * 6);
  dockingBeam!: THREE.Line;
  dockingRings: THREE.Mesh[] = [];
  bursts: Burst[] = [];
  burstCursor = 0;
  wormhole = new THREE.Group();
  wormholeMat!: THREE.ShaderMaterial;
  wormholePos = new THREE.Vector3();

  // tesseract
  lattice = new THREE.Group();
  hyperLines!: THREE.LineSegments;
  hyperLines2!: THREE.LineSegments;
  hyperVerts: number[][] = [];
  hyperEdges: [number, number][] = [];
  hyperProjected = new Float32Array(48);

  // input
  keys: Record<string, boolean> = {};
  mouse = new THREE.Vector2();
  mouseDown = false;
  touchThrust = false;
  touchScoop = false;

  markerEnd: HTMLDivElement;
  markerOrb: HTMLDivElement;
  markerHole: HTMLDivElement;
  markerTarget: HTMLDivElement;
  markerLabels = new WeakMap<HTMLDivElement, HTMLElement>();

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

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", stencil: false });
    // Phones and tablets: native-resolution lensing is the most expensive thing on screen,
    // so touch devices render at 1x and start from a smaller internal buffer.
    const touchDevice = window.matchMedia("(pointer: coarse)").matches;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, touchDevice ? 1 : 1.25));
    if (touchDevice) { this.renderScale = 0.42; this.targetPixels = 420000; }
    this.renderer.autoClear = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 800);
    this.camera.position.set(0, 3, 28);
    this.scene.add(this.camera);

    this.bhTarget = new THREE.WebGLRenderTarget(2, 2, {
      depthBuffer: false,
      stencilBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });

    this.bhMat = new THREE.ShaderMaterial({
      vertexShader: quadVertex,
      fragmentShader: bhFragment,
      uniforms: {
        uTime: { value: 0 },
        uCamPos: { value: new THREE.Vector3() },
        uCamMat: { value: new THREE.Matrix4() },
        uTanHalfFov: { value: Math.tan(THREE.MathUtils.degToRad(30)) },
        uAspect: { value: 1 },
        uSteps: { value: 220 },
        uDiskBoost: { value: 1 },
        uStars: { value: this.starTex },
        uDisk: { value: this.diskTex },
      },
      depthWrite: false,
      depthTest: false,
    });
    this.compMat = new THREE.ShaderMaterial({
      vertexShader: quadVertex,
      fragmentShader: compositeFragment,
      uniforms: {
        uTex: { value: this.bhTarget.texture },
        uTime: { value: 0 },
        uAspect: { value: 1 },
        uWarp: { value: 0 },
        uFade: { value: 0 },
      },
      depthWrite: false,
      depthTest: false,
    });
    const quadGeo = new THREE.PlaneGeometry(2, 2);
    const bhQuad = new THREE.Mesh(quadGeo, this.bhMat);
    bhQuad.frustumCulled = false;
    this.bgScene.add(bhQuad);
    const compQuad = new THREE.Mesh(quadGeo, this.compMat);
    compQuad.frustumCulled = false;
    this.compScene.add(compQuad);

    this.buildLights();
    this.buildShip();
    this.buildEndurance();
    this.buildPlanets();
    this.buildWormhole();
    this.buildOrbs();
    this.buildDust();
    this.buildTrail();
    this.buildTesseract();
    this.buildBurstPool();
    this.hazards = new HazardField(this.scene, this.glowGold, this.glowBlue);

    this.markerEnd = this.makeMarker("ENDURANCE", "#e8e4dc");
    this.markerOrb = this.makeMarker("QUANTA", "#ffc27a");
    this.markerHole = this.makeMarker("WORMHOLE", "#8fd0ff");
    this.markerTarget = this.makeMarker("TARGET", "#b5dfff");

    this.ready = Promise.all([
      this.renderer.compileAsync(this.bgScene, this.quadCam),
      this.renderer.compileAsync(this.compScene, this.quadCam),
      this.renderer.compileAsync(this.scene, this.camera),
      this.renderer.compileAsync(this.tessScene, this.camera),
    ]).then(() => undefined);

    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.raf = requestAnimationFrame(this.loop);
  }

  // ---------------- construction ----------------
  buildLights() {
    const disk = new THREE.PointLight(0xffc48a, 3.4, 0, 0);
    this.scene.add(disk);
    this.scene.add(new THREE.AmbientLight(0x404858, 0.65));
    const rim = new THREE.DirectionalLight(0x9fb8ff, 0.55);
    rim.position.set(-10, 20, -30);
    this.scene.add(rim);
  }

  buildShip() {
    const hull = new THREE.MeshStandardMaterial({ map: this.hullTex, color: 0xe0ded6, metalness: 0.48, roughness: 0.52 });
    const hullDark = new THREE.MeshStandardMaterial({ map: this.hullTex, color: 0x7d7b74, metalness: 0.58, roughness: 0.5 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x11151b, metalness: 0.8, roughness: 0.22 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x080a0c, metalness: 0.3, roughness: 0.14, emissive: 0x0a1420 });
    const copper = new THREE.MeshStandardMaterial({ color: 0x8b5d3b, metalness: 0.7, roughness: 0.36 });
    const parts = new PartSet();

    const plan = new THREE.Shape();
    plan.moveTo(0, -0.66);
    plan.lineTo(0.16, -0.46);
    plan.lineTo(0.3, -0.2);
    plan.lineTo(0.58, 0.13);
    plan.lineTo(0.56, 0.32);
    plan.lineTo(0.22, 0.28);
    plan.lineTo(0.13, 0.4);
    plan.lineTo(-0.13, 0.4);
    plan.lineTo(-0.22, 0.28);
    plan.lineTo(-0.56, 0.32);
    plan.lineTo(-0.58, 0.13);
    plan.lineTo(-0.3, -0.2);
    plan.lineTo(-0.16, -0.46);
    plan.closePath();
    const shellGeo = new THREE.ExtrudeGeometry(plan, {
      depth: 0.075,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.018,
      bevelThickness: 0.015,
      curveSegments: 1,
    });
    shellGeo.rotateX(Math.PI / 2);
    shellGeo.translate(0, 0.04, 0);
    this.shipBody.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(shellGeo, 30),
        new THREE.LineBasicMaterial({ color: 0x34363a, transparent: true, opacity: 0.5 })
      )
    );
    parts.add(shellGeo, hull);

    parts.add(new THREE.SphereGeometry(0.18, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), hullDark, mat([0, 0.068, -0.23], [0, 0, 0], [0.78, 0.42, 1.45]));
    parts.add(new THREE.SphereGeometry(0.115, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.48), glass, mat([0, 0.105, -0.33], [0, 0, 0], [0.88, 0.35, 1.55]));
    [-0.062, 0, 0.062].forEach((x) => parts.add(new THREE.BoxGeometry(0.008, 0.008, 0.19), hullDark, mat([x, 0.125, -0.34], [-0.12, 0, 0])));
    parts.add(new THREE.BoxGeometry(0.18, 0.055, 0.22), hullDark, mat([0, 0.07, 0.1]));
    parts.add(new THREE.BoxGeometry(0.34, 0.018, 0.66), dark, mat([0, -0.06, -0.02]));
    parts.add(new THREE.BoxGeometry(0.39, 0.008, 0.035), copper, mat([0, 0.083, 0.24]));

    [-1, 1].forEach((s) => {
      parts.add(new THREE.BoxGeometry(0.22, 0.009, 0.22), s < 0 ? hullDark : hull, mat([0.31 * s, 0.068, 0.11], [0, -0.08 * s, 0]));
      parts.add(new THREE.CapsuleGeometry(0.045, 0.22, 3, 10), hullDark, mat([0.25 * s, 0.02, 0.11], [Math.PI / 2, 0, 0]));
      parts.add(new THREE.TorusGeometry(0.047, 0.006, 6, 18), copper, mat([0.25 * s, 0.02, 0.2], [Math.PI / 2, 0, 0]));
      parts.add(new THREE.BoxGeometry(0.11, 0.008, 0.17), dark, mat([0.38 * s, -0.07, 0.13]));
      parts.add(new THREE.CylinderGeometry(0.003, 0.003, 0.13, 5), hullDark, mat([0.18 * s, 0.14, 0.13], [0, 0, 0.34 * s]));
    });

    [-0.16, -0.055, 0.055, 0.16].forEach((x) => {
      parts.add(new THREE.CylinderGeometry(0.032, 0.046, 0.13, 12), dark, mat([x, 0, 0.34], [Math.PI / 2, 0, 0]));
      parts.add(new THREE.CylinderGeometry(0.028, 0.044, 0.05, 12, 1, true), copper, mat([x, 0, 0.43], [Math.PI / 2, 0, 0]));
    });
    parts.build(this.shipBody);

    // Animated hardware stays separate from the merged hull.
    [-0.16, -0.055, 0.055, 0.16].forEach((x, i) => {
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.glowBlue, color: 0xbce8ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
      );
      glow.position.set(x, 0, 0.465);
      glow.scale.setScalar(0.045);
      this.shipBody.add(glow);
      this.engineGlows.push(glow);
      const plume = new THREE.Mesh(
        new THREE.ConeGeometry(0.035, 0.38, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x77caff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
      );
      plume.rotation.x = Math.PI / 2;
      plume.position.set(x, 0, 0.63);
      plume.renderOrder = 2 + i;
      this.shipBody.add(plume);
      this.enginePlumes.push(plume);
    });

    const solarMat = new THREE.MeshStandardMaterial({
      color: 0x16314a,
      metalness: 0.78,
      roughness: 0.16,
      emissive: 0x0a2740,
      emissiveIntensity: 0.4,
      side: THREE.DoubleSide,
    });
    [-1, 1].forEach((s) => {
      const pivot = new THREE.Group();
      pivot.position.set(0.3 * s, 0.085, 0.08);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.006, 0.17), solarMat.clone());
      panel.position.set(0.24 * s, 0, 0);
      pivot.add(panel);
      for (let i = -2; i <= 2; i++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.009, 0.17), new THREE.MeshStandardMaterial({ color: 0x2b3340, metalness: 0.6, roughness: 0.4 }));
        rib.position.set(0.24 * s + i * 0.085, 0.002, 0);
        pivot.add(rib);
      }
      this.shipBody.add(pivot);
      this.arrayPivots.push(pivot);
      this.arrayPanels.push(panel);
    });

    [
      [-0.55, 0xff3040],
      [0.55, 0x55ff9a],
    ].forEach(([x, color]) => {
      const nav = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowGold, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      nav.position.set(x, 0.04, 0.18);
      nav.scale.setScalar(0.09);
      this.shipBody.add(nav);
      this.navLights.push(nav);
      const rcs = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowBlue, color: 0xcdf4ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      rcs.position.set(x, 0.02, 0.1);
      rcs.scale.set(0.035, 0.17, 1);
      this.shipBody.add(rcs);
      this.rcsGlows.push(rcs);
    });

    this.shipStrobe = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowBlue, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.shipStrobe.position.set(0, 0.2, 0.12);
    this.shipStrobe.scale.setScalar(0.18);
    this.shipBody.add(this.shipStrobe);

    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(0.27, 0.068),
      new THREE.MeshBasicMaterial({ map: makeDecalTexture("RANGER", "LAZARUS 02"), transparent: true, depthWrite: false, toneMapped: false })
    );
    decal.rotation.set(-Math.PI / 2, 0, 0.05);
    decal.position.set(-0.3, 0.084, 0.08);
    this.shipBody.add(decal);

    // Solar sail: a square of reflective film on two crossed booms, stowed until selected.
    this.sailMesh = new THREE.Group();
    this.sailFilm = new THREE.Mesh(
      new THREE.PlaneGeometry(2.3, 2.3, 1, 1),
      new THREE.MeshStandardMaterial({
        color: 0xe4e7ec, metalness: 0.95, roughness: 0.12, emissive: 0x3a3426, emissiveIntensity: 0.25,
        transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false,
      })
    );
    this.sailMesh.add(this.sailFilm);
    const boomMat = new THREE.MeshStandardMaterial({ color: 0x2b3340, metalness: 0.6, roughness: 0.4 });
    for (const angle of [Math.PI / 4, -Math.PI / 4]) {
      const boom = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.012, 0.012), boomMat);
      boom.rotation.z = angle;
      this.sailMesh.add(boom);
    }
    const sailEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(this.sailFilm.geometry),
      new THREE.LineBasicMaterial({ color: 0xd7c9a8, transparent: true, opacity: 0.5 })
    );
    this.sailMesh.add(sailEdges);
    this.sailMesh.position.set(0, 0.03, 0.72);
    this.sailMesh.scale.setScalar(0.001);
    this.sailMesh.visible = false;
    this.shipBody.add(this.sailMesh);

    // Visible scoop field when the magnetic collector is running.
    this.scoopField = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 12),
      new THREE.MeshBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0, wireframe: true, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.ship.add(this.scoopField);

    this.ship.add(this.shipBody);
    this.ship.visible = false;
    this.scene.add(this.ship);
  }

  buildEndurance() {
    const hull = new THREE.MeshStandardMaterial({ map: this.hullTex, color: 0xd4d1c8, metalness: 0.5, roughness: 0.55 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x252a30, metalness: 0.72, roughness: 0.36 });
    const blanket = new THREE.MeshStandardMaterial({ color: 0xa69b83, metalness: 0.25, roughness: 0.8 });
    const solar = new THREE.MeshStandardMaterial({ color: 0x15283a, metalness: 0.72, roughness: 0.18, emissive: 0x07111d });
    const parts = new PartSet();
    const R = 0.9;

    parts.add(new THREE.TorusGeometry(1.02, 0.018, 5, 72), dark, mat([0, 0, 0], [Math.PI / 2, 0, 0]));
    parts.add(new THREE.TorusGeometry(0.73, 0.014, 5, 72), dark, mat([0, 0, 0], [Math.PI / 2, 0, 0]));

    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const rot: [number, number, number] = [0, -a + Math.PI / 2, 0];
      const base: [number, number, number] = [Math.cos(a) * R, 0, Math.sin(a) * R];
      const place = (dx: number, dy: number, dz: number): [number, number, number] => {
        const c = Math.cos(-a + Math.PI / 2);
        const s = Math.sin(-a + Math.PI / 2);
        return [base[0] + dx * c + dz * s, base[1] + dy, base[2] - dx * s + dz * c];
      };
      parts.add(new THREE.BoxGeometry(0.37, 0.2, 0.24), i % 3 === 0 ? blanket : hull, mat(base, rot));
      parts.add(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 10), dark, mat(place(-0.2, 0, 0), [0, 0, Math.PI / 2]));
      parts.add(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 10), dark, mat(place(0.2, 0, 0), [0, 0, Math.PI / 2]));
      parts.add(new THREE.BoxGeometry(0.24, 0.007, 0.045), dark, mat(place(0, 0.105, -0.07), rot));
      parts.add(new THREE.BoxGeometry(0.24, 0.007, 0.045), dark, mat(place(0, 0.105, 0.07), rot));
      if (i % 3 === 1) {
        parts.add(new THREE.BoxGeometry(0.46, 0.012, 0.14), solar, mat(place(0, 0.18, 0), rot));
        for (let p = -2; p <= 2; p++) parts.add(new THREE.BoxGeometry(0.004, 0.014, 0.14), dark, mat(place(p * 0.085, 0.185, 0), rot));
      }
      const a2 = a + Math.PI / 12;
      parts.add(new THREE.BoxGeometry(0.09, 0.07, 0.25), dark, mat([Math.cos(a2) * R * 0.98, 0, Math.sin(a2) * R * 0.98], [0, -a2 + Math.PI / 2, 0]));
    }

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 12;
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const geo = new THREE.CylinderGeometry(0.014, 0.014, R * 0.84, 5);
      const m = new THREE.Matrix4().compose(
        dir.clone().multiplyScalar(R * 0.42),
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir),
        _scale.set(1, 1, 1)
      );
      parts.add(geo, dark, m);
    }
    parts.add(new THREE.CylinderGeometry(0.16, 0.16, 0.34, 14), hull);
    parts.add(new THREE.CylinderGeometry(0.085, 0.115, 0.18, 14), dark, mat([0, 0.23, 0]));
    parts.build(this.enduranceRing);

    const dockLamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowGold, color: 0xa9dcff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    dockLamp.position.y = 0.35;
    dockLamp.scale.setScalar(0.25);
    this.enduranceRing.add(dockLamp);
    this.endurance.add(this.enduranceRing);

    [1.22, 1.42, 1.65].forEach((radius, i) => {
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.006, 6, 96),
        new THREE.MeshBasicMaterial({ color: i === 0 ? 0xa9dcff : 0xffd7a0, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, toneMapped: false })
      );
      halo.rotation.x = Math.PI / 2;
      this.endurance.add(halo);
      this.dockingRings.push(halo);
    });
    const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowGold, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
    beacon.scale.setScalar(0.6);
    beacon.position.y = 0.2;
    this.endurance.add(beacon);
    this.endurance.rotation.x = 0.25;
    this.scene.add(this.endurance);

    this.dockingBeam = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: 0xaadfff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending })
    );
    this.dockingBeam.visible = false;
    this.dockingBeam.frustumCulled = false;
    this.scene.add(this.dockingBeam);
  }

  buildPlanets() {
    type PDef = Omit<Planet, "mesh" | "surveyed"> & { tex: THREE.Texture; atm: number };
    const defs: PDef[] = [
      {
        name: "MILLER", r: 5.6, angle: 2.2, y: 2.2, speed: 0.05, radius: 0.35,
        line: "Miller's world. Those aren't mountains... they're waves.",
        tex: makePlanetTexture([30, 70, 105], [210, 230, 240], 50, 7), atm: 0x7fb6ff,
      },
      {
        name: "MANN", r: 28, angle: 4.1, y: -4, speed: 0.008, radius: 0.85,
        line: "Mann's world. Frozen clouds. Trust no one's data here.",
        tex: makePlanetTexture([200, 210, 220], [120, 140, 165], 70, 31), atm: 0xdfefff,
      },
      {
        name: "EDMUNDS", r: 36, angle: 0.9, y: 5, speed: 0.005, radius: 1.0,
        line: "Edmunds' world. Breathable. Plan B lives here.",
        tex: makePlanetTexture([150, 110, 70], [220, 190, 140], 60, 99), atm: 0xffd6a0,
      },
    ];
    for (const d of defs) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.SphereGeometry(d.radius, 40, 26), new THREE.MeshStandardMaterial({ map: d.tex, roughness: 0.82, metalness: 0.05 })));
      const atmo = new THREE.Mesh(
        new THREE.SphereGeometry(d.radius * 1.12, 28, 18),
        new THREE.ShaderMaterial({
          uniforms: { uColor: { value: new THREE.Color(d.atm) } },
          vertexShader: `varying vec3 vN; varying vec3 vV;
            void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
          fragmentShader: `uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
            void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(uColor*f*1.6, f); }`,
          transparent: true,
          blending: THREE.AdditiveBlending,
          side: THREE.BackSide,
          depthWrite: false,
        })
      );
      g.add(atmo);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(d.radius * 1.9, 0.008, 5, 72),
        new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, toneMapped: false })
      );
      ring.rotation.x = Math.PI / 2;
      ring.name = "surveyRing";
      g.add(ring);
      this.surveyRings.push(ring);
      this.scene.add(g);
      this.planets.push({ name: d.name, mesh: g, r: d.r, angle: d.angle, y: d.y, speed: d.speed, radius: d.radius, surveyed: false, line: d.line });
    }
  }

  buildWormhole() {
    this.wormholeMat = new THREE.ShaderMaterial({
      vertexShader: wormholeVertex,
      fragmentShader: wormholeFragment,
      uniforms: { uStars: { value: this.starTex }, uTime: { value: 0 } },
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.78, 32, 20), this.wormholeMat);
    this.wormhole.add(sphere);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.84, 0.03, 10, 64),
      new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, toneMapped: false })
    );
    this.wormhole.add(rim);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowBlue, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(3.4);
    this.wormhole.add(halo);
    this.wormholePos.set(Math.cos(1.9) * 30, 2.2, Math.sin(1.9) * 30);
    this.wormhole.position.copy(this.wormholePos);
    this.scene.add(this.wormhole);
  }

  buildOrbs() {
    const quantaGeo = new THREE.IcosahedronGeometry(0.13, 0);
    this.quantaMesh = new THREE.InstancedMesh(
      quantaGeo,
      new THREE.MeshBasicMaterial({ color: 0xffc27a, wireframe: true, transparent: true, opacity: 0.95, toneMapped: false }),
      QUANTA_COUNT
    );
    this.quantaMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.quantaMesh.frustumCulled = false;
    this.scene.add(this.quantaMesh);

    const cellGeo = new THREE.CapsuleGeometry(0.07, 0.14, 3, 8);
    this.cellMesh = new THREE.InstancedMesh(
      cellGeo,
      new THREE.MeshStandardMaterial({ color: 0x6c8998, metalness: 0.75, roughness: 0.28, emissive: 0x16425c, emissiveIntensity: 1.2 }),
      CELL_COUNT
    );
    this.cellMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cellMesh.frustumCulled = false;
    this.scene.add(this.cellMesh);

    const mkGlow = (count: number, map: THREE.Texture, color: number, size: number) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map, color, size, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      pts.frustumCulled = false;
      this.scene.add(pts);
      return pts;
    };
    this.quantaGlow = mkGlow(QUANTA_COUNT, this.glowGold, 0xffc27a, 0.75);
    this.cellGlow = mkGlow(CELL_COUNT, this.glowBlue, 0x8fd0ff, 0.7);

    for (let i = 0; i < QUANTA_COUNT; i++) this.orbs.push(this.makeOrb("quanta"));
    for (let i = 0; i < CELL_COUNT; i++) this.orbs.push(this.makeOrb("fuel"));
  }

  makeOrb(kind: "quanta" | "fuel", existing?: Orb): Orb {
    const r = kind === "quanta" ? 1.55 + Math.pow(Math.random(), 1.6) * 13 : 7 + Math.random() * 16;
    const value = kind === "quanta" ? Math.round(3 + 24 / (r - 1)) : 0;
    const o: Orb = existing ?? { r, angle: 0, y: 0, speed: 0, value, kind, pos: new THREE.Vector3(), spin: Math.random() * 6, scale: 1 };
    o.r = r;
    o.angle = Math.random() * Math.PI * 2;
    o.y = (Math.random() * 2 - 1) * Math.min(3, 0.3 + r * 0.22);
    o.value = value;
    o.speed = 0.35 / Math.sqrt(r);
    o.scale = kind === "quanta" ? 0.7 + Math.min(1.3, value / 22) : 1;
    o.pos.set(Math.cos(o.angle) * r, o.y, Math.sin(o.angle) * r);
    return o;
  }

  buildDust() {
    const N = 2200;
    const p = new Float32Array(N * 3);
    const c = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 3 + Math.pow(Math.random(), 0.7) * 45;
      const a = Math.random() * Math.PI * 2;
      p[i * 3] = Math.cos(a) * r;
      p[i * 3 + 1] = (Math.random() + Math.random() + Math.random() - 1.5) * (1 + r * 0.15);
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
      new THREE.PointsMaterial({ size: 0.04, vertexColors: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, map: this.glowGold, toneMapped: false })
    );
    this.scene.add(this.dust);
  }

  buildTrail() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.trailPositions, 3));
    this.trail = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.055, color: 0x88c4ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, map: this.glowBlue, toneMapped: false })
    );
    this.trail.frustumCulled = false;
    this.trail.visible = false;
    this.scene.add(this.trail);

    for (let i = 0; i < this.speedLinePositions.length; i += 6) {
      const z = -2 - Math.random() * 36;
      const x = (Math.random() - 0.5) * 8;
      const y = (Math.random() - 0.5) * 5;
      this.speedLinePositions.set([x, y, z, x, y, z - 0.08], i);
    }
    const sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute("position", new THREE.BufferAttribute(this.speedLinePositions, 3));
    this.speedLines = new THREE.LineSegments(
      sgeo,
      new THREE.LineBasicMaterial({ color: 0xb6ddff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.speedLines.frustumCulled = false;
    this.speedLines.visible = false;
    this.camera.add(this.speedLines);
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
    for (let i = 0; i < 520; i++) {
      const x = (Math.random() - 0.5) * 16;
      const z = 2 - Math.random() * L;
      threads.push(x, -6, z, x + (Math.random() - 0.5) * 0.05, 6, z);
    }
    const g1 = new THREE.BufferGeometry();
    g1.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute("position", new THREE.Float32BufferAttribute(threads, 3));
    this.lattice.add(new THREE.LineSegments(g1, amber));
    this.lattice.add(new THREE.LineSegments(g2, pale));
    this.tessScene.add(this.lattice);

    const N = 900;
    const dp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      dp[i * 3] = (Math.random() - 0.5) * 16;
      dp[i * 3 + 1] = (Math.random() - 0.5) * 12;
      dp[i * 3 + 2] = 2 - Math.random() * L;
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute("position", new THREE.BufferAttribute(dp, 3));
    this.lattice.add(new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.05, color: 0xffd29a, map: this.glowGold, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));

    for (let i = 0; i < 16; i++) this.hyperVerts.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
    for (let i = 0; i < 16; i++)
      for (let j = i + 1; j < 16; j++) {
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
      <div style="width:18px;height:18px;border:1px solid ${color};transform:rotate(45deg);box-shadow:0 0 12px ${color}55"></div>
      <div><div>${label}</div><div class="mk-dist" style="opacity:.6"></div></div></div>`;
    el.style.display = "none";
    this.markerLayer.appendChild(el);
    this.markerLabels.set(el, el.querySelector(".mk-dist") as HTMLElement);
    return el;
  }

  buildBurstPool() {
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(48 * 3), 3).setUsage(THREE.DynamicDrawUsage));
      const points = new THREE.Points(geo, new THREE.PointsMaterial({
        size: 0.055, map: this.glowGold, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
      points.visible = false;
      points.frustumCulled = false;
      this.scene.add(points);
      this.bursts.push({ points, velocity: new Float32Array(48 * 3), life: 0, maxLife: 0.9 });
    }
  }

  spawnBurst(position: THREE.Vector3, color: number, amount = 30) {
    // Recycle bounded GPU buffers rather than allocate/dispose on every pickup.
    const burst = this.bursts[this.burstCursor++ % this.bursts.length];
    amount = Math.min(48, amount, this.qualityMode === "eco" ? 20 : 48);
    const p = burst.points.geometry.attributes.position.array as Float32Array;
    const v = burst.velocity;
    for (let i = 0; i < amount; i++) {
      _v1.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const sp = 0.2 + Math.random() * 0.9;
      const j = i * 3;
      p[j] = position.x; p[j + 1] = position.y; p[j + 2] = position.z;
      v[j] = _v1.x * sp; v[j + 1] = _v1.y * sp; v[j + 2] = _v1.z * sp;
    }
    const material = burst.points.material as THREE.PointsMaterial;
    material.color.setHex(color);
    material.opacity = 1;
    burst.points.geometry.setDrawRange(0, amount);
    burst.points.geometry.attributes.position.needsUpdate = true;
    burst.points.visible = true;
    burst.life = burst.maxLife;
  }

  updateBursts(dt: number) {
    for (let b = this.bursts.length - 1; b >= 0; b--) {
      const burst = this.bursts[b];
      if (burst.life <= 0) continue;
      burst.life -= dt;
      const p = burst.points.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < p.length; i += 3) {
        p[i] += burst.velocity[i] * dt;
        p[i + 1] += burst.velocity[i + 1] * dt;
        p[i + 2] += burst.velocity[i + 2] * dt;
        burst.velocity[i] *= 0.975;
        burst.velocity[i + 1] *= 0.975;
        burst.velocity[i + 2] *= 0.975;
      }
      burst.points.geometry.attributes.position.needsUpdate = true;
      const m = burst.points.material as THREE.PointsMaterial;
      m.opacity = Math.max(0, burst.life / burst.maxLife);
      m.size = 0.03 + (1 - burst.life / burst.maxLife) * 0.08;
      if (burst.life <= 0) {
        burst.points.visible = false;
      }
    }
  }

  // ---------------- input ----------------
  onKeyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.closest("input, textarea, select, [role=dialog]")) return;
    if ((e.target as HTMLElement)?.closest("button") && (e.code === "Space" || e.code === "Enter")) return;
    this.keys[e.code] = true;
    if (["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (e.code === "Escape" && this.mode === "play") this.setPaused(!this.paused);
    if (e.code === "KeyR" && this.mode === "play" && !this.paused) this.toggleArrays();
    if (e.code === "KeyB" && this.mode === "play" && !this.paused) this.scan();
    if (e.code === "KeyT" && this.mode === "play" && !this.paused) this.setTarget((this.targetIndex + 1) % 6);
    if (e.code === "KeyN" && this.mode === "play" && !this.paused) this.toggleAutopilot();
    if (e.code === "KeyV" && this.mode === "play" && !this.paused) this.cycleEngine();
    if (e.code === "KeyG" && this.mode === "play" && !this.paused) this.toggleAutoRefine();
  };

  cycleEngine() {
    const order: EngineMode[] = ["chemical", "ion", "sail"];
    this.setEngineMode(order[(order.indexOf(this.engineMode) + 1) % order.length]);
  }

  setEngineMode(mode: EngineMode) {
    if (this.mode !== "play" || this.engineMode === mode) return;
    this.engineMode = mode;
    this.sail = mode === "sail";
    this.audio.chime(mode === "sail" ? 79 : mode === "ion" ? 74 : 67, 0.05);
    if (mode === "sail") {
      this.say("sailOut", true,
        "Sail deployed. Photons carry momentum, so the disk's light pushes us directly. No propellant, but we can only be pushed away from the light; angle the sail to tack.",
        "Sail out. We are now a very expensive kite. Light pushes us away from the disk; turn the ship to steer the push.", true);
    } else if (mode === "ion") {
      this.say("ionOn", true,
        "Ion drive selected. It accelerates a trickle of propellant to very high speed using battery power. Gentle thrust, excellent economy.",
        "Ion drive. All the acceleration of a patient snail, and it barely sips the tanks.", true);
    } else {
      this.say("chemOn", true, "Chemical engines selected. Strong burns, heavy propellant use.", "Back to the big engines. Loud, strong, thirsty.", true);
    }
    this.publishHud();
  }

  /** Called by the debrief screen: resume flying into the next chapter with a fresh level clock. */
  continueLevel() {
    if (this.mode !== "debrief") return;
    const level = this.campaign.index + 1;
    if (level > MISSIONS.length) return this.end("win");
    this.campaign.beginLevel(this.time);
    this.hazards.setLevel(level);
    this.hazards.setEnabled(true);
    this.yearLimit = MAX_YEARS;
    this.mode = "play";
    this.last = performance.now();
    this.audio.chime(72, 0.08);
    this.publishHud();
    const mission = MISSIONS[level - 1];
    this.say(`level${level}`, true,
      `Level ${level}: ${mission.title}. ${mission.description}`,
      `Level ${level}: ${mission.title}. ${mission.description}`, true);
  }

  toggleAutoRefine() {
    this.autoRefine = !this.autoRefine;
    this.say("refine", true,
      this.autoRefine ? "Auto-refinery on. Surplus solar charge will split water into propellant whenever the arrays are out." : "Auto-refinery off. Hold C to run the electrolyzer by hand.",
      this.autoRefine ? "Auto-refinery on. Sunlight in, rocket fuel out, water permitting." : "Auto-refinery off. You are the refinery now. Hold C.", true);
    this.publishHud();
  }
  get firePressed() {
    return this.firing || this.keys.KeyX || this.keys.Enter;
  }
  onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };
  onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === "touch" && e.buttons === 0) return;
    if ((e.target as HTMLElement)?.closest("button, input, select, .flight-instrument, .main-navigation, [role=dialog]")) {
      this.mouse.set(0, 0);
      return;
    }
    this.mouse.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  };
  onPointerDown = (e: PointerEvent) => {
    this.onPointerMove(e);
    if (e.pointerType !== "mouse") return;
    if (e.button === 0) this.mouseDown = true;
    if (e.button === 2) this.firing = true;
  };
  onPointerUp = (e?: PointerEvent) => {
    if (!e || e.button === 0) this.mouseDown = false;
    if (!e || e.button === 2) this.firing = false;
    if (window.matchMedia("(pointer: coarse)").matches) this.mouse.set(0, 0);
  };
  onContextMenu = (e: MouseEvent) => {
    if ((e.target as HTMLElement)?.closest("button, input, select, [role=dialog]")) return;
    e.preventDefault();
  };
  setTouchFire(value: boolean) {
    this.firing = value;
  }
  onBlur = () => {
    this.clearInput();
    if (this.mode === "play" && !this.paused) this.setPaused(true);
  };
  onVisibility = () => {
    this.hidden = document.hidden;
    if (this.hidden) {
      cancelAnimationFrame(this.raf);
      this.onBlur();
      this.audio.setSuspended(true);
    } else if (!this.disposed) {
      this.last = performance.now();
      this.audio.setSuspended(this.paused);
      this.raf = requestAnimationFrame(this.loop);
    }
  };
  setTouchThrust(v: boolean) {
    this.touchThrust = v;
  }
  setTouchScoop(v: boolean) {
    this.touchScoop = v;
  }
  setTouchConvert(v: boolean) { this.touchConvert = v; }
  setTouchRetro(v: boolean) { this.touchRetro = v; }
  clearInput() {
    this.keys = {};
    this.mouseDown = false;
    this.firing = false;
    this.touchThrust = false;
    this.touchScoop = false;
    this.touchConvert = false;
    this.touchRetro = false;
    this.mouse.set(0, 0);
  }
  setPaused(p: boolean) {
    if (this.paused === p) return;
    this.paused = p;
    this.clearInput();
    this.visualDirty = true;
    this.audio.setSuspended(p);
    this.onEvent({ type: "pause", paused: p });
  }
  setMuted(m: boolean) {
    this.audio.setMuted(m);
  }
  setHumor(v: number) {
    this.humor = v;
  }

  setChartedSectors(ids: string[]) {
    this.chartedSectors = new Set(ids.filter((id) => /^r[0-5]-s[0-7]$/.test(id)));
    this.publishHud();
  }

  setSectorTarget(ring: number, bearing: number) {
    const safeRing = Math.max(0, Math.min(RING_EDGES.length - 2, Math.floor(ring)));
    const safeBearing = ((Math.floor(bearing) % BEARING_COUNT) + BEARING_COUNT) % BEARING_COUNT;
    const inner = RING_EDGES[safeRing];
    const outer = Number.isFinite(RING_EDGES[safeRing + 1]) ? RING_EDGES[safeRing + 1] : 52;
    const radius = (inner + outer) * 0.5;
    const angle = (safeBearing + 0.5) * Math.PI * 2 / BEARING_COUNT;
    this.sectorTarget = {
      id: sectorId(safeRing, safeBearing), ring: safeRing, bearing: safeBearing,
      angle, bearingName: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][safeBearing],
      ringName: ["Inner well", "Photon orbit", "Accretion reach", "Outer drift", "World lanes", "Deep field"][safeRing],
      label: `${["Inner well", "Photon orbit", "Accretion reach", "Outer drift", "World lanes", "Deep field"][safeRing]} / ${["N", "NE", "E", "SE", "S", "SW", "W", "NW"][safeBearing]}`,
    };
    // Scale the target ring from the actual model edges, not display pixels.
    this.sectorTargetRadius = radius;
    this.targetIndex = 0;
    this.publishHud();
  }

  /** Discover a new orbital cell by physically entering it. Previously charted cells still count toward the current chapter once. */
  updateExploration() {
    const sector = locateSector(this.pos);
    this.currentSector = sector;
    if (this.flightSectors.has(sector.id)) return;
    this.flightSectors.add(sector.id);
    this.campaign.stats.sectorsCharted++;
    const firstEver = !this.chartedSectors.has(sector.id);
    const points = firstEver ? 120 : 20;
    this.chartedSectors.add(sector.id);
    this.campaign.addPoints(points);
    if (firstEver) this.discover("exploration");
    this.audio.chime(firstEver ? 82 : 71, 0.045);
    this.onEvent({ type: "sector-charted", sector, firstEver, points });
  }

  /** Docked at Endurance: pay a resupply credit, draw from finite depot stock, and repair. */
  serviceAtEndurance(): StationServiceReport | null {
    if (this.mode !== "play" || !this.docking) return null;
    const refuel = 100 - this.propellant;
    const charge = 100 - this.charge;
    const water = 100 - this.water;
    const hull = 100 - this.hull;
    const uploaded = this.cargo;
    if (refuel + charge + water + hull < 1 && uploaded < 1) return null;
    if (this.cargo > 0) {
      this.uploaded += this.cargo;
      this.campaign.stats.uploaded = this.uploaded;
      this.campaign.addPoints(this.cargo * 2);
      this.campaign.earnStationCredit();
      this.onEvent({ type: "upload", value: this.cargo });
      this.cargo = 0;
    }
    this.propellant += refuel;
    this.charge += charge;
    this.water += water;
    this.hull += hull;
    this.campaign.stats.services++;
    this.campaign.levelServices++;
    if (this.campaign.levelServices === 1) this.campaign.addPoints(120);
    this.sail = false;
    this.engineMode = "chemical";
    this.audio.chime(67, 0.12);
    const report = { propellant: refuel, charge, water, hull, uploaded, creditsSpent: 1, creditsRemaining: this.campaign.stationCredits };
    this.onEvent({ type: "station-serviced", report });
    this.publishHud();
    return report;
  }

  toggleArrays() {
    this.arrays = !this.arrays;
    if (this.arrays) {
      this.say(
        "arraysOut",
        true,
        "Arrays deployed. Light from the disk powers our battery. It does not create propellant.",
        "Arrays deployed. Sunbathing next to a black hole. Only you, Cooper.",
        true
      );
      this.discover("power");
    }
  }

  discover(id: string) {
    if (this.discoveries.has(id) || !LESSON_BY_ID.has(id)) return;
    this.discoveries.add(id);
    this.campaign.addPoints(50);
    this.onEvent({ type: "discovery", id });
  }

  rewardKnowledge(id: string) {
    if (!LESSON_BY_ID.has(id)) return;
    if (this.campaign.rewardKnowledge(id)) {
      this.audio.chime(79, 0.07);
      this.publishHud();
    }
  }

  setTarget(index: number) {
    this.targetIndex = Math.max(0, Math.min(5, Math.floor(index)));
    this.sectorTarget = null;
    this.publishHud();
  }

  targetName() {
    if (this.sectorTarget) return `Charted route / ${this.sectorTarget.label}`;
    return ["Research signal", "Endurance", "Miller's planet", "Mann's planet", "Edmunds' planet", "Wormhole"][this.targetIndex];
  }

  getTargetPosition(out: THREE.Vector3) {
    if (this.sectorTarget) {
      const angle = (this.sectorTarget.bearing + 0.5) * Math.PI * 2 / BEARING_COUNT;
      return out.set(Math.cos(angle) * this.sectorTargetRadius, 0, Math.sin(angle) * this.sectorTargetRadius);
    }
    if (this.targetIndex === 1) return out.copy(this.endurance.position);
    if (this.targetIndex >= 2 && this.targetIndex <= 4) return out.copy(this.planets[this.targetIndex - 2].mesh.position);
    if (this.targetIndex === 5) return out.copy(this.wormhole.position);
    let nearest = this.orbs[0];
    let distance = Infinity;
    for (const orb of this.orbs) {
      if (orb.kind !== "quanta" || orb.r < 2.8) continue;
      const d = orb.pos.distanceToSquared(this.pos);
      if (d < distance) { nearest = orb; distance = d; }
    }
    return out.copy(nearest.pos);
  }

  toggleAutopilot() {
    this.autopilot = !this.autopilot;
    this.mouse.set(0, 0);
    this.publishHud();
  }

  survey(planet: Planet) {
    if (planet.surveyed) return;
    planet.surveyed = true;
    this.cargo += 15;
    this.campaign.stats.surveys++;
    this.campaign.addPoints(150);
    this.discover(planet.name.toLowerCase());
    this.audio.chime(67, 0.1);
    this.onEvent({ type: "survey", name: planet.name, value: 15 });
    this.spawnBurst(this.pos, 0x8fd0ff, 40);
  }

  scan() {
    if (this.scanCooldown > 0 || this.mode !== "play" || this.paused) return;
    this.scanCooldown = 4;
    this.campaign.stats.scans++;
    this.discover("gargantua");
    this.discover("disk");
    this.discover("lensing");
    if (this.pos.length() < 8) { this.discover("relativity"); this.discover("horizon"); }
    for (const planet of this.planets) {
      if (this.pos.distanceTo(planet.mesh.position) < planet.radius + 3.5) this.survey(planet);
    }
    if (this.pos.distanceTo(this.endurance.position) < 7) this.discover("endurance");
    if (this.pos.distanceTo(this.wormhole.position) < 7) this.discover("wormhole");
    this.audio.chime(74, 0.07);
    this.spawnBurst(this.pos, 0x9fd0ff, 30);
    this.onEvent({ type: "bonus", text: "Science scan complete" });
    this.publishHud();
  }

  setQuality(mode: QualityMode) {
    this.qualityMode = mode;
    this.renderScale = mode === "eco" ? 0.4 : mode === "cinematic" ? 0.85 : 0.56;
    this.targetPixels = mode === "eco" ? 360000 : mode === "cinematic" ? 1400000 : 750000;
    this.quality = mode === "eco" ? 0.65 : 1;
    this.dust.geometry.setDrawRange(0, mode === "eco" ? 800 : 2200);
    this.resizeTarget();
    this.visualDirty = true;
    if (this.mode === "play") this.publishHud();
  }

  // ---------------- flow ----------------
  initAudio() {
    this.audio.init();
  }

  say(key: string, cond: boolean, serious: string, funny: string, force = false) {
    if (!cond) return;
    if (!force && this.flags[key]) return;
    this.flags[key] = true;
    this.onEvent({ type: "message", text: `TARS: ${this.humor >= 55 ? funny : serious}` });
  }

  startGame(level = 1) {
    this.audio.init();
    this.audio.setSuspended(false);
    this.mode = "play";
    this.paused = false;
    this.clearInput();
    this.campaign.reset(level, this.time);
    this.discoveries.clear();
    this.flightSectors.clear();
    this.sectorTarget = null;
    this.wasDocking = false;
    this.stationServiceReady = false;
    this.stationStock = { propellant: 400, charge: 500, water: 360, repair: 300 };
    this.stationCredits = this.campaign.stationCredits;
    this.flightSectors.clear();
    this.wasDocking = false;
    // Level one starts with a full battery so the first flight is about learning the controls, not managing a shortage.
    const training = level === 1;
    this.propellant = 100;
    this.charge = training ? 100 : 75;
    this.water = training ? 100 : 60;
    this.hull = 100;
    this.hullFlash = 0;
    this.weaponCooldown = 0;
    this.engineMode = "chemical";
    this.sail = false;
    this.sailAnim = 0;
    this.sailEfficiency = 0;
    this.ionActive = false;
    this.autoRefine = true;
    this.autoRefining = false;
    this.threatDistance = Infinity;
    this.hazards.reset();
    this.hazards.setLevel(level);
    // The opening tutorial stays calm; debris arrives from level two onward.
    this.hazards.setEnabled(level > 1);
    this.arrays = false;
    this.arrayAnim = 0;
    this.cargo = 0;
    this.uploaded = 0;
    this.earthYears = 0;
    // The training orbit has no deadline, so nobody fails the tutorial by reading the guide.
    this.yearLimit = training ? Infinity : MAX_YEARS;
    this.combo = 1;
    this.comboTimer = 0;
    this.diveMinR = 99;
    this.wormholeCooldown = 0;
    this.scanCooldown = 0;
    this.targetIndex = level === 4 ? 2 : 0;
    this.autopilot = false;
    this.docking = false;
    this.converting = false;
    this.scooping = false;
    this.visualDirty = true;
    this.flags = {};
    this.planets.forEach((p) => (p.surveyed = false));

    const ep = this.endurancePos();
    this.pos.copy(ep).multiplyScalar(1.07).add(_v1.set(0, 0.5, 0));
    const tangent = _v2.set(-Math.sin(this.endAngle), 0, Math.cos(this.endAngle));
    this.vel.copy(tangent).multiplyScalar(Math.sqrt(GM / this.pos.length()));
    this.quat.setFromRotationMatrix(_m1.lookAt(this.pos, _v3.copy(tangent).multiplyScalar(6), _v1.set(0, 1, 0)));

    this.ship.visible = true;
    this.trail.visible = true;
    this.speedLines.visible = true;
    for (let i = 0; i < this.trailPositions.length; i += 3) {
      this.trailPositions[i] = this.pos.x;
      this.trailPositions[i + 1] = this.pos.y;
      this.trailPositions[i + 2] = this.pos.z;
    }
    this.camera.position.copy(this.pos).add(_v1.set(0, 0.5, 2).applyQuaternion(this.quat).multiplyScalar(3));
    this.camera.quaternion.copy(this.quat);
    this.orbs.forEach((o) => this.makeOrb(o.kind, o));
    // A nearby first signal gives new pilots an achievable destination.
    for (let i = 0; i < 3; i++) {
      const orb = this.orbs[i];
      _v1.set((i - 1) * 0.5, 0, -3 - i * 1.1).applyQuaternion(this.quat).add(this.pos);
      orb.r = Math.hypot(_v1.x, _v1.z);
      orb.angle = Math.atan2(_v1.z, _v1.x);
      orb.y = _v1.y;
      orb.value = 10;
      orb.pos.copy(_v1);
    }
    this.currentSector = locateSector(this.pos);
    this.updateExploration();
    this.publishHud();
    this.onEvent({
      type: "message",
      text: training
        ? "TARS: Welcome aboard. This orbit is empty and the clock is stopped, so there is nothing to crash into and nothing to run out of. W or space burns the engines, and releasing it lets you coast. R opens the solar arrays."
        : `TARS: Level ${level}. ${MISSIONS[level - 1]?.title ?? "Debris run"}. Rock and ice are crossing these orbits. X or right click fires the mass driver; anything you cannot break, you fly around.`,
    });
  }

  toIntro() {
    this.mode = "intro";
    this.paused = false;
    this.audio.setSuspended(false);
    this.hazards.setEnabled(false);
    this.clearInput();
    this.visualDirty = true;
    this.ship.visible = false;
    this.trail.visible = false;
    this.speedLines.visible = false;
    this.dockingBeam.visible = false;
    this.markerEnd.style.display = "none";
    this.markerOrb.style.display = "none";
    this.markerHole.style.display = "none";
    this.markerTarget.style.display = "none";
  }

  endurancePos(out = new THREE.Vector3()) {
    return out.set(Math.cos(this.endAngle) * ENDURANCE_R, 0.4, Math.sin(this.endAngle) * ENDURANCE_R);
  }

  end(reason: "tesseract" | "timeout" | "win" | "wreck") {
    const score = reason === "tesseract" ? this.uploaded + this.cargo * 2 : this.uploaded;
    this.ship.visible = false;
    this.trail.visible = false;
    this.speedLines.visible = false;
    this.dockingBeam.visible = false;
    this.markerEnd.style.display = "none";
    this.markerOrb.style.display = "none";
    this.markerHole.style.display = "none";
    this.markerTarget.style.display = "none";
    if (reason === "tesseract") this.discover("tesseract");
    this.hazards.setEnabled(false);
    this.clearInput();
    this.visualDirty = true;
    this.mode = reason === "tesseract" ? "tesseract" : "outro";
    if (reason === "tesseract") this.audio.boom();
    else this.audio.chime(reason === "win" ? 69 : 57, 0.15);
    this.onEvent({ type: "end", reason, score, years: this.earthYears, points: this.campaign.points, completed: this.campaign.completed });
  }

  // ---------------- frame ----------------
  resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.compMat.uniforms.uAspect.value = w / h;
    this.resizeTarget();
  };

  resizeTarget() {
    const pr = this.renderer.getPixelRatio();
    const rawW = window.innerWidth * pr * this.renderScale;
    const rawH = window.innerHeight * pr * this.renderScale;
    const cap = Math.min(1, Math.sqrt(this.targetPixels / (rawW * rawH)));
    const w = Math.max(2, Math.round(rawW * cap));
    const h = Math.max(2, Math.round(rawH * cap));
    if (this.bhTarget.width !== w || this.bhTarget.height !== h) this.bhTarget.setSize(w, h);
    this.visualDirty = true;
  }

  /** Keeps the frame budget near 60fps by trading lensing resolution and integration steps. */
  governQuality(dt: number) {
    this.frameAcc += dt;
    this.frameCount++;
    if (this.frameAcc < 0.9) return;
    const avg = this.frameAcc / this.frameCount;
    this.fps = 1 / avg;
    this.frameAcc = 0;
    this.frameCount = 0;
    if (this.qualityMode !== "auto") return;
    const before = this.renderScale;
    if (avg > 0.02) {
      this.stableWindows = 0;
      this.renderScale = Math.max(0.3, this.renderScale - 0.06);
      this.quality = Math.max(0.6, this.quality - 0.07);
    } else if (avg < 0.0175 && ++this.stableWindows >= 3) {
      this.stableWindows = 0;
      this.renderScale = Math.min(0.78, this.renderScale + 0.035);
      this.quality = Math.min(1, this.quality + 0.06);
    }
    if (this.fps < 40 && this.renderer.getPixelRatio() > 1) {
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(window.innerWidth, window.innerHeight, false);
      this.resizeTarget();
    }
    if (before !== this.renderScale) this.resizeTarget();
  }

  loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const rawDt = Math.max(0.001, (now - this.last) / 1000);
    let dt = Math.min(0.05, rawDt);
    this.last = now;
    if (this.hidden) return;
    if (this.paused && !this.visualDirty) return;
    if (this.mode !== "play" && !this.paused) {
      this.cinematicTimer += rawDt;
      if (this.cinematicTimer < 1 / 30 && !this.visualDirty) return;
      dt = Math.min(0.07, this.cinematicTimer);
      this.cinematicTimer = 0;
    } else if (!this.paused) this.governQuality(rawDt);
    this.visualDirty = false;
    if (!this.paused) this.time += dt;

    this.compMat.uniforms.uFade.value = Math.min(1, this.compMat.uniforms.uFade.value + dt * 0.35);

    if (this.mode === "intro" || this.mode === "outro") this.updateCinematic(dt);
    else if (this.mode === "play" && !this.paused) this.updatePlay(dt);
    else if (this.mode === "debrief" && !this.paused) this.updateDebrief(dt);
    else if (this.mode === "tesseract" && !this.paused) this.updateTesseract(dt);
    if (!this.paused && this.mode !== "tesseract") this.updateWorld(dt);

    if (this.mode !== "tesseract") {
      this.camera.updateMatrixWorld();
      const u = this.bhMat.uniforms;
      u.uTime.value = this.time;
      u.uCamPos.value.copy(this.camera.position);
      u.uCamMat.value.copy(this.camera.matrixWorld);
      u.uTanHalfFov.value = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      u.uAspect.value = this.camera.aspect;
      const camR = this.camera.position.length();
      u.uSteps.value = THREE.MathUtils.clamp((260 - camR * 2.2) * this.quality, 110, 280);

      this.renderer.setRenderTarget(this.bhTarget);
      this.renderer.clear();
      this.renderer.render(this.bgScene, this.quadCam);
      this.renderer.setRenderTarget(null);

      this.compMat.uniforms.uTime.value = this.time;
      this.compMat.uniforms.uWarp.value = this.warp;
      this.renderer.render(this.compScene, this.quadCam);
    this.renderer.clearDepth();
      this.renderer.render(this.scene, this.camera);
    } else {
      this.renderer.clear();
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
    this.audioTimer += dt;
    if (this.audioTimer >= 0.08) {
      this.audio.update(this.audioTimer, 1, 0.15, 0, false);
      this.audio.setSolar(0);
      this.audioTimer = 0;
    }
  }

  updateWorld(dt: number) {
    this.endAngle += (dt * Math.sqrt(GM / ENDURANCE_R)) / ENDURANCE_R;
    this.endurancePos(this.endurance.position);
    this.enduranceRing.rotation.y += dt * 0.6;
    this.dockingRings.forEach((ring, i) => {
      ring.scale.setScalar(1 + Math.sin(this.time * 1.8 - i * 0.9) * 0.025);
      (ring.material as THREE.MeshBasicMaterial).opacity = this.docking ? 0.6 : 0.1 + 0.14 * (0.5 + Math.sin(this.time * 2 - i) * 0.5);
    });

    const playing = this.mode === "play";
    this.shipStrobe.visible = playing;
    if (playing) {
      const s = this.time % 1.8 < 0.055 || (this.time + 0.12) % 1.8 < 0.04;
      (this.shipStrobe.material as THREE.SpriteMaterial).opacity = s ? 0.95 : 0;
    }

    // Orbs: one instanced draw per kind plus one points draw for the glows.
    const qPos = this.quantaGlow.geometry.attributes.position.array as Float32Array;
    const cPos = this.cellGlow.geometry.attributes.position.array as Float32Array;
    let qi = 0;
    let ci = 0;
    for (const o of this.orbs) {
      o.angle += o.speed * dt;
      o.spin += dt * (o.kind === "quanta" ? 1.4 : 0.6);
      o.pos.set(Math.cos(o.angle) * o.r, o.y + Math.sin(this.time + o.angle * 3) * 0.08, Math.sin(o.angle) * o.r);
      _q1.setFromEuler(_euler.set(o.spin, o.spin * 0.7, 0));
      _m1.compose(o.pos, _q1, _v1.setScalar(o.scale));
      if (o.kind === "quanta") {
        this.quantaMesh.setMatrixAt(qi, _m1);
        qPos[qi * 3] = o.pos.x;
        qPos[qi * 3 + 1] = o.pos.y;
        qPos[qi * 3 + 2] = o.pos.z;
        qi++;
      } else {
        this.cellMesh.setMatrixAt(ci, _m1);
        cPos[ci * 3] = o.pos.x;
        cPos[ci * 3 + 1] = o.pos.y;
        cPos[ci * 3 + 2] = o.pos.z;
        ci++;
      }
    }
    this.quantaMesh.instanceMatrix.needsUpdate = true;
    this.cellMesh.instanceMatrix.needsUpdate = true;
    this.quantaGlow.geometry.attributes.position.needsUpdate = true;
    this.cellGlow.geometry.attributes.position.needsUpdate = true;

    for (let i = 0; i < this.planets.length; i++) {
      const p = this.planets[i];
      p.angle += p.speed * dt;
      p.mesh.position.set(Math.cos(p.angle) * p.r, p.y, Math.sin(p.angle) * p.r);
      p.mesh.children[0].rotation.y += dt * 0.08;
      const ring = this.surveyRings[i];
      ring.visible = playing && !p.surveyed;
      ring.rotation.z += dt * 0.4;
    }

    this.wormholeMat.uniforms.uTime.value = this.time;
    this.wormhole.rotation.y += dt * 0.15;
    this.wormhole.position.y = this.wormholePos.y + Math.sin(this.time * 0.5) * 0.25;
    this.dust.rotation.y += dt * 0.004;
    this.updateBursts(dt);
  }

  updatePlay(dt: number) {
    const k = this.keys;
    this.scanCooldown = Math.max(0, this.scanCooldown - dt);
    this.getTargetPosition(_destination);
    this.targetDistance = this.pos.distanceTo(_destination);
    const stopDistance = this.targetIndex >= 2 && this.targetIndex <= 4
      ? this.planets[this.targetIndex - 2].radius + 1.4 : this.targetIndex === 1 ? 0.9 : 0.2;
    const cruiseSpeed = Math.min(3.5, Math.sqrt(Math.max(0, this.targetDistance - stopDistance)) * 1.6);
    const dz = (v: number) => (Math.abs(v) < 0.06 ? 0 : (v - Math.sign(v) * 0.06) / 0.94);
    const agility = this.arrays ? 0.7 : 1; // extended arrays make her sluggish
    let yaw = -dz(this.mouse.x) * 1.7 * agility;
    let pitch = -dz(this.mouse.y) * 1.35 * agility;
    if (k.ArrowLeft) yaw += 1.4 * agility;
    if (k.ArrowRight) yaw -= 1.4 * agility;
    if (k.ArrowUp) pitch += 1.1 * agility;
    if (k.ArrowDown) pitch -= 1.1 * agility;
    let roll = 0;
    if (k.KeyA || k.KeyQ) roll += 1.8;
    if (k.KeyD || k.KeyE) roll -= 1.8;
    if (this.autopilot) {
      _steer.copy(_destination);
      // Route around the central hazard rather than aim through it at a far-side planet.
      _v1.copy(_destination).sub(this.pos);
      const segment2 = _v1.lengthSq();
      const along = segment2 > 0 ? -this.pos.dot(_v1) / segment2 : 0;
      _v2.copy(this.pos).addScaledVector(_v1, THREE.MathUtils.clamp(along, 0, 1));
      if (along > 0 && along < 1 && _v2.lengthSq() < 25 && _destination.length() > 5) {
        const a = Math.atan2(this.pos.z, this.pos.x);
        const goalAngle = Math.atan2(_destination.z, _destination.x);
        const diff = Math.atan2(Math.sin(goalAngle - a), Math.cos(goalAngle - a));
        const radius = Math.max(8, Math.min(17, this.pos.length()));
        _steer.set(Math.cos(a + Math.sign(diff) * 0.5) * radius, this.pos.y, Math.sin(a + Math.sign(diff) * 0.5) * radius);
      }
      _q1.setFromRotationMatrix(_m1.lookAt(this.pos, _steer, _v1.set(0, 1, 0)));
      this.quat.slerp(_q1, 1 - Math.exp(-dt * 3));
      yaw = 0;
      pitch = 0;
    } else {
      this.quat
        .multiply(_q1.setFromAxisAngle(_v1.set(0, 1, 0), yaw * dt))
        .multiply(_q1.setFromAxisAngle(_v1.set(1, 0, 0), pitch * dt))
        .multiply(_q1.setFromAxisAngle(_v1.set(0, 0, 1), roll * dt))
        .normalize();
    }
    this.bank += (yaw * 0.35 - this.bank) * Math.min(1, dt * 4);

    // ---- propulsion: propellant is reaction mass, charge is electrical power ----
    const wantThrust = k.KeyW || k.Space || this.mouseDown || this.touchThrust
      || (this.autopilot && this.vel.length() < cruiseSpeed && this.targetDistance > stopDistance + 0.15);
    const wantBoost = (k.ShiftLeft || k.ShiftRight) && this.charge > 1;
    const retro = k.KeyS || this.touchRetro || (this.autopilot && this.vel.length() > cruiseSpeed + 0.15);
    this.converting = (Boolean(k.KeyC) || this.touchConvert) && this.charge > 1 && this.water > 0 && this.propellant < 100;
    this.scooping = (Boolean(k.KeyF) || this.touchScoop
      || (this.autopilot && this.targetIndex === 0 && this.targetDistance < 5)) && this.charge > 1;

    if ((this.arrays || this.sail) && wantBoost && wantThrust && this.engineMode === "chemical") {
      this.arrays = false;
      this.sail = false;
      this.say("retract", true, "Arrays and sail stowed for a high-acceleration maneuver.", "Folding the furniture before we floor it.", true);
    }

    const acc = _v1.set(0, 0, 0);
    const fwd = _v2.set(0, 0, -1).applyQuaternion(this.quat);
    const r0 = this.pos.length();
    const illum = THREE.MathUtils.clamp(55 / (r0 * r0), 0.04, 1.35);
    let thrustAmt = 0;
    this.ionActive = false;

    if (this.engineMode === "chemical" && this.propellant > 0) {
      // Hydrogen and oxygen from the water tanks: strong, thirsty, finite.
      if (wantThrust) {
        const boost = wantBoost && !this.arrays && !this.sail;
        thrustAmt = boost ? 1 : 0.6;
        acc.addScaledVector(fwd, boost ? 5.2 : 2.8);
        this.propellant -= dt * (boost ? 7 : 3.4);
        if (boost) this.charge -= dt * 11;
      }
      if (retro) {
        const sp = this.vel.length();
        if (sp > 0.01) acc.addScaledVector(this.vel, -2.2 / sp);
        thrustAmt = Math.max(thrustAmt, 0.4);
        this.propellant -= dt * 2.6;
      }
    } else if (this.engineMode === "ion" && this.charge > 0.5 && this.propellant > 0) {
      // Solar-electric propulsion: ten times the exhaust velocity, a fraction of the propellant.
      if (wantThrust) {
        thrustAmt = 0.3;
        acc.addScaledVector(fwd, 1.05);
        this.propellant -= dt * 0.22;
        this.charge -= dt * 4.2;
        this.ionActive = true;
      }
      if (retro) {
        const sp = this.vel.length();
        if (sp > 0.01) acc.addScaledVector(this.vel, -0.8 / sp);
        thrustAmt = Math.max(thrustAmt, 0.22);
        this.propellant -= dt * 0.16;
        this.charge -= dt * 3;
        this.ionActive = true;
      }
      if (this.ionActive) {
        this.campaign.stats.ionSeconds += dt;
        if (this.campaign.stats.ionSeconds >= 1.5) this.discover("modes");
      }
    }
    this.propellant = Math.max(0, this.propellant);

    // ---- solar sail: photons carry momentum, so light itself can push ----
    this.sailAnim += ((this.sail ? 1 : 0) - this.sailAnim) * Math.min(1, dt * 2.4);
    this.sailEfficiency = 0;
    if (this.sail) {
      // A flat sail is pushed along its own normal with force ~ cos²(angle to the light).
      // Light leaves the disk radially, so facing away from Gargantua gives the full push;
      // angling the sail trades push for a sideways component, which is how a sail tacks.
      _v3.copy(this.pos).normalize();
      const cosTheta = Math.max(0, fwd.dot(_v3));
      this.sailEfficiency = cosTheta * cosTheta;
      acc.addScaledVector(fwd, 0.62 * illum * this.sailEfficiency * this.sailAnim);
      if (this.sailEfficiency > 0.05) {
        this.campaign.stats.sailSeconds += dt;
        if (this.campaign.stats.sailSeconds >= 2) this.discover("modes");
      }
      if (r0 < 2.6) {
        this.sail = false;
        this.say("sailHeat", true, "Sail film overheating. Furling it before it tears.", "The sail is tanning faster than the panels. Furling.", true);
      }
    }

    this.thrusting = thrustAmt > 0;
    this.boosting = Boolean(this.engineMode === "chemical" && wantBoost && wantThrust && !this.arrays && !this.sail && this.propellant > 0);
    if (this.thrusting) {
      this.campaign.stats.thrustSeconds += dt;
      if (this.campaign.stats.thrustSeconds >= 1) this.discover("propulsion");
    } else if (this.campaign.stats.thrustSeconds > 0) {
      this.campaign.stats.coastSeconds += dt;
      if (this.campaign.stats.coastSeconds >= 2) this.discover("inertia");
    }

    // ---- solar arrays: the disk is the star here ----
    this.arrayAnim += ((this.arrays ? 1 : 0) - this.arrayAnim) * Math.min(1, dt * 3.2);
    this.solarRate = 0;
    if (this.arrays) {
      this.solarRate = 26 * illum;
      this.charge = Math.min(100, this.charge + this.solarRate * dt);
      this.campaign.stats.solarSeconds += dt;
      if (r0 < 2.3) {
        this.arrays = false;
        this.charge = Math.max(0, this.charge - 8);
        this.say("fry", true, "Array overheat. Retracting before the panels melt.", "Panels medium-rare. Retracting before they're well done.", true);
      }
    }
    // The refinery runs when you hold C, or automatically on surplus charge when the arrays are out.
    this.autoRefining = this.autoRefine && this.arrays && this.charge > 65 && this.water > 0 && this.propellant < 96;
    if (this.converting || this.autoRefining) {
      const rate = this.converting ? 11 : 4.5;
      const produced = Math.min(this.water, this.charge * 0.55, rate * dt, 100 - this.propellant);
      this.charge -= produced / 0.55;
      this.water -= produced;
      this.propellant += produced;
      this.discover("electrolysis");
    }
    if (this.scooping) this.charge = Math.max(0, this.charge - 9 * dt);

    // ---- mass driver: an electromagnetic launcher runs on stored charge ----
    this.weaponCooldown = Math.max(0, this.weaponCooldown - dt);
    if (this.firePressed && this.weaponCooldown === 0 && this.charge >= 2.5) {
      this.weaponCooldown = 0.26;
      this.charge -= 2.5;
      _v2.set(0, 0, -1).applyQuaternion(this.quat);
      _v3.copy(this.pos).addScaledVector(_v2, 0.55);
      if (this.hazards.fire(_v3, _v2)) {
        // Newton's third law: launching a slug pushes the Ranger the other way.
        this.vel.addScaledVector(_v2, -0.045);
        this.audio.chime(84, 0.05);
        this.discover("defense");
      }
    }
    this.charge = THREE.MathUtils.clamp(this.charge, 0, 100);

    // ---- gravity ----
    const grav = _v3.copy(this.pos).multiplyScalar((-GM / (r0 * r0 * r0)) * (1 + 2.2 / (r0 * r0)));
    acc.add(grav);
    this.vel.addScaledVector(acc, dt);
    if (this.vel.length() > 9) this.vel.setLength(9);
    this.pos.addScaledVector(this.vel, dt);
    this.updateExploration();

    // ---- relativity ----
    const nr = this.pos.length();
    this.dilation = 1 / Math.sqrt(Math.max(0.002, 1 - 1 / nr));
    // The scenario deadline is accelerated; the displayed clock ratio is the unexaggerated stationary model.
    this.earthYears += 0.12 * this.dilation * dt;
    if (nr < 8) {
      this.campaign.stats.deepSeconds += dt;
      if (this.campaign.stats.deepSeconds >= 1) this.discover("relativity");
    }
    if (nr < 3) this.discover("horizon");
    const proximity = THREE.MathUtils.clamp(1 - (nr - 1) / 12, 0, 1);
    this.warp = THREE.MathUtils.lerp(this.warp, Math.pow(proximity, 3) * 1.2, dt * 2);
    if (this.comboTimer > 0) this.comboTimer -= dt;
    else this.combo = 1;

    // ---- slingshot bonus ----
    this.diveMinR = Math.min(this.diveMinR, nr);
    if (this.diveMinR < 5 && nr > 8) {
      const bonus = Math.round(10 + (5 - this.diveMinR) * 20);
      this.cargo += bonus;
      this.campaign.stats.flybys++;
      this.campaign.addPoints(200);
      this.discover("flyby");
      this.diveMinR = 99;
      this.audio.chime(71, 0.13);
      this.onEvent({ type: "bonus", text: `Deep flyby +${bonus} data / +200 points` });
      this.spawnBurst(this.pos, 0xffc27a, 40);
    }
    if (nr > 8) this.diveMinR = Math.min(this.diveMinR, 99);

    // ---- debris field: destroy what you can, avoid what you cannot ----
    this.hazardEvents.length = 0;
    this.hazards.update(dt, this.pos, this.vel, GM, this.hazardEvents);
    for (const event of this.hazardEvents) {
      if (event.type === "destroyed") {
        this.campaign.stats.destroyed++;
        this.campaign.levelDestroyed++;
        const earned = this.campaign.addStreakPoints(event.points);
        event.points = earned;
        this.spawnBurst(event.position, event.kind === "comet" ? 0x8fd0ff : 0xffc27a, event.kind === "comet" ? 46 : 34);
        this.audio.chime(event.kind === "comet" ? 74 : 58, 0.09);
        this.discover("debris");
        if (event.kind === "comet") this.discover("comets");
        // A comet is mostly ice. Break one nearby and the scoop field pulls in the fragments.
        if (event.kind === "comet" && event.position.distanceTo(this.pos) < 9 && this.water < 100) {
          const recovered = Math.min(100 - this.water, 14);
          this.water += recovered;
          this.campaign.stats.ice++;
          this.discover("isru");
          this.onEvent({ type: "hazard", text: `Comet cleared +${event.points} · ice recovered +${Math.round(recovered)} water`, tone: "good" });
          continue;
        }
        this.onEvent({ type: "hazard", text: `${event.kind === "comet" ? "Comet" : "Asteroid"} cleared +${event.points}`, tone: "good" });
      } else if (event.type === "dodged") {
        this.campaign.stats.dodged++;
        this.campaign.levelDodged++;
        const earned = this.campaign.addStreakPoints(event.points);
        this.discover("comets");
        const mult = this.campaign.streakMultiplier;
        this.onEvent({ type: "hazard", text: `Close pass avoided +${earned}${mult > 1 ? ` · x${mult} streak` : ""}`, tone: "good" });
      } else {
        this.campaign.levelHits++;
        this.campaign.levelHullLost += Math.min(this.hull, event.damage);
        if (this.campaign.streak >= 3) this.onEvent({ type: "hazard", text: `Streak of ${this.campaign.streak} broken`, tone: "bad" });
        this.campaign.breakStreak();
        this.hull = Math.max(0, this.hull - event.damage);
        this.hullFlash = 1;
        this.cargo = Math.max(0, this.cargo - Math.round(event.damage * 0.3));
        this.spawnBurst(event.position, 0xff8a52, 40);
        this.audio.boom();
        this.discover("debris");
        this.onEvent({ type: "hazard", text: `Hull impact -${Math.round(event.damage)}`, tone: "bad" });
      }
    }
    const threat = this.hazards.threat(this.pos);
    this.threatDistance = threat.distance;
    this.threatKind = threat.kind;
    // Flying the scoop through a comet's coma skims water off its outgassing ice.
    if (this.scooping && threat.kind === "comet" && threat.distance < 3.2 && this.water < 100) {
      this.water = Math.min(100, this.water + 3.5 * dt);
      this.discover("isru");
      if (!this.flags.comaNote) {
        this.flags.comaNote = true;
        this.campaign.stats.ice++;
        this.onEvent({ type: "hazard", text: "Skimming comet ice into the water tanks", tone: "good" });
      }
    }
    this.hullFlash = Math.max(0, this.hullFlash - dt * 1.6);
    if (this.hull <= 0) {
      this.end("wreck");
      return;
    }

    // ---- wormhole ----
    this.wormholeCooldown = Math.max(0, this.wormholeCooldown - dt);
    const dHole = this.pos.distanceTo(this.wormhole.position);
    if (dHole < 0.95 && this.wormholeCooldown === 0) {
      this.wormholeCooldown = 9;
      const a = Math.random() * Math.PI * 2;
      const rr = 4.2 + Math.random() * 1.6;
      this.pos.set(Math.cos(a) * rr, (Math.random() - 0.5) * 0.8, Math.sin(a) * rr);
      this.vel.set(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(Math.sqrt(GM / rr));
      this.charge = Math.min(100, this.charge + 45);
      this.diveMinR = 99;
      this.spawnBurst(this.pos, 0x8fd0ff, 70);
      this.audio.boom();
      this.campaign.addPoints(150);
      this.discover("wormhole");
      this.onEvent({ type: "bonus", text: "WORMHOLE TRANSIT · +45 CHARGE" });
      this.say("hole", true, "They placed it here for us. Straight into the rich orbits.", "Somebody built a shortcut. Rude not to use it.", true);
    }

    // ---- docking ----
    const ep = this.endurance.position;
    const dEnd = this.pos.distanceTo(ep);
    this.docking = dEnd < 1.5;
    if (this.docking && !this.wasDocking) {
      this.campaign.stats.docks++;
      this.campaign.levelDocks++;
      this.audio.chime(65, 0.08);
      this.onEvent({ type: "station-docked" });
    }
    this.wasDocking = this.docking;
    this.dockingBeam.visible = dEnd < 7;
    if (this.dockingBeam.visible) {
      const beam = this.dockingBeam.geometry.attributes.position as THREE.BufferAttribute;
      beam.setXYZ(0, this.pos.x, this.pos.y, this.pos.z);
      beam.setXYZ(1, ep.x, ep.y, ep.z);
      beam.needsUpdate = true;
      (this.dockingBeam.material as THREE.LineBasicMaterial).opacity = THREE.MathUtils.clamp((7 - dEnd) / 12, 0.08, 0.5);
    }
    if (this.docking) {
      if (this.cargo > 0) {
        const v = this.cargo;
        this.uploaded += v;
        this.campaign.stats.uploaded = this.uploaded;
        this.campaign.addPoints(v * 2);
        this.campaign.earnStationCredit();
        this.discover("endurance");
        this.cargo = 0;
        this.audio.chime(64, 0.14);
        this.onEvent({ type: "upload", value: v });
        this.say("upload", true, `${v} quanta uploaded. Professor Brand is crunching the equation.`, `${v} quanta uploaded. Brand says thanks, in his own joyless way.`, true);
      }
      // Docked: Endurance tops everything up continuously; the service panel does it instantly.
      this.propellant = Math.min(100, this.propellant + dt * 30);
      this.charge = Math.min(100, this.charge + dt * 30);
      this.water = Math.min(100, this.water + dt * 24);
      this.hull = Math.min(100, this.hull + dt * 20);
      this.vel.lerp(_v1.set(-Math.sin(this.endAngle), 0, Math.cos(this.endAngle)).multiplyScalar(Math.sqrt(GM / ENDURANCE_R)), dt * 0.8);
    }

    // ---- pickups & scoop ----
    const scoopRange = this.scooping ? 5 : 0;
    const pickRange = this.scooping ? 0.85 : 0.5;
    for (const o of this.orbs) {
      const d = o.pos.distanceTo(this.pos);
      if (scoopRange > 0 && d < scoopRange) {
        const pull = (1 - d / scoopRange) * 2.4 * dt;
        _v1.copy(this.pos).sub(o.pos).normalize();
        const nx = o.pos.x + _v1.x * pull;
        const nz = o.pos.z + _v1.z * pull;
        o.r = Math.hypot(nx, nz);
        o.angle = Math.atan2(nz, nx);
        o.y += _v1.y * pull;
      }
      if (d < (o.kind === "quanta" ? pickRange : pickRange + 0.05)) {
        if (o.kind === "quanta") {
          this.combo = this.comboTimer > 0 ? Math.min(5, this.combo + 1) : 1;
          this.comboTimer = 6;
          const value = Math.round(o.value * (1 + (this.combo - 1) * 0.25));
          this.cargo += value;
          this.campaign.stats.collected += value;
          this.campaign.levelCollected += value;
          this.campaign.addPoints(value * 10);
          this.discover("orbits");
          this.audio.chime(72 + Math.min(12, Math.round(o.value / 4)), 0.08);
          this.onEvent({ type: "collect", value });
          this.spawnBurst(o.pos, 0xffc27a, 34);
        } else {
          this.propellant = Math.min(100, this.propellant + 34);
          this.campaign.addPoints(25);
          this.audio.chime(60, 0.08);
          this.onEvent({ type: "fuel" });
          this.spawnBurst(o.pos, 0x8fd0ff, 28);
        }
        this.makeOrb(o.kind, o);
      }
    }

    for (const p of this.planets) {
      const d = p.mesh.position.distanceTo(this.pos);
      if (!p.surveyed && d < p.radius * 2.0) {
        this.survey(p);
      }
      if (d < p.radius + 0.08) {
        _v1.copy(this.pos).sub(p.mesh.position).normalize();
        this.pos.copy(p.mesh.position).addScaledVector(_v1, p.radius + 0.08);
        const vn = this.vel.dot(_v1);
        if (vn < 0) this.vel.addScaledVector(_v1, -vn * 1.4);
      }
    }

    // ---- TARS ----
    this.say("r6", nr < 6, "Our model clock is slower than a distant clock. Your local time still feels normal.", "Two clocks, different rates. Your own watch still feels perfectly normal.");
    this.say("r3", nr < 3, "Honesty setting 90%. We should not be this close.", "Honesty 90%: this is a terrible idea. Humor 75%: do it again.");
    this.say("prop", this.propellant < 20, "Propellant low. Open the arrays and the refinery will split water into fuel; switch to the sail with V and light itself will push us.", "Out of push? Arrays out and the refinery brews fuel from water. Or press V: the sail runs on nothing but light, and the disk is not running out of that.");
    // Never stranded: with dry tanks and no water to refine, switch to the sail, which runs on light alone.
    if (this.propellant < 0.5 && this.water < 0.5 && this.engineMode !== "sail" && !this.docking) {
      this.setEngineMode("sail");
      this.onEvent({ type: "hazard", tone: "good", text: "Tanks dry. Solar sail deployed: sunlight is now your engine." });
    }
    this.say("sailRescue", this.propellant < 2 && this.engineMode !== "sail", "Tanks empty. Select the sail with V; photon pressure needs no propellant.", "Tanks are dry. V for the sail, Cooper. The light is free and it never runs out.");
    this.say("charge", this.charge < 15, "Power reserves low. Deploy arrays closer to the disk.", "Battery's nearly flat. Even I need a nap.");
    this.say("y30", this.earthYears > 30, "Thirty years have passed on Earth.", "Thirty years gone. Murph is older than you now. Awkward.");
    this.say("y50", this.earthYears > 50, "Ten years left. Make them count.", "Ten years left. No pressure. Well, some pressure.");
    this.say("full", this.cargo >= 60, "Cargo is heavy with data. Return to Endurance.", "We're hauling a library. Endurance, please, before I start reading it.");

    this.campaign.tick(dt);
    const finishedMission = MISSIONS[this.campaign.index];
    const result = this.campaign.advance(this.time, this.hull);
    if (result && finishedMission) {
      for (const id of finishedMission.subjects) this.discover(id);
      // Freeze the flight and hand control to the debrief; the next level starts on the player's say-so.
      this.mode = "debrief";
      this.clearInput();
      this.hazards.setEnabled(false);
      this.audio.fanfare(result.stars);
      this.publishHud();
      this.onEvent({ type: "mission", result, campaignComplete: this.campaign.completed >= MISSIONS.length });
      return;
    }

    // ---- endings ----
    if (nr < 1.12) {
      if (!this.flags.horizon) {
        this.flags.horizon = true;
        this.onEvent({ type: "horizon" });
      }
      this.end("tesseract");
      return;
    }

    if (this.earthYears >= MAX_YEARS) return this.end("timeout");

    // ---- ship visuals ----
    this.ship.position.copy(this.pos);
    this.ship.quaternion.copy(this.quat);
    this.shipBody.rotation.z = this.bank;
    const flick = 0.85 + Math.random() * 0.3;
    for (let i = 0; i < this.engineGlows.length; i++) {
      this.engineGlows[i].scale.setScalar((0.035 + thrustAmt * 0.16) * flick);
      const plume = this.enginePlumes[i];
      plume.visible = thrustAmt > 0.03;
      if (plume.visible) {
        const plumeMat = plume.material as THREE.MeshBasicMaterial;
        if (this.ionActive) {
          // Ion exhaust: a faint violet beam, narrow and steady, nothing like a chemical flame.
          plumeMat.color.setHex(0x9d86ff);
          plumeMat.opacity = 0.22 + Math.random() * 0.06;
          plume.scale.set(0.38, 1.9, 0.38);
        } else {
          plumeMat.color.setHex(0x77caff);
          plumeMat.opacity = thrustAmt * (0.3 + Math.random() * 0.25);
          plume.scale.set(0.75 + Math.random() * 0.25, 0.3 + thrustAmt * (this.boosting ? 2.2 : 1.2), 0.75 + Math.random() * 0.25);
        }
      }
    }
    for (let i = 0; i < this.rcsGlows.length; i++) {
      const active = (i === 0 && yaw < -0.12) || (i === 1 && yaw > 0.12);
      (this.rcsGlows[i].material as THREE.SpriteMaterial).opacity = active ? 0.35 + Math.random() * 0.4 : 0;
    }
    for (let i = 0; i < this.navLights.length; i++) {
      (this.navLights[i].material as THREE.SpriteMaterial).opacity = 0.55 + 0.25 * Math.sin(this.time * 4 + i * Math.PI);
    }
    for (let i = 0; i < this.arrayPivots.length; i++) {
      const s = i === 0 ? -1 : 1;
      this.arrayPivots[i].rotation.z = (1 - this.arrayAnim) * -1.35 * s;
      this.arrayPivots[i].scale.setScalar(0.25 + this.arrayAnim * 0.75);
      const m = this.arrayPanels[i].material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.3 + (this.solarRate / 36) * 2.2;
    }
    // Sail unfurls from the hub; its glint tracks how squarely it faces the light.
    this.sailMesh.visible = this.sailAnim > 0.01;
    if (this.sailMesh.visible) {
      this.sailMesh.scale.setScalar(Math.max(0.001, this.sailAnim));
      const film = this.sailFilm.material as THREE.MeshStandardMaterial;
      film.emissiveIntensity = 0.15 + this.sailEfficiency * illum * 1.4;
      film.opacity = 0.35 + this.sailEfficiency * 0.3;
    }
    const sc = this.scoopField.material as THREE.MeshBasicMaterial;
    sc.opacity = this.scooping ? 0.07 + Math.sin(this.time * 9) * 0.025 : 0;
    this.scoopField.visible = this.scooping;
    this.scoopField.scale.setScalar(scoopRange || 1);
    this.scoopField.rotation.y += dt * 0.6;

    // trail
    _v1.set(0, 0, 0.24).applyQuaternion(this.quat).add(this.pos);
    const i3 = this.trailIndex * 3;
    this.trailPositions[i3] = _v1.x;
    this.trailPositions[i3 + 1] = _v1.y;
    this.trailPositions[i3 + 2] = _v1.z;
    this.trailIndex = (this.trailIndex + 1) % (this.trailPositions.length / 3);
    this.trail.geometry.attributes.position.needsUpdate = true;
    (this.trail.material as THREE.PointsMaterial).opacity = 0.12 + thrustAmt * 0.45;

    // camera
    const speed = this.vel.length();
    // Chase camera: pulls back under thrust, lags the ship's turn so you feel the yaw,
    // and banks into turns like a camera operator leaning with the aircraft.
    this.camPullback += ((thrustAmt > 0 ? 0.42 * thrustAmt + (this.boosting ? 0.35 : 0) : 0) - this.camPullback) * Math.min(1, dt * 2.4);
    this.camBank += (-this.bank * 0.55 - this.camBank) * Math.min(1, dt * 3.5);
    _v1.set(0, 0.31, 1.62 + speed * 0.055 + this.camPullback).applyQuaternion(this.quat).add(this.pos);
    this.camera.position.lerp(_v1, 1 - Math.exp(-dt * 6));
    _q1.copy(this.quat).multiply(_q2.setFromAxisAngle(_vz, this.camBank));
    this.camera.quaternion.slerp(_q1, 1 - Math.exp(-dt * 4.2));
    const shake = this.reducedMotion ? 0 : Math.pow(proximity, 4) * 0.02 + thrustAmt * 0.002 + this.hullFlash * 0.07;
    this.camera.position.x += (Math.random() - 0.5) * shake;
    this.camera.position.y += (Math.random() - 0.5) * shake;
    this.camera.fov += (58 + speed * 1.45 + (this.boosting ? 7 : 0) - this.camera.fov) * Math.min(1, dt * 3);
    this.camera.updateProjectionMatrix();

    const streak = this.speedLines.geometry.attributes.position as THREE.BufferAttribute;
    const sa = streak.array as Float32Array;
    for (let i = 0; i < sa.length; i += 6) {
      let z = sa[i + 2] + dt * (1 + speed * 2.8 + (this.boosting ? 18 : 0));
      if (z > -0.45) {
        z = -28 - Math.random() * 14;
        sa[i] = sa[i + 3] = (Math.random() - 0.5) * 8;
        sa[i + 1] = sa[i + 4] = (Math.random() - 0.5) * 5;
      }
      sa[i + 2] = z;
      sa[i + 5] = z - (0.04 + speed * 0.025 + (this.boosting ? 1.2 : 0));
    }
    streak.needsUpdate = true;
    (this.speedLines.material as THREE.LineBasicMaterial).opacity = THREE.MathUtils.clamp((speed - 1.3) * 0.04 + (this.boosting ? 0.28 : 0), 0, 0.45);

    this.audioTimer += dt;
    if (this.audioTimer >= 0.08) {
      this.audio.update(this.audioTimer, this.dilation, proximity, this.ionActive ? 0 : thrustAmt, true);
      this.audio.setSolar(this.arrays ? this.solarRate / 36 : 0);
      this.audio.setIon(this.ionActive ? 1 : 0);
      this.audioTimer = 0;
    }

    this.markerTimer += dt;
    if (this.markerTimer >= 1 / 24) {
      this.markerTimer = 0;
      this.camera.updateMatrixWorld();
      this.updateMarker(this.markerEnd, ep, dEnd);
      this.getTargetPosition(_destination);
      this.updateMarker(this.markerTarget, _destination, this.targetDistance, this.targetName());
      this.markerOrb.style.display = "none";
      if (dHole < 7 && this.targetIndex !== 5) this.updateMarker(this.markerHole, this.wormhole.position, dHole);
      else this.markerHole.style.display = "none";
      if (this.targetIndex === 1) this.markerEnd.style.display = "none";
    }

    const mission = MISSIONS[this.campaign.index];
    const task = mission?.tasks.find((item) => this.campaign.stats[item.metric] < item.goal);
    this.objective = this.docking
      ? "Docking lock / resupply"
      : this.converting ? "Electrolyzing stored water" : task?.label ?? "Return to Endurance";

    this.hudTimer += dt;
    if (this.hudTimer >= 1 / 6) {
      this.hudTimer = 0;
      this.publishHud();
    }
  }

  publishHud() {
    this.onHud({
      earthYears: this.earthYears, maxYears: MAX_YEARS, dilation: this.dilation,
      distance: this.pos.length(), speed: this.vel.length(), propellant: this.propellant,
      charge: this.charge, water: this.water, hull: this.hull,
      engineMode: this.engineMode, ionActive: this.ionActive, sail: this.sail, sailEfficiency: this.sailEfficiency,
      autoRefine: this.autoRefine, autoRefining: this.autoRefining,
      weaponReady: THREE.MathUtils.clamp(1 - this.weaponCooldown / 0.26, 0, 1),
      threatDistance: this.threatDistance, threatKind: this.threatKind,
      arrays: this.arrays, solarRate: this.solarRate,
      converting: this.converting, scooping: this.scooping, cargo: this.cargo,
      uploaded: this.uploaded, goal: GOAL, docking: this.docking, thrust: this.thrusting,
      boost: this.boosting, proximity: THREE.MathUtils.clamp(1 - (this.pos.length() - 1) / 12, 0, 1),
      combo: this.combo, objective: this.objective, fps: this.fps,
      campaign: this.campaign.snapshot(), target: this.targetName(), targetDistance: this.targetDistance,
      autopilot: this.autopilot, scanCooldown: this.scanCooldown, quality: this.qualityMode,
      sector: this.currentSector,
      chartedSectors: this.chartedSectors.size,
      totalSectors: SECTOR_COUNT,
      stationCredits: this.campaign.stationCredits,
    });
  }

  updateMarker(el: HTMLDivElement, world: THREE.Vector3, dist: number, extra = "") {
    const w = window.innerWidth;
    const h = window.innerHeight;
    _v1.copy(world).project(this.camera);
    const behind = _v1.z > 1;
    let x = behind ? -_v1.x : _v1.x;
    let y = behind ? -_v1.y : _v1.y;
    const off = behind || Math.abs(x) > 0.92 || Math.abs(y) > 0.88;
    if (off) {
      const m = Math.max(Math.abs(x) / 0.92, Math.abs(y) / 0.85, 1e-3);
      x /= m;
      y /= m;
    }
    el.style.display = "block";
    el.style.opacity = off ? "0.55" : "1";
    el.style.transform = `translate(${((x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-y * 0.5 + 0.5) * h).toFixed(1)}px)`;
    const label = this.markerLabels.get(el);
    const text = `${dist.toFixed(1)} rs ${extra}`;
    if (label && label.textContent !== text) label.textContent = text;
  }

  /** Between levels the ship drifts on and the camera eases into a slow hero orbit around it. */
  updateDebrief(dt: number) {
    const r = this.pos.length();
    this.vel.addScaledVector(_v3.copy(this.pos).multiplyScalar(-GM / (r * r * r)), dt);
    this.pos.addScaledVector(this.vel, dt);
    this.ship.position.copy(this.pos);
    this.ship.quaternion.copy(this.quat);
    const orbit = this.time * 0.22;
    _v1.set(Math.sin(orbit) * 2.4, 0.7, Math.cos(orbit) * 2.4).add(this.pos);
    this.camera.position.lerp(_v1, 1 - Math.exp(-dt * 1.6));
    _q1.setFromRotationMatrix(_m1.lookAt(this.camera.position, this.pos, _v2.set(0, 1, 0)));
    this.camera.quaternion.slerp(_q1, 1 - Math.exp(-dt * 2.5));
    this.camera.fov += (50 - this.camera.fov) * Math.min(1, dt * 1.5);
    this.camera.updateProjectionMatrix();
    for (const plume of this.enginePlumes) plume.visible = false;
    this.audioTimer += dt;
    if (this.audioTimer >= 0.08) {
      this.audio.update(this.audioTimer, 1, 0.15, 0, false);
      this.audio.setSolar(0);
      this.audio.setIon(0);
      this.audioTimer = 0;
    }
  }

  updateTesseract(dt: number) {
    this.camera.position.set(0, 0, 4);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, -10);
    this.camera.rotateZ(Math.sin(this.time * 0.2) * 0.25);
    this.camera.fov += (75 - this.camera.fov) * dt;
    this.camera.updateProjectionMatrix();
    this.lattice.position.z = (this.time * 1.2) % 2;

    this.projectHypercube(this.hyperLines, 2.4, 0);
    this.projectHypercube(this.hyperLines2, 4.2, 1.3);
    this.audioTimer += dt;
    if (this.audioTimer >= 0.08) {
      this.audio.update(this.audioTimer, 1, 0.6, 0, false);
      this.audio.setSolar(0);
      this.audioTimer = 0;
    }
  }

  projectHypercube(lines: THREE.LineSegments, scale: number, phase: number) {
    const a = this.time * 0.5 + phase, b = this.time * 0.33 + phase, c = this.time * 0.21;
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
    const pts = this.hyperProjected;
    for (let i = 0; i < 16; i++) {
      const vertex = this.hyperVerts[i];
      const x = vertex[0], y = vertex[1], z = vertex[2], w = vertex[3];
      const x1 = x * ca - w * sa, w1 = x * sa + w * ca;
      const y1 = y * cb - z * sb, z1 = y * sb + z * cb;
      const z2 = z1 * cc - w1 * sc, w2 = z1 * sc + w1 * cc;
      const k = scale / (3 - w2);
      pts[i * 3] = x1 * k; pts[i * 3 + 1] = y1 * k; pts[i * 3 + 2] = z2 * k;
    }
    const arr = lines.geometry.attributes.position.array as Float32Array;
    for (let n = 0; n < this.hyperEdges.length; n++) {
      const first = this.hyperEdges[n][0] * 3, second = this.hyperEdges[n][1] * 3;
      for (let axis = 0; axis < 3; axis++) { arr[n * 6 + axis] = pts[first + axis]; arr[n * 6 + axis + 3] = pts[second + axis]; }
    }
    lines.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("contextmenu", this.onContextMenu);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.markerEnd.remove();
    this.markerOrb.remove();
    this.markerHole.remove();
    this.markerTarget.remove();
    this.hazards.dispose();
    if (this.audio.ctx && this.audio.ctx.state !== "closed") void this.audio.ctx.close().catch(() => {});
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>([this.starTex, this.diskTex, this.hullTex, this.glowGold, this.glowBlue]);
    for (const scene of [this.scene, this.bgScene, this.compScene, this.tessScene]) {
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        if (mesh.material) {
          const values = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const material of values) {
            materials.add(material);
            for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
          }
        }
      });
    }
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
    this.bhTarget.dispose();
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
  }
}
