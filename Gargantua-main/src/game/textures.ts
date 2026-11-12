import * as THREE from "three";

/** Small radial sprite used for every glow in the game (shared, so it uploads once). */
export function makeGlowTexture(inner: string, outer: string) {
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

/**
 * Equirectangular starfield baked once on the CPU.
 * This replaces ~40 procedural hash/noise calls per pixel per frame in the
 * lensing shader with a single texture fetch - the single biggest GPU win.
 */
export function makeStarTexture() {
  const w = 2048;
  const h = 1024;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = "#01020a";
  g.fillRect(0, 0, w, h);

  const wrapped = (x: number, rad: number, draw: (x: number) => void) => {
    draw(x);
    if (x < rad) draw(x + w);
    if (x > w - rad) draw(x - w);
  };
  const bandY = (u: number) => h * (0.5 + 0.18 * Math.sin(u * Math.PI * 2 + 0.6));

  // Galactic haze
  g.globalCompositeOperation = "lighter";
  for (let i = 0; i < 150; i++) {
    const u = Math.random();
    const y = bandY(u) + (Math.random() + Math.random() + Math.random() - 1.5) * h * 0.07;
    const rad = 70 + Math.random() * 280;
    const warm = Math.random() > 0.45;
    const col = warm ? [128, 82, 46] : [42, 60, 116];
    const a = 0.04 + Math.random() * 0.09;
    wrapped(u * w, rad, (x) => {
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a})`);
      grd.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      g.fill();
    });
  }

  // Dust lanes cutting through the band
  g.globalCompositeOperation = "source-over";
  for (let i = 0; i < 70; i++) {
    const u = Math.random();
    const y = bandY(u) + (Math.random() - 0.5) * h * 0.05;
    const rad = 40 + Math.random() * 170;
    wrapped(u * w, rad, (x) => {
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, `rgba(0,0,0,${0.18 + Math.random() * 0.22})`);
      grd.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      g.fill();
    });
  }

  // Star field, denser along the galactic plane
  g.globalCompositeOperation = "lighter";
  for (let i = 0; i < 2600; i++) {
    const u = Math.random();
    const towardBand = Math.random() < 0.55;
    const y = towardBand
      ? Math.max(2, Math.min(h - 2, bandY(u) + (Math.random() + Math.random() - 1) * h * 0.1))
      : Math.random() * h;
    const x = u * w;
    const mag = Math.pow(Math.random(), 3);
    const rad = 0.6 + mag * 2.2;
    const tint = Math.random();
    const col = tint > 0.72 ? [255, 218, 185] : tint > 0.35 ? [245, 248, 255] : [196, 216, 255];
    const a = 0.35 + mag * 0.65;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad * 3);
    grd.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a})`);
    grd.addColorStop(0.35, `rgba(${col[0]},${col[1]},${col[2]},${a * 0.35})`);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, rad * 3, 0, Math.PI * 2);
    g.fill();
  }

  // A few anchor stars with subtle diffraction flares
  for (let i = 0; i < 45; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const len = 8 + Math.random() * 26;
    g.strokeStyle = "rgba(255,255,255,.35)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x - len, y);
    g.lineTo(x + len, y);
    g.moveTo(x, y - len * 0.6);
    g.lineTo(x, y + len * 0.6);
    g.stroke();
    const grd = g.createRadialGradient(x, y, 0, x, y, 6);
    grd.addColorStop(0, "rgba(255,255,255,.95)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, 6, 0, Math.PI * 2);
    g.fill();
  }
  g.globalCompositeOperation = "source-over";

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

/**
 * Accretion disk density in polar space: x = angle (wraps), y = radius.
 * Baking the turbulence removes all fbm noise from the per-pixel hot path.
 */
export function makeDiskTexture() {
  const w = 1024;
  const h = 256;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, w, h);

  // Base falloff: brightest at the inner edge (v = 0)
  const base = g.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, "rgba(255,255,255,.62)");
  base.addColorStop(0.28, "rgba(255,255,255,.5)");
  base.addColorStop(0.7, "rgba(255,255,255,.26)");
  base.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);

  g.globalCompositeOperation = "lighter";
  const wrapped = (x: number, pad: number, draw: (x: number) => void) => {
    draw(x);
    if (x < pad) draw(x + w);
    if (x > w - pad) draw(x - w);
  };

  // Sheared turbulent streaks following the orbital flow
  for (let i = 0; i < 1500; i++) {
    const y = Math.pow(Math.random(), 0.75) * h;
    const len = 24 + Math.random() * 300;
    const a = 0.03 + Math.random() * 0.14;
    const lw = 1 + Math.random() * 8 * (1 - y / h + 0.25);
    wrapped(Math.random() * w, len, (x) => {
      g.strokeStyle = `rgba(255,255,255,${a})`;
      g.lineWidth = lw;
      g.beginPath();
      g.moveTo(x, y);
      g.bezierCurveTo(
        x + len * 0.33, y + (Math.random() - 0.5) * 7,
        x + len * 0.66, y + (Math.random() - 0.5) * 7,
        x + len, y + (Math.random() - 0.5) * 12
      );
      g.stroke();
    });
  }

  // Fine granulation
  for (let i = 0; i < 4200; i++) {
    const y = Math.pow(Math.random(), 0.7) * h;
    const x = Math.random() * w;
    const r = 1 + Math.random() * 7;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(255,255,255,${0.05 + Math.random() * 0.12})`);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  // Concentric density waves
  for (let i = 0; i < 46; i++) {
    const y = Math.random() * h;
    g.strokeStyle = `rgba(255,255,255,${0.03 + Math.random() * 0.07})`;
    g.lineWidth = 1 + Math.random() * 5;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 2.4);
    g.stroke();
  }
  g.globalCompositeOperation = "source-over";

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

export function makeHullTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#c8c5bc";
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5000; i++) {
    const v = 150 + Math.floor(Math.random() * 80);
    g.fillStyle = `rgba(${v},${v},${v - 4},${Math.random() * 0.055})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  g.strokeStyle = "rgba(25,28,31,.28)";
  g.lineWidth = 2;
  for (let i = 0; i <= 8; i++) {
    const p = i * 64;
    g.beginPath();
    g.moveTo(p, 0);
    g.lineTo(p + (i % 2) * 18, 512);
    g.stroke();
    g.beginPath();
    g.moveTo(0, p);
    g.lineTo(512, p + (i % 3) * 10);
    g.stroke();
  }
  g.fillStyle = "rgba(22,24,28,.75)";
  for (let i = 0; i < 26; i++) g.fillRect(Math.random() * 500, Math.random() * 500, 3 + Math.random() * 14, 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 2;
  return t;
}

export function makeDecalTexture(title: string, sub: string) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = "rgba(22,25,28,.92)";
  g.font = "700 44px Arial, sans-serif";
  g.textAlign = "center";
  g.fillText(title, 256, 53);
  g.fillStyle = "rgba(118,64,42,.9)";
  g.fillRect(70, 67, 372, 7);
  g.fillStyle = "rgba(28,31,34,.75)";
  g.font = "24px monospace";
  g.fillText(sub, 256, 108);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makePlanetTexture(
  base: [number, number, number],
  accent: [number, number, number],
  bands: number,
  seed: number
) {
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
    const hgt = 2 + rnd() * 18;
    const a = 0.08 + rnd() * 0.35;
    const mix = rnd();
    const col = base.map((b, k) => Math.round(b * (1 - mix) + accent[k] * mix));
    g.fillStyle = `rgba(${col.join(",")},${a})`;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 512; x += 16) g.lineTo(x, y + Math.sin(x * 0.02 + i) * hgt * 0.5 + (rnd() - 0.5) * 3);
    g.lineTo(512, y + hgt);
    g.lineTo(0, y + hgt);
    g.fill();
  }
  for (let i = 0; i < 220; i++) {
    g.fillStyle = `rgba(${accent.join(",")},${rnd() * 0.18})`;
    g.beginPath();
    g.arc(rnd() * 512, rnd() * 256, rnd() * 10, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
