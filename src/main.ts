import Phaser from "phaser";
import { BootScene } from "./game/scenes/BootScene";
import { MainMenuScene } from "./game/scenes/MainMenuScene";
import { GameScene } from "./game/scenes/GameScene";
import { HudScene } from "./game/scenes/HudScene";
import { GAME_WIDTH, GAME_HEIGHT } from "./game/constants";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-root",
  backgroundColor: "#0a0e14",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    pixelArt: false,
    antialias: true,
  },
  scene: [BootScene, MainMenuScene, GameScene, HudScene],
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
