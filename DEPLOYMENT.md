# Deploying on the GroundLink server (Caddy + Docker)

Goal: serve the Safety Dashboard at
**`https://intranet.groundlinkhandling.pt/dashboards/safety/`** on the existing
server, alongside the current intranet, without touching the running stack.

Live architecture (discovered from `docker ps` / `docker inspect`):

```
Browser ──HTTPS──► Caddy (caddy-caddy-1, network: proxy, /opt/caddy/Caddyfile)
   intranet.groundlinkhandling.pt
     ├─ /dashboards/safety/*  ──► safety:3000   (this app — to be added)
     ├─ /api/*                ──► backend:4000  (existing)
     └─ (everything else)     ──► frontend:80   (existing intranet)
```

- The app runs as its own container `gl_safety` on the shared **`proxy`** network.
- It stores its small user list in a file on the `safety_data` volume — **no Redis
  or external service needed**.
- `index.html` is base-path aware, so the same image works under `/dashboards/safety/`.

All commands run **on the server** over SSH.

---

## 1. Get the code

```bash
sudo mkdir -p /opt/safety && sudo chown "$USER":"$USER" /opt/safety
git clone https://github.com/ruibraga83/gkliiisafety.git /opt/safety
cd /opt/safety
```

## 2. Create the secrets file

```bash
cat > .env <<EOF
SMARTSHEET_TOKEN=PASTE_YOUR_SMARTSHEET_TOKEN
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))" 2>/dev/null || openssl rand -base64 48)
EOF
chmod 600 .env
cat .env   # check both values are filled in; edit SMARTSHEET_TOKEN if needed
```

`JWT_SECRET` here is the dashboard's **own** login secret (independent of the
intranet's). `.env` is git-ignored.

## 3. Start the container

```bash
cd /opt/safety
docker compose up -d --build
docker compose ps
docker compose logs -f safety   # expect: "Safety dashboard listening on http://0.0.0.0:3000"
```

This joins the existing external `proxy` network. (If you ever see
`network proxy declared as external, but could not be found`, the network name
differs — run `docker network ls` and update `networks.proxy` in
`docker-compose.yml`.)

## 4. Add the Caddy route

Edit the live Caddyfile and add the safety block to the **intranet** site:

```bash
sudo nano /opt/caddy/Caddyfile
```

Make the `intranet.groundlinkhandling.pt { ... }` block look like this (the
first two additions are new — see `deploy/caddy-snippet.txt`):

```caddy
intranet.groundlinkhandling.pt {
    redir /dashboards/safety /dashboards/safety/

    handle_path /dashboards/safety/* {
        reverse_proxy safety:3000
    }

    handle_path /api/* {
        reverse_proxy backend:4000
    }
    handle {
        reverse_proxy frontend:80
    }
}
```

Reload Caddy (zero downtime):

```bash
docker exec caddy-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

## 5. Verify

```bash
# 308/301 to the trailing slash
curl -I https://intranet.groundlinkhandling.pt/dashboards/safety

# the dashboard HTML
curl -I https://intranet.groundlinkhandling.pt/dashboards/safety/

# API through the proxy — 401 (not 404/502) means routing works
curl -X POST https://intranet.groundlinkhandling.pt/dashboards/safety/api/smartsheet
```

Open `https://intranet.groundlinkhandling.pt/dashboards/safety/` in a browser.
First visit shows the one-time **setup** screen (creates the first admin user on
the `safety_data` volume); after that, log in with username + PIN.

## 6. Link it from the intranet

```html
<a href="https://intranet.groundlinkhandling.pt/dashboards/safety/">Safety Dashboard</a>
```

Keep the trailing slash (the `redir` covers anyone who drops it).

---

## Updating later

```bash
cd /opt/safety
git pull
docker compose up -d --build
```

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `502 Bad Gateway` | `gl_safety` down or not on `proxy` — `docker compose ps`, `docker compose logs safety`. |
| `404` at `/dashboards/safety/` | Caddy block missing or not reloaded; re-run the `caddy reload`. |
| "No users configured" on login | Expected on first run — complete the setup screen. |
| `No storage configured` error | `DATA_DIR` not set — it's baked into the image as `/data`; ensure the `safety_data` volume is mounted. |
| Login loops / 401 after setup | `JWT_SECRET` changed between restarts — keep it stable in `.env`. |

> The `deploy/nginx-intranet.conf` and `deploy/safety-dashboard.service` files
> are alternative recipes for a plain-VPS (Nginx + systemd) host. They are **not**
> used in this Caddy + Docker deployment.
