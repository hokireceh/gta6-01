// Vice Bay — everything the player sees: city, cars, people, HUD, menus.

import { PALETTE, VIEW_H, VIEW_W } from './config.js';
import { clamp, dist, lerp, TAU } from './math.js';
import { ROAD_HALF, SIDEWALK } from './world.js';

const MINIMAP_W = 196;
const MINIMAP_H = 142;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  draw(game) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    if (game.mode === 'menu') {
      this.drawWorld(game);
      this.drawMenu(game);
      return;
    }
    this.drawWorld(game);
    this.drawHud(game);
    if (game.mode === 'busted') this.drawEndCard(game, 'TERTANGKAP!', '#2b4fd8', 'Polisi membawamu ke kantor. Uang jalanmu dipotong 15%.');
    if (game.mode === 'wasted') this.drawEndCard(game, 'KAMU TUMBANG', '#ff453a', 'Kamu dilarikan ke rumah sakit. Tagihannya 10% dari uangmu.');
    if (game.mode === 'win') this.drawWinCard(game);
    if (game.mode === 'paused') this.drawPaused(game);
  }

  // ---------------------------------------------------------- world

  drawWorld(game) {
    const ctx = this.ctx;
    const world = game.world;
    const cam = game.camera;
    const shakeX = (Math.random() - 0.5) * cam.shake;
    const shakeY = (Math.random() - 0.5) * cam.shake;
    const ox = -cam.x + VIEW_W / 2 + shakeX;
    const oy = -cam.y + VIEW_H / 2 + shakeY;
    ctx.save();
    ctx.translate(ox, oy);
    const vx0 = cam.x - VIEW_W / 2 - 80;
    const vy0 = cam.y - VIEW_H / 2 - 80;
    const vx1 = cam.x + VIEW_W / 2 + 80;
    const vy1 = cam.y + VIEW_H / 2 + 80;
    const vis = (x, y, w, h) => x + w > vx0 && x < vx1 && y + h > vy0 && y < vy1;

    // Ground: grass, then the bay water and its sand shore.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(world.water.x - 46, vy0, 46, vy1 - vy0);
    ctx.fillRect(vx0, world.water.y - 46, vx1 - vx0, 46);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(world.water.x, world.water.y, world.water.w, world.water.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const wy = world.water.y + 60 + i * 90 + Math.sin(game.time * 0.7 + i * 2) * 8;
      ctx.beginPath();
      ctx.moveTo(world.water.x + 30, wy);
      ctx.lineTo(world.water.x + 320, wy);
      ctx.stroke();
    }

    // Park.
    const park = world.park;
    if (vis(park.x, park.y, park.w, park.h)) {
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(park.x, park.y, park.w, 10);
    }

    // Roads: asphalt, sidewalks, dashed centre lines.
    ctx.fillStyle = PALETTE.road;
    for (const ax of world.avenues) {
      if (ax + ROAD_HALF > vx0 && ax - ROAD_HALF < vx1) ctx.fillRect(ax - ROAD_HALF, vy0, ROAD_HALF * 2, vy1 - vy0);
    }
    for (const sy of world.streets) {
      if (sy + ROAD_HALF > vy0 && sy - ROAD_HALF < vy1) ctx.fillRect(vx0, sy - ROAD_HALF, vx1 - vx0, ROAD_HALF * 2);
    }
    ctx.fillStyle = PALETTE.sidewalk;
    for (const ax of world.avenues) {
      if (ax + ROAD_HALF + SIDEWALK > vx0 && ax - ROAD_HALF - SIDEWALK < vx1) {
        ctx.fillRect(ax - ROAD_HALF - SIDEWALK, vy0, SIDEWALK, vy1 - vy0);
        ctx.fillRect(ax + ROAD_HALF, vy0, SIDEWALK, vy1 - vy0);
      }
    }
    for (const sy of world.streets) {
      if (sy + ROAD_HALF + SIDEWALK > vy0 && sy - ROAD_HALF - SIDEWALK < vy1) {
        ctx.fillRect(vx0, sy - ROAD_HALF - SIDEWALK, vx1 - vx0, SIDEWALK);
        ctx.fillRect(vx0, sy + ROAD_HALF, vx1 - vx0, SIDEWALK);
      }
    }
    ctx.fillStyle = PALETTE.roadLine;
    for (const ax of world.avenues) {
      if (ax < vx0 || ax > vx1) continue;
      for (let y = Math.floor(vy0 / 44) * 44; y < vy1; y += 44) ctx.fillRect(ax - 2, y, 4, 22);
    }
    for (const sy of world.streets) {
      if (sy < vy0 || sy > vy1) continue;
      for (let x = Math.floor(vx0 / 44) * 44; x < vx1; x += 44) ctx.fillRect(x, sy - 2, 22, 4);
    }

    // Buildings: soft shadow, wall, roof, windows.
    for (const b of world.buildings) {
      if (!vis(b.x - 40, b.y - 60, b.w + 80, b.h + 100)) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 8, b.y + b.height * 0.4 + 8, b.w, b.h);
      ctx.fillStyle = PALETTE.buildingWall;
      ctx.fillRect(b.x, b.y + 6, b.w, b.h - 6);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      ctx.fillStyle = 'rgba(255,255,220,0.5)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          ctx.fillRect(b.x + 10 + i * 34, b.y + 10 + j * 34, 12, 10);
        }
      }
    }

    // Trees and palms.
    for (const t of world.trees) {
      if (!vis(t.x - 24, t.y - 24, 48, 48)) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(t.x + 4, t.y + 6, t.r, t.r * 0.7, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = t.palm ? PALETTE.treeLight : PALETTE.tree;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.45, 0, TAU);
      ctx.fill();
    }

    // Depot and hideout zones.
    this.drawZone(game, world.depot.x, world.depot.y, 'DEPOT', '#ffd23f');
    this.drawZone(game, world.hideout.x, world.hideout.y, 'HIDEOUT', '#34c759');

    // Mission beacon.
    const step = game.missions.current();
    if (step && game.mode === 'playing') {
      const pulse = 1 + Math.sin(game.time * 4) * 0.12;
      ctx.strokeStyle = PALETTE.marker;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(step.pos.x, step.pos.y, 46 * pulse, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,210,63,0.18)';
      ctx.beginPath();
      ctx.arc(step.pos.x, step.pos.y, 46 * pulse, 0, TAU);
      ctx.fill();
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.moveTo(step.pos.x, step.pos.y - 58);
      ctx.lineTo(step.pos.x - 12, step.pos.y - 34);
      ctx.lineTo(step.pos.x + 12, step.pos.y - 34);
      ctx.closePath();
      ctx.fill();
    }

    // Pickups.
    for (const pk of game.pickups) {
      if (pk.taken) continue;
      const bob = Math.sin(game.time * 3 + pk.bob) * 4;
      ctx.save();
      ctx.translate(pk.x, pk.y + bob);
      ctx.fillStyle = pk.type === 'health' ? '#34c759' : pk.type === 'ammo' ? '#ffd23f' : '#7dd93d';
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pk.type === 'health' ? '+' : pk.type === 'ammo' ? 'A' : '$', 0, 1);
      ctx.restore();
    }

    // Cars, people, bullets, particles.
    for (const car of game.cars) this.drawCar(game, car);
    for (const ped of game.peds) this.drawPed(game, ped);
    for (const cop of game.cops) this.drawCop(game, cop);
    this.drawPlayer(game);
    ctx.strokeStyle = '#ffe14d';
    ctx.lineWidth = 3;
    for (const b of game.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - Math.cos(b.angle) * 14, b.y - Math.sin(b.angle) * 14);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const pt of game.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawZone(game, x, y, label, color) {
    const ctx = this.ctx;
    const cam = game.camera;
    const sx = x - cam.x + VIEW_W / 2;
    const sy = y - cam.y + VIEW_H / 2;
    if (sx < -120 || sx > VIEW_W + 120 || sy < -120 || sy > VIEW_H + 120) return;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, -62);
    ctx.restore();
  }

  drawCar(game, car) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-24, -12, 48, 26);
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-24, -13, 48, 26, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,30,40,0.85)';
    ctx.fillRect(-6, -11, 14, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(20, -10, 3, 6);
    ctx.fillRect(20, 4, 3, 6);
    if (car.brakeLight) {
      ctx.fillStyle = '#ff2d2d';
      ctx.fillRect(-25, -10, 3, 6);
      ctx.fillRect(-25, 4, 3, 6);
    }
    if (car.driver === 'police') {
      const on = Math.sin(car.sirenPhase) > 0;
      ctx.fillStyle = on ? '#ff3b30' : '#2b4fd8';
      ctx.fillRect(-2, -13, 8, 5);
      ctx.fillStyle = on ? '#2b4fd8' : '#ff3b30';
      ctx.fillRect(-2, 8, 8, 5);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('VCPD', 0, 3);
    }
    if (car.driver === 'courier') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('KURIR', 0, 3);
    }
    ctx.restore();
  }

  drawPed(game, ped) {
    const ctx = this.ctx;
    if (ped.state === 'down') {
      ctx.save();
      ctx.translate(ped.x, ped.y);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 8, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 6, ped.angle, 0, TAU);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 10, 6, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath();
    ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3, 5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawCop(game, cop) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 11, 7, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1d2f6e';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(Math.cos(cop.angle) * 4, Math.sin(cop.angle) * 4, 3.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#0a0f1e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(cop.angle) * 16, Math.sin(cop.angle) * 16);
    ctx.stroke();
    ctx.restore();
  }

  drawPlayer(game) {
    const ctx = this.ctx;
    const p = game.player;
    if (!p.onFoot) return; // the player is inside the car sprite
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.hurtFlash > 0) ctx.globalAlpha = 0.55 + 0.45 * Math.sin(game.time * 30);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 5, 12, 7, 0, 0, TAU);
    ctx.fill();
    // Legs swing while walking.
    const swing = Math.sin(p.walkPhase) * 4;
    ctx.strokeStyle = '#2b3a55';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-3, 2);
    ctx.lineTo(-3 + swing, 10);
    ctx.moveTo(3, 2);
    ctx.lineTo(3 - swing, 10);
    ctx.stroke();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#20242c';
    ctx.beginPath();
    ctx.arc(Math.cos(p.angle) * 4, Math.sin(p.angle) * 4, 6, 0, TAU);
    ctx.fill();
    // Pistol points at the mouse.
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(p.angle) * 22, Math.sin(p.angle) * 22);
    ctx.stroke();
    ctx.restore();
  }

  // ---------------------------------------------------------- HUD

  drawHud(game) {
    const ctx = this.ctx;
    const p = game.player;
    // Top-left: cash, health, ammo.
    ctx.fillStyle = 'rgba(10,14,18,0.72)';
    ctx.beginPath();
    ctx.roundRect(14, 14, 250, 74, 10);
    ctx.fill();
    ctx.fillStyle = '#7dd93d';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`$ ${Math.floor(game.cash).toLocaleString('en-US')}`, 28, 44);
    ctx.fillStyle = '#8a97a3';
    ctx.font = '13px sans-serif';
    ctx.fillText(`Misi ${Math.min(game.missions.index + 1, 3)}/3  •  ${game.missions.name}`, 28, 66);
    ctx.fillStyle = '#222';
    ctx.fillRect(28, 72, 150, 8);
    ctx.fillStyle = p.health > 30 ? '#34c759' : '#ff453a';
    ctx.fillRect(28, 72, 150 * clamp(p.health / 100, 0, 1), 8);
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.fillText(`AMMO ${p.ammo}`, 190, 80);

    // Top-right: wanted stars.
    ctx.fillStyle = 'rgba(10,14,18,0.72)';
    ctx.beginPath();
    ctx.roundRect(VIEW_W - 214, 14, 200, 46, 10);
    ctx.fill();
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'left';
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < game.wanted ? '#ffd23f' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', VIEW_W - 200 + i * 38, 46);
    }

    // Objective banner, top centre.
    const label = game.missions.objectiveLabel();
    ctx.font = 'bold 16px sans-serif';
    const w = ctx.measureText(label).width + 36;
    ctx.fillStyle = 'rgba(10,14,18,0.72)';
    ctx.beginPath();
    ctx.roundRect((VIEW_W - w) / 2, 14, w, 40, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.textAlign = 'center';
    ctx.fillText(label, VIEW_W / 2, 40);

    // Toast message.
    if (game.messageText && game.time < game.messageUntil) {
      ctx.font = 'bold 20px sans-serif';
      const mw = ctx.measureText(game.messageText).width + 40;
      ctx.fillStyle = 'rgba(10,14,18,0.78)';
      ctx.beginPath();
      ctx.roundRect((VIEW_W - mw) / 2, 66, mw, 38, 10);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(game.messageText, VIEW_W / 2, 92);
    }

    // Speedometer while driving.
    if (!p.onFoot && p.car) {
      const kmh = Math.abs(p.car.speed) * 0.9;
      ctx.fillStyle = 'rgba(10,14,18,0.72)';
      ctx.beginPath();
      ctx.roundRect(VIEW_W - 170, VIEW_H - 66, 156, 52, 10);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(kmh)}`, VIEW_W - 52, VIEW_H - 30);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#8a97a3';
      ctx.fillText('km/h', VIEW_W - 26, VIEW_H - 30);
    }

    // Interact hint.
    if (game.nearCar && p.onFoot) {
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = 'rgba(10,14,18,0.78)';
      const t = game.nearCar.driver === 'traffic' ? 'Tekan E — curi mobil (polisi akan mengejarmu!)' : 'Tekan E — masuk mobil';
      const tw = ctx.measureText(t).width + 36;
      ctx.beginPath();
      ctx.roundRect((VIEW_W - tw) / 2, VIEW_H - 110, tw, 36, 10);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(t, VIEW_W / 2, VIEW_H - 86);
    }

    // Edge arrow toward the objective.
    const step = game.missions.current();
    if (step) this.drawObjectiveArrow(game, step.pos);

    // Crosshair on foot.
    if (p.onFoot) {
      const mx = game.input.mouseX;
      const my = game.input.mouseY;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, my, 9, 0, TAU);
      ctx.moveTo(mx - 14, my);
      ctx.lineTo(mx - 6, my);
      ctx.moveTo(mx + 6, my);
      ctx.lineTo(mx + 14, my);
      ctx.moveTo(mx, my - 14);
      ctx.lineTo(mx, my - 6);
      ctx.moveTo(mx, my + 6);
      ctx.lineTo(mx, my + 14);
      ctx.stroke();
    }

    this.drawMinimap(game);

    // Controls hint, bottom right — hidden while driving, the speedometer lives there.
    if (p.onFoot) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('WASD gerak • E masuk/keluar mobil • Klik tembak • R isi peluru • P jeda • M suara', VIEW_W - 14, VIEW_H - 14);
    }
    if (game.muted) {
      ctx.fillStyle = '#ff453a';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('SUARA MATI (M)', VIEW_W - 14, p.onFoot ? VIEW_H - 32 : VIEW_H - 76);
    }
  }

  drawObjectiveArrow(game, target) {
    const ctx = this.ctx;
    const cam = game.camera;
    const sx = target.x - cam.x + VIEW_W / 2;
    const sy = target.y - cam.y + VIEW_H / 2;
    if (sx > 40 && sx < VIEW_W - 40 && sy > 40 && sy < VIEW_H - 40) return;
    const cx = VIEW_W / 2;
    const cy = VIEW_H / 2;
    const ang = Math.atan2(sy - cy, sx - cx);
    const ax = cx + Math.cos(ang) * 300;
    const ay = cy + Math.sin(ang) * 200;
    const d = Math.round(dist(game.player.x, game.player.y, target.x, target.y));
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-8, -11);
    ctx.lineTo(-8, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${d}m`, ax, ay + 26);
  }

  drawMinimap(game) {
    const ctx = this.ctx;
    const x0 = 14;
    const y0 = VIEW_H - MINIMAP_H - 14;
    const sx = MINIMAP_W / 3600;
    const sy = MINIMAP_H / 2600;
    ctx.fillStyle = 'rgba(10,14,18,0.78)';
    ctx.beginPath();
    ctx.roundRect(x0 - 6, y0 - 6, MINIMAP_W + 12, MINIMAP_H + 12, 10);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, MINIMAP_W, MINIMAP_H);
    ctx.clip();
    ctx.fillStyle = '#3f7d33';
    ctx.fillRect(x0, y0, MINIMAP_W, MINIMAP_H);
    ctx.fillStyle = '#2a7fa8';
    ctx.fillRect(x0 + 2960 * sx, y0 + 1960 * sy, (3600 - 2960) * sx, (2600 - 1960) * sy);
    ctx.strokeStyle = '#c9c9c2';
    ctx.lineWidth = 2;
    for (const ax of game.world.avenues) {
      ctx.beginPath();
      ctx.moveTo(x0 + ax * sx, y0);
      ctx.lineTo(x0 + ax * sx, y0 + MINIMAP_H);
      ctx.stroke();
    }
    for (const s of game.world.streets) {
      ctx.beginPath();
      ctx.moveTo(x0, y0 + s * sy);
      ctx.lineTo(x0 + MINIMAP_W, y0 + s * sy);
      ctx.stroke();
    }
    const step = game.missions.current();
    if (step) {
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(x0 + step.pos.x * sx, y0 + step.pos.y * sy, 5, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#ff453a';
    for (const cop of game.cops) {
      ctx.beginPath();
      ctx.arc(x0 + cop.x * sx, y0 + cop.y * sy, 3, 0, TAU);
      ctx.fill();
    }
    const p = game.player;
    const px = p.onFoot ? p.x : p.car.x;
    const py = p.onFoot ? p.y : p.car.y;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x0 + px * sx, y0 + py * sy, 4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('VICE BAY', x0, y0 - 12);
  }

  // ---------------------------------------------------------- menus

  drawMenu(game) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(6,10,16,0.62)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 92px sans-serif';
    ctx.fillText('VICE BAY', VIEW_W / 2, 168);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('Kota Leonida menunggumu.', VIEW_W / 2, 212);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const lines = [
      'Kamu baru sampai di Vice Bay dengan satu tas, satu pistol, dan utang.',
      'Kerjakan tiga misi untuk Marisol — antar paket, kejar kurir, lalu kabur',
      'dari razia besar — dan kota ini jadi milikmu.',
    ];
    lines.forEach((l, i) => ctx.fillText(l, VIEW_W / 2, 252 + i * 24));
    if (game.save) {
      ctx.fillStyle = '#7dd93d';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`Lanjutan tersimpan: $ ${Math.floor(game.save.cash)}  •  misi ${Math.min(game.save.missionIndex + 1, 3)}/3`, VIEW_W / 2, 340);
    }
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    const controls = [
      'WASD / Panah — jalan & mengemudi      Shift — lari',
      'E — masuk / keluar mobil (curi mobil warga = bintang wanted)',
      'Klik mouse — tembak      R — isi peluru      P — jeda      M — suara',
    ];
    controls.forEach((l, i) => ctx.fillText(l, VIEW_W / 2, 396 + i * 24));
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 24px sans-serif';
    const blink = 0.6 + 0.4 * Math.sin(game.time * 4);
    ctx.globalAlpha = blink;
    ctx.fillText('Tekan ENTER untuk mulai', VIEW_W / 2, 500);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '12px sans-serif';
    ctx.fillText('Game orisinal 2D — bukan GTA. Semua nama, karakter dan kota di sini fiktif.', VIEW_W / 2, 690);
  }

  drawEndCard(game, title, color, sub) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(6,10,16,0.66)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText(title, VIEW_W / 2, 300);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText(sub, VIEW_W / 2, 344);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 22px sans-serif';
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(game.time * 4);
    ctx.fillText('Tekan ENTER untuk mencoba lagi', VIEW_W / 2, 420);
    ctx.globalAlpha = 1;
  }

  drawWinCard(game) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(6,10,16,0.7)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText('VICE BAY MILIKMU', VIEW_W / 2, 240);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText('Tiga pekerjaan selesai. Marisol lunas — dan kota ini mengenal namamu.', VIEW_W / 2, 292);
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#7dd93d';
    ctx.fillText(`Uang akhir: $ ${Math.floor(game.cash).toLocaleString('en-US')}   •   Mobil dicuri: ${game.stats.carsStolen}   •   Tembakan tepat: ${game.stats.hits}/${game.stats.shots}`, VIEW_W / 2, 344);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 22px sans-serif';
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(game.time * 4);
    ctx.fillText('Tekan ENTER untuk free roam', VIEW_W / 2, 420);
    ctx.globalAlpha = 1;
  }

  drawPaused(game) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(6,10,16,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('JEDA', VIEW_W / 2, 330);
    ctx.font = '18px sans-serif';
    ctx.fillText('Tekan P untuk lanjut', VIEW_W / 2, 372);
  }
}
