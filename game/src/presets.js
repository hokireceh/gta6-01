// Screenshot presets: ?shot=cover|start|caught|win&seed=N. Each one stages a
// deterministic scene of the real game — no fake screens, the cover is the
// live game mid-chase at dusk in a storm, and the others are the real title,
// busted and win states. shots.json lists the four shots the maker takes.

import { forceWeather } from './clock.js';
import { makeVehicle } from './drive.js';

/** Reads the shot preset and seed from the page URL. */
export function shotFromUrl() {
  const q = new URLSearchParams(window.location.search);
  const seed = parseInt(q.get('seed') || '7', 10);
  return { shot: q.get('shot') || '', seed: Number.isFinite(seed) ? seed : 7 };
}

/**
 * Stages a preset scene on a fresh game. The game must already exist (its
 * world built); this only moves pieces and sets the state.
 */
export function applyShotPreset(game, shot) {
  if (shot === 'start') {
    game.state = 'title';
    return;
  }
  if (shot === 'caught') {
    game.startGame(true);
    game.cash = 1250;
    game.state = 'busted';
    game.arsenal.health = 0;
    game.banner = '';
    game.bannerTimer = 0;
    return;
  }
  if (shot === 'win') {
    game.startGame(true);
    game.cash = 4200;
    game.playSeconds = 187;
    game.story.index = 4;
    game.story.finished = true;
    game.story.marker = null;
    game.state = 'win';
    game.banner = '';
    game.bannerTimer = 0;
    return;
  }
  if (shot === 'cover') {
    game.startGame(true);
    // Dusk, storm, three stars, mid-chase on the roads west of the Strip.
    // The player drives AWAY from the marker (west, down the y=1250 road),
    // so the job cannot complete itself during the settle, and the police
    // start far enough back that they close in without catching the player.
    forceWeather(game.clock, 'storm', 18 * 60 + 52);
    game.cash = 1250;
    game.player.x = 900;
    game.player.y = 1250;
    game.player.angle = Math.PI;
    const ride = makeVehicle('speedster', 900, 1250, Math.PI);
    ride.driver = 'player';
    ride.speed = 500;
    game.car = ride;
    game.inCar = true;
    game.wanted.setStars(3);
    game.story.index = 1;
    game.story.stage = 'carry';
    game.story.marker = { ...game.city.stripDrop, radius: 80 };
    // Cruisers on the tail, foot cops closing in from the side streets.
    // (spawnCruiser/spawnCop already add to the lists — no extra push.)
    game.spawnCruiser(1450, 1250);
    game.spawnCruiser(1400, 1320);
    game.spawnCop(1400, 1450);
    game.spawnCop(1350, 1050);
    // Traffic for the street to feel alive.
    game.spawnStreetTraffic();
    game.banner = 'JOB 2: Marina Pickup — deliver the package to the Neon Strip!';
    game.bannerTimer = 999;
    return;
  }
  // No (or unknown) shot: leave the title screen up.
  game.state = 'title';
}
