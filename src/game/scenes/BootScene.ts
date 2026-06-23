import Phaser from "phaser";
import { SceneKeys } from "../constants";

/**
 * BootScene — minimal asset/init step. We use generated graphics (no external
 * art assets) so this just transitions straight to the main menu.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  create(): void {
    this.scene.start(SceneKeys.MainMenu);
  }
}
