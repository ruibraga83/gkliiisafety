# Groundlink III — Safety Dashboard

Safety metrics dashboard for GroundLink III, pulling data from Smartsheet with a
self-contained login (username + PIN) and role-based access.

**Status:** 🟢 Live at **https://intranet.groundlinkhandling.pt/dashboards/safety/**
(self-hosted on the GroundLink server via Caddy + Docker).

---

## What it is

- **Frontend:** a single `index.html` (vanilla JS + Chart.js). It is **base-path
  agnostic** — a `<head>` script sets `<base href>` from the URL, so the same file
  works at a domain root *or* under `/dashboards/safety/`. All asset/API URLs are
  relative.
- **Backend:** small serverless-style handlers in `api/` (originally Vercel
  functions). `server.js` runs them as one Express process for self-hosting.
- **Auth:** `lib.js` issues HMAC-signed JWTs; the Smartsheet token stays
  server-side and is never sent to the browser.

## Layout

```
index.html         Dashboard UI (base-path aware)
logo.png           Logo / favicon
server.js          Express entry — serves static + mounts api/* handlers
lib.js             JWT, storage, CORS/auth helpers
api/
  smartsheet.js    Smartsheet data proxy (+ attachment presign)
  auth.js          Login → JWT
  setup.js         First-run admin setup
  users.js         User CRUD (admin)
  attachment-proxy.js
Dockerfile         node:20-alpine image (runs server.js on 0.0.0.0:3000)
docker-compose.yml Runs as gl_safety on the existing external "proxy" network
deploy/            Reference configs (Caddy snippet; alt nginx/systemd recipes)
DEPLOYMENT.md      Step-by-step server deployment
```

## Storage backends

`lib.js` picks a user store at runtime, in priority order:

| Condition | Backend |
|---|---|
| `REDIS_URL` set | Local/self-hosted Redis (`redis` package) |
| `KV_REST_API_URL` set | Upstash / Vercel KV REST |
| `DATA_DIR` set | JSON file on disk (zero dependencies) — **used in production** |

Keys are namespaced under `gl3:`. Production uses the file store on the
`safety_data` Docker volume.

## Environment variables

| Variable | Purpose |
|---|---|
| `SMARTSHEET_TOKEN` | Smartsheet API token (server-side only) |
| `JWT_SECRET` | Signs login sessions (keep stable) |
| `DATA_DIR` | File-store directory (`/data` in the image) |
| `REDIS_URL` / `KV_REST_API_URL`+`KV_REST_API_TOKEN` | Optional alternative stores |
| `PORT` / `HOST` | Bind address (defaults `3000` / `0.0.0.0` in Docker) |

## Local development

```bash
npm install
JWT_SECRET=dev SMARTSHEET_TOKEN=... DATA_DIR=./_data node server.js
# open http://localhost:3000
```

## Deployment

Production runs as a Docker container (`gl_safety`) behind the server's Caddy,
which reverse-proxies `intranet.groundlinkhandling.pt/dashboards/safety/*` to it.
See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the full procedure.

Update a running deployment:

```bash
cd /opt/safety
git pull
docker compose up -d --build
```
