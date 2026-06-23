// Bastion Protocol — Enemy archetype definitions.
// Pure data describing the 8 archetypes and their special behaviours.
// No Phaser dependency.

import { Charge } from "./elements";

export enum EnemyKind {
  Grunt = "Grunt",
  Skitter = "Skitter", // fast/light, hard to hit
  Bulwark = "Bulwark", // armored, has shield
  Detonator = "Detonator", // builds meter, explodes
  Mender = "Mender", // heals nearby allies
  Drifter = "Drifter", // flying / elevated (traps can't hit)
  Warden = "Warden", // immune to a specific charge
  Colossus = "Colossus", // miniboss, self-shields
}

export interface EnemyDef {
  readonly kind: EnemyKind;
  readonly name: string;
  readonly maxHp: number;
  /** Flat shield absorbed before HP takes damage. */
  readonly shield: number;
  /** Pixels per second along the path. */
  readonly speed: number;
  /** Cog value on death. */
  readonly bounty: number;
  /** Core integrity damage when it breaches. */
  readonly breachDamage: number;
  /** Visual tint. */
  readonly color: number;
  readonly radius: number;

  // --- Special behaviour flags ---
  /** Chance [0,1] to dodge a non-splash projectile (rewards AoE turrets). */
  readonly evasion: number;
  /** Can only be hit by Turrets, not Traps. */
  readonly flying: boolean;
  /** Charge this enemy is fully immune to (no damage, no status). */
  readonly immuneTo: Charge | null;
  /** Heals nearby allies for this much per tick. */
  readonly healPerTick: number;
  readonly healRadius: number;
  /** Builds a detonation meter; explodes for explosionDamage in radius. */
  readonly detonates: boolean;
  readonly explosionDamage: number;
  readonly explosionRadius: number;
  /** Charge that fills the detonation meter faster (and Core-damages allies). */
  readonly detonationCatalyst: Charge | null;
  /** Periodically re-shields by this amount (miniboss). */
  readonly reshieldAmount: number;
  readonly reshieldIntervalMs: number;
  readonly isBoss: boolean;
}

const DEFAULTS = {
  shield: 0,
  evasion: 0,
  flying: false,
  immuneTo: null,
  healPerTick: 0,
  healRadius: 0,
  detonates: false,
  explosionDamage: 0,
  explosionRadius: 0,
  detonationCatalyst: null,
  reshieldAmount: 0,
  reshieldIntervalMs: 0,
  isBoss: false,
} as const;

export const ENEMY_DEFS: Readonly<Record<EnemyKind, EnemyDef>> = {
  [EnemyKind.Grunt]: {
    ...DEFAULTS,
    kind: EnemyKind.Grunt,
    name: "Grunt",
    maxHp: 90,
    speed: 55,
    bounty: 8,
    breachDamage: 1,
    color: 0x9aa7b5,
    radius: 13,
  },
  [EnemyKind.Skitter]: {
    ...DEFAULTS,
    kind: EnemyKind.Skitter,
    name: "Skitter",
    maxHp: 50,
    speed: 110,
    bounty: 7,
    breachDamage: 1,
    color: 0xe07be0,
    radius: 9,
    evasion: 0.35,
  },
  [EnemyKind.Bulwark]: {
    ...DEFAULTS,
    kind: EnemyKind.Bulwark,
    name: "Bulwark",
    maxHp: 160,
    shield: 120,
    speed: 42,
    bounty: 16,
    breachDamage: 2,
    color: 0x7d8aa0,
    radius: 16,
  },
  [EnemyKind.Detonator]: {
    ...DEFAULTS,
    kind: EnemyKind.Detonator,
    name: "Detonator",
    maxHp: 110,
    speed: 60,
    bounty: 12,
    breachDamage: 2,
    color: 0xff5a3c,
    radius: 14,
    detonates: true,
    explosionDamage: 45,
    explosionRadius: 70,
    detonationCatalyst: Charge.Ember, // Ember fills its meter faster
  },
  [EnemyKind.Mender]: {
    ...DEFAULTS,
    kind: EnemyKind.Mender,
    name: "Mender",
    maxHp: 130,
    speed: 50,
    bounty: 18,
    breachDamage: 1,
    color: 0x5ad17a,
    radius: 13,
    healPerTick: 10,
    healRadius: 120,
  },
  [EnemyKind.Drifter]: {
    ...DEFAULTS,
    kind: EnemyKind.Drifter,
    name: "Drifter",
    maxHp: 80,
    speed: 70,
    bounty: 14,
    breachDamage: 2,
    color: 0xb7e3ff,
    radius: 12,
    flying: true,
  },
  [EnemyKind.Warden]: {
    ...DEFAULTS,
    kind: EnemyKind.Warden,
    name: "Warden",
    maxHp: 140,
    speed: 48,
    bounty: 16,
    breachDamage: 2,
    color: 0xffe14f,
    radius: 14,
    immuneTo: Charge.Spark, // forces turret diversity
  },
  [EnemyKind.Colossus]: {
    ...DEFAULTS,
    kind: EnemyKind.Colossus,
    name: "Colossus",
    maxHp: 900,
    shield: 200,
    speed: 32,
    bounty: 120,
    breachDamage: 6,
    color: 0xc04060,
    radius: 24,
    reshieldAmount: 200,
    reshieldIntervalMs: 6000,
    isBoss: true,
  },
};

/** How much faster the detonation catalyst charge fills the meter (multiplier). */
export const DETONATION_CATALYST_MULT = 3;

/** Mender heal tick interval (ms). */
export const MENDER_HEAL_INTERVAL_MS = 1000;
