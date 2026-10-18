/**
 * BASMA — Persistent storage adapter shared by all serverless functions and the local Node server.
 *
 * Backends (picked automatically):
 *   1. "vercel-kv"     — Vercel KV / Upstash Redis REST (KV_REST_API_URL + KV_REST_API_TOKEN). Permanent, shared by all users.
 *   2. "local-disk"    — ./data folder when running `node server.js` on your own machine / VPS. Permanent.
 *   3. "ephemeral-tmp" — /tmp on Vercel when KV is NOT connected. Survives only while a function instance is warm.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

function backend() {
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
    } catch (_) {
      // try next candidate
    }
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
  if (backend() === 'vercel-kv') {
    await kv(['DEL', key]);
    return;
  }
  try { fs.unlinkSync(fileFor(key)); } catch (_) { /* already gone */ }
}

module.exports = { backend, isPersistent, getJSON, setJSON, del, dataDir };
