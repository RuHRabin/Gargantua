import { useMemo } from "react";
import type { SectorLocation } from "../game/exploration";
import { Dialog } from "./Dialog";
import "./chart.css";

const RINGS = ["INNER WELL", "PHOTON ORBIT", "ACCRETION REACH", "OUTER DRIFT", "WORLD LANES", "DEEP FIELD"];
const BEARINGS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** The local nav computer's 48-cell map; cells only fill in when the ship flies there. */
export function ExplorationChart({ charted, current, flightCount, onClose, onPlot }: {
  charted: string[]; current: SectorLocation; flightCount: number; onClose: () => void;
  onPlot: (ring: number, bearing: number) => void;
}) {
  const known = useMemo(() => new Set(charted), [charted]);
  return (
    <Dialog title="Local star chart" eyebrow="Navigation / 48 orbital sectors" onClose={onClose} wide>
      <div className="chart-layout">
        <section className="chart-map">
          <div className="chart-heading">
            <div><p className="micro-label">Survey coverage</p><h3>Map the unknown.</h3></div>
            <div className="chart-coverage"><strong>{charted.length}</strong><span> / 48<br />sectors</span></div>
          </div>
          <div className="chart-compass" aria-hidden="true">{BEARINGS.map((bearing) => <span key={bearing}>{bearing}</span>)}</div>
          <div className="sector-grid" role="grid" aria-label="Six orbital bands by eight bearings">
            {RINGS.map((ringName, ring) => (
              <div className="sector-row" role="row" key={ringName}>
                <span className="sector-ring-label">{ringName}</span>
                <div className="sector-cells">
                  {BEARINGS.map((bearingName, bearing) => {
                    const id = `r${ring}-s${bearing}`;
                    const isCurrent = current.id === id;
                    const isKnown = known.has(id);
                    return <button key={id} role="gridcell"
                      className={`sector-cell ${isKnown ? "charted" : "unknown"} ${isCurrent ? "current" : ""}`}
                      aria-label={`${ringName}, ${bearingName} bearing, ${isKnown ? "charted" : "unexplored"}${isCurrent ? ", current position" : ""}`}
                      aria-current={isCurrent ? "location" : undefined}
                      title={isCurrent ? "Current position" : `Plot an autopilot route to ${ringName.toLowerCase()} / ${bearingName}`}
                      onClick={() => onPlot(ring, bearing)}>
                      {isCurrent ? <span className="sector-vessel" aria-hidden="true">◆</span> : isKnown ? <span className="sector-dot" aria-hidden="true" /> : <span className="sector-question" aria-hidden="true">·</span>}
                    </button>;
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="chart-legend"><span><i className="legend-known" /> Charted</span><span><i className="legend-current" /> Ranger</span><span><i className="legend-unknown" /> Unexplored</span></div>
        </section>
        <aside className="chart-side">
          <p className="micro-label">Current coordinates</p>
          <h4>{current.ringName}</h4>
          <p className="chart-location">{current.bearingName} bearing / {current.id.toUpperCase()}</p>
          <div className="chart-location-rule" />
          <p className="chart-copy">Fly through unexplored sectors to extend the chart and earn expedition points. Select any cell to plot an autopilot course; undiscovered regions stay hidden until you reach them.</p>
          <div className="chart-stat"><span>Mapped in this flight</span><strong>{flightCount}</strong></div>
          <div className="chart-stat"><span>Known on this ship</span><strong>{charted.length}</strong></div>
          <div className="chart-stat"><span>Surveyed region</span><strong>{Math.round(charted.length / 48 * 100)}%</strong></div>
          <div className="chart-route-note"><span className="chart-pulse" /> New discoveries are stored in the Ranger's navigation computer.</div>
          <button className="primary-button chart-return" onClick={onClose}>Back to flight <span aria-hidden="true">/</span></button>
        </aside>
      </div>
    </Dialog>
  );
}