// Serves game/ as static files for local play:
//   node scripts/serve.mjs            (http://localhost:8080)
//   PORT=9000 node scripts/serve.mjs
// Also importable: startStaticServer(root, port) returns the server, so the
// screenshot script can serve the same files on an ephemeral port.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

/** Starts a static server for dir; resolves with {server, port} once listening. */
export function startStaticServer(root, port = 0) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let path = decodeURIComponent(url.pathname);
      if (path === '/') path = '/index.html';
      if (path.includes('..')) {
        res.writeHead(400);
        res.end('bad path');
        return;
      }
      const data = await readFile(join(root, path));
      res.writeHead(200, { 'content-type': MIME[extname(path)] || 'application/octet-stream' });
      res.end(data);
    } catch (e) {
      res.writeHead(404);
      res.end('not found');
    }
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

const isMain = process.argv[1] && process.argv[1].endsWith('serve.mjs');
if (isMain) {
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'game');
  const port = parseInt(process.env.PORT || '8080', 10);
  const { port: actual } = await startStaticServer(root, port);
  console.log(`vice-bay: serving ${root} at http://localhost:${actual}`);
}
