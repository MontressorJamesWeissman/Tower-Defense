import Phaser from "phaser";
import { SceneKeys, GAME_WIDTH, GAME_HEIGHT } from "../constants";
import { ASSETS, animKey, entriesOfType, SheetAsset } from "../assets/manifest";
import { makeImagePlaceholder, makeSheetPlaceholder } from "../assets/placeholders";

/**
 * PreloadScene — manifest-driven asset loader.
 *
 * Attempts to load every visual asset from its manifest path. Any that 404
 * (i.e. real art not supplied yet) falls back to a generated labeled
 * placeholder under the same key, so swapping in a real file is a pure
 * drop-in with no code change. Spritesheet animations are registered from the
 * manifest so they work on placeholders and real art alike.
 *
 * Audio is left to the Tone.js synth engine for now; file-based streaming is a
 * later milestone, but the manifest already declares the audio slots.
 */
export class PreloadScene extends Phaser.Scene {
  private readonly failed = new Set<string>();

  constructor() {
    super(SceneKeys.Preload);
  }

  preload(): void {
    // Resolve asset paths against the Vite base URL so they work both locally
    // and under the GitHub Pages subpath.
    this.load.setBaseURL(import.meta.env.BASE_URL);

    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      this.failed.add(file.key);
    });

    this.drawLoadingBar();

    for (const [key, a] of Object.entries(ASSETS)) {
      if (a.type === "image" || a.type === "panel") {
        this.load.image(key, a.path);
      } else if (a.type === "spritesheet") {
        this.load.spritesheet(key, a.path, { frameWidth: a.frameWidth, frameHeight: a.frameHeight });
      }
      // audio: handled by the synth engine for now (see AudioManager).
    }
  }

  create(): void {
    // Fill any gaps with generated placeholders.
    for (const [key, a] of Object.entries(ASSETS)) {
      if (a.type === "image" || a.type === "panel") {
        if (this.failed.has(key) || !this.textures.exists(key)) makeImagePlaceholder(this, key, a);
      } else if (a.type === "spritesheet") {
        if (this.failed.has(key) || !this.textures.exists(key)) makeSheetPlaceholder(this, key, a);
      }
    }

    this.registerAnims();
    this.scene.start(SceneKeys.MainMenu);
  }

  /** Build all spritesheet animations declared in the manifest. */
  private registerAnims(): void {
    for (const [key, a] of entriesOfType("spritesheet")) {
      const sheet = a as SheetAsset;
      for (const [name, spec] of Object.entries(sheet.anims)) {
        const k = animKey(key, name);
        if (this.anims.exists(k)) continue;
        // Clamp frame range to the placeholder/real frame count.
        const end = Math.min(spec.end, sheet.frameCount - 1);
        this.anims.create({
          key: k,
          frames: this.anims.generateFrameNumbers(key, { start: spec.start, end }),
          frameRate: spec.frameRate,
          repeat: spec.repeat,
        });
      }
    }
  }

  private drawLoadingBar(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.add.text(cx, cy - 30, "BASTION PROTOCOL", { fontSize: "28px", color: "#4fd1c5", fontStyle: "bold" }).setOrigin(0.5);
    const w = 320;
    const bar = this.add.rectangle(cx, cy + 10, 2, 10, 0x4fd1c5).setOrigin(0, 0.5);
    this.add.rectangle(cx, cy + 10, w, 10).setStrokeStyle(1, 0x4fd1c5, 0.5);
    bar.setX(cx - w / 2);
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => bar.setSize(Math.max(2, w * p), 10));
  }
}
