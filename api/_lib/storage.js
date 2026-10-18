/**
 * BASMA — Persistent storage adapter shared by all serverless functions and the local Node server.
 *
 * Backends (picked automatically):
 *   1. "supabase"      — 100% Free Supabase PostgreSQL REST API (SUPABASE_URL / VITE_SUPABASE_URL + SUPABASE_ANON_KEY).
 *   2. "vercel-kv"     — Vercel KV / Upstash Redis REST (KV_REST_API_URL + KV_REST_API_TOKEN).
 *   3. "local-disk"    — ./data folder when running `node server.js` on your own machine / VPS. Permanent.
 *   4. "ephemeral-tmp" — /tmp on Vercel when no cloud database is connected.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

function backend() {
  if (SUPABASE_URL && SUPABASE_KEY) return 'supabase';
  if (KV_URL && KV_TOKEN) return 'vercel-kv';
  if (process.env.VERCEL) return 'ephemeral-tmp';
  return 'local-disk';
}

function isPersistent() {
  return backend() !== 'ephemeral-tmp';
}

let resolvedDir = null;
function dataDir() {
  if (resolvedDir) return resolvedDir;
  const candidates = [];
  if (process.env.BASMA_DATA_DIR) candidates.push(process.env.BASMA_DATA_DIR);
  if (!process.env.VERCEL) candidates.push(path.join(process.cwd(), 'data'));
  candidates.push(path.join(os.tmpdir(), 'basma-data'));
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      resolvedDir = dir;
      return dir;
    } catch (_) {}
  }
  resolvedDir = os.tmpdir();
  return resolvedDir;
}

function fileFor(key) {
  return path.join(dataDir(), `${String(key).replace(/[^a-z0-9_-]/gi, '_')}.json`);
}

async function kv(command) {
  const resp = await fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command)
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json.error) {
    throw new Error(`KV ${command[0]} failed: ${json.error || resp.status}`);
  }
  return json.result;
}

async function getJSON(key) {
  if (backend() === 'supabase') {
    try {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/site_data?id=eq.${encodeURIComponent(key)}&select=content`, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      });
      if (resp.ok) {
        const rows = await resp.json();
        if (Array.isArray(rows) && rows.length > 0 && rows[0].content) {
          return rows[0].content;
        }
      }
    } catch (_) {}
  }

  if (backend() === 'vercel-kv') {
    const raw = await kv(['GET', key]);
    return raw ? JSON.parse(raw) : null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(fileFor(key), 'utf8'));
    if (parsed && parsed.__exp && Date.now() > parsed.__exp) {
      fs.unlinkSync(fileFor(key));
      return null;
    }
    return parsed && Object.prototype.hasOwnProperty.call(parsed, '__value') ? parsed.__value : parsed;
  } catch (_) {
    return null;
  }
}

async function setJSON(key, value, ttlSeconds) {
  if (backend() === 'supabase') {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/site_data`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: key,
          content: value,
          updated_at: new Date().toISOString()
        })
      });
      return;
    } catch (_) {}
  }

  if (backend() === 'vercel-kv') {
    const cmd = ['SET', key, JSON.stringify(value)];
    if (ttlSeconds) cmd.push('EX', String(Math.ceil(ttlSeconds)));
    await kv(cmd);
    return;
  }

  const wrapped = ttlSeconds ? { __exp: Date.now() + ttlSeconds * 1000, __value: value } : value;
  const target = fileFor(key);
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(wrapped), 'utf8');
  fs.renameSync(tmp, target);
}

async function del(key) {
  if (backend() === 'supabase') {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/site_data?id=eq.${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      });
      return;
    } catch (_) {}
  }

  if (backend() === 'vercel-kv') {
    await kv(['DEL', key]);
    return;
  }

  try {
    fs.unlinkSync(fileFor(key));
  } catch (_) {}
}

module.exports = {
  backend,
  isPersistent,
  getJSON,
  setJSON,
  del
};
