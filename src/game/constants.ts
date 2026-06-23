// Bastion Protocol — shared rendering constants.

// The play grid for Stronghold 1 is 16x11 @ 44px = 704 x 484.
// We reserve a side panel + top HUD band around it.
export const PLAYFIELD_WIDTH = 704;
export const PLAYFIELD_HEIGHT = 484;

export const TOP_HUD_HEIGHT = 56;
export const SIDE_PANEL_WIDTH = 256;

export const GAME_WIDTH = PLAYFIELD_WIDTH + SIDE_PANEL_WIDTH;
export const GAME_HEIGHT = PLAYFIELD_HEIGHT + TOP_HUD_HEIGHT;

// Scene keys.
export const SceneKeys = {
  Boot: "BootScene",
  Preload: "PreloadScene",
  MainMenu: "MainMenuScene",
  Game: "GameScene",
  Hud: "HudScene",
} as const;

// Tile colors for rendering the grid.
export const TileColors = {
  buildable: 0x1b2536,
  buildableEdge: 0x2a3a52,
  path: 0x342a1f,
  pathEdge: 0x4a3a28,
  spawn: 0x5a2030,
  core: 0x1f5a4a,
  hover: 0x2f4a6e,
} as const;
