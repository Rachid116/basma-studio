/**
 * BASMA (@basma.llb) — Production & Live Admin Auto-Sync Server
 * Serves production build (`dist/`) or root static assets, enforces security headers,
 * renders branded 404 page, and exposes `/api/store-state` + `/api/admin-auth`.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8080;
const ROOT_DIR = __dirname;
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const STATE_FILE = path.join(ROOT_DIR, 'store-state.json');
const DEFAULT_PIN_HASH = 'a688c2c38f05246f763409b4520c0aa3ecc3ba304c92af58665f5c636120296d';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function applySecurityHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

const server = http.createServer((req, res) => {
  applySecurityHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // 1. Admin PIN Hash Verification Endpoint: POST /api/admin-auth
  if (pathname === '/api/admin-auth' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 32 * 1024) req.destroy();
    });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const candidateHash = String(parsed.pinHash || '').trim().toLowerCase();
        let expectedHash = String(process.env.VITE_ADMIN_PIN_HASH || DEFAULT_PIN_HASH).trim().toLowerCase();
        try {
          const stateRaw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
          if (stateRaw?.settings?.adminPinHash) {
            expectedHash = String(stateRaw.settings.adminPinHash).trim().toLowerCase();
          }
        } catch (_) {
          // Use default hash
        }
        const a = Buffer.from(candidateHash, 'utf8');
        const b = Buffer.from(expectedHash, 'utf8');
        const ok = a.length === 64 && a.length === b.length && crypto.timingSafeEqual(a, b);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok }));
      } catch (_) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false }));
      }
    });
    return;
  }

  // 2. Live Admin CMS Sync Endpoint: GET or POST /api/store-state
  if (pathname === '/api/store-state') {
    if (req.method === 'GET') {
      fs.readFile(STATE_FILE, 'utf8', (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'State file not found' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(data);
      });
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 15 * 1024 * 1024) req.destroy();
      });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.settings && parsed.settings.adminPin) {
            delete parsed.settings.adminPin;
          }
          const serialized = JSON.stringify(parsed, null, 2);
          fs.writeFile(STATE_FILE, serialized, 'utf8', (err) => {
            if (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: err.message }));
              return;
            }
            // Mirror to dist/store-state.json if dist exists
            const distState = path.join(DIST_DIR, 'store-state.json');
            if (fs.existsSync(DIST_DIR)) {
              fs.writeFile(distState, serialized, 'utf8', () => {});
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, syncedAt: new Date().toISOString() }));
          });
        } catch (_) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Invalid JSON payload' }));
        }
      });
      return;
    }
  }

  // 3. Serve Static Files (Prefer compiled `dist/` when built, fallback to `public/` and `ROOT_DIR`)
  let safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  if (safePath === '/' || safePath === '\\') safePath = '/index.html';

  const candidatePaths = [
    path.join(DIST_DIR, safePath),
    path.join(ROOT_DIR, 'public', safePath),
    path.join(ROOT_DIR, safePath)
  ];

  const resolvedFile = candidatePaths.find(p => {
    try {
      return fs.existsSync(p) && fs.statSync(p).isFile();
    } catch (_) {
      return false;
    }
  });

  if (!resolvedFile) {
    const custom404 = path.join(ROOT_DIR, '404.html');
    if (fs.existsSync(custom404)) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(custom404).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    }
    return;
  }

  const ext = path.extname(resolvedFile).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': ext === '.json' || ext === '.html' ? 'no-cache' : 'public, max-age=3600'
  });
  fs.createReadStream(resolvedFile).pipe(res);
});

server.listen(PORT, () => {
  process.stdout.write(`Basma Studio Server listening on http://localhost:${PORT}\n`);
});
