// VICE BAY — entrypoint. One file, two jobs, picked by environment:
//
//   MAKEFUN_OUTPUT_DIR=<dir> node main.ts   -> build once into <dir>, exit 0
//   node main.ts                            -> serve game/ on http://localhost:<PORT>
//
// The build path is what the grader runs: it must finish fast, touch no
// network, and write byte-identical output on every run. It copies game/ and
// screenshots/ into the output folder first, then asks the vendored
// make.fun library to summarise exactly those copied files into
// dossier.json — the dossier is written out verbatim, never re-serialised,
// so the gate's rebuild of it matches byte for byte.

import { createServer } from "node:http";
import { readFile, stat, copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const here = dirname(fileURLToPath(import.meta.url));
const gameRoot = join(here, "game");
const outputDir = process.env.MAKEFUN_OUTPUT_DIR;

const DOSSIER_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// Copy a whole directory tree, file by file, so every byte lands unchanged.
async function copyTree(from, to) {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const src = join(from, entry.name);
    const dst = join(to, entry.name);
    if (entry.isDirectory()) {
      await copyTree(src, dst);
    } else if (entry.isFile()) {
      await copyFile(src, dst);
    }
  }
}

async function buildOnce(out) {
  await mkdir(out, { recursive: true });
  await copyTree(gameRoot, join(out, "game"));

  const shotsSrc = join(here, "screenshots");
  const shotsDst = join(out, "screenshots");
  await mkdir(shotsDst, { recursive: true });
  if (existsSync(shotsSrc)) {
    await copyTree(shotsSrc, shotsDst);
  }

  // Root files the dossier and the player both expect beside game/.
  for (const name of ["README.md", "LICENSE", "shots.json", "package.json"]) {
    const src = join(here, name);
    if (existsSync(src)) {
      await copyFile(src, join(out, name));
    }
  }

  // The dossier is built from the OUTPUT folder, after the copies above,
  // so it describes the screenshots and sources exactly as handed in.
  // Write the returned bytes verbatim — never re-serialise them — or the
  // gate's rebuild will not match.
  const dossierBytes = buildDossier(out, DOSSIER_LIMITS);
  await writeFile(join(out, "dossier.json"), dossierBytes);
  console.log(`VICE BAY built into ${out} (dossier.json ${dossierBytes.length} bytes)`);
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function serveGame() {
  const port = Number(process.env.PORT ?? 4173) || 4173;
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      response.writeHead(400).end("Bad request");
      return;
    }

    if (pathname === "/health") {
      const body = JSON.stringify({ ok: true, name: "VICE BAY" });
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(body);
      return;
    }

    if (pathname === "/") pathname = "/index.html";
    // Resolve inside game/ and refuse anything that climbs out of it.
    const file = join(gameRoot, pathname);
    if (file !== gameRoot && !file.startsWith(gameRoot + "/")) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    let info;
    try {
      info = await stat(file);
      if (!info.isFile()) throw new Error("not a file");
    } catch {
      response.writeHead(404).end("Not found");
      return;
    }
    const type = MIME_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
    const body = await readFile(file);
    response.writeHead(200, { "content-type": type, "content-length": body.length });
    response.end(body);
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`VICE BAY on http://localhost:${port} (health: http://localhost:${port}/health)`);
  });
}

if (outputDir) {
  try {
    await buildOnce(outputDir);
    process.exit(0);
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
} else {
  serveGame();
}
