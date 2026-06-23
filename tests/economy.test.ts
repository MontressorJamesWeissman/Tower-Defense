import { describe, it, expect } from "vitest";
import {
  createEconomy,
  canAfford,
  spend,
  addCogs,
  addSurge,
  killReward,
  sellRefund,
} from "../src/game/logic/economy";

describe("economy", () => {
  it("creates state with starting cogs and empty surge", () => {
    const e = createEconomy(200);
    expect(e.cogs).toBe(200);
    expect(e.surge).toBe(0);
    expect(e.surgeMax).toBe(100);
  });

  it("spend deducts when affordable and leaves unchanged otherwise", () => {
    const e = createEconomy(100);
    expect(spend(e, 60)).toBe(true);
    expect(e.cogs).toBe(40);
    expect(spend(e, 60)).toBe(false);
    expect(e.cogs).toBe(40);
  });

  it("canAfford reflects exact balance", () => {
    const e = createEconomy(50);
    expect(canAfford(e, 50)).toBe(true);
    expect(canAfford(e, 51)).toBe(false);
  });

  it("addCogs rounds and never goes negative from input", () => {
    const e = createEconomy(0);
    addCogs(e, 12.6);
    expect(e.cogs).toBe(13);
    addCogs(e, -5);
    expect(e.cogs).toBe(13);
  });

  it("surge is clamped to surgeMax", () => {
    const e = createEconomy(0, 100);
    addSurge(e, 70);
    expect(e.surge).toBe(70);
    addSurge(e, 70);
    expect(e.surge).toBe(100);
  });

  it("killReward applies cog and surge multipliers", () => {
    const base = killReward(10);
    expect(base.cogs).toBe(10);
    expect(base.surge).toBe(5);

    const boosted = killReward(10, 1.5, 2);
    expect(boosted.cogs).toBe(15);
    expect(boosted.surge).toBe(10);
  });

  it("sellRefund returns 60% floored", () => {
    expect(sellRefund(100)).toBe(60);
    expect(sellRefund(95)).toBe(57);
  });
});
