# AlpenSign × vLEI Integration

> How Verifiable Legal Entity Identifiers fit into the AlpenSign evidence chain — and why they complete the picture that swiyu E-ID starts.

**Last updated:** 2026-02-20

---

## What is vLEI — In 30 Seconds

The vLEI (verifiable Legal Entity Identifier) is the cryptographic, machine-verifiable version of the LEI — the 20-digit code that identifies legal entities in financial transactions (ISO 17442). It's governed by GLEIF (Basel, Switzerland) and built on the KERI/ACDC protocol stack.

The key insight: vLEI doesn't just identify organizations — it binds **people to roles within organizations** through a cryptographic trust chain.

**Three credential types matter for AlpenSign:**

| Credential | What it proves | Issued by |
|-----------|----------------|-----------|
| **Legal Entity vLEI** | "This organization (LEI: 5067...) exists and is verified" | Qualified vLEI Issuer (QVI) → to the bank |
| **OOR** (Official Organizational Role) | "This person is the CEO / CFO / Director of this organization" | QVI → to the person, verified against public records (ISO 5009 roles) |
| **ECR** (Engagement Context Role) | "This person has role X in the context of this organization" — custom roles | The organization itself → to the person |

The trust chain traces back to GLEIF as root of trust:

```
GLEIF (Root of Trust)
  └─▶ Qualified vLEI Issuer (QVI)
        └─▶ Legal Entity vLEI Credential (bank has LEI: 5067...)
              └─▶ OOR Credential (person X is CFO of bank 5067...)
              └─▶ ECR Credential (person Y is "authorized payment approver" at bank 5067...)
```

Every link is cryptographically verifiable via ACDC credential chaining. Revocation at any level invalidates everything below it.

---

## Why: What Problem Does vLEI Solve for AlpenSign?

### The swiyu E-ID gap

The swiyu integration (see `ALPENSIGN_SWIYU_INTEGRATION.md`) makes Layer 2 — client identity — independent of the bank. The Swiss E-ID proves "this person is Roman Koivu, confirmed by the federal government." Strong for individuals.

But AlpenSign's real market is **corporate banking**, where the question isn't just "who is this person?" but:

- **"Is this person authorized to approve payments for this company?"**
- **"Which company is this payment on behalf of?"**
- **"Can this person bind this legal entity to a financial obligation?"**

The E-ID answers "who." The vLEI answers **"who, for whom, in what role, with what authority."**

### The complete evidence chain with vLEI

| Layer | What it proves | Source | Independent? |
|-------|---------------|--------|-------------|
| 1. Device Identity | Genuine Seeker hardware | Genesis Token (TEEPIN) | ✅ |
| 2a. Person Identity | This is Roman Koivu | Swiss E-ID (swiyu) | ✅ |
| 2b. Role & Authority | Roman Koivu is CFO of Acme AG (LEI: 5067...) | vLEI ECR/OOR (GLEIF trust chain) | ✅ |
| 3. Payment Authorization | This specific payment was biometrically confirmed | Transaction Seal (Seed Vault + Solana) | ✅ |

**Without vLEI:** "Roman Koivu authorized this payment." → But who is Roman Koivu to this company? The bank knows internally, but the evidence is again bank-produced.

**With vLEI:** "Roman Koivu, CFO of Acme AG (LEI: 506700GE1G29325QX363), authorized this payment — role verified by GLEIF-qualified issuer, traceable to GLEIF root of trust." → The role and authority are independently verifiable, globally.

### Why banks should care

1. **Regulatory alignment** — GLEIF was created by the Financial Stability Board on behalf of the G20. LEI is already mandatory for derivatives, securities, and many payment types. vLEI extends this to digital identity. Banks already have LEIs; vLEI is the natural next step.

2. **Dual-entity disputes** — In corporate banking, disputes often involve questions of authority: "Did this person have the right to authorize this payment?" Today, the bank checks its own internal records. With vLEI, the authority chain is externally verifiable.

3. **KYB (Know Your Business) automation** — vLEI pilot data shows compliance cost reductions of up to 90% and manual operations reduced by 80%. For AlpenSign, the enrollment step could verify both the person (E-ID) and their corporate authority (vLEI) in seconds, replacing manual corporate resolution checks.

4. **Swiss connection** — GLEIF is headquartered in Basel. GLEIF and the Swiss Federal Statistical Office have partnered to link LEI records directly to the Swiss UID register. Switzerland is a natural vLEI adoption market.

---

## How: Two Integration Models

### Model A: Bank Issues ECR to Client (Corporate Banking)

The bank itself holds a Legal Entity vLEI. It issues an **ECR credential** to the client — e.g., role = "Authorized Payment Approver" or "Signatory with limit CHF 500,000."

```
GLEIF
  └─▶ QVI (e.g., Nord vLEI, Global vLEI)
        └─▶ Bank's Legal Entity vLEI (LEI: 5067...)
              └─▶ ECR: "Roman Koivu is Authorized Signatory at Acme AG"
                    (issued by the bank to the client)
```

**Pros:** The bank controls the credential lifecycle. Revocation = instant access removal. The role is specific to the banking relationship.

**Cons:** The ECR is bank-issued — so in a dispute, the bank produced the authority proof. However, the *trust chain* (GLEIF → QVI → Bank) is independently verifiable, and the bank can't forge GLEIF's root signature. This is a weaker form of independence than the E-ID, but much stronger than an internal database entry.

### Model B: Client's Company Issues ECR/OOR (Strongest)

The client's own company holds a Legal Entity vLEI. The company issues an **OOR or ECR credential** to the person: "Roman Koivu is CFO of Acme AG" or "Roman Koivu is authorized to approve payments up to CHF 1M."

```
GLEIF
  └─▶ QVI
        └─▶ Acme AG's Legal Entity vLEI (LEI: 5493...)
              └─▶ OOR: "Roman Koivu is CFO of Acme AG"
                    (verified against Handelsregister / board minutes)
```

**Pros:** The bank didn't produce any part of this credential. The client's own organization attested to the role, verified by the QVI against public records. In a dispute, the evidence is: "The client's own company confirmed his authority — we (the bank) merely verified a credential we didn't issue."

**Cons:** Requires the client's company to have a vLEI and to issue role credentials. This is early-stage; most companies don't have vLEIs yet.

### Recommended: Start with Model A, enable Model B

For the hackathon and initial pilots, Model A is realistic — the bank issues ECR credentials to its corporate clients. As vLEI adoption grows, Model B becomes the premium tier. AlpenSign should support both.

---

## How: Technical Integration

### Where vLEI Credentials Live

vLEI credentials are ACDC (Authentic Chained Data Containers) based on KERI. They don't live in a browser or in Solana — they live in **organizational wallets** (e.g., the KERI agent software). Verification happens via the GLEIF vLEI verifier service.

### Integration Architecture

```
┌─────────────────────┐     ┌──────────────────────────┐     ┌──────────────────┐
│  AlpenSign App       │     │  AlpenSign API Server     │     │  vLEI Verifier    │
│  (Seeker / browser)  │     │  (Node.js)                │     │  (GLEIF open-src) │
│                      │     │                           │     │  github.com/      │
│                      │     │                           │     │  GLEIF-IT/        │
│ 1. Present vLEI      │────▶│ 2. PUT /presentations/    │────▶│  vlei-verifier    │
│    credential        │     │    {said}                 │     │                   │
│    (ACDC/CESR)       │     │    with credential body   │     │ 3. Verifies:      │
│                      │     │                           │     │  - ACDC chain     │
│                      │     │                           │     │  - KERI KEL       │
│                      │     │                           │     │  - Revocation     │
│                      │     │                           │     │  - Root of Trust  │
│                      │     │ 4. GET /authorizations/   │     │                   │
│                      │◀────│    {aid}                  │◀────│ 5. Returns 200    │
│                      │     │    poll until result      │     │    + AID + SAID   │
│ 6. Display:          │     │                           │     │                   │
│ "✅ vLEI verified:   │     │                           │     │                   │
│  CFO, Acme AG"       │     │                           │     │                   │
└─────────────────────┘     └──────────────────────────┘     └──────────────────┘
```

### The vLEI Verifier Service

GLEIF provides an open-source vLEI verification service: `github.com/GLEIF-IT/vlei-verifier`. It's a Python service using `keripy` that:

- Accepts ACDC credential presentations via `PUT /presentations/{said}`
- Verifies the full credential chain back to GLEIF's root of trust
- Checks revocation status of every credential in the chain
- Returns authorization status via `GET /authorizations/{aid}`

It requires a running KERI witness network and vLEI server, which makes it heavier than the swiyu generic verifier. For a hackathon prototype, the verifier can run locally or be mocked.

### Presentation Flow

For the prototype, the most realistic flow is:

1. **During enrollment**, after E-ID verification, AlpenSign offers "Verify Corporate Role (vLEI)"
2. The user presents their ECR/OOR credential — in the prototype, this could be a QR code scan from a KERI wallet app, or a file upload of the ACDC credential in CESR format
3. AlpenSign's backend sends the credential to the vLEI verifier
4. The verifier validates the chain and returns the person's role, organization LEI, and organization name
5. AlpenSign stores the result and displays it in the enrollment summary

**Note on credential presentation:** Unlike swiyu (which has a well-defined OID4VP deep link flow), the vLEI ecosystem doesn't yet have a standardized mobile wallet-to-verifier protocol for consumer use. The KERI ecosystem uses OOBI (out-of-band introduction) and IPEX (issuance/presentation exchange) protocols. For a hackathon, the simplest path is to accept the credential as a CESR-encoded payload via API rather than building a wallet-to-wallet flow.

---

## How vLEI Fits With the Full Stack

```
                    ┌─────────────────────────────────────────┐
                    │           EVIDENCE CHAIN                 │
                    │                                          │
    ┌───────────────┼──────────────────────────────────────────┤
    │ LAYER 1       │  DEVICE IDENTITY                         │
    │ Seeker phone  │  Genesis Token (TEEPIN/Guardians)        │
    │ SMS           │  Seed Vault hardware secure element      │
    │               │  Android Key Attestation (Google TEE)    │
    ├───────────────┼──────────────────────────────────────────┤
    │ LAYER 2a      │  PERSON IDENTITY                         │
    │ swiyu E-ID    │  Swiss federal government verifies       │
    │               │  "This person is Roman Koivu"            │
    │               │  Protocol: OID4VP, SD-JWT VC             │
    ├───────────────┼──────────────────────────────────────────┤
    │ LAYER 2b      │  ROLE & AUTHORITY                        │
    │ vLEI          │  GLEIF trust chain verifies              │
    │               │  "Roman Koivu is CFO of Acme AG"         │
    │               │  Protocol: KERI/ACDC, CESR               │
    ├───────────────┼──────────────────────────────────────────┤
    │ LAYER 3       │  PAYMENT AUTHORIZATION                   │
    │ AlpenSign     │  Seed Vault biometric + Solana seal      │
    │ Solana        │  "Wallet X authorized payment Y"         │
    │               │  Protocol: MWA, Solana memo/SAS          │
    └───────────────┼──────────────────────────────────────────┘
                    │
                    ▼
              BANK RECEIVES:
              No piece of evidence was created by the bank.
              Device: TEEPIN (decentralized)
              Person: Swiss government (federal)
              Role: GLEIF trust chain (global)
              Payment: Solana (decentralized)
```

### swiyu E-ID vs vLEI — Complementary, Not Competing

| Dimension | swiyu E-ID | vLEI |
|-----------|-----------|------|
| **What it proves** | Person's identity (name, DOB) | Person's role within an organization |
| **Issued by** | Swiss federal government | GLEIF-qualified issuer or the organization itself |
| **Scope** | Swiss nationals/residents | Any legal entity globally (with an LEI) |
| **Protocol** | OID4VP, SD-JWT VC | KERI, ACDC, CESR |
| **Wallet** | swiyu app (mobile) | KERI-based wallet (less consumer-mature) |
| **Maturity** | Public Beta, production ~Q3 2026 | Live (QVIs issuing since 2024), but early adoption |
| **Use in AlpenSign** | Layer 2a — "who is this person?" | Layer 2b — "what authority does this person have?" |

**They work together:** E-ID verifies the natural person. vLEI verifies their corporate authority. You need both for corporate banking; you only need E-ID for retail banking.

---

## Impact on AlpenSign User Interface

### Enrollment Step 2 — Extended

Currently: Seed Vault connection + Genesis Token check + (future) E-ID verification.

With vLEI, the enrollment step 2 gains a fourth check for corporate users:

```
┌─────────────────────────────────────────────────┐
│  ENROLLMENT — Step 2: Verify Your Identity       │
│                                                   │
│  ✅ Seed Vault connected: 7xKp...3mNq            │
│  ✅ Genesis Token verified                        │
│  ✅ Swiss E-ID verified: Roman Koivu              │
│  ✅ Corporate role verified: CFO, Acme AG         │
│     LEI: 5493001KJTIIGC8Y1R12                     │
│     Issued by: Nord vLEI (QVI)                    │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │ Trust Level: ████████████████████ MAXIMUM   │  │
│  │ All 4 layers independently verified         │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  [Continue to complete enrollment]                │
└─────────────────────────────────────────────────┘
```

### Adaptive Trust Levels

Not every user will have all credentials. The UI should show which layers are verified and what trust level that achieves:

| Verified layers | Trust level | Suitable for |
|----------------|-------------|-------------|
| Seed Vault only | Basic | Demo / testing |
| Seed Vault + Genesis Token | Device-verified | Low-value transactions |
| + E-ID | Person-verified | Retail banking |
| + vLEI (ECR/OOR) | **Full corporate** | Corporate payments, regulatory filings |

The home screen shows the current trust level as a badge:

```
┌─────────────────────────────────┐
│  🔒 Trust Level: Corporate      │
│  Device ✓  Person ✓  Role ✓     │
└─────────────────────────────────┘
```

### History View — Enhanced Seal Details

Each sealed transaction shows which credentials were active at seal time:

```
┌─────────────────────────────────────────┐
│  Payment #47                             │
│  CHF 150,000 → Supplier GmbH            │
│  Sealed: 2026-03-15 14:32 UTC            │
│                                          │
│  Evidence:                               │
│  🔐 Genesis Token: verified              │
│  👤 E-ID: Roman Koivu                    │
│  🏢 vLEI: CFO, Acme AG (LEI: 5493...)   │
│  ⛓️  Solana TX: 4xMn...7pQr              │
│                                          │
│  [Verify on Solana]                      │
└─────────────────────────────────────────┘
```

---

## Data Storage

| Data | Where | Why |
|------|-------|-----|
| Verified role (e.g., "CFO") | `localStorage` | Display in UI |
| Organization name + LEI | `localStorage` | Display in UI |
| Verification timestamp | `localStorage` | Records when vLEI was verified |
| Credential SAID (hash) | `localStorage` | Reference to the credential |
| Full ACDC credential | **Server-side only** | Cryptographic proof for disputes |

### State Schema Addition

```javascript
{
  // ... existing fields ...
  vleiVerified: false,
  vleiRole: null,               // "CFO" or "Authorized Payment Approver"
  vleiRoleType: null,           // "OOR" or "ECR"
  vleiOrgName: null,            // "Acme AG"
  vleiOrgLEI: null,             // "5493001KJTIIGC8Y1R12"
  vleiCredentialSAID: null,     // SAID of the ACDC credential
  vleiVerifiedAt: null,         // ISO timestamp
  vleiQVI: null                 // "Nord vLEI" — who issued the chain
}
```

---

## Implementation Priority

| Phase | What | When |
|-------|------|------|
| **Hackathon (now)** | Mock vLEI verification in UI — hardcoded demo data showing what it would look like. Mention vLEI in pitch deck as "roadmap: corporate authority verification." | Monolith / SwissHacks |
| **Pilot (Q3 2026)** | Real vLEI verification via GLEIF verifier. Bank issues ECR credentials to pilot corporate clients. | Bank pilot |
| **Production** | Full integration with Model A (bank-issued ECR) and Model B (client-org OOR). Trust level system in UI. | Post-pilot |

The vLEI ecosystem is real and live (QVIs are issuing credentials since 2024), but consumer-facing wallet flows are less mature than swiyu. For the hackathon, the story and the UI mockup are more valuable than a working integration. For a bank pilot, it's ready to build.

---

## How To Get a vLEI (For Koivu/Gbits or a Pilot Bank)

1. The entity must have an active LEI (obtainable via SwissLEI or any GLEIF-accredited issuer, ~CHF 90/year)
2. Contact a Qualified vLEI Issuer (QVI). Currently 7+ QVIs globally; the closest European QVI is **Nord vLEI** (Stockholm) or **Global vLEI** (globalvlei.com)
3. QVI validates the entity's LEI status, verifies authorized representatives
4. QVI issues a Legal Entity vLEI Credential
5. The entity can then issue ECR credentials to its representatives, or request OOR credentials from the QVI for its officers

For a hackathon demo, the GLEIF provides test infrastructure with a local root of trust — no need for a real LEI.

---

## Reference Links

| Resource | URL |
|----------|-----|
| GLEIF vLEI overview | https://www.gleif.org/en/organizational-identity/introducing-the-verifiable-lei-vlei |
| vLEI ecosystem governance framework | https://www.gleif.org/en/organizational-identity/introducing-the-verifiable-lei-vlei/introducing-the-vlei-ecosystem-governance-framework |
| List of Qualified vLEI Issuers | https://www.gleif.org/en/organizational-identity/get-a-vlei-list-of-qualified-vlei-issuing-organizations |
| vLEI Verifier (open source) | https://github.com/GLEIF-IT/vlei-verifier |
| Regulatory PoC Verifier | https://github.com/GLEIF-IT/reg-poc-verifier |
| KERI/ACDC architecture explainer | https://www.ubisecure.com/legal-entity-identifier-lei/understanding-vlei-keri-architecture/ |
| vLEI wiki | https://www.vlei.wiki/ |
| Nord vLEI (first European QVI) | https://nordlei.org/what-is-vlei |
| GLEIF × Swiss UID register link | https://www.gleif.org/en/newsroom/press-releases/gleif-and-swiss-federal-statistical-office-launch-direct-data-link-to-boost-global-visibility-of-swiss-businesses |
| SwissLEI (LEI issuer for Switzerland) | https://swisslei.ch/ |
| SATP × vLEI binding (IETF draft) | https://datatracker.ietf.org/doc/html/draft-smith-satp-vlei-binding-01 |

---

*Document prepared for the AlpenSign project*
*February 2026*
