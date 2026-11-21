// VICE BAY — local dev server: serves game/ and screenshots/ on :8080.
// Node 22, standard library only. Usage: node serve.ts [port]
// (or PORT=8080 node serve.ts). /health answers 200 {"ok":true}.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || process.argv[2] || 8080);
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"ok":true}');
    return;
  }
  let rel = url.pathname.replace(/^\//, '');
  if (rel === '') rel = 'game/index.html';
  else if (!rel.startsWith('screenshots/')) rel = `game/${rel}`;
  if (rel.includes('..')) {
    res.writeHead(400);
    res.end('bad path');
    return;
  }
  try {
    const data = await readFile(join(here, rel));
    res.writeHead(200, { 'content-type': types[extname(rel)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}).listen(port, () => console.log(`VICE BAY dev server on http://localhost:${port}`));
