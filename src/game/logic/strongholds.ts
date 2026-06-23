// Bastion Protocol — Stronghold (level) definitions.
// Pure data: grid layout, enemy path(s), and wave schedules.
// No Phaser dependency.

import { GridConfig, GridCoord, TileType, coordKey } from "./grid";
import { EnemyKind } from "./enemies";
import { WaveDef } from "./waves";

export interface StrongholdDef {
  readonly id: string;
  readonly name: string;
  readonly grid: GridConfig;
  /** Ordered path(s) from spawn to core; one entry per lane. */
  readonly paths: readonly (readonly GridCoord[])[];
  readonly coreCoord: GridCoord;
  readonly startingCogs: number;
  readonly coreIntegrity: number;
  readonly waves: readonly WaveDef[];
}

// ---------------------------------------------------------------------------
// Path-building helpers
// ---------------------------------------------------------------------------

/** Inclusive straight line of coords between two grid points (H or V only). */
function line(from: GridCoord, to: GridCoord): GridCoord[] {
  const coords: GridCoord[] = [];
  const dCol = Math.sign(to.col - from.col);
  const dRow = Math.sign(to.row - from.row);
  let { col, row } = from;
  coords.push({ col, row });
  while (col !== to.col || row !== to.row) {
    col += dCol;
    row += dRow;
    coords.push({ col, row });
  }
  return coords;
}

/** Build a continuous path through a list of corner coords, de-duping joints. */
function pathThrough(corners: readonly GridCoord[]): GridCoord[] {
  const out: GridCoord[] = [];
  for (let i = 0; i < corners.length - 1; i++) {
    const seg = line(corners[i], corners[i + 1]);
    // Drop the first coord of each segment after the first to avoid duplicate joints.
    out.push(...(i === 0 ? seg : seg.slice(1)));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Stronghold 1 — "The Ingress"
// ---------------------------------------------------------------------------

const S1_GRID: GridConfig = {
  cols: 16,
  rows: 11,
  tileSize: 44,
  originX: 0,
  originY: 0,
};

// Serpentine single lane from the left edge down to the core.
const S1_PATH = pathThrough([
  { col: 0, row: 1 },
  { col: 13, row: 1 },
  { col: 13, row: 4 },
  { col: 2, row: 4 },
  { col: 2, row: 7 },
  { col: 13, row: 7 },
  { col: 13, row: 9 },
  { col: 0, row: 9 },
]);

const S1_CORE: GridCoord = { col: 0, row: 9 };

const S1_WAVES: WaveDef[] = [
  {
    index: 0,
    name: "Probe",
    setupCogs: 0,
    groups: [{ kind: EnemyKind.Grunt, count: 8, startDelayMs: 500, intervalMs: 850, spawnIndex: 0 }],
  },
  {
    index: 1,
    name: "Swift Tide",
    setupCogs: 80,
    groups: [
      { kind: EnemyKind.Grunt, count: 6, startDelayMs: 500, intervalMs: 800, spawnIndex: 0 },
      { kind: EnemyKind.Skitter, count: 8, startDelayMs: 3000, intervalMs: 450, spawnIndex: 0 },
    ],
  },
  {
    index: 2,
    name: "Ironside",
    setupCogs: 110,
    groups: [
      { kind: EnemyKind.Grunt, count: 8, startDelayMs: 500, intervalMs: 700, spawnIndex: 0 },
      { kind: EnemyKind.Bulwark, count: 3, startDelayMs: 4000, intervalMs: 2500, spawnIndex: 0 },
      { kind: EnemyKind.Skitter, count: 6, startDelayMs: 6000, intervalMs: 500, spawnIndex: 0 },
    ],
  },
  {
    index: 3,
    name: "Volatile Mix",
    setupCogs: 140,
    groups: [
      { kind: EnemyKind.Detonator, count: 4, startDelayMs: 500, intervalMs: 1800, spawnIndex: 0 },
      { kind: EnemyKind.Warden, count: 4, startDelayMs: 3000, intervalMs: 1600, spawnIndex: 0 },
      { kind: EnemyKind.Skitter, count: 10, startDelayMs: 5000, intervalMs: 400, spawnIndex: 0 },
      { kind: EnemyKind.Bulwark, count: 2, startDelayMs: 9000, intervalMs: 3000, spawnIndex: 0 },
    ],
  },
  {
    index: 4,
    name: "The Colossus",
    setupCogs: 180,
    groups: [
      { kind: EnemyKind.Mender, count: 2, startDelayMs: 500, intervalMs: 4000, spawnIndex: 0 },
      { kind: EnemyKind.Bulwark, count: 4, startDelayMs: 2000, intervalMs: 2000, spawnIndex: 0 },
      { kind: EnemyKind.Drifter, count: 6, startDelayMs: 4000, intervalMs: 1200, spawnIndex: 0 },
      { kind: EnemyKind.Warden, count: 4, startDelayMs: 7000, intervalMs: 1500, spawnIndex: 0 },
      { kind: EnemyKind.Colossus, count: 1, startDelayMs: 12000, intervalMs: 0, spawnIndex: 0 },
    ],
  },
];

export const STRONGHOLD_1: StrongholdDef = {
  id: "s1",
  name: "The Ingress",
  grid: S1_GRID,
  paths: [S1_PATH],
  coreCoord: S1_CORE,
  startingCogs: 220,
  coreIntegrity: 20,
  waves: S1_WAVES,
};

export const STRONGHOLDS: readonly StrongholdDef[] = [STRONGHOLD_1];

// ---------------------------------------------------------------------------
// Tile-map derivation
// ---------------------------------------------------------------------------

/**
 * Build a 2D tile-type map for a stronghold. Path tiles are Path (with Spawn at
 * each path head and Core at the core coord); every other in-bounds tile is
 * Buildable.
 */
export function buildTileMap(def: StrongholdDef): TileType[][] {
  const { cols, rows } = def.grid;
  const map: TileType[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => TileType.Buildable),
  );

  const coreK = coordKey(def.coreCoord);
  for (const path of def.paths) {
    path.forEach((c, i) => {
      if (c.row < 0 || c.row >= rows || c.col < 0 || c.col >= cols) return;
      if (i === 0) {
        map[c.row][c.col] = TileType.Spawn;
      } else if (coordKey(c) === coreK) {
        map[c.row][c.col] = TileType.Core;
      } else {
        map[c.row][c.col] = TileType.Path;
      }
    });
  }
  map[def.coreCoord.row][def.coreCoord.col] = TileType.Core;
  return map;
}

export function getSpawnCoords(def: StrongholdDef): GridCoord[] {
  return def.paths.map((p) => p[0]);
}
