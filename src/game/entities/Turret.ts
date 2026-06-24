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
import { playAnim, fitSprite } from "../render/sprites";
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

  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly rangeCircle: Phaser.GameObjects.Arc;
  /** Rotating head: emitter overlay + firing-animation overlay. */
  private readonly head: Phaser.GameObjects.Container;
  private readonly fireSprite: Phaser.GameObjects.Sprite;
  private lastFireAtMs = -99999;

  constructor(scene: Phaser.Scene, grid: GridConfig, coord: GridCoord, charge: Charge) {
    this.scene = scene;
    this.coord = coord;
    this.charge = charge;
    this.center = tileCenter(grid, coord);
    this.stats = computeTurretStats(this.upgrades);
    const meta = CHARGE_META[charge];
    const size = grid.tileSize;

    this.rangeCircle = scene.add
      .circle(this.center.x, this.center.y, this.stats.range, meta.color, 0.06)
      .setStrokeStyle(1.5, meta.color, 0.5)
      .setVisible(false)
      .setDepth(8);

    // Layered sprites: neutral base + Charge-tinted emitter + firing overlay.
    const base = scene.add.sprite(0, 0, "turret.base");
    fitSprite(base, size);
    const emitter = scene.add.sprite(0, 0, "turret.emitter").setTint(meta.color);
    fitSprite(emitter, size);
    this.fireSprite = scene.add.sprite(0, 0, "turret.fire").setTint(meta.color).setVisible(false);
    fitSprite(this.fireSprite, size);
    this.head = scene.add.container(0, 0, [emitter, this.fireSprite]);
    this.container = scene.add.container(this.center.x, this.center.y, [base, this.head]).setDepth(12);
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
    // Aim the head at the target, play the firing overlay, recoil pop.
    const tp = target.pos();
    this.head.setRotation(Phaser.Math.Angle.Between(this.center.x, this.center.y, tp.x, tp.y) + Math.PI / 2);
    this.fireSprite.setVisible(true);
    if (!playAnim(this.fireSprite, "turret.fire", "fire")) {
      this.scene.tweens.add({ targets: this.fireSprite, alpha: { from: 1, to: 0 }, duration: 120, onComplete: () => this.fireSprite.setAlpha(1).setVisible(false) });
    } else {
      this.fireSprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.fireSprite.setVisible(false));
    }
    this.recoil();

    if (this.stats.resistShredMs > 0) {
      applyResistShred(target.state, this.stats.resistShredMs, nowMs);
    }

    if (this.stats.pierce) {
      // Bolt travels to the far end of the pierce line.
      const dir = Phaser.Math.Angle.Between(this.center.x, this.center.y, tp.x, tp.y);
      ctx.turretFire(this.center, {
        x: this.center.x + Math.cos(dir) * this.stats.range,
        y: this.center.y + Math.sin(dir) * this.stats.range,
      }, this.charge);
      this.firePierce(ctx, target);
    } else if (this.stats.splashRadius > 0) {
      ctx.turretFire(this.center, tp, this.charge);
      ctx.hitEnemy(target, this.stats.damage, { charge: this.charge, splash: true });
      for (const e of ctx.enemiesInRadius(tp.x, tp.y, this.stats.splashRadius)) {
        if (e !== target) ctx.hitEnemy(e, this.stats.damage * 0.6, { charge: this.charge, splash: true, silent: true });
      }
    } else {
      ctx.turretFire(this.center, tp, this.charge);
      ctx.hitEnemy(target, this.stats.damage, { charge: this.charge });
    }
  }

  private recoil(): void {
    this.scene.tweens.add({
      targets: this.head,
      scaleX: 0.82,
      scaleY: 0.82,
      duration: 60,
      yoyo: true,
      ease: "Quad.easeOut",
    });
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
