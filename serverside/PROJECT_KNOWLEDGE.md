# AlpenSign RPC Proxy — Project Knowledge

> **Purpose of this document:** Explain the what, why, and how of this
> Cloudflare Worker to future developers (including the author) and to
> serve as LLM context for AI-assisted development sessions.
>
> **Last updated:** 2026-03-07 · **Version:** 0.1.0


## 1. Why does this exist?

AlpenSign and Gbits (isochain) are browser-only web apps — single HTML/JS
files with zero build step, designed so a bank compliance officer can
View Source and read every line.

These apps need to talk to the Solana blockchain via JSON-RPC. The public
Solana RPC endpoints (`api.mainnet-beta.solana.com`, `api.devnet.solana.com`)
block browser-origin requests with HTTP 403. The solution is Helius, a
commercial RPC provider that allows browser calls — but requires an API key.

**The problem:** Shipping the Helius API key in client-side JavaScript
(via `config.js` or hardcoded in `app.js`) exposes it to anyone who opens
DevTools. Anyone can extract it, abuse the quota, or impersonate the app.

**The solution:** This Cloudflare Worker sits between the browser and Helius.
The browser sends JSON-RPC requests to the worker. The worker injects the
API key server-side and forwards the request to Helius. The key never
leaves the server.

```
 ┌──────────────┐         ┌──────────────────┐         ┌──────────────┐
 │              │  POST   │                  │  POST   │              │
 │  Browser     │────────▶│  CF Worker       │────────▶│  Helius RPC  │
 │  (app.js)    │  /rpc   │  (edge, ~20ms)   │  +key   │  (Solana)    │
 │              │◀────────│                  │◀────────│              │
 │              │  JSON   │                  │  JSON   │              │
 └──────────────┘         └──────────────────┘         └──────────────┘
                           │
                           │ API key injected here
                           │ (env.HELIUS_API_KEY)
                           │
                           │ Also enforces:
                           │  • method whitelist
                           │  • CORS headers
```


## 2. What does it do today?

A single file (`src/index.mjs`, ~130 lines) that handles one job:

**Route: `POST /rpc?network=mainnet|devnet`**

1. Receives a Solana JSON-RPC request body from the browser.
2. Validates the `method` field against a whitelist (see §4).
3. Picks the Helius endpoint based on the `network` query param.
4. Appends the API key (from `env.HELIUS_API_KEY`) to the Helius URL.
5. Forwards the request, streams the response back to the browser.

That's it. No state. No database. No dependencies beyond the Workers runtime.


## 3. How do the browser apps integrate?

### Before (API key exposed)

```javascript
const HELIUS_API_KEY = 'cf479a6e-...';  // visible in View Source
const rpc = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
```

### After (key hidden server-side)

```javascript
const RPC_PROXY = '/rpc';  // or https://alpensign-rpc.<you>.workers.dev/rpc

const NETWORKS = {
  mainnet: {
    label: 'Mainnet',
    chain: 'solana:mainnet',
    rpc: `${RPC_PROXY}?network=mainnet`,
    explorerSuffix: '',
  },
  devnet: {
    label: 'Devnet',
    chain: 'solana:devnet',
    rpc: `${RPC_PROXY}?network=devnet`,
    explorerSuffix: '?cluster=devnet',
  },
};
```

`solanaWeb3.Connection` accepts any URL that speaks JSON-RPC over HTTP POST,
so the proxy URL is a drop-in replacement. No other changes needed in the
Web3 calls (`getBalance`, `getLatestBlockhash`, `sendTransaction`, etc.).

The direct `fetch` calls in `sgtRpcCall()` (Genesis Token verification)
also just need their URL pointed at `RPC_PROXY + '?network=mainnet'`.

After migration, `config.js` and `config.example.js` can be deleted entirely.

### Consuming projects

| Project | File(s) that use the proxy |
|---------|---------------------------|
| AlpenSign | `app.js` — wallet signing, balance checks, SGT verification |
| Gbits / isochain | `defi_camt.html` — stablecoin tx queries, ISO 20022 bridging |


## 4. Security model

### Method whitelist

Only these Solana JSON-RPC methods are forwarded. Everything else returns
`403 Method not allowed`. This prevents abuse of the Helius key for
expensive or dangerous operations (e.g., `simulateTransaction` spam).

```
getBalance              getLatestBlockhash
getTokenAccountsByOwner getAccountInfo
sendTransaction         getSignatureStatuses
getTransaction          getSlot
getBlockHeight
```

To allow a new method, add it to the `ALLOWED_METHODS` set in `src/index.mjs`.
Batched JSON-RPC requests (array of calls) are supported; every method
in the batch is checked.

### CORS

Currently `Access-Control-Allow-Origin: *`. Before production, restrict
this to the exact origin(s) serving the apps (e.g., `https://alpensign.ch`).

### API key storage

The Helius key is stored as a Cloudflare Worker secret, set via:

```bash
wrangler secret put HELIUS_API_KEY
```

It is never in the codebase, never in `wrangler.toml`, never in git.
The worker accesses it at runtime via `env.HELIUS_API_KEY`.

### Rate limiting

Not yet implemented in the worker code. Options:

- **Cloudflare dashboard** — add a rate limiting rule at the zone level.
- **Workers code** — use the `request.headers.get('cf-connecting-ip')` +
  in-memory counter (resets per isolate, so not globally consistent).
- **Cloudflare Rate Limiting API** — for precise global limits.

For a hackathon/MVP, the Helius free tier's own rate limit (10 req/s)
provides a natural ceiling.


## 5. Request lifecycle (detailed)

```
Browser (app.js)
  │
  │ 1. solanaWeb3.Connection calls getLatestBlockhash
  │    POST /rpc?network=mainnet
  │    Body: {"jsonrpc":"2.0","id":1,"method":"getLatestBlockhash","params":[...]}
  │
  ▼
Cloudflare Edge (nearest PoP)
  │
  │ 2. Worker fetch() handler runs
  │    ├─ OPTIONS? → 204 with CORS headers
  │    ├─ path === '/rpc'? → handleRpc()
  │    │   ├─ POST? (else 405)
  │    │   ├─ env.HELIUS_API_KEY set? (else 500)
  │    │   ├─ Parse JSON body (else 400)
  │    │   ├─ Every method in ALLOWED_METHODS? (else 403)
  │    │   ├─ network param → pick Helius URL
  │    │   └─ fetch(heliusUrl, { body }) → stream response back
  │    ├─ path === '/pain001'? → 501 stub
  │    ├─ path === '/camt053'? → 501 stub
  │    ├─ path === '/camt054'? → 501 stub
  │    └─ else → 404
  │
  ▼
Helius RPC
  │
  │ 3. Standard Solana JSON-RPC response
  │    {"jsonrpc":"2.0","id":1,"result":{...}}
  │
  ▼
Browser receives response (transparent to solanaWeb3.Connection)
```


## 6. File structure

```
alpensign-worker/
├── src/
│   └── index.mjs       # The worker (single file, ~130 lines)
├── wrangler.toml        # Cloudflare config (name, entrypoint, KV binding stub)
├── package.json         # Only devDependency: wrangler
├── PROJECT_KNOWLEDGE.md # This file
└── .gitignore           # (recommended: node_modules/, .dev.vars)
```

No build step. No bundler. No runtime dependencies.


## 7. Local development

```bash
npm install                       # install wrangler
cp .dev.vars.example .dev.vars    # local secrets (not committed)
# Edit .dev.vars → HELIUS_API_KEY=your-real-key
npm run dev                       # wrangler dev → localhost:8787
```

`.dev.vars` is the local equivalent of `wrangler secret`. Create it with:

```
HELIUS_API_KEY=your-key-here
```

Test with curl:

```bash
curl -X POST http://localhost:8787/rpc?network=devnet \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getSlot","params":[]}'
```


## 8. Deployment

```bash
wrangler secret put HELIUS_API_KEY    # one-time (or after rotation)
npm run deploy                        # wrangler deploy
```

Output: `https://alpensign-rpc.<account>.workers.dev`

Optional: add a custom domain via Cloudflare dashboard
(e.g., `rpc.alpensign.ch`) for cleaner URLs and same-origin access
without CORS.


## 9. Future: ISO 20022 endpoints

Three routes are stubbed (return 501) for later implementation:

| Route | Method | Purpose | Notes |
|---|---|---|---|
| `/pain001` | POST | Accept pain.001 XML (payment initiation) | Parse XML, extract IBAN + amount, create Solana tx |
| `/camt053` | GET | Return camt.053 XML (bank-to-customer statement) | Query Solana for confirmed txs, format as ISO 20022 |
| `/camt054` | GET | Return camt.054 XML (bank-to-customer notification) | Real-time tx notifications, possibly webhook-driven |

When implementing these, the worker will likely need:

- **Workers KV** — store submitted pain.001 messages and generated reports.
  The binding is already stubbed in `wrangler.toml` (commented out).
- **XML parsing** — lightweight, no library needed for pain.001 (small,
  predictable schema). Could use regex or a minimal SAX parser.
- **Authentication** — these endpoints handle financial data and will need
  API key or mTLS auth, unlike the public `/rpc` proxy.

These ISO 20022 endpoints serve the Gbits/isochain project and bridge
Solana stablecoin transactions into standard Swiss banking message formats
(compatible with Bexio, SAP, Abacus, etc.).


## 10. Design decisions

| Decision | Rationale |
|---|---|
| Cloudflare Workers over Netlify Functions | Lower latency (edge vs region), generous free tier (100k req/day), Workers KV for future state, simpler deploy |
| Single file, no framework | Matches the zero-dependency philosophy of AlpenSign itself. Auditability. |
| Method whitelist (not blocklist) | Explicit security: only known-safe methods pass through. New methods require a conscious code change. |
| Response streaming (`upstream.body`) | Avoids buffering the full Helius response in worker memory. Lower TTFB for the browser. |
| No bundler/build step | `wrangler` handles ESM natively. One fewer tool in the chain. |
| Shared worker for multiple projects | One Helius key, one deployment, one billing account. AlpenSign and Gbits both point here. |


## 11. Updating this document

When making changes to the worker, update this document to reflect:

- New routes or removed routes
- Changes to the method whitelist
- New environment variables or secrets
- New KV bindings or other Cloudflare resources
- Integration changes in consuming projects
- Security model changes (auth, rate limiting, CORS)
