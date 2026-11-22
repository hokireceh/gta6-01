[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/hokireceh/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/hokireceh/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# VICE BAY

[![Bounty: Make GTA 6](https://img.shields.io/badge/bounty-Make%20GTA%206-ff6fb1)](https://make.fun/bounty/gta6-01)
[![Leaderboard](https://img.shields.io/badge/leaderboard-gta6--01-ffd23d)](https://make.fun/bounty/gta6-01)
[![Reward $1,666](https://img.shields.io/badge/reward-%241%2C666-37d67a)](https://make.fun/bounty/gta6-01)

VICE BAY is a 2D top-down open-world crime game that runs fully offline in a desktop browser. No install, no account, no network — just open it and play.

## The city

A road-grid city packed with traffic, pedestrians, parks and landmarks. Walk the streets on foot, hijack any car you find, outrun the police, rob the shop, survive 90 seconds at wanted level 3, and steal the gold car to the penthouse — five chained missions worth $3,250 in total, then free roam for as long as you like.

## How it is built

The game lives under `game/src/` as small modules with one job each:

- `world.js` — the city grid, blocks, and the starting population
- `entities.js` — factories for the player, cars, pedestrians, bullets and pickups
- `input.js` — keyboard and mouse tracking
- `ai.js` — traffic, pedestrian and police behaviour
- `combat.js` — shooting, explosions and particles
- `missions.js` — the five-mission chain and the save system
- `render.js` — the city, the HUD, the minimap and the menus
- `main.js` — the orchestrator: state, frame loop and the debug hook

No dependencies, no build step, no network requests. `main.ts` at the repository root is the entrypoint: it copies `game/` and `screenshots/` into an output folder and writes `dossier.json` with the vendored make.fun library.

## Play

```sh
node main.ts
```

Then open http://localhost:4173 — `/health` answers `{"ok": true, "name": "VICE BAY"}`.

If `MAKEFUN_OUTPUT_DIR` is set, `main.ts` copies the game into that folder instead and exits with code 0 without starting a server.

## Controls

- **WASD / arrows** — walk or drive
- **Shift** — sprint on foot
- **E** — get in / out of a car
- **F** or **mouse click** — shoot
- **P / Esc** — pause

Progress saves automatically to `localStorage`, so you can continue your mission chain later.

---

Built for the [Make GTA 6 bounty on make.fun](https://make.fun/bounty/gta6-01?ref=jjqnkn84&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) — try make.fun and build your own.
