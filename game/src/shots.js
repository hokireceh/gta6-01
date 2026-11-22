// Vice Bay — staged scenes for screenshots.
// `?shot=menu|drive|chase|win|mission` drops the game into a fixed,
// photogenic state so the autopilot can capture it deterministically.
// Used only by the maker's screenshot run; the game itself never needs it.

export function applyShot(game, name) {
  const w = game.world;
  const p = game.playerPos();
  if (name === 'menu') {
    game.mode = 'menu';
    game.camera.x = w.plaza.x;
    game.camera.y = w.plaza.y;
    return;
  }
  game.startPlaying();
  if (name === 'drive') {
    game.missions.loadMission(game, 0);
    const spot = { x: w.avenues[4], y: w.streets[2] };
    game.teleportPlayer(spot.x, spot.y);
    const car = game.giveCarAt(spot.x, spot.y, 0);
    car.speed = 320;
    game.camera.x = spot.x;
    game.camera.y = spot.y;
    game.cash = 1250;
    return;
  }
  if (name === 'chase') {
    // Mission 3 ("Kabur dari Razia") IS the police chase: wanted 3 and a
    // hideout objective, with no courier that can escape mid-shot.
    game.missions.loadMission(game, 2);
    const spot = { x: w.avenues[4], y: w.streets[4] };
    game.teleportPlayer(spot.x, spot.y);
    const car = game.giveCarAt(spot.x, spot.y, -Math.PI / 2);
    car.speed = 380;
    // Close behind the player and already at speed, so the pursuit stays
    // in frame while the player flees north.
    const copSpots = [[-90, 150], [90, 190], [0, 300]];
    for (const [dx, dy] of copSpots) {
      const cop = game.spawnPoliceCarNear();
      cop.x = spot.x + dx;
      cop.y = spot.y + dy;
      cop.angle = -Math.PI / 2;
      cop.speed = 380;
    }
    game.camera.x = spot.x;
    game.camera.y = spot.y;
    game.cash = 2100;
    return;
  }
  if (name === 'win') {
    game.missions.index = 3;
    game.missions.done = true;
    game.cash = 5300;
    game.stats.carsStolen = 4;
    game.stats.shots = 41;
    game.stats.hits = 29;
    game.mode = 'win';
    game.camera.x = p.x;
    game.camera.y = p.y;
    return;
  }
  if (name === 'mission') {
    game.missions.loadMission(game, 0);
    const step = game.missions.current();
    game.teleportPlayer(step.pos.x - 130, step.pos.y + 60);
    game.player.angle = Math.atan2(step.pos.y - game.player.y, step.pos.x - game.player.x);
    game.camera.x = game.player.x;
    game.camera.y = game.player.y;
    game.cash = 640;
    return;
  }
  // Unknown shot name: leave the game on its menu.
  game.mode = 'menu';
}
