// Vice Bay's sky: a day/night clock plus a weather system. Time runs at one
// game hour per real minute. Weather drifts between clear, rain and storm on
// its own schedule; rain makes the roads slick (drive.js reads the grip) and
// storms flash lightning. The renderer asks skyTint() for the overlay colour
// and drawRain() for the falling drops.

import { clamp, makeRng } from './tools.js';

export const WEATHER_CLEAR = 'clear';
export const WEATHER_RAIN = 'rain';
export const WEATHER_STORM = 'storm';

const WEATHER_CYCLE = [WEATHER_CLEAR, WEATHER_CLEAR, WEATHER_RAIN, WEATHER_CLEAR, WEATHER_STORM, WEATHER_RAIN];

/** One game minute passes per real second (60x). */
const MINUTES_PER_SECOND = 1;

export class SkyClock {
  constructor(seed) {
    this.rng = makeRng(seed ^ 0x9e3779b9);
    this.minutes = 17 * 60 + 20; // golden hour start
    this.weather = WEATHER_CLEAR;
    this.weatherTimer = 45; // seconds until the next weather roll
    this.weatherIndex = 0;
    this.drops = [];
    for (let i = 0; i < 160; i++) {
      this.drops.push({ x: this.rng() * 1280, y: this.rng() * 720, speed: 520 + this.rng() * 260 });
    }
    this.flash = 0; // lightning flash, 0..1
    this.flashTimer = 6 + this.rng() * 6;
  }

  /** Advances time and weather by dt seconds. */
  tick(dt) {
    this.minutes += dt * MINUTES_PER_SECOND;
    if (this.minutes >= 1440) this.minutes -= 1440;
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.weatherIndex = (this.weatherIndex + 1) % WEATHER_CYCLE.length;
      this.weather = WEATHER_CYCLE[this.weatherIndex];
      this.weatherTimer = 35 + this.rng() * 50;
    }
    if (this.weather === WEATHER_STORM) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.flash = 1;
        this.flashTimer = 5 + this.rng() * 9;
      }
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.2);
    if (this.weather !== WEATHER_CLEAR) {
      for (const d of this.drops) {
        d.y += d.speed * dt;
        d.x -= d.speed * dt * 0.18;
        if (d.y > 730) { d.y = -10; d.x = this.rng() * 1400; }
        if (d.x < -10) d.x = 1300;
      }
    }
  }

  /** True between 19:30 and 06:00. */
  isNight() {
    return this.minutes >= 1170 || this.minutes < 360;
  }

  /** True in the dusk band, 17:30–19:30. */
  isDusk() {
    return this.minutes >= 1050 && this.minutes < 1170;
  }

  /** Road grip factor: rain and storm make cars slide more. */
  grip() {
    if (this.weather === WEATHER_STORM) return 0.55;
    if (this.weather === WEATHER_RAIN) return 0.75;
    return 1;
  }

  /** The full-screen tint {r, g, b, a} the renderer overlays. */
  skyTint() {
    if (this.isNight()) return { r: 8, g: 14, b: 44, a: 0.42 };
    if (this.isDusk()) return { r: 255, g: 120, b: 50, a: 0.12 };
    if (this.weather === WEATHER_STORM) return { r: 30, g: 34, b: 48, a: 0.22 };
    if (this.weather === WEATHER_RAIN) return { r: 60, g: 70, b: 90, a: 0.1 };
    return { r: 255, g: 240, b: 200, a: 0.05 };
  }

  /** The weather glyph shown in the HUD. */
  glyph() {
    if (this.weather === WEATHER_STORM) return 'STORM';
    if (this.weather === WEATHER_RAIN) return 'RAIN';
    if (this.isNight()) return 'NIGHT';
    if (this.isDusk()) return 'DUSK';
    return 'SUNNY';
  }

  /** Draws falling rain over the screen (screen space, camera ignored). */
  drawRain(ctx, w, h) {
    if (this.weather === WEATHER_CLEAR) return;
    const count = this.weather === WEATHER_STORM ? this.drops.length : 90;
    ctx.save();
    ctx.strokeStyle = this.weather === WEATHER_STORM ? 'rgba(180,200,255,0.55)' : 'rgba(170,190,230,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const d = this.drops[i];
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - 6, d.y + 16);
    }
    ctx.stroke();
    ctx.restore();
    if (this.flash > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(220,230,255,${(this.flash * 0.35).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }
}

/** Forces a weather state (used by screenshot presets). */
export function forceWeather(clock, weather, minutes) {
  clock.weather = weather;
  clock.weatherTimer = 9999;
  if (minutes !== undefined) clock.minutes = minutes;
  clock.flash = 0;
}
