// Bastion Protocol — visual effects helper.
//
// A pooled set of additive, tinted glow images drives muzzle flashes, bolts,
// impacts, bursts and shockwaves. Pooling keeps allocation flat when many
// turrets fire at once. Respects the "reduce VFX" setting.

import Phaser from "phaser";
import { Point } from "../logic/grid";
import { settings } from "../state/settings";
import { FX_GLOW, FX_RING, FX_RING_BASE } from "./textures";

const FX_DEPTH = 64;

export class Vfx {
  private readonly scene: Phaser.Scene;
  private readonly pool: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  private acquire(texture: string): Phaser.GameObjects.Image {
    const img = this.pool.pop();
    if (img) {
      img.setTexture(texture).setActive(true).setVisible(true).setAngle(0).setScale(1).setAlpha(1);
      return img;
    }
    return this.scene.add.image(0, 0, texture).setDepth(FX_DEPTH).setBlendMode(Phaser.BlendModes.ADD);
  }

  private release(img: Phaser.GameObjects.Image): void {
    img.setVisible(false).setActive(false);
    if (this.pool.length < 256) this.pool.push(img);
    else img.destroy();
  }

  private get reduced(): boolean {
    return settings.reduceVfx;
  }

  /** A short particle puff (muzzle flash, small hit). */
  burst(x: number, y: number, color: number, count = 8, spread = 26, size = 0.5, life = 360): void {
    const n = this.reduced ? Math.ceil(count / 2) : count;
    for (let i = 0; i < n; i++) {
      const p = this.acquire(FX_GLOW).setPosition(x, y).setTint(color).setScale(size * (0.6 + Math.random() * 0.6)).setBlendMode(Phaser.BlendModes.ADD);
      p.setDepth(FX_DEPTH);
      const ang = Math.random() * Math.PI * 2;
      const dist = spread * (0.4 + Math.random() * 0.8);
      this.scene.tweens.add({
        targets: p,
        x: x + Math.cos(ang) * dist,
        y: y + Math.sin(ang) * dist,
        scale: 0,
        alpha: 0,
        duration: life * (0.7 + Math.random() * 0.5),
        ease: "Cubic.easeOut",
        onComplete: () => this.release(p),
      });
    }
  }

  muzzleFlash(x: number, y: number, color: number): void {
    const p = this.acquire(FX_GLOW).setPosition(x, y).setTint(color).setScale(0.9).setAlpha(0.9).setDepth(FX_DEPTH);
    this.scene.tweens.add({ targets: p, scale: 0.2, alpha: 0, duration: 130, ease: "Quad.easeOut", onComplete: () => this.release(p) });
  }

  /** Cosmetic bolt that travels from→to, then fires onArrive (e.g. impact sound). */
  bolt(from: Point, to: Point, color: number, onArrive?: () => void): void {
    const dist = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    const duration = Phaser.Math.Clamp(dist / 1.4, 70, 240); // ~1400 px/s
    const orb = this.acquire(FX_GLOW).setPosition(from.x, from.y).setTint(color).setScale(0.55).setAlpha(1).setDepth(FX_DEPTH + 1);
    orb.setRotation(Phaser.Math.Angle.Between(from.x, from.y, to.x, to.y));

    let lastTrail = 0;
    this.scene.tweens.add({
      targets: orb,
      x: to.x,
      y: to.y,
      duration,
      ease: "Sine.easeIn", // slight follow-through accel
      onUpdate: (tw) => {
        if (this.reduced) return;
        const e = tw.elapsed;
        if (e - lastTrail >= 16) {
          lastTrail = e;
          this.trailDot(orb.x, orb.y, color);
        }
      },
      onComplete: () => {
        this.release(orb);
        this.impact(to.x, to.y, color);
        onArrive?.();
      },
    });
  }

  private trailDot(x: number, y: number, color: number): void {
    const d = this.acquire(FX_GLOW).setPosition(x, y).setTint(color).setScale(0.3).setAlpha(0.5).setDepth(FX_DEPTH);
    this.scene.tweens.add({ targets: d, scale: 0.05, alpha: 0, duration: 200, onComplete: () => this.release(d) });
  }

  impact(x: number, y: number, color: number): void {
    this.burst(x, y, color, 7, 22, 0.45, 300);
    const flash = this.acquire(FX_GLOW).setPosition(x, y).setTint(color).setScale(0.8).setAlpha(0.9).setDepth(FX_DEPTH);
    this.scene.tweens.add({ targets: flash, scale: 0.1, alpha: 0, duration: 140, onComplete: () => this.release(flash) });
  }

  death(x: number, y: number, color: number): void {
    this.burst(x, y, color, 12, 34, 0.5, 420);
  }

  /** Expanding soft ring (shockwaves, reaction blasts, placement pulses). */
  shockwave(x: number, y: number, color: number, radius: number, durationMs = 320, alpha = 0.8): void {
    const ring = this.acquire(FX_RING).setPosition(x, y).setTint(color).setAlpha(alpha).setDepth(FX_DEPTH).setScale(0.2);
    const targetScale = radius / FX_RING_BASE;
    this.scene.tweens.add({
      targets: ring,
      scale: targetScale,
      alpha: 0,
      duration: durationMs,
      ease: "Cubic.easeOut",
      onComplete: () => this.release(ring),
    });
  }

  placementPulse(x: number, y: number, color: number): void {
    this.shockwave(x, y, color, 48, 360, 0.7);
  }

  /** The big reaction moment: dual-color burst + expanding ring. */
  reactionBurst(x: number, y: number, color: number, radius: number): void {
    this.shockwave(x, y, 0xffffff, Math.max(40, radius), 300, 0.9);
    this.shockwave(x, y, color, Math.max(48, radius * 1.2), 380, 0.8);
    this.burst(x, y, color, 18, radius * 0.7, 0.7, 480);
    this.burst(x, y, 0xffffff, 8, radius * 0.4, 0.5, 320);
  }
}
