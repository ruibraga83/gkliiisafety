// api/_lib.js — shared utilities (not deployed as a function, underscore prefix)
'use strict';
const crypto = require('crypto');

// ── JWT (HMAC-SHA256, no external deps) ──────────────────────
function signJWT(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var not set');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body   = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data   = `${header}.${body}`;
  const sig    = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyJWT(token) {
  if (!token) return null;
  const parts = (token || '').split('.');
  if (parts.length !== 3) return null;
  try {
    const secret   = process.env.JWT_SECRET;
    const data     = `${parts[0]}.${parts[1]}`;
    const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    if (expected !== parts[2]) return null;
    const payload  = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (e) { return null; }
}

// ── Vercel KV (Upstash REST) ──────────────────────────────────
async function kvOp(commands) {
  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN env vars not set');
  const res = await fetch(`${url}/pipeline`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`KV error: ${res.status}`);
  return res.json();
}

async function kvGet(key) {
  const results = await kvOp([['GET', key]]);
  const val = results?.[0]?.result;
  return val ? JSON.parse(val) : null;
}

async function kvSet(key, value) {
  await kvOp([['SET', key, JSON.stringify(value)]]);
}

// ── CORS & auth helpers ───────────────────────────────────────
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function getBearerToken(req) {
  const auth = req.headers.authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
}

function requireAuth(req, res) {
  const jwt     = getBearerToken(req);
  const session = verifyJWT(jwt);
  if (!session) { res.status(401).json({ error: 'Unauthorized — please log in.' }); return null; }
  return session;
}

function requireAdmin(req, res) {
  const session = requireAuth(req, res);
  if (!session) return null;
  if (session.role !== 'admin') { res.status(403).json({ error: 'Admin access required.' }); return null; }
  return session;
}

module.exports = { signJWT, verifyJWT, kvGet, kvSet, cors, getBearerToken, requireAuth, requireAdmin };
