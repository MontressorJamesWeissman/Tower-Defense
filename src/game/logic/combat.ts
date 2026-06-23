// Bastion Protocol — Combat resolution (pure).
// Operates on plain enemy-combat state so damage, shields, charges, and
// reactions are all unit-testable without Phaser.

import { Charge, CHARGE_DECAY_MS } from "./elements";
import { ReactionDefinition, resolveReaction, vortexPartner, ReactionKind } from "./reactions";

export interface EnemyCombatState {
  hp: number;
  maxHp: number;
  shield: number;
  immuneTo: Charge | null;
  /** Charge currently on the enemy, or null. */
  activeCharge: Charge | null;
  /** Run-clock time (ms) at which the active charge decays. */
  activeChargeExpiresMs: number;
  /** Run-clock time (ms) until which the enemy cannot move. */
  frozenUntilMs: number;
  /** Run-clock time (ms) until which the enemy takes extra damage (resist shred). */
  resistShredUntilMs: number;
}

/** Extra damage multiplier while a target's resistance is shredded. */
export const RESIST_SHRED_MULT = 1.3;

export interface DamageResult {
  /** Damage actually applied to HP (after shield + multipliers). */
  hpDamage: number;
  /** Amount absorbed by shield. */
  shieldAbsorbed: number;
  killed: boolean;
}

export function isFrozen(state: EnemyCombatState, nowMs: number): boolean {
  return nowMs < state.frozenUntilMs;
}

export function hasActiveCharge(state: EnemyCombatState, nowMs: number): boolean {
  return state.activeCharge !== null && nowMs < state.activeChargeExpiresMs;
}

/**
 * Apply raw damage to an enemy. Shield absorbs first, then HP. Resist-shred
 * multiplies the incoming amount. `ignoreShield` lets true-damage effects skip
 * armor. Mutates `state`.
 */
export function takeDamage(
  state: EnemyCombatState,
  raw: number,
  nowMs: number,
  ignoreShield = false,
): DamageResult {
  if (raw <= 0 || state.hp <= 0) {
    return { hpDamage: 0, shieldAbsorbed: 0, killed: false };
  }
  let amount = raw;
  if (nowMs < state.resistShredUntilMs) amount *= RESIST_SHRED_MULT;

  let shieldAbsorbed = 0;
  if (!ignoreShield && state.shield > 0) {
    shieldAbsorbed = Math.min(state.shield, amount);
    state.shield -= shieldAbsorbed;
    amount -= shieldAbsorbed;
  }

  const hpDamage = Math.min(state.hp, amount);
  state.hp -= hpDamage;
  return { hpDamage, shieldAbsorbed, killed: state.hp <= 0 };
}

export function stripShield(state: EnemyCombatState, amount: number): number {
  const stripped = Math.min(state.shield, amount);
  state.shield -= stripped;
  return stripped;
}

export interface ChargeApplication {
  /** The reaction triggered, if any. */
  reaction: ReactionDefinition | null;
  /** For Vortex: the partner charge that should be spread to nearby enemies. */
  spreadCharge: Charge | null;
  /** True if a charge was newly applied/refreshed (no reaction). */
  applied: boolean;
}

/**
 * Apply an incoming charge to an enemy, resolving a reaction if a *different*
 * charge is already active. Mutates `state.activeCharge` accordingly.
 *
 * - Immune charge: nothing happens.
 * - No/expired active charge: the incoming charge is set, no reaction.
 * - Same active charge: timer refreshed, no reaction.
 * - Different active charge: reaction resolves. Consuming reactions clear the
 *   charge; Vortex leaves the spread partner active; others swap to the
 *   incoming charge.
 */
export function applyCharge(
  state: EnemyCombatState,
  incoming: Charge,
  nowMs: number,
): ChargeApplication {
  if (state.immuneTo === incoming) {
    return { reaction: null, spreadCharge: null, applied: false };
  }

  const expiry = nowMs + CHARGE_DECAY_MS;

  if (!hasActiveCharge(state, nowMs)) {
    state.activeCharge = incoming;
    state.activeChargeExpiresMs = expiry;
    return { reaction: null, spreadCharge: null, applied: true };
  }

  const existing = state.activeCharge as Charge;
  if (existing === incoming) {
    state.activeChargeExpiresMs = expiry; // refresh
    return { reaction: null, spreadCharge: null, applied: true };
  }

  const reaction = resolveReaction(existing, incoming);
  if (!reaction) {
    // Defensive: identical handled above, so this shouldn't occur.
    state.activeCharge = incoming;
    state.activeChargeExpiresMs = expiry;
    return { reaction: null, spreadCharge: null, applied: true };
  }

  let spreadCharge: Charge | null = null;
  if (reaction.kind === ReactionKind.Vortex) {
    spreadCharge = vortexPartner(existing, incoming);
    // Gust is consumed; the partner charge lingers so it can still react.
    state.activeCharge = spreadCharge;
    state.activeChargeExpiresMs = expiry;
  } else if (reaction.consumesBoth) {
    state.activeCharge = null;
  } else {
    // Fortify Break / Charge Swap: the new charge overwrites.
    state.activeCharge = incoming;
    state.activeChargeExpiresMs = expiry;
  }

  return { reaction, spreadCharge, applied: false };
}

/** Apply a freeze, taking the longer of the existing or new freeze window. */
export function applyFreeze(state: EnemyCombatState, durationMs: number, nowMs: number): void {
  state.frozenUntilMs = Math.max(state.frozenUntilMs, nowMs + durationMs);
}

export function applyResistShred(state: EnemyCombatState, durationMs: number, nowMs: number): void {
  state.resistShredUntilMs = Math.max(state.resistShredUntilMs, nowMs + durationMs);
}
