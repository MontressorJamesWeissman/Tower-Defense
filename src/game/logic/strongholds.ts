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

// ---------------------------------------------------------------------------
// Stronghold 2 — "Twin Vents" (two lanes converging on the Core)
// ---------------------------------------------------------------------------

const S2_GRID: GridConfig = { cols: 16, rows: 11, tileSize: 44, originX: 0, originY: 0 };
const S2_CORE: GridCoord = { col: 0, row: 5 };
const S2_LANE_A = pathThrough([
  { col: 0, row: 1 },
  { col: 14, row: 1 },
  { col: 14, row: 5 },
  { col: 0, row: 5 },
]);
const S2_LANE_B = pathThrough([
  { col: 0, row: 9 },
  { col: 14, row: 9 },
  { col: 14, row: 5 },
  { col: 0, row: 5 },
]);

const S2_WAVES: WaveDef[] = [
  {
    index: 0,
    name: "Split Probe",
    setupCogs: 0,
    groups: [
      { kind: EnemyKind.Grunt, count: 6, startDelayMs: 500, intervalMs: 800, spawnIndex: 0 },
      { kind: EnemyKind.Grunt, count: 6, startDelayMs: 500, intervalMs: 800, spawnIndex: 1 },
    ],
  },
  {
    index: 1,
    name: "Pincer",
    setupCogs: 90,
    groups: [
      { kind: EnemyKind.Skitter, count: 8, startDelayMs: 500, intervalMs: 400, spawnIndex: 0 },
      { kind: EnemyKind.Bulwark, count: 3, startDelayMs: 1500, intervalMs: 2400, spawnIndex: 1 },
    ],
  },
  {
    index: 2,
    name: "Wardens' March",
    setupCogs: 120,
    groups: [
      { kind: EnemyKind.Warden, count: 5, startDelayMs: 500, intervalMs: 1400, spawnIndex: 0 },
      { kind: EnemyKind.Detonator, count: 4, startDelayMs: 1000, intervalMs: 1800, spawnIndex: 1 },
      { kind: EnemyKind.Grunt, count: 8, startDelayMs: 4000, intervalMs: 600, spawnIndex: 0 },
    ],
  },
  {
    index: 3,
    name: "Sky & Steel",
    setupCogs: 150,
    groups: [
      { kind: EnemyKind.Drifter, count: 8, startDelayMs: 500, intervalMs: 900, spawnIndex: 0 },
      { kind: EnemyKind.Bulwark, count: 5, startDelayMs: 2000, intervalMs: 1800, spawnIndex: 1 },
      { kind: EnemyKind.Mender, count: 2, startDelayMs: 5000, intervalMs: 3000, spawnIndex: 1 },
    ],
  },
  {
    index: 4,
    name: "Twin Colossi",
    setupCogs: 200,
    groups: [
      { kind: EnemyKind.Warden, count: 6, startDelayMs: 500, intervalMs: 1100, spawnIndex: 0 },
      { kind: EnemyKind.Detonator, count: 6, startDelayMs: 1000, intervalMs: 1100, spawnIndex: 1 },
      { kind: EnemyKind.Colossus, count: 1, startDelayMs: 11000, intervalMs: 0, spawnIndex: 0 },
      { kind: EnemyKind.Colossus, count: 1, startDelayMs: 13000, intervalMs: 0, spawnIndex: 1 },
    ],
  },
];

export const STRONGHOLD_2: StrongholdDef = {
  id: "s2",
  name: "Twin Vents",
  grid: S2_GRID,
  paths: [S2_LANE_A, S2_LANE_B],
  coreCoord: S2_CORE,
  startingCogs: 240,
  coreIntegrity: 18,
  waves: S2_WAVES,
};

// ---------------------------------------------------------------------------
// Stronghold 3 — "Switchback" (one long serpentine, tighter economy)
// ---------------------------------------------------------------------------

const S3_GRID: GridConfig = { cols: 16, rows: 11, tileSize: 44, originX: 0, originY: 0 };
const S3_CORE: GridCoord = { col: 15, row: 10 };
const S3_PATH = pathThrough([
  { col: 0, row: 1 },
  { col: 12, row: 1 },
  { col: 12, row: 3 },
  { col: 2, row: 3 },
  { col: 2, row: 5 },
  { col: 12, row: 5 },
  { col: 12, row: 7 },
  { col: 2, row: 7 },
  { col: 2, row: 9 },
  { col: 15, row: 9 },
  { col: 15, row: 10 },
]);

const S3_WAVES: WaveDef[] = [
  {
    index: 0,
    name: "Trickle",
    setupCogs: 0,
    groups: [{ kind: EnemyKind.Grunt, count: 10, startDelayMs: 500, intervalMs: 700, spawnIndex: 0 }],
  },
  {
    index: 1,
    name: "Quicksilver",
    setupCogs: 90,
    groups: [
      { kind: EnemyKind.Skitter, count: 14, startDelayMs: 500, intervalMs: 320, spawnIndex: 0 },
      { kind: EnemyKind.Warden, count: 3, startDelayMs: 3000, intervalMs: 1500, spawnIndex: 0 },
    ],
  },
  {
    index: 2,
    name: "Ironwall",
    setupCogs: 120,
    groups: [
      { kind: EnemyKind.Bulwark, count: 6, startDelayMs: 500, intervalMs: 1500, spawnIndex: 0 },
      { kind: EnemyKind.Mender, count: 2, startDelayMs: 3000, intervalMs: 4000, spawnIndex: 0 },
    ],
  },
  {
    index: 3,
    name: "Powder Keg",
    setupCogs: 150,
    groups: [
      { kind: EnemyKind.Detonator, count: 8, startDelayMs: 500, intervalMs: 1100, spawnIndex: 0 },
      { kind: EnemyKind.Drifter, count: 6, startDelayMs: 3000, intervalMs: 900, spawnIndex: 0 },
    ],
  },
  {
    index: 4,
    name: "The Long Dark",
    setupCogs: 190,
    groups: [
      { kind: EnemyKind.Warden, count: 6, startDelayMs: 500, intervalMs: 900, spawnIndex: 0 },
      { kind: EnemyKind.Bulwark, count: 5, startDelayMs: 3000, intervalMs: 1400, spawnIndex: 0 },
      { kind: EnemyKind.Mender, count: 2, startDelayMs: 6000, intervalMs: 3000, spawnIndex: 0 },
      { kind: EnemyKind.Colossus, count: 1, startDelayMs: 12000, intervalMs: 0, spawnIndex: 0 },
    ],
  },
];

export const STRONGHOLD_3: StrongholdDef = {
  id: "s3",
  name: "Switchback",
  grid: S3_GRID,
  paths: [S3_PATH],
  coreCoord: S3_CORE,
  startingCogs: 230,
  coreIntegrity: 16,
  waves: S3_WAVES,
};

// ---------------------------------------------------------------------------
// Stronghold 4 — "Crossfire" (two lanes merging mid-field)
// ---------------------------------------------------------------------------

const S4_GRID: GridConfig = { cols: 16, rows: 11, tileSize: 44, originX: 0, originY: 0 };
const S4_CORE: GridCoord = { col: 8, row: 10 };
const S4_LANE_A = pathThrough([
  { col: 0, row: 1 },
  { col: 8, row: 1 },
  { col: 8, row: 10 },
]);
const S4_LANE_B = pathThrough([
  { col: 15, row: 1 },
  { col: 8, row: 1 },
  { col: 8, row: 10 },
]);

const S4_WAVES: WaveDef[] = [
  {
    index: 0,
    name: "Converge",
    setupCogs: 0,
    groups: [
      { kind: EnemyKind.Grunt, count: 7, startDelayMs: 500, intervalMs: 700, spawnIndex: 0 },
      { kind: EnemyKind.Grunt, count: 7, startDelayMs: 500, intervalMs: 700, spawnIndex: 1 },
    ],
  },
  {
    index: 1,
    name: "Flank Speed",
    setupCogs: 100,
    groups: [
      { kind: EnemyKind.Skitter, count: 12, startDelayMs: 500, intervalMs: 350, spawnIndex: 0 },
      { kind: EnemyKind.Drifter, count: 6, startDelayMs: 2000, intervalMs: 900, spawnIndex: 1 },
    ],
  },
  {
    index: 2,
    name: "Hardened",
    setupCogs: 130,
    groups: [
      { kind: EnemyKind.Bulwark, count: 4, startDelayMs: 500, intervalMs: 1600, spawnIndex: 0 },
      { kind: EnemyKind.Warden, count: 5, startDelayMs: 1500, intervalMs: 1200, spawnIndex: 1 },
      { kind: EnemyKind.Mender, count: 2, startDelayMs: 5000, intervalMs: 3500, spawnIndex: 0 },
    ],
  },
  {
    index: 3,
    name: "Volatile Convergence",
    setupCogs: 160,
    groups: [
      { kind: EnemyKind.Detonator, count: 6, startDelayMs: 500, intervalMs: 1200, spawnIndex: 0 },
      { kind: EnemyKind.Detonator, count: 6, startDelayMs: 500, intervalMs: 1200, spawnIndex: 1 },
      { kind: EnemyKind.Drifter, count: 8, startDelayMs: 4000, intervalMs: 700, spawnIndex: 0 },
    ],
  },
  {
    index: 4,
    name: "Crossfire Apex",
    setupCogs: 210,
    groups: [
      { kind: EnemyKind.Warden, count: 6, startDelayMs: 500, intervalMs: 1000, spawnIndex: 0 },
      { kind: EnemyKind.Bulwark, count: 6, startDelayMs: 800, intervalMs: 1100, spawnIndex: 1 },
      { kind: EnemyKind.Mender, count: 3, startDelayMs: 5000, intervalMs: 2500, spawnIndex: 0 },
      { kind: EnemyKind.Colossus, count: 1, startDelayMs: 13000, intervalMs: 0, spawnIndex: 1 },
    ],
  },
];

export const STRONGHOLD_4: StrongholdDef = {
  id: "s4",
  name: "Crossfire",
  grid: S4_GRID,
  paths: [S4_LANE_A, S4_LANE_B],
  coreCoord: S4_CORE,
  startingCogs: 250,
  coreIntegrity: 16,
  waves: S4_WAVES,
};

// ---------------------------------------------------------------------------
// Stronghold 5 — "The Bastion Core" (finale: two lanes, relentless mixes)
// ---------------------------------------------------------------------------

const S5_GRID: GridConfig = { cols: 16, rows: 11, tileSize: 44, originX: 0, originY: 0 };
const S5_CORE: GridCoord = { col: 0, row: 5 };
const S5_LANE_A = pathThrough([
  { col: 0, row: 0 },
  { col: 15, row: 0 },
  { col: 15, row: 5 },
  { col: 0, row: 5 },
]);
const S5_LANE_B = pathThrough([
  { col: 0, row: 10 },
  { col: 15, row: 10 },
  { col: 15, row: 5 },
  { col: 0, row: 5 },
]);

const S5_WAVES: WaveDef[] = [
  {
    index: 0,
    name: "Vanguard",
    setupCogs: 0,
    groups: [
      { kind: EnemyKind.Bulwark, count: 4, startDelayMs: 500, intervalMs: 1500, spawnIndex: 0 },
      { kind: EnemyKind.Skitter, count: 10, startDelayMs: 1000, intervalMs: 350, spawnIndex: 1 },
    ],
  },
  {
    index: 1,
    name: "Stormfront",
    setupCogs: 110,
    groups: [
      { kind: EnemyKind.Warden, count: 6, startDelayMs: 500, intervalMs: 900, spawnIndex: 0 },
      { kind: EnemyKind.Drifter, count: 10, startDelayMs: 1000, intervalMs: 700, spawnIndex: 1 },
    ],
  },
  {
    index: 2,
    name: "Detonation Run",
    setupCogs: 150,
    groups: [
      { kind: EnemyKind.Detonator, count: 8, startDelayMs: 500, intervalMs: 900, spawnIndex: 0 },
      { kind: EnemyKind.Detonator, count: 8, startDelayMs: 500, intervalMs: 900, spawnIndex: 1 },
      { kind: EnemyKind.Mender, count: 3, startDelayMs: 4000, intervalMs: 2500, spawnIndex: 0 },
    ],
  },
  {
    index: 3,
    name: "Siege",
    setupCogs: 180,
    groups: [
      { kind: EnemyKind.Bulwark, count: 8, startDelayMs: 500, intervalMs: 1000, spawnIndex: 0 },
      { kind: EnemyKind.Warden, count: 8, startDelayMs: 800, intervalMs: 1000, spawnIndex: 1 },
      { kind: EnemyKind.Mender, count: 3, startDelayMs: 5000, intervalMs: 2500, spawnIndex: 1 },
      { kind: EnemyKind.Colossus, count: 1, startDelayMs: 12000, intervalMs: 0, spawnIndex: 0 },
    ],
  },
  {
    index: 4,
    name: "Last Stand",
    setupCogs: 240,
    groups: [
      { kind: EnemyKind.Skitter, count: 16, startDelayMs: 500, intervalMs: 250, spawnIndex: 0 },
      { kind: EnemyKind.Drifter, count: 10, startDelayMs: 2000, intervalMs: 500, spawnIndex: 1 },
      { kind: EnemyKind.Warden, count: 8, startDelayMs: 5000, intervalMs: 800, spawnIndex: 0 },
      { kind: EnemyKind.Mender, count: 4, startDelayMs: 7000, intervalMs: 2000, spawnIndex: 1 },
      { kind: EnemyKind.Colossus, count: 1, startDelayMs: 14000, intervalMs: 0, spawnIndex: 0 },
      { kind: EnemyKind.Colossus, count: 1, startDelayMs: 17000, intervalMs: 0, spawnIndex: 1 },
    ],
  },
];

export const STRONGHOLD_5: StrongholdDef = {
  id: "s5",
  name: "The Bastion Core",
  grid: S5_GRID,
  paths: [S5_LANE_A, S5_LANE_B],
  coreCoord: S5_CORE,
  startingCogs: 280,
  coreIntegrity: 20,
  waves: S5_WAVES,
};

export const STRONGHOLDS: readonly StrongholdDef[] = [
  STRONGHOLD_1,
  STRONGHOLD_2,
  STRONGHOLD_3,
  STRONGHOLD_4,
  STRONGHOLD_5,
];

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
