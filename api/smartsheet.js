// Use native fetch if available, otherwise fall back to node-fetch
const fetch = globalThis.fetch || require('node-fetch');

const SMARTSHEET_API = 'https://api.smartsheet.com/2.0';

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Parse request body
  const { action, token, sheetId } = req.body || {};

  console.log('[VERCEL API] Request:', { 
    method: req.method,
    action, 
    sheetId: sheetId ? sheetId.substring(0, 8) + '...' : 'N/A',
    hasToken: !!token
  });

  if (!token) {
    console.error('[VERCEL API] Missing token');
    return res.status(400).json({ error: 'Missing token' });
  }

  // Handle debug action
  if (action === 'debug') {
    return res.status(200).json({
      status: 'ok',
      message: 'Vercel function is working',
      node: process.version,
      timestamp: new Date().toISOString()
    });
  }

  // Handle listSheets action
  if (action === 'listSheets') {
    try {
      console.log('[VERCEL API] Listing sheets...');
      
      const response = await fetch(`${SMARTSHEET_API}/sheets`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[VERCEL API ERROR]', response.status, errorText);
        return res.status(response.status).json({
          error: `Smartsheet API error: ${response.status}`,
          details: errorText
        });
      }

      const data = await response.json();
      console.log('[VERCEL API] ✅ Listed', data.data?.length || 0, 'sheets');
      return res.status(200).json(data);

    } catch (err) {
      console.error('[VERCEL API FETCH ERROR]', err);
      return res.status(500).json({ 
        error: 'Failed to fetch sheets', 
        details: err.message 
      });
    }
  }

  // Handle getSheet action
  if (action === 'getSheet') {
    if (!sheetId) {
      console.error('[VERCEL API] Missing sheetId');
      return res.status(400).json({ error: 'Missing sheetId' });
    }

    try {
      // Fetch ALL rows (no pagination - Smartsheet returns all up to 20k rows)
      const url = `${SMARTSHEET_API}/sheets/${sheetId}`;
      console.log('[VERCEL API] Fetching sheet:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[VERCEL API ERROR]', response.status, errorText);
        return res.status(response.status).json({
          error: `Smartsheet API error: ${response.status}`,
          details: errorText
        });
      }

      const data = await response.json();

      const result = {
        name: data.name || '',
        totalRows: data.totalRowCount || 0,
        columns: data.columns || [],
        rows: data.rows || []
      };

      console.log('[VERCEL API] ✅ Success:', {
        name: result.name,
        totalRows: result.totalRows,
        rowsReturned: result.rows.length,
        columnsReturned: result.columns.length
      });

      return res.status(200).json(result);

    } catch (err) {
      console.error('[VERCEL API FETCH ERROR]', err);
      return res.status(500).json({ 
        error: 'Failed to fetch sheet', 
        details: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }
  }

  console.error('[VERCEL API] Unknown action:', action);
  return res.status(400).json({ error: 'Unknown action', received: action });
};
