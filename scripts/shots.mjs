// Takes the 4 screenshots listed in shots.json with headless Chromium and
// writes them to screenshots/ as JPEGs (long side 1280, each under 256 KiB).
// The game is served from game/ on an ephemeral port; each shot loads its
// ?shot= preset, settles for ~2 seconds, then shoots.
//
//   node scripts/shots.mjs
//
// Chromium comes from the Playwright browser cache (no download): the
// playwright-core package drives the cached binary via executablePath.

import { chromium } from 'playwright-core';
import { readdirSync, statSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from './serve.mjs';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const gameRoot = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

/** Finds a Chromium binary in the Playwright cache. */
function findChromium() {
  const cache = join(homedir(), '.cache', 'ms-playwright');
  const entries = readdirSync(cache);
  const full = entries.find((e) => e.startsWith('chromium-') && !e.includes('headless'));
  if (full) {
    const p = join(cache, full, 'chrome-linux', 'chrome');
    if (statSync(p, { throwIfNoEntry: false })) return p;
  }
  const shell = entries.find((e) => e.startsWith('chromium_headless_shell-'));
  if (shell) {
    const p = join(cache, shell, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
    if (statSync(p, { throwIfNoEntry: false })) return p;
  }
  throw new Error('no Chromium found in ~/.cache/ms-playwright');
}

const shots = JSON.parse(await readFile(join(repoRoot, 'shots.json'), 'utf8'));
const executablePath = findChromium();
const { server, port } = await startStaticServer(gameRoot, 0);
console.log(`vice-bay: serving game/ on :${port}, chromium ${executablePath}`);

const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
try {
  for (const shot of shots) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`http://127.0.0.1:${port}/index.html${shot.query}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__VICEBAY__ !== undefined, null, { timeout: 15000 });
    await page.waitForTimeout(2000); // let rain, traffic and the chase settle
    const out = join(shotsDir, shot.name);
    let quality = 82;
    let buf = await page.screenshot({ path: out, type: 'jpeg', quality });
    while (buf.length > 256 * 1024 && quality > 55) {
      quality -= 8;
      buf = await page.screenshot({ path: out, type: 'jpeg', quality });
    }
    if (errors.length > 0) console.log(`  ${shot.name}: WARNING page errors: ${errors.join(' | ')}`);
    console.log(`  ${shot.name}: ${buf.length} bytes (quality ${quality})`);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log('vice-bay: screenshots done');
