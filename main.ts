// VICE BAY — entry point (rewritten for round 4, modular game tree).
//
// Two modes, chosen by the environment:
//   * MAKEFUN_OUTPUT_DIR is set  -> build the game once into that folder
//     (game/ + dossier.json) and exit 0 right away — the grader needs the
//     process to finish within 10 seconds.
//   * otherwise                   -> serve the game over HTTP on $PORT.
//
// The build only writes files. It never touches the network.

import { createServer } from "node:http";
import { readFile, stat, copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT || 4173);
const ROOT = dirname(fileURLToPath(import.meta.url));
const GAME_DIR = join(ROOT, "game");

const MIME = {
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

async function copyTree(from, to, manifest, rel = "") {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const src = join(from, entry.name);
    const dst = join(to, entry.name);
    const relPath = rel ? rel + "/" + entry.name : entry.name;
    if (entry.isDirectory()) {
      await copyTree(src, dst, manifest, relPath);
    } else {
      await copyFile(src, dst);
      manifest.push({ path: "game/" + relPath, bytes: (await stat(src)).size });
    }
  }
}

async function buildOutput(outDir) {
  const manifest = [];
  await mkdir(outDir, { recursive: true });
  await copyTree(GAME_DIR, join(outDir, "game"), manifest);
  for (const name of ["README.md", "LICENSE", "shots.json", "package.json"]) {
    const src = join(ROOT, name);
    if (!existsSync(src)) continue;
    await copyFile(src, join(outDir, name));
    manifest.push({ path: name, bytes: (await stat(src)).size });
  }
  const dossier = {
    name: "VICE BAY",
    competition: "gta6-01",
    version: "1.1.0",
    entrypoint: "game/index.html",
    genre: "2D top-down open-world crime",
    features: [
      "walking and sprinting",
      "enter, exit and drive cars",
      "traffic and pedestrians",
      "carjacking with wanted level",
      "police chase, gunfire and BUSTED",
      "pistol combat and exploding cars",
      "health and cash pickups",
      "five chained missions to WIN plus free roam",
      "HUD, minimap and mission arrow",
      "pause and save/continue via localStorage",
    ],
    files: manifest,
  };
  await writeFile(join(outDir, "dossier.json"), JSON.stringify(dossier, null, 2) + "\n");
  console.log("VICE BAY built into " + outDir + " (" + manifest.length + " files)");
}

function serve() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://localhost");
      if (url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, game: "VICE BAY" }));
        return;
      }
      const rel = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, "");
      const file = join(GAME_DIR, decodeURIComponent(rel));
      if (!file.startsWith(GAME_DIR)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      const info = await stat(file);
      if (!info.isFile()) throw new Error("not a file");
      const body = await readFile(file);
      res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  server.listen(PORT, () => {
    console.log("VICE BAY serving game/ at http://localhost:" + PORT + " (health: /health)");
  });
}

async function main() {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR;
  if (outDir) {
    try {
      await buildOutput(outDir);
      process.exit(0);
    } catch (err) {
      console.error("build failed:", err);
      process.exit(1);
    }
  }
  serve();
}

main();
