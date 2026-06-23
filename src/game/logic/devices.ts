// Bastion Protocol — Device definitions, costs, and upgrades.
// Pure data + stat math. No Phaser dependency.

import { Charge } from "./elements";

export enum DeviceCategory {
  Turret = "Turret",
  Trap = "Trap",
  Collector = "Collector",
}

// ---------------------------------------------------------------------------
// Base stats
// ---------------------------------------------------------------------------

export interface TurretStats {
  /** Pixels of targeting range. */
  range: number;
  /** Damage per shot. */
  damage: number;
  /** Milliseconds between shots. */
  cooldownMs: number;
  /** Splash radius (px); 0 = single target. */
  splashRadius: number;
  /** If true, the shot pierces through enemies in a line. */
  pierce: boolean;
  /** Seconds of elemental-resistance reduction applied to the target (0 = none). */
  resistShredMs: number;
}

export interface TrapStats {
  damage: number;
  /** Radius for AoE / pull / pulse effects (px). */
  radius: number;
  /** Pull nearby enemies toward the trap (Snare Coil). */
  pull: boolean;
  /** Periodically drop a mine even without a trigger (Mine Layer). */
  mineLayer: boolean;
  /** Periodically emit a shockwave (Pulse Emitter). */
  pulseEmitter: boolean;
  /** Interval for periodic effects (ms). */
  periodicMs: number;
}

export enum CollectorMode {
  Cog = "Cog",
  Surge = "Surge",
}

export interface CollectorStats {
  radius: number;
  /** Cog reward multiplier for kills in radius (Cog Mode). */
  cogMultiplier: number;
  /** Surge gain multiplier for kills in radius (Surge Mode). */
  surgeMultiplier: number;
}

// ---------------------------------------------------------------------------
// Upgrades
// ---------------------------------------------------------------------------

export enum TurretUpgrade {
  RapidCoil = "RapidCoil",
  WideBlast = "WideBlast",
  FocusLens = "FocusLens",
  PiercingRound = "PiercingRound",
  WeakPointScanner = "WeakPointScanner",
}

export enum TrapUpgrade {
  SnareCoil = "SnareCoil",
  MineLayer = "MineLayer",
  PulseEmitter = "PulseEmitter",
}

export interface UpgradeDef {
  readonly name: string;
  readonly description: string;
  readonly cost: number;
}

export const TURRET_UPGRADES: Readonly<Record<TurretUpgrade, UpgradeDef>> = {
  [TurretUpgrade.RapidCoil]: {
    name: "Rapid Coil",
    description: "Faster fire rate, lower per-hit damage.",
    cost: 40,
  },
  [TurretUpgrade.WideBlast]: {
    name: "Wide Blast",
    description: "Shots splash to nearby enemies.",
    cost: 55,
  },
  [TurretUpgrade.FocusLens]: {
    name: "Focus Lens",
    description: "Single-target damage burst; cancels splash.",
    cost: 55,
  },
  [TurretUpgrade.PiercingRound]: {
    name: "Piercing Round",
    description: "Shots pass through and hit enemies in a line.",
    cost: 60,
  },
  [TurretUpgrade.WeakPointScanner]: {
    name: "Weak Point Scanner",
    description: "Reduces the target's elemental resistance briefly.",
    cost: 50,
  },
};

export const TRAP_UPGRADES: Readonly<Record<TrapUpgrade, UpgradeDef>> = {
  [TrapUpgrade.SnareCoil]: {
    name: "Snare Coil",
    description: "Pulls nearby enemies toward the trap tile.",
    cost: 45,
  },
  [TrapUpgrade.MineLayer]: {
    name: "Mine Layer",
    description: "Periodically drops explosives in its radius.",
    cost: 50,
  },
  [TrapUpgrade.PulseEmitter]: {
    name: "Pulse Emitter",
    description: "Periodically emits a shockwave in its radius.",
    cost: 50,
  },
};

// ---------------------------------------------------------------------------
// Base costs
// ---------------------------------------------------------------------------

export const DEVICE_BASE_COST: Readonly<Record<DeviceCategory, number>> = {
  [DeviceCategory.Turret]: 60,
  [DeviceCategory.Trap]: 50,
  [DeviceCategory.Collector]: 70,
};

// Maximum number of upgrade slots per turret/trap.
export const MAX_TURRET_UPGRADE_SLOTS = 2;
export const MAX_TRAP_UPGRADE_SLOTS = 2;

// ---------------------------------------------------------------------------
// Stat computation
// ---------------------------------------------------------------------------

export function baseTurretStats(): TurretStats {
  return {
    range: 150,
    damage: 22,
    cooldownMs: 700,
    splashRadius: 0,
    pierce: false,
    resistShredMs: 0,
  };
}

/** Apply a set of turret upgrades to base stats, returning new stats. */
export function computeTurretStats(upgrades: readonly TurretUpgrade[]): TurretStats {
  const s = baseTurretStats();
  for (const up of upgrades) {
    switch (up) {
      case TurretUpgrade.RapidCoil:
        s.cooldownMs = Math.round(s.cooldownMs * 0.55);
        s.damage = Math.round(s.damage * 0.7);
        break;
      case TurretUpgrade.WideBlast:
        s.splashRadius = Math.max(s.splashRadius, 56);
        s.damage = Math.round(s.damage * 0.9);
        break;
      case TurretUpgrade.FocusLens:
        s.damage = Math.round(s.damage * 1.8);
        s.splashRadius = 0; // cancels splash
        break;
      case TurretUpgrade.PiercingRound:
        s.pierce = true;
        s.range = Math.round(s.range * 1.15);
        break;
      case TurretUpgrade.WeakPointScanner:
        s.resistShredMs = 3000;
        break;
    }
  }
  return s;
}

export function baseTrapStats(): TrapStats {
  return {
    damage: 30,
    radius: 60,
    pull: false,
    mineLayer: false,
    pulseEmitter: false,
    periodicMs: 1800,
  };
}

export function computeTrapStats(upgrades: readonly TrapUpgrade[]): TrapStats {
  const s = baseTrapStats();
  for (const up of upgrades) {
    switch (up) {
      case TrapUpgrade.SnareCoil:
        s.pull = true;
        break;
      case TrapUpgrade.MineLayer:
        s.mineLayer = true;
        break;
      case TrapUpgrade.PulseEmitter:
        s.pulseEmitter = true;
        break;
    }
  }
  return s;
}

export function collectorStats(mode: CollectorMode): CollectorStats {
  return {
    radius: 110,
    cogMultiplier: mode === CollectorMode.Cog ? 1.5 : 1,
    surgeMultiplier: mode === CollectorMode.Surge ? 2 : 1,
  };
}

/**
 * Total cogs invested in a device given its base category cost and the list of
 * upgrade costs purchased. Used for sell-refund math.
 */
export function totalInvested(category: DeviceCategory, upgradeCosts: readonly number[]): number {
  return DEVICE_BASE_COST[category] + upgradeCosts.reduce((a, b) => a + b, 0);
}

export interface TurretCharge {
  readonly charge: Charge;
}
