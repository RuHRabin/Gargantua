import { useEffect, useState } from "react";
import { Dialog } from "./Dialog";
import "./nasa.css";

/**
 * Live data from NASA's open APIs (api.nasa.gov):
 *  - APOD: the Astronomy Picture of the Day, with its explanation.
 *  - NeoWs: asteroids making close approaches to Earth today.
 * DEMO_KEY is rate-limited per IP, so responses are cached for the session.
 */
const KEY = "DEMO_KEY";

interface Apod { title: string; explanation: string; url: string; hdurl?: string; media_type: string; date: string; copyright?: string }
interface Neo {
  id: string; name: string; hazardous: boolean; diameterMin: number; diameterMax: number;
  speedKms: number; missLunar: number; missKm: number; url: string;
}

const today = () => new Date().toISOString().slice(0, 10);

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  try {
    const hit = sessionStorage.getItem(key);
    if (hit) return JSON.parse(hit) as T;
  } catch { /* storage may be unavailable */ }
  const value = await load();
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  return value;
}

async function getJson(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(response.status === 429
    ? "NASA's public demo key is busy. Try again in a little while."
    : response.status >= 500 ? "NASA's service is temporarily unavailable. Try again shortly." : `NASA returned ${response.status}.`);
  return response.json();
}

async function loadApod(signal: AbortSignal): Promise<Apod> {
  return cached(`nasa.apod.${today()}`, async () => {
    // APOD occasionally answers with a server error; retry, then fall back to yesterday's picture.
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const attempts = [
      `https://api.nasa.gov/planetary/apod?api_key=${KEY}&thumbs=true`,
      `https://api.nasa.gov/planetary/apod?api_key=${KEY}`,
      `https://api.nasa.gov/planetary/apod?api_key=${KEY}&thumbs=true&date=${yesterday}`,
    ];
    let data: Record<string, any> | null = null;
    let lastError: unknown = null;
    for (const url of attempts) {
      try { data = await getJson(url, signal); break; } catch (error) {
        if (signal.aborted) throw error;
        lastError = error;
      }
    }
    if (!data) throw lastError instanceof Error ? lastError : new Error("NASA's picture service is not responding right now.");
    return {
      title: data.title, explanation: data.explanation, date: data.date, copyright: data.copyright,
      media_type: data.media_type, hdurl: data.hdurl,
      url: data.media_type === "video" ? (data.thumbnail_url ?? data.url) : data.url,
    };
  });
}

async function loadNeos(signal: AbortSignal): Promise<Neo[]> {
  const date = today();
  return cached(`nasa.neo.${date}`, async () => {
    const data = await getJson(`https://api.nasa.gov/neo/rest/v1/feed?start_date=${date}&end_date=${date}&api_key=${KEY}`, signal);
    const list = (Object.values(data.near_earth_objects ?? {}) as unknown[][]).flat() as Array<Record<string, any>>;
    return list.map((item) => {
      const approach = item.close_approach_data?.[0] ?? {};
      const meters = item.estimated_diameter?.meters ?? {};
      return {
        id: String(item.id), name: String(item.name).replace(/[()]/g, ""),
        hazardous: Boolean(item.is_potentially_hazardous_asteroid),
        diameterMin: Number(meters.estimated_diameter_min ?? 0), diameterMax: Number(meters.estimated_diameter_max ?? 0),
        speedKms: Number(approach.relative_velocity?.kilometers_per_second ?? 0),
        missLunar: Number(approach.miss_distance?.lunar ?? 0), missKm: Number(approach.miss_distance?.kilometers ?? 0),
        url: String(item.nasa_jpl_url ?? "https://cneos.jpl.nasa.gov/"),
      };
    }).sort((a, b) => a.missLunar - b.missLunar);
  });
}

function compare(diameter: number) {
  if (diameter < 10) return "about the size of a car";
  if (diameter < 30) return "about the size of a house";
  if (diameter < 80) return "about as long as a jumbo jet";
  if (diameter < 200) return "about as long as a football pitch";
  if (diameter < 500) return "taller than a skyscraper";
  return "larger than a city block";
}

export function NasaLive({ onClose }: { onClose: () => void }) {
  const [apod, setApod] = useState<Apod | null>(null);
  const [neos, setNeos] = useState<Neo[] | null>(null);
  const [apodError, setApodError] = useState("");
  const [neoError, setNeoError] = useState("");
  const [tab, setTab] = useState<"apod" | "neo">("apod");

  useEffect(() => {
    const controller = new AbortController();
    loadApod(controller.signal).then(setApod).catch((e) => { if (!controller.signal.aborted) setApodError(e.message || "Could not reach NASA."); });
    loadNeos(controller.signal).then(setNeos).catch((e) => { if (!controller.signal.aborted) setNeoError(e.message || "Could not reach NASA."); });
    return () => controller.abort();
  }, []);

  const closest = neos?.[0];
  const hazardous = neos?.filter((n) => n.hazardous).length ?? 0;

  return (
    <Dialog title="NASA live" eyebrow="Real data / Updated today" onClose={onClose} wide>
      <div className="nasa-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "apod"} className={tab === "apod" ? "active" : ""} onClick={() => setTab("apod")}>Picture of the day</button>
        <button role="tab" aria-selected={tab === "neo"} className={tab === "neo" ? "active" : ""} onClick={() => setTab("neo")}>
          Asteroids passing Earth today{neos ? ` / ${neos.length}` : ""}
        </button>
      </div>

      {tab === "apod" && (
        <div className="nasa-apod">
          {!apod && !apodError && <div className="nasa-loading"><span className="loading-orbit" /> Contacting NASA…</div>}
          {apodError && <p className="nasa-error">{apodError}</p>}
          {apod && <>
            <figure className="nasa-figure">
              {apod.media_type === "image" || apod.url
                ? <img src={apod.url} alt={apod.title} loading="lazy" decoding="async" />
                : null}
              <figcaption>{apod.date}{apod.copyright ? ` / © ${apod.copyright.trim()}` : " / NASA"}</figcaption>
            </figure>
            <article className="nasa-text">
              <p className="micro-label">Astronomy Picture of the Day</p>
              <h3>{apod.title}</h3>
              <p>{apod.explanation}</p>
              <a className="source-link" href={apod.hdurl ?? apod.url} target="_blank" rel="noopener noreferrer">Open full resolution</a>
            </article>
          </>}
        </div>
      )}

      {tab === "neo" && (
        <div className="nasa-neo">
          {!neos && !neoError && <div className="nasa-loading"><span className="loading-orbit" /> Reading today's close approaches…</div>}
          {neoError && <p className="nasa-error">{neoError}</p>}
          {neos && closest && <>
            <div className="nasa-neo-summary">
              <div><span className="micro-label">Close approaches today</span><strong>{neos.length}</strong></div>
              <div><span className="micro-label">Closest pass</span><strong>{closest.missLunar.toFixed(1)}<small> lunar distances</small></strong></div>
              <div><span className="micro-label">Flagged hazardous</span><strong>{hazardous}</strong></div>
            </div>
            <p className="nasa-neo-explainer">
              "Potentially hazardous" is a classification, not a prediction of impact: it means an object is large enough and its orbit
              comes close enough to Earth's that astronomers keep tracking it. One lunar distance is about 384,400 km.
            </p>
            <ul className="nasa-neo-list">
              {neos.slice(0, 12).map((n) => {
                const avg = (n.diameterMin + n.diameterMax) / 2;
                return (
                  <li key={n.id} className={n.hazardous ? "hazardous" : ""}>
                    <div className="neo-name"><a href={n.url} target="_blank" rel="noopener noreferrer">{n.name}</a>{n.hazardous && <em>Tracked</em>}</div>
                    <div className="neo-facts">
                      <span>{Math.round(n.diameterMin)}–{Math.round(n.diameterMax)} m, {compare(avg)}</span>
                      <span>{n.speedKms.toFixed(1)} km/s</span>
                      <span>{n.missLunar.toFixed(1)} LD · {Math.round(n.missKm).toLocaleString()} km</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>}
          {neos && neos.length === 0 && <p className="nasa-error">No close approaches listed for today.</p>}
        </div>
      )}
      <p className="nasa-credit">Data: NASA Open APIs (APOD and NeoWs, JPL CNEOS). Fetched live in your browser.</p>
    </Dialog>
  );
}
