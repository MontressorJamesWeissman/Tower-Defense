import Phaser from "phaser";
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  PLAYFIELD_WIDTH,
  TOP_HUD_HEIGHT,
  TileColors,
  SceneKeys,
} from "../constants";
import {
  GridConfig,
  GridCoord,
  TileType,
  pointToCoord,
  tileCenter,
  pathToWaypoints,
  coordsEqual,
} from "../logic/grid";
import { STRONGHOLD_1, buildTileMap } from "../logic/strongholds";

/**
 * GridScene — renders one Stronghold's grid, buildable tiles, and enemy path.
 * (Milestone 2: layout + path rendering. Combat systems are layered on in
 * later milestones.)
 */
export class GridScene extends Phaser.Scene {
  private grid!: GridConfig;
  private tileMap!: TileType[][];
  private hoverCoord: GridCoord | null = null;
  private hoverRect!: Phaser.GameObjects.Rectangle;

  constructor() {
    super(SceneKeys.Grid);
  }

  create(): void {
    const def = STRONGHOLD_1;
    // Render-adjusted grid: shift down to leave room for the top HUD band.
    this.grid = { ...def.grid, originX: 0, originY: TOP_HUD_HEIGHT };
    this.tileMap = buildTileMap(def);

    this.drawBackground();
    this.drawTiles();
    this.drawPath();
    this.drawCoreAndSpawns();
    this.drawHud();

    this.hoverRect = this.add
      .rectangle(0, 0, this.grid.tileSize, this.grid.tileSize, TileColors.hover, 0.4)
      .setStrokeStyle(2, 0x4fd1c5, 0.9)
      .setVisible(false)
      .setDepth(50);

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => this.onPointerMove(p));

    this.input.keyboard?.on("keydown-ESC", () => this.scene.start(SceneKeys.MainMenu));
  }

  private drawBackground(): void {
    // Top HUD band.
    this.add.rectangle(0, 0, GAME_WIDTH, TOP_HUD_HEIGHT, 0x0d141f).setOrigin(0, 0).setDepth(40);
    // Right side panel.
    this.add
      .rectangle(PLAYFIELD_WIDTH, 0, GAME_WIDTH - PLAYFIELD_WIDTH, GAME_HEIGHT, 0x0d141f)
      .setOrigin(0, 0)
      .setDepth(40);
  }

  private drawTiles(): void {
    const { cols, rows, tileSize } = this.grid;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const type = this.tileMap[row][col];
        const center = tileCenter(this.grid, { col, row });
        const { fill, edge } = this.tileStyle(type);
        this.add
          .rectangle(center.x, center.y, tileSize - 2, tileSize - 2, fill)
          .setStrokeStyle(1, edge, 0.8);
      }
    }
  }

  private tileStyle(type: TileType): { fill: number; edge: number } {
    switch (type) {
      case TileType.Path:
        return { fill: TileColors.path, edge: TileColors.pathEdge };
      case TileType.Spawn:
        return { fill: TileColors.spawn, edge: TileColors.pathEdge };
      case TileType.Core:
        return { fill: TileColors.core, edge: 0x39a08a };
      case TileType.Buildable:
      default:
        return { fill: TileColors.buildable, edge: TileColors.buildableEdge };
    }
  }

  private drawPath(): void {
    for (const path of STRONGHOLD_1.paths) {
      const waypoints = pathToWaypoints(this.grid, path);
      const g = this.add.graphics({ x: 0, y: 0 }).setDepth(5);
      g.lineStyle(6, 0x6a5238, 0.5);
      g.beginPath();
      g.moveTo(waypoints[0].x, waypoints[0].y);
      for (let i = 1; i < waypoints.length; i++) g.lineTo(waypoints[i].x, waypoints[i].y);
      g.strokePath();
    }
  }

  private drawCoreAndSpawns(): void {
    const def = STRONGHOLD_1;
    const core = tileCenter(this.grid, def.coreCoord);
    this.add.circle(core.x, core.y, 14, 0x39a08a).setDepth(6);
    this.add
      .text(core.x, core.y, "◆", { fontSize: "18px", color: "#d6fff2" })
      .setOrigin(0.5)
      .setDepth(7);

    for (const path of def.paths) {
      const s = tileCenter(this.grid, path[0]);
      this.add.circle(s.x, s.y, 12, 0xb03048).setDepth(6);
      this.add
        .text(s.x, s.y, "⮞", { fontSize: "16px", color: "#ffd6de" })
        .setOrigin(0.5)
        .setDepth(7);
    }
  }

  private drawHud(): void {
    this.add
      .text(12, TOP_HUD_HEIGHT / 2, `${STRONGHOLD_1.name}`, {
        fontSize: "18px",
        color: "#4fd1c5",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5)
      .setDepth(41);

    this.add
      .text(GAME_WIDTH / 2, TOP_HUD_HEIGHT / 2, "SETUP PHASE", {
        fontSize: "16px",
        color: "#e6c14f",
      })
      .setOrigin(0.5)
      .setDepth(41);

    this.add
      .text(PLAYFIELD_WIDTH + 16, 16, "Device Panel\n(coming next milestone)", {
        fontSize: "14px",
        color: "#8aa0b8",
      })
      .setDepth(41);

    this.add
      .text(GAME_WIDTH - 12, GAME_HEIGHT - 12, "ESC: menu", {
        fontSize: "12px",
        color: "#54637a",
      })
      .setOrigin(1, 1)
      .setDepth(41);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    const coord = pointToCoord(this.grid, { x: pointer.worldX, y: pointer.worldY });
    if (!coord || this.tileMap[coord.row]?.[coord.col] !== TileType.Buildable) {
      this.hoverRect.setVisible(false);
      this.hoverCoord = null;
      return;
    }
    if (this.hoverCoord && coordsEqual(this.hoverCoord, coord)) return;
    this.hoverCoord = coord;
    const center = tileCenter(this.grid, coord);
    this.hoverRect.setPosition(center.x, center.y).setVisible(true);
  }
}
