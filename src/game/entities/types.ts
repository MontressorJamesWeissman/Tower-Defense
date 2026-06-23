// Bastion Protocol — shared interfaces decoupling entities from the scene.

import { Charge } from "../logic/elements";
import { ReactionDefinition } from "../logic/reactions";
import { Point } from "../logic/grid";
import type { Enemy } from "./Enemy";

export interface DamageOptions {
  /** Element carried by the hit (applies a charge / triggers reactions). */
  charge?: Charge | null;
  /** Bypass shield (true damage). */
  ignoreShield?: boolean;
  /** This hit is an AoE/splash hit (ignores evasion). */
  splash?: boolean;
  /** Suppress reaction resolution (used by reaction effects to avoid loops). */
  noReaction?: boolean;
  /** Suppress the floating damage number (dot ticks, secondary AoE, etc.). */
  silent?: boolean;
}

/**
 * Services the scene provides to entities so they can act on the shared world
 * without importing the scene directly.
 */
export interface CombatContext {
  /** Current run-clock time in ms. */
  now(): number;
  enemiesInRadius(x: number, y: number, radius: number): Enemy[];
  livingEnemies(): readonly Enemy[];
  /** Central damage entry point: applies damage, charges, reactions, fx, rewards. */
  hitEnemy(enemy: Enemy, damage: number, opts?: DamageOptions): void;
  /** Apply only a charge (no damage), resolving reactions. */
  chargeEnemy(enemy: Enemy, charge: Charge): void;
  reactionFx(x: number, y: number, reaction: ReactionDefinition): void;
  /** Generic radial burst FX (used by detonations and ability blasts). */
  explosionFx(x: number, y: number, radius: number, color: number): void;
  floatingText(x: number, y: number, text: string, color: string): void;
  /** Cosmetic turret shot: muzzle flash + bolt + impact + shot/impact SFX. */
  turretFire(from: Point, to: Point, charge: Charge): void;
}
