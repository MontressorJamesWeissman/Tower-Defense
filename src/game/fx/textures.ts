// Bastion Protocol — generated FX textures (no external art assets).
// Soft radial "glow" and a "ring" band, drawn once at boot and tinted per use.

import Phaser from "phaser";

export const FX_GLOW = "fx-glow";
export const FX_RING = "fx-ring";
/** Base radius (px) the ring texture is drawn at, for shockwave scale math. */
export const FX_RING_BASE = 32;

export function generateFxTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(FX_GLOW)) {
    const size = 64;
    const tex = scene.textures.createCanvas(FX_GLOW, size, size);
    if (tex) {
      const ctx = tex.getContext();
      const r = size / 2;
      const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.4, "rgba(255,255,255,0.85)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      tex.refresh();
    }
  }

  if (!scene.textures.exists(FX_RING)) {
    const size = FX_RING_BASE * 2;
    const tex = scene.textures.createCanvas(FX_RING, size, size);
    if (tex) {
      const ctx = tex.getContext();
      const r = size / 2;
      const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.62, "rgba(255,255,255,0)");
      grad.addColorStop(0.78, "rgba(255,255,255,1)");
      grad.addColorStop(0.9, "rgba(255,255,255,0.8)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      tex.refresh();
    }
  }
}
