import { LESSON_BY_ID } from "./learning";
import { MISSIONS } from "./campaign";

export interface SavedProgress {
  unlockedLevel: number;
  completedLevel: number;
  bestPoints: number;
  discoveries: string[];
  mastered: string[];
  /** Best star rating per level, indexed by level number as a string. */
  stars: Record<string, number>;
  /** Persistent map knowledge; each radial/orbital sector is charted once. */
  chartedSectors: string[];
}

const KEY = "gargantua.expedition.v1";

export function loadProgress(): SavedProgress {
  const empty: SavedProgress = { unlockedLevel: 1, completedLevel: 0, bestPoints: 0, discoveries: [], mastered: [], stars: {}, chartedSectors: [] };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!raw || typeof raw !== "object") return empty;
    const validIds = (value: unknown) => Array.isArray(value)
      ? [...new Set(value.filter((id): id is string => typeof id === "string" && LESSON_BY_ID.has(id)))] : [];
    const validSectors = (value: unknown): string[] => Array.isArray(value)
      ? [...new Set(value.filter((id: unknown): id is string => typeof id === "string" && /^r[0-5]-s[0-7]$/.test(id)))]
      : [];
    return {
      unlockedLevel: typeof raw.unlockedLevel === "number" && Number.isFinite(raw.unlockedLevel)
        ? Math.max(1, Math.min(MISSIONS.length, Math.floor(raw.unlockedLevel))) : 1,
      completedLevel: typeof raw.completedLevel === "number" && Number.isFinite(raw.completedLevel)
        ? Math.max(0, Math.min(MISSIONS.length, Math.floor(raw.completedLevel))) : 0,
      bestPoints: typeof raw.bestPoints === "number" && Number.isFinite(raw.bestPoints) ? Math.max(0, Math.floor(raw.bestPoints)) : 0,
      discoveries: validIds(raw.discoveries),
      mastered: validIds(raw.mastered),
      stars: raw.stars && typeof raw.stars === "object"
        ? Object.fromEntries(Object.entries(raw.stars as Record<string, unknown>)
          .filter(([key, value]) => new RegExp(`^[1-${MISSIONS.length}]$`).test(key) && typeof value === "number" && value >= 1 && value <= 3)
          .map(([key, value]) => [key, Math.floor(value as number)]))
        : {},
      chartedSectors: validSectors(raw.chartedSectors),
    };
  } catch { return empty; }
}

export function saveProgress(progress: SavedProgress) {
  try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch { /* Private browsing can disable storage. */ }
}