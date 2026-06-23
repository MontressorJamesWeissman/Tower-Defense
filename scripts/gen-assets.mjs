// Bastion Protocol — asset manifest + PLACEHOLDERS.md generator.
//
// Run with:  node scripts/gen-assets.mjs
//
// Produces:
//   public/data/asset-manifest.json   (single source of truth for the loader)
//   PLACEHOLDERS.md                   (human shopping/generation list)
//
// Paths in the manifest are relative to the Vite base URL, so the asset files
// live under public/ (served at the site root). Dropping a real file at an
// entry's `path` makes it load with zero code changes.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// --- Game data (mirrors src enums; kept standalone so this script has no deps) ---
const CHARGES = [
  { id: "ember", color: "#ff7a33", theme: "Fire / warm orange" },
  { id: "tide", color: "#3a8dff", theme: "Water / deep blue" },
  { id: "frost", color: "#4fe8ff", theme: "Ice / pale cyan" },
  { id: "spark", color: "#ffe14f", theme: "Electric / yellow" },
  { id: "gust", color: "#5ad17a", theme: "Wind / green" },
  { id: "stone", color: "#b08850", theme: "Earth / brown" },
];

const ENEMIES = [
  { id: "grunt", frame: 48, color: "#9aa7b5", desc: "Basic walker, no resist." },
  { id: "skitter", frame: 40, color: "#e07be0", desc: "Fast, small, evasive." },
  { id: "bulwark", frame: 56, color: "#7d8aa0", desc: "Heavy shielded brute." },
  { id: "detonator", frame: 48, color: "#ff5a3c", desc: "Builds a meter, self-destructs." },
  { id: "mender", frame: 48, color: "#5ad17a", desc: "Healer/support, mends allies." },
  { id: "drifter", frame: 44, color: "#b7e3ff", desc: "Flying/elevated, hovers." },
  { id: "warden", frame: 48, color: "#ffe14f", desc: "Charge-immune sentinel." },
  { id: "colossus", frame: 96, color: "#c04060", desc: "Miniboss, periodically re-shields." },
];

const STRONGHOLDS = [
  { id: "s1", name: "The Ingress", theme: "overgrown stone gate, mossy ruins" },
  { id: "s2", name: "Twin Vents", theme: "volcanic vents, ember haze" },
  { id: "s3", name: "Switchback", theme: "frozen mountain pass, snow" },
  { id: "s4", name: "Crossfire", theme: "storm-lashed plateau, lightning" },
  { id: "s5", name: "The Bastion Core", theme: "arcane fortress interior, gold + violet" },
];

const ABILITIES = [
  { id: "cinderfall", charge: "ember" },
  { id: "maelstrom", charge: "tide" },
  { id: "deepfreeze", charge: "frost" },
  { id: "overcharge", charge: "spark" },
  { id: "cyclone", charge: "gust" },
  { id: "bulwark", charge: "stone" },
];

const NEUTRAL = "#5a6678";
const assets = {};
const rows = []; // for PLACEHOLDERS.md

function add(key, def, used, recommend) {
  assets[key] = def;
  const dims =
    def.type === "spritesheet"
      ? `${def.frameWidth}×${def.frameHeight} ×${def.frameCount}f`
      : def.type === "audio"
        ? "audio file"
        : `${def.width}×${def.height}`;
  rows.push({ key, type: def.type, path: def.path, dims, used, recommend });
}

function image(key, path, width, height, color, label, used, recommend) {
  add(key, { type: "image", path, width, height, placeholder: { color, label } }, used, recommend);
}

function sheet(key, path, fw, fh, count, anims, color, label, used, recommend) {
  add(
    key,
    { type: "spritesheet", path, frameWidth: fw, frameHeight: fh, frameCount: count, anims, placeholder: { color, label } },
    used,
    recommend,
  );
}

function panel(key, path, w, h, slice, color, label, used, recommend) {
  add(key, { type: "panel", path, width: w, height: h, slice, placeholder: { color, label } }, used, recommend);
}

function audio(key, path, stream, used, recommend) {
  add(key, { type: "audio", path, stream, fallback: "synth" }, used, recommend);
}

// --- Tilesets (one spritesheet of tiles per Stronghold theme) ---
for (const s of STRONGHOLDS) {
  sheet(
    `tileset.${s.id}`,
    `assets/tilesets/${s.id}.png`,
    64,
    64,
    8,
    {},
    NEUTRAL,
    `tiles ${s.id}`,
    `Tilemap for "${s.name}"`,
    `Kenney "Tower Defense"/"Hexagon" tiles or painted set — ${s.theme}. Frames: 0 ground,1 path,2 path-corner,3 buildable,4 buildable-hover,5 blocked,6-7 decoration.`,
  );
}

// --- Backgrounds (2 parallax layers per Stronghold + menu) ---
image("bg.menu.sky", "assets/backgrounds/menu_sky.png", 960, 540, "#0a0e14", "menu sky", "Main menu far layer", "Painterly fantasy vista, slow drift. 960×540, tileable horizontally preferred.");
image("bg.menu.near", "assets/backgrounds/menu_near.png", 960, 540, "#101826", "menu near", "Main menu near layer (silhouette/foreground)", "Foreground silhouette with transparency, parallax faster than sky.");
for (const s of STRONGHOLDS) {
  image(`bg.${s.id}.sky`, `assets/backgrounds/${s.id}_sky.png`, 960, 540, "#0c1320", `${s.id} sky`, `Background far layer for ${s.name}`, `Painted ${s.theme}, far parallax. 960×540.`);
  image(`bg.${s.id}.mid`, `assets/backgrounds/${s.id}_mid.png`, 960, 540, "#0c1320", `${s.id} mid`, `Background mid layer for ${s.name}`, `Mid parallax detail w/ transparency, ${s.theme}.`);
}

// --- Enemies (animated spritesheets: idle, walk, death) ---
for (const e of ENEMIES) {
  const anims = {
    idle: { start: 0, end: 1, frameRate: 4, repeat: -1 },
    walk: { start: 0, end: 3, frameRate: 8, repeat: -1 },
    death: { start: 4, end: 7, frameRate: 12, repeat: 0 },
  };
  sheet(
    `enemy.${e.id}`,
    `assets/sprites/enemies/${e.id}.png`,
    e.frame,
    e.frame,
    8,
    anims,
    e.color,
    e.id,
    `Enemy "${e.id}" (${e.desc})`,
    `Painterly creature, ${e.frame}×${e.frame}/frame. Frames 0-3 walk loop, 4-7 death. ${e.desc}`,
  );
}

// --- Turrets (layered: base + tinted emitter overlay + firing anim) ---
image("turret.base", "assets/sprites/turrets/base.png", 44, 44, "#202c3e", "turret base", "All turrets — static base", "Neutral painted turret base, 44×44, top-down. Tint applied to emitter, not base.");
image("turret.emitter", "assets/sprites/turrets/emitter.png", 44, 44, "#ffffff", "emitter", "Turret Charge emitter overlay (tinted per Charge at runtime)", "WHITE/greyscale emitter so runtime tint shows the Charge color. 44×44.");
sheet("turret.fire", "assets/sprites/turrets/fire.png", 44, 44, 4, { fire: { start: 0, end: 3, frameRate: 24, repeat: 0 } }, "#ffffff", "fire anim", "Turret muzzle/firing animation overlay", "4-frame greyscale muzzle flash overlay, 44×44, tinted per Charge.");

// --- Traps (layered: base + tinted rune + active pulse anim) ---
image("trap.base", "assets/sprites/traps/base.png", 44, 44, "#2a2018", "trap base", "All traps — static plate", "Painted floor-plate/glyph base, 44×44.");
image("trap.rune", "assets/sprites/traps/rune.png", 44, 44, "#ffffff", "rune", "Trap Charge rune overlay (tinted per Charge)", "Greyscale rune/sigil, 44×44, tinted per Charge.");
sheet("trap.active", "assets/sprites/traps/active.png", 64, 64, 4, { pulse: { start: 0, end: 3, frameRate: 16, repeat: -1 } }, "#ffffff", "trap pulse", "Trap trigger/pulse animation", "4-frame greyscale shockwave, 64×64, tinted per Charge.");

// --- Projectiles (per-Charge bolt + shared trail) ---
for (const c of CHARGES) {
  image(`projectile.${c.id}`, `assets/sprites/projectiles/${c.id}.png`, 20, 20, c.color, `${c.id} bolt`, `${c.id} turret projectile`, `Textured bolt/orb, 20×20, ${c.theme}. Center-anchored.`);
}
image("projectile.trail", "assets/sprites/projectiles/trail.png", 16, 16, "#ffffff", "trail", "Projectile motion trail (tinted per Charge)", "Soft greyscale streak, 16×16, additive.");

// --- Effects atlas ---
sheet("effect.impact", "assets/sprites/effects/impact.png", 64, 64, 5, { play: { start: 0, end: 4, frameRate: 30, repeat: 0 } }, "#ffffff", "impact", "Projectile impact burst", "5-frame greyscale burst, 64×64, tinted per Charge.");
sheet("effect.reaction", "assets/sprites/effects/reaction.png", 96, 96, 6, { play: { start: 0, end: 5, frameRate: 24, repeat: 0 } }, "#ffffff", "reaction", "Elemental reaction burst (the big moment)", "6-frame greyscale burst, 96×96, tinted by reaction color.");
image("effect.mote", "assets/sprites/effects/mote.png", 16, 16, "#ffffff", "mote", "Ambient drifting mote particle", "Soft round particle, 16×16, additive.");
image("effect.spark", "assets/sprites/effects/spark.png", 8, 8, "#ffffff", "spark", "Small spark particle", "Tiny bright particle, 8×8, additive.");

// --- UI 9-slice panels ---
panel("ui.panel", "assets/ui/panels/panel.png", 96, 96, { left: 28, right: 28, top: 28, bottom: 28 }, "#131a26", "panel", "Side panel / device-inspect / overlay frames", "Ornamented painted frame, 96×96, 28px corners. Kenney 'Fantasy UI' or 'UI Pack'.");
panel("ui.hud", "assets/ui/panels/hud.png", 96, 64, { left: 24, right: 24, top: 20, bottom: 20 }, "#0d141f", "hud bar", "Top HUD bar frame", "Horizontal banner frame, 96×64, for the top HUD.");
panel("ui.tooltip", "assets/ui/panels/tooltip.png", 64, 48, { left: 16, right: 16, top: 16, bottom: 16 }, "#1b2536", "tooltip", "Tooltip / toast frame", "Small rounded frame, 64×48.");
panel("ui.button", "assets/ui/buttons/button.png", 48, 24, { left: 10, right: 10, top: 10, bottom: 10 }, "#2f5a7d", "button", "All buttons (tinted for hover/pressed states)", "Painted button, 48×24, 10px corners. Greyscale-ish so tint reads.");

// --- Icons ---
for (const c of CHARGES) {
  image(`icon.charge.${c.id}`, `assets/ui/icons/charge_${c.id}.png`, 32, 32, c.color, `${c.id} icon`, `Charge icon: ${c.id}`, `Painted elemental glyph, 32×32, ${c.theme}. Game-icons.net is a good source.`);
}
for (const a of ABILITIES) {
  const c = CHARGES.find((x) => x.id === a.charge);
  image(`icon.ability.${a.id}`, `assets/ui/icons/ability_${a.id}.png`, 40, 40, c.color, `${a.id}`, `Ability icon: ${a.id} (${a.charge})`, `Painted spell icon, 40×40, themed ${c.theme}.`);
}
image("icon.cog", "assets/ui/icons/cog.png", 24, 24, "#e6c14f", "cog", "Currency (Cogs) icon", "Gold cog/coin, 24×24.");
image("icon.integrity", "assets/ui/icons/integrity.png", 24, 24, "#39a08a", "core", "Core Integrity icon", "Crystal/core gem, 24×24.");
image("icon.surge", "assets/ui/icons/surge.png", 24, 24, "#b070ff", "surge", "Surge gauge icon", "Energy bolt, 24×24, violet.");

// --- Audio (file-based, synth fallback) ---
audio("audio.music.menu", "audio/music/menu.mp3", true, "Menu music", "Slow atmospheric fantasy ambient loop. CC0/CC-BY orchestral or AI.");
audio("audio.music.setup", "audio/music/setup.mp3", true, "Setup-phase music", "Calm mid-tempo loop, breathing room.");
audio("audio.music.assault", "audio/music/assault.mp3", true, "Assault-phase music", "Faster, percussive, intense loop.");
audio("audio.music.victory", "audio/music/victory.mp3", true, "Victory sting/loop", "Triumphant short cue for Stronghold clear.");
for (const c of CHARGES) {
  audio(`audio.sfx.shot.${c.id}`, `audio/sfx/shot_${c.id}.wav`, false, `${c.id} turret fire SFX`, `Short shot blip, ${c.theme} character.`);
}
audio("audio.sfx.impact", "audio/sfx/impact.wav", false, "Impact SFX", "Percussive thud.");
audio("audio.sfx.reaction", "audio/sfx/reaction.wav", false, "Reaction SFX", "Bright two-tone chime.");
audio("audio.sfx.death", "audio/sfx/death.wav", false, "Enemy death SFX", "Short descending blip.");
audio("audio.sfx.core", "audio/sfx/core.wav", false, "Core damage SFX", "Sharp alarm stinger.");
audio("audio.sfx.ability", "audio/sfx/ability.wav", false, "Ability cast SFX", "Rising sweep/whoosh.");
audio("audio.sfx.ui.click", "audio/sfx/ui_click.wav", false, "UI click SFX", "Clean confirm click.");
audio("audio.sfx.ui.hover", "audio/sfx/ui_hover.wav", false, "UI hover SFX", "Tiny soft tick.");

// --- Write manifest ---
const manifest = {
  $comment: "Generated by scripts/gen-assets.mjs. Paths are relative to the Vite base URL (files live under public/). Drop a real file at an entry's `path` to replace its placeholder — no code change needed.",
  version: 1,
  assets,
};
mkdirSync(resolve(ROOT, "public/data"), { recursive: true });
writeFileSync(resolve(ROOT, "public/data/asset-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

// --- Write PLACEHOLDERS.md ---
const byType = (t) => rows.filter((r) => r.type === t);
function table(list) {
  const head = "| Logical name | Path | Dimensions | Used for | Recommended art |\n|---|---|---|---|---|\n";
  return head + list.map((r) => `| \`${r.key}\` | \`${r.path}\` | ${r.dims} | ${r.used} | ${r.recommend} |`).join("\n") + "\n";
}

const md = `# PLACEHOLDERS — Asset Shopping List

This file is generated by \`scripts/gen-assets.mjs\` from \`public/data/asset-manifest.json\`.
Every slot below currently renders as a **labeled colored placeholder** generated at
runtime. **To replace one with real art, just drop a file at the listed \`path\`** (under
\`public/\`) — no code changes. Dimensions are the recommended source size; the game
scales as needed.

> Style target: **painterly fantasy** — rich, warm, hand-painted, soft baked gradients.
> Keep the Charge color identity: Ember=orange, Tide=blue, Frost=cyan, Spark=yellow,
> Gust=green, Stone=brown. Emitter/rune/effect overlays should be **greyscale/white** so
> the engine can tint them per Charge.

Good license-clear sources: **Kenney.nl** (UI, tiles, particles, audio), **OpenGameArt**,
**itch.io** CC0 packs, **Game-icons.net** (icons), **Quaternius**. Or drop in your own
AI-generated painterly art. Music: CC0/CC-BY orchestral/ambient or AI-generated.

Total slots: **${rows.length}**.

## Tilesets
${table(byType("spritesheet").filter((r) => r.key.startsWith("tileset.")))}
## Backgrounds (parallax layers)
${table(byType("image").filter((r) => r.key.startsWith("bg.")))}
## Enemies (animated spritesheets — frames 0–3 walk, 4–7 death)
${table(byType("spritesheet").filter((r) => r.key.startsWith("enemy.")))}
## Turrets & Traps (layered sprites)
${table([...byType("image"), ...byType("spritesheet")].filter((r) => r.key.startsWith("turret.") || r.key.startsWith("trap.")))}
## Projectiles
${table(byType("image").filter((r) => r.key.startsWith("projectile.")))}
## Effects
${table(byType("spritesheet").concat(byType("image")).filter((r) => r.key.startsWith("effect.")))}
## UI Panels (9-slice)
${table(byType("panel"))}
## Icons
${table(byType("image").filter((r) => r.key.startsWith("icon.")))}
## Audio (file-based; synthesized Tone.js fallback until supplied)
${table(byType("audio"))}
`;
writeFileSync(resolve(ROOT, "PLACEHOLDERS.md"), md);

console.log(`Wrote public/data/asset-manifest.json and PLACEHOLDERS.md (${rows.length} slots).`);
