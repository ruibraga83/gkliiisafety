// api/setup.js — First-time setup: check readiness & create first admin user
'use strict';
const { signJWT, kvGet, kvSet, cors } = require('../lib');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET /api/setup — is the system initialised?
  if (req.method === 'GET') {
    try {
      const users = await kvGet('gl3_users');
      return res.json({ ready: Array.isArray(users) && users.length > 0 });
    } catch (e) {
      // KV not configured — return structured error
      return res.status(503).json({ ready: false, error: 'KV store not configured', detail: e.message });
    }
  }

  if (req.method !== 'POST') return res.status(405).end();

  // POST /api/setup — create first admin user (only allowed when no users exist yet)
  try {
    const existing = await kvGet('gl3_users');
    if (Array.isArray(existing) && existing.length > 0) {
      return res.status(409).json({ error: 'System already initialised. Use /api/auth to log in.' });
    }

    const body     = req.body || {};
    const username = String(body.username || '').trim().toLowerCase();
    const pin      = String(body.pin || '').trim();
    const name     = String(body.name || body.username || 'Administrator').trim();

    if (!username)      return res.status(400).json({ error: 'username is required.' });
    if (pin.length < 4) return res.status(400).json({ error: 'PIN must be at least 4 digits.' });
    if (!process.env.SMARTSHEET_TOKEN) {
      return res.status(503).json({ error: 'SMARTSHEET_TOKEN env var not set on server.' });
    }

    const firstUser = {
      id:       `user_${Date.now()}`,
      name,
      username,
      pin,
      role:     'admin',
      airport:  null,
      active:   true,
      created:  new Date().toISOString(),
    };
    await kvSet('gl3_users', [firstUser]);

    const token = signJWT({
      sub:     firstUser.id,
      name:    firstUser.name,
      role:    firstUser.role,
      airport: null,
      exp:     Math.floor(Date.now() / 1000) + 86400 * 7,
    });

    return res.status(201).json({ token, name: firstUser.name, role: 'admin', airport: null });
  } catch (e) {
    console.error('[setup] error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
