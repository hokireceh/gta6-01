// Smoke test for the Vice Bay entry (npm test):
//   1. runs main.ts twice into two fresh output dirs (exit 0 both times),
//   2. checks the two outputs are byte-identical,
//   3. checks the dossier exists and is under 1.5 MiB,
//   4. counts the output: 20 files (15 game files + 4 screenshots + dossier).
//
//   npm test

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
let failures = 0;

function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

function listFiles(dir, base = dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p, base));
    else out.push(relative(base, p));
  }
  return out.sort();
}

function runBuild(outDir) {
  const r = spawnSync('node', ['main.ts'], {
    cwd: repoRoot,
    env: { ...process.env, MAKEFUN_OUTPUT_DIR: outDir },
    encoding: 'utf8',
  });
  return r;
}

const base = mkdtempSync(join(tmpdir(), 'vicebay-smoke-'));
const outA = join(base, 'a');
const outB = join(base, 'b');
try {
  const ra = runBuild(outA);
  check('build run 1 exits 0', ra.status === 0, ra.status === 0 ? ra.stdout.trim() : ra.stderr.trim());
  const rb = runBuild(outB);
  check('build run 2 exits 0', rb.status === 0, rb.status === 0 ? rb.stdout.trim() : rb.stderr.trim());

  if (ra.status === 0 && rb.status === 0) {
    const filesA = listFiles(outA);
    const filesB = listFiles(outB);
    check('same file list across runs', JSON.stringify(filesA) === JSON.stringify(filesB), `${filesA.length} files`);
    let identical = true;
    for (const f of filesA) {
      const a = readFileSync(join(outA, f));
      const b = readFileSync(join(outB, f));
      if (!a.equals(b)) { identical = false; console.log(`  differs: ${f}`); }
    }
    check('both runs byte-identical', identical);

    const dossier = join(outA, 'dossier.json');
    const dossierBytes = statSync(dossier).size;
    check('dossier.json under 1.5 MiB', dossierBytes < 1.5 * 1024 * 1024, `${dossierBytes} bytes`);
    const gameFiles = listFiles(join(outA, 'game'));
    check('game/ holds 15 files', gameFiles.length === 15, gameFiles.join(', '));
    const shots = listFiles(join(outA, 'screenshots'));
    check('screenshots/ holds 4 images', shots.length === 4, shots.join(', '));
    check('output holds 20 files total', filesA.length === 20, `${filesA.length} files`);
    for (const s of shots) {
      const size = statSync(join(outA, 'screenshots', s)).size;
      check(`screenshot ${s} under 256 KiB`, size < 256 * 1024, `${size} bytes`);
    }
  }
} finally {
  rmSync(base, { recursive: true, force: true });
}

if (failures > 0) {
  console.log(`SMOKE: ${failures} check(s) failed`);
  process.exit(1);
}
console.log('SMOKE: all checks passed');
