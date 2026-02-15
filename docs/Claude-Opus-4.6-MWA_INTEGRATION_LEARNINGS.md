# AlpenSign — MWA Integration Learnings

**Date:** 2026-02-15  
**Version:** v0.5.0 → v0.5.4  
**Device:** Solana Seeker (Android 15, Chrome)  
**Stack:** Vanilla HTML/JS, no React, no build tools, HTTPS  
**Library:** `@solana-mobile/mobile-wallet-adapter-protocol@2.2.5` via ESM

---

## Context

AlpenSign is a transaction sealing app for banks, built for the Solana Seeker Hackathon. It uses the Seeker's hardware Seed Vault to sign and post memo transactions to Solana devnet. The app runs as a progressive web app in Chrome on Android — not as a native app or React Native project.

This document captures everything we learned while debugging the Mobile Wallet Adapter (MWA) integration from a pure web context. Most MWA documentation and examples assume React Native or native Android. Running MWA from a vanilla web page on Chrome Android surfaced several undocumented or poorly documented issues.

---

## The Three Bugs (in order of discovery)

### Bug 1: `cluster` vs `chain` parameter

**Symptom:** `transact()` established a WebSocket session successfully, but `authorize()` hung for 30 seconds and returned `ERROR_SESSION_TIMEOUT`. No Seed Vault UI appeared.

**Root cause:** The MWA v2 spec uses `chain` as the primary parameter for specifying the Solana cluster. The `cluster` parameter is a backwards-compatibility alias. The Seed Vault Wallet (built by Solflare) silently rejected the authorization request when `cluster` was used instead of `chain`.

**Fix:**
```javascript
// WRONG — causes silent timeout
await wallet.authorize({
  cluster: 'solana:devnet',  
  identity: APP_IDENTITY,
});

// CORRECT
await wallet.authorize({
  chain: 'solana:devnet',
  identity: APP_IDENTITY,
});
```

**Why it was hard to find:** The `getCapabilities()` non-privileged call worked fine with both parameters. Only the privileged `authorize()` call failed, and it failed silently (timeout, no error message). The MWA protocol library source code and most documentation examples use `cluster`. The CAIP-2 format (`solana:devnet`) was correct — the parameter *name* was the issue.

**Lesson:** Always use `chain`, not `cluster`, for MWA v2.x authorize calls. If authorize silently times out but getCapabilities works, check the parameter name first.

---

### Bug 2: `identity.icon` must be a relative URI

**Symptom:** After fixing Bug 1, `authorize()` returned immediately with error code `-32602` and message: *"When specified, identity.icon must be a relative URI"*.

**Root cause:** We tried resolving the icon to an absolute URL (`https://alpensign.com/images/...`) per Gemini's suggestion. The MWA spec explicitly requires `identity.icon` to be a relative path resolved against `identity.uri`.

**Fix:**
```javascript
// WRONG — wallet rejects with -32602
const APP_IDENTITY = {
  name: 'AlpenSign',
  uri: window.location.origin,
  icon: new URL('./images/logo.png', window.location.href).href,
};

// CORRECT — relative path, resolved by wallet against uri
const APP_IDENTITY = {
  name: 'AlpenSign',
  uri: window.location.origin,
  icon: './images/alpensign_logo_small_dark.png',
};
```

**Lesson:** The MWA spec means what it says — `icon` is relative to `uri`. The wallet fetches the icon itself by combining the two. Do not resolve it to an absolute URL.

---

### Bug 3: Signature format from `signAndSendTransactions`

**Symptom:** Transaction was signed and posted to Solana successfully, but the app crashed with: *"Failed to execute 'atob' on 'Window': The string to be decoded is not correctly encoded."*

**Root cause:** `signAndSendTransactions()` returns `{ signatures: [Uint8Array] }`, not a plain array of base64 strings. Our code did `result[0]` (which returned `undefined` from an object), then tried `atob(undefined)`.

**Fix:**
```javascript
// Extract signature from whatever format MWA returns
let sigRaw;
if (result && result.signatures) {
  sigRaw = result.signatures[0];       // { signatures: [...] }
} else if (Array.isArray(result)) {
  sigRaw = result[0];                  // [...]
} else {
  sigRaw = result;                     // direct value
}

// Convert to bytes based on type
let sigBytes;
if (sigRaw instanceof Uint8Array) {
  sigBytes = sigRaw;
} else if (ArrayBuffer.isView(sigRaw) || sigRaw instanceof ArrayBuffer) {
  sigBytes = new Uint8Array(sigRaw.buffer || sigRaw);
} else if (typeof sigRaw === 'string') {
  try {
    sigBytes = Uint8Array.from(atob(sigRaw), c => c.charCodeAt(0));
  } catch (e) {
    // Likely already base58 — use as-is
    return sigRaw;
  }
}

const txSignature = base58encode(sigBytes);
```

**Lesson:** Never assume the return type from MWA methods. The TypeScript types say one thing, the runtime returns another. Always log `typeof` and handle Uint8Array, ArrayBuffer, base64 string, and base58 string.

---

## Chrome Android User Gesture Policy

Chrome on Android blocks navigation to custom URI schemes (`solana-wallet://...`) unless the navigation originates from an explicit user gesture (click, tap). The MWA `transact()` function dispatches an Android Intent via this scheme.

**Rule:** `transact()` must be called synchronously from a click handler. Any `await` before it — even a fast one — can cause Chrome to consider the gesture expired and silently block the Intent.

```javascript
// WRONG — gesture expires after await
button.addEventListener('click', async () => {
  await loadMWA();           // ← gesture dead after this
  transact(async (wallet) => { ... });  // ← Intent blocked
});

// CORRECT — transact() fires immediately
button.addEventListener('click', () => {   // NOT async
  const transactFn = window.__mwaTransact;
  if (!transactFn) { /* show error */ return; }
  
  transactFn(async (wallet) => { ... });   // ← Intent dispatched
});
```

**For multi-step flows (like sealing):** If the user clicks "Seal" and the app does WebAuthn + hashing before needing MWA, the original gesture is long gone by step 4. Solution: add a **second tap target** at step 4 that provides a fresh user gesture for the MWA Intent.

---

## Network Calls Inside MWA Sessions

When `transact()` fires, Chrome backgrounds the page to let the wallet handle the Intent. While backgrounded, network requests (like `getLatestBlockhash()`) may be throttled or fail.

**Rule:** Do all RPC calls (blockhash, balance checks, etc.) *before* entering the MWA session. Build and serialize the transaction while the page is in the foreground. Pass the pre-built base64 payload into the `transact()` callback.

```javascript
// Fetch blockhash BEFORE opening wallet session
const { blockhash } = await connection.getLatestBlockhash('confirmed');
const tx = new Transaction({ recentBlockhash: blockhash, feePayer }).add(instruction);
const txBase64 = btoa(String.fromCharCode(...tx.serialize({ requireAllSignatures: false })));

// Now open wallet — only authorize + sign, no network calls
transactFn(async (wallet) => {
  await wallet.authorize({ chain: 'solana:devnet', identity: APP_IDENTITY });
  return await wallet.signAndSendTransactions({ payloads: [txBase64] });
});
```

---

## Loading MWA in a Non-React Web App

The MWA protocol library is an ESM package with no IIFE build. For vanilla JS without a bundler:

1. **Preload in HTML `<script type="module">`** — more reliable than dynamic `import()` in JS
2. **Try multiple CDNs** — esm.sh, jsdelivr, esm.run (esm.sh worked for us)
3. **Store on `window`** — the module scope can't share with regular `<script>` tags directly

```html
<script type="module">
const mod = await import('https://esm.sh/@solana-mobile/mobile-wallet-adapter-protocol@2.2.5');
window.__mwaTransact = mod.transact;
window.dispatchEvent(new Event('mwa-ready'));
</script>
```

The regular app script then reads `window.__mwaTransact` synchronously from click handlers.

---

## Seed Vault Security Behaviors

The Seed Vault Wallet will silently suppress its biometric approval UI if it detects potential tapjacking or screen observation:

- **Screen recording / casting / mirroring** — biometric prompt won't appear
- **"Display over other apps" overlays** — chat bubbles, blue light filters, floating widgets
- **Android battery saver mode** — Chrome pauses backgrounded pages, killing the WebSocket before the wallet can connect (known issue: [GitHub #335](https://github.com/solana-mobile/mobile-wallet-adapter/issues/335))

If the wallet connects (screen darkens) but no approval UI appears, check these environmental factors before debugging code.

---

## Debugging Checklist

For future MWA issues, check in this order:

| # | Check | How |
|---|-------|-----|
| 1 | HTTPS | `location.protocol === 'https:'` |
| 2 | Chrome Android | User agent check |
| 3 | Battery saver OFF | Settings → Battery |
| 4 | No screen overlays | No recording, no "draw over apps" |
| 5 | MWA module loaded | `typeof window.__mwaTransact === 'function'` |
| 6 | `transact()` from user gesture | No `await` before `transact()` call |
| 7 | `chain` not `cluster` | In all `authorize()` calls |
| 8 | `icon` is relative | Not an absolute URL |
| 9 | No RPC calls inside session | Build TX before `transact()` |
| 10 | Handle all signature formats | Uint8Array, ArrayBuffer, base64, base58 |

---

## Diagnostic Tool

`mwa-debug.html` is a standalone diagnostic page that tests each MWA layer independently:

1. **Environment checks** — HTTPS, Chrome, WebSocket, battery, injected providers
2. **MWA module load** — tests CDN import, lists exported functions
3. **Manual Intent test** — fires `solana-wallet://` directly
4. **WebSocket test** — verifies localhost WS works
5. **Bare `transact()` test** — session + `getCapabilities()` only (no authorize)
6. **Full connection test** — `transact()` + `authorize()` end-to-end

Deploy alongside the app for field debugging. The bare `transact()` test isolating session establishment from authorization was key to identifying Bug 1.

---

## Architecture Notes

### What's Real (on Seeker with connected wallet)

- WebAuthn credential in platform authenticator (biometric-gated ECDSA)
- Biometric signature over payment hash (SHA-256)
- MWA authorization with Seed Vault hardware
- Real Solana wallet address from Seed Vault
- Memo transaction signed by Seed Vault private key
- Transaction posted to Solana devnet
- Explorer link to real on-chain transaction

### What's Simulated

- Genesis Token verification during enrollment
- SAS credential issuance by bank
- Client NFT minting
- Bank confirmation flow

### Key Dependencies

| Component | Source | Notes |
|-----------|--------|-------|
| Solana web3.js | unpkg IIFE `@1.98.0` | Global `solanaWeb3` object |
| MWA protocol | esm.sh ESM `@2.2.5` | Preloaded to `window.__mwaTransact` |
| WebAuthn | Browser native | Platform authenticator (Seeker secure element) |
| Solana RPC | `api.devnet.solana.com` | Read-only: blockhash, balance, confirmation |

### State Schema

```javascript
localStorage.alpensign_state = {
  enrolled: boolean,
  credId: string,           // base64 WebAuthn credential ID
  walletAddr: string,       // base58 Seed Vault wallet address
  mwaAuthToken: string,     // MWA reauthorization token
  mwaWalletUriBase: string, // custom wallet URI for faster reconnection
  seals: [{
    recipient, town, country, amount, iban, ref,
    hash, signature, solanaTx, solanaTxReal,
    deviceType, timestamp
  }],
  welcomeSeen: boolean
}
```

---

## What Worked Well

- **Vanilla JS + ESM import** — no build tools needed, works on Seeker Chrome
- **Incremental diagnostic page** — testing each MWA layer independently was the fastest path to root cause
- **Preloading MWA module in HTML** — avoids dynamic import timing issues
- **Separate tap for step 4** — cleanly solves the user gesture requirement for multi-step flows

## What We'd Do Differently

- Start with `chain` not `cluster` from day one — read the MWA 2.0 spec, not just npm README examples
- Build a diagnostic page *before* integrating MWA into the app — would have saved hours
- Log everything: `typeof`, raw values, timing — MWA errors are silent by default
- Test on the actual Seeker from the first commit — emulators don't have Seed Vault
