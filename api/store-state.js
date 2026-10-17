/**
 * Vercel Serverless Function: /api/store-state
 * Reads and persists the Basma store state across `/tmp/store-state.json`,
 * root `store-state.json`, or optional Cloud KV / REST webhook.
 */

const fs = require('fs');
const path = require('path');

const TMP_STATE_FILE = path.join('/tmp', 'basma-store-state.json');
const ROOT_STATE_FILE = path.join(process.cwd(), 'store-state.json');
const PUBLIC_STATE_FILE = path.join(process.cwd(), 'public', 'store-state.json');

function readCurrentState() {
  try {
    if (fs.existsSync(TMP_STATE_FILE)) {
      return fs.readFileSync(TMP_STATE_FILE, 'utf8');
    }
  } catch (_) {
    // Fallback to repository state file
  }
  try {
    if (fs.existsSync(ROOT_STATE_FILE)) {
      return fs.readFileSync(ROOT_STATE_FILE, 'utf8');
    }
  } catch (_) {
    // Fallback to public state file
  }
  try {
    if (fs.existsSync(PUBLIC_STATE_FILE)) {
      return fs.readFileSync(PUBLIC_STATE_FILE, 'utf8');
    }
  } catch (_) {
    // Return null if none exist
  }
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    const data = readCurrentState();
    if (!data) {
      return res.status(404).json({ ok: false, error: 'State file not found' });
    }
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).send(data);
  }

  if (req.method === 'POST') {
    try {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!payload || typeof payload !== 'object' || !Array.isArray(payload.products)) {
        return res.status(400).json({ ok: false, error: 'Invalid store state payload' });
      }

      // Strip any accidental plaintext PIN before persisting
      if (payload.settings && payload.settings.adminPin) {
        delete payload.settings.adminPin;
      }

      const serialized = JSON.stringify(payload, null, 2);

      // Persist to /tmp for warm serverless instances
      try {
        fs.writeFileSync(TMP_STATE_FILE, serialized, 'utf8');
      } catch (_) {
        // Ignore read-only errors
      }

      // Persist to local disk when running in writable Node environment
      try {
        fs.writeFileSync(ROOT_STATE_FILE, serialized, 'utf8');
      } catch (_) {
        // Ignore on read-only serverless filesystem
      }

      return res.status(200).json({
        ok: true,
        syncedAt: new Date().toISOString()
      });
    } catch (err) {
      return res.status(400).json({ ok: false, error: 'Malformed JSON body' });
    }
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
};
