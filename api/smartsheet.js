// api/smartsheet.js — Smartsheet data proxy (Vercel Serverless, Node 18+)
// Token is server-side via SMARTSHEET_TOKEN env var — never exposed to clients.
'use strict';
const { cors, requireAuth } = require('../lib');

const SS_BASE = 'https://api.smartsheet.com/2.0';

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Use POST.' });

  // Require valid session JWT
  const session = requireAuth(req, res);
  if (!session) return;

  const token = process.env.SMARTSHEET_TOKEN;
  if (!token) return res.status(503).json({ error: 'SMARTSHEET_TOKEN env var not configured on server.' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Invalid JSON body' }); }
  }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Missing request body' });

  const { sheetId, rowId, action, include, attachmentId } = body;

  // attachment-url only needs attachmentId, not sheetId
  if (!sheetId && action !== 'attachment-url') return res.status(400).json({ error: 'sheetId is required.' });

  const ssHeaders = {
    Authorization: `Bearer ${token}`,
    Accept:        'application/json',
  };

  try {
    // ── Row attachments list ──────────────────────────────────
    if (action === 'attachments' && rowId) {
      console.log(`[smartsheet] attachments: sheet=${sheetId} row=${rowId}`);
      const r = await fetch(`${SS_BASE}/sheets/${sheetId}/rows/${rowId}/attachments`, { headers: ssHeaders });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data.message || 'Smartsheet error', errorCode: data.errorCode });
      return res.json(data);
    }

    // ── Single attachment URL ─────────────────────────────────
    if (action === 'attachment-url' && attachmentId) {
      const r = await fetch(`${SS_BASE}/attachments/${attachmentId}`, { headers: ssHeaders });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data.message || 'Smartsheet error' });
      return res.json(data);
    }

    // ── Sheet fetch ───────────────────────────────────────────
    const params  = new URLSearchParams();
    const inc     = include || 'attachments'; // always request attachment metadata
    if (inc) params.set('include', inc);

    const url = `${SS_BASE}/sheets/${String(sheetId).trim()}?${params}`;
    console.log(`[smartsheet] sheet fetch: ${url} (user=${session.name}, role=${session.role})`);

    const upstream = await fetch(url, { headers: ssHeaders });
    const text     = await upstream.text();

    let data;
    try { data = JSON.parse(text); }
    catch (e) { return res.status(502).json({ error: 'Smartsheet returned non-JSON', status: upstream.status, body: text.slice(0, 400) }); }

    if (!upstream.ok) {
      console.error('[smartsheet] upstream error:', data);
      return res.status(upstream.status).json({ error: data.message || 'Smartsheet API error', errorCode: data.errorCode });
    }

    console.log(`[smartsheet] success: ${data.name}, rows=${data.rows?.length ?? 'N/A'}`);
    return res.status(200).json(data);

  } catch (err) {
    console.error('[smartsheet] fetch threw:', err.message);
    return res.status(500).json({ error: 'Proxy fetch failed', detail: err.message });
  }
};
