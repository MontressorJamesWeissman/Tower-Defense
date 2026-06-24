import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, SceneKeys } from "../constants";
import { STRONGHOLDS } from "../logic/strongholds";
import { loadSave, resetProgress } from "../state/save";
import { audio } from "../audio/AudioManager";
import { FONTS } from "../render/fonts";
import { makePanel } from "../render/NineSlice";
import { Parallax } from "../render/Parallax";
import { openSettings } from "../ui/SettingsOverlay";

/** MainMenuScene — painted parallax title screen + Stronghold select. */
export class MainMenuScene extends Phaser.Scene {
  private bg?: Parallax;

  constructor() {
    super(SceneKeys.MainMenu);
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const save = loadSave();
    audio.startMusic("menu");

    // Parallax painted background + drifting ambient motes.
    this.bg = new Parallax(this, 0, 0, GAME_WIDTH, GAME_HEIGHT, [
      { key: "bg.menu.sky", speedX: 3 },
      { key: "bg.menu.near", speedX: 9, alpha: 0.85 },
    ], -10);
    this.spawnMotes();

    this.add
      .text(cx, 72, "BASTION PROTOCOL", { fontFamily: FONTS.display, fontSize: "54px", color: "#4fd1c5", fontStyle: "bold", stroke: "#05080d", strokeThickness: 4 })
      .setOrigin(0.5);
    this.add
      .text(cx, 120, "Elemental Tower Defense", { fontFamily: FONTS.body, fontSize: "18px", color: "#a8c0d8" })
      .setOrigin(0.5);

    this.add
      .text(cx, 172, "Select a Stronghold", { fontFamily: FONTS.display, fontSize: "18px", color: "#cda86a" })
      .setOrigin(0.5);

    STRONGHOLDS.forEach((sh, i) => {
      const unlocked = i < save.unlockedStrongholds;
      const cleared = i <= save.highestCleared;
      const y = 210 + i * 52;
      const tint = unlocked ? (cleared ? 0x2f7d5a : 0x2f5a7d) : 0x2a2f38;
      const frame = makePanel(this, "ui.button", cx - 180, y - 21, 360, 42).setTint(tint).setAlpha(unlocked ? 0.95 : 0.7);
      const status = cleared ? "✓ cleared" : unlocked ? "" : "locked";
      const label = this.add
        .text(cx, y, `${i + 1}.  ${sh.name}   ${status}`, {
          fontFamily: FONTS.display,
          fontSize: "20px",
          color: unlocked ? "#ffffff" : "#6a7686",
          fontStyle: "bold",
        })
        .setOrigin(0.5);

      if (unlocked) {
        frame.setInteractive({ useHandCursor: true });
        frame.on("pointerover", () => {
          frame.setAlpha(1);
          audio.playUI("hover");
          this.tweens.add({ targets: [frame, label], scaleX: 1.03, scaleY: 1.03, duration: 90 });
        });
        frame.on("pointerout", () => {
          frame.setAlpha(0.95);
          this.tweens.add({ targets: [frame, label], scaleX: 1, scaleY: 1, duration: 90 });
        });
        frame.on("pointerdown", () => {
          audio.playUI("confirm");
          this.scene.start(SceneKeys.Game, { strongholdIndex: i });
        });
      } else {
        // Animate a locked → unlocked reveal if this just unlocked.
        if (i === save.unlockedStrongholds) {
          this.tweens.add({ targets: frame, alpha: { from: 0.4, to: 0.7 }, yoyo: true, repeat: 2, duration: 300 });
        }
      }
    });

    // Settings (gear) button.
    const gear = this.add
      .text(GAME_WIDTH - 16, 16, "⚙ Settings", { fontFamily: FONTS.body, fontSize: "15px", color: "#a8c0d8" })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    gear.on("pointerover", () => audio.playUI("hover"));
    gear.on("pointerdown", () => {
      audio.playUI("click");
      const panel = openSettings(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, () => panel.destroy());
    });

    const reset = this.add
      .text(GAME_WIDTH - 12, GAME_HEIGHT - 14, "reset progress", { fontFamily: FONTS.body, fontSize: "12px", color: "#54637a" })
      .setOrigin(1, 1)
      .setInteractive({ useHandCursor: true });
    reset.on("pointerdown", () => {
      resetProgress();
      this.scene.restart();
    });

    this.add.text(12, GAME_HEIGHT - 14, "v0.3", { fontFamily: FONTS.body, fontSize: "12px", color: "#54637a" }).setOrigin(0, 1);
  }

  private spawnMotes(): void {
    for (let i = 0; i < 22; i++) {
      const m = this.add
        .image(Math.random() * GAME_WIDTH, Math.random() * GAME_HEIGHT, "effect.mote")
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(-5)
        .setAlpha(0.1 + Math.random() * 0.25)
        .setScale(0.3 + Math.random() * 0.6)
        .setTint(0x6fb0ff);
      this.tweens.add({
        targets: m,
        y: m.y - (40 + Math.random() * 80),
        x: m.x + (Math.random() * 40 - 20),
        alpha: 0,
        duration: 6000 + Math.random() * 6000,
        repeat: -1,
        repeatDelay: Math.random() * 2000,
        onRepeat: () => {
          m.y = GAME_HEIGHT + 10;
          m.x = Math.random() * GAME_WIDTH;
          m.setAlpha(0.1 + Math.random() * 0.25);
        },
      });
    }
  }

  override update(_t: number, delta: number): void {
    this.bg?.update(delta);
  }
}
