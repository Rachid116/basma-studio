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

  // 1. Admin PIN Auth Endpoints: /api/admin/auth & /api/admin-auth
  if (pathname === '/api/admin/auth' || pathname === '/api/admin-auth') {
    return require('./api/admin-auth.js')(req, res);
  }

  // 2. Live Admin Store State Sync Endpoints: /api/admin/data & /api/store-state
  if (pathname === '/api/admin/data' || pathname === '/api/store-state' || pathname === '/api/admin/save') {
    return require('./api/store-state.js')(req, res);
  }

  // 3. Customer Orders & Inquiries Endpoints: /api/orders & /api/leads
  if (pathname === '/api/orders' || pathname === '/api/leads') {
    return require('./api/leads.js')(req, res);
  }

  // 4. File / Image Upload Endpoint: /api/upload
  if (pathname === '/api/upload') {
    return require('./api/upload.js')(req, res);
  }

  // 4. Serve Static Files (Prefer compiled `dist/` when built, fallback to `public/` and `ROOT_DIR`)
  let safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  if (safePath === '/' || safePath === '\\') safePath = '/index.html';
  if (safePath === '/admin' || safePath === '/admin/' || safePath === '\\admin' || safePath === '\\admin\\') {
    safePath = '/admin.html';
  }

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
