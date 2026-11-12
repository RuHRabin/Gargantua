import { memo } from "react";

export function OrbitMark({ size = 34 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true"><circle cx="20" cy="20" r="7" stroke="currentColor" strokeWidth="1.2" /><ellipse cx="20" cy="20" rx="18" ry="8" transform="rotate(-35 20 20)" stroke="currentColor" strokeWidth=".8" /><circle cx="30" cy="10" r="1.5" fill="currentColor" /></svg>;
}

export const Intro = memo(function Intro({ onBegin, onGuide, ready, error, level }: {
  onBegin: () => void; onGuide: () => void; ready: boolean; error: string | null; level: number;
}) {
  return <main className="intro-composition">
    <div className="intro-center">
      <p className="hero-eyebrow reveal" style={{ animationDelay: ".2s" }}><span />An interactive science expedition<span /></p>
      <h1 className="hero-title">Gargantua</h1>
      <p className="hero-description reveal" style={{ animationDelay: ".65s" }}>Explore the unknown.<br />Understand the universe.</p>
      <div className="hero-actions reveal" style={{ animationDelay: ".95s" }}>
        <button className="primary-button hero-launch" disabled={!ready || !!error} onClick={onBegin}>
          {error ? "Flight systems unavailable" : !ready ? "Initializing instruments" : level > 1 ? "Continue expedition" : "Begin expedition"}
          {!ready && !error ? <span className="loading-orbit" /> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>}
        </button>
        <button className="text-button" onClick={onGuide}>Explore the field guide<span aria-hidden="true">+</span></button>
      </div>
      {error && <p className="render-error" role="status">{error} The complete field guide is still available.</p>}
      <ul className="intro-facts reveal" style={{ animationDelay: "1.15s" }}>
        <li><strong>01</strong><span>Fly three ways</span><em>Chemical burns, an ion drive that sips, and a solar sail that needs no fuel at all.</em></li>
        <li><strong>02</strong><span>Live on light</span><em>Arrays charge the battery. Surplus charge splits comet water into propellant.</em></li>
        <li><strong>03</strong><span>Learn as you go</span><em>Eight chapters, a space station, a star chart to fill and live NASA data.</em></li>
      </ul>
    </div>
    <footer className="intro-footer reveal" style={{ animationDelay: "1.3s" }}><span>Inspired by Interstellar. Driven by curiosity.</span><span className="footer-center">Fictional destinations. Real ideas.</span><span className="headphone-note"><svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor"><path d="M3 12V9a7 7 0 0 1 14 0v3" /><rect x="2" y="10" width="3" height="7" rx="1" /><rect x="15" y="10" width="3" height="7" rx="1" /></svg>Headphones recommended</span></footer>
  </main>;
});