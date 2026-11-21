// VICE BAY — all drawing: world, entities, HUD, minimap, menu overlays.
// Written fresh for the rebuild.
import { WORLD, AVENUES, STREETS, ROAD_W, COLORS, ZONES } from './config.js';
import { clamp, TAU } from './random.js';
import { MISSIONS } from './missions.js';

function rr(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.fill();
}

function drawButton(G, id, x, y, w, h, label, font = 'bold 20px system-ui, sans-serif') {
  const ctx = G.ctx;
  const mx = G.mouseX || 0;
  const my = G.mouseY || 0;
  const hover = mx >= x && mx <= x + w && my >= y && my <= y + h;
  ctx.fillStyle = hover ? '#ffd700' : 'rgba(255,255,255,0.92)';
  rr(ctx, x, y, w, h);
  ctx.fillStyle = '#111';
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  G.ui.buttons.push({ id, x, y, w, h });
}

export function draw(G) {
  const ctx = G.ctx;
  const cw = G.view.w;
  const ch = G.view.h;
  G.ui = { buttons: [] };
  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = '#0c0f14';
  ctx.fillRect(0, 0, cw, ch);

  // Camera follows the player, clamped to the world.
  const p = G.player;
  const zoom = G.cam.zoom;
  const vw = cw / zoom;
  const vh = ch / zoom;
  let camX = clamp(p.x - vw / 2, 0, Math.max(0, WORLD.w - vw));
  let camY = clamp(p.y - vh / 2, 0, Math.max(0, WORLD.h - vh));
  if (WORLD.w < vw) camX = (WORLD.w - vw) / 2;
  if (WORLD.h < vh) camY = (WORLD.h - vh) / 2;
  const shx = G.shake ? (Math.random() - 0.5) * G.shake : 0;
  const shy = G.shake ? (Math.random() - 0.5) * G.shake : 0;
  G.cam.x = camX;
  G.cam.y = camY;
  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(-camX + shx, -camY + shy);

  drawGround(G);
  drawZones(G);
  drawPickups(G);
  drawCars(G);
  drawPeds(G);
  drawPlayer(G);
  drawBullets(G);
  drawParticles(G);
  drawObjectiveMarker(G);
  ctx.restore();

  if (G.mode === 'playing' || G.mode === 'paused') drawHUD(G);
  if (G.mode === 'menu') drawMenu(G);
  if (G.mode === 'paused') drawPaused(G);
  if (G.mode === 'busted') drawBusted(G);
  if (G.mode === 'win') drawWin(G);
}

function drawGround(G) {
  const ctx = G.ctx;
  // Base ground + subtle checker for texture.
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  ctx.fillStyle = COLORS.groundAlt;
  const ts = 260;
  for (let x = 0; x < WORLD.w; x += ts) {
    for (let y = 0; y < WORLD.h; y += ts) {
      if (((x / ts) + (y / ts)) % 2 === 0) ctx.fillRect(x, y, ts, ts);
    }
  }
  // Beach + water on the east edge.
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(2440, 0, 60, WORLD.h);
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(2500, 0, WORLD.w - 2500, WORLD.h);
  // Sidewalks then roads.
  for (const ax of AVENUES) {
    ctx.fillStyle = COLORS.sidewalk;
    ctx.fillRect(ax - ROAD_W / 2 - 9, 0, ROAD_W + 18, WORLD.h);
  }
  for (const sy of STREETS) {
    ctx.fillStyle = COLORS.sidewalk;
    ctx.fillRect(0, sy - ROAD_W / 2 - 9, WORLD.w, ROAD_W + 18);
  }
  for (const ax of AVENUES) {
    ctx.fillStyle = COLORS.road;
    ctx.fillRect(ax - ROAD_W / 2, 0, ROAD_W, WORLD.h);
    ctx.strokeStyle = COLORS.dash;
    ctx.lineWidth = 3;
    ctx.setLineDash([20, 24]);
    ctx.beginPath();
    ctx.moveTo(ax, 0);
    ctx.lineTo(ax, WORLD.h);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const sy of STREETS) {
    ctx.fillStyle = COLORS.road;
    ctx.fillRect(0, sy - ROAD_W / 2, WORLD.w, ROAD_W);
    ctx.strokeStyle = COLORS.dash;
    ctx.lineWidth = 3;
    ctx.setLineDash([20, 24]);
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(WORLD.w, sy);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Buildings.
  for (const b of G.buildings) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = COLORS.roofLine;
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if ((i + j) % 2 === 0) ctx.fillRect(b.x + 8 + i * 26, b.y + 8 + j * 26, 10, 8);
      }
    }
  }
}

const ZONE_STYLE = {
  garage: { label: 'GARAGE', color: '#4a90d9' },
  package: { label: 'PAKET', color: '#f2b134' },
  dropoff: { label: 'DROP-OFF', color: '#43aa5a' },
  store: { label: 'TOKO', color: '#e07856' },
  safehouse: { label: 'SAFEHOUSE', color: '#7b61ff' },
  docks: { label: 'DERMAGA', color: '#2e86ab' },
  penthouse: { label: 'PENTHOUSE', color: '#ffd700' },
  spawn: { label: '', color: '#ffffff' },
};

function drawZones(G) {
  const ctx = G.ctx;
  for (const [key, z] of Object.entries(ZONES)) {
    const st = ZONE_STYLE[key];
    if (!st || !st.label) continue;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = st.color;
    ctx.beginPath();
    ctx.arc(z.x, z.y, 26, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(z.x, z.y, 26, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(st.label.split(' ')[0], z.x, z.y - 4);
    ctx.fillText(st.label.split(' ')[1] || '', z.x, z.y + 8);
    ctx.restore();
  }
}

function drawPickups(G) {
  const ctx = G.ctx;
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    const bob = Math.sin(G.time * 3 + pk.x) * 2;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(pk.x, pk.y + bob, 13, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2fae4e';
    ctx.fillRect(pk.x - 8, pk.y - 3 + bob, 16, 6);
    ctx.fillRect(pk.x - 3, pk.y - 8 + bob, 6, 16);
  }
}

function drawCarShape(G, car) {
  const ctx = G.ctx;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.rect(-23, -10, 46, 24);
  ctx.fill();
  // Body.
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.rect(-22, -11, 44, 22);
  ctx.fill();
  // Windshield + rear window.
  ctx.fillStyle = '#1b2a3a';
  ctx.fillRect(6, -9, 8, 18);
  ctx.fillRect(-14, -9, 5, 18);
  // Headlights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(20, -9, 3, 5);
  ctx.fillRect(20, 4, 3, 5);
  if (car.kind === 'police') {
    // Dark doors + light bar.
    ctx.fillStyle = COLORS.policeTrim;
    ctx.fillRect(-6, -11, 12, 22);
    const blink = Math.floor(G.time * 6) % 2 === 0;
    ctx.fillStyle = blink ? '#ff2d2d' : '#2d7dff';
    ctx.beginPath();
    ctx.arc(-2, -6, 3.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = blink ? '#2d7dff' : '#ff2d2d';
    ctx.beginPath();
    ctx.arc(-2, 6, 3.5, 0, TAU);
    ctx.fill();
  }
  if (car.gold) {
    ctx.strokeStyle = '#fff3b0';
    ctx.lineWidth = 2;
    ctx.strokeRect(-22, -11, 44, 22);
  }
  if (car.playerDriven) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-24, -13, 48, 26);
  }
  ctx.restore();
}

function drawCars(G) {
  for (const car of G.cars) {
    if (car.dead) continue;
    drawCarShape(G, car);
  }
}

function drawPeds(G) {
  const ctx = G.ctx;
  for (const ped of G.peds) {
    if (ped.down > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 13, 7, ped.angle, 0, TAU);
      ctx.fill();
      continue;
    }
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 8, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 8, 0, TAU);
    ctx.stroke();
  }
  for (const cop of G.footCops) {
    ctx.fillStyle = '#1c2f57';
    ctx.beginPath();
    ctx.arc(cop.x, cop.y, 10, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(cop.x, cop.y, 3, 0, TAU);
    ctx.fill();
  }
}

function drawPlayer(G) {
  const ctx = G.ctx;
  const p = G.player;
  if (!p.onFoot) return;
  // Body + head + gun direction.
  ctx.fillStyle = '#20242b';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 11, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f2c29b';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 6, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + Math.cos(p.aimAngle ?? p.angle) * 20, p.y + Math.sin(p.aimAngle ?? p.angle) * 20);
  ctx.stroke();
  // Low-HP ring.
  if (p.hp < 30) {
    ctx.strokeStyle = `rgba(255,40,40,${0.5 + 0.4 * Math.sin(G.time * 6)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 16, 0, TAU);
    ctx.stroke();
  }
}

function drawBullets(G) {
  const ctx = G.ctx;
  ctx.strokeStyle = COLORS.bullet;
  ctx.lineWidth = 3;
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function drawParticles(G) {
  const ctx = G.ctx;
  for (const pt of G.parts) {
    ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawObjectiveMarker(G) {
  const ctx = G.ctx;
  const o = G.objective;
  if (!o || !o.x || !o.y) return;
  const pulse = 24 + Math.sin(G.time * 4) * 5;
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(o.x, o.y, pulse, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(o.x, o.y, 5, 0, TAU);
  ctx.fill();
  // Edge arrow when the target is off-screen.
  const vw = G.view.w / G.cam.zoom;
  const vh = G.view.h / G.cam.zoom;
  const p = G.player;
  const dx = o.x - p.x;
  const dy = o.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d > Math.min(vw, vh) * 0.55) {
    const a = Math.atan2(dy, dx);
    const ax = p.x + Math.cos(a) * Math.min(vw, vh) * 0.42;
    const ay = p.y + Math.sin(a) * Math.min(vw, vh) * 0.42;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(a);
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawHUD(G) {
  const ctx = G.ctx;
  const cw = G.view.w;
  const ch = G.view.h;
  const p = G.player;
  // Top-left: HP + money.
  ctx.fillStyle = COLORS.hudBg;
  rr(ctx, 12, 12, 220, 58);
  ctx.fillStyle = '#333';
  ctx.fillRect(24, 24, 150, 14);
  ctx.fillStyle = p.hp > 50 ? '#43c465' : p.hp > 25 ? '#f2b134' : '#e63946';
  ctx.fillRect(24, 24, 150 * clamp(p.hp / 100, 0, 1), 14);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`HP ${Math.ceil(p.hp)}`, 182, 36);
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.fillStyle = COLORS.hudAccent;
  ctx.fillText(`$${G.money.toLocaleString('en-US')}`, 24, 62);
  // Top-right: wanted stars.
  ctx.fillStyle = COLORS.hudBg;
  rr(ctx, cw - 172, 12, 160, 40);
  ctx.font = '26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < G.wanted ? '★' : '☆';
  ctx.fillStyle = '#ffd700';
  ctx.fillText(stars, cw - 92, 42);
  // Top-center: objective.
  if (G.objective && G.objective.text) {
    ctx.font = 'bold 16px system-ui, sans-serif';
    const w = Math.min(520, ctx.measureText(G.objective.text).width + 28);
    ctx.fillStyle = COLORS.hudBg;
    rr(ctx, (cw - w) / 2, 12, w, 40);
    ctx.fillStyle = COLORS.hudText;
    ctx.textAlign = 'center';
    ctx.fillText(G.objective.text, cw / 2, 38);
    if (G.objective.x && G.objective.y) {
      const d = Math.round(Math.hypot(G.objective.x - p.x, G.objective.y - p.y) / 10);
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText(`${d} m`, cw / 2, 68);
    }
  }
  if (G.showMinimap !== false) drawMinimap(G);
  // Toast.
  if (G.time < G.toast.until && G.toast.text) {
    ctx.font = 'bold 17px system-ui, sans-serif';
    const w = ctx.measureText(G.toast.text).width + 30;
    ctx.fillStyle = COLORS.toastBg;
    rr(ctx, (cw - w) / 2, ch - 64, w, 36);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(G.toast.text, cw / 2, ch - 40);
  }
  // Controls hint.
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.textAlign = 'left';
  ctx.fillText('WASD jalan/nyetir · Shift lari · E masuk/keluar mobil · F/klik tembak · P jeda', 14, ch - 14);
}

function drawMinimap(G) {
  const ctx = G.ctx;
  const cw = G.view.w;
  const ch = G.view.h;
  const mw = 180;
  const mh = 124;
  const mx = cw - mw - 12;
  const my = ch - mh - 12;
  const sx = mw / WORLD.w;
  const sy = mh / WORLD.h;
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  rr(ctx, mx, my, mw, mh);
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, mw, mh);
  ctx.clip();
  ctx.strokeStyle = '#8a929c';
  ctx.lineWidth = 2;
  for (const ax of AVENUES) {
    ctx.beginPath();
    ctx.moveTo(mx + ax * sx, my);
    ctx.lineTo(mx + ax * sx, my + mh);
    ctx.stroke();
  }
  for (const sy2 of STREETS) {
    ctx.beginPath();
    ctx.moveTo(mx, my + sy2 * sy);
    ctx.lineTo(mx + mw, my + sy2 * sy);
    ctx.stroke();
  }
  ctx.fillStyle = '#2e86ab';
  ctx.fillRect(mx + 2500 * sx, my, (WORLD.w - 2500) * sx, mh);
  for (const b of G.buildings) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(mx + b.x * sx, my + b.y * sy, Math.max(1.5, b.w * sx), Math.max(1.5, b.h * sy));
  }
  const dot = (x, y, color, r = 3) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mx + x * sx, my + y * sy, r, 0, TAU);
    ctx.fill();
  };
  if (G.objective && G.objective.x) dot(G.objective.x, G.objective.y, '#ffd700', 4);
  for (const car of G.cars) {
    if (car.dead) continue;
    if (car.kind === 'police') dot(car.x, car.y, '#ff4d4d', 3);
    else if (car.gold) dot(car.x, car.y, '#ffd700', 3.5);
  }
  dot(G.player.x, G.player.y, '#ffffff', 4);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(mx + G.player.x * sx, my + G.player.y * sy, 4, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function overlay(G, alpha) {
  const ctx = G.ctx;
  ctx.fillStyle = `rgba(8,10,16,${alpha})`;
  ctx.fillRect(0, 0, G.view.w, G.view.h);
}

function drawMenu(G) {
  const ctx = G.ctx;
  const cw = G.view.w;
  const ch = G.view.h;
  overlay(G, 0.72);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('VICE BAY', cw / 2, ch / 2 - 110);
  ctx.fillStyle = '#fff';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('Open-world crime di kota Vice Bay — curi mobil, kabur dari polisi, jadi Raja Teluk.', cw / 2, ch / 2 - 68);
  const bw = 260;
  const bx = (cw - bw) / 2;
  drawButton(G, 'new', bx, ch / 2 - 30, bw, 52, '▶  New Game');
  if (G.saveExists) drawButton(G, 'continue', bx, ch / 2 + 34, bw, 52, 'Continue');
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('WASD jalan / nyetir · Shift sprint · E masuk & keluar mobil · F / klik tembak · P jeda · M minimap', cw / 2, ch / 2 + 128);
  ctx.fillText('5 misi cerita sampai WIN, lalu free roam. Simpan otomatis tiap misi selesai.', cw / 2, ch / 2 + 152);
}

function drawPaused(G) {
  const ctx = G.ctx;
  const cw = G.view.w;
  const ch = G.view.h;
  overlay(G, 0.6);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', cw / 2, ch / 2 - 60);
  const bw = 260;
  const bx = (cw - bw) / 2;
  drawButton(G, 'resume', bx, ch / 2 - 10, bw, 52, 'Lanjutkan');
  drawButton(G, 'quit', bx, ch / 2 + 54, bw, 52, 'Simpan & ke Menu');
}

function drawBusted(G) {
  const ctx = G.ctx;
  const cw = G.view.w;
  const ch = G.view.h;
  overlay(G, 0.55);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff4d4d';
  ctx.font = 'bold 58px system-ui, sans-serif';
  ctx.fillText('BUSTED!', cw / 2, ch / 2 - 20);
  ctx.fillStyle = '#fff';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('Polisi menangkapmu. Tekan Enter untuk respawn (-$100).', cw / 2, ch / 2 + 24);
}

function drawWin(G) {
  const ctx = G.ctx;
  const cw = G.view.w;
  const ch = G.view.h;
  overlay(G, 0.6);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.fillText('KAMU MENANG!', cw / 2, ch / 2 - 70);
  ctx.fillStyle = '#fff';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText(`Raja Teluk! Semua 5 misi selesai. Total uang: $${G.money.toLocaleString('en-US')}`, cw / 2, ch / 2 - 28);
  const bw = 260;
  const bx = (cw - bw) / 2;
  drawButton(G, 'roam', bx, ch / 2 + 10, bw, 52, 'Free Roam');
  drawButton(G, 'menu', bx, ch / 2 + 74, bw, 52, 'Ke Menu');
}
