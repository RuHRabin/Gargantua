/**
 * Tilt steering: turn the phone itself into the stick.
 *
 * The phone's gravity direction is read from the browser's deviceorientation event and expressed in
 * the screen's own frame, so it behaves the same held upright, laid back, or turned sideways:
 *   lean the right edge down  -> steer right   (also what turning the phone like a steering wheel does)
 *   lean the left edge down   -> steer left
 *   tip the top edge away     -> nose down
 *   tip the top edge toward you -> nose up
 * Angles are measured from a neutral pose captured by recenter(), so any comfortable grip works.
 *
 * Output (x, y) is in the same -1..1 range as the mouse position the engine already steers with.
 */

export type TiltStatus = "on" | "off" | "denied" | "unsupported";
export type TiltSensitivity = 1 | 2 | 3;

/** Tilt (in degrees) that gives full deflection, per sensitivity step: gentle, balanced, responsive. */
const FULL_DEFLECTION_DEG: Record<TiltSensitivity, number> = { 1: 34, 2: 25, 3: 17 };
const DEAD_DEG = 1.8;
const RAD = Math.PI / 180;

type PermissionedOrientationEvent = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };

function screenAngle(): number {
  const modern = typeof screen !== "undefined" ? screen.orientation?.angle : undefined;
  if (typeof modern === "number") return modern;
  const legacy = (window as unknown as { orientation?: number }).orientation;
  return typeof legacy === "number" ? legacy : 0;
}

export class TiltController {
  /** Smoothed steering output, -1..1. x: right is positive. y: positive pushes the nose down. */
  x = 0;
  y = 0;
  active = false;
  sensitivity: TiltSensitivity = 2;
  invertY = false;

  private pitch = 0; // radians, top edge away from you is positive
  private roll = 0;  // radians, right edge down is positive
  private hasSample = false;
  private baseline: { pitch: number; roll: number } | null = null;
  private wantsBaseline = false;
  private listening = false;

  static supported(): boolean {
    return typeof window !== "undefined" && "DeviceOrientationEvent" in window && window.isSecureContext !== false;
  }

  /** iOS 13+ only delivers motion data after an explicit, user-triggered permission prompt. */
  static needsPermission(): boolean {
    return TiltController.supported()
      && typeof (window.DeviceOrientationEvent as PermissionedOrientationEvent).requestPermission === "function";
  }

  /**
   * Begin listening. Call straight from a tap or click: on iOS the permission prompt only appears
   * from a user gesture, so nothing may be awaited before it.
   */
  async start(): Promise<TiltStatus> {
    if (!TiltController.supported()) return "unsupported";
    if (this.active) return "on";
    const request = (window.DeviceOrientationEvent as PermissionedOrientationEvent).requestPermission;
    if (typeof request === "function") {
      try {
        if ((await request.call(window.DeviceOrientationEvent)) !== "granted") return "denied";
      } catch { return "denied"; }
    }
    this.listen();
    // Desktop browsers expose the API but never report real angles: give a real sensor a moment, then give up.
    const gotData = await new Promise<boolean>((resolve) => {
      const started = performance.now();
      const poll = () => {
        if (this.hasSample) resolve(true);
        else if (performance.now() - started > 1500) resolve(false);
        else setTimeout(poll, 50);
      };
      poll();
    });
    if (!gotData) { this.unlisten(); return "unsupported"; }
    this.active = true;
    this.recenter();
    return "on";
  }

  stop() {
    this.active = false;
    this.unlisten();
    this.x = 0;
    this.y = 0;
    this.baseline = null;
  }

  /** Treat however the phone is held right now as "straight ahead". */
  recenter() {
    this.wantsBaseline = true;
    if (this.hasSample) this.captureBaseline();
  }

  /** Ease the output toward the current tilt. Call once per frame while flying. */
  update(dt: number) {
    if (!this.active || !this.baseline) { this.x = 0; this.y = 0; return; }
    const full = FULL_DEFLECTION_DEG[this.sensitivity] * RAD;
    const dead = DEAD_DEG * RAD;
    const shape = (angle: number) => {
      const magnitude = Math.abs(angle);
      if (magnitude <= dead) return 0;
      const scaled = Math.min(1, (magnitude - dead) / (full - dead));
      return Math.sign(angle) * Math.pow(scaled, 1.3); // gentle near the middle for fine aim, full authority at the edge
    };
    const targetX = shape(this.roll - this.baseline.roll);
    const targetY = shape(this.pitch - this.baseline.pitch) * (this.invertY ? -1 : 1);
    const ease = 1 - Math.exp(-Math.max(0, dt) * 14);
    this.x += (targetX - this.x) * ease;
    this.y += (targetY - this.y) * ease;
  }

  private captureBaseline() {
    this.baseline = { pitch: this.pitch, roll: this.roll };
    this.wantsBaseline = false;
  }

  private listen() {
    if (this.listening) return;
    this.listening = true;
    window.addEventListener("deviceorientation", this.onOrientation);
    // A rotated screen changes which phone edge counts as "right", so pick a new neutral pose.
    window.addEventListener("orientationchange", this.onScreenRotated);
    screen.orientation?.addEventListener?.("change", this.onScreenRotated);
  }

  private unlisten() {
    if (!this.listening) return;
    this.listening = false;
    this.hasSample = false;
    window.removeEventListener("deviceorientation", this.onOrientation);
    window.removeEventListener("orientationchange", this.onScreenRotated);
    screen.orientation?.removeEventListener?.("change", this.onScreenRotated);
  }

  private onScreenRotated = () => { this.recenter(); };

  private onOrientation = (event: DeviceOrientationEvent) => {
    if (event.beta == null || event.gamma == null) return;
    const beta = event.beta * RAD;
    const gamma = event.gamma * RAD;
    // Which way is "up", written in the phone's own axes. Unlike beta and gamma on their own,
    // this stays well behaved when the phone is held upright.
    const ux = -Math.cos(beta) * Math.sin(gamma);
    const uy = Math.sin(beta);
    const uz = Math.cos(beta) * Math.cos(gamma);
    // Rotate into the screen's axes (x right, y up) for portrait or either landscape.
    const a = screenAngle() * RAD;
    const sx = ux * Math.cos(a) - uy * Math.sin(a);
    const sy = ux * Math.sin(a) + uy * Math.cos(a);
    this.pitch = Math.atan2(uz, sy);
    this.roll = Math.asin(Math.max(-1, Math.min(1, -sx)));
    this.hasSample = true;
    if (this.wantsBaseline) this.captureBaseline();
  };
}
