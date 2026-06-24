import Phaser from "phaser";
import { EnemyDef, EnemyKind, DETONATION_CATALYST_MULT, MENDER_HEAL_INTERVAL_MS } from "../logic/enemies";
import { EnemyCombatState, isFrozen } from "../logic/combat";
import { Point } from "../logic/grid";
import { CHARGE_META, Charge } from "../logic/elements";
import { AssetKeys } from "../assets/manifest";
import { playAnim, fitSprite } from "../render/sprites";
import type { CombatContext } from "./types";

export interface ActiveDot {
  damagePerTick: number;
  ticksRemaining: number;
  intervalMs: number;
  nextTickAtMs: number;
  aoeRadius: number;
}

let NEXT_ENEMY_ID = 1;

/**
 * Enemy entity: pairs a pure EnemyCombatState with Phaser visuals and movement
 * along a waypoint path. Special archetype behaviours (heal, detonate,
 * reshield) are driven here off the EnemyDef flags.
 */
export class Enemy {
  readonly id = NEXT_ENEMY_ID++;
  readonly def: EnemyDef;
  readonly state: EnemyCombatState;
  readonly container: Phaser.GameObjects.Container;

  private readonly body: Phaser.GameObjects.Sprite;
  private readonly chargeRing: Phaser.GameObjects.Arc;
  private readonly hpBar: Phaser.GameObjects.Graphics;
  private readonly bossTag?: Phaser.GameObjects.Text;
  private flashUntilMs = 0;
  private destroyed = false;

  private readonly waypoints: readonly Point[];
  travelled = 0;
  private readonly baseSpeed: number;
  /** Temporary slow multiplier (e.g. Maelstrom). 1 = normal. */
  slowMult = 1;
  slowUntilMs = 0;

  alive = true;
  reachedCore = false;

  private readonly dots: ActiveDot[] = [];

  // Detonator
  private detonationMeter = 0;
  // Mender
  private nextHealAtMs = 0;
  // Boss reshield
  private nextReshieldAtMs = 0;
  private reshieldWarned = false;

  constructor(
    scene: Phaser.Scene,
    def: EnemyDef,
    waypoints: readonly Point[],
    nowMs: number,
  ) {
    this.def = def;
    this.waypoints = waypoints;
    this.baseSpeed = def.speed;
    this.state = {
      hp: def.maxHp,
      maxHp: def.maxHp,
      shield: def.shield,
      immuneTo: def.immuneTo,
      activeCharge: null,
      activeChargeExpiresMs: 0,
      frozenUntilMs: 0,
      resistShredUntilMs: 0,
    };
    this.nextHealAtMs = nowMs + MENDER_HEAL_INTERVAL_MS;
    this.nextReshieldAtMs = nowMs + def.reshieldIntervalMs;

    const start = waypoints[0];
    const enemyKey = AssetKeys.enemy(def.kind);
    this.body = scene.add.sprite(0, 0, enemyKey);
    fitSprite(this.body, def.radius * 2.3);
    playAnim(this.body, enemyKey, "walk");
    if (def.flying) this.body.setY(-6); // hover offset
    this.chargeRing = scene.add.circle(0, 0, def.radius + 4).setStrokeStyle(3, 0xffffff, 0).setVisible(false);
    this.hpBar = scene.add.graphics();

    const parts: Phaser.GameObjects.GameObject[] = [this.chargeRing, this.body, this.hpBar];
    if (def.isBoss) {
      this.bossTag = scene.add
        .text(0, -def.radius - 14, "⚠ COLOSSUS", { fontSize: "11px", color: "#ff9aa8", fontStyle: "bold" })
        .setOrigin(0.5);
      parts.push(this.bossTag);
    }
    this.container = scene.add.container(start.x, start.y, parts).setDepth(20);
    if (def.flying) this.container.setDepth(22);
    this.redrawHpBar();
  }

  get x(): number {
    return this.container.x;
  }
  get y(): number {
    return this.container.y;
  }

  pos(): Point {
    return { x: this.container.x, y: this.container.y };
  }

  isFrozen(nowMs: number): boolean {
    return isFrozen(this.state, nowMs);
  }

  addDot(damagePerTick: number, ticks: number, intervalMs: number, nowMs: number, aoeRadius = 0): void {
    this.dots.push({
      damagePerTick,
      ticksRemaining: ticks,
      intervalMs,
      nextTickAtMs: nowMs + intervalMs,
      aoeRadius,
    });
  }

  applySlow(mult: number, durationMs: number, nowMs: number): void {
    this.slowMult = Math.min(this.slowMult, mult);
    this.slowUntilMs = Math.max(this.slowUntilMs, nowMs + durationMs);
  }

  /** Knock the enemy backward along the path by `dist` px. */
  knockback(dist: number): void {
    this.travelled = Math.max(0, this.travelled - dist);
  }

  /**
   * Advance simulation by dtMs. Returns "reached-core" when the enemy breaches.
   * Movement and periodic behaviours are driven here.
   */
  update(ctx: CombatContext, dtMs: number, nowMs: number): void {
    if (!this.alive) return;

    if (nowMs >= this.slowUntilMs) this.slowMult = 1;

    this.tickDots(ctx, nowMs);
    if (!this.alive) return;

    this.tickArchetype(ctx, dtMs, nowMs);
    if (!this.alive) return;

    // Movement (frozen enemies hold position).
    if (!this.isFrozen(nowMs)) {
      const speed = this.baseSpeed * this.slowMult;
      this.travelled += (speed * dtMs) / 1000;
      const result = this.positionAt(this.travelled);
      this.container.setPosition(result.pos.x, result.pos.y);
      if (result.reachedEnd) {
        this.reachedCore = true;
        this.alive = false;
        this.destroy();
        return;
      }
    }

    this.updateVisuals(nowMs);
  }

  private positionAt(travelled: number): { pos: Point; reachedEnd: boolean } {
    let remaining = travelled;
    for (let i = 1; i < this.waypoints.length; i++) {
      const a = this.waypoints[i - 1];
      const b = this.waypoints[i];
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      if (remaining <= seg) {
        const t = seg === 0 ? 0 : remaining / seg;
        return { pos: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, reachedEnd: false };
      }
      remaining -= seg;
    }
    return { pos: this.waypoints[this.waypoints.length - 1], reachedEnd: true };
  }

  private tickDots(ctx: CombatContext, nowMs: number): void {
    for (let i = this.dots.length - 1; i >= 0; i--) {
      const dot = this.dots[i];
      while (nowMs >= dot.nextTickAtMs && dot.ticksRemaining > 0) {
        ctx.hitEnemy(this, dot.damagePerTick, { noReaction: true, splash: true });
        if (dot.aoeRadius > 0) {
          for (const other of ctx.enemiesInRadius(this.x, this.y, dot.aoeRadius)) {
            if (other !== this) ctx.hitEnemy(other, dot.damagePerTick * 0.5, { noReaction: true, splash: true });
          }
        }
        dot.ticksRemaining--;
        dot.nextTickAtMs += dot.intervalMs;
        if (!this.alive) return;
      }
      if (dot.ticksRemaining <= 0) this.dots.splice(i, 1);
    }
  }

  private tickArchetype(ctx: CombatContext, dtMs: number, nowMs: number): void {
    // Mender: heal nearby allies.
    if (this.def.healPerTick > 0 && nowMs >= this.nextHealAtMs) {
      this.nextHealAtMs = nowMs + MENDER_HEAL_INTERVAL_MS;
      for (const other of ctx.enemiesInRadius(this.x, this.y, this.def.healRadius)) {
        if (other === this) continue;
        const healed = Math.min(other.state.maxHp - other.state.hp, this.def.healPerTick);
        if (healed > 0) {
          other.state.hp += healed;
          other.redrawHpBar();
        }
      }
    }

    // Detonator: fill meter over time, faster while carrying the catalyst charge.
    if (this.def.detonates) {
      let rate = 12; // meter points per second baseline (~8s to self-destruct)
      if (
        this.def.detonationCatalyst &&
        this.state.activeCharge === this.def.detonationCatalyst &&
        nowMs < this.state.activeChargeExpiresMs
      ) {
        rate *= DETONATION_CATALYST_MULT;
      }
      this.detonationMeter += rate * (dtMs / 1000);
      if (this.detonationMeter >= 100) {
        this.selfDestruct(ctx);
        return;
      }
    }

    // Boss: telegraph + periodic reshield.
    if (this.def.reshieldAmount > 0) {
      if (!this.reshieldWarned && nowMs >= this.nextReshieldAtMs - 1000) {
        this.reshieldWarned = true;
        ctx.floatingText(this.x, this.y - this.def.radius - 18, "RE-SHIELDING", "#ffd24f");
      }
      if (nowMs >= this.nextReshieldAtMs) {
        this.state.shield = Math.max(this.state.shield, this.def.reshieldAmount);
        this.nextReshieldAtMs = nowMs + this.def.reshieldIntervalMs;
        this.reshieldWarned = false;
        this.redrawHpBar();
      }
    }
  }

  private selfDestruct(ctx: CombatContext): void {
    // Self-detonation: dies (giving bounty) and damages nearby enemies.
    ctx.explosionFx(this.x, this.y, this.def.explosionRadius, 0xff7a33);
    for (const other of ctx.enemiesInRadius(this.x, this.y, this.def.explosionRadius)) {
      if (other !== this) ctx.hitEnemy(other, this.def.explosionDamage, { noReaction: true, splash: true });
    }
    // Kill self via overwhelming true damage so the normal kill path runs.
    ctx.hitEnemy(this, this.state.hp + this.state.shield + 1, { ignoreShield: true, noReaction: true, splash: true });
  }

  private updateVisuals(nowMs: number): void {
    const charged = this.state.activeCharge !== null && nowMs < this.state.activeChargeExpiresMs;
    if (charged) {
      const meta = CHARGE_META[this.state.activeCharge as Charge];
      this.chargeRing.setStrokeStyle(3, meta.color, 0.9).setVisible(true);
    } else {
      this.chargeRing.setVisible(false);
    }
    // Tint priority: white hit-flash > freeze-blue > normal.
    if (nowMs < this.flashUntilMs) {
      this.body.setTintFill(0xffffff);
    } else if (this.isFrozen(nowMs)) {
      this.body.setTint(0x9fdcff);
    } else {
      this.body.clearTint();
    }
  }

  redrawHpBar(): void {
    const w = Math.max(20, this.def.radius * 2);
    const h = 4;
    const x = -w / 2;
    const y = -this.def.radius - 9;
    const g = this.hpBar;
    g.clear();
    g.fillStyle(0x000000, 0.6).fillRect(x - 1, y - 1, w + 2, h + 2);
    const hpFrac = Phaser.Math.Clamp(this.state.hp / this.state.maxHp, 0, 1);
    g.fillStyle(0x3a3f48, 1).fillRect(x, y, w, h);
    g.fillStyle(hpFrac > 0.5 ? 0x5ad17a : hpFrac > 0.25 ? 0xe6c14f : 0xe85a5a, 1).fillRect(x, y, w * hpFrac, h);
    if (this.state.shield > 0) {
      const sFrac = Phaser.Math.Clamp(this.state.shield / Math.max(this.def.shield, this.state.shield), 0, 1);
      g.fillStyle(0x7fc8ff, 1).fillRect(x, y - 3, w * sFrac, 2);
    }
  }

  /** Brief white tint flash on hit (~80ms), driven by updateVisuals. */
  hitFlash(nowMs: number): void {
    this.flashUntilMs = nowMs + 80;
    this.body.setTintFill(0xffffff);
  }

  /** Death: play death anim (or scale/fade) then despawn. */
  die(): void {
    if (this.destroyed) return;
    this.alive = false;
    this.hpBar.setVisible(false);
    this.chargeRing.setVisible(false);
    this.bossTag?.setVisible(false);
    this.body.clearTint();
    const scene = this.container.scene;
    const enemyKey = AssetKeys.enemy(this.def.kind);
    const played = playAnim(this.body, enemyKey, "death");
    if (played) {
      this.body.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.destroy());
      scene.time.delayedCall(700, () => this.destroy()); // safety net
    } else {
      scene.tweens.add({
        targets: this.container,
        alpha: 0,
        scale: 0.6,
        duration: 220,
        ease: "Back.easeIn",
        onComplete: () => this.destroy(),
      });
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.alive = false;
    this.container.destroy();
  }

  static catalystOf(kind: EnemyKind): Charge | null {
    return kind === EnemyKind.Detonator ? Charge.Ember : null;
  }
}
