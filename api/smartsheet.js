// api/smartsheet.js — Vercel Serverless Function (Node 18+)
module.exports = async function handler(req, res) {

  // ── CORS on every response ──────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // ── Preflight ───────────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ── Only POST ───────────────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method Not Allowed. Use POST.',
      received: req.method
    });
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  // Vercel auto-parses application/json into req.body
  // but guard against edge cases
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); }
    catch(e) {
      return res.status(400).json({ error: 'Invalid JSON body', detail: e.message });
    }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Empty or non-object body received' });
  }

  const { token, sheetId } = body;

  console.log('[smartsheet] Request received:', {
    hasToken:  !!token,
    tokenLen:  token ? token.length : 0,
    sheetId:   sheetId || 'MISSING',
  });

  // ── Validate ─────────────────────────────────────────────────────────────────
  if (!token || String(token).trim() === '') {
    return res.status(401).json({ error: 'Missing Smartsheet API token.' });
  }
  if (!sheetId || String(sheetId).trim() === '') {
    return res.status(400).json({ error: 'Missing sheetId parameter.' });
  }

  // ── Call Smartsheet ──────────────────────────────────────────────────────────
  const url = `https://api.smartsheet.com/2.0/sheets/${String(sheetId).trim()}`;
  console.log('[smartsheet] Fetching:', url);

  try {
    const upstream = await fetch(url, {
      method:  'GET',
      headers: {
        'Authorization': `Bearer ${String(token).trim()}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
    });

    const text = await upstream.text();
    console.log('[smartsheet] Upstream status:', upstream.status);
    console.log('[smartsheet] Upstream body (first 300):', text.substring(0, 300));

    let data;
    try { data = JSON.parse(text); }
    catch(e) {
      return res.status(502).json({
        error:  'Smartsheet returned non-JSON response',
        status: upstream.status,
        body:   text.substring(0, 500),
      });
    }

    if (!upstream.ok) {
      console.error('[smartsheet] Upstream error:', data);
      return res.status(upstream.status).json({
        error:     data.message   || 'Smartsheet API error',
        errorCode: data.errorCode || null,
        refId:     data.refId     || null,
        sheetId:   sheetId,
      });
    }

    console.log('[smartsheet] Success — rows:', data.rows ? data.rows.length : 'N/A');
    return res.status(200).json(data);

  } catch (err) {
    console.error('[smartsheet] Fetch threw:', err.message);
    return res.status(500).json({
      error:  'Proxy fetch failed',
      detail: err.message,
    });
  }
};
