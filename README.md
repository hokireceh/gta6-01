[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/hokireceh/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/hokireceh/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Vice Bay

An original 2D top-down open-world crime game set in the fictional city of Vice Bay, Leonida — built for the make.fun **gta6-01** bounty. You arrive in town with one bag, one pistol, and a debt. Work three jobs for your boss Marisol — deliver packages, chase down a courier, then escape a city-wide raid — and the city is yours.

No Rockstar content: every name, character, street and story beat here is invented for this game.

## Play it

Serve `game/` with any static server and open `game/index.html` in desktop Chrome:

```sh
node scripts/serve.mjs   # http://localhost:8080/
```

Or build the submission bundle (copies `game/` + `screenshots/` and writes `dossier.json`):

```sh
npm run build            # writes out/
npm test                 # smoke test: builds twice, checks identical bytes
```

## Controls

| Input | Action |
| --- | --- |
| WASD / Arrow keys | Walk and drive |
| Shift | Sprint on foot |
| E | Enter / exit a car (stealing a driven car raises your wanted level) |
| Mouse click | Shoot the pistol (on foot) |
| R | Reload |
| P / Esc | Pause |
| M | Mute sound |

## The game

- **A living city** — a seeded street grid with avenues, intersections, a park, a beach and the bay; traffic cars cruise the roads and pedestrians stroll the sidewalks (and flee when you drive at them).
- **Cars to steal and drive** — parked cars are free; taking a car with a driver inside earns you a wanted star. Arcade handling with acceleration, braking, reversing and steering.
- **Wanted level & police** — 0–5 stars. Crimes (theft, hitting pedestrians, shooting cops) raise it; VCPD cars chase and ram you, foot cops chase, shoot, and try to bust you. Lose the cops' line of sight and the heat cools down.
- **Missions & story** — three jobs with a HUD objective, a pulsing beacon, an edge-of-screen arrow and a minimap marker: (1) *Pesanan Pertama* — collect three packages and deliver them to the depot; (2) *Kejar Kurir* — run a courier down and take his bag; (3) *Kabur dari Razia* — escape a three-star raid to the hideout.
- **Combat** — pistol with mouse aim, reload, cop return fire, health and ammo pickups around town.
- **Progression & save** — cash rewards per job, a win screen with run stats, and progress (cash + mission) saved in `localStorage` so you can continue later.
- **Feel & polish** — camera follow with screen shake, dust and spark particles, muzzle flashes, a day-lit palette, synthesized engine/siren/gunshot audio (WebAudio, no files), and a full HUD: cash, health, ammo, wanted stars, objective banner, speedometer and minimap.

## Structure

The game is plain static files under `game/` — no build step, no network requests, no vendored libraries:

| File | Job |
| --- | --- |
| `game/index.html` | The page: canvas + module entry |
| `game/src/main.js` | Game state, loop, driving, crime, police, save |
| `game/src/config.js` | Tuning, palette, key bindings |
| `game/src/math.js` | Pure math helpers |
| `game/src/random.js` | Seeded RNG (the city is deterministic) |
| `game/src/input.js` | Keyboard + mouse, with edge detection |
| `game/src/entities.js` | Entity factories and car kinematics |
| `game/src/world.js` | City generation, roads, collisions |
| `game/src/ai.js` | Traffic, pedestrians, police pursuit |
| `game/src/combat.js` | Shooting, bullets, wanted consequences |
| `game/src/missions.js` | The three-job story state machine |
| `game/src/render.js` | City, cars, people, HUD, minimap, menus |
| `game/src/shots.js` | Staged scenes (`?shot=menu|drive|chase|win`) for screenshots |

`main.ts` at the repository root is the make.fun entrypoint: it copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with `buildDossier` from `vendor/makefun-game.ts`. `scripts/smoke.mjs` verifies the build is deterministic; `scripts/serve.mjs` is the local static server.

## Screenshots

`01-menu.jpg` (title screen), `02-drive.jpg` (driving with HUD + minimap), `03-chase.jpg` (three-star police chase), `04-win.jpg` (win screen) — all real renders of this game in Chromium, captured with Playwright while driving the `?shot=` scenes. See `shots.json` for the scene list.

## License

MIT — see [LICENSE](LICENSE).

---

Built for [make.fun — GTA 6 bounty gta6-01](https://make.fun/bounty/gta6-01?ref=jjqnkn84)
