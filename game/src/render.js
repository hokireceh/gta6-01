// VICE BAY — everything the player sees: the city, the cars, the people,
// the HUD, the minimap and the menu screens. Drawing only — this module
// never changes the game state (except reading it).

import {
  WORLD_SIZE, VIEW_W, VIEW_H, ZOOM, ROAD_WIDTH, ROAD_SPACING, PALETTE, LANDMARKS, SKYLINE_SEED,
} from "./config.js";
import { clamp, distance } from "./math.js";
import { SeededRandom } from "./random.js";
import { MISSIONS, loadGame } from "./missions.js";

// Round 5 note: the entrypoint now builds dossier.json with the vendored buildDossier and copies screenshots/ into the output.
function disc(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x, y, w, h);
}

function pillRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawFrame(ctx, canvas, g, city) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#0b0e1a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (g.screen === "menu") {
    drawMenu(ctx, canvas);
    return;
  }
  const ox = canvas.width / 2 - g.cam.x * ZOOM;
  const oy = canvas.height / 2 - g.cam.y * ZOOM;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(ZOOM, ZOOM);
  drawCity(ctx, city);
  drawPickups(ctx, g);
  drawCars(ctx, g);
  drawPeds(ctx, g);
  drawHero(ctx, g);
  drawShots(ctx, g);
  drawParticles(ctx, g);
  drawTarget(ctx, canvas, g);
  ctx.restore();
  drawHud(ctx, canvas, g, city);
  if (g.screen === "paused") drawPaused(ctx, canvas);
  if (g.screen === "busted") drawBusted(ctx, canvas, g);
  if (g.screen === "win") drawWin(ctx, canvas, g);
}

function drawCity(ctx, city) {
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);
  ctx.fillStyle = PALETTE.block;
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      ctx.fillRect(
        city.roads[i] + ROAD_WIDTH / 2,
        city.roads[j] + ROAD_WIDTH / 2,
        ROAD_SPACING - ROAD_WIDTH, ROAD_SPACING - ROAD_WIDTH,
      );
    }
  }
  ctx.fillStyle = PALETTE.road;
  for (const line of city.roads) {
    ctx.fillRect(line - ROAD_WIDTH / 2, 0, ROAD_WIDTH, WORLD_SIZE);
    ctx.fillRect(0, line - ROAD_WIDTH / 2, WORLD_SIZE, ROAD_WIDTH);
  }
  ctx.fillStyle = PALETTE.dash;
  for (const line of city.roads) {
    for (let v = 0; v < WORLD_SIZE; v += 60) {
      if (city.onRoad(v, line) && city.onRoad(line, v)) continue;
      ctx.fillRect(line - 2, v, 4, 28);
      ctx.fillRect(v, line - 2, 28, 4);
    }
  }
  for (const block of city.blocks) {
    ctx.fillStyle = block.park ? PALETTE.park : block.color;
    ctx.fillRect(block.x, block.y, block.w, block.h);
    if (!block.park) {
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(block.x + 8, block.y + 8, block.w - 16, 10);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(block.x, block.y + block.h - 12, block.w, 12);
    }
  }
  drawLandmark(ctx, LANDMARKS.shop, "#ffd23d");
  drawLandmark(ctx, LANDMARKS.delivery, "#ffd23d");
  drawLandmark(ctx, LANDMARKS.penthouse, "#ff6fb1");
  drawLandmark(ctx, LANDMARKS.hospital, "#5ad1e8");
}

function drawLandmark(ctx, spot, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.arc(spot.x, spot.y, spot.r * 0.7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = color;
  ctx.font = "bold 26px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(spot.label, spot.x, spot.y - spot.r * 0.7 - 10);
  ctx.restore();
}

function drawCarBody(ctx, car, g) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const len = car.gold ? 64 : 56;
  const wid = 28;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
  ctx.fillStyle = car.police ? "#101014" : car.color;
  pillRect(ctx, -len / 2, -wid / 2, len, wid, 8);
  ctx.fill();
  if (car.police) {
    ctx.fillStyle = "#f2f2f2";
    ctx.fillRect(-len / 2 + 8, -wid / 2, len - 16, wid);
    ctx.fillStyle = (Math.floor(g.time * 6) % 2 === 0) ? "#ff2e2e" : "#2e6bff";
    ctx.fillRect(-6, -wid / 2 - 4, 12, 8);
  } else {
    ctx.fillStyle = "rgba(180,220,255,0.85)";
    ctx.fillRect(len * 0.08, -wid / 2 + 4, 14, wid - 8);
    ctx.fillStyle = "#ffe9a8";
    ctx.fillRect(len / 2 - 4, -wid / 2 + 3, 4, 6);
    ctx.fillRect(len / 2 - 4, wid / 2 - 9, 4, 6);
  }
  if (car.gold) {
    ctx.fillStyle = "#fff3b0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("$", 0, 5);
  }
  ctx.restore();
}

function drawCars(ctx, g) {
  for (const car of g.cars) {
    if (car.dead) continue;
    drawCarBody(ctx, car, g);
    if (car.police) {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("POLICE", car.x, car.y - 24);
    }
  }
}

function drawPeds(ctx, g) {
  for (const ped of g.peds) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.down > 0) {
      ctx.rotate(1.2);
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = ped.color;
      disc(ctx, 0, 0, 9);
      ctx.strokeStyle = "#0b0e1a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ped.angle) * 12, Math.sin(ped.angle) * 12);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawHero(ctx, g) {
  const hero = g.player;
  if (hero.inCar) {
    drawCarBody(ctx, { ...hero.inCar, color: hero.inCar.gold ? PALETTE.gold : PALETTE.heroCar }, g);
    return;
  }
  ctx.save();
  ctx.translate(hero.x, hero.y);
  ctx.rotate(hero.angle);
  ctx.fillStyle = PALETTE.hero;
  disc(ctx, 0, 0, 13);
  ctx.fillStyle = "#fff";
  ctx.fillRect(6, -3, 12, 6);
  ctx.restore();
}

function drawShots(ctx, g) {
  ctx.fillStyle = "#ffd23d";
  for (const bullet of g.bullets) {
    ctx.save();
    ctx.translate(bullet.x, bullet.y);
    ctx.rotate(bullet.angle);
    ctx.fillRect(-8, -2, 16, 4);
    ctx.restore();
  }
}

function drawParticles(ctx, g) {
  for (const particle of g.particles) {
    ctx.globalAlpha = clamp(particle.life / particle.max, 0, 1);
    ctx.fillStyle = particle.color;
    disc(ctx, particle.x, particle.y, particle.size);
  }
  ctx.globalAlpha = 1;
}

function drawPickups(ctx, g) {
  for (const pickup of g.pickups) {
    if (pickup.taken) continue;
    ctx.save();
    ctx.translate(pickup.x, pickup.y);
    if (pickup.kind === "health") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(-12, -12, 24, 24);
      ctx.fillStyle = "#e83a3a";
      ctx.fillRect(-3, -9, 6, 18);
      ctx.fillRect(-9, -3, 18, 6);
    } else {
      ctx.fillStyle = "#37d67a";
      disc(ctx, 0, 0, 11);
      ctx.fillStyle = "#07331a";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("$", 0, 5);
    }
    ctx.restore();
  }
}

function drawTarget(ctx, canvas, g) {
  const mission = MISSIONS[g.mission];
  if (!mission || g.screen !== "playing") return;
  const spot = mission.target(g);
  const pulse = 1 + Math.sin(g.time * 4) * 0.15;
  ctx.save();
  ctx.strokeStyle = "#ffd23d";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(spot.x, spot.y, 46 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#ffd23d";
  disc(ctx, spot.x, spot.y, 8);
  ctx.restore();
  const dx = spot.x - g.player.x;
  const dy = spot.y - g.player.y;
  const d = Math.hypot(dx, dy);
  if (d > 320) {
    const heading = Math.atan2(dy, dx);
    const ax = canvas.width / 2 + Math.cos(heading) * 300;
    const ay = canvas.height / 2 + Math.sin(heading) * 220;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(heading);
    ctx.fillStyle = "#ffd23d";
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -12);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#ffd23d";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(Math.round(d) + "m", ax, ay + 30);
  }
}

function drawHud(ctx, canvas, g, city) {
  ctx.save();
  ctx.textAlign = "left";
  panel(ctx, 12, 12, 250, 64);
  ctx.fillStyle = "#37d67a";
  ctx.font = "bold 26px system-ui, sans-serif";
  ctx.fillText("$" + g.money.toLocaleString("en-US"), 24, 44);
  ctx.fillStyle = "#333";
  ctx.fillRect(24, 54, 180, 10);
  ctx.fillStyle = g.hp > 30 ? "#37d67a" : "#e83a3a";
  ctx.fillRect(24, 54, 180 * (g.hp / 100), 10);
  ctx.fillStyle = "#fff";
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillText("HP " + Math.round(g.hp), 210, 64);
  panel(ctx, canvas.width - 212, 12, 200, 44);
  ctx.font = "bold 26px system-ui, sans-serif";
  ctx.textAlign = "center";
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < g.wanted ? "#ffd23d" : "#444";
    ctx.fillText("★", canvas.width - 182 + i * 34, 44);
  }
  const mission = MISSIONS[g.mission];
  if (mission && g.screen === "playing") {
    ctx.textAlign = "center";
    const tw = Math.min(640, ctx.measureText(mission.text).width + 60);
    panel(ctx, canvas.width / 2 - tw / 2, 12, tw, 64);
    ctx.fillStyle = "#ffd23d";
    ctx.font = "bold 17px system-ui, sans-serif";
    ctx.fillText(mission.title, canvas.width / 2, 36);
    ctx.fillStyle = "#fff";
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText(mission.text, canvas.width / 2, 60);
    if (g.mission === 2 && g.missionProgress > 0 && g.missionProgress < 1) {
      ctx.fillStyle = "#333";
      ctx.fillRect(canvas.width / 2 - 100, 66, 200, 8);
      ctx.fillStyle = "#ffd23d";
      ctx.fillRect(canvas.width / 2 - 100, 66, 200 * g.missionProgress, 8);
    }
    if (g.mission === 3) {
      ctx.fillStyle = "#ff6fb1";
      ctx.font = "bold 20px system-ui, sans-serif";
      ctx.fillText("Sisa waktu: " + Math.ceil(g.missionTimer) + " dtk", canvas.width / 2, 96);
    }
  }
  if (g.messageT > 0) {
    ctx.textAlign = "center";
    ctx.globalAlpha = clamp(g.messageT, 0, 1);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.fillText(g.message, canvas.width / 2, canvas.height - 90);
    ctx.globalAlpha = 1;
  }
  drawMinimap(ctx, canvas, g, city);
  ctx.restore();
}

function drawMinimap(ctx, canvas, g, city) {
  const size = 170;
  const x0 = canvas.width - size - 12;
  const y0 = canvas.height - size - 12;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
  ctx.fillStyle = "#1a2133";
  ctx.fillRect(x0, y0, size, size);
  const k = size / WORLD_SIZE;
  ctx.fillStyle = "#2a3350";
  for (const line of city.roads) {
    ctx.fillRect(x0, y0 + line * k - 2, size, 4);
    ctx.fillRect(x0 + line * k - 2, y0, 4, size);
  }
  const mission = MISSIONS[g.mission];
  if (mission && g.screen === "playing") {
    const spot = mission.target(g);
    ctx.fillStyle = "#ffd23d";
    disc(ctx, x0 + spot.x * k, y0 + spot.y * k, 5);
  }
  for (const car of g.cars) {
    if (car.dead) continue;
    ctx.fillStyle = car.police ? "#2e6bff" : car.gold ? "#ffd23d" : "#8a94ad";
    ctx.fillRect(x0 + car.x * k - 2, y0 + car.y * k - 2, 4, 4);
  }
  ctx.fillStyle = PALETTE.hero;
  disc(ctx, x0 + g.player.x * k, y0 + g.player.y * k, 5);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x0 + g.player.x * k, y0 + g.player.y * k, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawMenu(ctx, canvas) {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#1c0b33");
  grad.addColorStop(0.5, "#4a1250");
  grad.addColorStop(1, "#ff8a2a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffd23d";
  disc(ctx, canvas.width / 2, 350, 110);
  ctx.fillStyle = "#ff6fb1";
  disc(ctx, canvas.width / 2, 350, 85);
  ctx.fillStyle = "#0b0e1a";
  const sky = new SeededRandom(SKYLINE_SEED);
  let x = 0;
  while (x < canvas.width) {
    const w = 40 + sky.next() * 90;
    const h = 80 + sky.next() * 200;
    ctx.fillRect(x, 580 - h, w, h);
    x += w + 6;
  }
  ctx.fillRect(0, 580, canvas.width, canvas.height - 580);
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = "bold 110px system-ui, sans-serif";
  ctx.fillText("VICE BAY", canvas.width / 2, 230);
  ctx.fillStyle = "#ffd23d";
  ctx.font = "bold 28px system-ui, sans-serif";
  ctx.fillText("OPEN-WORLD CRIME • 2D TOP-DOWN", canvas.width / 2, 282);
  const save = loadGame();
  drawMenuButton(ctx, canvas.width / 2 - 180, 640, 360, 58, "▶  MULAI BARU  (Enter)");
  if (save && save.mission > 0) {
    drawMenuButton(ctx, canvas.width / 2 - 180, 710, 360, 58, "↻  LANJUTKAN — Misi " + (save.mission + 1));
  }
  ctx.fillStyle = "#cfd8ec";
  ctx.font = "15px system-ui, sans-serif";
  ctx.fillText("WASD gerak • Shift lari • E masuk/keluar mobil • F / klik tembak • P jeda", canvas.width / 2, 812);
  ctx.fillText("5 misi berantai • wanted 0–5 bintang • polisi, rampok toko, mobil emas • save otomatis", canvas.width / 2, 840);
}

function drawMenuButton(ctx, x, y, w, h, label) {
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#ffd23d";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 22px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x + w / 2, y + 37);
}

function drawPaused(ctx, canvas) {
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 56px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("JEDA", canvas.width / 2, canvas.height / 2 - 20);
  ctx.font = "20px system-ui, sans-serif";
  ctx.fillText("P / Esc buat lanjut main", canvas.width / 2, canvas.height / 2 + 30);
}

function drawBusted(ctx, canvas, g) {
  ctx.fillStyle = "rgba(20,0,0,0.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ff5d5d";
  ctx.font = "bold 72px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("BUSTED!", canvas.width / 2, canvas.height / 2 - 30);
  ctx.fillStyle = "#fff";
  ctx.font = "22px system-ui, sans-serif";
  ctx.fillText(g.bustedReason + "  Denda $100.", canvas.width / 2, canvas.height / 2 + 20);
  ctx.fillText("Klik untuk bangkit di rumah sakit", canvas.width / 2, canvas.height / 2 + 60);
}

function drawWin(ctx, canvas, g) {
  ctx.fillStyle = "rgba(0,20,10,0.72)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffd23d";
  ctx.font = "bold 64px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("KAMU MENANG!", canvas.width / 2, canvas.height / 2 - 60);
  ctx.fillStyle = "#fff";
  ctx.font = "26px system-ui, sans-serif";
  ctx.fillText("Semua 5 misi selesai. Total: $" + g.money.toLocaleString("en-US"), canvas.width / 2, canvas.height / 2);
  ctx.font = "20px system-ui, sans-serif";
  ctx.fillText("Enter / klik = free roam • Muat ulang halaman = main lagi", canvas.width / 2, canvas.height / 2 + 50);
}
