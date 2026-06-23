// Bastion Protocol — run-wide mutable state for a Stronghold attempt.

import { EconomyState, createEconomy } from "../logic/economy";
import { StrongholdDef } from "../logic/strongholds";
import { AbilityKind, ALL_ABILITIES, CooldownState } from "../logic/abilities";

export type Phase = "setup" | "assault" | "summary" | "won" | "lost";

export interface WaveStats {
  cogsEarned: number;
  damageDealt: number;
  enemiesKilled: number;
  breaches: number;
  integrityStart: number;
}

export class RunState {
  readonly economy: EconomyState;
  readonly stronghold: StrongholdDef;
  waveIndex = 0;
  phase: Phase = "setup";
  coreIntegrity: number;
  readonly coreMax: number;
  /**
   * Monotonic run clock (ms) that keeps counting across every wave of the
   * Stronghold — Support Ability cooldowns are measured against this, so they
   * persist between waves.
   */
  runClockMs = 0;
  readonly cooldowns: Record<AbilityKind, CooldownState>;
  /** Abilities the player has unlocked (all unlocked by default for now). */
  readonly unlockedAbilities: Set<AbilityKind>;
  waveStats: WaveStats;

  constructor(stronghold: StrongholdDef) {
    this.stronghold = stronghold;
    this.economy = createEconomy(stronghold.startingCogs);
    this.coreIntegrity = stronghold.coreIntegrity;
    this.coreMax = stronghold.coreIntegrity;
    this.cooldowns = {} as Record<AbilityKind, CooldownState>;
    for (const k of ALL_ABILITIES) this.cooldowns[k] = { readyAtMs: 0 };
    this.unlockedAbilities = new Set(ALL_ABILITIES);
    this.waveStats = this.freshWaveStats();
  }

  freshWaveStats(): WaveStats {
    return {
      cogsEarned: 0,
      damageDealt: 0,
      enemiesKilled: 0,
      breaches: 0,
      integrityStart: this.coreIntegrity,
    };
  }

  get currentWave() {
    return this.stronghold.waves[this.waveIndex];
  }

  get isFinalWave(): boolean {
    return this.waveIndex >= this.stronghold.waves.length - 1;
  }
}
