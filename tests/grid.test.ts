import { describe, it, expect } from "vitest";
import {
  GridConfig,
  tileCenter,
  pointToCoord,
  pathToWaypoints,
  pathLength,
  positionAlongPath,
} from "../src/game/logic/grid";

const cfg: GridConfig = { cols: 10, rows: 8, tileSize: 40, originX: 0, originY: 0 };

describe("grid math", () => {
  it("computes tile centers", () => {
    expect(tileCenter(cfg, { col: 0, row: 0 })).toEqual({ x: 20, y: 20 });
    expect(tileCenter(cfg, { col: 2, row: 1 })).toEqual({ x: 100, y: 60 });
  });

  it("round-trips a point to its coord", () => {
    const c = pointToCoord(cfg, { x: 100, y: 60 });
    expect(c).toEqual({ col: 2, row: 1 });
  });

  it("returns null for out-of-bounds points", () => {
    expect(pointToCoord(cfg, { x: -5, y: 10 })).toBeNull();
    expect(pointToCoord(cfg, { x: 9999, y: 10 })).toBeNull();
  });

  it("measures path length over waypoints", () => {
    const wp = pathToWaypoints(cfg, [
      { col: 0, row: 0 },
      { col: 3, row: 0 },
    ]);
    expect(pathLength(wp)).toBe(120); // 3 tiles * 40px
  });

  it("interpolates a position partway along a path", () => {
    const wp = pathToWaypoints(cfg, [
      { col: 0, row: 0 },
      { col: 3, row: 0 },
    ]);
    const r = positionAlongPath(wp, 60);
    expect(r.pos.x).toBeCloseTo(80);
    expect(r.pos.y).toBeCloseTo(20);
    expect(r.reachedEnd).toBe(false);
  });

  it("reports reachedEnd once travelled exceeds total length", () => {
    const wp = pathToWaypoints(cfg, [
      { col: 0, row: 0 },
      { col: 3, row: 0 },
    ]);
    const r = positionAlongPath(wp, 1000);
    expect(r.reachedEnd).toBe(true);
    expect(r.pos).toEqual(wp[wp.length - 1]);
  });
});
