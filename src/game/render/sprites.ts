// Bastion Protocol — sprite/animation helpers driven by the asset manifest.

import Phaser from "phaser";
import { animKey } from "../assets/manifest";

/**
 * Play a manifest-declared animation on a sprite if it exists; otherwise leave
 * the sprite on frame 0 (so placeholder single-state textures still render).
 * Returns true if an animation started.
 */
export function playAnim(sprite: Phaser.GameObjects.Sprite, assetKey: string, anim: string): boolean {
  const k = animKey(assetKey, anim);
  if (sprite.anims && sprite.scene.anims.exists(k)) {
    sprite.play({ key: k }, true);
    return true;
  }
  return false;
}

/** Scale a sprite so its larger display dimension matches `size` px. */
export function fitSprite(sprite: Phaser.GameObjects.Components.Transform & { width: number; height: number }, size: number): void {
  const max = Math.max(sprite.width, sprite.height) || size;
  const s = size / max;
  sprite.setScale(s);
}
