# AlpenSign — Architecture & Interactions (v0.7.0)

> This document describes the runtime architecture of AlpenSign v0.7.0, focusing on the interactions between AlpenSign App, Helius RPC, Solana blockchain, Seed Vault wallet, and the Bank Simulator.

**Last updated:** 2026-03-07

---

## System Components

| Component | Role | Communication |
|-----------|------|---------------|
| **AlpenSign App** (`app.html` + `app.js`) | Client-side PWA on Seeker. Enrollment, sealing, history. | Helius RPC (HTTPS), MWA (Android Intent), BroadcastChannel, localStorage |
| **Bank Simulator** (`bank-simulator.html`) | Simulates the bank's portal. Pairing, SIC payments. | BroadcastChannel, localStorage (read-only from AlpenSign) |
| **Seed Vault Wallet** | Hardware-isolated signing on Seeker. Holds private keys. | MWA protocol (`solana-wallet://` Intent) |
| **Helius RPC** | Solana RPC provider (mainnet + devnet). Replaces public RPCs. | HTTPS JSON-RPC from browser |
| **Solana Blockchain** | Immutable ledger. Stores memo transactions and Genesis Tokens. | Via Helius RPC |
| **config.js** | API key store (Helius). Not committed to git. | Loaded as `<script>` before `app.js` |

---

## Data Flow Overview

```
┌─────────────┐     BroadcastChannel      ┌──────────────────┐
│  AlpenSign   │◄────────────────────────►│  Bank Simulator   │
│  (app.js)    │     + localStorage        │  (bank-sim.html)  │
└──────┬───────┘                           └──────────────────┘
       │
       │  MWA Intent (solana-wallet://)
       ▼
┌─────────────┐
│  Seed Vault  │  Hardware-isolated signing
│  Wallet      │  Biometric gate (fingerprint/PIN)
└──────────────┘
       │
       │  Signs transactions
       ▼
┌─────────────┐     HTTPS JSON-RPC        ┌──────────────────┐
│  AlpenSign   │────────────────────────►│  Helius RPC       │
│  (app.js)    │◄────────────────────────│  (mainnet/devnet) │
└──────────────┘                           └────────┬─────────┘
                                                    │
                                                    ▼
                                           ┌──────────────────┐
                                           │  Solana Blockchain│
                                           │  (Memo Program)   │
                                           └──────────────────┘
```

---

## Sequence Diagrams

### 1. Enrollment Flow

```
User            AlpenSign App       Seed Vault       Helius RPC        Bank Simulator
 │                   │                  │                │                    │
 │  Tap "Initialize" │                  │                │                    │
 │──────────────────►│                  │                │                    │
 │                   │  WebAuthn create │                │                    │
 │  Biometric prompt │◄─────────────── │                │                    │
 │◄──────────────────│                  │                │                    │
 │  Fingerprint/PIN  │                  │                │                    │
 │──────────────────►│                  │                │                    │
 │                   │  credId stored   │                │                    │
 │                   │                  │                │                    │
 │  Tap "Connect     │                  │                │                    │
 │   Seed Vault"     │                  │                │                    │
 │──────────────────►│  MWA transact()  │                │                    │
 │                   │─────────────────►│                │                    │
 │                   │  authorize()     │                │                    │
 │                   │  chain: mainnet  │                │                    │
 │  Approve in wallet│                  │                │                    │
 │──────────────────►│  walletAddr      │                │                    │
 │                   │◄─────────────────│                │                    │
 │                   │                  │                │                    │
 │                   │  wallet-connected (BroadcastChannel)                   │
 │                   │───────────────────────────────────────────────────────►│
 │                   │                  │                │                    │
 │                   │  SGT Verification│                │                    │
 │                   │  getTokenAccounts│                │                    │
 │                   │  ByOwner(Token22)│                │                    │
 │                   │─────────────────────────────────►│                    │
 │                   │  token accounts  │                │                    │
 │                   │◄─────────────────────────────────│                    │
 │                   │  getAccountInfo  │                │                    │
 │                   │  (each mint)     │                │                    │
 │                   │─────────────────────────────────►│                    │
 │                   │  mintAuthority   │                │                    │
 │                   │◄─────────────────────────────────│                    │
 │                   │                  │                │                    │
 │                   │  ✓ SGT verified  │                │                    │
 │  "Genesis Token   │  (GT2zuH..match) │                │                    │
 │   verified ✓"     │                  │                │                    │
 │◄──────────────────│                  │                │                    │
 │                   │                  │                │                    │
 │  Tap "Open Bank   │                  │                │                    │
 │   Portal"         │                  │                │  window.open()     │
 │──────────────────►│──────────────────────────────────────────────────────►│
 │                   │                  │                │                    │
 │                   │  (Bank pairing challenge flow follows)                │
 │                   │                  │                │                    │
```

### 2. Payment Sealing Flow

```
Bank Advisor     Bank Simulator      AlpenSign App       Seed Vault      Helius RPC
 │                   │                    │                  │               │
 │  Submit SIC       │                    │                  │               │
 │  Payment          │                    │                  │               │
 │──────────────────►│                    │                  │               │
 │                   │  payment-request   │                  │               │
 │                   │  (BroadcastChannel)│                  │               │
 │                   │───────────────────►│                  │               │
 │                   │                    │  Notification    │               │
 │                   │                    │  appears         │               │
 │                   │                    │                  │               │
 │                   │                    │  User taps       │               │
 │                   │                    │  "Review"        │               │
 │                   │                    │                  │               │
 │                   │                    │  Step 1: Review  │               │
 │                   │                    │  payment details │               │
 │                   │                    │                  │               │
 │                   │                    │  Step 2: WebAuthn│               │
 │                   │                    │  biometric sign  │               │
 │                   │                    │  (SHA-256 hash)  │               │
 │                   │                    │                  │               │
 │                   │                    │  Step 3: Hash    │               │
 │                   │                    │  confirmed ✓     │               │
 │                   │                    │                  │               │
 │                   │                    │  getLatestBlock- │               │
 │                   │                    │  hash            │               │
 │                   │                    │─────────────────────────────────►│
 │                   │                    │  blockhash       │               │
 │                   │                    │◄─────────────────────────────────│
 │                   │                    │                  │               │
 │                   │                    │  Build memo TX   │               │
 │                   │                    │  (hash as payload)│              │
 │                   │                    │                  │               │
 │                   │                    │  Step 4: User    │               │
 │                   │                    │  taps "Post"     │               │
 │                   │                    │                  │               │
 │                   │                    │  MWA transact()  │               │
 │                   │                    │─────────────────►│               │
 │                   │                    │  authorize +     │               │
 │                   │                    │  signAndSend     │               │
 │                   │                    │  Biometric prompt│               │
 │                   │                    │◄─────────────────│               │
 │                   │                    │  TX signature    │               │
 │                   │                    │◄─────────────────│               │
 │                   │                    │                  │               │
 │                   │                    │  ✓ On-chain      │               │
 │                   │                    │  (Explorer link) │               │
 │                   │                    │                  │               │
 │                   │  seal-complete     │                  │               │
 │                   │  (BroadcastChannel)│                  │               │
 │                   │◄───────────────────│                  │               │
 │                   │                    │                  │               │
 │  "Sealed ✓"       │                    │                  │               │
 │  + Proof card     │                    │                  │               │
 │  + Explorer link  │                    │                  │               │
 │◄──────────────────│                    │                  │               │
 │                   │                    │                  │               │
```

### 3. SGT Verification Detail

```
AlpenSign App                    Helius Mainnet RPC              Solana Mainnet
 │                                     │                              │
 │  POST getTokenAccountsByOwner       │                              │
 │  { programId: Token-2022 }          │                              │
 │────────────────────────────────────►│  Query token accounts        │
 │                                     │─────────────────────────────►│
 │                                     │  Account data                │
 │                                     │◄─────────────────────────────│
 │  Token-2022 accounts (jsonParsed)   │                              │
 │◄────────────────────────────────────│                              │
 │                                     │                              │
 │  For each mint:                     │                              │
 │  POST getAccountInfo (jsonParsed)   │                              │
 │────────────────────────────────────►│  Query mint account          │
 │                                     │─────────────────────────────►│
 │                                     │  Mint data                   │
 │                                     │◄─────────────────────────────│
 │  parsed.info.mintAuthority          │                              │
 │◄────────────────────────────────────│                              │
 │                                     │                              │
 │  Compare mintAuthority against:     │                              │
 │  GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4                    │
 │                                     │                              │
 │  If match → ✓ SGT verified          │                              │
 │  If no match → try base64 fallback  │                              │
 │  (raw byte parsing at offset 0-35)  │                              │
 │                                     │                              │
```

---

## AlpenSign ↔ Helius RPC Interactions

All Solana RPC calls go through Helius. The public Solana RPCs (`api.mainnet-beta.solana.com`, `api.devnet.solana.com`) return HTTP 403 for browser-origin requests.

| Call | Network | Purpose | When |
|------|---------|---------|------|
| `getTokenAccountsByOwner` | **Always mainnet** | Find Token-2022 accounts for SGT verification | Enrollment step 2 (wallet connect) |
| `getAccountInfo` (mint) | **Always mainnet** | Read mint authority to verify SGT | Enrollment step 2 |
| `getLatestBlockhash` | Active network | Get recent blockhash for memo TX | Seal step 4 (post to Solana) |
| `sendTransaction` (via MWA) | Active network | Post signed memo TX | Seal step 4 (via Seed Vault `signAndSendTransactions`) |
| `getBalance` | Active network | Show wallet SOL balance | Settings, periodic |

**Key insight:** SGT verification always hits **mainnet** regardless of the active network setting, because the Genesis Token lives on mainnet. Transaction posting uses the **active network** (mainnet or devnet, configurable via Settings toggle).

### RPC URL Construction

```javascript
// config.js (not committed to git)
const ALPENSIGN_CONFIG = { HELIUS_API_KEY: 'your-key-here' };

// app.js reads the key with fallback
const HELIUS_API_KEY = ALPENSIGN_CONFIG?.HELIUS_API_KEY || 'YOUR_HELIUS_API_KEY';

// Network URLs constructed dynamically
mainnet RPC: https://mainnet.helius-rpc.com/?api-key=<KEY>
devnet RPC:  https://devnet.helius-rpc.com/?api-key=<KEY>
SGT RPC:     https://mainnet.helius-rpc.com/?api-key=<KEY>  (always mainnet)
```

---

## AlpenSign ↔ Bank Simulator Interactions

The two apps communicate via two channels, both requiring same-origin (same Netlify domain):

### BroadcastChannel (`alpensign-bank-bridge`)

Real-time, event-driven messaging between browser tabs.

| Direction | Message Type | Payload | Trigger |
|-----------|-------------|---------|---------|
| AlpenSign → Bank | `wallet-connected` | `{ walletAddress, seekerId }` | Wallet connects via MWA |
| AlpenSign → Bank | `seal-complete` | `{ requestId, seal: { hash, signature, solanaTx, ... } }` | Payment sealed and posted |
| Bank → AlpenSign | `attestation-confirmed` | `{ contract, bank, seekerId, solanaAddress }` | Bank confirms pairing |
| Bank → AlpenSign | `payment-request` | `{ requestId, payment: { creditor, iban, amount, ... } }` | Bank submits SIC payment |

### localStorage (shared, same origin)

Persistent state that survives page reloads. The bank simulator reads AlpenSign's state for wallet address resolution.

| Key | Writer | Reader | Purpose |
|-----|--------|--------|---------|
| `alpensign_state` | AlpenSign | Bank Simulator (read-only) | Real wallet address for `.skr` resolution |
| `alpensign_network` | AlpenSign | AlpenSign only | Active network (mainnet/devnet) |
| `alpensign_demo_mode` | AlpenSign | AlpenSign only | Demo mode toggle state |

### Address Resolution Priority

When the bank simulator resolves a `.skr` ID to a Solana address:

```
1. realWalletAddress (from BroadcastChannel 'wallet-connected' message)
      ↓ if null
2. localStorage 'alpensign_state'.walletAddr (persistent, survives page reload)
      ↓ if null
3. SIMULATED_ADDRESSES lookup table (hardcoded fallback for offline demo)
      ↓ if not found
4. generateAddress() (random base58 string)
```

---

## Network Configuration

AlpenSign supports mainnet and devnet, switchable via a toggle in Settings.

| Setting | Mainnet | Devnet |
|---------|---------|--------|
| RPC URL | `mainnet.helius-rpc.com` | `devnet.helius-rpc.com` |
| MWA `chain` | `solana:mainnet` | `solana:devnet` |
| Explorer suffix | (none) | `?cluster=devnet` |
| SGT verification | Mainnet (always) | Mainnet (always) |
| Transaction posting | Mainnet | Devnet |

**Switching networks:** Clears MWA auth token (network-specific), re-creates `solanaConnection`, updates all UI badges. Does not clear enrollment state or seal history.

---

## Deployment Architecture

```
GitHub Repo ──── git push ────► Netlify (atomic deploy)
                                    │
                                    ├── app.html
                                    ├── app.js
                                    ├── bank-simulator.html
                                    ├── config.example.js
                                    ├── index.html
                                    └── images/

config.js ──── manual upload ──► Netlify (not in git)
```

**Important:** `config.js` contains the Helius API key and is in `.gitignore`. Netlify's atomic deploys from git will not include it. After each deploy, `config.js` must be re-uploaded manually — or the key should be inlined in `app.js` on the deploy branch.

---

*Document prepared for AlpenSign v0.7.0 — March 2026*
