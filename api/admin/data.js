/**
 * BASMA (@basma.llb) — /api/admin/data
 * Handles GET (fetch full store configuration) and POST (update catalog, prices, and website copy).
 */

const storeStateHandler = require('../store-state.js');

module.exports = async function handler(req, res) {
  return storeStateHandler(req, res);
};
