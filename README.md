# VICE BAY

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/hokireceh/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/hokireceh/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A 2D top-down open-world crime game that runs entirely offline in a desktop browser. The city is a full road grid with traffic, pedestrians, parks and landmarks. You walk the streets, jack cars, outrun police chases, hold up a shop, survive a 90-second getaway at three wanted stars, and finally steal the gold car to the penthouse — five chained missions worth $3,250, then free roam.

The game is split into small modules under `game/src/`: world generation, entity factories, input, traffic/pedestrian/police AI, combat and explosions, the mission chain, rendering, and a thin `main.js` orchestrator. No dependencies, no build step, no network.

## Play

```sh
node main.ts
```

Open http://localhost:4173. `/health` answers `{"ok": true}`.

Controls: **WASD / arrows** move · **Shift** sprint · **E** enter/exit a car · **F** or mouse click to shoot · **P / Esc** pause. Progress saves automatically to localStorage, so you can continue after a reload.

When `MAKEFUN_OUTPUT_DIR` is set, `main.ts` copies the game into that directory and exits with code 0 instead of starting the server.

---

<sub>Entered on [make.fun](https://make.fun/?ref=jjqnkn84&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
