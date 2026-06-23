import { describe, it, expect } from "vitest";
import { buildSpawnSchedule, waveEnemyCount } from "../src/game/logic/waves";
import { STRONGHOLD_1, buildTileMap, getSpawnCoords } from "../src/game/logic/strongholds";
import { TileType, coordKey } from "../src/game/logic/grid";
import { EnemyKind } from "../src/game/logic/enemies";

describe("wave schedules", () => {
  it("counts all enemies in a wave", () => {
    const w = STRONGHOLD_1.waves[0];
    expect(waveEnemyCount(w)).toBe(8);
  });

  it("produces a time-sorted spawn schedule of the right length", () => {
    for (const wave of STRONGHOLD_1.waves) {
      const sched = buildSpawnSchedule(wave);
      expect(sched.length).toBe(waveEnemyCount(wave));
      for (let i = 1; i < sched.length; i++) {
        expect(sched[i].timeMs).toBeGreaterThanOrEqual(sched[i - 1].timeMs);
      }
    }
  });

  it("the final wave contains exactly one Colossus boss", () => {
    const last = STRONGHOLD_1.waves[STRONGHOLD_1.waves.length - 1];
    const sched = buildSpawnSchedule(last);
    const bosses = sched.filter((s) => s.kind === EnemyKind.Colossus);
    expect(bosses.length).toBe(1);
  });
});

describe("stronghold layout", () => {
  it("path is continuous (each step is orthogonally adjacent)", () => {
    for (const path of STRONGHOLD_1.paths) {
      for (let i = 1; i < path.length; i++) {
        const manhattan =
          Math.abs(path[i].col - path[i - 1].col) + Math.abs(path[i].row - path[i - 1].row);
        expect(manhattan).toBe(1);
      }
    }
  });

  it("tile map marks spawn, core, and path tiles", () => {
    const map = buildTileMap(STRONGHOLD_1);
    const spawn = getSpawnCoords(STRONGHOLD_1)[0];
    expect(map[spawn.row][spawn.col]).toBe(TileType.Spawn);
    expect(map[STRONGHOLD_1.coreCoord.row][STRONGHOLD_1.coreCoord.col]).toBe(TileType.Core);

    // Every non-spawn/core path coord should be a Path tile.
    const coreK = coordKey(STRONGHOLD_1.coreCoord);
    const path = STRONGHOLD_1.paths[0];
    for (let i = 1; i < path.length; i++) {
      if (coordKey(path[i]) === coreK) continue;
      expect(map[path[i].row][path[i].col]).toBe(TileType.Path);
    }
  });

  it("core coord is the last coord of the path", () => {
    const path = STRONGHOLD_1.paths[0];
    expect(coordKey(path[path.length - 1])).toBe(coordKey(STRONGHOLD_1.coreCoord));
  });
});
