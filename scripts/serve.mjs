// Production-only static origin for the optional Cloudflare tunnel. No dev API.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.geojson':'application/geo+json', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon' };
createServer(async (request,response) => {
  response.setHeader('X-Content-Type-Options','nosniff');
  if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname.includes('\0') || pathname.includes('\\')) throw new Error('Invalid path');
    let file = path.resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) throw new Error('Outside build');
    if (pathname === '/') file = path.join(root,'index.html');
    try { if (!(await stat(file)).isFile()) throw new Error('Not a file'); }
    catch { if (path.extname(pathname)) { response.writeHead(404); response.end('Not found'); return; } file = path.join(root,'index.html'); }
    const data = await readFile(file);
    response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    response.setHeader('Cache-Control', file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
    response.writeHead(200); response.end(request.method === 'HEAD' ? undefined : data);
  } catch { response.writeHead(400); response.end('Invalid request'); }
}).listen(4180,'127.0.0.1',() => console.log('Production build served at http://127.0.0.1:4180'));
