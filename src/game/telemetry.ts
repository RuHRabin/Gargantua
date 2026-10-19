import type { HudState } from "./Engine";

export function createTelemetry() {
  let snapshot: HudState | null = null;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    publish: (value: HudState | null) => {
      snapshot = value;
      listeners.forEach((listener) => listener());
    },
  };
}

export type Telemetry = ReturnType<typeof createTelemetry>;