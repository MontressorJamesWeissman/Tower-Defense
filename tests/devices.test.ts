import { describe, it, expect } from "vitest";
import {
  baseTurretStats,
  computeTurretStats,
  computeTrapStats,
  collectorStats,
  totalInvested,
  TurretUpgrade,
  TrapUpgrade,
  CollectorMode,
  DeviceCategory,
  DEVICE_BASE_COST,
} from "../src/game/logic/devices";

describe("turret stats", () => {
  it("Rapid Coil lowers cooldown and per-hit damage", () => {
    const base = baseTurretStats();
    const s = computeTurretStats([TurretUpgrade.RapidCoil]);
    expect(s.cooldownMs).toBeLessThan(base.cooldownMs);
    expect(s.damage).toBeLessThan(base.damage);
  });

  it("Wide Blast grants splash; Focus Lens removes it and boosts damage", () => {
    const wide = computeTurretStats([TurretUpgrade.WideBlast]);
    expect(wide.splashRadius).toBeGreaterThan(0);

    const focus = computeTurretStats([TurretUpgrade.FocusLens]);
    expect(focus.splashRadius).toBe(0);
    expect(focus.damage).toBeGreaterThan(baseTurretStats().damage);
  });

  it("Focus Lens after Wide Blast cancels the splash", () => {
    const s = computeTurretStats([TurretUpgrade.WideBlast, TurretUpgrade.FocusLens]);
    expect(s.splashRadius).toBe(0);
  });

  it("Piercing Round enables pierce", () => {
    expect(computeTurretStats([TurretUpgrade.PiercingRound]).pierce).toBe(true);
  });

  it("Weak Point Scanner sets resist shred duration", () => {
    expect(computeTurretStats([TurretUpgrade.WeakPointScanner]).resistShredMs).toBeGreaterThan(0);
  });
});

describe("trap stats", () => {
  it("upgrades set their respective behaviour flags", () => {
    expect(computeTrapStats([TrapUpgrade.SnareCoil]).pull).toBe(true);
    expect(computeTrapStats([TrapUpgrade.MineLayer]).mineLayer).toBe(true);
    expect(computeTrapStats([TrapUpgrade.PulseEmitter]).pulseEmitter).toBe(true);
  });
});

describe("collector stats", () => {
  it("Cog mode boosts cog multiplier; Surge mode boosts surge multiplier", () => {
    const cog = collectorStats(CollectorMode.Cog);
    expect(cog.cogMultiplier).toBeGreaterThan(1);
    expect(cog.surgeMultiplier).toBe(1);

    const surge = collectorStats(CollectorMode.Surge);
    expect(surge.surgeMultiplier).toBeGreaterThan(1);
    expect(surge.cogMultiplier).toBe(1);
  });
});

describe("investment math", () => {
  it("sums base cost plus upgrade costs", () => {
    expect(totalInvested(DeviceCategory.Turret, [40, 55])).toBe(
      DEVICE_BASE_COST[DeviceCategory.Turret] + 95,
    );
  });
});
