// api/attachment-proxy.js
// Proxies Smartsheet attachment content through the server so:
// - Preview works (img src / iframe src on same domain — no CORS)
// - Download works (direct <a href> — no popup-blocker issue)
// - Presigned S3 URL is never exposed to the client
'use strict';
const { verifyJWT } = require('../lib');

const SS_BASE = 'https://api.smartsheet.com/2.0';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Parse query string manually as a fallback (req.query may be empty on some runtimes)
  const rawUrl = req.url || '';
  const qs     = rawUrl.includes('?') ? new URLSearchParams(rawUrl.split('?')[1]) : new URLSearchParams();
  const q      = k => (req.query && req.query[k]) || qs.get(k) || '';

  // Accept JWT from query param (needed for img src / a href) or Authorization header
  const jwt     = q('jwt') || (req.headers.authorization || '').replace('Bearer ', '').trim();
  const session = verifyJWT(jwt);
  if (!session) return res.status(401).send('Unauthorized');

  const id       = q('id');
  const filename = q('filename') || '';
  const download = q('download');

  if (!id) return res.status(400).send('Missing attachment id');

  const token = process.env.SMARTSHEET_TOKEN;
  if (!token) return res.status(503).send('SMARTSHEET_TOKEN not configured');

  try {
    // Step 1: get the presigned download URL from Smartsheet
    const metaRes = await fetch(`${SS_BASE}/attachments/${id}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!metaRes.ok) {
      const err = await metaRes.json().catch(() => ({}));
      return res.status(metaRes.status).send(err.message || 'Smartsheet API error');
    }
    const meta = await metaRes.json();
    if (!meta.url) return res.status(502).send('No download URL in Smartsheet response');

    // Step 2: fetch the actual file bytes
    const fileRes = await fetch(meta.url);
    if (!fileRes.ok) return res.status(fileRes.status).send('Failed to fetch file from storage');

    const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';
    const safeFilename = encodeURIComponent(filename || meta.name || id);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=120');

    if (download === '1') {
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeFilename}`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${safeFilename}`);
    }

    const buffer = await fileRes.arrayBuffer();
    res.end(Buffer.from(buffer));

  } catch (e) {
    console.error('[attachment-proxy] error:', e.message);
    res.status(500).send('Proxy error: ' + e.message);
  }
};
