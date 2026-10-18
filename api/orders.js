/**
 * BASMA (@basma.llb) — /api/orders
 * Logs incoming order inquiries and custom quote tickets.
 */

const leadsHandler = require('./leads.js');

module.exports = async function handler(req, res) {
  return leadsHandler(req, res);
};
