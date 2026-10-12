import { useCallback, useEffect, useRef, useState } from "react";
import { Engine, type EngineEvent, type HudState } from "./game/Engine";
import { TarsMessage } from "./components/Tars";

type Phase = "intro" | "countdown" | "play" | "end";
type Ending = { reason: "tesseract" | "timeout" | "win"; score: number; years: number } | null;

let uid = 0;
const nextId = () => ++uid;

const fmt = (n: number, d = 1) => n.toFixed(d);

function hourHere(dilation: number) {
  const years = 0.12 * Math.pow(dilation, 4);
  if (years < 1) return `${Math.round(years * 365)} EARTH DAYS`;
  return `${years.toFixed(1)} EARTH YEARS`;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const reticleRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);

  const [phase, setPhase] = useState<Phase>("intro");
  const [hud, setHud] = useState<HudState | null>(null);
  const [msg, setMsg] = useState<{ text: string; id: number } | null>(null);
  const [pops, setPops] = useState<{ id: number; text: string; color: string }[]>([]);
  const [ending, setEnding] = useState<Ending>(null);
  const [flash, setFlash] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [count, setCount] = useState(3);
  const [isTouch] = useState(() => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);

  const pushPop = useCallback((text: string, color: string) => {
    const id = nextId();
    setPops((p) => [...p.slice(-4), { id, text, color }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 1600);
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !markerRef.current) return;
    const onEvent = (e: EngineEvent) => {
      switch (e.type) {
        case "message":
          setMsg({ text: e.text, id: nextId() });
          break;
        case "collect":
          pushPop(`+${e.value} QUANTA`, "#ffc27a");
          break;
        case "fuel":
          pushPop("+35 FUEL", "#8fd0ff");
          break;
        case "upload":
          pushPop(`${e.value} UPLOADED`, "#e8e4dc");
          break;
        case "survey":
          pushPop(`${e.name} SURVEYED +${e.value}`, "#9fd0ff");
          break;
        case "pause":
          setPaused(e.paused);
          break;
        case "horizon":
          setFlash(true);
          setTimeout(() => setFlash(false), 1800);
          break;
        case "end":
          setEnding({ reason: e.reason, score: e.score, years: e.years });
          setPhase("end");
          setMsg(null);
          break;
      }
    };
    const engine = new Engine(canvasRef.current, markerRef.current, setHud, onEvent);
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [pushPop]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (reticleRef.current) reticleRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 7000);
    return () => clearTimeout(t);
  }, [msg]);

  const begin = () => {
    engineRef.current?.initAudio();
    setPhase("countdown");
    setCount(3);
    let c = 3;
    const iv = setInterval(() => {
      c--;
      setCount(c);
      if (c <= 0) {
        clearInterval(iv);
        setTimeout(() => {
          setEnding(null);
          setHud(null);
          setPhase("play");
          engineRef.current?.startGame();
        }, 700);
      }
    }, 1000);
  };

  const toOrbit = () => {
    engineRef.current?.toIntro();
    setEnding(null);
    setPhase("intro");
  };

  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    engineRef.current?.setMuted(m);
  };

  const prox = hud?.proximity ?? 0;

  return (
    <div className={`relative w-full h-full select-none ${phase === "play" && !paused ? "cursor-none" : ""}`}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
      <div ref={markerRef} className={`absolute inset-0 pointer-events-none overflow-hidden ${phase === "play" ? "" : "hidden"}`} />
      <div className="grain absolute inset-0 pointer-events-none overflow-hidden" />

      <div className={`absolute inset-x-0 top-0 bg-black pointer-events-none transition-all duration-[2000ms] ${phase === "play" ? "h-0" : "h-[7vh]"}`} />
      <div className={`absolute inset-x-0 bottom-0 bg-black pointer-events-none transition-all duration-[2000ms] ${phase === "play" ? "h-0" : "h-[7vh]"}`} />

      <button
        onClick={toggleMute}
        className="absolute top-[calc(7vh+14px)] right-6 z-30 font-mono text-[10px] tracking-[.3em] text-stone-400 hover:text-amber-200 transition-colors"
        style={phase === "play" ? { top: 14, right: 18 } : undefined}
      >
        {muted ? "SOUND · OFF" : "SOUND · ON"}
      </button>

      {phase === "intro" && <Intro onBegin={begin} />}

      {phase === "countdown" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="font-mono text-[11px] tracking-[.5em] text-stone-400 fade-up">MAIN ENGINE START</p>
          <div key={count} className="fade-up font-display font-thin text-[22vh] leading-none text-stone-100 mt-4">
            {count > 0 ? count : ""}
          </div>
          {count <= 0 && <p className="fade-up title-wide text-xl text-amber-100">IGNITION</p>}
        </div>
      )}

      {phase === "play" && hud && (
        <>
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-700"
            style={{
              opacity: Math.max(0, (prox - 0.6) * 2.5),
              boxShadow: "inset 0 0 220px 40px rgba(255,90,20,.45)",
            }}
          />
          {prox > 0.8 && (
            <div className="absolute top-24 inset-x-0 text-center pointer-events-none">
              <span className="pulse-line font-mono text-[11px] tracking-[.5em] text-orange-300">⚠ EVENT HORIZON PROXIMITY ⚠</span>
            </div>
          )}

          <div className="absolute top-5 left-5 hud-panel px-5 py-4 w-[260px] pointer-events-none">
            <p className="font-mono text-[10px] tracking-[.35em] text-stone-400">EARTH · TIME ELAPSED</p>
            <p className="font-mono text-3xl text-stone-100 mt-1">
              {fmt(hud.earthYears, 2)}
              <span className="text-xs text-stone-400 ml-2">YRS</span>
            </p>
            <div className="mt-2 h-[2px] bg-stone-800">
              <div
                className="h-full transition-all"
                style={{
                  width: `${Math.min(100, (hud.earthYears / hud.maxYears) * 100)}%`,
                  background: hud.earthYears > hud.maxYears * 0.8 ? "#ff7a45" : "#e8e4dc",
                }}
              />
            </div>
            <p className="font-mono text-[10px] text-stone-400 mt-2 tracking-widest">
              MURPH · AGE {Math.floor(10 + hud.earthYears)} · LIMIT {hud.maxYears} YRS
            </p>
          </div>

          <div className="absolute top-12 right-5 hud-panel px-5 py-4 w-[260px] text-right pointer-events-none">
            <p className="font-mono text-[10px] tracking-[.35em] text-stone-400">TIME DILATION</p>
            <p className="font-mono text-3xl mt-1" style={{ color: hud.dilation > 1.6 ? "#ffb070" : "#e8e4dc" }}>
              ×{fmt(Math.pow(hud.dilation, 4), 2)}
            </p>
            <p className="font-mono text-[10px] text-stone-300 mt-2 tracking-widest">1 HOUR HERE =</p>
            <p className="font-mono text-[11px] text-amber-200 tracking-widest">{hourHere(hud.dilation)}</p>
          </div>

          <div className="absolute bottom-5 left-5 hud-panel px-5 py-4 w-[260px] pointer-events-none">
            <div className="flex justify-between font-mono text-[10px] tracking-[.3em] text-stone-400">
              <span>RANGER · FUEL</span>
              <span className={hud.fuel < 20 ? "text-orange-400 pulse-line" : ""}>{Math.round(hud.fuel)}%</span>
            </div>
            <div className="mt-2 flex gap-[3px]">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="h-2 flex-1"
                  style={{ background: i < hud.fuel / 5 ? (hud.fuel < 20 ? "#ff7a45" : "#8fd0ff") : "rgba(255,255,255,.08)" }}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 font-mono">
              <div>
                <p className="text-[9px] tracking-[.3em] text-stone-500">VELOCITY</p>
                <p className="text-sm text-stone-100">{Math.round(hud.speed * 1370)} km/s</p>
              </div>
              <div>
                <p className="text-[9px] tracking-[.3em] text-stone-500">RADIUS</p>
                <p className="text-sm text-stone-100">{fmt(hud.distance, 2)} rs</p>
              </div>
            </div>
          </div>

          <div className="absolute bottom-5 right-5 hud-panel px-5 py-4 w-[260px] text-right pointer-events-none">
            <p className="font-mono text-[10px] tracking-[.35em] text-stone-400">QUANTUM DATA</p>
            <div className="flex justify-end items-baseline gap-3 mt-1 font-mono">
              <span className="text-[10px] text-amber-300 tracking-widest">HOLD {hud.cargo}</span>
              <span className="text-3xl text-stone-100">{hud.uploaded}</span>
              <span className="text-xs text-stone-400">/ {hud.goal}</span>
            </div>
            <div className="mt-2 h-[2px] bg-stone-800 relative">
              <div className="absolute inset-y-0 left-0 bg-stone-100" style={{ width: `${Math.min(100, (hud.uploaded / hud.goal) * 100)}%` }} />
              <div
                className="absolute inset-y-0 bg-amber-400/70"
                style={{
                  left: `${Math.min(100, (hud.uploaded / hud.goal) * 100)}%`,
                  width: `${Math.max(0, Math.min(100 - (hud.uploaded / hud.goal) * 100, (hud.cargo / hud.goal) * 100))}%`,
                }}
              />
            </div>
            <p className="font-mono text-[10px] text-stone-400 mt-2 tracking-widest">
              {hud.docking ? <span className="text-amber-200 pulse-line">DOCKED · UPLOAD · REFUEL</span> : "DOCK AT ENDURANCE TO UPLOAD"}
            </p>
          </div>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-16 h-16 rounded-full border border-stone-300/20" />
            <div className="absolute left-1/2 top-1/2 w-1 h-1 -translate-x-1/2 -translate-y-1/2 bg-stone-200/60 rounded-full" />
          </div>

          <div className="absolute left-1/2 top-[38%] -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none">
            {pops.map((p) => (
              <div key={p.id} className="fade-up font-mono text-sm tracking-[.4em]" style={{ color: p.color, textShadow: `0 0 18px ${p.color}` }}>
                {p.text}
              </div>
            ))}
          </div>

          {isTouch && (
            <button
              className="absolute bottom-40 right-8 w-24 h-24 rounded-full border border-amber-200/50 font-mono text-[10px] tracking-[.3em] text-amber-100 active:bg-amber-200/20 z-20"
              onPointerDown={() => engineRef.current?.setTouchThrust(true)}
              onPointerUp={() => engineRef.current?.setTouchThrust(false)}
              onPointerLeave={() => engineRef.current?.setTouchThrust(false)}
            >
              THRUST
            </button>
          )}
        </>
      )}

      <div ref={reticleRef} className={`absolute left-0 top-0 pointer-events-none ${phase === "play" && !paused ? "" : "hidden"}`}>
        <div className="-translate-x-1/2 -translate-y-1/2 relative w-7 h-7">
          <div className="absolute left-1/2 top-0 h-2 w-px bg-amber-100/80" />
          <div className="absolute left-1/2 bottom-0 h-2 w-px bg-amber-100/80" />
          <div className="absolute top-1/2 left-0 w-2 h-px bg-amber-100/80" />
          <div className="absolute top-1/2 right-0 w-2 h-px bg-amber-100/80" />
        </div>
      </div>

      {msg && (phase === "play" || phase === "intro") && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none z-10 hidden md:block" style={phase === "intro" ? { bottom: "10vh" } : undefined}>
          <TarsMessage text={msg.text} id={msg.id} />
        </div>
      )}

      {paused && phase === "play" && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
          <p className="title-wide text-3xl text-stone-100">PAUSED</p>
          <p className="font-mono text-[11px] tracking-[.3em] text-stone-400 mt-4">TIME ON EARTH IS ALSO PAUSED. LUCKY YOU.</p>
          <div className="flex gap-4 mt-10">
            <button className="btn-mission px-8 py-3 text-xs text-stone-100" onClick={() => engineRef.current?.setPaused(false)}>
              RESUME
            </button>
            <button
              className="btn-mission px-8 py-3 text-xs text-stone-100"
              onClick={() => {
                engineRef.current?.setPaused(false);
                toOrbit();
              }}
            >
              ABORT
            </button>
          </div>
        </div>
      )}

      {phase === "end" && ending && <EndScreen ending={ending} onAgain={begin} onOrbit={toOrbit} />}

      <div className={`absolute inset-0 bg-white pointer-events-none transition-opacity duration-[1800ms] ${flash ? "opacity-100" : "opacity-0"}`} />
    </div>
  );
}

function Intro({ onBegin }: { onBegin: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col pointer-events-none">
      <nav className="mt-[7vh] px-8 md:px-14 py-6 flex items-center justify-between fade-up" style={{ animationDelay: "1.2s" }}>
        <div className="font-mono text-[10px] tracking-[.4em] text-stone-400">
          NASA · LAZARUS <span className="text-stone-600">/</span> MISSION 02
        </div>
        <div className="hidden md:flex gap-10 font-mono text-[10px] tracking-[.4em] text-stone-500 mr-28">
          <span>GARGANTUA · 100M M☉</span>
          <span>SPIN 0.999999 c</span>
        </div>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <p className="font-mono text-[10px] md:text-[11px] tracking-[.6em] text-amber-200/70 fade-up" style={{ animationDelay: "0.6s" }}>
          MANKIND WAS BORN ON EARTH · IT WAS NEVER MEANT TO DIE HERE
        </p>
        <h1 className="letter-in title-wide text-[11vw] md:text-[7.2vw] leading-none text-stone-100 mt-6 pl-[0.55em]" style={{ textShadow: "0 0 60px rgba(255,190,120,.25)" }}>
          GARGANTUA
        </h1>
        <p className="font-display font-light tracking-[.8em] text-[11px] md:text-sm text-stone-300 mt-6 pl-[.8em] fade-up" style={{ animationDelay: "1.8s" }}>
          A GRAVITY ODYSSEY
        </p>

        <button
          onClick={onBegin}
          className="btn-mission pointer-events-auto mt-14 px-12 py-4 text-[11px] text-stone-100 fade-up bg-black/20"
          style={{ animationDelay: "2.4s" }}
        >
          BEGIN MISSION
        </button>
        <p className="font-mono italic text-[11px] text-stone-500 mt-6 fade-up" style={{ animationDelay: "3s" }}>
          "Do not go gentle into that good night."
        </p>
      </div>

      <div className="mb-[7vh] px-8 md:px-14 pb-6 grid md:grid-cols-3 gap-6 md:gap-14 fade-up" style={{ animationDelay: "3.2s" }}>
        {[
          {
            k: "01 · OBJECTIVE",
            t: "Harvest quantum data orbiting Gargantua. The closer to the horizon, the richer the signal. Dock at Endurance to upload 150 quanta.",
          },
          {
            k: "02 · RELATIVITY",
            t: "Gravity bends time. Near the horizon one hour costs years on Earth. Murph is waiting. You have 60 Earth years.",
          },
          {
            k: "03 · FLIGHT",
            t: "Mouse steers · W / Space / Click thrust · Shift boost · S retro · A/D roll · Esc pause. Or cross the horizon… and see what lies beyond.",
          },
        ].map((c) => (
          <div key={c.k} className="hidden md:block border-t border-stone-500/30 pt-4">
            <p className="font-mono text-[10px] tracking-[.4em] text-amber-200/80">{c.k}</p>
            <p className="text-[13px] font-light leading-relaxed text-stone-300 mt-3">{c.t}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function EndScreen({ ending, onAgain, onOrbit }: { ending: NonNullable<Ending>; onAgain: () => void; onOrbit: () => void }) {
  const success = ending.score >= 150;
  let kicker = "";
  let title = "";
  let body = "";
  if (ending.reason === "tesseract") {
    kicker = "BEYOND THE EVENT HORIZON";
    title = "THE TESSERACT";
    body = success
      ? `Time is a dimension here. You found the bookshelf, the watch, the second hand, and pushed ${ending.score} quanta of data through gravity itself. Murph understood. Humanity lifts off.`
      : `Inside the five-dimensional library you reached across time, but only ${ending.score} quanta made it through. The signal was too faint. Murph waits at the bookshelf, listening.`;
  } else if (ending.reason === "win") {
    kicker = "PLAN A · COMPLETE";
    title = "WE ARE THE BRIDGE";
    body = `${ending.score} quanta uploaded with ${ending.years.toFixed(1)} Earth years elapsed. The gravity equation is solved. Colonies rise from Earth's dust. Murph will see the stars.`;
  } else {
    kicker = "60 YEARS HAVE PASSED ON EARTH";
    title = "MURPH IS GONE";
    body = `Time was the one resource we couldn't refuel. ${ending.score} quanta reached home, and it was not enough. Somewhere, a message from a father plays on an empty screen.`;
  }
  return (
    <div className={`absolute inset-0 flex flex-col items-center justify-center text-center px-6 ${ending.reason === "tesseract" ? "" : "bg-black/30"}`}>
      <p className="font-mono text-[11px] tracking-[.5em] text-amber-200/80 fade-up" style={{ animationDelay: "1.2s" }}>
        {kicker}
      </p>
      <h2 className="letter-in title-wide text-[8vw] md:text-[5vw] text-stone-100 mt-5 pl-[.55em]" style={{ animationDelay: "1.4s" }}>
        {title}
      </h2>
      <p className="max-w-xl text-sm md:text-[15px] font-light leading-relaxed text-stone-300 mt-8 fade-up" style={{ animationDelay: "2.6s" }}>
        {body}
      </p>
      <div className="flex gap-10 mt-10 font-mono fade-up" style={{ animationDelay: "3.2s" }}>
        <div>
          <p className="text-[9px] tracking-[.4em] text-stone-500">QUANTA</p>
          <p className="text-2xl text-stone-100">{ending.score}</p>
        </div>
        <div>
          <p className="text-[9px] tracking-[.4em] text-stone-500">EARTH YEARS</p>
          <p className="text-2xl text-stone-100">{ending.years.toFixed(1)}</p>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-4 mt-12 fade-up" style={{ animationDelay: "3.8s" }}>
        <button className="btn-mission px-10 py-4 text-[11px] text-stone-100 bg-black/20" onClick={onAgain}>
          FLY AGAIN
        </button>
        <button className="btn-mission px-10 py-4 text-[11px] text-stone-100 bg-black/20" onClick={onOrbit}>
          RETURN TO ORBIT
        </button>
      </div>
    </div>
  );
}
