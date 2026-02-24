# AlpenSign — Project Knowledge Base

> This document captures the complete accumulated context from 9 development sessions (Feb 11–24, 2026) building AlpenSign for the Solana Seeker Hackathon Monolith. It is intended to be added to a Claude Project so that new conversations can continue without re-explaining the project.

**Last updated:** 2026-02-24, end of session 9 (v0.6.0)

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
- Bank Simulator: https://alpensign.com/bank-simulator.html
- Landing page: https://alpensign.com/
- GitHub: https://github.com/gbits-io/alpensign/
- llms.txt: https://alpensign.com/llms.txt

---

## 2. Three-Layer Trust Model

| Layer | What it proves | Current status |
|-------|---------------|----------------|
| 1. Genesis Token (Device Identity) | The Seeker is genuine hardware, verified by SKR-staked Guardians via TEEPIN | **Real (Tier 1)** — queries beeman's SGT API on mainnet during enrollment |
| 2. Bank Credential (Client Identity) | The bank has bound this client to this verified device via SAS attestation | **Simulated** — bank simulator issues mock SAS credential; real SAS requires bank cooperation |
| 3. Transaction Seal (Payment Authorization) | The client biometrically confirmed this specific payment, signed by Seed Vault, posted to Solana | **Real and working** on devnet |

---

## 3. Current App Architecture (v0.6.0)

### Stack

| Component | Source | Notes |
|-----------|--------|-------|
| Frontend | Vanilla HTML/JS, no framework | Single-page app: `app.html` + `app.js`, no build tools |
| Solana web3.js | unpkg IIFE `@1.98.0` | Global `solanaWeb3` object |
| MWA protocol | esm.sh ESM `@2.2.5` | Preloaded to `window.__mwaTransact` via `<script type="module">` |
| WebAuthn | Browser native | Platform authenticator (Seeker secure element) |
| Solana RPC | `api.devnet.solana.com` | Blockhash, balance, confirmation |
| Hosting | HTTPS required for MWA | alpensign.com via GitHub Pages |
| Bank Simulator | Standalone HTML | `bank-simulator.html`, communicates via BroadcastChannel |

### App Views

- **Welcome** — First-time intro with payment types and device capabilities
- **Enrollment** — 3-step flow: Initialize Vault (WebAuthn) → Connect Seed Vault (MWA) + Bank Pairing Challenge → Bank Confirmation (via BroadcastChannel or simulated)
- **Home** — Enrolled state, recent seals, Demo Controls card (hidden by default, see Demo Mode)
- **Seal** — Payment details review → biometric sign → Solana posting → Explorer link
- **History** — Expanded seal cards with timestamp, hash, IBAN, reference, Explorer link, device type
- **Settings** — Device info, wallet status, credential ID, reconnect wallet, Demo Mode toggle, reset
- **About** — Trust model explanation, security note about PIN vs fingerprint, links

### State Schema

```javascript
localStorage.alpensign_state = {
  enrolled: boolean,
  credId: string,           // base64 WebAuthn credential ID
  walletAddr: string,       // base58 Seed Vault wallet address
  mwaAuthToken: string,     // MWA reauthorization token
  mwaWalletUriBase: string, // custom wallet URI
  genesisVerified: boolean, // true if SGT ownership confirmed on mainnet
  genesisTokenMint: string, // SGT mint address (real on-chain data)
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

localStorage.alpensign_demo_mode = boolean  // separate key, defaults to false
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
- Genesis Token verification via beeman's SGT API (mainnet)
- Challenge signing for bank pairing (WebAuthn over bank challenge string)
- BroadcastChannel communication between AlpenSign and bank simulator

**Simulated:**
- SAS credential issuance by bank (bank simulator mocks the attestation)
- Client NFT minting
- Push notification delivery (BroadcastChannel substitutes for push/deep links)
- SIC settlement status in bank simulator

---

## 4. Bank Simulator

### Purpose

The bank simulator (`bank-simulator.html`) is a standalone web app that demonstrates the **bank side** of the AlpenSign flow. It completes the demo story by showing both ends: the banker originates a payment and sees it sealed, while the client on the Seeker reviews and authorizes it. This is critical for hackathon judges and bank innovation teams who need to see the full end-to-end experience.

### Design

- **Visual identity:** Dark navy + gold — traditional private banking aesthetic, instantly distinguishable from AlpenSign's green/dark tech look. This visual separation reinforces that these are independent systems.
- **Mobile-first:** Designed to work on phone screens for side-by-side demo.
- **Two tabs:** Pairing and SIC Payment.

### Pairing Tab Flow

1. Static bank/client data (contract KB-2026-004871, IBAN CH93...)
2. `.skr` input field (auto-appends .skr, validates format, maps to redpill.skr by default)
3. Simulated .skr → Solana address resolution, Genesis Token status, Guardian info, SKR stake
4. Challenge string generation (e.g., `BB123-A4F9C2E1`) — the client enters this in AlpenSign to prove device possession
5. Signature verification field — bank advisor pastes the signature from AlpenSign, or clicks "Skip: Simulate Verification" for faster demo
6. SAS attestation result card with full schema (alpensign:bank-credential:v1, issuer, contract, device, wallet, expiry, TX)
7. Revoke button (demonstrates SAS revocability)

### Payment Tab Flow

1. Realistic SIC CHF high-value payment form (ISO 20022 pacs.008 aligned)
2. Prefilled: CHF 2,450,000.00 to Müller Maschinenbau AG (industrial machinery payment)
3. "Submit to SIC" button → sends payment request to AlpenSign via BroadcastChannel
4. Shows payment held pending with "Waiting for AlpenSign seal" banner
5. When AlpenSign seals the payment, the bank simulator auto-updates: seal proof card appears (hash, device, auth method, Solana TX, timestamp) + Solana Explorer link
6. SIC settlement status: SETTLED + IRREVOCABLE

### BroadcastChannel Integration

The bank simulator and AlpenSign communicate via `BroadcastChannel('alpensign-bank-bridge')`. This is a browser-native API that works across tabs in the same browser with zero server infrastructure. It simulates what would be push notifications or deep links in production.

**Message types:**

```javascript
// Bank → AlpenSign
{ type: 'attestation-confirmed', contract, bank, seekerId, solanaAddress }
{ type: 'payment-request', requestId, payment: { creditor, iban, amount, reference, date, address, info } }

// AlpenSign → Bank
{ type: 'seal-complete', requestId, seal: { hash, signature, solanaTx, solanaTxReal, deviceType, timestamp, recipient, amount } }
```

**How it works in the demo:**
1. Open bank-simulator.html in tab 1, app.html in tab 2 (same browser)
2. **Pairing** (manual entry): Bank generates challenge → client types it into AlpenSign → signs with biometric → copies signature → pastes in bank portal (or skip to simulate) → bank verifies & issues attestation → AlpenSign auto-completes enrollment via BroadcastChannel `attestation-confirmed` message
3. **Payments** (automatic): Bank creates SIC payment → AlpenSign notification appears instantly → client taps, reviews, seals → bank tab auto-updates to "sealed" with full proof via BroadcastChannel `seal-complete` message

**Production migration:** BroadcastChannel is a demo convenience. In production, the bank would push payment requests via push notifications, deep links, or QR codes, and receive seal confirmations via webhook or Solana on-chain event subscription. See roadmap item: "Replace BroadcastChannel with real delivery channels."

---

## 5. Demo Mode Toggle

AlpenSign has a **Demo Mode** toggle in Settings that controls the visibility of standalone simulation controls. This was added because the bank simulator makes the built-in simulate buttons redundant and visually noisy.

- **Demo Mode OFF** (default): "Simulate Payment Request" card on Home and "Simulate: Bank Confirms Enrollment" button are hidden. Payments arrive exclusively via BroadcastChannel from the bank simulator. Enrollment completes via BroadcastChannel attestation confirmation.
- **Demo Mode ON**: All simulate buttons reappear for standalone testing without the bank simulator.

Elements with CSS class `demo-only` are shown/hidden by the `applyDemoMode()` function. The toggle state persists in `localStorage.alpensign_demo_mode` (separate from main app state).

---

## 6. Challenge Signing (Bank Pairing)

During enrollment step 2, after connecting the Seed Vault wallet, a "Bank Pairing Challenge" section appears. This implements the proof-of-device-possession ceremony:

1. The bank advisor reads a challenge string from the bank simulator (e.g., `BB123-A4F9C2E1`)
2. The client types it into the challenge input in AlpenSign
3. "Sign with Seed Vault" triggers a WebAuthn `credentials.get()` with the SHA-256 hash of the challenge as the challenge parameter
4. Biometric confirmation required (fingerprint or PIN)
5. The resulting ECDSA signature is displayed and can be copied
6. The client reads/copies the signature to the bank advisor, who verifies it in the bank portal

**Why WebAuthn for challenge signing (not MWA):**
- Faster — no wallet app switching, instant biometric prompt
- No gas cost — off-chain signature
- Self-contained — pairing should work without Solana network access
- The bank doesn't need on-chain proof of pairing; on-chain proof matters for payment seals where immutability is critical

---

## 7. MWA Integration — Critical Knowledge

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

## 8. Known Issue: Brave Browser on Seeker

**Status: OPEN — deferred, needs investigation.**

Brave browser on Android strips the device model from the User-Agent string for fingerprint protection. The UA becomes `Mozilla/5.0 (Linux; Android 10; K)` — no "Seeker", no "SolanaMobile", just the generic `K`. Brave may also strip or modify Client Hints `brands`, removing any Solana Mobile brand entries.

**Result:** AlpenSign's `detectDevice()` classifies the Seeker as `GENERIC_ANDROID` when running in Brave.

**Attempted fix (rolled back):** Probing for MWA availability as a fallback signal (if `window.__mwaTransact` loaded, the device likely has Seed Vault). This worked for Brave but broke Chrome detection due to race conditions with MWA preloading timing. The fix needs more careful implementation.

**Possible approaches for future work:**
- Check `navigator.brave.isBrave()` to confirm Brave, then use MWA probe with careful async/timeout handling that doesn't interfere with Chrome's synchronous path
- Add a manual "I'm on a Seeker" override in Settings
- Wait for Solana Mobile to add a Seeker-specific API or `navigator.solana` object that survives Brave's UA stripping
- Accept Brave as unsupported and recommend Chrome (pragmatic for hackathon)

**Note:** WebAuthn and MWA both work fine in Brave. The only issue is the device detection banner and the UI adapting to Seeker vs generic Android mode.

---

## 9. Version History

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
| v0.6.0 | **Bank simulator** (bank-simulator.html), **BroadcastChannel** bridge between bank and AlpenSign, **challenge signing** for bank pairing (WebAuthn over challenge string), **Demo Mode toggle** in Settings (default off, hides simulate buttons), bank pairing section in enrollment step 2 |

---

## 10. Key Files

| File | Purpose | Location |
|------|---------|----------|
| `app.html` | Main app shell (HTML + CSS) | alpensign.com/app.html |
| `app.js` | App logic (enrollment, sealing, MWA, BroadcastChannel, challenge signing, state) | alpensign.com/app.js |
| `bank-simulator.html` | Bank-side simulator (pairing + SIC payments, BroadcastChannel) | alpensign.com/bank-simulator.html |
| `mwa-debug.html` | Standalone MWA diagnostic tool | alpensign.com/mwa-debug.html |
| `index.html` | Landing page | alpensign.com/ |
| `llms.txt` | Machine-readable project description | alpensign.com/llms.txt |
| `MWA_INTEGRATION_LEARNINGS.md` | MWA debugging postmortem | GitHub repo |
| `DEMO_SCRIPT.md` | 45-second demo video shot list | GitHub repo |
| `AlpenSign_Extension_Roadmap.md` | Full roadmap (14 sections) | GitHub repo |
| `AlpenSign_Project_Knowledge.md` | This file | GitHub repo |
| `alpensign_logo_black_snow.png` | Mountain logo (splash screen) | images/ |
| `alpensign_logo_small_dark.png` | Small logo (header, welcome, about) | images/ |

---

## 11. Known Issues & Pending Work

### P0 — Before Hackathon Submission

- [x] **Memo privacy fix** — Now posts only SHA-256 hash as memo payload (v0.5.5+)
- [x] **Genesis Token verification** — Queries beeman's SGT API on mainnet during enrollment (v0.5.5)
- [x] **Bank simulator** — Completes the demo story with both bank and client sides (v0.6.0)
- [ ] **dApp Store submission** — PWA→TWA→APK via Bubblewrap. Needs manifest.json, service worker, signing key, Digital Asset Links, store assets (512px icon, 1200×600 banner, screenshots).
- [ ] **Demo video** — 45s screen recording on Seeker. Script in DEMO_SCRIPT.md. Should now include bank simulator in a split-screen or two-device setup.
- [ ] **Fresh screenshots** — Current landing page screenshots show old UI. Need v0.6.0 with bank simulator.

### P1 — Near-term

- [ ] **Replace BroadcastChannel with real delivery channels** — BroadcastChannel is a same-browser demo convenience. Production needs push notifications (Firebase/APNs), deep links, or QR code scan for cross-device payment request delivery. Seal confirmations should use Solana on-chain event subscription or webhook. This is the most important architectural change for moving beyond demo.
- [ ] **Brave browser Seeker detection** — Fix device detection for Brave (see Section 8)
- [ ] Demo airline booking app ("AlpenAir")
- [ ] SAS attestation migration (with ISO 20022 schema alignment)
- [ ] MWA reauthorization token caching
- [ ] On-chain seal verification button in History
- [ ] Pitch deck (8–10 slides)
- [ ] Hackathon adaptations for StableHack, SwissHacks
- [ ] Dispute simulation mode in bank simulator (show full evidence chain)

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

## 12. Go-to-Market Partners (Swiss Ecosystem)

| Partner | Role | Integration Point |
|---------|------|-------------------|
| **Securosys** | HSM manufacturer | Bank-side key management (Primus Blockchain HSM, CloudHSM) |
| **Netcetera** | 3DS ACS provider | AlpenSign as 3DS challenge method |
| **Ergon / Airlock** | API security gateway | AlpenSign module for bank API layer |
| **Viseca** | Card issuer + "one" app | AlpenSign seals for card transaction disputes |

---

## 13. Technical Decisions & Rationale

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

**Why BroadcastChannel (not WebSocket/server)?**
- Zero infrastructure — works across tabs in the same browser
- Zero dependencies — native browser API
- Perfect for single-device demo (Seeker with two Chrome tabs)
- Simulates the push notification UX without requiring Firebase/APNs setup
- Must be replaced with real delivery channels for production (see P1 roadmap)

**Why Demo Mode defaults to OFF?**
- The bank simulator makes simulate buttons redundant
- "Simulate" labels undermine the demo narrative for judges
- Standalone testing is still available via Settings toggle

---

## 14. Debugging Checklist (When MWA Breaks)

If MWA connection hangs or fails on Seeker:

1. HTTPS? (`location.protocol === 'https:'`)
2. Chrome Android? (not Firefox, not WebView, not Brave — see Section 8)
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

## 15. Session History

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
| 9 | Feb 24 | App v0.6.0 + Bank Simulator | .skr vs .sol analysis, NFT vs SAS credential decision, bank simulator (pairing + SIC payments), BroadcastChannel bridge, challenge signing, Demo Mode toggle, Brave browser issue identified (deferred) |

**Full transcripts:** Available in `/mnt/transcripts/` (includes 9 files). Refer to specific transcripts for detailed code changes and debugging sequences.

---

## 16. Key Architectural Decisions from Session 9

### .skr (Seeker ID) vs .sol (Solana Name Service)

Both map human-readable names to Solana addresses. Key differences:
- **.sol (SNS/Bonfida):** General-purpose, ~$20 in FIDA, transferable, NFT-wrappable, mature SDK, Brave native resolution
- **.skr (Seeker ID):** Device-bound identity, free, claimed during Seeker setup, tied to Genesis Token (soulbound), signals verified hardware

**Decision:** Use BOTH. Register raw Solana address as the canonical credential (deterministic, self-contained), but record .skr as human-readable alias. Seal verification uses raw address + TX signature (immutable proofs), not name resolution.

### Bank Credential: NFT vs SAS

**Decision:** SAS is the correct architecture. A bank credential is fundamentally an attestation ("bank asserts client is bound to device"), not an asset. SAS is purpose-built for attestations, schema-based (ISO 20022 aligned), revocable by bank without client cooperation, can be private/encrypted. NFTs are designed for transferability and make banking relationships publicly visible. For hackathon: simulate SAS. For production: SAS with encrypted attestation data.

### Challenge Signing Approach

**Decision:** WebAuthn signature over challenge (not MWA memo TX). Faster, already in app, instant, no gas cost. Bank doesn't need on-chain proof of pairing; on-chain proof matters for payment seals.

### Demo Strategy: Manual Pairing, Automatic Payments

**Decision:** Pairing uses manual copy-paste (friction is the point — demonstrates independence of two channels). Payment flow uses BroadcastChannel (seamless experience, creates "wow" moment for demo).
