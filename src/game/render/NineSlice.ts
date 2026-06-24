// Bastion Protocol — 9-slice panel/button helper.
// Painted UI frames scale crisply at any size using the border insets declared
// in the asset manifest. Falls back gracefully (placeholder panels are valid
// textures, so this always works).

import Phaser from "phaser";
import { ASSETS, PanelAsset } from "../assets/manifest";

/**
 * Create a 9-slice panel game object sized to (w, h) using the manifest entry's
 * slice insets. Origin is top-left.
 */
export function makePanel(
  scene: Phaser.Scene,
  key: string,
  x: number,
  y: number,
  w: number,
  h: number,
): Phaser.GameObjects.NineSlice {
  const a = ASSETS[key] as PanelAsset | undefined;
  const s = a?.slice ?? { left: 12, right: 12, top: 12, bottom: 12 };
  return scene.add
    .nineslice(x, y, key, undefined, w, h, s.left, s.right, s.top, s.bottom)
    .setOrigin(0, 0);
}
