import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, PLAYFIELD_WIDTH, TOP_HUD_HEIGHT, SceneKeys } from "../constants";
import { ALL_CHARGES, CHARGE_META } from "../logic/elements";
import { CollectorMode } from "../logic/devices";
import {
  AbilityKind,
  ABILITIES,
  ALL_ABILITIES,
  cooldownProgress,
  remainingCooldownMs,
} from "../logic/abilities";
import { audio } from "../audio/AudioManager";
import { FONTS } from "../render/fonts";
import { makePanel } from "../render/NineSlice";
import { openSettings } from "../ui/SettingsOverlay";
import { AssetKeys } from "../assets/manifest";
import type { GameScene, BuildSelection } from "./GameScene";
import type { WaveStats } from "../state/RunState";

const PANEL_X = PLAYFIELD_WIDTH + 12;
const PANEL_W = GAME_WIDTH - PLAYFIELD_WIDTH - 24;

interface AbilityButton {
  kind: AbilityKind;
  container: Phaser.GameObjects.Container;
  cdOverlay: Phaser.GameObjects.Rectangle;
  cdText: Phaser.GameObjects.Text;
}

/** HudScene — all in-canvas UI: HUD readouts, build palette, device panel,
 *  ability bar, banners, and the summary/end overlays. */
export class HudScene extends Phaser.Scene {
  private gameScene!: GameScene;

  private cogText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private integrityBar!: Phaser.GameObjects.Graphics;
  private integrityText!: Phaser.GameObjects.Text;
  private surgeBar!: Phaser.GameObjects.Graphics;

  private paletteButtons: { sel: BuildSelection; bg: Phaser.GameObjects.Rectangle }[] = [];
  private startBtn!: Phaser.GameObjects.Container;
  private panelContainer!: Phaser.GameObjects.Container;
  private abilityButtons: AbilityButton[] = [];

  private toastText!: Phaser.GameObjects.Text;
  private displayedCogs = 0;
  private lastPhaseLabel = "";
  private toastUntil = 0;
  private overlay?: Phaser.GameObjects.Container;
  private targetingKind: AbilityKind | null = null;

  constructor() {
    super(SceneKeys.Hud);
  }

  create(): void {
    this.gameScene = this.scene.get(SceneKeys.Game) as unknown as GameScene;

    this.buildTopBar();
    this.buildPalette();
    this.buildStartButton();
    this.panelContainer = this.add.container(0, 0);
    this.buildAbilityBar();

    this.toastText = this.add
      .text(PLAYFIELD_WIDTH / 2, TOP_HUD_HEIGHT + 14, "", {
        fontSize: "15px",
        color: "#ffd24f",
        backgroundColor: "#00000088",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(120)
      .setVisible(false);

    this.refresh();
  }

  // -------------------------------------------------------------------------
  // Static layout
  // -------------------------------------------------------------------------

  private buildTopBar(): void {
    // Painted 9-slice frames behind the top bar and side panel.
    makePanel(this, "ui.hud", 2, 2, PLAYFIELD_WIDTH - 4, TOP_HUD_HEIGHT - 4).setDepth(90).setAlpha(0.95);
    makePanel(this, "ui.panel", PLAYFIELD_WIDTH + 2, 2, GAME_WIDTH - PLAYFIELD_WIDTH - 4, GAME_HEIGHT - 4).setDepth(90).setAlpha(0.95);

    this.add
      .text(12, TOP_HUD_HEIGHT / 2, this.gameScene.run.stronghold.name, {
        fontFamily: FONTS.display,
        fontSize: "18px",
        color: "#4fd1c5",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5)
      .setDepth(100);

    this.phaseText = this.add
      .text(PLAYFIELD_WIDTH / 2, 14, "", { fontFamily: FONTS.display, fontSize: "17px", color: "#e6c14f", fontStyle: "bold" })
      .setOrigin(0.5, 0.5)
      .setDepth(100);
    this.waveText = this.add
      .text(PLAYFIELD_WIDTH / 2, 38, "", { fontFamily: FONTS.body, fontSize: "13px", color: "#8aa0b8" })
      .setOrigin(0.5, 0.5)
      .setDepth(100);

    // Right side: cogs, integrity, surge — each with a painted icon.
    this.add.image(PANEL_X + 8, 17, "icon.cog").setDisplaySize(16, 16).setDepth(101);
    this.cogText = this.add
      .text(PANEL_X + 20, 8, "", { fontFamily: FONTS.body, fontSize: "19px", color: "#e6c14f", fontStyle: "bold" })
      .setDepth(100);

    this.add.image(PANEL_X + 62, 32, "icon.integrity").setDisplaySize(14, 14).setDepth(101);
    this.integrityBar = this.add.graphics().setDepth(100);
    this.integrityText = this.add
      .text(PANEL_X + 70, 32, "", { fontFamily: FONTS.body, fontSize: "12px", color: "#e6edf3" })
      .setOrigin(0, 0.5)
      .setDepth(101);

    this.add.image(PANEL_X + 138, 13, "icon.surge").setDisplaySize(12, 12).setDepth(101);
    this.surgeBar = this.add.graphics().setDepth(100);
    this.add.text(PANEL_X + 148, 8, "Surge", { fontFamily: FONTS.body, fontSize: "11px", color: "#b070ff" }).setDepth(100);
  }

  private buildPalette(): void {
    let y = TOP_HUD_HEIGHT + 12;
    this.add.text(PANEL_X, y, "BUILD", { fontFamily: FONTS.display, fontSize: "13px", color: "#cda86a", fontStyle: "bold" }).setDepth(100);
    y += 18;

    const makeRow = (label: string, builder: (charge: (typeof ALL_CHARGES)[number]) => BuildSelection) => {
      this.add.text(PANEL_X, y, label, { fontFamily: FONTS.body, fontSize: "12px", color: "#8aa0b8" }).setDepth(100);
      y += 16;
      const size = 30;
      const gap = 6;
      ALL_CHARGES.forEach((charge, i) => {
        const meta = CHARGE_META[charge];
        const x = PANEL_X + i * (size + gap) + size / 2;
        const cy = y + size / 2;
        const bg = this.add
          .rectangle(x, cy, size, size, meta.color, 0.22)
          .setStrokeStyle(2, meta.color, 0.9)
          .setInteractive({ useHandCursor: true })
          .setDepth(100);
        const sel = builder(charge);
        bg.on("pointerdown", () => this.onPaletteClick(sel, bg));
        bg.on("pointerover", () => audio.playUI("hover"));
        // Painted charge icon on top of the swatch.
        this.add.image(x, cy, AssetKeys.chargeIcon(charge)).setDisplaySize(size - 6, size - 6).setDepth(101);
        this.paletteButtons.push({ sel, bg });
      });
      y += size + 10;
    };

    makeRow("Turret (charge)", (charge) => ({ kind: "turret", charge }));
    makeRow("Trap (charge, on path)", (charge) => ({ kind: "trap", charge }));

    this.add.text(PANEL_X, y, "Collector", { fontFamily: FONTS.body, fontSize: "12px", color: "#8aa0b8" }).setDepth(100);
    y += 16;
    const modes: { mode: CollectorMode; label: string; color: number }[] = [
      { mode: CollectorMode.Cog, label: "¢ Cog", color: 0xe6c14f },
      { mode: CollectorMode.Surge, label: "⚡ Surge", color: 0xb070ff },
    ];
    modes.forEach((m, i) => {
      const w = 95;
      const x = PANEL_X + i * (w + 8);
      const bg = this.add
        .rectangle(x, y, w, 26, m.color, 0.85)
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0x0a0e14, 1)
        .setInteractive({ useHandCursor: true })
        .setDepth(100);
      const sel: BuildSelection = { kind: "collector", mode: m.mode };
      bg.on("pointerdown", () => this.onPaletteClick(sel, bg));
      this.add.text(x + w / 2, y + 13, m.label, { fontSize: "12px", color: "#0a0e14", fontStyle: "bold" }).setOrigin(0.5).setDepth(101);
      this.paletteButtons.push({ sel, bg });
    });
    this.paletteBottomY = y + 40;
  }

  private paletteBottomY = 0;

  private buildStartButton(): void {
    const y = this.paletteBottomY;
    this.startBtn = this.makeButton(PANEL_X, y, PANEL_W, 34, "▶ START WAVE", 0x2f7d5a, () => this.gameScene.startWave());
    this.startBtn.setDepth(100);
  }

  private buildAbilityBar(): void {
    const size = 34;
    const gap = 4;
    const total = ALL_ABILITIES.length * (size + gap) - gap;
    const startX = PANEL_X + (PANEL_W - total) / 2;
    const y = GAME_HEIGHT - 46;
    this.add.text(PANEL_X, y - 16, "SUPPORT ABILITIES (cooldowns persist)", { fontFamily: FONTS.body, fontSize: "10px", color: "#6f8298" }).setDepth(100);

    ALL_ABILITIES.forEach((kind, i) => {
      const def = ABILITIES[kind];
      const meta = CHARGE_META[def.charge];
      const x = startX + i * (size + gap);
      const bg = this.add
        .rectangle(0, 0, size, size, meta.color, 0.22)
        .setStrokeStyle(2, meta.color, 0.9)
        .setInteractive({ useHandCursor: true });
      const icon = this.add.image(0, -2, AssetKeys.abilityIcon(kind)).setDisplaySize(size - 10, size - 10);
      const hot = this.add.text(size / 2 - 4, size / 2 - 4, def.hotkey, { fontFamily: FONTS.body, fontSize: "9px", color: "#ffffff" }).setOrigin(1, 1);
      const cdOverlay = this.add.rectangle(0, size / 2, size, 0, 0x0a0e14, 0.7).setOrigin(0.5, 1);
      const cdText = this.add.text(0, 0, "", { fontFamily: FONTS.body, fontSize: "12px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);
      const container = this.add.container(x + size / 2, y, [bg, icon, hot, cdOverlay, cdText]).setDepth(100);
      bg.on("pointerdown", () => {
        audio.playUI("click");
        this.gameScene.requestAbility(kind);
      });
      bg.on("pointerover", () => {
        audio.playUI("hover");
        this.toast(`${def.name}: ${def.description}`);
      });
      this.abilityButtons.push({ kind, container, cdOverlay, cdText });
    });
  }

  // -------------------------------------------------------------------------
  // Interaction
  // -------------------------------------------------------------------------

  private onPaletteClick(sel: BuildSelection, bg: Phaser.GameObjects.Rectangle): void {
    audio.playUI("click");
    const current = this.gameScene.hasBuildSelection();
    const same = current && JSON.stringify(current) === JSON.stringify(sel);
    this.gameScene.setBuildSelection(same ? null : sel);
    this.highlightPalette(same ? null : bg);
  }

  private highlightPalette(active: Phaser.GameObjects.Rectangle | null): void {
    for (const b of this.paletteButtons) {
      b.bg.setStrokeStyle(b.bg === active ? 3 : 2, b.bg === active ? 0xffffff : 0x0a0e14, 1);
    }
  }

  private makeButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    color: number,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const bg = makePanel(this, "ui.button", 0, 0, w, h).setTint(color).setAlpha(0.92).setInteractive({ useHandCursor: true });
    const txt = this.add.text(w / 2, h / 2, label, { fontFamily: FONTS.body, fontSize: "14px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);
    const c = this.add.container(x, y, [bg, txt]);
    bg.on("pointerdown", () => {
      audio.playUI("click");
      onClick();
    });
    bg.on("pointerover", () => {
      bg.setAlpha(1);
      audio.playUI("hover");
      this.tweens.add({ targets: c, scaleX: 1.04, scaleY: 1.04, duration: 90, ease: "Quad.easeOut" });
    });
    bg.on("pointerout", () => {
      bg.setAlpha(0.92);
      this.tweens.add({ targets: c, scaleX: 1, scaleY: 1, duration: 90, ease: "Quad.easeOut" });
    });
    return c;
  }

  // -------------------------------------------------------------------------
  // Refresh / per-frame
  // -------------------------------------------------------------------------

  /** Full refresh (event-driven): readouts + selection panel + button states. */
  refresh(): void {
    this.tick();
    this.rebuildPanel();
    this.startBtn.setVisible(this.gameScene.run.phase === "setup");
    if (!this.gameScene.hasBuildSelection()) this.highlightPalette(null);
  }

  /** Cheap per-frame update of live readouts. */
  tick(): void {
    if (!this.cogText) return; // HUD not finished building yet
    const run = this.gameScene.run;

    // Animated Cog counter: ease the displayed value toward the real balance.
    const target = run.economy.cogs;
    if (Math.abs(this.displayedCogs - target) < 1) this.displayedCogs = target;
    else this.displayedCogs += (target - this.displayedCogs) * 0.2;
    this.cogText.setText(`${Math.round(this.displayedCogs)}`);

    const phase = this.phaseLabel();
    if (phase !== this.lastPhaseLabel) {
      this.lastPhaseLabel = phase;
      this.phaseText.setText(phase).setScale(0.6).setAlpha(0.2);
      this.tweens.add({ targets: this.phaseText, scale: 1, alpha: 1, duration: 260, ease: "Back.easeOut" });
    }
    this.waveText.setText(this.waveLabel());

    // Integrity bar.
    const ib = this.integrityBar;
    ib.clear();
    const ix = PANEL_X + 70;
    const iy = 26;
    const iw = 120;
    ib.fillStyle(0x000000, 0.5).fillRect(ix - 1, iy - 1, iw + 2, 14);
    ib.fillStyle(0x3a3f48, 1).fillRect(ix, iy, iw, 12);
    const frac = Phaser.Math.Clamp(run.coreIntegrity / run.coreMax, 0, 1);
    ib.fillStyle(frac > 0.5 ? 0x39a08a : frac > 0.25 ? 0xe6c14f : 0xe85a5a, 1).fillRect(ix, iy, iw * frac, 12);
    this.integrityText.setText(`◆ ${run.coreIntegrity}/${run.coreMax}`);

    // Surge gauge.
    const sb = this.surgeBar;
    sb.clear();
    const sx = PANEL_X + 130;
    const sy = 22;
    const sw = 110;
    sb.fillStyle(0x000000, 0.5).fillRect(sx - 1, sy - 1, sw + 2, 10);
    sb.fillStyle(0x2a2440, 1).fillRect(sx, sy, sw, 8);
    sb.fillStyle(0xb070ff, 1).fillRect(sx, sy, sw * Phaser.Math.Clamp(run.economy.surge / run.economy.surgeMax, 0, 1), 8);

    // Ability cooldown sweeps.
    for (const ab of this.abilityButtons) {
      const def = ABILITIES[ab.kind];
      const prog = cooldownProgress(run.cooldowns[ab.kind], run.runClockMs, def.cooldownMs);
      const ready = prog >= 1 && run.economy.surge >= def.surgeCost;
      const h = 34 * (1 - prog);
      ab.cdOverlay.setSize(34, h).setVisible(h > 0.5);
      const remain = remainingCooldownMs(run.cooldowns[ab.kind], run.runClockMs);
      ab.cdText.setText(remain > 0 ? Math.ceil(remain / 1000).toString() : "");
      ab.container.setAlpha(ready ? 1 : 0.65);
      if (this.targetingKind === ab.kind) ab.container.setScale(1.12);
      else ab.container.setScale(1);
    }

    if (this.toastUntil && this.time.now > this.toastUntil) {
      this.toastText.setVisible(false);
      this.toastUntil = 0;
    }
  }

  private phaseLabel(): string {
    switch (this.gameScene.run.phase) {
      case "setup":
        return "◇ SETUP PHASE";
      case "assault":
        return "⚔ ASSAULT PHASE";
      default:
        return "";
    }
  }

  private waveLabel(): string {
    const run = this.gameScene.run;
    const w = run.currentWave;
    const total = run.stronghold.waves.length;
    if (run.phase === "assault") {
      return `Wave ${run.waveIndex + 1}/${total} — ${w.name}  •  ${this.gameScene.enemiesRemaining()} left`;
    }
    if (run.phase === "setup") {
      return `Wave ${run.waveIndex + 1}/${total} — ${w.name}  •  build, then START`;
    }
    return "";
  }

  // -------------------------------------------------------------------------
  // Selection panel
  // -------------------------------------------------------------------------

  private rebuildPanel(): void {
    this.panelContainer.removeAll(true);
    const data = this.gameScene.getSelectionPanel();
    const baseY = this.paletteBottomY + 44;
    if (!data) {
      const hint = this.add.text(PANEL_X, baseY, "Select a device to inspect,\nor pick a BUILD item and click a tile.", {
        fontFamily: FONTS.body,
        fontSize: "12px",
        color: "#54637a",
      });
      this.panelContainer.add(hint);
      return;
    }

    let y = baseY;
    const title = this.add.text(PANEL_X, y, data.title, { fontFamily: FONTS.display, fontSize: "15px", color: data.color, fontStyle: "bold" });
    this.panelContainer.add(title);
    y += 22;
    for (const line of data.lines) {
      const t = this.add.text(PANEL_X, y, line, { fontFamily: FONTS.body, fontSize: "12px", color: "#c2cedb", wordWrap: { width: PANEL_W } });
      this.panelContainer.add(t);
      y += 16;
    }
    y += 6;

    for (const up of data.upgrades) {
      const color = up.affordable ? 0x2f5a7d : 0x3a3f48;
      const btn = this.makeButton(PANEL_X, y, PANEL_W, 26, `${up.label}  (¢${up.cost})`, color, () => this.gameScene.upgradeSelected(up.id));
      this.panelContainer.add(btn);
      y += 30;
    }

    if (data.canToggleMode) {
      const btn = this.makeButton(PANEL_X, y, PANEL_W, 26, "↻ Toggle Mode", 0x4a4070, () => this.gameScene.toggleSelectedCollectorMode());
      this.panelContainer.add(btn);
      y += 30;
    }

    const sell = this.makeButton(PANEL_X, y, PANEL_W, 26, `Sell  (+¢${data.sellValue})`, 0x7d3a3a, () => this.gameScene.sellSelected());
    this.panelContainer.add(sell);
  }

  // -------------------------------------------------------------------------
  // Toast / targeting / overlays
  // -------------------------------------------------------------------------

  toast(msg: string): void {
    this.toastText.setText(msg).setVisible(true);
    this.toastUntil = this.time.now + 1600;
  }

  setAbilityTargeting(kind: AbilityKind): void {
    this.targetingKind = kind;
    this.toast(`${ABILITIES[kind].name}: click a target location`);
  }
  clearAbilityTargeting(): void {
    this.targetingKind = null;
  }

  setPaused(paused: boolean): void {
    if (paused)
      this.showOverlay("PAUSED", [
        { label: "Resume", onClick: () => this.gameScene.togglePause() },
        { label: "Settings", onClick: () => this.openSettings() },
        { label: "Main Menu", onClick: () => this.gameScene.toMenu() },
      ]);
    else this.clearOverlay();
  }

  private openSettings(): void {
    const panel = openSettings(this, PLAYFIELD_WIDTH / 2, GAME_HEIGHT / 2, () => panel.destroy());
  }

  showSummary(stats: WaveStats | null): void {
    if (!stats) {
      this.clearOverlay();
      return;
    }
    const lines = [
      `Cogs earned: ¢${stats.cogsEarned}`,
      `Damage dealt: ${Math.round(stats.damageDealt)}`,
      `Enemies defeated: ${stats.enemiesKilled}`,
      stats.breaches > 0 ? `⚠ Core breaches: ${stats.breaches}` : "No breaches — flawless!",
    ];
    this.showOverlay("WAVE CLEARED", [{ label: "Continue ▶", onClick: () => this.gameScene.advanceAfterSummary() }], lines);
  }

  showEndScreen(won: boolean): void {
    if (won) {
      this.showOverlay("STRONGHOLD SECURED", [
        { label: "Next Stronghold ▶", onClick: () => this.gameScene.nextStronghold() },
        { label: "Main Menu", onClick: () => this.gameScene.toMenu() },
      ], ["You held the Core. The Bastion stands."]);
    } else {
      this.showOverlay("CORE BREACHED", [
        { label: "Retry", onClick: () => this.gameScene.restart() },
        { label: "Main Menu", onClick: () => this.gameScene.toMenu() },
      ], ["The Core integrity hit zero."], 0xe85a5a);
    }
  }

  private showOverlay(
    title: string,
    buttons: { label: string; onClick: () => void }[],
    lines: string[] = [],
    titleColor = 0x4fd1c5,
  ): void {
    this.clearOverlay();
    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05080d, 0.78).setOrigin(0, 0);
    const cx = PLAYFIELD_WIDTH / 2;
    // Painted dialog frame.
    const dialogW = 420;
    const dialogH = 130 + lines.length * 24 + buttons.length * 46;
    const frame = makePanel(this, "ui.panel", cx - dialogW / 2, GAME_HEIGHT * 0.3 - 40, dialogW, dialogH);
    const title_ = this.add
      .text(cx, GAME_HEIGHT * 0.3, title, { fontFamily: FONTS.display, fontSize: "34px", color: `#${titleColor.toString(16).padStart(6, "0")}`, fontStyle: "bold" })
      .setOrigin(0.5);
    const objs: Phaser.GameObjects.GameObject[] = [dim, frame, title_];
    let y = GAME_HEIGHT * 0.3 + 44;
    for (const l of lines) {
      objs.push(this.add.text(cx, y, l, { fontFamily: FONTS.body, fontSize: "16px", color: "#c2cedb" }).setOrigin(0.5));
      y += 24;
    }
    y += 12;
    for (const b of buttons) {
      const btn = this.makeButton(cx - 110, y, 220, 36, b.label, 0x2f5a7d, b.onClick);
      objs.push(btn);
      y += 46;
    }
    this.overlay = this.add.container(0, 0, objs).setDepth(200);
  }

  private clearOverlay(): void {
    this.overlay?.destroy();
    this.overlay = undefined;
  }
}
