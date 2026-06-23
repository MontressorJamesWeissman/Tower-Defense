import Phaser from "phaser";
import { SceneKeys } from "../constants";
import { generateFxTextures } from "../fx/textures";

/**
 * BootScene — generates the procedural FX textures (glow/ring) once, then
 * transitions to the main menu. No external art assets are used.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  create(): void {
    generateFxTextures(this);
    this.scene.start(SceneKeys.Preload);
  }
}
