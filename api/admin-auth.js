/**
 * Vercel Serverless Function: /api/admin-auth
 * Verifies SHA-256 hashed Admin PIN against environment or stored hash without exposing plaintext PINs.
 */

const crypto = require('crypto');

const DEFAULT_PIN_HASH = 'a688c2c38f05246f763409b4520c0aa3ecc3ba304c92af58665f5c636120296d';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const candidateHash = String(body.pinHash || '').trim().toLowerCase();
    const expectedHash = String(process.env.VITE_ADMIN_PIN_HASH || DEFAULT_PIN_HASH).trim().toLowerCase();

    if (!candidateHash || candidateHash.length !== 64) {
      return res.status(400).json({ ok: false, error: 'Invalid hash format' });
    }

    const a = Buffer.from(candidateHash, 'utf8');
    const b = Buffer.from(expectedHash, 'utf8');
    const match = a.length === b.length && crypto.timingSafeEqual(a, b);

    return res.status(200).json({ ok: match });
  } catch (_) {
    return res.status(400).json({ ok: false, error: 'Bad request' });
  }
};
