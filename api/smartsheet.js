// api/smartsheet.js — Smartsheet data proxy (Vercel Serverless, Node 18+)
'use strict';
const { cors, requireAuth } = require('../lib');

const SS_BASE = 'https://api.smartsheet.com/2.0';

// Smartsheet IDs are 64-bit integers. JS JSON.parse rounds numbers > MAX_SAFE_INT.
// Quote any bare integer ≥ 16 digits before parsing to preserve precision.
function safeParse(text) {
  return JSON.parse(text.replace(/:\s*(\d{16,})/g, ':"$1"'));
}

async function ssGet(path, headers) {
  const r    = await fetch(`${SS_BASE}${path}`, { headers });
  const text = await r.text();
  let data;
  try { data = safeParse(text); } catch (_) { data = { message: text.slice(0, 200) }; }
  return { ok: r.ok, status: r.status, data };
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Use POST.' });

  const session = requireAuth(req, res);
  if (!session) return;

  const token = process.env.SMARTSHEET_TOKEN;
  if (!token) return res.status(503).json({ error: 'SMARTSHEET_TOKEN not configured.' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Invalid JSON body' }); }
  }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Missing request body' });

  const { sheetId, rowId, action, include, attachmentId } = body;
  if (!sheetId && action !== 'attachment-url') return res.status(400).json({ error: 'sheetId is required.' });

  const h = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  try {
    // ── Row attachment list + server-side URL enrichment ──────────────────
    if (action === 'attachments' && rowId) {
      const { ok, status, data } = await ssGet(`/sheets/${sheetId}/rows/${rowId}/attachments`, h);
      if (!ok) return res.status(status).json({ error: data.message || 'Smartsheet error' });

      const items = Array.isArray(data.data) ? data.data : [];
      console.log(`[smartsheet] ${items.length} attachments row=${rowId} ids=${items.map(a => a.id).join(',')}`);

      // Use sheet-scoped URL — same path the official Smartsheet SDK uses.
      // GET /sheets/{sheetId}/attachments/{id}  returns the presigned download URL.
      await Promise.all(
        items
          .filter(a => a.attachmentType === 'FILE')
          .map(async a => {
            const path = `/sheets/${sheetId}/attachments/${a.id}`;
            const { ok: uok, status: ust, data: ud } = await ssGet(path, h);
            console.log(`[smartsheet] ${path} → ${ust}${uok ? ` url=${String(ud.url || '').slice(0, 60)}` : ` err=${ud.message}`}`);
            if (uok && ud.url) a.downloadUrl = ud.url;
          })
      );

      return res.json(data);
    }

    // ── Single attachment URL (sheet-scoped when possible) ────────────────
    if (action === 'attachment-url' && attachmentId) {
      // Prefer sheet-scoped path; fall back to global if sheetId not provided
      const path = sheetId
        ? `/sheets/${sheetId}/attachments/${attachmentId}`
        : `/attachments/${attachmentId}`;
      const { ok, status, data } = await ssGet(path, h);
      console.log(`[smartsheet] attachment-url ${path} → ${status}`);
      if (!ok) return res.status(status).json({ error: data.message || 'Smartsheet error' });
      return res.json(data);
    }

    // ── Sheet fetch ───────────────────────────────────────────────────────
    const params = new URLSearchParams();
    params.set('include', include || 'attachments');
    const url = `/sheets/${String(sheetId).trim()}?${params}`;
    console.log(`[smartsheet] sheet ${url} (${session.name})`);

    const { ok, status, data } = await ssGet(url, h);
    if (!ok) {
      console.error('[smartsheet] upstream error:', data);
      return res.status(status).json({ error: data.message || 'Smartsheet API error', errorCode: data.errorCode });
    }
    console.log(`[smartsheet] ok: ${data.name}, rows=${data.rows?.length}`);
    return res.status(200).json(data);

  } catch (err) {
    console.error('[smartsheet] threw:', err.message);
    return res.status(500).json({ error: 'Proxy error', detail: err.message });
  }
};
