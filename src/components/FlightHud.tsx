import { memo, useSyncExternalStore, type RefObject } from "react";
import type { Engine } from "../game/Engine";
import type { Telemetry } from "../game/telemetry";
import { MISSIONS } from "../game/campaign";

const gauge = (value: number) => `${Math.max(0, Math.min(100, value))}%`;

function Resource({ label, value, color, hint }: { label: string; value: number; color: string; hint?: string }) {
  return <div className={`resource-line ${value < 15 ? "low" : ""}`}><div><span>{label}</span><strong>{Math.round(value)}<small>%</small></strong></div><div className="resource-track"><span style={{ width: gauge(value), background: value < 15 ? "#ef9169" : color }} /></div>{hint && <p>{hint}</p>}</div>;
}

export const FlightHud = memo(function FlightHud({ telemetry, engine, onMissions, onGuide }: {
  telemetry: Telemetry; engine: RefObject<Engine | null>; onMissions: () => void; onGuide: () => void;
}) {
  const hud = useSyncExternalStore(telemetry.subscribe, telemetry.getSnapshot, telemetry.getSnapshot);
  if (!hud) return null;
  const mission = MISSIONS[hud.campaign.level - 1];
  const stats = hud.campaign.stats;
  const task = mission.tasks.find((item) => stats[item.metric] < item.goal) ?? mission.tasks[mission.tasks.length - 1];
  const taskProgress = Math.min(100, stats[task.metric] / task.goal * 100);
  return (
    <>
      <div className="hazard-vignette" style={{ opacity: Math.max(0, (hud.proximity - 0.7) * 3) }} />
      <aside className="mission-hud flight-instrument">
        <div className="instrument-heading"><span className="micro-label">Level {String(hud.campaign.level).padStart(2, "0")} / {String(MISSIONS.length).padStart(2, "0")}</span><button onClick={onMissions} aria-label="Open mission objectives">+</button></div>
        <h2>{mission.title}</h2>
        <p className="current-task">{task.label}</p>
        <div className="thin-progress"><span style={{ width: `${taskProgress}%` }} /></div>
        <div className="mission-task-progress"><span>{Math.min(task.goal, stats[task.metric]).toFixed(task.unit ? 1 : 0)} / {task.goal}{task.unit ?? ""}</span><span>{hud.campaign.levelPoints.toLocaleString()} <small>lvl</small> · {hud.campaign.points.toLocaleString()} PTS</span></div>
        <div className="level-track" aria-label={`${hud.campaign.completed} missions complete`}>{MISSIONS.map((entry, i) => <span key={entry.id} className={i < hud.campaign.completed ? "done" : i === hud.campaign.level - 1 ? "active" : ""} />)}</div>
      </aside>

      <aside className="clock-hud flight-instrument">
        <p className="micro-label">Gravitational clock ratio</p>
        <div className="clock-ratio">{hud.dilation.toFixed(2)}<small>x</small></div>
        <p className="clock-comparison">1 local hour = {hud.dilation.toFixed(2)} distant hours</p>
        <button className="instrument-learn" onClick={onGuide}>Why do clocks differ? <span>+</span></button>
        <p className="scenario-clock">{Number.isFinite(hud.maxYears) ? "Scenario clock" : "Training orbit"} <strong>{Number.isFinite(hud.maxYears) ? `${hud.earthYears.toFixed(1)} / ${hud.maxYears} yrs` : "No deadline"}</strong></p>
        <small className="model-label">{Number.isFinite(hud.maxYears) ? "Simplified model / accelerated deadline" : "Clock paused until level two"}</small>
      </aside>

      <aside className="resources-hud flight-instrument">
        <p className="micro-label resource-header">Ranger / Systems</p>
        <Resource label="Hull integrity" value={hud.hull} color="#cf8f7a" hint={hud.docking ? "Docked / repairs under way" : "Impacts cost hull and cargo"} />
        <Resource label="Propellant" value={hud.propellant} color="#d8ac74" hint={hud.engineMode === "sail" ? "Sail mode / no propellant used" : hud.engineMode === "ion" ? "Ion drive / sips propellant, drinks charge" : "Chemical engines / heavy use per burn"} />
        <Resource label="Charge" value={hud.charge} color="#9fc9dc" hint={hud.arrays ? `Collecting disk light / +${hud.solarRate.toFixed(1)}% per second` : "Arrays stowed / R to collect light"} />
        <Resource label="Water" value={hud.water} color="#77999e" hint={hud.converting ? "Electrolysis / water + charge -> propellant" : hud.autoRefining ? "Auto-refinery running on surplus charge" : "Comet ice refills water / C or G refines it"} />
        <div className="drive-select" role="group" aria-label="Propulsion mode">
          {(["chemical", "ion", "sail"] as const).map((mode) => <button key={mode} className={hud.engineMode === mode ? "active" : ""} aria-pressed={hud.engineMode === mode} onClick={() => engine.current?.setEngineMode(mode)}>{mode === "chemical" ? "Chemical" : mode === "ion" ? "Ion" : "Sail"}</button>)}
          <kbd>V</kbd>
        </div>
        {hud.sail && <p className="sail-readout">Sail facing <strong>{Math.round(hud.sailEfficiency * 100)}%</strong> of the light / point away from Gargantua for full push</p>}
        <div className="flow-strip" aria-label="Energy and mass flow">
          <span className="micro-label">Energy &amp; mass flow</span>
          <div className="flow-row"><i className={hud.arrays ? "on" : ""}>Light</i><b className={hud.arrays ? "on" : ""} /><i className={hud.arrays ? "on" : ""}>Arrays</i><b className={hud.arrays ? "on" : ""} /><i className={hud.charge > 1 ? "on" : ""}>Charge</i><b className={hud.ionActive || hud.converting || hud.autoRefining ? "on" : ""} /><i className={hud.ionActive ? "on" : ""}>Ion</i></div>
          <div className="flow-row"><i className={hud.water > 1 ? "on" : ""}>Water</i><b className={hud.converting || hud.autoRefining ? "on" : ""} /><i className={hud.converting || hud.autoRefining ? "on" : ""}>Refinery</i><b className={hud.converting || hud.autoRefining ? "on" : ""} /><i className={hud.propellant > 1 ? "on" : ""}>Propellant</i><b className={hud.thrust && !hud.ionActive && hud.engineMode === "chemical" ? "on" : ""} /><i className={hud.thrust && hud.engineMode === "chemical" ? "on" : ""}>Engines</i></div>
          <div className="flow-row"><i className={hud.sail ? "on" : ""}>Light</i><b className={hud.sail && hud.sailEfficiency > 0.05 ? "on" : ""} /><i className={hud.sail ? "on" : ""}>Sail</i><b className={hud.sail && hud.sailEfficiency > 0.05 ? "on" : ""} /><i className={hud.sail && hud.sailEfficiency > 0.05 ? "on" : ""}>Thrust</i><span className="flow-note">no propellant</span></div>
        </div>
        <div className="resource-actions">
          <button className={hud.arrays ? "active" : ""} onClick={() => engine.current?.toggleArrays()}><kbd>R</kbd> Arrays</button>
          <button className={hud.converting ? "active" : ""} title="Electrolysis: water + charge into propellant"
            onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); engine.current?.setTouchConvert(true); }}
            onPointerUp={() => engine.current?.setTouchConvert(false)} onPointerCancel={() => engine.current?.setTouchConvert(false)}
            onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") engine.current?.setTouchConvert(true); }}
            onKeyUp={() => engine.current?.setTouchConvert(false)}><kbd>C</kbd> Electrolyze</button>
          <button className={hud.autoRefine ? "active" : ""} aria-pressed={hud.autoRefine} title="Automatically refine surplus solar charge into propellant" onClick={() => engine.current?.toggleAutoRefine()}><kbd>G</kbd> Auto</button>
        </div>
        <div className="flight-readouts"><span>Speed <strong>{hud.speed.toFixed(2)} <small>sim u/s</small></strong></span><span>Radius <strong>{hud.distance.toFixed(2)} <small>rs</small></strong></span></div>
      </aside>

      <aside className="defense-hud flight-instrument">
        <div className="instrument-heading"><span className="micro-label">Debris watch</span><span className={`threat-chip ${hud.threatDistance < 6 ? "near" : ""}`}>{hud.threatDistance === Infinity ? "Clear" : `${hud.threatKind === "comet" ? "Comet" : "Asteroid"} ${hud.threatDistance.toFixed(1)} rs`}</span></div>
        <div className="defense-counts"><span>Destroyed <strong>{stats.destroyed}</strong></span><span>Avoided <strong>{stats.dodged}</strong></span></div>
        <button className="fire-button" disabled={hud.charge < 2.5}
          onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); engine.current?.setTouchFire(true); }}
          onPointerUp={() => engine.current?.setTouchFire(false)} onPointerCancel={() => engine.current?.setTouchFire(false)}
          onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") engine.current?.setTouchFire(true); }}
          onKeyUp={() => engine.current?.setTouchFire(false)}>
          <span className="fire-charge" style={{ transform: `scaleX(${hud.weaponReady})` }} />
          <span className="fire-label"><kbd>X</kbd> Mass driver</span>
        </button>
        <p className="defense-note">Right click or X. Each slug spends charge and nudges the ship backward.</p>
      </aside>

      <aside className="navigation-hud flight-instrument">
        <div className="instrument-heading"><span className="micro-label">Navigation / Destination</span><span className="target-distance">{hud.targetDistance.toFixed(1)} rs</span></div>
        <label className="target-select"><span className="sr-only">Navigation destination</span><select value={hud.target} onChange={(event) => engine.current?.setTarget(["Research signal", "Endurance", "Miller's planet", "Mann's planet", "Edmunds' planet", "Wormhole"].indexOf(event.target.value))}>{["Research signal", "Endurance", "Miller's planet", "Mann's planet", "Edmunds' planet", "Wormhole"].map((target) => <option key={target}>{target}</option>)}</select></label>
        <div className="navigation-actions"><button className={hud.autopilot ? "active" : ""} onClick={() => engine.current?.toggleAutopilot()}><span className={`status-dot ${hud.autopilot ? "on" : ""}`} />{hud.autopilot ? "Autopilot on" : "Engage autopilot"}<kbd>N</kbd></button><button disabled={hud.scanCooldown > 0} onClick={() => engine.current?.scan()}>{hud.scanCooldown > 0 ? `${Math.ceil(hud.scanCooldown)}s` : "Scan"}<kbd>B</kbd></button></div>
        <div className="data-readout"><span>Research data</span><strong>{hud.uploaded}<small> / {hud.goal}</small></strong></div>
        <div className="thin-progress data-progress"><span style={{ width: gauge(hud.uploaded / hud.goal * 100) }} /><i style={{ left: gauge(hud.uploaded / hud.goal * 100), width: gauge(Math.min(100 - hud.uploaded / hud.goal * 100, hud.cargo / hud.goal * 100)) }} /></div>
        <p className="data-note">{hud.sector ? `${hud.sector.label} / ${hud.chartedSectors} of ${hud.totalSectors} charted · ` : ""}{hud.docking ? "Docked / Transmitting and resupplying" : `${hud.cargo} in hold / Dock at Endurance to transmit`}</p>
      </aside>

      <div className="flight-center-status" aria-live="off">
        {hud.proximity > 0.87 ? <span className="horizon-warning">Event horizon proximity</span> : hud.boost ? <span className="boost-status">Main engines / Overdrive</span> : hud.scooping ? <span className="scoop-status">Magnetic scoop active</span> : null}
        {hud.combo > 1 && <span className="combo-status">Signal chain x{hud.combo} / +{(hud.combo - 1) * 25}%</span>}
        {hud.campaign.streak >= 3 && <span className={`streak-status tier-${hud.campaign.streakMultiplier >= 3 ? 3 : hud.campaign.streakMultiplier >= 2 ? 2 : 1}`}>Streak {hud.campaign.streak} / x{hud.campaign.streakMultiplier} points</span>}
      </div>
      <div className="center-reticle" aria-hidden="true"><span /><i /></div>
    </>
  );
});