// Bastion Protocol — settings overlay (volumes + reduce-VFX).
// Reusable from the main menu and the in-game pause menu. Uses +/- steppers
// and a toggle (robust without drag handling), persisting via the settings store.

import Phaser from "phaser";
import { settings, updateSettings } from "../state/settings";
import { audio } from "../audio/AudioManager";
import { FONTS } from "../render/fonts";
import { makePanel } from "../render/NineSlice";

export function openSettings(
  scene: Phaser.Scene,
  centerX: number,
  centerY: number,
  onClose: () => void,
): Phaser.GameObjects.Container {
  const w = 380;
  const h = 300;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const dim = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x05080d, 0.82).setOrigin(0, 0).setInteractive();
  objs.push(dim);
  objs.push(makePanel(scene, "ui.panel", centerX - w / 2, centerY - h / 2, w, h));
  objs.push(
    scene.add.text(centerX, centerY - h / 2 + 26, "SETTINGS", { fontFamily: FONTS.display, fontSize: "26px", color: "#4fd1c5", fontStyle: "bold" }).setOrigin(0.5),
  );

  const left = centerX - w / 2 + 28;
  let y = centerY - h / 2 + 70;

  const txt = (x: number, s: string, size = 15, color = "#c2cedb", origin = 0): Phaser.GameObjects.Text =>
    scene.add.text(x, y, s, { fontFamily: FONTS.body, fontSize: `${size}px`, color }).setOrigin(origin, 0.5);

  const tinyBtn = (x: number, label: string, onClick: () => void): Phaser.GameObjects.Text => {
    const b = scene.add
      .text(x, y, label, { fontFamily: FONTS.body, fontSize: "18px", color: "#ffffff", backgroundColor: "#2f5a7d", padding: { x: 8, y: 2 }, fontStyle: "bold" })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    b.on("pointerover", () => audio.playUI("hover"));
    b.on("pointerdown", () => {
      audio.playUI("click");
      onClick();
    });
    objs.push(b);
    return b;
  };

  const volumeRow = (label: string, get: () => number, set: (v: number) => void) => {
    objs.push(txt(left, label));
    const valText = scene.add
      .text(centerX + 70, y, "", { fontFamily: FONTS.body, fontSize: "15px", color: "#ffffff" })
      .setOrigin(0.5, 0.5);
    const render = () => valText.setText(`${Math.round(get() * 100)}%`);
    tinyBtn(centerX + 30, "−", () => {
      set(Math.max(0, Math.round((get() - 0.1) * 10) / 10));
      render();
    });
    tinyBtn(centerX + 110, "+", () => {
      set(Math.min(1, Math.round((get() + 0.1) * 10) / 10));
      render();
    });
    objs.push(valText);
    render();
    y += 42;
  };

  volumeRow("Master volume", () => settings.master, (v) => updateSettings({ master: v }));
  volumeRow("Music volume", () => settings.music, (v) => updateSettings({ music: v }));
  volumeRow("SFX volume", () => settings.sfx, (v) => updateSettings({ sfx: v }));

  // Reduce-VFX toggle.
  objs.push(txt(left, "Reduce VFX"));
  const toggle = scene.add
    .text(centerX + 70, y, "", { fontFamily: FONTS.body, fontSize: "16px", color: "#ffffff", backgroundColor: "#2f5a7d", padding: { x: 10, y: 3 }, fontStyle: "bold" })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });
  const renderToggle = () => toggle.setText(settings.reduceVfx ? "ON" : "OFF").setBackgroundColor(settings.reduceVfx ? "#7d5a2f" : "#2f5a7d");
  toggle.on("pointerover", () => audio.playUI("hover"));
  toggle.on("pointerdown", () => {
    audio.playUI("click");
    updateSettings({ reduceVfx: !settings.reduceVfx });
    renderToggle();
  });
  renderToggle();
  objs.push(toggle);
  y += 50;

  const back = scene.add
    .text(centerX, centerY + h / 2 - 28, "Back", { fontFamily: FONTS.body, fontSize: "18px", color: "#ffffff", backgroundColor: "#2f5a7d", padding: { x: 20, y: 6 }, fontStyle: "bold" })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });
  back.on("pointerover", () => audio.playUI("hover"));
  back.on("pointerdown", () => {
    audio.playUI("click");
    onClose();
  });
  objs.push(back);

  return scene.add.container(0, 0, objs).setDepth(300);
}
