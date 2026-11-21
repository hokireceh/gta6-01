// VICE BAY — entrypoint (node22: main.ts).
// A tiny dependency-free static server that serves the game offline.
// Run:  node main.ts            (serves http://localhost:8080)
//       PORT=3000 node main.ts  (custom port)

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function parsePort(argv: string[]): number {
  const fromEnv = Number(process.env.PORT);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  const flag = argv.indexOf('--port');
  if (flag >= 0) {
    const n = Number(argv[flag + 1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 8080;
}

const PORT = parsePort(process.argv.slice(2));

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, game: 'vice-bay', version: '1.0.0' }));
      return;
    }
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    const safe = normalize(join(ROOT, rel)).replace(/\\/g, '/');
    const rootNorm = ROOT.replace(/\\/g, '/');
    if (!safe.startsWith(rootNorm) || !existsSync(safe)) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = extname(safe).toLowerCase();
    res.writeHead(200, {
      'content-type': MIME[ext] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    createReadStream(safe).pipe(res);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('Server error');
  }
});

server.listen(PORT, () => {
  console.log(`VICE BAY running at http://localhost:${PORT}`);
  console.log('Open it in your desktop browser. Press Ctrl+C to stop.');
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

// Keep the module importable without side effects in tests.
export { parsePort };
