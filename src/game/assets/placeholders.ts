// Bastion Protocol — runtime placeholder texture generation.
//
// For any manifest asset whose real file is absent, we synthesize a labeled,
// correctly-dimensioned texture so the game is fully playable on placeholders.
// Spritesheet placeholders get per-frame sub-textures so animations still run.

import Phaser from "phaser";
import { ImageAsset, PanelAsset, SheetAsset } from "./manifest";

function hexToCss(color: string): string {
  return color.startsWith("#") ? color : `#${color}`;
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  label: string,
): void {
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  // Dashed border marks it clearly as a placeholder.
  ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  ctx.setLineDash([]);
  // Label.
  const fontSize = Math.max(7, Math.min(12, Math.floor(Math.min(w, h) / 4)));
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + h / 2, w - 4);
}

export function makeImagePlaceholder(scene: Phaser.Scene, key: string, a: ImageAsset | PanelAsset): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, a.width, a.height);
  if (!tex) return;
  drawCell(tex.getContext(), 0, 0, a.width, a.height, hexToCss(a.placeholder.color), a.placeholder.label);
  tex.refresh();
}

export function makeSheetPlaceholder(scene: Phaser.Scene, key: string, a: SheetAsset): void {
  if (scene.textures.exists(key)) return;
  const { frameWidth: fw, frameHeight: fh, frameCount } = a;
  const tex = scene.textures.createCanvas(key, fw * frameCount, fh);
  if (!tex) return;
  const ctx = tex.getContext();
  const fill = hexToCss(a.placeholder.color);
  for (let i = 0; i < frameCount; i++) {
    drawCell(ctx, i * fw, 0, fw, fh, fill, `${a.placeholder.label} ${i}`);
    tex.add(i, 0, i * fw, 0, fw, fh);
  }
  tex.refresh();
}
