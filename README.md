# Bastion Protocol

An original elemental tower-defense game. Defend your **Core** across a series of
**Strongholds** by placing elementally-charged **Devices** along a fixed enemy
path, chaining **Reactions** between charges, and spending persistent
**Support Abilities** at the right moment.

> Original game — not affiliated with or derived from any existing commercial title.

## Tech stack

- **TypeScript** (strict)
- **Vite** dev server / bundler
- **Phaser 3** game engine
- **Vitest** unit tests for pure simulation logic

## Commands

```bash
npm install      # install deps
npm run dev      # start dev server (http://localhost:5173)
npm run build    # typecheck + production build
npm test         # run the Vitest suite
```

## Architecture

Pure game logic lives in `src/game/logic/` with **no Phaser dependency**, so the
economy, reaction table, device stats, enemy definitions, and wave schedules are
all unit-testable without a canvas. Phaser scenes in `src/game/scenes/` render
that logic.

```
src/game/logic/     pure, testable simulation modules
  elements.ts         the 6 Charges + metadata
  reactions.ts        data-driven reaction table (unordered charge pairs)
  economy.ts          Cogs currency + Surge gauge math
  devices.ts          Turret/Trap/Collector stats & upgrades
  enemies.ts          the 8 enemy archetypes
  waves.ts            wave spawn schedules
  strongholds.ts      level layouts, paths, and tuned waves
  abilities.ts        Support Abilities + persistent cooldowns
  grid.ts             tile/path geometry
src/game/scenes/    Phaser rendering (Boot, MainMenu, Grid)
tests/              Vitest suites
```

## How to play

1. `npm install && npm run dev`, open the served URL, pick a Stronghold.
2. **Setup Phase**: choose a BUILD item (a Turret/Trap charge, or a Collector
   mode) from the side panel, then click a tile. Turrets/Collectors go on
   buildable tiles; Traps go on the path. Select a placed device to upgrade,
   toggle, or sell it. Press **START WAVE** when ready.
3. **Assault Phase**: enemies march toward the Core. Keep building/upgrading as
   Cogs come in. Land a second, *different* charge on an enemy to trigger a
   **Reaction**. Spend **Support Abilities** (hotkeys 1–6) — their cooldowns
   persist across the whole run, so time them.
4. Clear every wave without the Core Integrity hitting zero. `ESC` pauses /
   cancels selection.

## Build progress — all milestones complete

- [x] M1 — Scaffold Vite + TS + Phaser, dev server running
- [x] M2 — Grid system + buildable tiles + path rendering
- [x] M3 — Pure-logic modules + Vitest tests (reactions, economy, grid, devices, waves, combat)
- [x] M4 — Setup Phase: place/upgrade Turrets & Traps with live Cog deduction
- [x] M5 — Enemy spawning, path-following, Core Integrity on breach
- [x] M6 — Turret targeting/firing + Charge application
- [x] M7 — Reaction triggering (data-driven, with AoE/freeze/DoT/chain/spread)
- [x] M8 — Trap Devices + upgrades (Snare/Mine Layer/Pulse Emitter)
- [x] M9 — Collector Devices + enforced no-same-mode-overlap rule
- [x] M10 — Support Abilities with persistent cross-wave cooldowns
- [x] M11 — Full 8-archetype enemy roster + special behaviours
- [x] M12 — Full UI overlay (HUD, device panel, ability bar, summary/end screens, pause)
- [x] M13 — Stronghold 1 fully wired & runnable
- [x] M14 — Save/progress persistence via localStorage
- [x] M15 — Polish: screen shake, hit-flash, reaction/death particles, sfx hooks, menu
- [x] M16 — 5 Strongholds total (incl. multi-lane levels)

84 Vitest tests pass; `tsc` clean; production build succeeds.

> **Verification note:** this was built in a headless environment, so the build,
> typecheck, and unit tests are all verified green, but the canvas hasn't been
> visually playtested. Run `npm run dev` to playtest feel/balance.
