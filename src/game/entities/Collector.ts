import Phaser from "phaser";
import { GridConfig, GridCoord, Point, tileCenter, distance } from "../logic/grid";
import {
  CollectorMode,
  CollectorStats,
  collectorStats,
  DeviceCategory,
  DEVICE_BASE_COST,
} from "../logic/devices";
import { fitSprite } from "../render/sprites";

const COG_COLOR = 0xe6c14f;
const SURGE_COLOR = 0xb070ff;

/** A non-combat Collector device that boosts kill rewards in its radius. */
export class Collector {
  readonly category = DeviceCategory.Collector;
  readonly coord: GridCoord;
  readonly center: Point;
  mode: CollectorMode;
  stats: CollectorStats;
  readonly investedCosts: number[] = [];

  private readonly container: Phaser.GameObjects.Container;
  private readonly rangeCircle: Phaser.GameObjects.Arc;
  private readonly icon: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, grid: GridConfig, coord: GridCoord, mode: CollectorMode) {
    this.coord = coord;
    this.mode = mode;
    this.center = tileCenter(grid, coord);
    this.stats = collectorStats(mode);
    const size = grid.tileSize;

    this.rangeCircle = scene.add
      .circle(this.center.x, this.center.y, this.stats.radius, this.color(), 0.05)
      .setStrokeStyle(1.5, this.color(), 0.4)
      .setVisible(false)
      .setDepth(7);

    const base = scene.add.sprite(0, 0, "turret.base");
    fitSprite(base, size);
    this.icon = scene.add.sprite(0, 0, this.iconKey());
    fitSprite(this.icon, size * 0.62);
    this.container = scene.add.container(this.center.x, this.center.y, [base, this.icon]).setDepth(11);
  }

  private color(): number {
    return this.mode === CollectorMode.Cog ? COG_COLOR : SURGE_COLOR;
  }

  private iconKey(): string {
    return this.mode === CollectorMode.Cog ? "icon.cog" : "icon.surge";
  }

  get totalInvested(): number {
    return DEVICE_BASE_COST[this.category] + this.investedCosts.reduce((a, b) => a + b, 0);
  }

  covers(p: Point): boolean {
    return distance(this.center, p) <= this.stats.radius;
  }

  /** True if this collector's radius overlaps another's (centre within sum of radii). */
  overlaps(other: Collector): boolean {
    return distance(this.center, other.center) < this.stats.radius + other.stats.radius;
  }

  setMode(mode: CollectorMode): void {
    this.mode = mode;
    this.stats = collectorStats(mode);
    this.icon.setTexture(this.iconKey());
    this.rangeCircle.setStrokeStyle(1.5, this.color(), 0.4).setFillStyle(this.color(), 0.05);
  }

  showRange(v: boolean): void {
    this.rangeCircle.setVisible(v);
  }

  destroy(): void {
    this.rangeCircle.destroy();
    this.container.destroy();
  }
}
