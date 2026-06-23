import Phaser from "phaser";
import { GridConfig, GridCoord, Point, tileCenter, distance } from "../logic/grid";
import {
  CollectorMode,
  CollectorStats,
  collectorStats,
  DeviceCategory,
  DEVICE_BASE_COST,
} from "../logic/devices";

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
  private readonly core: Phaser.GameObjects.Arc;
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, grid: GridConfig, coord: GridCoord, mode: CollectorMode) {
    this.coord = coord;
    this.mode = mode;
    this.center = tileCenter(grid, coord);
    this.stats = collectorStats(mode);

    this.rangeCircle = scene.add
      .circle(this.center.x, this.center.y, this.stats.radius, this.color(), 0.05)
      .setStrokeStyle(1.5, this.color(), 0.4)
      .setVisible(false)
      .setDepth(7);

    const base = scene.add.rectangle(0, 0, grid.tileSize - 12, grid.tileSize - 12, 0x1c2738).setStrokeStyle(2, this.color(), 0.9);
    this.core = scene.add.circle(0, 0, 8, this.color());
    this.label = scene.add.text(0, 0, this.modeGlyph(), { fontSize: "12px", color: "#0a0e14", fontStyle: "bold" }).setOrigin(0.5);
    this.container = scene.add.container(this.center.x, this.center.y, [base, this.core, this.label]).setDepth(11);
  }

  private color(): number {
    return this.mode === CollectorMode.Cog ? COG_COLOR : SURGE_COLOR;
  }

  private modeGlyph(): string {
    return this.mode === CollectorMode.Cog ? "¢" : "⚡";
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
    this.core.setFillStyle(this.color());
    this.label.setText(this.modeGlyph());
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
