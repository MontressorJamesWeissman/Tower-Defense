import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, SceneKeys } from "../constants";
import { STRONGHOLDS } from "../logic/strongholds";
import { loadSave, resetProgress } from "../state/save";

/** MainMenuScene — title + Stronghold select with localStorage progress. */
export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.MainMenu);
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const save = loadSave();

    this.add
      .text(cx, 70, "BASTION PROTOCOL", { fontSize: "52px", color: "#4fd1c5", fontStyle: "bold" })
      .setOrigin(0.5);
    this.add
      .text(cx, 118, "Elemental Tower Defense", { fontSize: "18px", color: "#8aa0b8" })
      .setOrigin(0.5);

    this.add
      .text(cx, 168, "Select a Stronghold", { fontSize: "16px", color: "#c2cedb" })
      .setOrigin(0.5);

    STRONGHOLDS.forEach((sh, i) => {
      const unlocked = i < save.unlockedStrongholds;
      const cleared = i <= save.highestCleared;
      const y = 210 + i * 52;
      const color = unlocked ? (cleared ? 0x2f7d5a : 0x2f5a7d) : 0x2a2f38;
      const bg = this.add
        .rectangle(cx, y, 360, 42, color, 0.9)
        .setStrokeStyle(2, 0x0a0e14, 1)
        .setDepth(1);
      const status = cleared ? "✓ cleared" : unlocked ? "" : "🔒 locked";
      this.add
        .text(cx, y, `${i + 1}.  ${sh.name}   ${status}`, {
          fontSize: "18px",
          color: unlocked ? "#ffffff" : "#54637a",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(2);
      if (unlocked) {
        bg.setInteractive({ useHandCursor: true });
        bg.on("pointerover", () => bg.setFillStyle(color, 1));
        bg.on("pointerout", () => bg.setFillStyle(color, 0.9));
        bg.on("pointerdown", () => this.scene.start(SceneKeys.Game, { strongholdIndex: i }));
      }
    });

    const reset = this.add
      .text(GAME_WIDTH - 12, GAME_HEIGHT - 14, "reset progress", { fontSize: "12px", color: "#54637a" })
      .setOrigin(1, 1)
      .setInteractive({ useHandCursor: true });
    reset.on("pointerdown", () => {
      resetProgress();
      this.scene.restart();
    });

    this.add
      .text(12, GAME_HEIGHT - 14, "v0.1", { fontSize: "12px", color: "#54637a" })
      .setOrigin(0, 1);
  }
}
