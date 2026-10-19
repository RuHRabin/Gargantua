import * as THREE from "three";

/**
 * Debris field: rocky asteroids and icy comets that sweep through the Ranger's
 * flight path. Both can be destroyed with the mass driver or simply avoided.
 *
 * Science notes kept honest in the field guide:
 *  - Asteroids are rocky/metallic leftovers; comets are ice-rich and grow a
 *    coma and tail when heated. A tail points AWAY from the light source, not
 *    backwards along the direction of travel.
 *  - Deflecting a body by hitting it is a real technique (NASA's DART), though
 *    in reality it nudges an orbit over months rather than shattering a rock.
 */

export type HazardKind = "asteroid" | "comet";

export interface HazardEvent {
  type: "destroyed" | "dodged" | "hit";
  kind: HazardKind;
  position: THREE.Vector3;
  points: number;
  damage: number;
}

interface Hazard {
  active: boolean;
  kind: HazardKind;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  rot: THREE.Euler;
  radius: number;
  hp: number;
  life: number;
  closest: number;
  wasNear: boolean;
  counted: boolean;
}

const MAX_ASTEROIDS = 16;
const MAX_COMETS = 7;
const MAX_SHOTS = 26;
const TAIL_PER_COMET = 9;

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

/** Lumpy rock silhouette: displace an icosahedron once, then instance it. */
function rockGeometry() {
  const geo = new THREE.IcosahedronGeometry(0.3, 1);
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n = 0.72 + 0.56 * Math.abs(Math.sin(x * 7.3) * Math.cos(y * 5.1) * Math.sin(z * 6.7));
    pos.setXYZ(i, x * n, y * n * 0.88, z * n);
  }
  geo.computeVertexNormals();
  return geo;
}

export class HazardField {
  scene: THREE.Scene;
  asteroids: Hazard[] = [];
  comets: Hazard[] = [];
  asteroidMesh: THREE.InstancedMesh;
  cometMesh: THREE.InstancedMesh;
  cometGlow: THREE.Points;
  tails: THREE.Points;
  shots: THREE.Points;
  shotPos: Float32Array;
  shotVel: Float32Array;
  shotLife: Float32Array;
  tailPositions: Float32Array;
  cometGlowPositions: Float32Array;
  spawnTimer = 1.5;
  intensity = 1;
  enabled = false;

  constructor(scene: THREE.Scene, glowGold: THREE.Texture, glowBlue: THREE.Texture) {
    this.scene = scene;

    this.asteroidMesh = new THREE.InstancedMesh(
      rockGeometry(),
      new THREE.MeshStandardMaterial({ color: 0x7d7064, roughness: 0.94, metalness: 0.08, flatShading: true }),
      MAX_ASTEROIDS
    );
    this.cometMesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.22, 1),
      new THREE.MeshStandardMaterial({ color: 0xcfe9f5, roughness: 0.55, metalness: 0.05, emissive: 0x2d556b, emissiveIntensity: 1.1 }),
      MAX_COMETS
    );
    for (const mesh of [this.asteroidMesh, this.cometMesh]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.visible = false;
      scene.add(mesh);
    }

    const mkPoints = (count: number, map: THREE.Texture, color: number, size: number, opacity: number) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
      const points = new THREE.Points(geo, new THREE.PointsMaterial({
        map, color, size, transparent: true, opacity,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
      points.frustumCulled = false;
      points.visible = false;
      scene.add(points);
      return points;
    };

    this.cometGlow = mkPoints(MAX_COMETS, glowBlue, 0xbfe6ff, 1.5, 0.9);
    this.tails = mkPoints(MAX_COMETS * TAIL_PER_COMET, glowBlue, 0x9fd4ff, 0.78, 0.5);
    this.shots = mkPoints(MAX_SHOTS, glowGold, 0xffd9a0, 0.42, 1);
    this.cometGlowPositions = this.cometGlow.geometry.getAttribute("position").array as Float32Array;
    this.tailPositions = this.tails.geometry.getAttribute("position").array as Float32Array;
    this.shotPos = this.shots.geometry.getAttribute("position").array as Float32Array;
    this.shotVel = new Float32Array(MAX_SHOTS * 3);
    this.shotLife = new Float32Array(MAX_SHOTS);

    const blank = (kind: HazardKind): Hazard => ({
      active: false, kind, pos: new THREE.Vector3(), vel: new THREE.Vector3(),
      spin: new THREE.Vector3(), rot: new THREE.Euler(), radius: 0.3, hp: 1,
      life: 0, closest: Infinity, wasNear: false, counted: false,
    });
    for (let i = 0; i < MAX_ASTEROIDS; i++) this.asteroids.push(blank("asteroid"));
    for (let i = 0; i < MAX_COMETS; i++) this.comets.push(blank("comet"));
  }

  /** Later levels send more traffic, and more of it icy and fast. */
  setLevel(level: number) {
    this.intensity = 0.55 + level * 0.3;
  }

  setEnabled(value: boolean) {
    this.enabled = value;
    this.asteroidMesh.visible = value;
    this.cometMesh.visible = value;
    this.cometGlow.visible = value;
    this.tails.visible = value;
    this.shots.visible = value;
    if (!value) this.reset();
  }

  reset() {
    for (const h of this.asteroids) h.active = false;
    for (const h of this.comets) h.active = false;
    this.shotLife.fill(0);
    this.asteroidMesh.count = 0;
    this.cometMesh.count = 0;
    this.spawnTimer = 2;
    this.flushPoints();
  }

  private flushPoints() {
    this.cometGlowPositions.fill(9999);
    this.tailPositions.fill(9999);
    this.shotPos.fill(9999);
    this.cometGlow.geometry.getAttribute("position").needsUpdate = true;
    this.tails.geometry.getAttribute("position").needsUpdate = true;
    this.shots.geometry.getAttribute("position").needsUpdate = true;
  }

  /** Launch a kinetic slug. Recoil is applied by the caller (Newton's third law). */
  fire(origin: THREE.Vector3, direction: THREE.Vector3) {
    for (let i = 0; i < MAX_SHOTS; i++) {
      if (this.shotLife[i] > 0) continue;
      const i3 = i * 3;
      this.shotPos[i3] = origin.x;
      this.shotPos[i3 + 1] = origin.y;
      this.shotPos[i3 + 2] = origin.z;
      this.shotVel[i3] = direction.x * 15;
      this.shotVel[i3 + 1] = direction.y * 15;
      this.shotVel[i3 + 2] = direction.z * 15;
      this.shotLife[i] = 2.1;
      return true;
    }
    return false;
  }

  private spawn(kind: HazardKind, shipPos: THREE.Vector3, shipVel: THREE.Vector3) {
    const pool = kind === "asteroid" ? this.asteroids : this.comets;
    const h = pool.find((item) => !item.active);
    if (!h) return;

    // Appear off in the dark, then sweep through the pilot's neighbourhood.
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.clamp(Math.random() * 1.4 - 0.7, -1, 1));
    const dist = 17 + Math.random() * 7;
    h.pos.set(Math.sin(phi) * Math.cos(theta), Math.cos(phi) * 0.45, Math.sin(phi) * Math.sin(theta))
      .multiplyScalar(dist).add(shipPos);

    // Aim near, but rarely exactly at, where the ship is heading.
    _a.copy(shipPos).addScaledVector(shipVel, 1.1 + Math.random() * 1.4);
    _a.x += (Math.random() - 0.5) * 7;
    _a.y += (Math.random() - 0.5) * 4;
    _a.z += (Math.random() - 0.5) * 7;
    const speed = kind === "comet" ? 3.4 + Math.random() * 2.2 : 1.3 + Math.random() * 1.5;
    h.vel.copy(_a).sub(h.pos).normalize().multiplyScalar(speed);

    h.active = true;
    h.radius = kind === "comet" ? 0.3 : 0.34 + Math.random() * 0.5;
    h.hp = kind === "comet" ? 1 : h.radius > 0.62 ? 3 : 2;
    h.life = kind === "comet" ? 26 : 38;
    h.closest = Infinity;
    h.wasNear = false;
    h.counted = false;
    h.spin.set((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6);
    h.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
  }

  update(dt: number, shipPos: THREE.Vector3, shipVel: THREE.Vector3, gm: number, out: HazardEvent[]) {
    if (!this.enabled) return;

    this.spawnTimer -= dt * this.intensity;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1.6 + Math.random() * 2.4;
      this.spawn(Math.random() < 0.3 ? "comet" : "asteroid", shipPos, shipVel);
    }

    // --- projectiles ---
    for (let i = 0; i < MAX_SHOTS; i++) {
      if (this.shotLife[i] <= 0) continue;
      const i3 = i * 3;
      this.shotLife[i] -= dt;
      if (this.shotLife[i] <= 0) {
        this.shotPos[i3] = this.shotPos[i3 + 1] = this.shotPos[i3 + 2] = 9999;
        continue;
      }
      this.shotPos[i3] += this.shotVel[i3] * dt;
      this.shotPos[i3 + 1] += this.shotVel[i3 + 1] * dt;
      this.shotPos[i3 + 2] += this.shotVel[i3 + 2] * dt;
    }

    let asteroidCount = 0;
    let cometCount = 0;
    let cometGlowIndex = 0;
    let tailIndex = 0;

    const step = (pool: Hazard[], isComet: boolean) => {
      for (const h of pool) {
        if (!h.active) continue;

        h.life -= dt;
        // Gravity bends debris paths too, which is why they curve past you.
        const r = h.pos.length();
        if (r > 0.5) h.vel.addScaledVector(_a.copy(h.pos).multiplyScalar(-gm / (r * r * r)), dt);
        h.pos.addScaledVector(h.vel, dt);
        h.rot.x += h.spin.x * dt;
        h.rot.y += h.spin.y * dt;
        h.rot.z += h.spin.z * dt;

        const toShip = _b.copy(h.pos).sub(shipPos);
        const d = toShip.length();
        h.closest = Math.min(h.closest, d);

        // Collision with the Ranger.
        if (d < h.radius + 0.42) {
          h.active = false;
          out.push({
            type: "hit", kind: h.kind, position: h.pos.clone(),
            points: 0, damage: isComet ? 16 : 11 + h.radius * 14,
          });
          continue;
        }

        // A close pass that never connects counts as a dodge.
        if (d < 2.6) h.wasNear = true;
        if (h.wasNear && !h.counted && d > 3.4) {
          h.counted = true;
          out.push({ type: "dodged", kind: h.kind, position: h.pos.clone(), points: isComet ? 60 : 35, damage: 0 });
        }

        // Shot collisions.
        for (let i = 0; i < MAX_SHOTS; i++) {
          if (this.shotLife[i] <= 0) continue;
          const i3 = i * 3;
          const dx = this.shotPos[i3] - h.pos.x;
          const dy = this.shotPos[i3 + 1] - h.pos.y;
          const dz = this.shotPos[i3 + 2] - h.pos.z;
          if (dx * dx + dy * dy + dz * dz > (h.radius + 0.32) ** 2) continue;
          this.shotLife[i] = 0;
          this.shotPos[i3] = this.shotPos[i3 + 1] = this.shotPos[i3 + 2] = 9999;
          h.hp -= 1;
          if (h.hp <= 0) {
            h.active = false;
            out.push({
              type: "destroyed", kind: h.kind, position: h.pos.clone(),
              points: isComet ? 120 : 70 + Math.round(h.radius * 60), damage: 0,
            });
          }
          break;
        }
        if (!h.active) continue;

        // Retire anything lost to the hole, or far behind us.
        if (h.life <= 0 || r < 1.15 || d > 46) {
          h.active = false;
          continue;
        }

        _q.setFromEuler(h.rot);
        _s.setScalar(h.radius / 0.3);
        _m.compose(h.pos, _q, _s);
        if (isComet) {
          this.cometMesh.setMatrixAt(cometCount++, _m);
          this.cometGlowPositions[cometGlowIndex * 3] = h.pos.x;
          this.cometGlowPositions[cometGlowIndex * 3 + 1] = h.pos.y;
          this.cometGlowPositions[cometGlowIndex * 3 + 2] = h.pos.z;
          cometGlowIndex++;
          // Tail points away from the bright accretion disk at the origin.
          _a.copy(h.pos).normalize();
          for (let t = 0; t < TAIL_PER_COMET; t++) {
            const k = tailIndex * 3;
            const spread = 0.12 * t;
            this.tailPositions[k] = h.pos.x + _a.x * (0.4 + t * 0.42) + Math.sin(t * 2.1 + h.rot.x) * spread;
            this.tailPositions[k + 1] = h.pos.y + _a.y * (0.4 + t * 0.42) + Math.cos(t * 1.7 + h.rot.y) * spread;
            this.tailPositions[k + 2] = h.pos.z + _a.z * (0.4 + t * 0.42) + Math.sin(t * 1.3 + h.rot.z) * spread;
            tailIndex++;
          }
        } else {
          this.asteroidMesh.setMatrixAt(asteroidCount++, _m);
        }
      }
    };

    step(this.asteroids, false);
    step(this.comets, true);

    for (let i = cometGlowIndex; i < MAX_COMETS; i++) {
      this.cometGlowPositions[i * 3] = this.cometGlowPositions[i * 3 + 1] = this.cometGlowPositions[i * 3 + 2] = 9999;
    }
    for (let i = tailIndex; i < MAX_COMETS * TAIL_PER_COMET; i++) {
      this.tailPositions[i * 3] = this.tailPositions[i * 3 + 1] = this.tailPositions[i * 3 + 2] = 9999;
    }

    this.asteroidMesh.count = asteroidCount;
    this.cometMesh.count = cometCount;
    this.asteroidMesh.instanceMatrix.needsUpdate = true;
    this.cometMesh.instanceMatrix.needsUpdate = true;
    this.cometGlow.geometry.getAttribute("position").needsUpdate = true;
    this.tails.geometry.getAttribute("position").needsUpdate = true;
    this.shots.geometry.getAttribute("position").needsUpdate = true;
  }

  /** Closest inbound hazard, for the HUD threat readout. */
  threat(shipPos: THREE.Vector3): { distance: number; kind: HazardKind } {
    let distance = Infinity;
    let kind = "asteroid" as HazardKind;
    const scan = (pool: Hazard[]) => {
      for (const h of pool) {
        if (!h.active) continue;
        const d = h.pos.distanceTo(shipPos);
        if (d < distance) { distance = d; kind = h.kind; }
      }
    };
    scan(this.asteroids);
    scan(this.comets);
    return { distance, kind };
  }

  dispose() {
    for (const object of [this.asteroidMesh, this.cometMesh, this.cometGlow, this.tails, this.shots]) {
      this.scene.remove(object);
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
    }
  }
}
