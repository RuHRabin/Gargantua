import type { QualityMode } from "../game/Engine";
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

export function Settings({ quality, setQuality, humor, setHumor, onClose, playing }: {
  quality: QualityMode; setQuality: (value: QualityMode) => void; humor: number; setHumor: (value: number) => void;
  onClose: () => void; playing: boolean;
}) {
  return <Dialog title={playing ? "Take a breath" : "Flight preferences"} eyebrow={playing ? "Simulation paused / Clocks stopped" : "Gargantua / Make yourself at home"} onClose={onClose}>
    <div className="settings-content">
      <section><h3>Rendering quality</h3><p>Keep the journey smooth. Text and controls stay crisp in every mode.</p><div className="quality-options" role="group" aria-label="Rendering quality">{(["auto", "eco", "cinematic"] as QualityMode[]).map((mode) => <button key={mode} aria-pressed={quality === mode} className={quality === mode ? "selected" : ""} onClick={() => setQuality(mode)}><strong>{mode === "auto" ? "Adaptive" : mode === "eco" ? "Eco" : "Cinematic"}</strong><small>{mode === "auto" ? "Adjusts to your device" : mode === "eco" ? "Lower GPU workload" : "Higher detail, more GPU"}</small></button>)}</div></section>
      <section className="humor-section"><label htmlFor="humor"><span>TARS humor</span><strong>{humor}%</strong></label><input id="humor" type="range" min="0" max="100" step="5" value={humor} onChange={(event) => setHumor(Number(event.target.value))} /><p>{humor >= 90 ? "Almost too honest for company." : humor >= 55 ? "A little wit for a very long flight." : "Strictly business. Still knows the physics."}</p></section>
      <section><h3>Your flight controls</h3><div className="controls-list">{CONTROLS.map(([key, value]) => <div key={key}><kbd>{key}</kbd><span>{value}</span></div>)}</div></section>
      <p className="settings-science-note">Distances, spacecraft performance and the deadline are scaled for play. The guide explains where real physics ends and fiction begins.</p>
      <button className="primary-button" onClick={onClose}>{playing ? "Resume flight" : "Return to the horizon"}<span aria-hidden="true">/</span></button>
    </div>
  </Dialog>;
}
