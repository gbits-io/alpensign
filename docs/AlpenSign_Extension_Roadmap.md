# AlpenSign — Extension Roadmap

> How to evolve AlpenSign from a Solana Seeker Hackathon demo into a production-grade transaction-sealing platform for banks, card networks, and beyond.

---

## 0. Immediate Pre-Submission Work (Hackathon P0)

> These items must be completed before the Monolith hackathon submission deadline. They address real shortcomings discovered during device testing on the Solana Seeker.

### 0a. Memo Field Privacy Fix

**Status: CRITICAL — plaintext payment data currently visible on-chain.**

The current implementation posts a JSON memo to Solana devnet containing readable payment details: recipient name, IBAN fragment, amount, and reference. Anyone scanning devnet transactions can read this data. This is unacceptable even for a demo — hackathon judges will notice, and it undermines the GDPR claims on the landing page.

**Fix:** Post only the SHA-256 hash of the payment data as the memo content. The bank can independently compute the same hash from the original payment request and verify it matches the on-chain record. Same evidentiary value, zero data leakage.

```javascript
// CURRENT (bad): memo contains readable JSON
const memoData = JSON.stringify({ recipient, amount, iban, ref, hash, ts });

// FIXED: memo contains only the hash
const memoData = txHash; // SHA-256 hex string, e.g. "a1b2c3d4..."
```

The full payment details remain in `localStorage` on the device and are shown in the History view. The on-chain record is the cryptographic anchor, not a data store.

### 0b. Genesis Token Verification (Make Layer 1 Real)

**Status: Tier 1 implemented (v0.5.5) — real mainnet verification via beeman's SGT API. Tier 2 (trustless Token-2022) planned for production.**

**Why this matters (the trust chain explained simply):**

AlpenSign's evidentiary strength depends on three questions a court or regulator would ask:

1. **Was the device genuine?** → Genesis Token (Layer 1)
2. **Was the person an authorized client?** → Bank Credential (Layer 2)
3. **Did they authorize this specific payment?** → Transaction Seal (Layer 3)

Right now, Layer 3 is real (actual Solana transaction, signed by Seed Vault hardware). Layers 1 and 2 are simulated. Layer 2 requires bank cooperation and can't be done for a hackathon. But **Layer 1 can be made real today** — every Seeker phone already has a Genesis Token NFT in its wallet.

**How the Genesis Token works:**

When a Seeker phone is manufactured and first set up, a network of independent validators called "Guardians" (who have staked SKR tokens as collateral) verify that the phone's Trusted Execution Environment (TEE) is genuine — meaning the secure element hasn't been tampered with, the firmware is authentic, and the hardware is a real Solana Mobile device, not an emulator or modified phone.

Once verified, the Guardians mint a **soulbound (non-transferable) NFT** — the Genesis Token — to the phone's Seed Vault wallet. This NFT is the on-chain proof that says: "This specific device passed hardware integrity verification by multiple independent parties."

**Why this is different from Apple/Google:** Apple's DeviceCheck and Google's Play Integrity are centralized — Apple or Google alone decides if a device is "genuine," and they can revoke that status unilaterally. The Genesis Token is decentralized — multiple independent Guardians stake real money (SKR tokens) on their attestation. If they attest a fake device, they lose their stake. No single party controls the process.

**Why the Seed Vault completes the chain:**

A common question is: "Even if the device is genuine, how do you know the signature came from inside the secure element and not from software?" The answer: the Seed Vault is a hardware-isolated signing environment built into the Seeker's OS. Private keys are generated inside the secure element at wallet creation and **cannot be exported** — not by the user, not by any app, not even by the OS. Every signature from a Seed Vault wallet address was necessarily produced inside the secure element. There is no other path.

So: Genesis Token proves "genuine hardware" → Seed Vault proves "signature came from that hardware" → the two together prove "this cryptographic seal was produced inside a verified, tamper-resistant device." That's the Layer 1 evidence chain.

**Implementation — Three-Tier Strategy:**

AlpenSign needs to verify *one wallet* during enrollment. Three approaches are available, in increasing order of self-sovereignty:

| Approach | Complexity | Dependency | Trust | When to use |
|---|---|---|---|---|
| **Beeman's SGT API** | 1 fetch call | Third-party API (open-source) | Trusts indexer | Hackathon |
| **Official Token-2022** | ~60 lines, `@solana/spl-token` | Any mainnet RPC | Trustless, on-chain | Production |
| **Self-hosted indexer** | Deploy beeman's repo | Own infrastructure | Full control | Scale |

**Tier 1 — Hackathon (now): Beeman's SGT API**

[beeman/solana-mobile-seeker-genesis-holders](https://github.com/beeman/solana-mobile-seeker-genesis-holders) is an open-source indexer that tracks all Seeker Genesis Token holders. It exposes a simple REST API: pass a wallet address, get back the mint address and metadata if the wallet holds an SGT, or 404 if not. No API key, no npm packages, no build step — fits AlpenSign's zero-dependency architecture.

```javascript
// After wallet.authorize() returns the wallet address
async function verifySGT(walletAddress) {
  try {
    const res = await fetch(
      `https://sgt-api.beeman.dev/api/holders/${walletAddress}`
    );
    if (res.status === 404) return null; // Not a holder
    const data = await res.json();
    // data.mints[0].mint = SGT mint address
    return data.mints?.[0]?.mint || null;
  } catch (e) {
    console.warn('[SGT] Verification failed:', e.message);
    return null; // Fail open — allow enrollment with warning
  }
}

// During enrollment step 2:
const sgtMint = await verifySGT(walletAddress);
if (sgtMint) {
  state.genesisTokenMint = sgtMint;
  state.genesisVerified = true;
  // UI: "✅ Genesis Token verified"
} else {
  state.genesisVerified = false;
  // UI: "⚠️ Genesis Token not found"
}
```

**Why this is acceptable for a hackathon:** Beeman is a well-known Solana ecosystem builder, the API is open-source and self-hostable, and the SGT collection is immutable (once indexed, data is final). The irony of relying on a third-party API in a "no intermediary" solution is noted — but for a demo, pragmatism wins. Judges will see a real on-chain verification, not a simulation.

**Tier 2 — Production: Official Token-2022 Verification**

The [Solana Mobile documentation](https://docs.solanamobile.com/marketing/engaging-seeker-users) recommends verifying SGT ownership by inspecting the token's on-chain structure using Token Extensions (Token-2022). This is the trustless approach — it checks three cryptographic properties directly on-chain:

**Key addresses (from Solana Mobile docs):**

```
Mint Authority:     GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4
Metadata Address:   GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te
Group Address:      GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te
```

```javascript
// Requires: @solana/web3.js, @solana/spl-token
const { Connection, PublicKey } = require('@solana/web3.js');
const {
  unpackMint, getMetadataPointerState,
  getTokenGroupMemberState, TOKEN_2022_PROGRAM_ID
} = require('@solana/spl-token');

const SGT_MINT_AUTHORITY = 'GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4';
const SGT_METADATA = 'GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te';
const SGT_GROUP = 'GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te';

async function verifySGT(walletAddress) {
  // Any mainnet RPC — no Helius-specific API needed
  const connection = new Connection('https://api.mainnet-beta.solana.com');
  const owner = new PublicKey(walletAddress);

  // Fetch Token-2022 accounts for this wallet
  const { value: accounts } = await connection.getTokenAccountsByOwner(
    owner, { programId: TOKEN_2022_PROGRAM_ID }
  );

  if (accounts.length === 0) return null;

  // Extract mint pubkeys from token account data (first 32 bytes)
  const mintKeys = accounts.map(a => new PublicKey(a.account.data.slice(0, 32)));
  const mintInfos = await connection.getMultipleAccountsInfo(mintKeys);

  for (let i = 0; i < mintInfos.length; i++) {
    if (!mintInfos[i]) continue;
    try {
      const mint = unpackMint(mintKeys[i], mintInfos[i], TOKEN_2022_PROGRAM_ID);

      const hasAuthority = mint.mintAuthority?.toBase58() === SGT_MINT_AUTHORITY;
      const meta = getMetadataPointerState(mint);
      const hasMetadata = meta?.authority?.toBase58() === SGT_MINT_AUTHORITY &&
                          meta?.metadataAddress?.toBase58() === SGT_METADATA;
      const group = getTokenGroupMemberState(mint);
      const hasGroup = group?.group?.toBase58() === SGT_GROUP;

      if (hasAuthority && hasMetadata && hasGroup) {
        return mint.address.toBase58(); // Verified SGT mint
      }
    } catch (e) { continue; }
  }
  return null;
}
```

This is more robust than the earlier DAS/Helius approach because it verifies the token's cryptographic structure (mint authority, metadata pointer, group membership) rather than just checking collection labels. It works with any mainnet RPC endpoint — no Helius API key required.

**Tradeoff:** Requires `@solana/spl-token` as a dependency, which means either bundling it or loading via CDN. This breaks AlpenSign's current zero-dependency model, so it's better suited for the native Android app (Alexandr's track) than the PWA.

**Tier 3 — Scale: Self-Hosted Indexer**

For production at scale (many concurrent enrollments), self-host beeman's indexer on AlpenSign's own infrastructure. Fork the repo, deploy to a VPS with Turso DB, and point AlpenSign at the self-hosted endpoint. This gives Tier 1's simplicity with Tier 2's self-sovereignty.

```bash
git clone https://github.com/beeman/solana-mobile-seeker-genesis-holders
# Deploy with Docker — see repo README
docker run --rm -p 3000:3000 \
  -e TURSO_DATABASE_URL=<your_url> \
  -e TURSO_AUTH_TOKEN=<your_token> \
  ghcr.io/beeman/solana-mobile-seeker-genesis-holders
```

**What changes in the UI:**

- Enrollment step 2 shows "✅ Genesis Token verified" or "⚠️ Genesis Token not found" below the wallet address
- The seal history and About page indicate whether Layer 1 was verified
- The evidence chain strength is displayed: "3/3 layers verified" vs "2/3 layers (no Genesis Token)"

**Note:** All three approaches require a mainnet data source, even though AlpenSign otherwise runs on devnet. The Genesis Token lives on mainnet because it's a real asset minted during device provisioning.

### 0c. Solana dApp Store Submission (PWA Path)

AlpenSign is a vanilla HTML/JS web app. The dApp Store requires a signed Android APK. The fastest path for hackathon submission is wrapping the web app as a Progressive Web App (PWA) inside a Trusted Web Activity (TWA).

**Steps:**

1. **Create `manifest.json`** on alpensign.com:
   ```json
   {
     "name": "AlpenSign",
     "short_name": "AlpenSign",
     "scope": "/",
     "start_url": "/app.html",
     "display": "standalone",
     "background_color": "#0a0a0a",
     "theme_color": "#0a0a0a",
     "icons": [
       { "src": "/images/android-chrome-192x192.png", "sizes": "192x192", "type": "image/png" },
       { "src": "/images/android-chrome-512x512.png", "sizes": "512x512", "type": "image/png" }
     ]
   }
   ```

2. **Add a minimal service worker** — required for PWA installability. Can be a simple cache-first strategy for static assets.

3. **Use Bubblewrap CLI** to generate the Android project:
   ```bash
   npx @nicolo-ribaudo/bubblewrap init --manifest=https://alpensign.com/manifest.json
   ```

4. **Generate a new signing key** — the dApp Store rejects APKs signed with existing Google Play keys. Dedicated keystore, stored securely (required for all future updates).

5. **Build signed release APK** via Bubblewrap.

6. **Publish Digital Asset Links** at `https://alpensign.com/.well-known/assetlinks.json` with the APK's SHA-256 fingerprint — required for full-screen display without browser bar.

7. **Fix locale declaration** in `build.gradle`:
   ```gradle
   android { defaultConfig { resConfigs "en", "de" } }
   ```

8. **Prepare store assets:**
   - App icon: 512×512 px ✅ (already exists)
   - Banner graphic: 1200×600 px (needs creation)
   - Screenshots from Seeker (fresh, showing v0.5.5 UI)
   - Description text and category

9. **Mint publisher NFTs** via the dApp Store CLI or publisher portal at publish.solanamobile.com:
   - Publisher NFT (Koivu GmbH identity) — minted once
   - App NFT (AlpenSign) — linked to publisher
   - Release NFT (v0.5.5) — contains APK hash + metadata
   - Requires a publisher wallet with SOL on mainnet

10. **Submit for review** against Solana dApp Store publisher policy.

**Note:** This PWA→TWA path is a bridge. The native Android app (Alexandr's track) will replace it for production.

### 0d. Demo Video

A ~45-second screen recording captured with Android's built-in screen recorder on the Seeker. The Seed Vault PIN/biometric screens appear black during recording — this is a feature (hardware isolation), not a bug.

**Three-act structure:**

1. **Enroll** (15s) — Initialize Vault → Connect Seed Vault (black screen = secure element) → Bank confirmation
2. **Seal** (20s) — Simulate request → Review payment → Biometric → Seed Vault signs (black screen again) → On-chain confirmation with TX ID
3. **Prove** (10s) — Tap Explorer link → Real Solana devnet transaction with memo hash → History tab with full details

Key visual beats: the black screens during Seed Vault interaction prove that even the OS-level screen recorder cannot observe what happens inside the secure element.

### 0e. Fresh Screenshots

The landing page screenshots show an outdated UI. New screenshots needed showing:
- Splash screen with mountain logo
- Enrollment with Seed Vault wallet address
- Seal flow with "Tap to open Seed Vault" step
- Completed seal with Explorer link
- History tab with expanded seal details
- About page

### 0f. README and Documentation

- Update `README.md` on GitHub with current architecture, setup instructions, and known limitations
- `llms.txt` updated to v0.5.5 ✅
- `MWA_INTEGRATION_LEARNINGS.md` published ✅
- `DEMO_SCRIPT.md` shot list for video recording ✅

---

## 1. Bank-Side Integration

### 1a. Bank Simulator for Demo Purposes

The current AlpenSign prototype shows the **client side** — the Seeker phone receiving and sealing payment requests. To tell a complete story, we need to build the **bank side** that originates those requests.

**What to build:**

- A lightweight web application that acts as a mock internet banking portal. The banker (or demo operator) enters payment details — recipient, amount, currency, reference — and the system generates a payment request pushed to the AlpenSign app on the Seeker.
- The bank simulator should display a real-time dashboard showing the lifecycle of each request: *Pending → Delivered → Sealed → Confirmed*. When the Seeker signs and posts the seal to Solana, the simulator polls the chain (or receives a webhook) and updates the status with the on-chain transaction signature.
- Include a **dispute simulation mode**: after a payment is sealed, the operator can click "Client Disputes This Payment." The dashboard then fetches the Genesis Token, the bank credential (SAS attestation), and the transaction seal, presenting the full independent evidence chain that would defeat the dispute.

**Why it matters:** Judges at hackathons — and bank innovation teams evaluating the concept — need to see both ends of the flow. Showing only the phone app leaves the most compelling part of the story (the evidentiary value) to the viewer's imagination.

### 1b. AlpenSign SDK for Real Bank Integration

Beyond the demo, the long-term goal is an **AlpenSign SDK** that banks can embed into their existing payment infrastructure.

**Architecture sketch:**

```
┌──────────────────────┐       ┌──────────────────────┐
│   Bank Core System    │       │   AlpenSign SDK       │
│   (Payment Engine)    │──────▶│   (Server-side lib)   │
│                       │       │                       │
│   - Creates payment   │       │   - Formats seal      │
│   - Awaits seal       │       │     request payload   │
│   - Verifies seal     │       │   - Pushes to Seeker  │
│   - Stores evidence   │       │     via MWA / deep    │
│                       │       │     link / push notif  │
└──────────────────────┘       │   - Verifies seal on  │
                                │     Solana             │
                                │   - Returns evidence   │
                                │     bundle to bank     │
                                └──────────────────────┘
```

**Key SDK features:**

- **Payment request formatting** — Standardized JSON/Protobuf schema for payment details (amount, currency, IBAN, reference, timestamp) that the Seeker app can parse and display.
- **Delivery channel abstraction** — Support multiple delivery mechanisms: Solana Mobile Wallet Adapter (MWA) for on-device, push notifications for background delivery, QR code for cross-device scenarios.
- **Seal verification** — A function that takes a Solana transaction signature and returns a structured verification result: device identity (Genesis Token valid?), client credential (SAS attestation active?), seal signature (matches payment hash?).
- **Evidence bundle export** — Generate a self-contained, court-admissible evidence package (PDF + JSON + raw Solana data) that a bank's legal team can use in dispute proceedings.

---

## 2. Migrate from Memo Transactions to Solana Attestation Service (SAS)

### Current Approach

Today, AlpenSign posts transaction seals as **Solana transactions with a memo field** containing the payment hash. This works but has limitations: memo data is unstructured, not queryable by schema, and doesn't benefit from the composable credential ecosystem being built on Solana.

### Proposed Approach

Migrate transaction seals to **SAS attestations**. The Solana Attestation Service, launched on mainnet in May 2025 by the Solana Foundation and the Solana Identity Group, is an open, permissionless protocol for verifiable credentials. It uses a three-party model — Issuer, Holder, Verifier — with on-chain attestations derived from typed schemas.

**How AlpenSign would use SAS:**

| AlpenSign Concept | Current (Memo) | Proposed (SAS) |
|---|---|---|
| **Bank credential** | Not yet implemented | SAS attestation: bank issues a credential to the Seeker wallet binding the client relationship. Schema includes bank ID, client ID, credential expiry. Revocable by the bank. |
| **Transaction seal** | Memo field on a standard SOL transfer | SAS attestation: schema includes payment hash, amount, currency, timestamp, biometric confirmation flag. Issued by the Seeker wallet (self-attestation signed by the secure element). |
| **Genesis Token verification** | Checked off-chain | Can be cross-referenced with TEEPIN attestations, also moving to SAS. |

**Benefits of migrating to SAS:**

- **Typed schemas** — Payment seals follow a defined, versioned schema. Any verifier (bank, regulator, court) can parse and validate the seal without custom code.
- **Composability** — SAS attestations are reusable across the Solana ecosystem. A bank credential issued via SAS could be recognized by other financial services.
- **Revocability** — Bank credentials can be explicitly revoked on-chain (e.g., when a client closes their account), something memo transactions cannot express.
- **Ecosystem alignment** — SAS is being adopted by Civic, RNS.ID, Sumsub, Polyflow, and others. AlpenSign would join a growing ecosystem rather than building in isolation.
- **SDK simplicity** — The SAS JavaScript SDK (`sas-lib`) handles schema creation, attestation issuance, and verification with a single SDK call, reducing integration complexity.
- **ISO 20022 alignment** — SAS attestation schemas should map to ISO 20022 field structures (the global standard for financial messaging, used by Swiss banks for SIC/SEPA). This means the seal schema uses the same field names and types as a `pain.001` payment initiation message: debtor, creditor, amount, currency, IBAN, reference. When a bank's system receives a seal, it can validate it against the original payment instruction without field mapping. This makes integration credible to partners like Netcetera and Ergon who live in the ISO 20022 world.

---

## 3. Visa / Mastercard 3D Secure Integration

### The Opportunity

3D Secure (3DS2) is the authentication standard for online card payments, used by Visa ("Visa Secure") and Mastercard ("Mastercard Identity Check"). When a cardholder makes an online purchase, their bank's 3DS system challenges them to confirm the transaction — typically via an SMS code or a push notification in the bank's app (e.g., Viseca's "one" app in Switzerland).

**The problem with current 3DS implementations:**

- The authentication channel is controlled by the bank or the card issuer. It is self-serving evidence — the same party that processed the payment also controls the authentication log.
- SMS OTPs are vulnerable to SIM-swap attacks.
- App-based push notifications depend on Apple/Google push infrastructure.

### How AlpenSign Extends 3DS

AlpenSign could act as an **independent, out-of-band confirmation layer** for 3DS challenges:

1. **Merchant initiates payment** → Card network sends 3DS challenge to the issuer.
2. **Issuer's 3DS server** → Instead of (or in addition to) sending a push notification to the bank's own app, the issuer triggers an AlpenSign seal request to the cardholder's Seeker phone.
3. **Cardholder reviews on Seeker** → Merchant name, amount, currency displayed on-device. Biometric confirmation via the secure element.
4. **Seal posted to Solana** → The 3DS response includes the on-chain seal reference. The issuer returns a successful 3DS authentication to the merchant.

**Integration with apps like Viseca "one":**

Viseca's "one" app already handles 3DS authentication for Swiss cardholders. A potential integration path would be for Viseca to either embed AlpenSign as an additional confirmation step within the "one" flow, or to offer AlpenSign as an alternative confirmation method for Seeker-owning cardholders. The key value proposition: in a dispute, the card issuer has not just their own logs but an independent, on-chain cryptographic seal.

**Technical requirements:**

- The AlpenSign SDK (see Section 1b) would need to support EMVCo 3DS2 message formats for the challenge/response flow.
- The Seeker app would need to parse and display card transaction details (merchant name, amount, card last-4-digits).
- Latency is critical — 3DS challenges have a timeout window (typically 5 minutes). The seal must be posted and confirmed within this window.

---

## 4. Securosys HSM on the Bank Side

### Why HSMs Matter for AlpenSign

On the client side, the Seeker's secure element acts as a **Mobile HSM** — keys never leave the hardware, and signing requires biometric confirmation. The bank side deserves equivalent security. When a bank issues credentials, verifies seals, or stores evidence, the cryptographic operations should be protected by enterprise-grade HSMs.

### Securosys Integration Points

Securosys, a Swiss HSM manufacturer, offers the **Primus Blockchain HSM** with native support for blockchain signing algorithms and a REST API for integration. Their **Smart Key Attributes (SKA)** module enables multi-authorization workflows — requiring multiple approvals before a key can be used — which maps directly to banking compliance requirements.

**Where Securosys HSMs fit in the AlpenSign architecture:**

| Function | How the HSM is Used |
|---|---|
| **Bank credential issuance** | The bank's SAS issuer key (used to sign attestations binding clients to Seeker wallets) is stored in the Primus HSM. Multi-authorization via SKA ensures that no single bank employee can issue or revoke credentials unilaterally. |
| **Seal verification signing** | When the bank's system verifies a transaction seal and records the result, the verification report is signed by an HSM-protected key, creating a tamper-proof audit trail. |
| **Evidence bundle signing** | Court-admissible evidence bundles (see Section 1b) are signed by the bank's HSM, establishing non-repudiation for the bank's own records. |
| **Key ceremony for onboarding** | When a bank first integrates with AlpenSign, the initial SAS schema creation and authority key generation happen inside the HSM, with a formal key ceremony documented for compliance. |

**Securosys CloudHSM** could also be offered as a lower-barrier entry point for banks that want to pilot AlpenSign without deploying on-premises hardware. CloudHSM provides the same API and security guarantees in a managed service model.

### The Full Trust Chain

With Securosys integration, the AlpenSign trust chain becomes fully hardware-anchored on **both** ends:

```
Client Side                          Bank Side
┌─────────────────────┐                  ┌─────────────────────┐
│  Seeker Phone        │                  │  Securosys HSM       │
│  Secure Element      │                  │  Primus / Cloud      │
│  (Mobile HSM)        │                  │  (Enterprise HSM)    │
│                      │                  │                      │
│  • Genesis Token     │    Solana +      │  • Issuer key        │
│  • Seal signing      │◄──── SAS ──────▶│  • Verification      │
│  • Biometric         │                  │  • Evidence sign     │
│    gating            │                  │  • Multi-auth        │
└─────────────────────┘                  └─────────────────────┘
```

---

## 5. Privacy Enhancements for On-Chain Data

### Current Privacy Model

AlpenSign's design avoids putting personal data on-chain — only cryptographic hashes and attestation proofs are stored on Solana. The immediate privacy fix (Section 0a) ensures the memo field contains only a SHA-256 hash, not readable payment details.

However, even hashed data can leak information through correlation: an observer watching the chain could link a wallet to a pattern of payment seals, inferring transaction frequency, timing, and (if amounts are included in the hash preimage) approximate financial activity.

### Enhancement Strategies

**5a. Zero-Knowledge Proofs for Seal Verification**

Instead of posting the full payment hash on-chain, the Seeker could generate a **zero-knowledge proof** that the seal was computed correctly — proving "I signed a payment of the correct amount to the correct recipient" without revealing the amount or recipient on-chain. The bank, as a trusted verifier, would still receive the full plaintext off-chain for its records.

Technologies to evaluate: **Groth16** (small proof size, fast verification, but requires trusted setup), **PLONK** (universal setup), or Solana-native options like **Light Protocol** which already implements ZK-compressed state on Solana.

**5b. Encrypted Memo / Attestation Data**

For SAS attestations, the data field could be **encrypted with the bank's public key** so that only the bank can decrypt the payment details. The on-chain record proves the attestation exists and when it was created, but the contents remain private. This is straightforward to implement with asymmetric encryption (e.g., X25519 + ChaCha20-Poly1305).

**5c. Rotating Wallet Addresses**

The Seeker could use **hierarchical deterministic (HD) key derivation** to generate a fresh wallet address for each seal, preventing transaction graph analysis. The bank credential (SAS attestation) would be issued to a master identity, with each derived address provably linked to the same identity via a ZK proof or a Merkle inclusion proof.

**5d. Off-Chain Seal Storage with On-Chain Anchoring**

A hybrid approach: the full seal data is stored off-chain (e.g., on IPFS, Arweave, or a bank-hosted server), while only a **compact commitment** (hash or Merkle root) is posted on-chain. This minimizes the on-chain footprint while preserving the immutability guarantee. The bank retrieves the full data from the off-chain store when needed for disputes.

---

## 6. Hardware Wallet Signing Support (Trezor, Ledger)

### Why Hardware Wallets?

Not every user will own a Solana Seeker phone. To broaden AlpenSign's reach beyond a single device, we should support signing with established **crypto hardware wallets** like Trezor and Ledger. These devices share the core security property that AlpenSign relies on: keys are generated and stored in a secure element, and signing requires physical confirmation on the device.

### Integration Approach

**6a. Ledger Integration**

Ledger devices support Solana transaction signing via the Ledger Solana app. The AlpenSign web or desktop app would connect to the Ledger via USB or Bluetooth, construct the seal transaction (or SAS attestation), and submit it to the device for physical confirmation (pressing both buttons).

- Use the `@ledgerhq/hw-transport-webhid` or `@ledgerhq/hw-transport-webusb` libraries for browser-based connection.
- The Ledger's display shows the transaction details — the AlpenSign app must format the payment information so it's human-readable on the Ledger's small screen.
- **Limitation:** Ledger devices don't have biometric confirmation. The physical button press is the authentication factor. AlpenSign's evidence chain would note "hardware wallet confirmation" rather than "biometric confirmation."

**6b. Trezor Integration**

Trezor supports Solana signing via the `@trezor/connect` SDK. Similar flow to Ledger — the transaction is constructed by the AlpenSign app and submitted to the Trezor for on-device confirmation.

- Trezor's larger screen (especially Trezor Model T and Trezor Safe) can display more payment detail than Ledger.
- **Limitation:** Same as Ledger — no biometric, only PIN + physical confirmation.

**6c. Device Identity Without Genesis Token**

The Genesis Token (soulbound NFT proving Seeker hardware) has no equivalent for Ledger/Trezor. Possible alternatives:

- **Manufacturer attestation:** Ledger's attestation certificate chain can prove the device is genuine Ledger hardware. This could be stored as an SAS attestation.
- **Self-sovereign device identity:** The hardware wallet generates a unique keypair at setup. The bank issues a credential to this keypair after verifying the client's identity through traditional KYC. Less decentralized than the Genesis Token, but still provides an independent signing key.

### Comparison of Signing Devices

| Feature | Solana Seeker | Ledger | Trezor |
|---|---|---|---|
| Secure element | ✓ (Seed Vault) | ✓ | ✓ (Model T+) |
| Biometric auth | ✓ | ✗ | ✗ |
| On-chain device identity | ✓ (Genesis Token) | ✗ (manufacturer attestation) | ✗ |
| Native Solana support | ✓ (SMS) | ✓ (Ledger app) | ✓ (Trezor Connect) |
| Form factor | Smartphone | USB dongle | USB device |
| Always-with-user | ✓ | Unlikely | Unlikely |

---

## 7. Demo Airline Booking Web App

### Purpose

A realistic demo scenario makes AlpenSign tangible. An **airline booking app** is ideal because it involves a meaningful payment amount (not a coffee, but a $500+ flight), has a clear fraud vector (friendly fraud on travel purchases is common), and involves a multi-step flow where the seal naturally fits.

### App Concept: "AlpenAir"

A fictional airline booking web application where a user can:

1. **Search flights** — Select origin, destination, dates. Display a few mock flight options with prices.
2. **Select a flight** — Choose seats, add baggage. Show a clear price breakdown.
3. **Proceed to payment** — Enter (or select) a payment method. This triggers the AlpenSign flow:
   - The web app sends the payment details to the bank simulator (Section 1a).
   - The bank simulator pushes a seal request to the Seeker via MWA / deep link.
   - The user reviews the payment on the Seeker: "AlpenAir GmbH — Flight ZRH→LHR — CHF 487.00 — Feb 28, 2026."
   - The user confirms with biometric. Seal is posted to Solana.
   - The web app receives confirmation and displays the boarding pass.
4. **Dispute simulation** — A "Dispute This Charge" button that shows the bank's evidence dashboard (Section 1a) with the full seal chain.

### Technical Stack

- **Frontend:** React or plain HTML/JS — the app itself should be simple; AlpenSign is the star.
- **Backend:** Node.js or Python server that coordinates between the airline app, the bank simulator, and the Solana network.
- **Deployment:** Static hosting (GitHub Pages or Vercel) for the frontend, with a lightweight API backend.

### Demo Flow Script

For hackathon presentations or investor demos, the flow would be:

```
[Laptop: AlpenAir website]         [Seeker Phone: AlpenSign app]
         │                                      │
         │  1. User books ZRH → LHR flight      │
         │  2. Clicks "Pay CHF 487.00"          │
         │                                      │
         │  3. Bank simulator creates request ──▶│ 4. Seal request appears
         │                                      │ 5. User reviews details
         │                                      │ 6. Biometric confirm
         │                                      │ 7. Seal posted to Solana
         │                                      │
         │  8. ◀── Seal confirmed ──────────────│
         │  9. Boarding pass displayed           │
         │                                      │
         │  10. User clicks "Dispute Charge"    │
         │  11. Bank evidence dashboard shows:  │
         │      ✓ Genesis Token (real Seeker)    │
         │      ✓ Bank credential (our client)   │
         │      ✓ Seal (biometric + on-chain)    │
         │      → Dispute rejected.              │
```

---

## 8. MWA Integration Hardening

> Lessons learned from real-world MWA debugging on Seeker hardware. These are not theoretical — each issue caused hours of debugging and silent failures.

### 8a. Known Constraints (Documented)

During v0.5.0–v0.5.4 development, seven critical constraints were discovered that are poorly documented in the MWA ecosystem:

| # | Constraint | Failure Mode |
|---|---|---|
| 1 | `authorize()` requires `chain`, not `cluster` | Silent 30s timeout, no Seed Vault UI appears |
| 2 | `identity.icon` must be a relative URI | Error `-32602`, authorization rejected |
| 3 | `transact()` must fire synchronously from click handler | Chrome blocks `solana-wallet://` Intent, MWA never launches |
| 4 | No network calls inside MWA sessions | RPC calls fail or timeout while Chrome is backgrounded |
| 5 | `signAndSendTransactions` returns `{ signatures: [Uint8Array] }` | Crash on signature decoding if assuming array or base64 |
| 6 | Seed Vault suppresses biometric UI during screen recording/overlays | Silent authorization failure, no error returned |
| 7 | Multi-step flows need fresh user gestures per MWA call | Seal flow requires dedicated tap target before each `transact()` |

All seven are documented in detail in `MWA_INTEGRATION_LEARNINGS.md`.

### 8b. Remaining MWA Improvements

- **Reauthorization token caching** — The MWA spec supports `auth_token` for faster reconnections. Currently AlpenSign requests fresh authorization every time. Caching the token (already stored in state) would skip the Seed Vault approval screen on subsequent seals within the same session.
- **`deauthorize()` on reset** — When the user resets AlpenSign, the app should call `deauthorize()` to clean up the MWA session on the wallet side, not just clear local state.
- **Timeout handling** — Currently, if the Seed Vault hangs (e.g., due to an undetected overlay), the user sees a spinner forever. Add a 30-second timeout with a clear error message and troubleshooting hints (check battery saver, overlays, screen recording).
- **Connection health indicator** — Show MWA connection status in the UI (connected / disconnected / error) so users know if the Seed Vault link is active.
- **On-chain seal verification button** — Add a "Verify on Solana" button in the History view for each seal. When tapped, the app fetches the transaction from Solana RPC, extracts the memo field, and compares it to the SHA-256 hash recomputed from the locally stored payment details. If they match: "✅ Evidence intact — local record matches on-chain proof." This is a powerful demo moment for hackathon judges — it shows the app independently proving that the on-chain data hasn't been tampered with and corresponds to the original payment.

### 8c. Native Android Migration

Alexandr is building a native Kotlin Android app using the Solana Mobile SDK directly. This eliminates all Chrome-specific workarounds:

- No user gesture expiry (Android Intents fire natively)
- No backgrounded-tab throttling for RPC calls
- Direct `SeedVault` API instead of MWA WebSocket relay
- Push notification delivery instead of simulated requests
- Access to Android `BiometricPrompt` API for finer control

The native app will replace the PWA→TWA bridge once it's ready. The web version remains as a fallback and for non-Seeker devices.

---

## 9. Real Payment Request Delivery

### Current State

AlpenSign uses a "Simulate Signing Request" button that generates a random payment from a hardcoded list of sample payments. This is adequate for the demo but obviously not production.

### Delivery Mechanisms (Ranked by Feasibility)

**9a. Deep Link / App Link**

The bank's system generates a URL like:

```
https://alpensign.com/seal?recipient=Acme+AG&amount=CHF+1500&iban=CH93...&ref=INV-2026-042&hash=a1b2c3...
```

Or for the native app: `alpensign://seal?...`

The bank sends this link via their existing notification channel (push, SMS, email). Tapping it opens AlpenSign with the payment pre-populated. Simple, works today, no backend needed.

**Limitation:** The payment data travels through the link, so it's visible in notification previews, SMS logs, etc. The hash parameter allows the app to verify data integrity.

**9b. Push Notifications (Firebase / APNs)**

The native app registers with Firebase Cloud Messaging. The bank's backend sends a push with a payment request ID. The app fetches the full payment details from the bank's server over TLS using this ID.

**Advantage:** Payment data never appears in the notification itself.
**Requirement:** Server-side component, Firebase setup, device registration flow.

**9c. WebSocket / Server-Sent Events**

For the web app: AlpenSign keeps a WebSocket connection open to a relay server. The bank pushes payment requests through the relay. The notification banner appears in real time.

**Advantage:** Works in the current web architecture.
**Disadvantage:** Requires the app to be open/active. WebSocket connections are unreliable on mobile (battery optimization kills them).

**9d. QR Code (Cross-Device)**

The bank's internet banking portal displays a QR code containing the payment request (or a URL to fetch it). The user scans with the Seeker camera, which opens AlpenSign.

**Best for:** Desktop-to-phone flows. The user is on their laptop in the bank portal and confirms on the Seeker.

---

## 10. Credential Recovery and Portability

### The Problem

AlpenSign's current state is entirely device-local:

- **WebAuthn credential** — Bound to the Seeker's platform authenticator (secure element). If the phone is lost, reset, or replaced, the credential is gone. There is no cross-device recovery for platform authenticator credentials.
- **MWA wallet address** — Stored in Seed Vault. Can be recovered if the user has their seed phrase, but the AlpenSign enrollment (binding the wallet to the bank credential) would need to be re-done.
- **Seal history** — Stored in `localStorage`. Lost on browser data clear, device reset, or app reinstall.

### Recovery Strategies

**10a. Bank-Side Re-Enrollment**

The simplest approach: if a user loses their device, they go through standard bank identity verification (in-branch, video-ident, etc.) and re-enroll a new Seeker. The bank revokes the old SAS credential and issues a new one. Historical seals remain on-chain and can be referenced by transaction signature.

**10b. Encrypted Cloud Backup of Seal History**

Seal history (not keys — never keys) could be backed up to an encrypted cloud store. The encryption key derives from the user's Seed Vault key (so only the user can decrypt). On a new device, after re-enrollment and Seed Vault recovery, the user can restore their seal history.

**10c. Passkey (WebAuthn) Cross-Device**

WebAuthn passkeys with the `"residentKey": "preferred"` option can sync across devices via platform-specific mechanisms (Google Password Manager, iCloud Keychain). However, this weakens the hardware-binding guarantee — the key is no longer exclusively in the Seeker's secure element. For production, this is a deliberate tradeoff between usability and security that the bank should configure.

**10d. Multi-Device Enrollment**

Allow a user to enroll multiple devices (e.g., Seeker phone + Ledger hardware wallet). Each device gets its own SAS credential linked to the same client identity. If one device is lost, the others remain active. The bank's credential management system handles the linkage.

**10e. Device Swap UX — "Hardware Handshake"**

The strategies above address the technical mechanics, but a bank UX designer will ask a sharper question: *"What does the customer actually experience when they lose their phone and get a new one?"* If the answer involves branch visits, multi-day waiting periods, or complex re-verification, banks won't adopt AlpenSign — regardless of how strong the cryptographic model is.

**Why this is simpler than it looks:**

AlpenSign has no server component and no user accounts. There is no "AlpenSign account" to migrate. The client's seal history lives permanently on Solana and is accessible by transaction signature from any device. So "device recovery" is really just "credential re-issuance" — a process banks already do routinely when a customer replaces a lost phone with a banking app.

**The device swap flow (target UX):**

```
Lost/broken Seeker                    New Seeker
─────────────────                    ──────────
                                     1. Unbox, set up Seeker OS
                                        → Genesis Token auto-minted
                                        → Seed Vault initialized

Bank revokes old credential          2. Open AlpenSign on new device
(automatic or client-triggered         → MWA wallet connect (new Seed Vault)
via online banking)                     → Genesis Token verified ✅

                                     3. Bank re-issues credential
                                        → Via existing identity channel
                                          (online banking, video-ident, branch)
                                        → New SAS credential → new device wallet
                                        → Enrolled ✅

                                     4. (Optional) Restore seal history
                                        → From encrypted cloud backup (10b)
                                        → Or: bank provides TX signatures
                                          for past seals (always on-chain)
```

**Key UX principle:** The new-device onboarding should be *identical* to first-time enrollment. No special "recovery mode," no separate flow, no support tickets. The client opens AlpenSign, connects the wallet, and the bank issues a credential — same three steps as day one. The only difference is that the bank's back-end knows this is a re-issuance (because the old credential was revoked) and may apply a faster verification path for known clients.

**What banks are already used to:** Every Swiss bank already handles "client lost phone, needs new mobile banking app" — typically through online banking re-activation or a letter code. AlpenSign's device swap plugs into this existing process. The bank's identity verification happens through the bank's own channels; AlpenSign simply receives the resulting credential.

**Seed phrase recovery consideration:** If the client backed up their Seed Vault seed phrase, they can restore the *same wallet address* on the new Seeker. This means the new credential can be bound to the same wallet, preserving a continuous on-chain identity. If they didn't back up the seed phrase, a new wallet is created — the bank credential simply points to the new address. Either path works; the seal history remains on-chain regardless.

**Design goal for v1.0:** Device swap should take under 5 minutes for a client who has access to their online banking. No branch visit. No phone call. No waiting period beyond the bank's own re-verification policy.

---

## 11. Mainnet Migration

### Current: Devnet

AlpenSign operates on Solana devnet. Transactions are free, confirmation is fast (but sometimes unreliable), and the data is ephemeral — devnet is periodically reset.

### When to Move to Mainnet

Mainnet migration is appropriate when:

1. **SAS attestations replace memo transactions** — Memos on mainnet cost real SOL with no composability benefit. SAS attestations justify the cost.
2. **Genesis Token integration is real** — Currently simulated. On mainnet, the Genesis Token NFT actually exists on the Seeker and can be verified.
3. **A bank pilot is confirmed** — No point paying mainnet fees for demo data.

### Cost Considerations

| Operation | Estimated Cost (mainnet) | Frequency |
|---|---|---|
| SAS credential issuance | ~0.002 SOL (~$0.30) | Once per client |
| Transaction seal (SAS attestation) | ~0.002 SOL (~$0.30) | Per payment |
| Credential revocation | ~0.001 SOL (~$0.15) | Rare |

At $0.30 per seal, a bank processing 10,000 payments/month would spend ~$3,000/month on Solana fees. This is trivial compared to fraud losses but should be modeled into pricing.

**Fee payer options:**

- **Bank pays** — The bank's server submits and pays for transactions. The Seeker signs but the bank's fee-payer account covers SOL costs. Cleanest model for institutional adoption.
- **Client pays** — The Seeker wallet holds a small SOL balance. Creates friction (user needs to acquire SOL) but aligns with the "independent from the bank" narrative.
- **Hybrid** — Bank sponsors a fee-payer that covers transaction costs for enrolled clients.

---

## 12. Pitch Deck

A presentation tailored for the hackathon judges and subsequent investor/partner conversations.

**Suggested structure (8–10 slides):**

1. **Problem** — Banks lose billions to fraud. Their only defense is self-serving logs.
2. **Solution** — Independent, on-chain, biometric-confirmed payment seals.
3. **How it works** — Three-layer trust model (one visual).
4. **Demo** — Link to demo video or live demo reference.
5. **Why Seeker** — What's not possible on iPhone/Pixel (the moat).
6. **Market** — Friendly fraud costs, regulatory tailwinds (PSD2/SCA, eIDAS).
7. **Business model** — Per-seal fee, bank licensing, potential 3DS integration.
8. **Roadmap** — Hackathon → Bank pilot → SAS migration → 3DS.
9. **Team** — Roman, Alexandr, AI engineering partner.
10. **Ask** — Hackathon prize, bank pilot partner, Solana Foundation support.

---

## Prioritization (Updated)

| Extension | Effort | Impact | Priority | Status |
|---|---|---|---|---|
| **Memo privacy fix** | Tiny | **Critical** — plaintext IBANs on devnet | 🔴 P0 | Open |
| **Genesis Token verification** | Small | **Critical** — makes Layer 1 real, not simulated | 🔴 P0 | Open |
| **dApp Store submission (PWA path)** | Medium | **Critical** — required for hackathon | 🔴 P0 | Open |
| **Demo video** | Small | **Critical** — judges won't install the app | 🔴 P0 | Scripted |
| **Fresh screenshots** | Small | **High** — landing page looks outdated | 🔴 P0 | Open |
| Bank simulator for demo | Medium | **High** — completes the demo story | 🟠 P1 | Open |
| Demo airline booking app | Medium | **High** — makes the demo relatable | 🟠 P1 | Open |
| Migrate to SAS attestations | Medium | **High** — aligns with Solana ecosystem | 🟠 P1 | Open |
| MWA reauthorization + timeout | Small | **Medium** — better UX on Seeker | 🟠 P1 | Open |
| On-chain seal verification button | Small | **High** — compelling demo moment for judges | 🟠 P1 | Open |
| ISO 20022 alignment for SAS schemas | Small | **High** — credibility with bank partners | 🟠 P1 | Open |
| Pitch deck | Small | **High** — needed for all audiences | 🟠 P1 | Open |
| Hackathon adaptations (StableHack, SwissHacks) | Small | **High** — multiply submission value | 🟠 P1 | Planned |
| Partner outreach (Securosys, Netcetera, Ergon, Viseca) | Small | **High** — validates GTM before building | 🟠 P1 | Open |
| Real payment delivery (deep links) | Medium | **Medium** — replaces simulate button | 🟡 P2 | Open |
| Privacy enhancements (ZK, rotation) | High | **Medium** — important for production | 🟡 P2 | Open |
| AlpenSign SDK for banks | High | **High** — the real product | 🟡 P2 | Open |
| Securosys HSM integration | High | **Medium** — enterprise credibility | 🟡 P2 | Open |
| Credential recovery | Medium | **Medium** — required for production | 🟡 P2 | Open |
| Mainnet migration | Medium | **Medium** — only after SAS + pilot | 🟡 P2 | Open |
| Native Android app | High | **High** — replaces PWA bridge | 🟡 P2 | In progress |
| 3D Secure integration (Netcetera ACS) | Very High | **Very High** — massive market | 🔵 P3 | Open |
| Hardware wallet support | Medium | **Medium** — broadens device support | 🔵 P3 | Open |
| Colosseum hackathon submission | Medium | **High** — global visibility | 🔵 P3 | Planned |

---

## 13. Hackathon Strategy — Reuse and Adaptation

### Monolith (Solana Seeker Hackathon, Q1 2026)

The primary submission. AlpenSign is purpose-built for Seeker hardware and the Solana Mobile Stack. Emphasis: Genesis Token, Seed Vault, MWA, TEEPIN, SAS — the full Solana-native trust chain.

### StableHack

Stablecoin-focused hackathon. AlpenSign's thesis adapts naturally: the transaction seals prove authorization of **stablecoin payments**, not just fiat bank transfers. Reframe the demo around USDC/EURC transfers sealed on-chain. The same architecture applies — the Seeker signs a stablecoin transfer and posts the seal as independent proof.

**Adaptation needed:**
- Add a stablecoin payment type to the seal flow (USDC amount, recipient wallet, network)
- Optionally integrate with a stablecoin payment rail (e.g., Circle's USDC on Solana)
- Pitch angle: "Stablecoin payments need the same dispute resolution infrastructure as traditional banking. AlpenSign provides it."

### SwissHacks

Swiss fintech hackathon — strong fit given AlpenSign's Swiss banking focus. Pitch angle shifts to **regulatory alignment**: ZertES, FINMA, PSD2/SCA, eIDAS. Emphasize the Swiss-made trust chain (Securosys HSMs on the bank side, Solana Seeker on the client side).

**Adaptation needed:**
- Highlight Swiss payment systems (SIC, SEPA via SIX)
- Bank simulator (Section 1a) becomes higher priority — SwissHacks judges are banking industry insiders who want to see both ends
- Reference specific Swiss regulations and compliance frameworks
- Consider partnering with a Swiss bank innovation team for the hackathon

### Colosseum

Solana's flagship hackathon, global scope, larger prize pools. AlpenSign competes against a broader field — needs to show ecosystem impact beyond banking.

**Adaptation needed:**
- Broader framing: "Attestation-based authorization for any high-value transaction" — not just bank payments
- Show SAS integration (should be implemented by then)
- Demonstrate composability: other dApps can verify AlpenSign seals
- Mainnet deployment (at least for the credential layer)

### Cross-Hackathon Reuse Checklist

| Asset | Monolith | StableHack | SwissHacks | Colosseum |
|---|---|---|---|---|
| Core app (Seeker) | ✅ As-is | ✅ + stablecoin type | ✅ As-is | ✅ + SAS migration |
| Landing page | ✅ As-is | Tweak hero copy | Add Swiss regulatory section | Broaden beyond banking |
| Demo video | ✅ Record new | Re-record with USDC flow | Re-record with bank simulator | Re-record on mainnet |
| Pitch deck | ✅ Create | Swap slides 1,6,7 | Swap slides 5,6,7 | Rewrite for global scope |
| Bank simulator | Optional | Optional | Strongly recommended | Expected |
| llms.txt | ✅ Current | Add stablecoin section | Add regulatory detail | Add SAS/mainnet detail |

---

## 14. Go-to-Market — Swiss Partner Ecosystem

### Strategy

AlpenSign's go-to-market follows a **partnership-first** approach. Rather than selling directly to banks (long sales cycles, compliance procurement, vendor onboarding), AlpenSign integrates with companies that already have bank relationships and sell into the same trust/security/authentication budget.

Four Swiss companies sit at natural integration points in the AlpenSign value chain:

### 14a. Securosys — Bank-Side HSM

**What they do:** Swiss HSM manufacturer. Primus Blockchain HSM, CloudHSM, Smart Key Attributes (SKA) for multi-authorization. Used by Swiss banks, SIX, and financial infrastructure providers.

**Why they fit:** AlpenSign needs enterprise-grade key management on the bank side (Section 4). Securosys provides exactly this — and already has the bank relationships. The pitch to Securosys: "AlpenSign creates demand for HSM-protected credential issuance and seal verification. Every bank that adopts AlpenSign needs a Securosys HSM (or CloudHSM subscription) for the bank-side key management."

**Integration point:** Bank credential issuance keys, seal verification signing, evidence bundle signing — all HSM-protected via Securosys REST API.

**Engagement model:** Technology partnership. Joint solution architecture. Securosys references AlpenSign as a use case for Primus Blockchain HSM in banking. AlpenSign references Securosys as the recommended bank-side HSM.

**Contact angle:** Securosys has a blockchain team and attends Swiss fintech events. They've published case studies on blockchain key management for banks. A hackathon win (especially SwissHacks) provides a natural introduction.

### 14b. Netcetera — 3D Secure Infrastructure

**What they do:** Swiss software company providing 3D Secure ACS (Access Control Server) and payment authentication solutions to card issuers across Europe. Their 3DS platform handles the challenge/response flow when a cardholder makes an online purchase.

**Why they fit:** AlpenSign's 3DS integration (Section 3) needs an ACS provider as the entry point. Netcetera's ACS is the system that decides how to challenge the cardholder. Today it sends a push notification to the bank's app. AlpenSign would be an alternative or additional challenge method routed through Netcetera's ACS.

**Integration point:** Netcetera's ACS triggers an AlpenSign seal request instead of (or alongside) a push notification. After the seal is posted, the ACS receives confirmation and returns a successful 3DS authentication to the merchant.

**Engagement model:** Technology integration. Netcetera adds "AlpenSign" as a challenge method in their ACS configuration. Card issuers can opt in per cardholder segment (e.g., Seeker-owning clients).

**Contact angle:** Netcetera is headquartered in Zürich and active in Swiss fintech circles. They sponsor and attend events like Swiss Payment Forum and Finance 2.0. The 3DS angle is their core business — a novel challenge method backed by on-chain proof is genuinely differentiated from their current push notification approach.

### 14c. Ergon / Airlock — API Security Gateway

**What they do:** Ergon Informatik (Zürich) builds Airlock, an API security gateway and identity management platform used by Swiss banks for securing online and mobile banking interfaces. Airlock handles authentication, authorization, and API protection.

**Why they fit:** When a bank integrates AlpenSign, the seal request and verification flows need to pass through the bank's API security layer. Airlock is that layer for many Swiss banks. Rather than asking banks to build a custom AlpenSign integration, the integration happens at the Airlock level — meaning any bank running Airlock gets AlpenSign support as a gateway plugin or authentication module.

**Integration point:** Airlock Gateway routes seal requests from the bank's payment engine to the AlpenSign SDK. Airlock IAM (identity and access management) maps the AlpenSign wallet credential to the bank's internal client identity. Seal verification results flow back through Airlock to the payment engine.

**Engagement model:** Technology integration. AlpenSign provides an Airlock-compatible module that Ergon can offer to their banking customers. This is how other authentication methods (FIDO2, SMS OTP) are typically integrated — as Airlock modules.

**Contact angle:** Ergon is deeply embedded in Swiss banking IT. They understand the procurement cycle and compliance requirements better than almost anyone. An Airlock integration de-risks AlpenSign adoption for banks because it fits into their existing security architecture.

### 14d. Viseca / Viseca One — Card Issuer + Consumer App

**What they do:** Viseca is a major Swiss card issuer (Visa, Mastercard) owned by Aduno Group. The Viseca "one" app handles card management and 3DS authentication for Swiss cardholders — it's the app that pops up when you make an online purchase and need to confirm.

**Why they fit:** Viseca is both a potential **customer** (they process card disputes and eat friendly fraud losses) and an **integration partner** (their "one" app is the natural surface for AlpenSign's 3DS flow). If Viseca integrates AlpenSign into the "one" app, every 3DS challenge could optionally be AlpenSign-sealed — giving Viseca independent proof of cardholder authorization.

**Integration point:** Two options:
1. **Embedded:** AlpenSign's seal logic runs inside the Viseca "one" app. When a 3DS challenge arrives, the app shows payment details and seals the confirmation on Solana before responding to the ACS.
2. **Companion:** Viseca "one" delegates to the standalone AlpenSign app on the Seeker via deep link or MWA. The seal result returns to Viseca "one" which forwards it to the ACS.

**Engagement model:** Customer + integration partner. Viseca has innovation teams exploring new authentication methods. A proof-of-concept showing AlpenSign seals for card transactions — with real on-chain evidence that defeats friendly fraud claims — is a compelling business case.

**Contact angle:** Viseca sponsors Swiss fintech events and has an open innovation program. The pitch: "For every disputed card transaction you can't prove was authorized, you lose the chargeback. AlpenSign gives you proof that survives court."

### Partner Engagement Sequence

```
Phase 1 (Hackathon)         Phase 2 (Pilot)              Phase 3 (Production)
                                                           
Securosys ──── Joint demo ──── CloudHSM pilot ──────────── Primus HSM deployment
                                                           
Netcetera ──── 3DS concept ──── ACS sandbox test ────────── Challenge method GA
                                                           
Ergon ──────── Airlock POC ──── Module development ──────── Certified module
                                                           
Viseca ─────── Innovation pitch ── "one" app pilot ──────── Rolled out to cardholders
```

### Beyond Switzerland

The Swiss partner ecosystem provides a credible launchpad, but the model scales:

- **EU:** Same regulatory framework (eIDAS, PSD2/SCA). Netcetera already operates across Europe. Partner with EU card issuers and ACS providers.
- **UK:** Post-Brexit regulatory alignment on SCA. Strong fintech market. Partner with UK payment processors.
- **US:** Different regulatory environment but same friendly fraud problem. US market needs a different pitch (less regulatory, more cost-of-fraud).

---

## Summary

AlpenSign's core thesis — using the Seeker as a Mobile HSM to create independent, on-chain evidence of payment authorization — is sound and has been validated end-to-end on real hardware. The v0.5.5 prototype successfully completes the full flow: WebAuthn enrollment, Seed Vault wallet connection via MWA, biometric-gated payment sealing, and Solana devnet posting with verifiable on-chain proof.

The immediate priority is fixing the memo privacy issue and submitting to the dApp Store before the hackathon deadline. The app and supporting materials (landing page, pitch deck, demo video) can be adapted for StableHack, SwissHacks, and Colosseum with targeted modifications per hackathon theme.

The medium-term roadmap follows a natural progression: first, complete the demo story (bank simulator + airline app), then deepen the technical foundation (SAS migration + privacy + MWA hardening), then build the real product (SDK + HSM + native app), and finally expand to adjacent markets (3D Secure + hardware wallets).

Go-to-market is partnership-first: Securosys (HSM), Netcetera (3DS), Ergon/Airlock (API gateway), and Viseca (card issuer + consumer app) form a Swiss ecosystem that can take AlpenSign from hackathon demo to bank pilot without a massive direct sales effort.

Each extension reinforces the central message: **banks should not be the sole keeper of their own evidence.** AlpenSign gives them — and their clients — a neutral, cryptographic, immutable record that neither side controls alone.

---

*Document prepared for the AlpenSign project — [github.com/gbits-io/alpensign](https://github.com/gbits-io/alpensign)*
*February 2026 · v2 (extended with implementation learnings from MWA integration)*
