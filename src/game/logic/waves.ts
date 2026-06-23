// Bastion Protocol — Wave spawn schedules.
// Pure data describing what spawns, when, and from which spawn point.
// No Phaser dependency.

import { EnemyKind } from "./enemies";

export interface SpawnGroup {
  readonly kind: EnemyKind;
  readonly count: number;
  /** Delay before this group starts spawning, from wave start (ms). */
  readonly startDelayMs: number;
  /** Gap between individual spawns within the group (ms). */
  readonly intervalMs: number;
  /** Index of the spawn point / lane this group uses. */
  readonly spawnIndex: number;
}

export interface WaveDef {
  readonly index: number;
  readonly name: string;
  readonly groups: readonly SpawnGroup[];
  /** Cog budget granted at the start of this wave's Setup Phase. */
  readonly setupCogs: number;
}

/** Total number of enemies a wave will spawn (used for end-of-wave bookkeeping). */
export function waveEnemyCount(wave: WaveDef): number {
  return wave.groups.reduce((sum, g) => sum + g.count, 0);
}

/**
 * Flatten a wave into an ordered list of spawn events with absolute spawn
 * times (ms from wave start). Deterministic — used by the spawner and testable.
 */
export interface SpawnEvent {
  readonly timeMs: number;
  readonly kind: EnemyKind;
  readonly spawnIndex: number;
}

export function buildSpawnSchedule(wave: WaveDef): SpawnEvent[] {
  const events: SpawnEvent[] = [];
  for (const group of wave.groups) {
    for (let i = 0; i < group.count; i++) {
      events.push({
        timeMs: group.startDelayMs + i * group.intervalMs,
        kind: group.kind,
        spawnIndex: group.spawnIndex,
      });
    }
  }
  events.sort((a, b) => a.timeMs - b.timeMs);
  return events;
}
