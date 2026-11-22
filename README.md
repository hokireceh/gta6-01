[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/hokireceh/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/hokireceh/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Vice Bay

An original open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). You play Dario
Voss, a wheelman new to Vice Bay — a sun-soaked coastal city of five
districts (Old Town, Downtown, Neon Strip, Bayside, Harbor) with a beach,
a marina and a harbor basin. Everything here is original: the city, the
characters, the story, the art and the sounds. Nothing is taken from
Rockstar Games or GTA.

## Play it

```sh
node scripts/serve.mjs   # http://localhost:8080
```

Open `game/index.html` in desktop Chrome. No build step, no network — the
game is static files under `game/`.

## What is in the game

- **An open world to explore** — drive or walk a 3200×2400 city with
  traffic, pedestrians, parked cars to steal, a beach and a harbor.
- **Four story jobs** — steal wheels for Sable the fixer, run a package
  from the marina, lose a three-star heat, then pull the Bay Job and
  vanish down the docks. Cash pays out per job; pickups (medkit, ammo,
  cash) are scattered around the city.
- **Wanted level + police** — heat rises when you shoot, kill or steal in
  view; foot cops chase and punch, cruisers chase and ram with sirens.
  Break line of sight and the stars cool off.
- **Combat** — mouse aim, click to shoot, R to reload, drive-bys from the
  car window.
- **A living sky** — a day/night clock and weather that drifts between
  sunny, rain and storm; rain makes the roads slick and storms flash
  lightning.
- **HUD + minimap** — cash, health, ammo, wanted stars, clock and
  weather, the mission objective, a live minimap and an edge arrow to
  the next marker.
- **Screens** — title, pause, busted, wasted, win. Progress (cash and
  current job) saves to localStorage; press C on the title to continue.
- **Screenshots** — `npm run shots` re-takes the four shots in
  `shots.json` with headless Chromium (cover, title, busted, win).

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| Shift | Sprint |
| E | Enter / exit car, pick up / grab (at a marker) |
| Mouse + click | Aim / shoot |
| R | Reload (or respawn when busted) |
| M | Mute |
| Esc | Pause |

## Structure

- `main.ts` — the entry program: copies `game/` + `screenshots/` to the
  output dir and writes `dossier.json` with `vendor/makefun-game.ts`.
- `game/src/boot.js` — the game: loop, input, camera, coordination.
- `game/src/baycity.js` — the city: layout, buildings, drawing.
- `game/src/clock.js` — day/night cycle and weather.
- `game/src/drive.js` — vehicle physics and traffic.
- `game/src/walker.js` — on-foot movement.
- `game/src/cops.js` — wanted level and police AI.
- `game/src/crowd.js` — pedestrians and parked cars.
- `game/src/story.js` — the four-job story.
- `game/src/fight.js` — shooting, health, ammo, pickups.
- `game/src/interface.js` — HUD, minimap, screens.
- `game/src/sound.js` — synthesized WebAudio sounds.
- `game/src/presets.js` — `?shot=` scenes for the screenshots.
- `game/src/save.js` — localStorage saves.
- `game/src/tools.js` — seeded RNG and small math helpers.
- `scripts/smoke.mjs` — `npm test`: two builds, byte-identical outputs.
- `scripts/shots.mjs` — `npm run shots`: the four screenshots.
- `scripts/serve.mjs` — `npm run serve`: a static file server.

## Tests

```sh
npm test          # two builds, byte-identical, 20 files, dossier < 1.5 MiB
node --check game/src/boot.js   # and every other module
```

---

Built with [make.fun](https://make.fun/r/jjqnkn84) — build AI agents and
enter them in competitions.
