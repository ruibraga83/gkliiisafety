# Self-hosting on Hetzner — step by step

Goal: serve the Safety Dashboard at
**`https://intranet.groundlinkhandling.pt/dashboards/safety/`** from your own
Hetzner server. Architecture:

```
Browser ──HTTPS──► Nginx (intranet.groundlinkhandling.pt)
                     ├─ /dashboards/safety/        ─┐
                     └─ /dashboards/safety/api/*   ─┴─► Node/Express @ 127.0.0.1:3000
                                                          (server.js → api/*.js handlers)
                                                          └─► Smartsheet API + Upstash KV
```

- `index.html` is base-path aware (a `<head>` script sets `<base href>`), so the
  same code works at `/dashboards/safety/`.
- `server.js` runs the existing `api/*.js` handlers as one process.
- Nginx terminates TLS and reverse-proxies the path to the Node service.

Everything below is run **on the Hetzner server** over SSH unless noted.

---

## 0. Prerequisites

- A Hetzner server (Ubuntu/Debian) already serving `intranet.groundlinkhandling.pt`
  over HTTPS via Nginx. (If TLS isn't set up yet, see step 6.)
- DNS: `intranet.groundlinkhandling.pt` → your server's IP (A/AAAA record).
- An [Upstash](https://console.upstash.com) Redis database (free) for the user
  store — copy its **REST URL** and **REST token**.
- Your Smartsheet API token.

## 1. Install Node.js 20 + git

```bash
sudo apt update
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git
node -v   # should print v20.x
```

## 2. Put the code in /opt/safety

```bash
sudo mkdir -p /opt/safety
sudo chown "$USER":"$USER" /opt/safety
git clone https://github.com/ruibraga83/gkliiisafety.git /opt/safety
cd /opt/safety
npm install --omit=dev      # installs express
```

Resulting layout:

```
/opt/safety/
├── server.js          # Express entry point (serves static + mounts api/*)
├── index.html         # the dashboard (served at /dashboards/safety/)
├── logo.png
├── lib.js             # JWT / KV / auth helpers
├── api/               # smartsheet, auth, setup, users, attachment-proxy
├── package.json
├── node_modules/
└── .env               # secrets (you create this next — never committed)
```

## 3. Create the secrets file

```bash
cp .env.example .env
nano .env
```

Fill in (generate the JWT secret with the command in the file):

```
SMARTSHEET_TOKEN=...your token...
JWT_SECRET=...long random string...
KV_REST_API_URL=https://...upstash.io
KV_REST_API_TOKEN=...
PORT=3000
HOST=127.0.0.1
```

Lock it down and hand ownership to the service user:

```bash
sudo chown -R www-data:www-data /opt/safety
sudo chmod 600 /opt/safety/.env
```

## 4. Run it as a service

```bash
sudo cp deploy/safety-dashboard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now safety-dashboard
sudo systemctl status safety-dashboard      # should be active (running)
```

Quick local check (still on the server):

```bash
curl http://127.0.0.1:3000/healthz          # {"ok":true}
curl -I http://127.0.0.1:3000/              # 200, the dashboard HTML
```

Logs: `journalctl -u safety-dashboard -f`

## 5. Wire up Nginx

Open the vhost for the intranet host:

```bash
sudo nano /etc/nginx/sites-available/intranet.groundlinkhandling.pt   # path may differ
```

Paste the two `location` blocks from
[`deploy/nginx-intranet.conf`](deploy/nginx-intranet.conf) **inside** that
host's `server { ... }` (the HTTPS one, listening on 443), then:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 6. (Only if the host has no HTTPS yet) issue a certificate

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d intranet.groundlinkhandling.pt
```

## 7. Verify from your machine

```bash
# 301 to the trailing slash
curl -I https://intranet.groundlinkhandling.pt/dashboards/safety

# the dashboard
curl -I https://intranet.groundlinkhandling.pt/dashboards/safety/

# API through the proxy — 401 (not 404/502) means routing + auth both work
curl -X POST https://intranet.groundlinkhandling.pt/dashboards/safety/api/smartsheet
```

Then open `https://intranet.groundlinkhandling.pt/dashboards/safety/` in a
browser. First visit runs the one-time **setup** screen (creates the first admin
user in Upstash); after that, log in with username + PIN.

## 8. Link it from the intranet portal

```html
<a href="https://intranet.groundlinkhandling.pt/dashboards/safety/">Safety Dashboard</a>
```

Keep the trailing slash (the 301 covers anyone who drops it).

---

## Updating later

```bash
cd /opt/safety
sudo -u www-data git pull
sudo -u www-data npm install --omit=dev
sudo systemctl restart safety-dashboard
```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `502 Bad Gateway` | Node service down — `systemctl status safety-dashboard`, check `journalctl -u safety-dashboard`. |
| `404` on `/dashboards/safety/api/...` | Nginx `location` blocks not inside the right `server{}`, or missing trailing slash on `proxy_pass`. |
| Login says "No users configured" | Expected on first run — complete the setup screen. |
| `503 KV store not configured` | `KV_REST_API_URL` / `KV_REST_API_TOKEN` missing or wrong in `.env`. |
| Assets/log in but API 401 loops | `JWT_SECRET` changed between requests (must be stable), or clock skew. |
