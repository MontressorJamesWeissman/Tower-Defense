import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, SceneKeys } from "../constants";
import { STRONGHOLD_1 } from "../logic/strongholds";

/**
 * MainMenuScene — title + "begin" prompt. Stronghold-select is expanded in a
 * later milestone; for now it launches Stronghold 1.
 */
export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.MainMenu);
  }

  create(): void {
    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, GAME_HEIGHT * 0.32, "BASTION PROTOCOL", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "52px",
        color: "#4fd1c5",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, GAME_HEIGHT * 0.32 + 48, "Elemental Tower Defense", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "20px",
        color: "#8aa0b8",
      })
      .setOrigin(0.5);

    const btn = this.add
      .text(cx, GAME_HEIGHT * 0.62, `▶  Enter: ${STRONGHOLD_1.name}`, {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "26px",
        color: "#e6edf3",
        backgroundColor: "#1b2536",
        padding: { x: 22, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    btn.on("pointerover", () => btn.setColor("#4fd1c5"));
    btn.on("pointerout", () => btn.setColor("#e6edf3"));
    btn.on("pointerdown", () => this.scene.start(SceneKeys.Grid));

    this.add
      .text(cx, GAME_HEIGHT - 36, "v0.1 — milestone build", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "13px",
        color: "#54637a",
      })
      .setOrigin(0.5);
  }
}
