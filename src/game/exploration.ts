import * as THREE from "three";

/**
 * Gargantua's local exploration chart: six radial orbital bands by eight
 * bearings around the hole. This is deliberately a game-scale star chart,
 * not a claim that the space around a black hole is a tiled cube map.
 */
export const RING_EDGES = [0, 4.5, 8, 14, 22, 36, Number.POSITIVE_INFINITY];
export const BEARING_COUNT = 8;
export const SECTOR_COUNT = (RING_EDGES.length - 1) * BEARING_COUNT;

const RING_NAMES = ["Inner well", "Photon orbit", "Accretion reach", "Outer drift", "World lanes", "Deep field"];
const BEARINGS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export interface SectorLocation {
  id: string;
  ring: number;
  bearing: number;
  bearingName: string;
  ringName: string;
  label: string;
  angle: number;
}

export function locateSector(position: THREE.Vector3): SectorLocation {
  const radius = Math.hypot(position.x, position.z);
  let ring = RING_EDGES.length - 2;
  for (let i = 0; i < RING_EDGES.length - 1; i++) {
    if (radius >= RING_EDGES[i] && radius < RING_EDGES[i + 1]) { ring = i; break; }
  }
  let angle = Math.atan2(position.z, position.x);
  if (angle < 0) angle += Math.PI * 2;
  const bearing = Math.floor((angle / (Math.PI * 2)) * BEARING_COUNT) % BEARING_COUNT;
  return {
    id: `r${ring}-s${bearing}`,
    ring,
    bearing,
    bearingName: BEARINGS[bearing],
    ringName: RING_NAMES[ring],
    label: `${RING_NAMES[ring]} / ${BEARINGS[bearing]} bearing`,
    angle,
  };
}

export function sectorId(ring: number, bearing: number) {
  return `r${ring}-s${bearing}`;
}
