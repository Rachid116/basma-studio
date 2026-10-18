/**
 * BASMA (@basma.llb) — /api/admin/auth
 * Handles secure hashed PIN authentication, session verification, rate limiting, and logout.
 */

const authHandler = require('../admin-auth.js');

module.exports = async function handler(req, res) {
  return authHandler(req, res);
};
