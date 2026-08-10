import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from '../netlify/functions/api.mjs';

const root = fileURLToPath(new URL('../static/', import.meta.url));
const port = Number(process.env.PORT || 8888);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

const baseHeaders = {
  'x-content-type-options': 'nosniff',
  'cache-control': 'no-store',
};

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { ...baseHeaders, ...headers });
  res.end(body);
};

const toWebRequest = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  return new Request(`http://127.0.0.1:${port}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
  });
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname.startsWith('/api/')) {
      const response = await handler(await toWebRequest(req));
      const headers = { ...baseHeaders, ...Object.fromEntries(response.headers.entries()) };
      const body = Buffer.from(await response.arrayBuffer());
      send(res, response.status, body, headers);
      return;
    }

    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/internal') {
      send(res, 302, '', { location: '/internal/' });
      return;
    }
    const customerInfoPages = new Set(['about', 'method', 'plans', 'invite', 'privacy', 'terms', 'contact']);
    const infoPageName = pathname.replace(/^\/+|\/+$/g, '');
    if (pathname === '/' || pathname === '/internal/' || pathname.startsWith('/internal/')) pathname = '/index.html';
    else if (customerInfoPages.has(infoPageName)) pathname = `/${infoPageName}/index.html`;
    const filePath = resolve(root, `.${pathname}`);
    if (!filePath.startsWith(root)) {
      send(res, 403, 'Forbidden');
      return;
    }
    await readFile(filePath);
    res.writeHead(200, { ...baseHeaders, 'content-type': mime[extname(filePath)] || 'application/octet-stream' });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    createReadStream(filePath).pipe(res);
  } catch (error) {
    if (error.code === 'ENOENT') send(res, 404, 'Not found');
    else send(res, 500, error.message || 'Server error');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Local MVP ready: http://127.0.0.1:${port}`);
});
