// api/users.js — User CRUD (list: any authenticated; write: admin only)
'use strict';
const { kvGet, kvSet, cors, requireAuth, requireAdmin } = require('../lib');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — list users (authenticated, but PINs stripped)
  if (req.method === 'GET') {
    const session = requireAuth(req, res);
    if (!session) return;
    try {
      const users = await kvGet('gl3_users') || [];
      // Strip PINs before sending to client
      return res.json(users.map(u => ({ ...u, pin: undefined })));
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method !== 'POST') return res.status(405).end();

  // All write actions require admin
  const session = requireAdmin(req, res);
  if (!session) return;

  const body   = req.body || {};
  const action = body.action;

  try {
    const users = await kvGet('gl3_users') || [];

    if (action === 'create') {
      const { name, username, pin, role, airport } = body;
      if (!name || !username || !pin)   return res.status(400).json({ error: 'name, username and pin are required.' });
      if (pin.length < 4)               return res.status(400).json({ error: 'PIN must be at least 4 digits.' });
      if (role === 'airport' && !airport) return res.status(400).json({ error: 'airport is required for airport role.' });
      const lower = username.trim().toLowerCase();
      if (users.some(u => u.username === lower)) return res.status(409).json({ error: 'Username already taken.' });

      const newUser = {
        id:      `user_${Date.now()}`,
        name:    name.trim(),
        username: lower,
        pin,
        role:    role || 'airport',
        airport: role === 'airport' ? airport : null,
        active:  true,
        created: new Date().toISOString(),
      };
      users.push(newUser);
      await kvSet('gl3_users', users);
      return res.json({ ...newUser, pin: undefined });
    }

    if (action === 'update') {
      const { id, name, username, pin, role, airport, active } = body;
      const idx = users.findIndex(u => u.id === id);
      if (idx === -1) return res.status(404).json({ error: 'User not found.' });
      const lower = (username || '').trim().toLowerCase();
      if (lower && users.some(u => u.username === lower && u.id !== id)) {
        return res.status(409).json({ error: 'Username already taken.' });
      }
      if (pin && pin.length < 4) return res.status(400).json({ error: 'PIN must be at least 4 digits.' });
      const u = users[idx];
      if (name)   u.name     = name.trim();
      if (lower)  u.username = lower;
      if (pin)    u.pin      = pin;
      if (role)   u.role     = role;
      if (role)   u.airport  = role === 'airport' ? (airport || null) : null;
      if (active !== undefined) u.active = active;
      await kvSet('gl3_users', users);
      return res.json({ ...u, pin: undefined });
    }

    if (action === 'delete') {
      const { id } = body;
      if (id === session.sub) return res.status(400).json({ error: 'Cannot delete your own account.' });
      const filtered = users.filter(u => u.id !== id);
      if (filtered.length === users.length) return res.status(404).json({ error: 'User not found.' });
      await kvSet('gl3_users', filtered);
      return res.json({ ok: true });
    }

    // Token status — show only to admin, never the actual value
    if (action === 'token-status') {
      const t = process.env.SMARTSHEET_TOKEN || '';
      return res.json({ set: t.length > 0, hint: t ? `••••${t.slice(-4)}` : 'not set' });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (e) {
    console.error('[users] error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
