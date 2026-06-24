import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT, TOP_HUD_HEIGHT, TileColors, SceneKeys } from "../constants";
import {
  GridConfig,
  GridCoord,
  Point,
  TileType,
  pointToCoord,
  tileCenter,
  pathToWaypoints,
  coordKey,
  coordsEqual,
  distance,
} from "../logic/grid";
import { StrongholdDef, buildTileMap } from "../logic/strongholds";
import { ENEMY_DEFS } from "../logic/enemies";
import { buildSpawnSchedule, SpawnEvent, waveEnemyCount } from "../logic/waves";
import { Charge, CHARGE_META } from "../logic/elements";
import { ReactionDefinition, ReactionKind } from "../logic/reactions";
import { takeDamage, applyCharge, applyFreeze, stripShield } from "../logic/combat";
import {
  CollectorMode,
  DeviceCategory,
  DEVICE_BASE_COST,
  TurretUpgrade,
  TrapUpgrade,
} from "../logic/devices";
import { addCogs, addSurge, spend, killReward, sellRefund } from "../logic/economy";
import {
  AbilityKind,
  ABILITIES,
  isReady,
  triggerCooldown,
} from "../logic/abilities";
import { RunState } from "../state/RunState";
import { recordClear } from "../state/save";
import { STRONGHOLDS } from "../logic/strongholds";
import { audio } from "../audio/AudioManager";
import { Vfx } from "../fx/Vfx";
import { Parallax } from "../render/Parallax";
import { AssetKeys } from "../assets/manifest";
import { fitSprite } from "../render/sprites";
import { FONTS } from "../render/fonts";
import { settings } from "../state/settings";
import { Enemy } from "../entities/Enemy";
import { Turret } from "../entities/Turret";
import { Trap } from "../entities/Trap";
import { Collector } from "../entities/Collector";
import type { CombatContext, DamageOptions } from "../entities/types";
import type { HudScene } from "./HudScene";

export type BuildSelection =
  | { kind: "turret"; charge: Charge }
  | { kind: "trap"; charge: Charge }
  | { kind: "collector"; mode: CollectorMode };

type PlacedDevice = Turret | Trap | Collector;

interface LingerZone {
  x: number;
  y: number;
  radius: number;
  untilMs: number;
  nextTickMs: number;
  dps: number;
  slow: number;
  gfx: Phaser.GameObjects.Arc;
}

export interface PanelData {
  title: string;
  color: string;
  lines: string[];
  upgrades: { id: string; label: string; cost: number; affordable: boolean }[];
  canToggleMode: boolean;
  sellValue: number;
}

/** GameScene — owns the simulation, grid input, devices, enemies, and abilities. */
export class GameScene extends Phaser.Scene {
  private def!: StrongholdDef;
  private grid!: GridConfig;
  private tileMap!: TileType[][];
  private pathWaypoints!: Point[][];
  run!: RunState;

  private readonly occupied = new Set<string>();
  private turrets: Turret[] = [];
  private traps: Trap[] = [];
  private collectors: Collector[] = [];
  private enemies: Enemy[] = [];
  private zones: LingerZone[] = [];

  private buildSelection: BuildSelection | null = null;
  private selected: PlacedDevice | null = null;
  private pendingAbility: AbilityKind | null = null;

  private schedule: SpawnEvent[] = [];
  private spawnCursor = 0;
  private waveElapsedMs = 0;
  private spawnedCount = 0;

  private hoverRect!: Phaser.GameObjects.Rectangle;
  private hud!: HudScene;
  private vfx!: Vfx;
  private bg?: Parallax;
  private paused = false;

  constructor() {
    super(SceneKeys.Game);
  }

  init(data: { strongholdIndex?: number }): void {
    const idx = data.strongholdIndex ?? 0;
    this.def = STRONGHOLDS[Math.min(idx, STRONGHOLDS.length - 1)];
  }

  create(): void {
    this.resetState();
    this.run = new RunState(this.def);
    this.grid = { ...this.def.grid, originX: 0, originY: TOP_HUD_HEIGHT };
    this.tileMap = buildTileMap(this.def);
    this.pathWaypoints = this.def.paths.map((p) => pathToWaypoints(this.grid, p));

    this.drawStaticBoard();
    this.vfx = new Vfx(this);
    this.spawnAmbientMotes();
    audio.startMusic("setup");

    this.hoverRect = this.add
      .rectangle(0, 0, this.grid.tileSize, this.grid.tileSize, TileColors.hover, 0.35)
      .setStrokeStyle(2, 0x4fd1c5, 0.9)
      .setVisible(false)
      .setDepth(50);

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.input.keyboard?.on("keydown-ESC", () => this.onEscape());
    for (const k of Object.values(AbilityKind)) {
      const def = ABILITIES[k];
      this.input.keyboard?.on(`keydown-${this.keyName(def.hotkey)}`, () => this.requestAbility(k));
    }

    this.scene.launch(SceneKeys.Hud, { strongholdIndex: STRONGHOLDS.indexOf(this.def) });
    this.hud = this.scene.get(SceneKeys.Hud) as unknown as HudScene;
  }

  private resetState(): void {
    this.occupied.clear();
    this.turrets = [];
    this.traps = [];
    this.collectors = [];
    this.enemies = [];
    this.zones = [];
    this.buildSelection = null;
    this.selected = null;
    this.pendingAbility = null;
    this.spawnCursor = 0;
    this.waveElapsedMs = 0;
    this.spawnedCount = 0;
    this.paused = false;
  }

  private keyName(hotkey: string): string {
    // Maps "1".."6" to Phaser key event names.
    const map: Record<string, string> = {
      "1": "ONE",
      "2": "TWO",
      "3": "THREE",
      "4": "FOUR",
      "5": "FIVE",
      "6": "SIX",
    };
    return map[hotkey] ?? hotkey.toUpperCase();
  }

  // -------------------------------------------------------------------------
  // Static board rendering
  // -------------------------------------------------------------------------

  private drawStaticBoard(): void {
    this.drawBackground();

    // Top HUD band + side panel backing (9-slice framing layered on in HudScene).
    this.add.rectangle(0, 0, GAME_WIDTH, TOP_HUD_HEIGHT, 0x0d141f, 0.92).setOrigin(0, 0).setDepth(1);
    this.add
      .rectangle(PLAYFIELD_WIDTH, 0, GAME_WIDTH - PLAYFIELD_WIDTH, GAME_HEIGHT, 0x0d141f, 0.92)
      .setOrigin(0, 0)
      .setDepth(1);

    // Tileset-sprite map (code-generated from the StrongholdDef level format).
    const tilesetKey = AssetKeys.tileset(this.def.id);
    const { cols, rows, tileSize } = this.grid;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const type = this.tileMap[row][col];
        const c = tileCenter(this.grid, { col, row });
        const tile = this.add.image(c.x, c.y, tilesetKey, this.tileFrame(type)).setDepth(2);
        fitSprite(tile, tileSize);
      }
    }

    // Spawn + core markers (kept as clear gameplay indicators on top of tiles).
    for (const path of this.def.paths) {
      const s = tileCenter(this.grid, path[0]);
      this.add.circle(s.x, s.y, 12, 0xb03048).setDepth(4).setStrokeStyle(2, 0xffd6de, 0.8);
    }
    const core = tileCenter(this.grid, this.def.coreCoord);
    this.add.circle(core.x, core.y, 15, 0x39a08a).setDepth(4);
    this.add.text(core.x, core.y, "◆", { fontSize: "20px", color: "#d6fff2" }).setOrigin(0.5).setDepth(5);
  }

  private drawBackground(): void {
    this.bg = new Parallax(this, 0, TOP_HUD_HEIGHT, PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT, [
      { key: AssetKeys.bgSky(this.def.id), speedX: 4, alpha: 1 },
      { key: AssetKeys.bgMid(this.def.id), speedX: 11, alpha: 0.9 },
    ], -10);
  }

  /** Subtle drifting motes over the playfield for ambient depth. */
  private spawnAmbientMotes(): void {
    if (settings.reduceVfx) return;
    const count = 14;
    for (let i = 0; i < count; i++) {
      const x = Math.random() * PLAYFIELD_WIDTH;
      const y = TOP_HUD_HEIGHT + Math.random() * PLAYFIELD_HEIGHT;
      const m = this.add
        .image(x, y, "effect.mote")
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(3)
        .setAlpha(0.08 + Math.random() * 0.18)
        .setScale(0.25 + Math.random() * 0.5)
        .setTint(0x9fd0ff);
      this.tweens.add({
        targets: m,
        y: y - (30 + Math.random() * 60),
        x: x + (Math.random() * 30 - 15),
        alpha: 0,
        duration: 5000 + Math.random() * 5000,
        repeat: -1,
        repeatDelay: Math.random() * 1500,
        onRepeat: () => {
          m.setPosition(Math.random() * PLAYFIELD_WIDTH, TOP_HUD_HEIGHT + PLAYFIELD_HEIGHT).setAlpha(0.08 + Math.random() * 0.18);
        },
      });
    }
  }

  /** Map a tile type to its tileset frame index (see PLACEHOLDERS.md tileset notes). */
  private tileFrame(type: TileType): number {
    switch (type) {
      case TileType.Path:
      case TileType.Spawn:
      case TileType.Core:
        return 1; // path
      case TileType.Blocked:
        return 5; // blocked
      default:
        return 3; // buildable
    }
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  private inPlayfield(p: Phaser.Input.Pointer): boolean {
    return p.worldX < PLAYFIELD_WIDTH && p.worldY > TOP_HUD_HEIGHT;
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    if (!this.inPlayfield(p)) {
      this.hoverRect.setVisible(false);
      return;
    }
    const coord = pointToCoord(this.grid, { x: p.worldX, y: p.worldY });
    if (!coord) {
      this.hoverRect.setVisible(false);
      return;
    }
    const c = tileCenter(this.grid, coord);
    const ok = this.buildSelection ? this.canPlace(this.buildSelection, coord) : false;
    this.hoverRect
      .setPosition(c.x, c.y)
      .setStrokeStyle(2, this.buildSelection ? (ok ? 0x5ad17a : 0xe85a5a) : 0x4fd1c5, 0.9)
      .setVisible(true);
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    if (this.paused || this.run.phase === "won" || this.run.phase === "lost") return;
    if (!this.inPlayfield(p)) return;

    if (this.pendingAbility) {
      this.performAbility(this.pendingAbility, { x: p.worldX, y: p.worldY });
      this.pendingAbility = null;
      this.hud.clearAbilityTargeting();
      return;
    }

    const coord = pointToCoord(this.grid, { x: p.worldX, y: p.worldY });
    if (!coord) return;

    if (this.buildSelection) {
      this.tryPlace(this.buildSelection, coord);
      return;
    }
    this.selectDeviceAt(coord);
  }

  private onEscape(): void {
    if (this.pendingAbility) {
      this.pendingAbility = null;
      this.hud.clearAbilityTargeting();
      return;
    }
    if (this.buildSelection) {
      this.setBuildSelection(null);
      return;
    }
    if (this.selected) {
      this.clearSelection();
      return;
    }
    this.togglePause();
  }

  // -------------------------------------------------------------------------
  // HUD-facing API
  // -------------------------------------------------------------------------

  setBuildSelection(sel: BuildSelection | null): void {
    this.buildSelection = sel;
    if (sel) this.clearSelection();
    this.hud.refresh();
  }

  togglePause(): void {
    this.paused = !this.paused;
    this.hud.setPaused(this.paused);
  }

  startWave(): void {
    if (this.run.phase !== "setup") return;
    this.run.phase = "assault";
    this.run.waveStats = this.run.freshWaveStats();
    this.schedule = buildSpawnSchedule(this.run.currentWave);
    this.spawnCursor = 0;
    this.spawnedCount = 0;
    this.waveElapsedMs = 0;
    audio.playFanfare("start");
    audio.startMusic("assault");
    this.hud.refresh();
  }

  advanceAfterSummary(): void {
    if (this.run.phase !== "summary") return;
    this.run.waveIndex++;
    this.run.phase = "setup";
    addCogs(this.run.economy, this.run.currentWave.setupCogs);
    audio.startMusic("setup");
    this.hud.showSummary(null);
    this.hud.refresh();
  }

  requestAbility(kind: AbilityKind): void {
    if (this.paused || this.run.phase === "won" || this.run.phase === "lost") return;
    const def = ABILITIES[kind];
    if (!this.run.unlockedAbilities.has(kind)) return;
    if (!isReady(this.run.cooldowns[kind], this.run.runClockMs)) {
      this.hud.toast("Ability on cooldown");
      return;
    }
    if (this.run.economy.surge < def.surgeCost) {
      this.hud.toast("Not enough Surge");
      return;
    }
    if (def.targeted) {
      this.pendingAbility = kind;
      this.hud.setAbilityTargeting(kind);
    } else {
      this.performAbility(kind, null);
    }
  }

  getSelectionPanel(): PanelData | null {
    const d = this.selected;
    if (!d) return null;
    const econ = this.run.economy;
    if (d instanceof Turret) {
      const meta = CHARGE_META[d.charge];
      return {
        title: `${d.charge} Turret`,
        color: meta.cssColor,
        lines: [
          `DMG ${d.stats.damage}  •  RNG ${d.stats.range}`,
          `Fire ${(1000 / d.stats.cooldownMs).toFixed(1)}/s`,
          d.stats.splashRadius > 0 ? `Splash ${d.stats.splashRadius}` : d.stats.pierce ? "Piercing" : "Single target",
          d.upgrades.length ? `Mods: ${d.upgrades.join(", ")}` : "No mods",
        ],
        upgrades: d.availableUpgrades().map((u) => ({
          id: u.id,
          label: u.id,
          cost: u.cost,
          affordable: econ.cogs >= u.cost,
        })),
        canToggleMode: false,
        sellValue: sellRefund(d.totalInvested),
      };
    }
    if (d instanceof Trap) {
      const meta = CHARGE_META[d.charge];
      return {
        title: `${d.charge} Trap`,
        color: meta.cssColor,
        lines: [
          `DMG ${d.stats.damage}  •  RAD ${d.stats.radius}`,
          [d.stats.pull && "Snare", d.stats.mineLayer && "Mines", d.stats.pulseEmitter && "Pulse"]
            .filter(Boolean)
            .join(", ") || "Persistent step trap",
        ],
        upgrades: d.availableUpgrades().map((u) => ({
          id: u.id,
          label: u.id,
          cost: u.cost,
          affordable: econ.cogs >= u.cost,
        })),
        canToggleMode: false,
        sellValue: sellRefund(d.totalInvested),
      };
    }
    // Collector
    return {
      title: `Collector (${d.mode})`,
      color: d.mode === CollectorMode.Cog ? "#e6c14f" : "#b070ff",
      lines: [
        d.mode === CollectorMode.Cog ? `+${Math.round((d.stats.cogMultiplier - 1) * 100)}% Cogs in radius` : `×${d.stats.surgeMultiplier} Surge in radius`,
        `Radius ${d.stats.radius}`,
        "Same-mode radii don't stack",
      ],
      upgrades: [],
      canToggleMode: true,
      sellValue: sellRefund(d.totalInvested),
    };
  }

  upgradeSelected(id: string): void {
    const d = this.selected;
    if (!d) return;
    if (d instanceof Turret) {
      const opt = d.availableUpgrades().find((u) => u.id === id);
      if (opt && spend(this.run.economy, opt.cost)) {
        d.applyUpgrade(id as TurretUpgrade);
        d.showRange(true);
      } else this.hud.toast("Can't afford upgrade");
    } else if (d instanceof Trap) {
      const opt = d.availableUpgrades().find((u) => u.id === id);
      if (opt && spend(this.run.economy, opt.cost)) {
        d.applyUpgrade(id as TrapUpgrade);
        d.showRange(true);
      } else this.hud.toast("Can't afford upgrade");
    }
    this.hud.refresh();
  }

  toggleSelectedCollectorMode(): void {
    const d = this.selected;
    if (!(d instanceof Collector)) return;
    const newMode = d.mode === CollectorMode.Cog ? CollectorMode.Surge : CollectorMode.Cog;
    // Enforce the no-stacking overlap rule on the target mode.
    if (this.collectorOverlap(d, newMode)) {
      this.hud.toast("Overlaps a same-mode Collector");
      return;
    }
    d.setMode(newMode);
    d.showRange(true);
    this.hud.refresh();
  }

  sellSelected(): void {
    const d = this.selected;
    if (!d) return;
    addCogs(this.run.economy, sellRefund(d.totalInvested));
    this.removeDevice(d);
    this.clearSelection();
    this.hud.refresh();
  }

  // -------------------------------------------------------------------------
  // Placement
  // -------------------------------------------------------------------------

  private canPlace(sel: BuildSelection, coord: GridCoord): boolean {
    if (this.occupied.has(coordKey(coord))) return false;
    const type = this.tileMap[coord.row]?.[coord.col];
    if (sel.kind === "trap") return type === TileType.Path;
    return type === TileType.Buildable;
  }

  private cost(sel: BuildSelection): number {
    return DEVICE_BASE_COST[
      sel.kind === "turret" ? DeviceCategory.Turret : sel.kind === "trap" ? DeviceCategory.Trap : DeviceCategory.Collector
    ];
  }

  private collectorOverlap(candidate: Collector, mode: CollectorMode): boolean {
    return this.collectors.some((c) => c !== candidate && c.mode === mode && candidate.overlaps(c));
  }

  private tryPlace(sel: BuildSelection, coord: GridCoord): void {
    if (!this.canPlace(sel, coord)) {
      this.hud.toast("Can't build there");
      return;
    }
    const cost = this.cost(sel);
    if (this.run.economy.cogs < cost) {
      this.hud.toast("Not enough Cogs");
      return;
    }

    if (sel.kind === "collector") {
      const probe = new Collector(this, this.grid, coord, sel.mode);
      if (this.collectorOverlap(probe, sel.mode)) {
        probe.destroy();
        this.hud.toast("Overlaps a same-mode Collector");
        return;
      }
      spend(this.run.economy, cost);
      this.collectors.push(probe);
      this.finishPlace(coord, probe);
      return;
    }

    spend(this.run.economy, cost);
    if (sel.kind === "turret") {
      const t = new Turret(this, this.grid, coord, sel.charge);
      this.turrets.push(t);
      this.finishPlace(coord, t);
    } else {
      const t = new Trap(this, this.grid, coord, sel.charge);
      this.traps.push(t);
      this.finishPlace(coord, t);
    }
  }

  private finishPlace(coord: GridCoord, device: PlacedDevice): void {
    this.occupied.add(coordKey(coord));
    const center = tileCenter(this.grid, coord);
    const color = "charge" in device ? CHARGE_META[(device as Turret | Trap).charge].color : 0x4fd1c5;
    this.vfx.placementPulse(center.x, center.y, color);
    audio.playUI("confirm");
    this.select(device);
    this.hud.refresh();
  }

  private removeDevice(d: PlacedDevice): void {
    this.occupied.delete(coordKey(d.coord));
    if (d instanceof Turret) this.turrets = this.turrets.filter((x) => x !== d);
    else if (d instanceof Trap) this.traps = this.traps.filter((x) => x !== d);
    else this.collectors = this.collectors.filter((x) => x !== d);
    d.destroy();
  }

  // -------------------------------------------------------------------------
  // Selection
  // -------------------------------------------------------------------------

  private selectDeviceAt(coord: GridCoord): void {
    const all: PlacedDevice[] = [...this.turrets, ...this.traps, ...this.collectors];
    const found = all.find((d) => coordsEqual(d.coord, coord));
    if (found) this.select(found);
    else this.clearSelection();
  }

  private select(d: PlacedDevice): void {
    if (this.selected && this.selected !== d) this.selected.showRange(false);
    this.selected = d;
    d.showRange(true);
    this.hud.refresh();
  }

  private clearSelection(): void {
    if (this.selected) this.selected.showRange(false);
    this.selected = null;
    this.hud.refresh();
  }

  // -------------------------------------------------------------------------
  // CombatContext implementation
  // -------------------------------------------------------------------------

  private context(): CombatContext {
    return {
      now: () => this.run.runClockMs,
      enemiesInRadius: (x, y, r) => this.enemies.filter((e) => e.alive && distance({ x, y }, e.pos()) <= r),
      livingEnemies: () => this.enemies.filter((e) => e.alive),
      hitEnemy: (e, dmg, opts) => this.hitEnemy(e, dmg, opts),
      chargeEnemy: (e, charge) => this.chargeEnemy(e, charge),
      reactionFx: (x, y, r) => this.reactionFx(x, y, r),
      explosionFx: (x, y, r, color) => this.explosionFx(x, y, r, color),
      floatingText: (x, y, t, c) => this.floatingText(x, y, t, c),
      turretFire: (from, to, charge) => this.turretFire(from, to, charge),
    };
  }

  private turretFire(from: Point, to: Point, charge: Charge): void {
    const color = CHARGE_META[charge].color;
    audio.playShot(charge);
    this.vfx.muzzleFlash(from.x, from.y, color);
    this.vfx.bolt(from, to, color, {
      texture: AssetKeys.projectile(charge),
      trail: "projectile.trail",
      onArrive: () => audio.playImpact(charge),
    });
  }

  private hitEnemy(enemy: Enemy, damage: number, opts: DamageOptions = {}): void {
    if (!enemy.alive) return;
    const now = this.run.runClockMs;
    const charge = opts.charge ?? null;

    // Element immunity: heavily reduce damage from the immune charge.
    let dmg = damage;
    if (charge && enemy.state.immuneTo === charge) dmg *= 0.25;

    // Evasion only dodges precise single-target hits (not splash/AoE).
    if (!opts.splash && enemy.def.evasion > 0 && Math.random() < enemy.def.evasion) {
      this.floatingText(enemy.x, enemy.y - 12, "miss", "#9aa7b5");
      return;
    }

    const res = takeDamage(enemy.state, dmg, now, opts.ignoreShield);
    this.run.waveStats.damageDealt += res.hpDamage + res.shieldAbsorbed;
    enemy.redrawHpBar();
    enemy.hitFlash(now);

    // Floating damage number for primary hits.
    const dealt = res.hpDamage + res.shieldAbsorbed;
    if (!opts.silent && dealt > 0) {
      const col = charge ? CHARGE_META[charge].cssColor : "#e6edf3";
      this.floatingText(enemy.x + Phaser.Math.Between(-6, 6), enemy.y - enemy.def.radius - 6, `${Math.round(dealt)}`, col);
    }

    if (charge && !opts.noReaction) {
      const app = applyCharge(enemy.state, charge, now);
      if (app.reaction) this.applyReaction(enemy, app.reaction, app.spreadCharge);
    }

    if (res.killed) this.killEnemy(enemy);
  }

  private chargeEnemy(enemy: Enemy, charge: Charge): void {
    if (!enemy.alive) return;
    const app = applyCharge(enemy.state, charge, this.run.runClockMs);
    if (app.reaction) this.applyReaction(enemy, app.reaction, app.spreadCharge);
  }

  private applyReaction(enemy: Enemy, reaction: ReactionDefinition, spreadCharge: Charge | null): void {
    const now = this.run.runClockMs;
    const e = reaction.effect;
    audio.playReaction(reaction.kind);
    this.reactionFx(enemy.x, enemy.y, reaction);

    if (e.shieldStrip > 0) {
      stripShield(enemy.state, e.shieldStrip);
      enemy.redrawHpBar();
    }
    if (e.freezeMs > 0) applyFreeze(enemy.state, e.freezeMs, now);
    if (e.dotDamage > 0) {
      const ticks = Math.max(1, Math.round(e.dotDurationMs / 500));
      enemy.addDot(e.dotDamage / ticks, ticks, 500, now, e.aoeRadius);
    }
    if (e.knockback > 0) enemy.knockback(e.knockback);

    if (e.spreadsCharge && spreadCharge) {
      for (const other of this.context().enemiesInRadius(enemy.x, enemy.y, e.aoeRadius)) {
        if (other === enemy) continue;
        if (e.knockback > 0) other.knockback(e.knockback);
        this.chargeEnemy(other, spreadCharge);
      }
    }

    if (e.bonusDamage > 0) {
      this.hitEnemy(enemy, e.bonusDamage, { noReaction: true, splash: true });
      if (e.aoeRadius > 0 && !e.spreadsCharge) {
        const inRadius = this.context().enemiesInRadius(enemy.x, enemy.y, e.aoeRadius);
        for (const other of inRadius) {
          if (other === enemy) continue;
          // Short-Circuit only chains to charged enemies.
          if (reaction.kind === ReactionKind.ShortCircuit) {
            if (other.state.activeCharge === null) continue;
            this.hitEnemy(other, e.bonusDamage, { noReaction: true, splash: true, silent: true });
          } else {
            this.hitEnemy(other, e.bonusDamage * 0.6, { noReaction: true, splash: true, silent: true });
          }
        }
      }
    }
  }

  private killEnemy(enemy: Enemy): void {
    if (!enemy.alive && enemy.reachedCore) return;
    enemy.alive = false;
    const reward = this.computeReward(enemy);
    addCogs(this.run.economy, reward.cogs);
    addSurge(this.run.economy, reward.surge);
    this.run.waveStats.cogsEarned += reward.cogs;
    this.run.waveStats.enemiesKilled++;
    audio.playDeath();
    this.floatingText(enemy.x, enemy.y - 10, `+${reward.cogs}`, "#e6c14f");
    this.deathFx(enemy.x, enemy.y, enemy.def.color);
    enemy.die();
  }

  private computeReward(enemy: Enemy) {
    let cogMult = 1;
    let surgeMult = 1;
    for (const c of this.collectors) {
      if (!c.covers(enemy.pos())) continue;
      if (c.mode === CollectorMode.Cog) cogMult = Math.max(cogMult, c.stats.cogMultiplier);
      else surgeMult = Math.max(surgeMult, c.stats.surgeMultiplier);
    }
    return killReward(enemy.def.bounty, cogMult, surgeMult);
  }

  // -------------------------------------------------------------------------
  // Abilities
  // -------------------------------------------------------------------------

  private performAbility(kind: AbilityKind, at: Point | null): void {
    const def = ABILITIES[kind];
    const now = this.run.runClockMs;
    if (!isReady(this.run.cooldowns[kind], now) || this.run.economy.surge < def.surgeCost) return;
    this.run.economy.surge -= def.surgeCost;
    triggerCooldown(this.run.cooldowns[kind], now, def.cooldownMs);
    audio.playAbility();

    const ctx = this.context();
    switch (kind) {
      case AbilityKind.Cinderfall: {
        if (!at) break;
        this.explosionFx(at.x, at.y, def.radius, CHARGE_META[Charge.Ember].color);
        for (const e of ctx.enemiesInRadius(at.x, at.y, def.radius)) this.hitEnemy(e, def.damage, { charge: Charge.Ember, splash: true });
        this.cameras.main.shake(120, 0.006);
        break;
      }
      case AbilityKind.Maelstrom: {
        if (!at) break;
        this.spawnZone(at.x, at.y, def.radius, def.durationMs, def.damage / (def.durationMs / 500), 0.45, 0x3a8dff);
        break;
      }
      case AbilityKind.DeepFreeze: {
        for (const e of this.enemies) if (e.alive) applyFreeze(e.state, def.durationMs, now);
        this.screenFlash(0x9fdcff, 0.25);
        break;
      }
      case AbilityKind.Overcharge: {
        for (const e of [...this.enemies]) {
          if (e.alive && e.state.activeCharge !== null) this.hitEnemy(e, def.damage, { splash: true });
        }
        this.screenFlash(0xffe14f, 0.2);
        break;
      }
      case AbilityKind.Cyclone: {
        if (!at) break;
        for (const e of ctx.enemiesInRadius(at.x, at.y, def.radius)) {
          e.knockback(36);
          this.hitEnemy(e, def.damage, { splash: true });
          if (e.state.activeCharge !== null) {
            const spread = e.state.activeCharge;
            for (const o of ctx.enemiesInRadius(e.x, e.y, 96)) if (o !== e) this.chargeEnemy(o, spread);
          }
        }
        break;
      }
      case AbilityKind.Bulwark: {
        for (const e of this.enemies) if (e.alive && e.state.shield > 0) { e.state.shield = 0; e.redrawHpBar(); }
        this.screenFlash(0xb08850, 0.2);
        break;
      }
    }
    this.hud.refresh();
  }

  private spawnZone(x: number, y: number, radius: number, durationMs: number, dps: number, slow: number, color: number): void {
    const gfx = this.add.circle(x, y, radius, color, 0.15).setStrokeStyle(2, color, 0.5).setDepth(9);
    this.zones.push({ x, y, radius, untilMs: this.run.runClockMs + durationMs, nextTickMs: this.run.runClockMs, dps, slow, gfx });
  }

  // -------------------------------------------------------------------------
  // FX
  // -------------------------------------------------------------------------

  private floatingText(x: number, y: number, text: string, color: string): void {
    const t = this.add.text(x, y, text, { fontSize: "13px", color, fontStyle: "bold" }).setOrigin(0.5).setDepth(70);
    this.tweens.add({ targets: t, y: y - 22, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }

  private reactionFx(x: number, y: number, reaction: ReactionDefinition): void {
    const color = this.reactionColor(reaction.kind);
    const radius = Math.max(40, reaction.effect.aoeRadius || 44);
    this.vfx.reactionBurst(x, y, color, radius);
    this.screenColorPulse(color);
    this.reactionNameCard(x, y, reaction.name, color);
  }

  /** Floating reaction name that pops up in the display font, then fades. */
  private reactionNameCard(x: number, y: number, name: string, color: number): void {
    const css = `#${color.toString(16).padStart(6, "0")}`;
    const t = this.add
      .text(x, y - 22, `${name}!`, {
        fontFamily: FONTS.display,
        fontSize: "18px",
        color: css,
        fontStyle: "bold",
        stroke: "#05080d",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(72)
      .setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 140, ease: "Back.easeOut" });
    this.tweens.add({ targets: t, y: y - 44, alpha: 0, delay: 420, duration: 460, onComplete: () => t.destroy() });
  }

  /** Brief full-screen color wash (fade in ~50ms / out ~250ms). Skipped if VFX reduced. */
  private screenColorPulse(color: number): void {
    if (settings.reduceVfx) return;
    const r = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, color, 0).setOrigin(0, 0).setDepth(80);
    this.tweens.add({
      targets: r,
      alpha: 0.16,
      duration: 50,
      yoyo: true,
      hold: 0,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.tweens.add({ targets: r, alpha: 0, duration: 250, onComplete: () => r.destroy() });
      },
    });
  }

  private reactionColor(kind: ReactionKind): number {
    switch (kind) {
      case ReactionKind.VaporBurst: return 0xff9a5a;
      case ReactionKind.ThawSnap: return 0xffd0a0;
      case ReactionKind.Solidify: return 0x9fdcff;
      case ReactionKind.ShortCircuit: return 0xffe14f;
      case ReactionKind.Combust: return 0xff6a3c;
      case ReactionKind.Vortex: return 0x5ad17a;
      case ReactionKind.FortifyBreak: return 0xb08850;
      default: return 0xffffff;
    }
  }

  private explosionFx(x: number, y: number, radius: number, color: number): void {
    this.vfx.shockwave(x, y, color, radius, 320, 0.7);
    this.vfx.burst(x, y, color, 10, radius * 0.6, 0.55, 380);
  }

  private deathFx(x: number, y: number, color: number): void {
    this.vfx.death(x, y, color);
  }

  private screenFlash(color: number, alpha: number): void {
    if (settings.reduceVfx) return;
    const r = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, color, alpha).setOrigin(0, 0).setDepth(80);
    this.tweens.add({ targets: r, alpha: 0, duration: 280, onComplete: () => r.destroy() });
  }

  // -------------------------------------------------------------------------
  // Main loop
  // -------------------------------------------------------------------------

  override update(_time: number, delta: number): void {
    // Background drifts continuously, even while paused / between phases.
    this.bg?.update(delta);
    if (this.paused || this.run.phase === "won" || this.run.phase === "lost" || this.run.phase === "summary") {
      return;
    }
    const dt = Math.min(delta, 50); // clamp to avoid huge steps on tab refocus
    this.run.runClockMs += dt;

    const ctx = this.context();

    if (this.run.phase === "assault") {
      this.tickSpawner(dt);
    }

    // Zones (lingering ability effects).
    this.tickZones(ctx);

    // Devices fire only during assault.
    if (this.run.phase === "assault") {
      for (const t of this.turrets) t.update(ctx, this.run.runClockMs);
      for (const t of this.traps) t.update(ctx, this.run.runClockMs);
    }

    // Enemies.
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.update(ctx, dt, this.run.runClockMs);
      if (e.reachedCore) this.onBreach(e);
    }
    this.enemies = this.enemies.filter((e) => e.alive);

    if (this.run.phase === "assault") this.checkWaveEnd();

    this.hud.tick();
  }

  private tickSpawner(_dt: number): void {
    this.waveElapsedMs += _dt;
    while (this.spawnCursor < this.schedule.length && this.schedule[this.spawnCursor].timeMs <= this.waveElapsedMs) {
      const ev = this.schedule[this.spawnCursor++];
      const def = ENEMY_DEFS[ev.kind];
      const wp = this.pathWaypoints[ev.spawnIndex] ?? this.pathWaypoints[0];
      this.enemies.push(new Enemy(this, def, wp, this.run.runClockMs));
      this.spawnedCount++;
    }
  }

  private tickZones(ctx: CombatContext): void {
    const now = this.run.runClockMs;
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      const doTick = now >= z.nextTickMs;
      if (doTick) z.nextTickMs += 500;
      for (const e of ctx.enemiesInRadius(z.x, z.y, z.radius)) {
        e.applySlow(z.slow, 600, now);
        if (doTick) this.hitEnemy(e, z.dps * 0.5, { noReaction: true, splash: true });
      }
      if (now >= z.untilMs) {
        z.gfx.destroy();
        this.zones.splice(i, 1);
      }
    }
  }

  private onBreach(enemy: Enemy): void {
    this.run.coreIntegrity = Math.max(0, this.run.coreIntegrity - enemy.def.breachDamage);
    this.run.waveStats.breaches += enemy.def.breachDamage;
    audio.playCoreDamage();
    if (!settings.reduceVfx) this.cameras.main.shake(160, 0.01);
    this.screenFlash(0xe85a5a, 0.2);
    if (this.run.coreIntegrity <= 0) this.loseRun();
  }

  private checkWaveEnd(): void {
    const allSpawned = this.spawnCursor >= this.schedule.length;
    if (allSpawned && this.enemies.length === 0 && this.run.coreIntegrity > 0) {
      this.winWave();
    }
  }

  private winWave(): void {
    audio.playFanfare("clear");
    if (this.run.isFinalWave) {
      this.run.phase = "won";
      audio.stopMusic();
      recordClear(STRONGHOLDS.indexOf(this.def), STRONGHOLDS.length);
      this.hud.showEndScreen(true);
    } else {
      this.run.phase = "summary";
      this.hud.showSummary({ ...this.run.waveStats });
    }
  }

  private loseRun(): void {
    this.run.phase = "lost";
    audio.playCoreDamage();
    audio.stopMusic();
    for (const e of this.enemies) e.destroy();
    this.enemies = [];
    this.hud.showEndScreen(false);
  }

  // Helpers for HUD queries.
  totalEnemiesThisWave(): number {
    return this.run.phase === "assault" ? waveEnemyCount(this.run.currentWave) : 0;
  }
  enemiesRemaining(): number {
    return this.enemies.length + (this.schedule.length - this.spawnCursor);
  }
  isPaused(): boolean {
    return this.paused;
  }
  hasBuildSelection(): BuildSelection | null {
    return this.buildSelection;
  }

  restart(): void {
    this.scene.stop(SceneKeys.Hud);
    this.scene.restart();
  }

  toMenu(): void {
    this.scene.stop(SceneKeys.Hud);
    this.scene.start(SceneKeys.MainMenu);
  }

  nextStronghold(): void {
    const idx = STRONGHOLDS.indexOf(this.def);
    this.scene.stop(SceneKeys.Hud);
    if (idx + 1 < STRONGHOLDS.length) this.scene.restart({ strongholdIndex: idx + 1 });
    else this.scene.start(SceneKeys.MainMenu);
  }
}
