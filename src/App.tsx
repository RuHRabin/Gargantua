import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Engine, EngineEvent, QualityMode } from "./game/Engine";
import { createTelemetry } from "./game/telemetry";
import { loadProgress, saveProgress, type SavedProgress } from "./game/progress";
import { LESSON_BY_ID, LESSONS } from "./game/learning";
import { MISSIONS } from "./game/campaign";

const MISSION_SUBJECTS = MISSIONS.map((mission) => mission.subjects[0]);
import { Intro, OrbitMark } from "./components/Intro";
import { FlightHud } from "./components/FlightHud";
import { FieldGuide } from "./components/FieldGuide";
import { MissionControl } from "./components/MissionControl";
import { Settings } from "./components/Settings";
import { TarsMessage } from "./components/Tars";
import { LevelDebrief } from "./components/LevelDebrief";
import { StationService } from "./components/StationService";
import { ExplorationChart } from "./components/ExplorationChart";
import { NasaLive } from "./components/NasaLive";
import { HowToPlay } from "./components/HowToPlay";

type Phase = "intro" | "countdown" | "play" | "end";
type Debrief = Extract<EngineEvent, { type: "mission" }>;
type Panel = "guide" | "missions" | "settings" | "station" | "chart" | "nasa" | "howto" | null;
type Ending = Extract<EngineEvent, { type: "end" }>;
type Toast = { id: number; text: string; color: string };

function readPreferences() {
  try {
    const value = JSON.parse(localStorage.getItem("gargantua.preferences") ?? "{}");
    return {
      quality: (["auto", "eco", "cinematic"].includes(value.quality) ? value.quality
        : window.matchMedia("(pointer: coarse)").matches ? "eco" : "auto") as QualityMode,
      humor: typeof value.humor === "number" && Number.isFinite(value.humor) ? Math.max(0, Math.min(100, value.humor)) : 75,
      muted: value.muted === true,
    };
  } catch { return { quality: "auto" as QualityMode, humor: 75, muted: false }; }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const reticleRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [telemetry] = useState(createTelemetry);
  const [progress, setProgress] = useState(loadProgress);
  const progressRef = useRef(progress);
  const [preferences, setPreferences] = useState(readPreferences);
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const [phase, setPhase] = useState<Phase>("intro");
  const phaseRef = useRef<Phase>("intro");
  phaseRef.current = phase;
  const [panel, setPanel] = useState<Panel>(null);
  const panelRef = useRef<Panel>(null);
  const resumeAfterPanel = useRef(false);
  const [guideId, setGuideId] = useState("gargantua");
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [ending, setEnding] = useState<Ending | null>(null);
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const [message, setMessage] = useState<{ text: string; id: number } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [discovery, setDiscovery] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const timerRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const nextId = useRef(0);

  const later = useCallback((callback: () => void, ms: number) => {
    const timer = setTimeout(() => { timerRef.current.delete(timer); callback(); }, ms);
    timerRef.current.add(timer);
    return timer;
  }, []);

  const commitProgress = useCallback((update: (previous: SavedProgress) => SavedProgress) => {
    const next = update(progressRef.current);
    progressRef.current = next;
    setProgress(next);
    saveProgress(next);
  }, []);

  const pushToast = useCallback((text: string, color = "#dfbd8a") => {
    const id = ++nextId.current;
    setToasts((previous) => [...previous.slice(-2), { id, text, color }]);
    later(() => setToasts((previous) => previous.filter((entry) => entry.id !== id)), 3200);
  }, [later]);

  useEffect(() => {
    let cancelled = false;
    let engine: Engine | null = null;
    // Deferring one frame avoids constructing two WebGL scenes under React StrictMode.
    const frame = requestAnimationFrame(() => {
      void import("./game/Engine").then(({ Engine: GameEngine }) => {
        if (cancelled || !canvasRef.current || !markerRef.current) return;
        const onEvent = (event: EngineEvent) => {
          if (cancelled) return;
          switch (event.type) {
            case "message": setMessage({ text: event.text, id: ++nextId.current }); break;
            case "collect": pushToast(`+${event.value} research / +${event.value * 10} pts`); break;
            case "fuel": pushToast("Propellant recovered / +25 pts", "#a5cddd"); break;
            case "upload": pushToast(`${event.value} research transmitted`); break;
            case "survey": pushToast(`${event.name} surveyed / +150 pts`, "#a5cddd"); break;
            case "bonus": pushToast(event.text); break;
            case "hazard": pushToast(event.text, event.tone === "bad" ? "#ef9169" : "#a5cddd"); break;
            case "sector-charted":
              if (event.firstEver) {
                commitProgress((previous) => ({ ...previous, chartedSectors: [...new Set([...previous.chartedSectors, event.sector.id])] }));
                pushToast(`New sector charted: ${event.sector.label} / +${event.points}`, "#cfe0c4");
              }
              break;
            case "station-docked": pushToast("Docked at Endurance / refuelling. Tap Station for full service", "#bfe3cf"); break;
            case "station-serviced": pushToast("Endurance service complete / all systems full", "#bfe3cf"); break;
            case "discovery": {
              commitProgress((previous) => ({ ...previous, discoveries: [...new Set([...previous.discoveries, event.id])] }));
              setDiscovery(event.id);
              break;
            }
            case "mission": {
              const { result } = event;
              setMessage(null);
              setDiscovery(null);
              setDebrief(event);
              commitProgress((previous) => ({ ...previous,
                unlockedLevel: Math.max(previous.unlockedLevel, Math.min(MISSIONS.length, result.level + 1)),
                completedLevel: Math.max(previous.completedLevel, result.level),
                bestPoints: Math.max(previous.bestPoints, result.totalPoints),
                stars: { ...previous.stars, [result.level]: Math.max(previous.stars[result.level] ?? 0, result.stars) },
              }));
              break;
            }
            case "pause": {
              setPaused(event.paused);
              if (event.paused && phaseRef.current === "play" && panelRef.current === null) {
                resumeAfterPanel.current = true;
                panelRef.current = "settings";
                setPanel("settings");
              }
              break;
            }
            case "horizon": setFlash(true); later(() => setFlash(false), 1600); break;
            case "end": {
              setEnding(event); setPhase("end"); phaseRef.current = "end"; setMessage(null);
              commitProgress((previous) => ({ ...previous, bestPoints: Math.max(previous.bestPoints, event.points) }));
              break;
            }
          }
        };
        try {
          engine = new GameEngine(canvasRef.current, markerRef.current, telemetry.publish, onEvent);
          engineRef.current = engine;
          engine.setQuality(preferencesRef.current.quality);
          engine.setHumor(preferencesRef.current.humor);
          engine.setMuted(preferencesRef.current.muted);
          engine.setChartedSectors(progressRef.current.chartedSectors);
          if (panelRef.current) engine.setPaused(true);
          void engine.ready.then(() => { if (!cancelled) setReady(true); }).catch(() => {
            if (!cancelled) setError("The 3D renderer could not initialize.");
          });
        } catch {
          if (!cancelled) setError("This device needs a WebGL 2-capable browser for flight.");
        }
      }).catch(() => { if (!cancelled) setError("The flight module could not load. Please refresh to retry."); });
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); engine?.dispose(); engineRef.current = null; };
  }, [commitProgress, later, pushToast, telemetry]);

  useEffect(() => {
    engineRef.current?.setHumor(preferences.humor);
    engineRef.current?.setMuted(preferences.muted);
    try { localStorage.setItem("gargantua.preferences", JSON.stringify(preferences)); } catch { /* Storage is optional. */ }
  }, [preferences]);

  useEffect(() => {
    if (!message) return;
    const timer = later(() => setMessage(null), Math.max(7000, message.text.length * 30 + 3000));
    return () => { clearTimeout(timer); timerRef.current.delete(timer); };
  }, [message, later]);

  useEffect(() => {
    if (!discovery) return;
    const timer = later(() => setDiscovery(null), 12000);
    return () => { clearTimeout(timer); timerRef.current.delete(timer); };
  }, [discovery, later]);

  useEffect(() => () => { timerRef.current.forEach(clearTimeout); timerRef.current.clear(); }, []);

  const openPanel = useCallback((next: NonNullable<Panel>, id?: string) => {
    if (phaseRef.current === "countdown") return;
    if (!panelRef.current) resumeAfterPanel.current = !engineRef.current?.paused;
    panelRef.current = next;
    if (id) setGuideId(id);
    setPanel(next);
    engineRef.current?.setPaused(true);
  }, []);

  const closePanel = useCallback(() => {
    panelRef.current = null;
    setPanel(null);
    if (resumeAfterPanel.current) { engineRef.current?.setPaused(false); setPaused(false); }
    resumeAfterPanel.current = false;
  }, []);

  const openGuide = useCallback((id = "gargantua") => openPanel("guide", id), [openPanel]);
  const showGuide = useCallback(() => openGuide(), [openGuide]);
  const showClockLesson = useCallback(() => openGuide("relativity"), [openGuide]);
  const showMissions = useCallback(() => openPanel("missions"), [openPanel]);
  const showStation = useCallback(() => openPanel("station"), [openPanel]);
  const showChart = useCallback(() => openPanel("chart"), [openPanel]);
  const showNasa = useCallback(() => openPanel("nasa"), [openPanel]);
  const showHowTo = useCallback(() => openPanel("howto"), [openPanel]);
  useEffect(() => {
    if (!ready) return;
    try {
      if (localStorage.getItem("gargantua.manualSeen")) return;
      localStorage.setItem("gargantua.manualSeen", "1");
    } catch { return; }
    showHowTo();
  }, [ready, showHowTo]);
  const plotSector = useCallback((ring: number, bearing: number) => {
    engineRef.current?.setSectorTarget(ring, bearing);
    if (engineRef.current && !engineRef.current.autopilot) engineRef.current.toggleAutopilot();
    closePanel();
  }, [closePanel]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest("input, textarea, select")) return;
      if (event.code === "KeyJ" && !event.repeat && phaseRef.current !== "countdown") {
        event.preventDefault(); event.stopPropagation();
        if (panelRef.current === "guide") closePanel(); else showGuide();
      }
      if (event.code === "KeyM" && !event.repeat && phaseRef.current === "play") {
        event.preventDefault();
        if (panelRef.current === "chart") closePanel(); else showChart();
      }
      if (event.code === "KeyH" && !event.repeat && phaseRef.current === "play" && engineRef.current?.docking) {
        event.preventDefault();
        if (panelRef.current === "station") closePanel(); else showStation();
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (reticleRef.current && phaseRef.current === "play") reticleRef.current.style.transform = `translate3d(${event.clientX}px,${event.clientY}px,0)`;
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointermove", onPointer, { passive: true });
    return () => { window.removeEventListener("keydown", onKey, true); window.removeEventListener("pointermove", onPointer); };
  }, [closePanel, showGuide, showChart, showStation]);

  const launch = useCallback((level: number) => {
    if (!ready || !engineRef.current || phaseRef.current === "countdown") return;
    level = Math.max(1, Math.min(progressRef.current.unlockedLevel, level));
    timerRef.current.forEach(clearTimeout); timerRef.current.clear();
    panelRef.current = null; setPanel(null); resumeAfterPanel.current = false;
    engineRef.current.initAudio(); engineRef.current.toIntro();
    setPaused(false); setPhase("countdown"); phaseRef.current = "countdown";
    setCountdown(3); setEnding(null); setDebrief(null); setToasts([]); setDiscovery(null); setMessage(null); setFlash(false);
    later(() => setCountdown(2), 1000);
    later(() => setCountdown(1), 2000);
    later(() => setCountdown(0), 3000);
    later(() => {
      setPhase("play"); phaseRef.current = "play";
      engineRef.current?.startGame(level);
      progressRef.current.mastered.forEach((id) => engineRef.current?.rewardKnowledge(id));
    }, 3550);
  }, [later, ready]);

  const begin = useCallback(() => launch(progressRef.current.completedLevel >= MISSIONS.length ? 1 : progressRef.current.unlockedLevel), [launch]);
  const returnToOrbit = useCallback(() => {
    timerRef.current.forEach(clearTimeout); timerRef.current.clear();
    closePanel(); engineRef.current?.toIntro(); telemetry.publish(null);
    setPhase("intro"); phaseRef.current = "intro"; setEnding(null); setDebrief(null); setMessage(null); setDiscovery(null); setPaused(false); setToasts([]); setFlash(false);
  }, [closePanel, telemetry]);

  const continueLevel = useCallback(() => {
    setDebrief(null);
    setToasts([]);
    engineRef.current?.continueLevel();
  }, []);

  const replayLevel = useCallback(() => {
    const level = debrief?.result.level ?? 1;
    setDebrief(null);
    launch(level);
  }, [debrief, launch]);

  const debriefGuide = useCallback(() => {
    const level = debrief?.result.level ?? 1;
    const subject = MISSION_SUBJECTS[level - 1] ?? "gargantua";
    openGuide(subject);
  }, [debrief, openGuide]);

  const onMaster = useCallback((id: string) => {
    if (progressRef.current.mastered.includes(id) || !LESSON_BY_ID.has(id)) return;
    engineRef.current?.rewardKnowledge(id);
    commitProgress((previous) => ({ ...previous, mastered: [...previous.mastered, id],
      bestPoints: Math.max(previous.bestPoints, engineRef.current?.mode === "play" ? engineRef.current.campaign.points : (previous.mastered.length + 1) * 100),
    }));
    pushToast("Understanding unlocked / +100 knowledge points", "#aacfb2");
  }, [commitProgress, pushToast]);

  const changeQuality = useCallback((quality: QualityMode) => {
    engineRef.current?.setQuality(quality);
    setPreferences((previous) => ({ ...previous, quality }));
  }, []);
  const changeHumor = useCallback((humor: number) => setPreferences((previous) => ({ ...previous, humor })), []);

  return (
    <div className={`gargantua-app ${phase === "play" ? "in-flight" : ""} ${panel ? "panel-open" : ""}`}>
      <canvas ref={canvasRef} className="universe-canvas" aria-label="Interactive three-dimensional black hole and spacecraft simulation" />
      <div ref={markerRef} className={`world-markers ${phase === "play" ? "" : "is-hidden"}`} />
      <div className="cinematic-grade" />
      {error && <div className="fallback-universe" aria-hidden="true"><div /><i /></div>}
      <div className={`letterbox top ${phase === "play" ? "open" : ""}`} /><div className={`letterbox bottom ${phase === "play" ? "open" : ""}`} />

      <header className={`main-navigation ${phase === "play" ? "flight-navigation" : ""}`}>
        <button className="brand-link" aria-label="Gargantua home" onClick={phase === "play" ? showMissions : returnToOrbit}><OrbitMark /><span>Gargantua</span></button>
        <span className="nav-subtitle">An interactive expedition</span>
        <nav aria-label="Main navigation"><button disabled={phase === "countdown"} onClick={showMissions}>Missions</button><button disabled={phase === "countdown"} onClick={showGuide}>Field guide <span className="nav-key">J</span></button>{phase === "play" && <button onClick={showChart}>Star chart <span className="nav-key">M</span></button>}<button disabled={phase === "countdown"} onClick={showNasa}>NASA live</button><button disabled={phase === "countdown"} onClick={showHowTo}>How to play</button><button disabled={phase === "countdown"} className="settings-button" onClick={() => openPanel("settings")} aria-label="Open flight settings"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2.5" fill="#080c0e" /><circle cx="16" cy="17" r="2.5" fill="#080c0e" /></svg></button></nav>
      </header>

      {phase === "intro" && <Intro onBegin={begin} onGuide={showGuide} ready={ready} error={error} level={progress.completedLevel >= MISSIONS.length ? 1 : progress.unlockedLevel} />}
      {phase === "countdown" && <div className="countdown-composition"><p className="micro-label">Gargantua / Instruments ready</p><div key={countdown} className="countdown-number">{countdown || "GO"}</div><p className="countdown-note">Your next discovery is out there.</p></div>}
      {phase === "play" && <>
        <FlightHud telemetry={telemetry} engine={engineRef} onMissions={showMissions} onGuide={showClockLesson} />
        {message && <div className="tars-comms"><TarsMessage text={message.text} id={message.id} /></div>}
        {discovery && <button className="discovery-notice" onClick={() => openGuide(discovery)}><span className="micro-label">Field note discovered / +50 pts</span><strong>{LESSON_BY_ID.get(discovery)?.name}</strong><span className="discovery-learn">Learn the idea <span aria-hidden="true">+</span></span></button>}
        <StationButton telemetry={telemetry} onOpen={showStation} hidden={!!panel || !!debrief} />
        <div className="mobile-flight-controls">
          <button onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); engineRef.current?.setTouchThrust(true); }} onPointerUp={() => engineRef.current?.setTouchThrust(false)} onPointerCancel={() => engineRef.current?.setTouchThrust(false)}>Thrust</button>
          <button onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); engineRef.current?.setTouchRetro(true); }} onPointerUp={() => engineRef.current?.setTouchRetro(false)} onPointerCancel={() => engineRef.current?.setTouchRetro(false)}>Brake</button>
          <button onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); engineRef.current?.setTouchScoop(true); }} onPointerUp={() => engineRef.current?.setTouchScoop(false)} onPointerCancel={() => engineRef.current?.setTouchScoop(false)}>Scoop</button>
        </div>
        <div ref={reticleRef} className={`mouse-reticle ${paused || panel || debrief ? "is-hidden" : ""}`} aria-hidden="true"><span /><i /></div>
        {debrief && !panel && <LevelDebrief result={debrief.result} campaignComplete={debrief.campaignComplete} bestStars={progress.stars[debrief.result.level] ?? 0} onContinue={continueLevel} onReplay={replayLevel} onGuide={debriefGuide} />}
      </>}
      {phase === "end" && ending && <EndScreen ending={ending} mastered={progress.mastered.length} onAgain={() => launch(1)} onGuide={showGuide} onOrbit={returnToOrbit} />}

      <button className={`sound-switch ${phase === "play" ? "during-flight" : ""}`} aria-label={preferences.muted ? "Enable sound" : "Mute sound"} aria-pressed={!preferences.muted} onClick={() => { engineRef.current?.initAudio(); setPreferences((previous) => ({ ...previous, muted: !previous.muted })); }}><span className={`sound-bars ${preferences.muted ? "muted" : ""}`} aria-hidden="true"><i /><i /><i /><i /></span>{preferences.muted ? "Sound off" : "Sound on"}</button>
      <div className={`event-toast-stack ${panel ? "above-dialog" : ""}`} role="status" aria-live="polite">{toasts.map((toast) => <p key={toast.id} className="event-toast" style={{ color: toast.color }}>{toast.text}</p>)}</div>
      <div className={`horizon-flash ${flash ? "active" : ""}`} />

      {panel === "guide" && <FieldGuide key={guideId} initialId={guideId} progress={progress} onClose={closePanel} onMaster={onMaster} />}
      {panel === "missions" && <MissionControl progress={progress} campaign={phase === "play" ? telemetry.getSnapshot()?.campaign : undefined} onLaunch={launch} onLearn={openGuide} onClose={closePanel} ready={ready} />}
      {panel === "station" && telemetry.getSnapshot() && <StationService engine={engineRef} hud={telemetry.getSnapshot()!} onClose={closePanel} />}
      {panel === "chart" && telemetry.getSnapshot() && <ExplorationChart charted={progress.chartedSectors} current={telemetry.getSnapshot()!.sector} flightCount={telemetry.getSnapshot()!.campaign.stats.sectorsCharted} onClose={closePanel} onPlot={plotSector} />}
      {panel === "nasa" && <NasaLive onClose={closePanel} />}
      {panel === "howto" && <HowToPlay onClose={closePanel} />}
      {panel === "settings" && <Settings quality={preferences.quality} setQuality={changeQuality} humor={preferences.humor} setHumor={changeHumor} onClose={closePanel} playing={phase === "play"} />}
    </div>
  );
}

function EndScreen({ ending, mastered, onAgain, onGuide, onOrbit }: {
  ending: Ending; mastered: number; onAgain: () => void; onGuide: () => void; onOrbit: () => void;
}) {
  const success = ending.reason === "win";
  return <main className="end-composition">
    <p className="micro-label reveal">{success ? "Expedition complete / A little more understood" : ending.reason === "tesseract" ? "Beyond the horizon / A fictional epilogue" : ending.reason === "wreck" ? "Hull breach / Expedition ended" : "Expedition log / Deadline reached"}</p>
    <h1 className="reveal" style={{ animationDelay: ".2s" }}>{success ? <>Knowledge<br />brought home.</> : ending.reason === "tesseract" ? <>The<br />tesseract.</> : ending.reason === "wreck" ? <>The debris<br />found you.</> : <>The universe<br />can wait.</>}</h1>
    <p className="end-description reveal" style={{ animationDelay: ".4s" }}>{success ? "Every chapter flown. One remarkable journey. You came back with research, discoveries, and a new way of seeing the stars." : ending.reason === "tesseract" ? "A four-dimensional cube becomes visible through a three-dimensional projection. This room is a story, not a scientific prediction of a black-hole interior." : ending.reason === "wreck" ? "Hull integrity reached zero. Real mission planners track every close approach precisely because relative speed, not distance alone, decides the outcome. Dock at Endurance earlier to repair." : "The accelerated scenario clock ran out, but every concept you learned is saved. Start another flight with a clearer course."}</p>
    <div className="end-results reveal" style={{ animationDelay: ".6s" }}><div><span className="micro-label">Expedition points</span><strong>{ending.points.toLocaleString()}</strong></div><div><span className="micro-label">Missions complete</span><strong>{ending.completed}<small> / {MISSIONS.length}</small></strong></div><div><span className="micro-label">Subjects mastered</span><strong>{mastered}<small> / {LESSONS.length}</small></strong></div></div>
    <div className="end-actions reveal" style={{ animationDelay: ".8s" }}><button className="primary-button" onClick={onAgain}>Fly again <span>/</span></button><button className="text-button" onClick={onGuide}>Keep learning <span>+</span></button><button className="text-button" onClick={onOrbit}>Return to orbit</button></div>
  </main>;
}
function StationButton({ telemetry, onOpen, hidden }: { telemetry: ReturnType<typeof createTelemetry>; onOpen: () => void; hidden: boolean }) {
  const hud = useSyncExternalStore(telemetry.subscribe, telemetry.getSnapshot, telemetry.getSnapshot);
  if (!hud?.docking || hidden) return null;
  return <button className="station-callout" onClick={onOpen}><span className="station-callout__dot" />Docked at Endurance<strong>Open station services <kbd>H</kbd></strong></button>;
}
