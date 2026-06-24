// Bastion Protocol — layered parallax background.
// Each layer is a TileSprite that scrolls slowly at its own rate, giving
// painterly depth behind the play grid and on the menu.

import Phaser from "phaser";

export interface ParallaxLayerDef {
  /** Texture key (from the manifest). */
  key: string;
  /** Horizontal scroll speed in px/sec (can be negative). */
  speedX: number;
  /** Vertical drift in px/sec (usually small or 0). */
  speedY?: number;
  alpha?: number;
}

export class Parallax {
  private readonly layers: { sprite: Phaser.GameObjects.TileSprite; speedX: number; speedY: number }[] = [];

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    defs: ParallaxLayerDef[],
    depth = -10,
  ) {
    defs.forEach((d, i) => {
      const sprite = scene.add
        .tileSprite(x, y, width, height, d.key)
        .setOrigin(0, 0)
        .setDepth(depth + i)
        .setAlpha(d.alpha ?? 1);
      this.layers.push({ sprite, speedX: d.speedX, speedY: d.speedY ?? 0 });
    });
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    for (const l of this.layers) {
      l.sprite.tilePositionX += l.speedX * dt;
      if (l.speedY) l.sprite.tilePositionY += l.speedY * dt;
    }
  }

  destroy(): void {
    for (const l of this.layers) l.sprite.destroy();
    this.layers.length = 0;
  }
}
