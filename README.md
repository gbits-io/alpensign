# AlpenSign

**Transaction sealing for banks on Solana Seeker.**

With AlpenSign, the client cryptographically signs the payment — and the proof lives on a public ledger, not only on the bank's server.

[![License: BSL 1.1](https://img.shields.io/badge/Code-BSL%201.1-green)](LICENSE)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/Docs-CC%20BY--NC--SA%204.0-blue)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Solana](https://img.shields.io/badge/Solana-Devnet-9945ff)](https://explorer.solana.com/?cluster=devnet)
[![Hackathon](https://img.shields.io/badge/Hackathon-Monolith%20Q1%202026-f59e0b)]()
[![Zero Build](https://img.shields.io/badge/Zero_Dependencies-No_Build_Step-22c55e)]()

---

## What is AlpenSign?

AlpenSign turns the Solana Seeker phone into a **Mobile HSM** (Hardware Security Module) — an independent, client-side device that seals bank payments and Visa 3D-Secure transactions with biometric confirmation and posts cryptographic proof to Solana.

**No bank server. No Apple. No Google. No AlpenSign backend.**
The Seeker phone signs, TEEPIN attests, Solana records. The only intermediary is math.

### The Problem

When a client disputes a payment, the bank's defense rests on server logs they generated, stored, and control. That's self-serving evidence. Courts know it. Regulators know it. Fraudsters know it. Banks lose billions annually to friendly fraud because they cannot independently prove the client authorized the payment.

### The Solution

AlpenSign creates an independent evidence chain — from verified hardware through verified identity to immutable proof of authorization — using three layers of cryptographic trust.

---

## Three-Layer Trust Model

```
+-------------------------------------------------------------------+
|  LAYER 1 - Genesis Token                                          |
|  Device is genuine                                                |
|  Soulbound NFT, TEEPIN/SKR Guardians, Decentralized              |
+-------------------------------------------------------------------+
|  LAYER 2 - Bank Credential                                        |
|  Client is authorized                                             |
|  Solana Attestation Service (SAS), Revocable by bank              |
+-------------------------------------------------------------------+
|  LAYER 3 - Transaction Seal                                       |
|  Payment is confirmed                                             |
|  Biometric + Seed Vault signature, On-chain memo, Immutable       |
+-------------------------------------------------------------------+
```

**Layer 1 — Genesis Token (Device Identity):** The Seeker's soulbound NFT proves the phone is real hardware, verified by SKR-staked Guardians through TEEPIN. No Apple. No Google. No centralized attestation.

**Layer 2 — Bank Credential (Client Identity):** The bank issues a verifiable credential via Solana Attestation Service, binding the client to the verified device. The bank retains full control — credentials are revocable at any time.

**Layer 3 — Transaction Seal (Payment Authorization):** The client reviews the payment, confirms with biometric authentication. The Seeker's Seed Vault signs and AlpenSign posts the proof directly to Solana. Permanent and immutable.

---

## Demo

📺 **[Watch the demo on YouTube](https://youtube.com/shorts/8h8cihiz0Fw)**

🌐 **[Try the live app](https://alpensign.com/app.html)** (best on Solana Seeker, works on Android)

🤖 **[llms.txt](https://alpensign.com/llms.txt)** — Copy and paste into Claude or any LLM to ask questions about AlpenSign

---

## How It Works

### Enrollment (one-time setup)

```
1. Initialize Vault     →  WebAuthn credential created in Seeker's secure element
                            (ECDSA P-256, biometric-gated)

2. Connect Seed Vault   →  MWA wallet authorization
                            AlpenSign receives the Seeker's Solana wallet address
                            Genesis Token verified against mainnet (real on-chain check)

3. Bank Confirmation    →  Bank issues SAS credential binding client to device
                            (simulated in hackathon demo)
```

### Sealing a Payment

```
1. Receive request      →  Payment details delivered to AlpenSign
                            (currently simulated; production: deep link / push / QR)

2. Review & confirm     →  Client reviews recipient, amount, IBAN, reference
                            Taps "Seal with Biometric"

3. Biometric auth       →  WebAuthn assertion with userVerification: "required"
                            Seeker prompts fingerprint or PIN

4. Hash & sign          →  SHA-256 hash of payment data
                            Seed Vault signs the memo transaction

5. Post to Solana       →  MWA sign-and-send via Seed Vault
                            Memo containing payment hash posted to devnet

6. Confirmation         →  Transaction ID returned
                            Verifiable on Solana Explorer
```

### Evidence Chain

After sealing, the bank (or a court) can independently verify:

- **Device genuineness** → Genesis Token NFT in the signing wallet
- **Client identity** → SAS credential linking wallet to bank client record
- **Payment authorization** → On-chain transaction with payment hash, signed by Seed Vault

The bank computes the same SHA-256 hash from the original payment request. If it matches the on-chain memo, the seal is valid. The client cannot deny authorization without explaining how their biometric was used inside a verified secure element.

---

## Tech Stack

| Component | Technology | Purpose |
|---|---|---|
| Secure signing | **Seeker Seed Vault** | Hardware-isolated keys, biometric-gated |
| Device identity | **Genesis Token (Soulbound NFT)** | On-chain proof of genuine hardware |
| Device attestation | **TEEPIN + SKR Guardians** | Decentralized hardware verification |
| Wallet integration | **Solana Mobile Stack / MWA** | Native Mobile Wallet Adapter protocol |
| Credentials & seals | **Solana Attestation Service (SAS)** | Verifiable on-chain attestations |
| On-chain posting | **Solana Memo Program** | Payment hash anchored to blockchain |
| Client auth | **WebAuthn / FIDO2** | Platform authenticator (secure element) |
| Frontend | **Vanilla HTML/JS** | Zero dependencies, PWA-ready |
| RPC | **Solana Devnet** (Helius for mainnet) | Stateless, replaceable relay |

---

## Project Structure

```
alpensign/
|-- README.md                    # This file
|-- LICENSE                      # BSL 1.1
|-- llms.txt                     # LLM-ready project context
|
|-- site/                        # Deployed to alpensign.com (zero build step)
|   |-- index.html               #   Landing page
|   |-- app.html                 #   AlpenSign app (single-page)
|   |-- app.js                   #   App logic: enrollment, sealing, MWA, Solana
|   |-- llms.txt                 #   Copy of root llms.txt (served at /llms.txt)
|   +-- images/
|       |-- alpensign_logo_small_dark.png
|       |-- alpensign_gemini_logo.png
|       |-- favicon/
|       +-- screenshots/
|
+-- docs/                        # Project documentation (not deployed)
    |-- AlpenSign_Extension_Roadmap.md
    |-- MWA_INTEGRATION_LEARNINGS.md
    +-- DEMO_SCRIPT.md
```

This is a **zero-build-step project**. No bundler, no transpiler, no `npm install`, no backend. This is intentional — auditability over convenience. A bank compliance officer can View Source and read every line. The `site/` folder is deployed as-is to any static host.

---

## Getting Started

### Prerequisites

- **Solana Seeker phone** (recommended) — full trust chain with Seed Vault + Genesis Token
- Any **Android device** — works with reduced trust level (no on-chain sealing without MWA)
- A modern browser (Chrome recommended for WebAuthn support)

### Run Locally

No build step. No `npm install`. Just serve the `site/` folder.

```bash
# Clone the repo
git clone https://github.com/gbits-io/alpensign.git
cd alpensign/site

# Serve with any static server
python3 -m http.server 8000
# or
npx serve .
```

Open `http://localhost:8000/app.html` on your Seeker or Android device.

> **Note:** MWA (Mobile Wallet Adapter) requires the app to be served over HTTPS or localhost. For testing on a Seeker over the network, use a tool like `ngrok` or deploy to a hosting provider.

### Deploy

Deploy the `site/` folder to any static host:

```bash
# Netlify
netlify deploy --prod --dir site

# Vercel
vercel --prod --root-directory site

# GitHub Pages
# Enable in repo settings → Pages → Source: main branch, /site folder
```

The live version runs at [alpensign.com](https://alpensign.com).

---

## Architecture

```
+-------------------------------+
|        Solana Seeker          |
|                               |
|  +-------------------------+  |
|  |  Seed Vault (TEE)       |  |
|  |  Private keys           |  |
|  |  Biometric gate         |  |
|  +-------------------------+  |
|              | MWA            |
|  +-------------------------+  |      +-------------------------+
|  |  AlpenSign App          |  |      |  Solana (Devnet)        |
|  |  (PWA / TWA)            |  |      |                         |
|  |                         |  |      |  - Memo transactions    |
|  |  - WebAuthn enroll      |  |      |  - Genesis Token NFT    |
|  |  - Payment review       |  |      |  - SAS credentials      |
|  |  - Hash + seal          |  |      |  - Transaction seals    |
|  |  - History / verify     |  |      +-------------------------+
|  +-------------------------+  |
|                               |      +-------------------------+
|  +-------------------------+  |      |  Bank (future)          |
|  |  Genesis Token (NFT)    |  |      |                         |
|  |  TEEPIN attestation     |  |      |  - Issues credential    |
|  +-------------------------+  |      |  - Sends pay request    |
|                               |      |  - Verifies seals       |
+-------------------------------+      |  - Stores evidence      |
                                       +-------------------------+

       No AlpenSign server.
    The app talks directly to Solana RPC.
```

---

## Current Status (v0.5.5)

### What works

- ✅ WebAuthn enrollment with platform authenticator (Seeker secure element)
- ✅ MWA wallet connection via Seed Vault
- ✅ Genesis Token verification — real mainnet check via [beeman's SGT indexer](https://github.com/beeman/solana-mobile-seeker-genesis-holders) (Layer 1)
- ✅ Biometric-gated payment sealing
- ✅ SHA-256 payment hash computation
- ✅ On-chain posting via Solana Memo Program (devnet)
- ✅ Transaction verification on Solana Explorer
- ✅ Seal history with full details
- ✅ Graceful degradation on non-Seeker Android devices
- ✅ Landing page with demo video, security comparison, and [llms.txt](https://alpensign.com/llms.txt)

### Known Limitations

- ⚠️ **Memo privacy** — Current implementation posts readable payment data in the memo field. Fix in progress: post only the SHA-256 hash.
- ⚠️ **Bank credential** — Layer 2 (SAS credential issuance) requires bank cooperation and is simulated for the hackathon.
- ⚠️ **Payment delivery** — Seal requests are triggered via a "Simulate" button. Production delivery via deep link, push notification, or QR code is planned.
- ⚠️ **Devnet only** — All transactions go to Solana devnet. Mainnet migration planned after SAS integration and bank pilot.
- ⚠️ **Seal history** — Stored in `localStorage`. Lost on browser data clear or device reset.

---

## Roadmap Highlights

| Phase | Focus | Key Items |
|---|---|---|
| **P0 — Hackathon** | Ship the demo | ~~Genesis Token verification~~ ✓, Memo privacy fix, dApp Store submission, demo video |
| **P1 — Complete story** | Both sides of the flow | Bank simulator, SAS migration, pitch deck, partner outreach |
| **P2 — Real product** | Production foundation | AlpenSign SDK, Securosys HSM, native Android app, credential recovery, mainnet |
| **P3 — Market expansion** | Adjacent use cases | Visa 3D-Secure (Netcetera ACS), hardware wallet support, EU/UK markets |

See [AlpenSign_Extension_Roadmap.md](docs/AlpenSign_Extension_Roadmap.md) for the full roadmap.

---

## Regulatory Alignment

AlpenSign's architecture aligns with existing and emerging regulatory frameworks:

- **QES-comparable** — Biometric + secure element + hardware-isolated keys: structurally equivalent to Qualified Electronic Signatures under eIDAS
- **GDPR by design** — No personal data on-chain. Only cryptographic hashes. Biometrics stay on-device.
- **Immutable audit trail** — Timestamped, tamper-proof record on Solana. Supports FINMA, MiFID II, and PSD2/SCA requirements.
- **Swiss & EU compatible** — Aligns with ZertES, eIDAS trust services, and PSD2 independent authentication requirements.

---

## Why Solana Seeker?

AlpenSign requires capabilities that don't exist on iPhone or Pixel:

| Capability | Apple / Google | Solana Seeker |
|---|---|---|
| On-chain device identity | ✗ None | ✓ Genesis Token (soulbound) |
| Decentralized device attestation | ✗ Centralized, revocable | ✓ TEEPIN + Guardians |
| Native blockchain signing in secure element | ✗ None | ✓ Seed Vault |
| Vendor-free trust chain | ✗ Apple / Google in the middle | ✓ Math + decentralized network |
| Direct-to-chain posting | ✗ Requires backend relay | ✓ Solana Mobile Stack |

---

## Device Recovery

When a client loses their Seeker, the process is simple:

1. Bank revokes the old SAS credential
2. Client sets up new Seeker (Genesis Token auto-minted, Seed Vault initialized)
3. Client opens AlpenSign and re-enrolls — identical to first-time setup
4. Bank re-issues credential via existing identity channel

There is no "AlpenSign account" to migrate. Seal history remains permanently on Solana. Target: under 5 minutes with online banking access. See [Section 10e of the roadmap](docs/AlpenSign_Extension_Roadmap.md) for details.

---

## Team

| | Name | Role |
|---|---|---|
| **R** | Roman | Founder · Product Management, Development |
| **A** | Alexandr | Fullstack Development (focus: demo backend) |
| **⌘** | Claude + Gemini | AI Engineering Partners |

Built for the Solana Seeker Hackathon Monolith · Q1 2026.

---

## Contributing

We're looking for Solana developers, security engineers, and anyone who believes banking shouldn't depend on one company's goodwill.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

For questions or collaboration, reach out via [alpensign.com](https://alpensign.com).

---

## License

- **Code:** [Business Source License 1.1](LICENSE) (BSL 1.1)
- **Documentation:** [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)

---

<p align="center">
  <strong>Banks should not be the sole keeper of their own evidence.</strong><br>
  AlpenSign gives them — and their clients — a neutral, cryptographic, immutable record<br>
  that neither side controls alone.
</p>
