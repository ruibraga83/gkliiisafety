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

    // ── Single attachment URL (try all known endpoint variants) ─────────────
    if (action === 'attachment-url' && attachmentId) {
      const paths = [
        sheetId ? `/sheets/${sheetId}/attachments/${attachmentId}` : null,
        `/attachments/${attachmentId}`,
      ].filter(Boolean);

      for (const path of paths) {
        const { ok, status, data } = await ssGet(path, h);
        console.log(`[smartsheet] try ${path} → ${status} ${JSON.stringify(data).slice(0,120)}`);
        if (ok && data.url) return res.json(data);
        if (ok && !data.url) return res.status(502).json({ error: `Endpoint ${path} returned 200 but no url field. Keys: ${Object.keys(data).join(',')}` });
      }
      return res.status(404).json({ error: `All attachment endpoints returned 404 for id=${attachmentId} sheetId=${sheetId}` });
    }

    // ── Attachment diagnostic (tries every variant, returns raw results) ──
    if (action === 'diagnose-attachment' && attachmentId) {
      const variants = [
        `/attachments/${attachmentId}`,
        sheetId ? `/sheets/${sheetId}/attachments/${attachmentId}` : null,
        (sheetId && rowId) ? `/sheets/${sheetId}/rows/${rowId}/attachments` : null,
      ].filter(Boolean);

      const results = {};
      for (const p of variants) {
        const r = await fetch(`${SS_BASE}${p}`, { headers: h });
        const text = await r.text();
        results[p] = { status: r.status, body: text.slice(0, 500) };
      }
      console.log('[smartsheet] diagnose:', JSON.stringify(results));
      return res.json(results);
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
