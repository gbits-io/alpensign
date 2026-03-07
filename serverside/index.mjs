// ============================================================
// AlpenSign RPC Proxy — Cloudflare Worker
// Relays Solana JSON-RPC requests to Helius, keeping the
// API key server-side (env var HELIUS_API_KEY).
//
// Routes:
//   POST /rpc?network=mainnet   → JSON-RPC proxy
//   POST /rpc?network=devnet    → JSON-RPC proxy
//
// Future (stubbed):
//   POST /pain001               → accept pain.001 XML
//   GET  /camt053?...           → return camt.053 XML
//   GET  /camt054?...           → return camt.054 XML
// ============================================================

const ALLOWED_METHODS = new Set([
  'getBalance',
  'getLatestBlockhash',
  'getTokenAccountsByOwner',
  'getAccountInfo',
  'sendTransaction',
  'getSignatureStatuses',
  'getTransaction',
  'getSlot',
  'getBlockHeight',
]);

// ---- CORS helpers ----

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',        // tighten in production
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// ---- Route: JSON-RPC proxy ----

async function handleRpc(request, env) {
  if (request.method !== 'POST') {
    return json({ error: 'POST required for JSON-RPC' }, 405);
  }

  const key = env.HELIUS_API_KEY;
  if (!key) {
    return json({ error: 'HELIUS_API_KEY not configured' }, 500);
  }

  // Parse body
  let rpcBody;
  try {
    rpcBody = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  // Whitelist check (supports batched requests)
  const requests = Array.isArray(rpcBody) ? rpcBody : [rpcBody];
  for (const req of requests) {
    if (!ALLOWED_METHODS.has(req.method)) {
      return json({ error: `Method not allowed: ${req.method}` }, 403);
    }
  }

  // Pick network
  const url = new URL(request.url);
  const network = url.searchParams.get('network') || 'mainnet';
  const heliusUrl = network === 'devnet'
    ? `https://devnet.helius-rpc.com/?api-key=${key}`
    : `https://mainnet.helius-rpc.com/?api-key=${key}`;

  // Relay
  try {
    const upstream = await fetch(heliusUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rpcBody),
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return json({ error: `Upstream error: ${err.message}` }, 502);
  }
}

// ---- Route: ISO 20022 stubs ----

function handlePain001(request) {
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405);
  return json({ error: 'pain.001 ingestion not yet implemented' }, 501);
}

function handleCamt053(request) {
  if (request.method !== 'GET') return json({ error: 'GET required' }, 405);
  return json({ error: 'camt.053 delivery not yet implemented' }, 501);
}

function handleCamt054(request) {
  if (request.method !== 'GET') return json({ error: 'GET required' }, 405);
  return json({ error: 'camt.054 delivery not yet implemented' }, 501);
}

// ---- Main router ----

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/rpc')     return handleRpc(request, env);
    if (path === '/pain001') return handlePain001(request);
    if (path === '/camt053') return handleCamt053(request);
    if (path === '/camt054') return handleCamt054(request);

    return json({ error: 'Not found', routes: ['/rpc', '/pain001', '/camt053', '/camt054'] }, 404);
  },
};
