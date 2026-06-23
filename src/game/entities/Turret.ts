import Phaser from "phaser";
import { GridConfig, GridCoord, Point, tileCenter, distance, distanceToSegment } from "../logic/grid";
import {
  TurretStats,
  TurretUpgrade,
  TURRET_UPGRADES,
  computeTurretStats,
  DeviceCategory,
  DEVICE_BASE_COST,
  MAX_TURRET_UPGRADE_SLOTS,
} from "../logic/devices";
import { Charge, CHARGE_META } from "../logic/elements";
import { applyResistShred } from "../logic/combat";
import type { CombatContext } from "./types";
import type { Enemy } from "./Enemy";

/** A placed Turret device. */
export class Turret {
  readonly category = DeviceCategory.Turret;
  readonly coord: GridCoord;
  readonly charge: Charge;
  readonly center: Point;
  readonly upgrades: TurretUpgrade[] = [];
  readonly investedCosts: number[] = [];
  stats: TurretStats;

  private readonly container: Phaser.GameObjects.Container;
  private readonly rangeCircle: Phaser.GameObjects.Arc;
  private readonly barrel: Phaser.GameObjects.Rectangle;
  private lastFireAtMs = -99999;

  constructor(scene: Phaser.Scene, grid: GridConfig, coord: GridCoord, charge: Charge) {
    this.coord = coord;
    this.charge = charge;
    this.center = tileCenter(grid, coord);
    this.stats = computeTurretStats(this.upgrades);
    const meta = CHARGE_META[charge];

    this.rangeCircle = scene.add
      .circle(this.center.x, this.center.y, this.stats.range, meta.color, 0.06)
      .setStrokeStyle(1.5, meta.color, 0.5)
      .setVisible(false)
      .setDepth(8);

    const base = scene.add.rectangle(0, 0, grid.tileSize - 10, grid.tileSize - 10, 0x202c3e).setStrokeStyle(2, meta.color, 0.9);
    const ring = scene.add.circle(0, 0, 9, meta.color);
    this.barrel = scene.add.rectangle(0, -2, 5, 16, 0xcdd6e0).setOrigin(0.5, 1);
    this.container = scene.add.container(this.center.x, this.center.y, [base, ring, this.barrel]).setDepth(12);
  }

  showRange(v: boolean): void {
    this.rangeCircle.setRadius(this.stats.range).setVisible(v);
  }

  get totalInvested(): number {
    return DEVICE_BASE_COST[this.category] + this.investedCosts.reduce((a, b) => a + b, 0);
  }

  availableUpgrades(): { id: TurretUpgrade; cost: number }[] {
    if (this.upgrades.length >= MAX_TURRET_UPGRADE_SLOTS) return [];
    return (Object.keys(TURRET_UPGRADES) as TurretUpgrade[])
      .filter((u) => !this.upgrades.includes(u))
      .map((u) => ({ id: u, cost: TURRET_UPGRADES[u].cost }));
  }

  applyUpgrade(up: TurretUpgrade): void {
    this.upgrades.push(up);
    this.investedCosts.push(TURRET_UPGRADES[up].cost);
    this.stats = computeTurretStats(this.upgrades);
    this.rangeCircle.setRadius(this.stats.range);
  }

  update(ctx: CombatContext, nowMs: number): void {
    if (nowMs - this.lastFireAtMs < this.stats.cooldownMs) return;
    const target = this.pickTarget(ctx);
    if (!target) return;
    this.lastFireAtMs = nowMs;
    this.fire(ctx, target, nowMs);
  }

  /** Target the enemy furthest along the path (closest to Core) within range. */
  private pickTarget(ctx: CombatContext): Enemy | null {
    let best: Enemy | null = null;
    for (const e of ctx.livingEnemies()) {
      if (distance(this.center, e.pos()) > this.stats.range) continue;
      if (!best || e.travelled > best.travelled) best = e;
    }
    return best;
  }

  private fire(ctx: CombatContext, target: Enemy, nowMs: number): void {
    // Aim the barrel.
    const tp = target.pos();
    this.barrel.setRotation(Phaser.Math.Angle.Between(this.center.x, this.center.y, tp.x, tp.y) + Math.PI / 2);

    if (this.stats.resistShredMs > 0) {
      applyResistShred(target.state, this.stats.resistShredMs, nowMs);
    }

    if (this.stats.pierce) {
      this.firePierce(ctx, target);
    } else if (this.stats.splashRadius > 0) {
      ctx.hitEnemy(target, this.stats.damage, { charge: this.charge, splash: true });
      for (const e of ctx.enemiesInRadius(tp.x, tp.y, this.stats.splashRadius)) {
        if (e !== target) ctx.hitEnemy(e, this.stats.damage * 0.6, { charge: this.charge, splash: true });
      }
    } else {
      ctx.hitEnemy(target, this.stats.damage, { charge: this.charge });
    }
  }

  private firePierce(ctx: CombatContext, target: Enemy): void {
    const dir = Phaser.Math.Angle.Between(this.center.x, this.center.y, target.pos().x, target.pos().y);
    const end: Point = {
      x: this.center.x + Math.cos(dir) * this.stats.range,
      y: this.center.y + Math.sin(dir) * this.stats.range,
    };
    for (const e of ctx.livingEnemies()) {
      if (distance(this.center, e.pos()) > this.stats.range) continue;
      if (distanceToSegment(e.pos(), this.center, end) <= e.def.radius + 8) {
        ctx.hitEnemy(e, this.stats.damage, { charge: this.charge, splash: true });
      }
    }
  }

  destroy(): void {
    this.rangeCircle.destroy();
    this.container.destroy();
  }
}
