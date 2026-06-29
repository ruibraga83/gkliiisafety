'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Self-hosted runtime for the Groundlink III Safety Dashboard.
//
// On Vercel each api/*.js file is its own serverless function. On a plain server
// we run one small Express process that mounts those SAME handler files unchanged
// (they already use the (req, res) signature Express provides) and serves the two
// static assets. Only the routes below are exposed — server.js, lib.js, api/*.js
// source and .env are never web-readable.
//
//   npm install        # installs express
//   node server.js     # reads env from the process (systemd EnvironmentFile)
// ─────────────────────────────────────────────────────────────────────────────
const path = require('path');
const express = require('express');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '5mb' }));

// ── Static assets (the only files served from disk) ──────────────────────────
app.get(['/', '/index.html'], (_req, res) =>
  res.sendFile(path.join(__dirname, 'index.html')));
app.get('/logo.png', (_req, res) =>
  res.sendFile(path.join(__dirname, 'logo.png')));

// ── API: mount each Vercel-style handler unchanged ───────────────────────────
const routes = {
  '/api/smartsheet':       require('./api/smartsheet'),
  '/api/auth':             require('./api/auth'),
  '/api/setup':            require('./api/setup'),
  '/api/users':            require('./api/users'),
  '/api/attachment-proxy': require('./api/attachment-proxy'),
};
for (const [route, handler] of Object.entries(routes)) {
  app.all(route, (req, res) =>
    Promise.resolve(handler(req, res)).catch((err) => {
      console.error(`[${route}]`, err);
      if (!res.headersSent) res.status(500).json({ error: 'Internal error' });
    }));
}

// ── Health check (for systemd / uptime probes) ───────────────────────────────
app.get('/healthz', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1'; // bind to loopback; Nginx fronts it
app.listen(PORT, HOST, () =>
  console.log(`Safety dashboard listening on http://${HOST}:${PORT}`));
