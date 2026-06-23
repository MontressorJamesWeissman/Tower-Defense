import Phaser from "phaser";
import { GridConfig, GridCoord, Point, tileCenter, distance } from "../logic/grid";
import {
  TrapStats,
  TrapUpgrade,
  TRAP_UPGRADES,
  computeTrapStats,
  DeviceCategory,
  DEVICE_BASE_COST,
  MAX_TRAP_UPGRADE_SLOTS,
} from "../logic/devices";
import { Charge, CHARGE_META } from "../logic/elements";
import type { CombatContext } from "./types";

const TRIGGER_COOLDOWN_MS = 350;

/** A placed Trap device (sits on a path tile). */
export class Trap {
  readonly category = DeviceCategory.Trap;
  readonly coord: GridCoord;
  readonly charge: Charge;
  readonly center: Point;
  readonly upgrades: TrapUpgrade[] = [];
  readonly investedCosts: number[] = [];
  stats: TrapStats;

  private readonly triggerRadius: number;
  private readonly container: Phaser.GameObjects.Container;
  private readonly rangeCircle: Phaser.GameObjects.Arc;
  private lastTriggerAtMs = -99999;
  private lastMineAtMs = 0;
  private lastPulseAtMs = 0;

  constructor(scene: Phaser.Scene, grid: GridConfig, coord: GridCoord, charge: Charge) {
    this.coord = coord;
    this.charge = charge;
    this.center = tileCenter(grid, coord);
    this.triggerRadius = grid.tileSize * 0.55;
    this.stats = computeTrapStats(this.upgrades);
    const meta = CHARGE_META[charge];

    this.rangeCircle = scene.add
      .circle(this.center.x, this.center.y, this.stats.radius, meta.color, 0.05)
      .setStrokeStyle(1.5, meta.color, 0.5)
      .setVisible(false)
      .setDepth(8);

    const plate = scene.add.rectangle(0, 0, grid.tileSize - 12, grid.tileSize - 12, 0x2a2018).setStrokeStyle(2, meta.color, 0.9);
    const rune = scene.add.star(0, 0, 6, 4, 10, meta.color, 0.85);
    this.container = scene.add.container(this.center.x, this.center.y, [plate, rune]).setDepth(10);
  }

  showRange(v: boolean): void {
    this.rangeCircle.setRadius(this.stats.radius).setVisible(v);
  }

  get totalInvested(): number {
    return DEVICE_BASE_COST[this.category] + this.investedCosts.reduce((a, b) => a + b, 0);
  }

  availableUpgrades(): { id: TrapUpgrade; cost: number }[] {
    if (this.upgrades.length >= MAX_TRAP_UPGRADE_SLOTS) return [];
    return (Object.keys(TRAP_UPGRADES) as TrapUpgrade[])
      .filter((u) => !this.upgrades.includes(u))
      .map((u) => ({ id: u, cost: TRAP_UPGRADES[u].cost }));
  }

  applyUpgrade(up: TrapUpgrade): void {
    this.upgrades.push(up);
    this.investedCosts.push(TRAP_UPGRADES[up].cost);
    this.stats = computeTrapStats(this.upgrades);
    this.rangeCircle.setRadius(this.stats.radius);
  }

  update(ctx: CombatContext, nowMs: number): void {
    // Periodic, trigger-independent effects.
    if (this.stats.mineLayer && nowMs - this.lastMineAtMs >= this.stats.periodicMs) {
      this.lastMineAtMs = nowMs;
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * this.stats.radius;
      const px = this.center.x + Math.cos(angle) * r;
      const py = this.center.y + Math.sin(angle) * r;
      ctx.explosionFx(px, py, 32, CHARGE_META[this.charge].color);
      for (const e of ctx.enemiesInRadius(px, py, 36)) {
        if (!e.def.flying) ctx.hitEnemy(e, this.stats.damage * 0.8, { charge: this.charge, splash: true });
      }
    }

    if (this.stats.pulseEmitter && nowMs - this.lastPulseAtMs >= this.stats.periodicMs) {
      this.lastPulseAtMs = nowMs;
      ctx.explosionFx(this.center.x, this.center.y, this.stats.radius, CHARGE_META[this.charge].color);
      for (const e of ctx.enemiesInRadius(this.center.x, this.center.y, this.stats.radius)) {
        if (e.def.flying) continue;
        ctx.hitEnemy(e, this.stats.damage * 0.5, { charge: this.charge, splash: true });
        e.knockback(10);
      }
    }

    // Step trigger: ground enemies walking over the plate.
    if (nowMs - this.lastTriggerAtMs < TRIGGER_COOLDOWN_MS) return;
    const here = ctx
      .enemiesInRadius(this.center.x, this.center.y, this.triggerRadius)
      .filter((e) => !e.def.flying);
    if (here.length === 0) return;
    this.lastTriggerAtMs = nowMs;
    for (const e of here) {
      ctx.hitEnemy(e, this.stats.damage, { charge: this.charge, splash: true });
    }
    // Snare Coil: crowd-control nearby enemies with a heavy slow.
    if (this.stats.pull) {
      for (const e of ctx.enemiesInRadius(this.center.x, this.center.y, this.stats.radius)) {
        if (!e.def.flying) e.applySlow(0.4, 900, nowMs);
      }
    }
  }

  contains(p: Point): boolean {
    return distance(this.center, p) <= this.triggerRadius;
  }

  destroy(): void {
    this.rangeCircle.destroy();
    this.container.destroy();
  }
}
