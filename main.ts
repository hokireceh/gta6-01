// Vice Bay — the entry program (Node 22, standard library only).
//
// It hands the game in: it copies this repository's game/ and screenshots/
// into the output directory and writes /output/dossier.json with the vendored
// make.fun library. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for
// /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The output directory itself is never removed: on the grader /output is a
// mount owned by root, and removing it fails with EPERM. Only the entries
// inside it (game/, screenshots/, dossier.json) are cleared, then rebuilt.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

/** The gate's caps (reference/gate.json): what buildDossier is held to. */
export const DOSSIER_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

/** The entries of the output directory this program owns and rebuilds. */
const OWNED_ENTRIES = ['game', 'screenshots', 'dossier.json'];

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Removes only the entries this program owns, never the directory itself. */
function clearOwnedEntries(dir) {
  for (const name of OWNED_ENTRIES) {
    const target = join(dir, name);
    if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  }
}

/** Counts the files under a directory, recursively. */
function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    n += entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1;
  }
  return n;
}

/** Refuses early with a clear message when the entry is incomplete. */
function guardEntry(repo) {
  const index = join(repo, 'game', 'index.html');
  if (!existsSync(index)) throw new Error('vice-bay: game/index.html is missing — the game cannot be handed in');
  const shots = join(repo, 'screenshots');
  if (!existsSync(shots) || readdirSync(shots).length === 0) {
    throw new Error('vice-bay: screenshots/ holds no image — run `npm run shots` first');
  }
}

mkdirSync(outDir, { recursive: true });
clearOwnedEntries(outDir);
guardEntry(repoRoot);

cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

const dossier = buildDossier(outDir, DOSSIER_LIMITS);
if (dossier.length >= 1.5 * 1024 * 1024) {
  throw new Error(`vice-bay: dossier is ${dossier.length} bytes, over the 1.5 MiB cap`);
}
writeFileSync(join(outDir, 'dossier.json'), dossier);
const gameCount = countFiles(join(outDir, 'game'));
const shotCount = countFiles(join(outDir, 'screenshots'));
console.log(
  `vice-bay: ${gameCount} game files + ${shotCount} screenshots, dossier ${dossier.length} bytes written to ${outDir}`,
);
