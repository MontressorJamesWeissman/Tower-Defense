import { describe, it, expect } from "vitest";
import { buildSpawnSchedule, waveEnemyCount } from "../src/game/logic/waves";
import {
  STRONGHOLD_1,
  STRONGHOLDS,
  buildTileMap,
  getSpawnCoords,
} from "../src/game/logic/strongholds";
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

describe("stronghold layouts (all)", () => {
  it("there are 5 strongholds with escalating wave counts", () => {
    expect(STRONGHOLDS.length).toBe(5);
    for (const sh of STRONGHOLDS) expect(sh.waves.length).toBeGreaterThanOrEqual(4);
  });

  for (const sh of STRONGHOLDS) {
    describe(sh.name, () => {
      it("every path step is orthogonally adjacent", () => {
        for (const path of sh.paths) {
          for (let i = 1; i < path.length; i++) {
            const manhattan =
              Math.abs(path[i].col - path[i - 1].col) + Math.abs(path[i].row - path[i - 1].row);
            expect(manhattan, `${sh.name} step ${i}`).toBe(1);
          }
        }
      });

      it("every path ends at the Core coord", () => {
        const coreK = coordKey(sh.coreCoord);
        for (const path of sh.paths) {
          expect(coordKey(path[path.length - 1])).toBe(coreK);
        }
      });

      it("every path stays in bounds", () => {
        for (const path of sh.paths) {
          for (const c of path) {
            expect(c.col).toBeGreaterThanOrEqual(0);
            expect(c.row).toBeGreaterThanOrEqual(0);
            expect(c.col).toBeLessThan(sh.grid.cols);
            expect(c.row).toBeLessThan(sh.grid.rows);
          }
        }
      });

      it("tile map marks each spawn and the core", () => {
        const map = buildTileMap(sh);
        for (const spawn of getSpawnCoords(sh)) {
          expect(map[spawn.row][spawn.col]).toBe(TileType.Spawn);
        }
        expect(map[sh.coreCoord.row][sh.coreCoord.col]).toBe(TileType.Core);
      });

      it("spawn groups reference valid lane indices", () => {
        for (const wave of sh.waves) {
          for (const g of wave.groups) {
            expect(g.spawnIndex).toBeGreaterThanOrEqual(0);
            expect(g.spawnIndex).toBeLessThan(sh.paths.length);
          }
        }
      });

      it("the final wave contains a boss", () => {
        const last = sh.waves[sh.waves.length - 1];
        const sched = buildSpawnSchedule(last);
        expect(sched.some((s) => s.kind === EnemyKind.Colossus)).toBe(true);
      });
    });
  }
});

describe("stronghold 1 specifics", () => {
  it("core coord is the last coord of the path", () => {
    const path = STRONGHOLD_1.paths[0];
    expect(coordKey(path[path.length - 1])).toBe(coordKey(STRONGHOLD_1.coreCoord));
  });
});
