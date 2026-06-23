import { describe, it, expect } from "vitest";
import { ALL_CHARGES, Charge } from "../src/game/logic/elements";
import {
  resolveReaction,
  vortexPartner,
  ReactionKind,
  REACTIONS,
} from "../src/game/logic/reactions";

describe("reaction table", () => {
  it("returns null for identical charges (no reaction, just refresh)", () => {
    for (const c of ALL_CHARGES) {
      expect(resolveReaction(c, c)).toBeNull();
    }
  });

  it("resolves every distinct charge pair to exactly one reaction", () => {
    for (const a of ALL_CHARGES) {
      for (const b of ALL_CHARGES) {
        if (a === b) continue;
        const r = resolveReaction(a, b);
        expect(r, `${a}+${b}`).not.toBeNull();
        expect(Object.values(ReactionKind)).toContain(r!.kind);
      }
    }
  });

  it("is order-independent: resolveReaction(a,b) === resolveReaction(b,a)", () => {
    for (const a of ALL_CHARGES) {
      for (const b of ALL_CHARGES) {
        if (a === b) continue;
        expect(resolveReaction(a, b)!.kind, `${a}+${b}`).toBe(resolveReaction(b, a)!.kind);
      }
    }
  });

  it("maps the named specific pairs correctly", () => {
    expect(resolveReaction(Charge.Ember, Charge.Tide)!.kind).toBe(ReactionKind.VaporBurst);
    expect(resolveReaction(Charge.Ember, Charge.Frost)!.kind).toBe(ReactionKind.ThawSnap);
    expect(resolveReaction(Charge.Tide, Charge.Frost)!.kind).toBe(ReactionKind.Solidify);
    expect(resolveReaction(Charge.Spark, Charge.Frost)!.kind).toBe(ReactionKind.ShortCircuit);
    expect(resolveReaction(Charge.Ember, Charge.Spark)!.kind).toBe(ReactionKind.Combust);
  });

  it("treats Gust as a wildcard Vortex with any non-specific partner", () => {
    for (const c of ALL_CHARGES) {
      if (c === Charge.Gust) continue;
      expect(resolveReaction(Charge.Gust, c)!.kind, `Gust+${c}`).toBe(ReactionKind.Vortex);
    }
  });

  it("Gust takes precedence over Stone (Gust+Stone is Vortex, not Fortify Break)", () => {
    expect(resolveReaction(Charge.Gust, Charge.Stone)!.kind).toBe(ReactionKind.Vortex);
  });

  it("treats Stone as Fortify Break with non-Gust, non-specific partners", () => {
    expect(resolveReaction(Charge.Stone, Charge.Tide)!.kind).toBe(ReactionKind.FortifyBreak);
    expect(resolveReaction(Charge.Stone, Charge.Spark)!.kind).toBe(ReactionKind.FortifyBreak);
    expect(resolveReaction(Charge.Stone, Charge.Frost)!.kind).toBe(ReactionKind.FortifyBreak);
    expect(resolveReaction(Charge.Stone, Charge.Ember)!.kind).toBe(ReactionKind.FortifyBreak);
  });

  it("identifies the vortex partner (the non-Gust charge)", () => {
    expect(vortexPartner(Charge.Gust, Charge.Ember)).toBe(Charge.Ember);
    expect(vortexPartner(Charge.Frost, Charge.Gust)).toBe(Charge.Frost);
    expect(vortexPartner(Charge.Ember, Charge.Frost)).toBeNull();
    expect(vortexPartner(Charge.Gust, Charge.Gust)).toBeNull();
  });

  it("Vortex spreads charge rather than dealing bonus damage", () => {
    const v = REACTIONS[ReactionKind.Vortex];
    expect(v.effect.spreadsCharge).toBe(true);
    expect(v.effect.bonusDamage).toBe(0);
  });

  it("Solidify freezes the target", () => {
    expect(REACTIONS[ReactionKind.Solidify].effect.freezeMs).toBeGreaterThan(0);
  });

  it("Fortify Break strips shield", () => {
    expect(REACTIONS[ReactionKind.FortifyBreak].effect.shieldStrip).toBeGreaterThan(0);
  });

  it("every ReactionKind has a definition entry", () => {
    for (const kind of Object.values(ReactionKind)) {
      expect(REACTIONS[kind]).toBeDefined();
      expect(REACTIONS[kind].kind).toBe(kind);
    }
  });
});
