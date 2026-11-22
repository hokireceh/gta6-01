// Vice Bay — smoke test for the entrypoint.
// Builds twice into two scratch directories and checks that:
//   1. both builds exit 0,
//   2. both builds write byte-identical outputs,
//   3. dossier.json exists and parses,
//   4. screenshots/ holds 3-4 JPEG/PNG files within the size cap.
// Usage: node scripts/smoke.mjs   (run from the repository root)

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const outA = join(root, '.smoke-a');
const outB = join(root, '.smoke-b');

function build(outDir) {
  const r = spawnSync('node', ['main.ts'], {
    cwd: root,
    env: { ...process.env, MAKEFUN_OUTPUT_DIR: outDir },
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    console.error(`build into ${outDir} failed (exit ${r.status}):\n${r.stdout}\n${r.stderr}`);
    process.exit(1);
  }
  return r.stdout.trim();
}

function listFiles(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name);
    if (name.isDirectory()) out.push(...listFiles(full, base));
    else out.push(full.slice(base.length + 1));
  }
  return out.sort();
}

rmSync(outA, { recursive: true, force: true });
rmSync(outB, { recursive: true, force: true });
console.log(build(outA));
console.log(build(outB));

const filesA = listFiles(outA);
const filesB = listFiles(outB);
if (JSON.stringify(filesA) !== JSON.stringify(filesB)) {
  console.error('SMOKE FAIL: file lists differ between runs');
  process.exit(1);
}
let mismatch = null;
for (const f of filesA) {
  const a = readFileSync(join(outA, f));
  const b = readFileSync(join(outB, f));
  if (!a.equals(b)) { mismatch = f; break; }
}
if (mismatch) {
  console.error(`SMOKE FAIL: ${mismatch} differs between runs`);
  process.exit(1);
}

const dossier = JSON.parse(readFileSync(join(outA, 'dossier.json'), 'utf8'));
if (dossier.schema !== 'makefun/dossier/v1') {
  console.error('SMOKE FAIL: dossier schema is not makefun/dossier/v1');
  process.exit(1);
}
const shots = readdirSync(join(outA, 'screenshots')).filter((n) => !n.startsWith('.'));
if (shots.length < 3 || shots.length > 4) {
  console.error(`SMOKE FAIL: ${shots.length} screenshots (need 3-4)`);
  process.exit(1);
}
for (const s of shots) {
  const st = statSync(join(outA, 'screenshots', s));
  if (st.size > 262144) {
    console.error(`SMOKE FAIL: screenshot ${s} is ${st.size} bytes (cap 262144)`);
    process.exit(1);
  }
}
if (!existsSync(join(outA, 'game', 'index.html'))) {
  console.error('SMOKE FAIL: game/index.html missing from output');
  process.exit(1);
}
rmSync(outA, { recursive: true, force: true });
rmSync(outB, { recursive: true, force: true });
console.log(`SMOKE PASS: ${filesA.length} files, dossier ok, ${shots.length} screenshots (${shots.join(', ')})`);
