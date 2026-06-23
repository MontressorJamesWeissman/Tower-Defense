// Bastion Protocol — Grid & Path math.
// Pure geometry for a tile grid, buildable tiles, and enemy paths.
// No Phaser dependency.

export interface GridCoord {
  readonly col: number;
  readonly row: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export enum TileType {
  /** Empty, non-buildable scenery. */
  Blocked = "Blocked",
  /** Buildable tile for Turret and Collector devices. */
  Buildable = "Buildable",
  /** Part of the enemy path; Trap devices may be placed here. */
  Path = "Path",
  /** The Core tile (path endpoint). */
  Core = "Core",
  /** An enemy spawn tile (path start). */
  Spawn = "Spawn",
}

export interface GridConfig {
  readonly cols: number;
  readonly rows: number;
  readonly tileSize: number;
  /** Pixel offset of the grid's top-left corner within the scene. */
  readonly originX: number;
  readonly originY: number;
}

export function tileCenter(cfg: GridConfig, coord: GridCoord): Point {
  return {
    x: cfg.originX + coord.col * cfg.tileSize + cfg.tileSize / 2,
    y: cfg.originY + coord.row * cfg.tileSize + cfg.tileSize / 2,
  };
}

export function pointToCoord(cfg: GridConfig, p: Point): GridCoord | null {
  const col = Math.floor((p.x - cfg.originX) / cfg.tileSize);
  const row = Math.floor((p.y - cfg.originY) / cfg.tileSize);
  if (col < 0 || row < 0 || col >= cfg.cols || row >= cfg.rows) return null;
  return { col, row };
}

export function coordKey(coord: GridCoord): string {
  return `${coord.col},${coord.row}`;
}

export function coordsEqual(a: GridCoord, b: GridCoord): boolean {
  return a.col === b.col && a.row === b.row;
}

/** Distance between two pixel points. */
export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Convert a path (ordered list of grid coords) into pixel waypoints at tile
 * centers, which enemies follow.
 */
export function pathToWaypoints(cfg: GridConfig, path: readonly GridCoord[]): Point[] {
  return path.map((c) => tileCenter(cfg, c));
}

/** Total pixel length of a waypoint path. */
export function pathLength(waypoints: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < waypoints.length; i++) {
    total += distance(waypoints[i - 1], waypoints[i]);
  }
  return total;
}

/**
 * Given a set of waypoints and a distance travelled along the path, return the
 * interpolated pixel position and whether the end was reached.
 */
export function positionAlongPath(
  waypoints: readonly Point[],
  travelled: number,
): { pos: Point; reachedEnd: boolean } {
  if (waypoints.length === 0) return { pos: { x: 0, y: 0 }, reachedEnd: true };
  if (travelled <= 0) return { pos: waypoints[0], reachedEnd: false };

  let remaining = travelled;
  for (let i = 1; i < waypoints.length; i++) {
    const seg = distance(waypoints[i - 1], waypoints[i]);
    if (remaining <= seg) {
      const t = seg === 0 ? 0 : remaining / seg;
      return {
        pos: {
          x: waypoints[i - 1].x + (waypoints[i].x - waypoints[i - 1].x) * t,
          y: waypoints[i - 1].y + (waypoints[i].y - waypoints[i - 1].y) * t,
        },
        reachedEnd: false,
      };
    }
    remaining -= seg;
  }
  return { pos: waypoints[waypoints.length - 1], reachedEnd: true };
}
