// Bastion Protocol — Support Abilities.
// Pure data + cooldown math. Cooldowns persist across waves within a run.
// No Phaser dependency.

import { Charge } from "./elements";

export enum AbilityKind {
  Cinderfall = "Cinderfall", // Ember
  Maelstrom = "Maelstrom", // Tide
  DeepFreeze = "DeepFreeze", // Frost
  Overcharge = "Overcharge", // Spark
  Cyclone = "Cyclone", // Gust
  Bulwark = "Bulwark", // Stone (strips shields)
}

export interface AbilityDef {
  readonly kind: AbilityKind;
  readonly name: string;
  readonly charge: Charge;
  readonly description: string;
  readonly cooldownMs: number;
  /** True if the ability requires the player to pick a target location. */
  readonly targeted: boolean;
  /** Surge gauge cost to fire (0 = free, cooldown-gated only). */
  readonly surgeCost: number;
  readonly hotkey: string;
  // Tuning payload (interpreted by the combat layer).
  readonly damage: number;
  readonly radius: number;
  readonly durationMs: number;
}

export const ABILITIES: Readonly<Record<AbilityKind, AbilityDef>> = {
  [AbilityKind.Cinderfall]: {
    kind: AbilityKind.Cinderfall,
    name: "Cinderfall",
    charge: Charge.Ember,
    description: "Call down a fiery burst at a target location.",
    cooldownMs: 12000,
    targeted: true,
    surgeCost: 40,
    hotkey: "1",
    damage: 120,
    radius: 90,
    durationMs: 0,
  },
  [AbilityKind.Maelstrom]: {
    kind: AbilityKind.Maelstrom,
    name: "Maelstrom",
    charge: Charge.Tide,
    description: "A lingering zone that slows and damages enemies within.",
    cooldownMs: 16000,
    targeted: true,
    surgeCost: 45,
    hotkey: "2",
    damage: 60,
    radius: 110,
    durationMs: 4000,
  },
  [AbilityKind.DeepFreeze]: {
    kind: AbilityKind.DeepFreeze,
    name: "Deep Freeze",
    charge: Charge.Frost,
    description: "Freeze every enemy on the field for ~2s.",
    cooldownMs: 30000,
    targeted: false,
    surgeCost: 70,
    hotkey: "3",
    damage: 0,
    radius: 0,
    durationMs: 2000,
  },
  [AbilityKind.Overcharge]: {
    kind: AbilityKind.Overcharge,
    name: "Overcharge",
    charge: Charge.Spark,
    description: "Chain damage across all charged enemies on the field.",
    cooldownMs: 20000,
    targeted: false,
    surgeCost: 55,
    hotkey: "4",
    damage: 80,
    radius: 0,
    durationMs: 0,
  },
  [AbilityKind.Cyclone]: {
    kind: AbilityKind.Cyclone,
    name: "Cyclone",
    charge: Charge.Gust,
    description: "Knock back enemies and re-apply Vortex spread over a wide area.",
    cooldownMs: 18000,
    targeted: true,
    surgeCost: 40,
    hotkey: "5",
    damage: 20,
    radius: 160,
    durationMs: 0,
  },
  [AbilityKind.Bulwark]: {
    kind: AbilityKind.Bulwark,
    name: "Bulwark",
    charge: Charge.Stone,
    description: "Instantly strip shields from all enemies on the field.",
    cooldownMs: 24000,
    targeted: false,
    surgeCost: 50,
    hotkey: "6",
    damage: 0,
    radius: 0,
    durationMs: 0,
  },
};

export const ALL_ABILITIES: readonly AbilityKind[] = [
  AbilityKind.Cinderfall,
  AbilityKind.Maelstrom,
  AbilityKind.DeepFreeze,
  AbilityKind.Overcharge,
  AbilityKind.Cyclone,
  AbilityKind.Bulwark,
];

/** Per-ability cooldown tracker. readyAtMs is an absolute run-clock timestamp. */
export interface CooldownState {
  readyAtMs: number;
}

export function isReady(state: CooldownState, nowMs: number): boolean {
  return nowMs >= state.readyAtMs;
}

export function remainingCooldownMs(state: CooldownState, nowMs: number): number {
  return Math.max(0, state.readyAtMs - nowMs);
}

/** Fraction of cooldown elapsed in [0,1] for UI sweep rendering. */
export function cooldownProgress(
  state: CooldownState,
  nowMs: number,
  cooldownMs: number,
): number {
  if (cooldownMs <= 0) return 1;
  const remaining = remainingCooldownMs(state, nowMs);
  return 1 - remaining / cooldownMs;
}

export function triggerCooldown(state: CooldownState, nowMs: number, cooldownMs: number): void {
  state.readyAtMs = nowMs + cooldownMs;
}
