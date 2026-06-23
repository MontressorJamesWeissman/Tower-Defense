import { describe, it, expect, beforeEach } from "vitest";
import { Charge } from "../src/game/logic/elements";
import { ReactionKind } from "../src/game/logic/reactions";
import {
  EnemyCombatState,
  takeDamage,
  applyCharge,
  applyFreeze,
  isFrozen,
  stripShield,
  RESIST_SHRED_MULT,
  applyResistShred,
} from "../src/game/logic/combat";

function makeEnemy(overrides: Partial<EnemyCombatState> = {}): EnemyCombatState {
  return {
    hp: 100,
    maxHp: 100,
    shield: 0,
    immuneTo: null,
    activeCharge: null,
    activeChargeExpiresMs: 0,
    frozenUntilMs: 0,
    resistShredUntilMs: 0,
    ...overrides,
  };
}

describe("damage & shields", () => {
  it("damages HP directly with no shield", () => {
    const e = makeEnemy();
    const r = takeDamage(e, 30, 0);
    expect(r.hpDamage).toBe(30);
    expect(e.hp).toBe(70);
    expect(r.killed).toBe(false);
  });

  it("shield absorbs before HP", () => {
    const e = makeEnemy({ shield: 20 });
    const r = takeDamage(e, 30, 0);
    expect(r.shieldAbsorbed).toBe(20);
    expect(r.hpDamage).toBe(10);
    expect(e.shield).toBe(0);
    expect(e.hp).toBe(90);
  });

  it("ignoreShield bypasses armor", () => {
    const e = makeEnemy({ shield: 50 });
    const r = takeDamage(e, 30, 0, true);
    expect(r.shieldAbsorbed).toBe(0);
    expect(e.hp).toBe(70);
    expect(e.shield).toBe(50);
  });

  it("reports a kill when HP hits zero", () => {
    const e = makeEnemy({ hp: 25 });
    expect(takeDamage(e, 30, 0).killed).toBe(true);
    expect(e.hp).toBe(0);
  });

  it("resist shred multiplies incoming damage", () => {
    const e = makeEnemy({ hp: 300, maxHp: 300, resistShredUntilMs: 1000 });
    const r = takeDamage(e, 100, 500);
    expect(r.hpDamage).toBe(100 * RESIST_SHRED_MULT);
  });

  it("stripShield removes up to the available shield", () => {
    const e = makeEnemy({ shield: 40 });
    expect(stripShield(e, 60)).toBe(40);
    expect(e.shield).toBe(0);
  });
});

describe("charge application & reactions", () => {
  it("applies a charge to an uncharged enemy with no reaction", () => {
    const e = makeEnemy();
    const r = applyCharge(e, Charge.Ember, 0);
    expect(r.reaction).toBeNull();
    expect(r.applied).toBe(true);
    expect(e.activeCharge).toBe(Charge.Ember);
  });

  it("does nothing to an immune enemy", () => {
    const e = makeEnemy({ immuneTo: Charge.Spark });
    const r = applyCharge(e, Charge.Spark, 0);
    expect(r.applied).toBe(false);
    expect(e.activeCharge).toBeNull();
  });

  it("refreshes when the same charge is reapplied", () => {
    const e = makeEnemy({ activeCharge: Charge.Frost, activeChargeExpiresMs: 1000 });
    const r = applyCharge(e, Charge.Frost, 500);
    expect(r.reaction).toBeNull();
    expect(e.activeChargeExpiresMs).toBeGreaterThan(1000);
  });

  it("triggers a consuming reaction and clears the charge", () => {
    const e = makeEnemy({ activeCharge: Charge.Ember, activeChargeExpiresMs: 5000 });
    const r = applyCharge(e, Charge.Tide, 100); // Vapor Burst
    expect(r.reaction!.kind).toBe(ReactionKind.VaporBurst);
    expect(e.activeCharge).toBeNull();
  });

  it("treats an expired charge as no charge (no reaction)", () => {
    const e = makeEnemy({ activeCharge: Charge.Ember, activeChargeExpiresMs: 50 });
    const r = applyCharge(e, Charge.Tide, 100);
    expect(r.reaction).toBeNull();
    expect(e.activeCharge).toBe(Charge.Tide);
  });

  it("Vortex leaves the partner charge active for chaining", () => {
    const e = makeEnemy({ activeCharge: Charge.Ember, activeChargeExpiresMs: 5000 });
    const r = applyCharge(e, Charge.Gust, 100);
    expect(r.reaction!.kind).toBe(ReactionKind.Vortex);
    expect(r.spreadCharge).toBe(Charge.Ember);
    expect(e.activeCharge).toBe(Charge.Ember);
  });

  it("Fortify Break overwrites with the incoming charge", () => {
    const e = makeEnemy({ activeCharge: Charge.Tide, activeChargeExpiresMs: 5000 });
    const r = applyCharge(e, Charge.Stone, 100);
    expect(r.reaction!.kind).toBe(ReactionKind.FortifyBreak);
    expect(e.activeCharge).toBe(Charge.Stone);
  });
});

describe("freeze", () => {
  let e: EnemyCombatState;
  beforeEach(() => {
    e = makeEnemy();
  });

  it("freezes for the given duration and reports frozen state", () => {
    applyFreeze(e, 1500, 1000);
    expect(isFrozen(e, 2000)).toBe(true);
    expect(isFrozen(e, 2600)).toBe(false);
  });

  it("takes the longer of overlapping freezes", () => {
    applyFreeze(e, 1000, 0);
    applyFreeze(e, 500, 0);
    expect(e.frozenUntilMs).toBe(1000);
  });
});

describe("resist shred timing", () => {
  it("extends the shred window to the later expiry", () => {
    const e = makeEnemy();
    applyResistShred(e, 1000, 0);
    applyResistShred(e, 500, 0);
    expect(e.resistShredUntilMs).toBe(1000);
  });
});
