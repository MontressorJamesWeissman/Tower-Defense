// Bastion Protocol — Elemental Reaction System.
//
// Data-driven reaction table keyed by an unordered charge pair, so new
// elements/reactions can be added by editing data rather than control flow.
// Every distinct pair of *different* charges resolves to exactly one reaction.

import { Charge } from "./elements";

export enum ReactionKind {
  VaporBurst = "VaporBurst", // Ember + Tide
  ThawSnap = "ThawSnap", // Ember + Frost
  Solidify = "Solidify", // Tide + Frost
  ShortCircuit = "ShortCircuit", // Spark + Frost
  Combust = "Combust", // Ember + Spark
  Vortex = "Vortex", // Gust + any
  FortifyBreak = "FortifyBreak", // Stone + any
  /** Fallback for pairs not covered by a specific rule above. */
  ChargeSwap = "ChargeSwap",
}

export interface ReactionEffect {
  /** Bonus damage applied immediately (flat). */
  readonly bonusDamage: number;
  /** AoE radius (px) for area effects; 0 = single target. */
  readonly aoeRadius: number;
  /** Duration (ms) the enemy is frozen in place. */
  readonly freezeMs: number;
  /** Damage-over-time: total damage spread over durationMs. */
  readonly dotDamage: number;
  readonly dotDurationMs: number;
  /** If true, chains to nearby charged enemies. */
  readonly chains: boolean;
  /** Knockback distance (px); used by wind effects. */
  readonly knockback: number;
  /** Flat shield/armor stripped instantly. */
  readonly shieldStrip: number;
  /**
   * If true, the reaction spreads the *other* (non-Gust) charge to nearby
   * enemies instead of dealing bonus damage (Vortex behaviour).
   */
  readonly spreadsCharge: boolean;
}

export interface ReactionDefinition {
  readonly kind: ReactionKind;
  readonly name: string;
  readonly description: string;
  readonly effect: ReactionEffect;
  /** If true, both contributing charges are removed from the target. */
  readonly consumesBoth: boolean;
}

const NO_EFFECT: ReactionEffect = {
  bonusDamage: 0,
  aoeRadius: 0,
  freezeMs: 0,
  dotDamage: 0,
  dotDurationMs: 0,
  chains: false,
  knockback: 0,
  shieldStrip: 0,
  spreadsCharge: false,
};

function effect(overrides: Partial<ReactionEffect>): ReactionEffect {
  return { ...NO_EFFECT, ...overrides };
}

export const REACTIONS: Readonly<Record<ReactionKind, ReactionDefinition>> = {
  [ReactionKind.VaporBurst]: {
    kind: ReactionKind.VaporBurst,
    name: "Vapor Burst",
    description: "Ember meets Tide — a scalding burst damages all nearby enemies.",
    effect: effect({ bonusDamage: 28, aoeRadius: 64 }),
    consumesBoth: true,
  },
  [ReactionKind.ThawSnap]: {
    kind: ReactionKind.ThawSnap,
    name: "Thaw Snap",
    description: "Ember shatters Frost for heavy single-target damage.",
    effect: effect({ bonusDamage: 52 }),
    consumesBoth: true,
  },
  [ReactionKind.Solidify]: {
    kind: ReactionKind.Solidify,
    name: "Solidify",
    description: "Tide and Frost lock the target in solid ice.",
    effect: effect({ bonusDamage: 8, freezeMs: 1500 }),
    consumesBoth: true,
  },
  [ReactionKind.ShortCircuit]: {
    kind: ReactionKind.ShortCircuit,
    name: "Short-Circuit",
    description: "Spark through Frost arcs to every charged enemy nearby.",
    effect: effect({ bonusDamage: 22, aoeRadius: 90, chains: true }),
    consumesBoth: true,
  },
  [ReactionKind.Combust]: {
    kind: ReactionKind.Combust,
    name: "Combust",
    description: "Ember and Spark ignite a pulsing burn over time.",
    effect: effect({ bonusDamage: 12, dotDamage: 40, dotDurationMs: 3000, aoeRadius: 40 }),
    consumesBoth: true,
  },
  [ReactionKind.Vortex]: {
    kind: ReactionKind.Vortex,
    name: "Vortex",
    description: "Gust spreads the other charge to nearby enemies and nudges them.",
    effect: effect({ aoeRadius: 96, knockback: 24, spreadsCharge: true }),
    // Gust is consumed; the partner charge is spread rather than consumed.
    consumesBoth: false,
  },
  [ReactionKind.FortifyBreak]: {
    kind: ReactionKind.FortifyBreak,
    name: "Fortify Break",
    description: "Stone cracks armor, stripping a chunk of shielding instantly.",
    effect: effect({ bonusDamage: 14, shieldStrip: 60 }),
    consumesBoth: false,
  },
  [ReactionKind.ChargeSwap]: {
    kind: ReactionKind.ChargeSwap,
    name: "Charge Swap",
    description: "The new charge simply overwrites the old one.",
    effect: NO_EFFECT,
    consumesBoth: false,
  },
};

/** Stable key for an unordered pair of charges. */
function pairKey(a: Charge, b: Charge): string {
  return [a, b].sort().join("|");
}

// Specific pair rules. Gust/Stone wildcard pairs are resolved separately.
const SPECIFIC_PAIRS: ReadonlyMap<string, ReactionKind> = new Map([
  [pairKey(Charge.Ember, Charge.Tide), ReactionKind.VaporBurst],
  [pairKey(Charge.Ember, Charge.Frost), ReactionKind.ThawSnap],
  [pairKey(Charge.Tide, Charge.Frost), ReactionKind.Solidify],
  [pairKey(Charge.Spark, Charge.Frost), ReactionKind.ShortCircuit],
  [pairKey(Charge.Ember, Charge.Spark), ReactionKind.Combust],
]);

/**
 * Resolve the reaction for two charges. Order-independent.
 * Returns `null` if the two charges are identical (no reaction — just refresh).
 *
 * Priority: a specific pair rule wins; otherwise Gust → Vortex, Stone →
 * Fortify Break; otherwise the charges simply swap.
 */
export function resolveReaction(a: Charge, b: Charge): ReactionDefinition | null {
  if (a === b) return null;

  const specific = SPECIFIC_PAIRS.get(pairKey(a, b));
  if (specific) return REACTIONS[specific];

  // Wildcard elements. (Gust + Stone is not a specific pair, so it falls here;
  // Gust takes precedence as the dedicated "support/spread" element.)
  if (a === Charge.Gust || b === Charge.Gust) return REACTIONS[ReactionKind.Vortex];
  if (a === Charge.Stone || b === Charge.Stone) return REACTIONS[ReactionKind.FortifyBreak];

  return REACTIONS[ReactionKind.ChargeSwap];
}

/**
 * For Vortex, identify which charge is the partner (the non-Gust one) that
 * gets spread. Returns null if neither is Gust.
 */
export function vortexPartner(a: Charge, b: Charge): Charge | null {
  if (a === Charge.Gust && b !== Charge.Gust) return b;
  if (b === Charge.Gust && a !== Charge.Gust) return a;
  return null;
}
