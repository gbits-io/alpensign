# AlpenSign RPC Proxy (Cloudflare Worker)

Single-file Cloudflare Worker that proxies Solana JSON-RPC to Helius.
The API key stays server-side — never exposed in browser code.

```
Browser (app.js)  →  POST /rpc?network=mainnet  →  Helius RPC
                                                    (key injected server-side)
```

## Structure

```
├── src/index.mjs     # The worker (~100 lines)
├── wrangler.toml     # Cloudflare config
└── package.json
```

## Setup

```bash
npm install
wrangler login                              # one-time
wrangler secret put HELIUS_API_KEY          # paste your key when prompted
```

## Dev & Deploy

```bash
npm run dev         # local dev on localhost:8787
npm run deploy      # deploy to Cloudflare edge
```

After deploy you get a URL like `https://alpensign-rpc.<you>.workers.dev`.

## Integration with app.js

Point your RPC URLs at the worker:

```javascript
// If worker is on the same domain (custom domain or Pages + Worker):
const RPC_PROXY = '/rpc';

// Or if using the workers.dev subdomain:
// const RPC_PROXY = 'https://alpensign-rpc.<you>.workers.dev/rpc';

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

`solanaWeb3.Connection` works with any JSON-RPC URL — drop-in replacement.
Same for `sgtRpcCall()`: point the fetch at the proxy with `?network=mainnet`.

You can delete `config.js` / `config.example.js` entirely.

## Security

- **Method whitelist** — only approved JSON-RPC methods are forwarded
- **Cloudflare rate limiting** — add via dashboard or `wrangler.toml` for production
- **CORS** — currently `*`, tighten to your domain before going live

## Reuse for Gbits / isochain

Same worker handles any project that needs Helius RPC. Just point
`defi_camt.html` at the same `/rpc` endpoint.

## Future: ISO 20022 endpoints

| Route | Method | Purpose |
|---|---|---|
| `/pain001` | POST | Accept pain.001 payment initiation XML |
| `/camt053` | GET | Deliver camt.053 bank-to-customer statement |
| `/camt054` | GET | Deliver camt.054 bank-to-customer notification |

Currently return 501. When ready, uncomment the KV binding in
`wrangler.toml` to use Workers KV for message storage.
