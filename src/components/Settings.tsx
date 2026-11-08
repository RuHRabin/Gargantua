import type { QualityMode } from "../game/Engine";
import { TiltController, type TiltSensitivity } from "../game/tilt";
import { Dialog } from "./Dialog";

const CONTROLS: [string, string][] = [
  ["Mouse / arrows", "Steer the Ranger"],
  ["W / Space / click", "Thrust"],
  ["Shift + thrust", "Overdrive"],
  ["S", "Brake with a retro burn"],
  ["A / D", "Roll"],
  ["X / right click", "Fire the mass driver"],
  ["V", "Cycle drive: chemical / ion / solar sail"],
  ["R", "Unfold solar arrays / collect charge"],
  ["G", "Auto-refinery: surplus charge becomes propellant"],
  ["Hold C", "Process water into propellant (electrolysis)"],
  ["Hold F", "Magnetic scoop (fictional collector)"],
  ["B", "Science scan"],
  ["T", "Next navigation target"],
  ["N", "Autopilot on / off"],
  ["J / Esc", "Field guide / pause"],
];

export interface TiltSettings {
  enabled: boolean; sensitivity: TiltSensitivity; invert: boolean;
  onToggle: (on: boolean) => void; onSensitivity: (value: TiltSensitivity) => void; onInvert: (value: boolean) => void;
}

const TILT_STEPS: [TiltSensitivity, string, string][] = [[1, "Gentle", "Wide, relaxed sweep"], [2, "Balanced", "A good starting point"], [3, "Responsive", "Small, quick tilts"]];

export function Settings({ quality, setQuality, humor, setHumor, onClose, playing, tilt }: {
  quality: QualityMode; setQuality: (value: QualityMode) => void; humor: number; setHumor: (value: number) => void;
  onClose: () => void; playing: boolean; tilt?: TiltSettings;
}) {
  // Offered on touch devices that expose motion sensors (desktop browsers report the API but never any data).
  const canTilt = Boolean(tilt) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 0 && TiltController.supported();
  return <Dialog title={playing ? "Take a breath" : "Flight preferences"} eyebrow={playing ? "Simulation paused / Clocks stopped" : "Gargantua / Make yourself at home"} onClose={onClose}>
    <div className="settings-content">
      <section><h3>Rendering quality</h3><p>Keep the journey smooth. Text and controls stay crisp in every mode.</p><div className="quality-options" role="group" aria-label="Rendering quality">{(["auto", "eco", "cinematic"] as QualityMode[]).map((mode) => <button key={mode} aria-pressed={quality === mode} className={quality === mode ? "selected" : ""} onClick={() => setQuality(mode)}><strong>{mode === "auto" ? "Adaptive" : mode === "eco" ? "Eco" : "Cinematic"}</strong><small>{mode === "auto" ? "Adjusts to your device" : mode === "eco" ? "Lower GPU workload" : "Higher detail, more GPU"}</small></button>)}</div></section>
      {canTilt && tilt && <section className="tilt-section"><h3>Tilt to steer</h3><p>Steer by moving the phone itself. Lean the right edge down to turn right (like turning a steering wheel), and tip the top edge away to dive. It works upright or sideways. Use Recenter in flight whenever you change your grip.</p>
        <div className="quality-options two" role="group" aria-label="Tilt steering">{[false, true].map((on) => <button key={String(on)} aria-pressed={tilt.enabled === on} className={tilt.enabled === on ? "selected" : ""} onClick={() => { if (tilt.enabled !== on) tilt.onToggle(on); }}><strong>{on ? "On" : "Off"}</strong><small>{on ? "Steer with the phone" : "Drag the sky to steer"}</small></button>)}</div>
        {tilt.enabled && <>
          <div className="quality-options" role="group" aria-label="Tilt sensitivity">{TILT_STEPS.map(([value, name, note]) => <button key={value} aria-pressed={tilt.sensitivity === value} className={tilt.sensitivity === value ? "selected" : ""} onClick={() => tilt.onSensitivity(value)}><strong>{name}</strong><small>{note}</small></button>)}</div>
          <div className="quality-options two" role="group" aria-label="Up and down direction">{[false, true].map((inverted) => <button key={String(inverted)} aria-pressed={tilt.invert === inverted} className={tilt.invert === inverted ? "selected" : ""} onClick={() => tilt.onInvert(inverted)}><strong>{inverted ? "Inverted" : "Standard"}</strong><small>{inverted ? "Top away climbs" : "Top away dives"}</small></button>)}</div>
        </>}
      </section>}
      <section className="humor-section"><label htmlFor="humor"><span>TARS humor</span><strong>{humor}%</strong></label><input id="humor" type="range" min="0" max="100" step="5" value={humor} onChange={(event) => setHumor(Number(event.target.value))} /><p>{humor >= 90 ? "Almost too honest for company." : humor >= 55 ? "A little wit for a very long flight." : "Strictly business. Still knows the physics."}</p></section>
      <section><h3>Your flight controls</h3><div className="controls-list">{CONTROLS.map(([key, value]) => <div key={key}><kbd>{key}</kbd><span>{value}</span></div>)}</div></section>
      <p className="settings-science-note">Distances, spacecraft performance and the deadline are scaled for play. The guide explains where real physics ends and fiction begins.</p>
      <button className="primary-button" onClick={onClose}>{playing ? "Resume flight" : "Return to the horizon"}<span aria-hidden="true">/</span></button>
    </div>
  </Dialog>;
}
