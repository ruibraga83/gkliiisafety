# Graph Report - .  (2026-06-29)

## Corpus Check
- Corpus is ~4,186 words - fits in a single context window. You may not need a graph.

## Summary
- 69 nodes · 100 edges · 13 communities detected
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_lib.js Internals (storage + auth helpers)|lib.js Internals (storage + auth helpers)]]
- [[_COMMUNITY_Authentication & User Store|Authentication & User Store]]
- [[_COMMUNITY_Deployment & Hosting (CaddyDocker)|Deployment & Hosting (Caddy/Docker)]]
- [[_COMMUNITY_Smartsheet Proxy & Security Rationale|Smartsheet Proxy & Security Rationale]]
- [[_COMMUNITY_Storage Backend Selection|Storage Backend Selection]]
- [[_COMMUNITY_Smartsheet Data Fetch|Smartsheet Data Fetch]]
- [[_COMMUNITY_Attachment Proxy|Attachment Proxy]]
- [[_COMMUNITY_Shared lib Module|Shared lib Module]]
- [[_COMMUNITY_Express Server (server.js)|Express Server (server.js)]]
- [[_COMMUNITY_Auth Endpoint|Auth Endpoint]]
- [[_COMMUNITY_Setup Endpoint|Setup Endpoint]]
- [[_COMMUNITY_Users Endpoint|Users Endpoint]]
- [[_COMMUNITY_Deprecated _lib Stub|Deprecated _lib Stub]]

## God Nodes (most connected - your core abstractions)
1. `server.js Express app` - 8 edges
2. `users.js CRUD handler` - 7 edges
3. `gl_safety container` - 7 edges
4. `kvGet()` - 6 edges
5. `kvSet()` - 6 edges
6. `smartsheet.js handler` - 6 edges
7. `setup.js first-run handler` - 6 edges
8. `cors()` - 5 edges
9. `kvGet` - 5 edges
10. `requireAuth` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Vercel serverless origin` --semantically_similar_to--> `server.js Express app`  [INFERRED] [semantically similar]
  README.md → server.js
- `gl_safety container` --conceptually_related_to--> `server.js Express app`  [INFERRED]
  DEPLOYMENT.md → server.js
- `GroundLink III Handling logo` --conceptually_related_to--> `gl_safety container`  [INFERRED]
  logo.png → DEPLOYMENT.md
- `safety_data volume / DATA_DIR file store` --conceptually_related_to--> `File store backend (fileGet/fileSet)`  [INFERRED]
  DEPLOYMENT.md → lib.js
- `Rationale: file store chosen, no Redis needed` --rationale_for--> `File store backend (fileGet/fileSet)`  [EXTRACTED]
  DEPLOYMENT.md → lib.js

## Hyperedges (group relationships)
- **All api/* handlers depend on lib.js helpers** — smartsheet_handler, auth_handler, setup_handler, users_handler, attachment_proxy_handler, lib_module [INFERRED 0.85]
- **Auth flow: login signs JWT, verified per request against gl3_users** — auth_handler, lib_signJWT, lib_verifyJWT, lib_requireAuth, data_gl3_users [INFERRED 0.80]
- **Three interchangeable storage backends solving persistence** — lib_getRedis, lib_fileStore, lib_kvOp, lib_storage_selection [INFERRED 0.85]

## Communities

### Community 0 - "lib.js Internals (storage + auth helpers)"
Cohesion: 0.27
Nodes (13): fileGet(), fileReadAll(), fileSet(), fileStorePath(), getBearerToken(), getRedis(), kvGet(), kvOp() (+5 more)

### Community 1 - "Authentication & User Store"
Cohesion: 0.26
Nodes (14): auth.js login handler, gl3_users store key, JWT_SECRET env var, cors(), getBearerToken, kvGet, kvSet, nsKey gl3: namespace (+6 more)

### Community 2 - "Deployment & Hosting (Caddy/Docker)"
Cohesion: 0.18
Nodes (10): Base-path-agnostic index.html, Caddy reverse proxy, Docker / docker compose, gl_safety container, /dashboards/safety intranet route, proxy network (shared), Caddy snippet config, GroundLink III Handling logo (+2 more)

### Community 3 - "Smartsheet Proxy & Security Rationale"
Cohesion: 0.24
Nodes (10): attachment-proxy.js handler, Vercel serverless origin, SMARTSHEET_TOKEN env var, Rationale: handle_path strips prefix so server.js sees root paths, Rationale: proxy attachment bytes to hide presigned S3 URL and avoid CORS, Rationale: Smartsheet token stays server-side, never sent to browser, server.js Express app, Smartsheet API (api.smartsheet.com/2.0) (+2 more)

### Community 4 - "Storage Backend Selection"
Cohesion: 0.6
Nodes (6): safety_data volume / DATA_DIR file store, File store backend (fileGet/fileSet), getRedis (Redis backend), kvOp (Upstash REST backend), Runtime storage-backend selection, Rationale: file store chosen, no Redis needed

### Community 5 - "Smartsheet Data Fetch"
Cohesion: 1.0
Nodes (2): safeParse(), ssGet()

### Community 6 - "Attachment Proxy"
Cohesion: 1.0
Nodes (0): 

### Community 7 - "Shared lib Module"
Cohesion: 1.0
Nodes (2): api/_lib.js deprecated stub, lib.js Shared Utilities

### Community 8 - "Express Server (server.js)"
Cohesion: 1.0
Nodes (0): 

### Community 9 - "Auth Endpoint"
Cohesion: 1.0
Nodes (0): 

### Community 10 - "Setup Endpoint"
Cohesion: 1.0
Nodes (0): 

### Community 11 - "Users Endpoint"
Cohesion: 1.0
Nodes (0): 

### Community 12 - "Deprecated _lib Stub"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **13 isolated node(s):** `lib.js Shared Utilities`, `getBearerToken`, `API route mount table`, `safeParse (64-bit ID precision)`, `api/_lib.js deprecated stub` (+8 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Attachment Proxy`** (2 nodes): `attachment-proxy.js`, `q()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Shared lib Module`** (2 nodes): `api/_lib.js deprecated stub`, `lib.js Shared Utilities`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Express Server (server.js)`** (1 nodes): `server.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth Endpoint`** (1 nodes): `auth.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Setup Endpoint`** (1 nodes): `setup.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Users Endpoint`** (1 nodes): `users.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Deprecated _lib Stub`** (1 nodes): `_lib.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `server.js Express app` connect `Smartsheet Proxy & Security Rationale` to `Authentication & User Store`, `Deployment & Hosting (Caddy/Docker)`?**
  _High betweenness centrality (0.296) - this node is a cross-community bridge._
- **Why does `cors()` connect `Authentication & User Store` to `lib.js Internals (storage + auth helpers)`, `Smartsheet Proxy & Security Rationale`?**
  _High betweenness centrality (0.279) - this node is a cross-community bridge._
- **Why does `gl_safety container` connect `Deployment & Hosting (Caddy/Docker)` to `Smartsheet Proxy & Security Rationale`, `Storage Backend Selection`?**
  _High betweenness centrality (0.260) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `server.js Express app` (e.g. with `gl_safety container` and `Vercel serverless origin`) actually correct?**
  _`server.js Express app` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `gl_safety container` (e.g. with `server.js Express app` and `GroundLink III Handling logo`) actually correct?**
  _`gl_safety container` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `lib.js Shared Utilities`, `getBearerToken`, `API route mount table` to the rest of the system?**
  _13 weakly-connected nodes found - possible documentation gaps or missing edges._