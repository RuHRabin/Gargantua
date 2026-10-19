import { useEffect, useState } from "react";
import type { LevelResult } from "../game/campaign";

function Star({ lit, delay }: { lit: boolean; delay: number }) {
  return (
    <svg className={`debrief-star ${lit ? "lit" : ""}`} style={{ animationDelay: `${delay}ms` }} width="46" height="46" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.6l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.3 1.3-6.6L2.5 9.5l6.6-.8z" fill={lit ? "currentColor" : "none"} stroke="currentColor" strokeWidth=".9" strokeLinejoin="round" />
    </svg>
  );
}

/** Animated count-up so the score feels earned rather than printed. */
function useCountUp(target: number, delay: number, duration = 1100) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame = 0;
    let start = 0;
    const timer = setTimeout(() => {
      const step = (now: number) => {
        if (!start) start = now;
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setValue(Math.round(target * eased));
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(timer); cancelAnimationFrame(frame); };
  }, [target, delay, duration]);
  return value;
}

export function LevelDebrief({ result, campaignComplete, bestStars, onContinue, onReplay, onGuide }: {
  result: LevelResult; campaignComplete: boolean; bestStars: number;
  onContinue: () => void; onReplay: () => void; onGuide: () => void;
}) {
  const levelScore = useCountUp(result.levelPoints, 900);
  const total = useCountUp(result.totalPoints, 1500, 1400);
  const minutes = Math.floor(result.seconds / 60);
  const seconds = Math.round(result.seconds % 60);
  const newBest = result.stars > bestStars;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Enter" || event.code === "Space") { event.preventDefault(); onContinue(); }
    };
    const timer = setTimeout(() => window.addEventListener("keydown", onKey), 1800);
    return () => { clearTimeout(timer); window.removeEventListener("keydown", onKey); };
  }, [onContinue]);

  return (
    <div className="debrief-backdrop" role="dialog" aria-modal="true" aria-labelledby="debrief-title">
      <section className="debrief-card">
        <p className="micro-label debrief-eyebrow reveal">Level {String(result.level).padStart(2, "0")} complete{campaignComplete ? " / Expedition finished" : ""}</p>
        <h2 id="debrief-title" className="reveal" style={{ animationDelay: ".1s" }}>{result.title}</h2>

        <div className="debrief-stars" aria-label={`${result.stars} of 3 stars`}>
          {[0, 1, 2].map((i) => <Star key={i} lit={i < result.stars} delay={350 + i * 260} />)}
        </div>
        {newBest && result.stars > 1 && <p className="debrief-best reveal" style={{ animationDelay: "1.2s" }}>New best rating</p>}

        <ul className="debrief-star-notes reveal" style={{ animationDelay: "1.1s" }}>
          {result.starNotes.map((note, i) => <li key={note} className={i < result.stars ? "earned" : ""}><span aria-hidden="true">{i < result.stars ? "●" : "○"}</span>{note}</li>)}
        </ul>

        <div className="debrief-score reveal" style={{ animationDelay: ".8s" }}>
          <div><span className="micro-label">Level score</span><strong>{levelScore.toLocaleString()}</strong></div>
          <div><span className="micro-label">Expedition total</span><strong>{total.toLocaleString()}</strong></div>
        </div>

        <div className="debrief-columns reveal" style={{ animationDelay: "1.3s" }}>
          <ul className="debrief-bonuses">
            {result.bonuses.map((bonus) => <li key={bonus.label}><span>{bonus.label}</span><strong>+{bonus.points.toLocaleString()}</strong></li>)}
          </ul>
          <dl className="debrief-stats">
            <div><dt>Flight time</dt><dd>{minutes}:{String(seconds).padStart(2, "0")}</dd></div>
            <div><dt>Debris cleared</dt><dd>{result.destroyed}</dd></div>
            <div><dt>Close passes</dt><dd>{result.dodged}</dd></div>
            <div><dt>Best streak</dt><dd>x{result.bestStreak}</dd></div>
            <div><dt>Research</dt><dd>{result.collected}</dd></div>
            <div><dt>Hull lost</dt><dd>{Math.round(result.hullLost)}%</dd></div>
          </dl>
        </div>

        <div className="debrief-actions reveal" style={{ animationDelay: "1.7s" }}>
          <button className="primary-button debrief-continue" onClick={onContinue} autoFocus>
            {campaignComplete ? "See the expedition results" : `Fly level ${String(result.level + 1).padStart(2, "0")}: ${result.nextTitle}`}
            <span aria-hidden="true">/</span>
          </button>
          <div className="debrief-secondary">
            <button className="text-button" onClick={onReplay}>Replay for stars</button>
            <button className="text-button" onClick={onGuide}>Read the field notes <span aria-hidden="true">+</span></button>
          </div>
          <p className="debrief-hint">Enter to continue</p>
        </div>
      </section>
    </div>
  );
}
