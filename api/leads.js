/**
 * BASMA (@basma.llb) — /api/leads
 * Manages customer order inquiries and custom commission quote tickets.
 * Supported operations:
 *   - POST: Logs a new order inquiry or custom quote
 *   - GET: Retrieves the list of inquiries (sorted newest first)
 *   - PUT / PATCH: Updates status badge ('New Lead' | 'Contacted' | 'In Production' | 'Delivered')
 *   - DELETE: Deletes an inquiry by id
 */

const storage = require('./_lib/storage');
const { send, readJsonBody, getQuery } = require('./_lib/http');

const LEADS_KEY = 'basma:leads_log';

async function getLeadsList() {
  const list = await storage.getJSON(LEADS_KEY);
  return Array.isArray(list) ? list : [];
}

async function saveLeadsList(list) {
  // Cap at 200 most recent leads
  const capped = list.slice(0, 200);
  await storage.setJSON(LEADS_KEY, capped);
  return capped;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Basma-Admin');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  // 1. GET: Return list of leads
  if (req.method === 'GET') {
    const list = await getLeadsList();
    return send(res, 200, {
      ok: true,
      count: list.length,
      leads: list
    });
  }

  // 2. POST: Add new lead / order ticket
  if (req.method === 'POST') {
    try {
      const body = await readJsonBody(req, 128 * 1024);
      const lead = {
        id: 'lead-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        createdAt: new Date().toISOString(),
        customerName: String(body.customerName || body.name || 'Anonymous Visitor').slice(0, 80),
        phone: String(body.phone || body.whatsapp || '').slice(0, 40),
        address: String(body.address || '').slice(0, 150),
        notes: String(body.notes || '').slice(0, 250),
        type: body.type || (body.isCustom ? 'Custom Commission' : 'Catalog Order'),
        items: Array.isArray(body.items) ? body.items : (body.cart || []),
        customImage: body.customImage || '',
        totalUSD: Number(body.totalUSD || body.totalPrice || 0),
        formattedPrice: body.formattedPrice || `$${Number(body.totalUSD || 0)}`,
        status: 'New Lead' // Options: 'New Lead', 'Contacted', 'In Production', 'Delivered'
      };

      const current = await getLeadsList();
      current.unshift(lead);
      await saveLeadsList(current);

      return send(res, 201, {
        ok: true,
        leadId: lead.id,
        message: 'Order lead recorded successfully'
      });
    } catch (err) {
      return send(res, 400, { ok: false, error: err.message || 'Malformed inquiry data' });
    }
  }

  // 3. PUT / PATCH: Update lead status
  if (req.method === 'PUT' || req.method === 'PATCH') {
    try {
      const body = await readJsonBody(req, 64 * 1024);
      const leadId = body.id || body.leadId;
      const newStatus = body.status;

      if (!leadId) {
        return send(res, 400, { ok: false, error: 'Missing lead ID' });
      }

      const list = await getLeadsList();
      const target = list.find(l => l.id === leadId);
      if (!target) {
        return send(res, 404, { ok: false, error: 'Lead not found' });
      }

      if (newStatus) target.status = newStatus;
      if (body.adminNotes !== undefined) target.adminNotes = body.adminNotes;
      target.updatedAt = new Date().toISOString();

      await saveLeadsList(list);
      return send(res, 200, { ok: true, lead: target });
    } catch (err) {
      return send(res, 400, { ok: false, error: err.message });
    }
  }

  // 4. DELETE: Delete a lead
  if (req.method === 'DELETE') {
    try {
      const query = getQuery(req);
      const leadId = query.id;
      if (!leadId) {
        return send(res, 400, { ok: false, error: 'Missing lead id query param' });
      }
      let list = await getLeadsList();
      const initialLen = list.length;
      list = list.filter(l => l.id !== leadId);
      if (list.length === initialLen) {
        return send(res, 404, { ok: false, error: 'Lead not found' });
      }
      await saveLeadsList(list);
      return send(res, 200, { ok: true, message: 'Lead deleted' });
    } catch (err) {
      return send(res, 500, { ok: false, error: err.message });
    }
  }

  return send(res, 405, { ok: false, error: 'Method not allowed' });
};
