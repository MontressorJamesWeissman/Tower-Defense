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

## Build progress

- [x] M1 — Scaffold Vite + TS + Phaser, dev server running
- [x] M2 — Grid system + buildable tiles + path rendering (Stronghold 1)
- [x] M3 — Pure-logic modules + Vitest tests (reactions, economy, grid, devices, waves)
- [ ] M4 — Setup Phase: place/upgrade Turrets & Traps with live Cog deduction
- [ ] M5 — Enemy spawning, path-following, Core Integrity on breach
- [ ] M6 — Turret targeting/firing + Charge application
- [ ] M7 — Reaction triggering
- [ ] M8–16 — Traps, Collectors, Abilities, full roster, UI, tuning, save, polish
