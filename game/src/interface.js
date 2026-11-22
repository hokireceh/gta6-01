// Vice Bay's interface: the HUD (cash, health, ammo, wanted stars, clock and
// weather, mission objective, minimap), the edge arrow that points at the
// mission marker, and the full screens (title, pause, busted, wasted, win).
// Everything draws on the same canvas as the world, so the screenshots show
// the whole game at once.

import { cashString, clamp, clockString } from './tools.js';

const W = 1280;
const H = 720;

/** Draws the whole HUD for the play state. */
export function drawHud(ctx, g) {
  ctx.save();
  // Top-left: cash, health, ammo.
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, 14, 12, 250, 108, 10);
  ctx.fill();
  ctx.fillStyle = '#7ee787';
  ctx.fillText(cashString(g.cash), 28, 44);
  // Health bar.
  ctx.fillStyle = '#222';
  ctx.fillRect(28, 54, 180, 14);
  ctx.fillStyle = g.arsenal.health > 35 ? '#e5484d' : '#ff2020';
  ctx.fillRect(28, 54, 180 * clamp(g.arsenal.health / g.arsenal.maxHealth, 0, 1), 14);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`HP ${Math.ceil(g.arsenal.health)}`, 214, 66);
  // Ammo.
  ctx.fillStyle = g.arsenal.reloading ? '#ffd94a' : '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(g.arsenal.reloading ? 'RELOADING…' : `AMMO ${g.arsenal.ammo} / ${g.arsenal.reserve}`, 28, 100);

  // Top-right: wanted stars, clock, weather.
  ctx.textAlign = 'right';
  ctx.font = 'bold 30px sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < g.wanted.stars ? '★' : '☆';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, W - 274, 12, 260, 76, 10);
  ctx.fill();
  ctx.fillStyle = g.wanted.stars > 0 ? '#ffd94a' : '#cfd8e3';
  ctx.fillText(stars, W - 28, 46);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(`${clockString(g.clock.minutes)}  ·  ${g.clock.glyph()}`, W - 28, 72);

  // Top-centre: mission objective.
  ctx.textAlign = 'center';
  ctx.font = 'bold 19px sans-serif';
  const obj = g.story.objective();
  const ow = ctx.measureText(obj).width + 36;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(ctx, W / 2 - ow / 2, 12, ow, 38, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd94a';
  ctx.fillText(obj, W / 2, 38);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(g.story.progressLabel, W / 2, 66);

  // Bottom-left: controls hint.
  ctx.textAlign = 'left';
  ctx.font = '14px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  const hint = g.inCar
    ? 'WASD drive · E exit car · mouse aim · click shoot · M mute · Esc pause'
    : 'WASD walk · Shift sprint · E enter car · mouse aim · click shoot · R reload · M mute';
  ctx.fillText(hint, 16, H - 16);

  // Speedometer when driving.
  if (g.inCar && g.car) {
    ctx.textAlign = 'right';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = '#fff';
    const kmh = Math.round(Math.abs(g.car.speed) * 0.32);
    ctx.fillText(`${kmh} km/h`, W - 236, H - 170);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#ffd94a';
    ctx.fillText(g.car.name.toUpperCase(), W - 236, H - 148);
  }

  // Mission banner (centre, fades).
  if (g.bannerTimer > 0) {
    const a = clamp(g.bannerTimer, 0, 1);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px sans-serif';
    const bw = ctx.measureText(g.banner).width + 44;
    ctx.fillStyle = 'rgba(10,16,32,0.82)';
    roundRect(ctx, W / 2 - bw / 2, 96, bw, 46, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(g.banner, W / 2, 127);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** Draws the minimap (bottom-right) with roads, blips and the marker. */
export function drawMinimap(ctx, g) {
  const mw = 210;
  const mh = 156;
  const mx = W - mw - 16;
  const my = H - mh - 16;
  const sx = mw / g.city.w;
  const sy = mh / g.city.h;
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,24,0.78)';
  roundRect(ctx, mx, my, mw, mh, 8);
  ctx.fill();
  ctx.beginPath();
  roundRect(ctx, mx, my, mw, mh, 8);
  ctx.clip();
  // Water and beach.
  ctx.fillStyle = '#2e6f9e';
  ctx.fillRect(mx + g.city.waterEast.x * sx, my, g.city.waterEast.w * sx, mh);
  ctx.fillStyle = '#d9c48a';
  ctx.fillRect(mx + g.city.beach.x * sx, my, g.city.beach.w * sx, mh);
  // Roads.
  ctx.strokeStyle = '#5a6472';
  ctx.lineWidth = 3;
  for (const rx of g.city.roadsV) {
    ctx.beginPath();
    ctx.moveTo(mx + rx * sx, my);
    ctx.lineTo(mx + rx * sx, my + mh);
    ctx.stroke();
  }
  for (const ry of g.city.roadsH) {
    ctx.beginPath();
    ctx.moveTo(mx, my + ry * sy);
    ctx.lineTo(mx + mw, my + ry * sy);
    ctx.stroke();
  }
  // Marker.
  if (g.story.marker) {
    const px = mx + g.story.marker.x * sx;
    const py = my + g.story.marker.y * sy;
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd94a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 10, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Police blips.
  ctx.fillStyle = '#4a90ff';
  for (const c of g.cops) {
    ctx.beginPath();
    ctx.arc(mx + c.x * sx, my + c.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const c of g.cruisers) {
    ctx.fillStyle = '#ff4a4a';
    ctx.beginPath();
    ctx.arc(mx + c.x * sx, my + c.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player.
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(mx + g.px * sx, my + g.py * sy, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(mx + g.px * sx, my + g.py * sy, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.textAlign = 'left';
  ctx.fillText('VICE BAY', mx + 8, my + 15);
  ctx.restore();
}

/**
 * Draws the off-screen edge arrow pointing at the mission marker, plus the
 * distance. Nothing when there is no marker or it is on screen.
 */
export function drawMarkerArrow(ctx, cam, marker, px, py) {
  if (!marker) return;
  const vx = marker.x - px;
  const vy = marker.y - py;
  const d = Math.hypot(vx, vy);
  if (d < 420) return;
  const a = Math.atan2(vy, vx);
  const cx = W / 2 + Math.cos(a) * 300;
  const cy = H / 2 + Math.sin(a) * 210;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.fillStyle = '#ffd94a';
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, -12);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-10, 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = '#ffd94a';
  ctx.fillText(`${Math.round(d / 10) * 10}m`, cx, cy + 30);
  ctx.restore();
}

/** Draws the pulsing mission marker ring in the world. */
export function drawWorldMarker(ctx, marker, time) {
  if (!marker) return;
  const pulse = 1 + Math.sin(time * 4) * 0.12;
  ctx.save();
  ctx.strokeStyle = '#ffd94a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, marker.radius * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,217,74,0.12)';
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, marker.radius * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(marker.label, marker.x, marker.y - marker.radius - 10);
  ctx.restore();
}

function panel(ctx, title, lines, accent) {
  ctx.save();
  ctx.fillStyle = 'rgba(6,10,22,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(title, W / 2, 200);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, W / 2, 260 + i * 34));
  ctx.restore();
}

/** Title screen. */
export function drawTitle(ctx, g) {
  panel(ctx, 'VICE BAY', [
    'An open-world crime game — an original city, its own story.',
    '',
    'Dario Voss is new in town. Sable the fixer has four jobs for him.',
    'Steal cars. Lose the cops. Take the Bay Job and vanish.',
    '',
    g.hasSave ? 'ENTER — start fresh    C — continue your save' : 'ENTER — start the story',
    'WASD move · Shift sprint · E enter / exit car · mouse aim · click shoot',
    'R reload · M mute · Esc pause',
  ], '#ffd94a');
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '14px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('A free original game. Not affiliated with Rockstar Games or GTA.', W / 2, H - 24);
  ctx.restore();
}

/** Pause screen. */
export function drawPause(ctx) {
  panel(ctx, 'PAUSED', ['Esc — resume', 'R — restart the current job', 'M — mute sound'], '#fff');
}

/** Busted / wasted screen. */
export function drawCaught(ctx, kind, cash) {
  const title = kind === 'busted' ? 'BUSTED' : 'WASTED';
  panel(ctx, title, [
    kind === 'busted' ? 'The Vice Bay PD caught up with you.' : 'Dario went down in the streets of Vice Bay.',
    `The cops took ${cashString(200)} off you. The jobs wait — Sable is patient.`,
    '',
    'R — get back on the street',
  ], '#ff5a5a');
}

/** Win screen. */
export function drawWin(ctx, stats) {
  panel(ctx, 'VICE BAY IS YOURS', [
    'The Bay Job is done. The bag is yours, the docks are behind you,',
    'and the city lights are all yours tonight.',
    '',
    `Cash: ${cashString(stats.cash)}    Jobs done: ${stats.jobs} / 4    Time: ${stats.time}`,
    '',
    'ENTER — free roam Vice Bay',
  ], '#7ee787');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
