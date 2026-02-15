# AlpenSign — Project Knowledge Base

> This document captures the complete accumulated context from 8 development sessions (Feb 11–15, 2026) building AlpenSign for the Solana Seeker Hackathon Monolith. It is intended to be added to a Claude Project so that new conversations can continue without re-explaining the project.

**Last updated:** 2026-02-15, end of session 8 (v0.5.5)

---

## 1. What is AlpenSign?

AlpenSign is a transaction sealing solution for banks built on the Solana Seeker phone. It turns the Seeker's secure element (Seed Vault) and the Solana blockchain into an independent second-channel authorization layer for bank payments.

**Core thesis:** When a bank client authorizes a payment, the Seeker phone independently seals the transaction with a biometric-confirmed, hardware-signed cryptographic proof and posts it to Solana. This creates immutable evidence that is NOT controlled by the bank — structurally stronger than self-serving server logs in disputes and fraud cases.

**Built for:** Solana Seeker Hackathon Monolith, Q1 2026.

**Team:**
- **Roman** — Founder, Product Management, Development (Koivu GmbH, Zürich)
- **Alexandr** — Engineering, native Android app
- **Claude + Gemini** — AI engineering partners

**Repos & Links:**
- App: https://alpensign.com/app.html
- Landing page: https://alpensign.com/
- GitHub: https://github.com/gbits-io/alpensign/
- llms.txt: https://alpensign.com/llms.txt

---

## 2. Three-Layer Trust Model

| Layer | What it proves | Current status |
|-------|---------------|----------------|
| 1. Genesis Token (Device Identity) | The Seeker is genuine hardware, verified by SKR-staked Guardians via TEEPIN | **Simulated** — should query DAS API for real NFT |
| 2. Bank Credential (Client Identity) | The bank has bound this client to this verified device via SAS attestation | **Simulated** — requires bank cooperation |
| 3. Transaction Seal (Payment Authorization) | The client biometrically confirmed this specific payment, signed by Seed Vault, posted to Solana | **Real and working** on devnet |

---

## 3. Current App Architecture (v0.5.5)

### Stack

| Component | Source | Notes |
|-----------|--------|-------|
| Frontend | Vanilla HTML/JS, no framework | Single-page app: `app.html` + `app.js`, no build tools |
| Solana web3.js | unpkg IIFE `@1.98.0` | Global `solanaWeb3` object |
| MWA protocol | esm.sh ESM `@2.2.5` | Preloaded to `window.__mwaTransact` via `<script type="module">` |
| WebAuthn | Browser native | Platform authenticator (Seeker secure element) |
| Solana RPC | `api.devnet.solana.com` | Blockhash, balance, confirmation |
| Hosting | HTTPS required for MWA | alpensign.com via GitHub Pages |

### App Views

- **Welcome** — First-time intro with payment types and device capabilities
- **Enrollment** — 3-step flow: Initialize Vault (WebAuthn) → Connect Seed Vault (MWA) → Bank Confirmation (simulated)
- **Home** — Enrolled state, simulate signing request, recent seals
- **Seal** — Payment details review → biometric sign → Solana posting → Explorer link
- **History** — Expanded seal cards with timestamp, hash, IBAN, reference, Explorer link, device type
- **Settings** — Device info, wallet status, credential ID, reconnect wallet, reset
- **About** — Trust model explanation, security note about PIN vs fingerprint, links

### State Schema

```javascript
localStorage.alpensign_state = {
  enrolled: boolean,
  credId: string,           // base64 WebAuthn credential ID
  walletAddr: string,       // base58 Seed Vault wallet address
  mwaAuthToken: string,     // MWA reauthorization token
  mwaWalletUriBase: string, // custom wallet URI
  seals: [{
    recipient, town, country, amount, iban, ref,
    hash,          // SHA-256 of payment details
    signature,     // WebAuthn ECDSA signature (base64, truncated)
    solanaTx,      // Solana TX signature (base58)
    solanaTxReal,  // boolean: true if posted on-chain
    deviceType,    // SOLANA_SEEKER | GENERIC_ANDROID | IOS | DESKTOP
    timestamp
  }],
  welcomeSeen: boolean
}
```

### What's Real vs Simulated

**Real (on Seeker):**
- WebAuthn credential in platform authenticator
- Biometric-gated ECDSA signature over payment SHA-256 hash
- MWA authorization with Seed Vault hardware
- Real Solana wallet address from Seed Vault
- Memo transaction signed by Seed Vault private key
- Transaction posted to Solana devnet
- Explorer link to real on-chain transaction

**Simulated:**
- Genesis Token verification (should query DAS API — roadmap item 0b)
- SAS credential issuance by bank
- Client NFT minting
- Bank confirmation flow
- Payment request delivery (uses "Simulate" button with hardcoded sample payments)

---

## 4. MWA Integration — Critical Knowledge

> This is the most hard-won knowledge from the project. These issues caused days of debugging and are poorly documented in the MWA ecosystem.

### Seven Critical Constraints

| # | Constraint | What Happens If Violated |
|---|---|---|
| 1 | Use `chain: 'solana:devnet'`, NOT `cluster` in `authorize()` | Silent 30s timeout, no Seed Vault UI appears |
| 2 | `identity.icon` must be a relative URI (e.g., `'./images/logo.png'`) | Error `-32602`, authorization rejected |
| 3 | `transact()` must fire synchronously from a click handler — no `await` before it | Chrome blocks `solana-wallet://` Intent, MWA never launches |
| 4 | No network calls (RPC) inside MWA `transact()` callback | RPC calls fail/timeout while Chrome is backgrounded for wallet Intent |
| 5 | `signAndSendTransactions()` returns `{ signatures: [Uint8Array] }`, not a plain array | Crash on signature decoding |
| 6 | Seed Vault suppresses biometric UI during screen recording, overlays, battery saver | Silent authorization failure, no error |
| 7 | Multi-step flows need a fresh user gesture per MWA `transact()` call | Chrome blocks the Intent for the second MWA call |

### Loading MWA in Vanilla JS (No Bundler)

```html
<script type="module">
const CDN_SOURCES = [
  'https://esm.sh/@solana-mobile/mobile-wallet-adapter-protocol@2.2.5',
  'https://cdn.jsdelivr.net/npm/@solana-mobile/mobile-wallet-adapter-protocol@2.2.5/+esm',
  'https://esm.run/@solana-mobile/mobile-wallet-adapter-protocol@2.2.5',
];
for (const src of CDN_SOURCES) {
  try {
    const mod = await import(src);
    if (mod && typeof mod.transact === 'function') {
      window.__mwaTransact = mod.transact;
      window.dispatchEvent(new Event('mwa-ready'));
      break;
    }
  } catch (e) { /* try next CDN */ }
}
</script>
```

App code reads `window.__mwaTransact` synchronously from click handlers.

### Seal Flow Pattern (Correct)

```javascript
// 1. BEFORE transact: fetch blockhash, build TX
const { blockhash } = await connection.getLatestBlockhash('confirmed');
const tx = new Transaction({ recentBlockhash: blockhash, feePayer }).add(memoIx);
const txBase64 = btoa(String.fromCharCode(...tx.serialize({ requireAllSignatures: false })));

// 2. Fresh user gesture (dedicated tap target for step 4)
tapTarget.addEventListener('click', () => {
  // 3. INSIDE transact: only authorize + sign (no network calls)
  transactFn(async (wallet) => {
    await wallet.authorize({ chain: 'solana:devnet', identity: APP_IDENTITY });
    return await wallet.signAndSendTransactions({ payloads: [txBase64] });
  })
  .then(result => { /* extract signature from result.signatures[0] */ })
  .catch(err => { /* handle */ });
});
```

### Seed Vault Behavior Notes

- Seed Vault often requests **PIN instead of fingerprint** for Solana transaction signing. This is controlled by the wallet app (Solflare), not by AlpenSign. No MWA parameter to force fingerprint.
- During Android screen recording, Seed Vault PIN/biometric screens appear **black**. This is a security feature (hardware isolation). The recording still works — the black frames prove the secure element is protecting the interaction.
- Battery saver mode kills WebSocket connections — MWA sessions will fail. Must be OFF.

---

## 5. Version History

| Version | Key Changes |
|---------|-------------|
| v0.1–v0.2 | Basic app shell, WebAuthn enrollment, device detection |
| v0.3.1 | Seeker device detection via Client Hints API, Solana memo transactions |
| v0.5.0 | Removed browser keypair, added MWA for Seed Vault signing |
| v0.5.1 | Fixed user gesture expiry (synchronous `transact()` from click) |
| v0.5.2 | Fixed `chain` vs `cluster`, attempted absolute icon URL (wrong) |
| v0.5.3 | Reverted icon to relative URI, moved blockhash fetch outside MWA session |
| v0.5.4 | Robust signature format handling (Uint8Array, ArrayBuffer, base64, base58) |
| v0.5.5 | Enhanced History (timestamp, hash, IBAN, Explorer link), About page, splash screen with mountain logo, auto-dismiss device banner (5s), signing request notification stays until tapped |

---

## 6. Key Files

| File | Purpose | Location |
|------|---------|----------|
| `app.html` | Main app shell (HTML + CSS) | alpensign.com/app.html |
| `app.js` | App logic (enrollment, sealing, MWA, state) | alpensign.com/app.js |
| `mwa-debug.html` | Standalone MWA diagnostic tool | alpensign.com/mwa-debug.html |
| `index.html` | Landing page | alpensign.com/ |
| `llms.txt` | Machine-readable project description | alpensign.com/llms.txt |
| `MWA_INTEGRATION_LEARNINGS.md` | MWA debugging postmortem | GitHub repo |
| `DEMO_SCRIPT.md` | 45-second demo video shot list | GitHub repo |
| `AlpenSign_Extension_Roadmap.md` | Full roadmap (14 sections) | GitHub repo |
| `alpensign_logo_black_snow.png` | Mountain logo (splash screen) | images/ |
| `alpensign_logo_small_dark.png` | Small logo (header, welcome, about) | images/ |

---

## 7. Known Issues & Pending Work

### P0 — Before Hackathon Submission

- [ ] **Memo privacy fix** — Currently posts readable JSON to Solana memo. Must post only SHA-256 hash. Tiny change in `app.js` seal step 4.
- [ ] **Genesis Token verification** — Query Helius DAS API during enrollment to check for real Genesis Token NFT on connected wallet. Currently simulated.
- [ ] **dApp Store submission** — PWA→TWA→APK via Bubblewrap. Needs manifest.json, service worker, signing key, Digital Asset Links, store assets (512px icon, 1200×600 banner, screenshots).
- [ ] **Demo video** — 45s screen recording on Seeker. Script in DEMO_SCRIPT.md.
- [ ] **Fresh screenshots** — Current landing page screenshots show old UI.

### P1 — Near-term

- [ ] Bank simulator (completes the demo story — both ends of the flow)
- [ ] Demo airline booking app ("AlpenAir")
- [ ] SAS attestation migration (with ISO 20022 schema alignment)
- [ ] MWA reauthorization token caching
- [ ] On-chain seal verification button in History
- [ ] Pitch deck (8–10 slides)
- [ ] Hackathon adaptations for StableHack, SwissHacks

### P2 — Medium-term

- [ ] Native Android app (Alexandr)
- [ ] AlpenSign SDK for banks
- [ ] Securosys HSM integration (bank-side key management)
- [ ] Privacy enhancements (ZK proofs, wallet rotation, encrypted attestations)
- [ ] Credential recovery and multi-device enrollment
- [ ] Mainnet migration (after SAS + bank pilot)
- [ ] Real payment delivery (deep links, push notifications, QR)

### P3 — Long-term

- [ ] 3D Secure integration (via Netcetera ACS)
- [ ] Hardware wallet support (Ledger, Trezor)
- [ ] Colosseum hackathon submission

---

## 8. Go-to-Market Partners (Swiss Ecosystem)

| Partner | Role | Integration Point |
|---------|------|-------------------|
| **Securosys** | HSM manufacturer | Bank-side key management (Primus Blockchain HSM, CloudHSM) |
| **Netcetera** | 3DS ACS provider | AlpenSign as 3DS challenge method |
| **Ergon / Airlock** | API security gateway | AlpenSign module for bank API layer |
| **Viseca** | Card issuer + "one" app | AlpenSign seals for card transaction disputes |

---

## 9. Technical Decisions & Rationale

**Why vanilla JS (no React/framework)?**
- Single-file deployment, no build tools, works on any CDN
- MWA ESM module loading is simpler without bundler conflicts
- The app is small enough that a framework adds complexity without benefit

**Why Memo transactions (not SAS yet)?**
- SAS JavaScript SDK integration requires more time
- Memo program is well-understood and works today
- Migration to SAS is on the roadmap once the demo is stable

**Why PWA→TWA for dApp Store (not native)?**
- Single codebase (web = dApp Store = any browser)
- Alexandr's native app isn't ready yet
- Bubblewrap makes the conversion quick
- TWA gets full-screen native-like experience

**Why devnet (not mainnet)?**
- Free transactions for development
- Genesis Token lives on mainnet (need mainnet RPC for that check)
- Mainnet migration only after SAS + bank pilot

**Why WebAuthn + MWA (two auth steps)?**
- WebAuthn creates a device-bound credential with biometric gate
- MWA connects to Seed Vault for Solana transaction signing
- They serve different purposes: WebAuthn = client identity proof, MWA = on-chain posting
- Both use the Seeker's secure element but through different paths

---

## 10. Debugging Checklist (When MWA Breaks)

If MWA connection hangs or fails on Seeker:

1. HTTPS? (`location.protocol === 'https:'`)
2. Chrome Android? (not Firefox, not WebView)
3. Battery saver OFF?
4. No screen overlays? (no recording, no "draw over apps", no chat bubbles)
5. MWA module loaded? (`typeof window.__mwaTransact === 'function'`)
6. `transact()` from user gesture? (no `await` before the call)
7. `chain` not `cluster`? (in all `authorize()` calls)
8. `icon` is relative? (not absolute URL)
9. No RPC calls inside `transact()` callback?
10. Handle all signature formats? (Uint8Array, ArrayBuffer, base64, base58)

Diagnostic tool: `alpensign.com/mwa-debug.html` — tests each layer independently.

---

## 11. Session History

| # | Date | Focus | Key Outcomes |
|---|------|-------|-------------|
| 1 | Feb 11 | Architecture | Full system design, SAS schemas, stakeholder analysis, licensing |
| 2 | Feb 12 | Landing page | Mobile-responsive design, screenshots, typography |
| 3 | Feb 13 (a) | Landing page | Light theme, flow diagrams |
| 4 | Feb 13 (b) | Landing page + architecture | Favicon, llms.txt, regulatory sections, deployment model |
| 5 | Feb 14 (a) | App v0.1–v0.2 | Multi-view prototype, WebAuthn, device detection |
| 6 | Feb 14 (b) | App v0.3.1 | Seeker detection (Client Hints), Solana memo fix |
| 7 | Feb 14 (c) | App v0.5.0 | MWA integration, HTTPS debugging, connection hang diagnosis |
| 8 | Feb 15 | App v0.5.0–v0.5.5 | Three MWA bugs fixed (chain/cluster, icon URI, signature format), Chrome gesture workarounds, learnings doc, History enhancement, About page, splash screen, roadmap extensions, dApp Store plan, GTM strategy, Gemini review analysis |

**Full transcripts:** Available in `/mnt/transcripts/` (3.4MB total across 8 files). Refer to specific transcripts for detailed code changes and debugging sequences.
