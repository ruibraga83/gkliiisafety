// api/auth.js — Login: validate username + PIN → return signed JWT
'use strict';
const { signJWT, kvGet, cors } = require('../lib');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const body     = req.body || {};
    const username = String(body.username || '').trim().toLowerCase();
    const pin      = String(body.pin || '').trim();

    if (!username || !pin) return res.status(400).json({ error: 'username and pin are required.' });

    const users = await kvGet('gl3_users');
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(503).json({ error: 'No users configured. Complete first-time setup.' });
    }

    const user = users.find(u => u.active !== false &&
      u.username.toLowerCase() === username && u.pin === pin);

    if (!user) return res.status(401).json({ error: 'Invalid username or PIN.' });

    const token = signJWT({
      sub:     user.id,
      name:    user.name,
      role:    user.role,
      airport: user.airport || null,
      exp:     Math.floor(Date.now() / 1000) + 86400 * 7,
    });

    return res.json({ token, name: user.name, role: user.role, airport: user.airport || null });
  } catch (e) {
    console.error('[auth] error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
