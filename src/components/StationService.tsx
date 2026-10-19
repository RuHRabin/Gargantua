import { useState, type RefObject } from "react";
import type { Engine, HudState, StationServiceReport } from "../game/Engine";
import { Dialog } from "./Dialog";
import "./station.css";

const round = (value: number) => Math.max(0, Math.round(value));

function Gauge({ label, value, tint }: { label: string; value: number; tint: string }) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className="station-gauge">
      <div><span>{label}</span><strong>{round(safe)}%</strong></div>
      <div className="station-gauge__track"><i style={{ width: `${safe}%`, background: tint }} /></div>
    </div>
  );
}

/** A real station-service transaction. Docking alone no longer silently refills anything. */
export function StationService({ engine, hud, onClose }: {
  engine: RefObject<Engine | null>;
  hud: HudState;
  onClose: () => void;
}) {
  const [report, setReport] = useState<StationServiceReport | null>(null);
  const [notice, setNotice] = useState("");
  const deficits = (100 - hud.propellant) + (100 - hud.charge) + (100 - hud.water) + (100 - hud.hull);
  const canService = hud.docking && (deficits > 1 || hud.cargo > 0);

  const runService = () => {
    const result = engine.current?.serviceAtEndurance() ?? null;
    if (result) { setReport(result); setNotice(""); }
    else setNotice("All systems are already topped up.");
  };

  return (
    <Dialog title="Endurance" eyebrow="Station services / Docking bay 04" onClose={onClose} wide>
      <div className="station-panel">
        <div className="station-diorama" aria-hidden="true">
          <div className="station-diorama__orbit" />
          <div className="station-diorama__orbit second" />
          <div className="station-diorama__ring"><i /><i /><i /><i /><i /><i /><i /><i /></div>
          <div className="station-diorama__hub"><span>ENDURANCE</span><small>DEEP SPACE DEPOT</small></div>
          <div className="station-diorama__light" />
          <p>GARGANTUA SYSTEM / ORBITAL WAYSTATION</p>
        </div>

        <section className="station-manifest">
          <div className={`station-lock ${hud.docking ? "docked" : "approach"}`}>
            <span className="station-lock__light" />
            <span>{hud.docking ? "Hard dock confirmed" : "Approach Endurance to dock"}</span>
            {hud.docking && <small>RANGER / PORT 04</small>}
          </div>

          {report ? (
            <div className="station-receipt" role="status">
              <p className="micro-label">Service manifest / complete</p>
              <h3>Ship restored.</h3>
              <ul>
                {report.uploaded > 0 && <li><span>Research data relayed</span><strong>{round(report.uploaded)} units</strong></li>}
                {report.propellant > 0 && <li><span>Propellant transferred</span><strong>+{round(report.propellant)}%</strong></li>}
                {report.charge > 0 && <li><span>Battery charged</span><strong>+{round(report.charge)}%</strong></li>}
                {report.water > 0 && <li><span>Water tanks replenished</span><strong>+{round(report.water)}%</strong></li>}
                {report.hull > 0 && <li><span>Hull repaired</span><strong>+{round(report.hull)}%</strong></li>}
              </ul>
                            <button className="primary-button station-button" onClick={onClose}>Undock / resume flight<span aria-hidden="true">/</span></button>
            </div>
          ) : (
            <>
              <div className="station-current">
                <div className="station-section-heading"><p className="micro-label">Ranger / Current systems</p><span>{hud.campaign.points.toLocaleString()} pts</span></div>
                <Gauge label="Chemical propellant" value={hud.propellant} tint="#d8ac74" />
                <Gauge label="Battery / photovoltaic charge" value={hud.charge} tint="#9fc9dc" />
                <Gauge label="Water / electrolyzer feedstock" value={hud.water} tint="#82bdba" />
                <Gauge label="Hull integrity" value={hud.hull} tint="#cc957d" />
                <div className="station-cargo"><span>Untransmitted science cargo</span><strong>{hud.cargo} <small>units</small></strong></div>
              </div>

              <div className="station-credit-box">
                <span className="micro-label">Endurance depot</span>
                <strong>Open <small>/ unlimited service</small></strong>
                <p>While docked, Endurance tops up your tanks automatically. Press the button for an instant full service and repair.</p>
              </div>

              {notice && <p className="station-notice" role="alert">{notice}</p>}
              <button className="primary-button station-button" disabled={!canService} onClick={runService}>
                {!hud.docking ? "Dock with Endurance first" : deficits <= 1 && !hud.cargo ? "Systems already full" : "Full service / refuel & repair"}
                <span aria-hidden="true">/</span>
              </button>
              <p className="station-science-note">Endurance runs on large solar arrays and stored water. It splits that water into hydrogen and oxygen propellant, the same process your own refinery uses.</p>
            </>
          )}
        </section>
      </div>
    </Dialog>
  );
}