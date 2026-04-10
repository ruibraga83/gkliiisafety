// api/smartsheet.js  –  Vercel Serverless Function (Node.js 18+)
module.exports = async function handler(req, res) {

  // ── CORS headers on every response ─────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // ── Handle preflight ────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ── Only POST allowed ───────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    // Vercel automatically parses application/json bodies into req.body
    const { token, sheetId } = req.body || {};

    if (!token) {
      return res.status(401).json({ error: 'Missing Smartsheet API token.' });
    }
    if (!sheetId) {
      return res.status(400).json({ error: 'Missing sheetId parameter.' });
    }

    // ── Proxy request to Smartsheet ─────────────────────────────────────────
    const url = `https://api.smartsheet.com/2.0/sheets/${sheetId}`;

    const upstream = await fetch(url, {
      method:  'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      console.error(`[smartsheet] Upstream error ${upstream.status}:`, data);
      return res.status(upstream.status).json({
        error:     data.message   || 'Smartsheet API error',
        errorCode: data.errorCode || null,
        refId:     data.refId     || null,
      });
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('[smartsheet] Unhandled error:', err);
    return res.status(500).json({
      error:  'Internal proxy error',
      detail: err.message,
    });
  }
};
