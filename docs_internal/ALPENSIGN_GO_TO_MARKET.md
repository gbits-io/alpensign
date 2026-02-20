# AlpenSign — Go-to-Market: Swiss Partner Ecosystem

> A partnership-first strategy for taking AlpenSign from hackathon demo to bank pilot — by plugging into the companies that already own the trust, security, and payment infrastructure relationships with Swiss banks.

**Last updated:** 2026-02-20

---

## Strategy

AlpenSign's go-to-market follows a **partnership-first** approach. Selling directly to banks means long sales cycles, compliance procurement, vendor onboarding, and proof-of-concept committees. Instead, AlpenSign integrates with companies that already sit inside the bank's technology stack — companies that sell into the same trust, security, and authentication budgets.

Five Swiss companies sit at natural integration points in the AlpenSign value chain. Each one already has the bank relationships. AlpenSign gives them a new story to tell their existing customers.

```
                        ┌─────────────────────────────┐
                        │   SWISS BANK                 │
                        │                              │
  ┌──────────────┐      │   ┌──────────┐ ┌──────────┐ │
  │ AlpenSign    │      │   │ Airlock  │ │ SASS     │ │
  │ Seeker App   │◀────▶│   │ (Ergon)  │ │ (ELCA)   │ │
  │              │      │   │ API GW   │ │ SIC I/F  │ │
  └──────────────┘      │   └────┬─────┘ └────┬─────┘ │
                        │        │             │       │
                        │   ┌────▼─────────────▼─────┐ │
                        │   │   Securosys HSM         │ │
                        │   │   (Primus / CloudHSM)   │ │
                        │   └─────────────────────────┘ │
                        │                              │
                        │   ┌──────────┐ ┌──────────┐ │
                        │   │Netcetera │ │ Viseca   │ │
                        │   │ 3DS ACS  │ │ one App  │ │
                        │   └──────────┘ └──────────┘ │
                        └─────────────────────────────┘
```

**The pitch to each partner is the same:** "Your customers (banks) lose millions to payment disputes they can't prove were authorized. AlpenSign creates independent, on-chain, biometric-confirmed proof. We don't replace your product — we make it more valuable."

---

## The Partners

### 1. Securosys — Bank-Side HSM

| | |
|---|---|
| **What they do** | Swiss HSM manufacturer. Primus HSM series (S, E, X, Blockchain, CyberVault), CloudHSM service. Smart Key Attributes (SKA) for multi-authorization workflows. FIPS 140-2 Level 3 and Common Criteria EAL 4+ certified. |
| **HQ** | Zürich |
| **Bank footprint** | Securosys HSMs secure the Swiss Interbank Clearing (SIC) system — CHF ~100 billion in daily transactions, operated by SIX under SNB supervision. Contract renewed for another 10 years in 2024. Every SIC participant has a Securosys HSM on-premises. |
| **Key products** | Primus S2-Series (SIC-specific, PQC-ready), Primus Blockchain HSM, CloudHSM, Transaction Security Broker (TSB), Smart Key Attributes (SKA) |

**Why they fit AlpenSign:**

AlpenSign anchors the client side with the Seeker's secure element (a "Mobile HSM"). The bank side needs equivalent hardware protection. When a bank issues credentials, verifies seals, or stores evidence, the cryptographic operations must be HSM-protected. Securosys provides exactly this — and already has the bank relationships.

**Integration points:**

| Function | How the HSM is used |
|---|---|
| Bank credential issuance | The bank's SAS issuer key (signing attestations that bind clients to Seeker wallets) is stored in the Primus HSM. Multi-auth via SKA ensures no single employee can issue/revoke credentials. |
| Seal verification signing | When the bank verifies a transaction seal, the verification report is signed by an HSM-protected key — tamper-proof audit trail. |
| Evidence bundle signing | Court-admissible evidence packages are signed by the bank's HSM, establishing non-repudiation. |
| Key ceremony | Initial SAS schema creation and authority key generation happen inside the HSM with a formal key ceremony. |

**The pitch to Securosys:** "AlpenSign creates demand for HSM-protected credential issuance and seal verification. Every bank that adopts AlpenSign needs a Securosys HSM (or CloudHSM subscription) for the bank-side key management. We're a new use case for your existing install base."

**Engagement model:** Technology partnership. Joint solution architecture. Securosys references AlpenSign as a Primus Blockchain HSM use case. AlpenSign references Securosys as the recommended bank-side HSM. CloudHSM as low-barrier pilot entry point.

**Contact angle:** Securosys has a blockchain team and presents at Swiss fintech events. They've published case studies on blockchain key management. A hackathon win (especially SwissHacks) provides a natural introduction. They also co-present with ELCA at security events.

**The full trust chain with Securosys:**

```
Client Side                          Bank Side
┌─────────────────────┐                  ┌─────────────────────┐
│  Seeker Phone        │                  │  Securosys HSM       │
│  Secure Element      │                  │  Primus / CloudHSM   │
│  (Mobile HSM)        │                  │  (Enterprise HSM)    │
│                      │                  │                      │
│  • Genesis Token     │    Solana +      │  • Issuer key        │
│  • Seal signing      │◄──── SAS ──────▶│  • Verification      │
│  • Biometric gating  │                  │  • Evidence signing  │
│                      │                  │  • Multi-auth (SKA)  │
└─────────────────────┘                  └─────────────────────┘
```

---

### 2. ELCA Informatik — SASS Software (SIC Payment Interface)

| | |
|---|---|
| **What they do** | Switzerland's largest independent IT services company. 2,200+ employees. Full-service: consulting, software development, cybersecurity, cloud, system integration. Founded 1968, HQ in Lausanne with offices in Zürich, Geneva, Bern, Basel. |
| **Bank footprint** | ELCA develops and maintains the **SASS software** — the security software module that every Swiss bank uses to interface with the SIC interbank clearing system. SASS sits between the bank's payment application and the Securosys HSM, handling cryptographic operations for payment message signing and authentication. |
| **Key products** | SASS (SIC/euroSIC/SECOM security software), custom banking solutions, Swiss Sovereign Cloud, cybersecurity consulting |

**Why they fit AlpenSign:**

ELCA occupies a unique position: they write the software that connects banks to Switzerland's payment backbone. The SASS module is the bridge between the bank's payment engine and the Securosys HSM. Every SIC participant runs ELCA's SASS software. This means ELCA understands both the payment flow and the HSM integration at an intimate level — exactly the two things AlpenSign needs on the bank side.

**The SASS–Securosys–AlpenSign stack:**

```
Bank's Payment Engine
        │
        ▼
┌───────────────────┐
│  SASS Software     │  ◀── ELCA develops & maintains
│  (ELCA)            │
│                    │
│  Crypto operations │
│  Message signing   │
│  Key management    │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Securosys HSM     │  ◀── Hardware key storage
│  (Primus S2)       │
└───────────────────┘
```

AlpenSign adds a parallel path: the same Securosys HSM that protects SIC payment signing can also protect AlpenSign credential issuance and seal verification. ELCA would build the integration layer — the "AlpenSign module" — that extends SASS or sits alongside it.

**Integration points:**

| Function | ELCA's role |
|---|---|
| AlpenSign SDK integration | ELCA builds the bank-side integration module that connects AlpenSign's credential and seal verification to the bank's existing payment infrastructure |
| HSM orchestration | ELCA already knows how to talk to Securosys HSMs via SASS. The same patterns apply for AlpenSign's bank-side key operations. |
| SIC payment correlation | ELCA can map AlpenSign seals to actual SIC payment messages — binding the on-chain proof to the real interbank settlement |
| ISO 20022 alignment | ELCA's deep familiarity with Swiss payment message formats (pain.001, camt.053) ensures AlpenSign's schemas speak the same language |

**The pitch to ELCA:** "You already write the software that connects every Swiss bank to SIC. AlpenSign adds a new dimension: independent client authorization proof, anchored to the same Securosys HSM your SASS software already manages. We don't replace SASS — we give it an extra output: alongside the signed SIC message, the bank now has an on-chain seal proving the client authorized the payment."

**Engagement model:** Systems integration partner. ELCA builds the bank-side AlpenSign integration as a consulting project for pilot banks. Long-term: ELCA offers "AlpenSign integration" as a standard service alongside SASS deployment and upgrades.

**Contact angle:** ELCA and Securosys already co-present at security events and have a working relationship through the SIC infrastructure. A joint approach (Securosys for HSM, ELCA for software integration, AlpenSign for the client-side protocol) is a natural three-party pitch to banks. ELCA's banking practice in Zürich is the entry point.

**Why this matters strategically:** ELCA is the only company in this ecosystem that touches both the payment flow (SASS/SIC) and the HSM layer (Securosys integration). If ELCA validates AlpenSign's architecture, it carries enormous credibility with banks — because ELCA is the company those banks already trust to handle their most critical payment security software.

---

### 3. Netcetera — 3D Secure Infrastructure

| | |
|---|---|
| **What they do** | Swiss software company providing 3D Secure ACS (Access Control Server) and payment authentication solutions to card issuers across Europe. |
| **HQ** | Zürich |
| **Bank footprint** | Netcetera's 3DS platform handles the challenge/response flow when a cardholder makes an online purchase. Their ACS is deployed by card issuers (banks) across Europe. |
| **Key products** | 3DS ACS, payment authentication, mobile security, digital identity |

**Why they fit AlpenSign:**

3D Secure is the authentication standard for online card payments (Visa Secure, Mastercard Identity Check). When you buy something online, the bank's 3DS system challenges you to confirm — typically via SMS OTP or a push notification in the bank's app. The problem: the authentication channel is controlled by the bank. The evidence is self-serving.

AlpenSign could act as an independent, out-of-band confirmation method routed through Netcetera's ACS. Instead of (or alongside) a push notification, the ACS triggers an AlpenSign seal request to the cardholder's Seeker. The on-chain seal becomes part of the 3DS authentication response.

**Integration points:**

| Function | How it works |
|---|---|
| Challenge method | Netcetera's ACS adds "AlpenSign" as a challenge method alongside SMS OTP and push notification |
| Seal confirmation | After the Seeker posts the seal to Solana, the AlpenSign backend confirms to the ACS, which returns successful 3DS auth to the merchant |
| Evidence enrichment | The 3DS authentication log now includes an on-chain transaction signature — evidence the bank didn't create |
| Configuration | Card issuers can opt in per cardholder segment (e.g., Seeker-owning clients get AlpenSign, others get standard push) |

**The pitch to Netcetera:** "Your ACS handles millions of 3DS challenges. For every disputed card transaction the issuer can't prove was authorized, they lose the chargeback. AlpenSign gives them proof that survives court — and it plugs into your ACS as just another challenge method."

**Engagement model:** Technology integration. Netcetera adds AlpenSign as a challenge method in their ACS configuration. Card issuers can enable it per segment. Netcetera charges for the integration; AlpenSign charges per seal.

**Contact angle:** Netcetera sponsors Swiss Payment Forum and Finance 2.0. The 3DS angle is their core business — a novel challenge method backed by on-chain proof is differentiated. SwissHacks is a natural venue for a first conversation.

**Technical requirements:**
- AlpenSign SDK must support EMVCo 3DS2 message formats
- Seeker app must display card transaction details (merchant name, amount, card last-4)
- Latency critical: 3DS challenges timeout in ~5 minutes. Seal must post within this window.

---

### 4. Ergon Informatik / Airlock — API Security Gateway

| | |
|---|---|
| **What they do** | Ergon Informatik (Zürich) builds Airlock — API security gateway, WAF, and identity management platform. |
| **HQ** | Zürich |
| **Bank footprint** | Airlock is used by Swiss banks for securing online and mobile banking interfaces. Handles authentication, authorization, API protection. |
| **Key products** | Airlock Gateway, Airlock IAM (identity and access management), Airlock Microgateway |

**Why they fit AlpenSign:**

When a bank integrates AlpenSign, the seal request and verification flows need to pass through the bank's API security layer. For many Swiss banks, that layer is Airlock. Rather than asking each bank to build a custom AlpenSign integration, the integration happens at the Airlock level — meaning any bank running Airlock gets AlpenSign support as a gateway plugin or authentication module.

**Integration points:**

| Function | How it works |
|---|---|
| API routing | Airlock Gateway routes seal requests from the bank's payment engine to the AlpenSign SDK backend |
| Identity mapping | Airlock IAM maps the AlpenSign wallet credential (Solana address + SAS attestation) to the bank's internal client identity |
| Seal verification | Verification results flow back through Airlock to the payment engine as an authenticated response |
| Policy enforcement | Airlock enforces seal requirements per transaction type/amount (e.g., transactions > CHF 10,000 require AlpenSign seal) |

**The pitch to Ergon:** "AlpenSign is a new authentication factor for high-value payments. It integrates into Airlock the same way FIDO2 and SMS OTP already do — as a module. Your banking customers get AlpenSign support without custom integration."

**Engagement model:** Technology integration. AlpenSign provides an Airlock-compatible module. Ergon offers it to their banking customers as an authentication option. This follows the same pattern other auth methods use.

**Contact angle:** Ergon is deeply embedded in Swiss banking IT. They understand procurement and compliance. An Airlock integration de-risks AlpenSign adoption because it fits the existing security architecture. Ergon attends and sponsors Swiss IT/fintech events.

---

### 5. Viseca / Viseca One — Card Issuer + Consumer App

| | |
|---|---|
| **What they do** | Major Swiss card issuer (Visa, Mastercard). The Viseca "one" app handles card management and 3DS authentication for Swiss cardholders. |
| **HQ** | Zürich |
| **Bank footprint** | Viseca issues cards for multiple Swiss banks. The "one" app is the consumer surface for card approvals — it's the app that pops up when you make an online purchase and need to confirm. |
| **Key products** | Viseca "one" app, card issuing, 3DS authentication |

**Why they fit AlpenSign:**

Viseca is both a potential **customer** (they process card disputes and absorb friendly fraud losses) and an **integration partner** (their "one" app is the natural surface for AlpenSign's 3DS flow). If Viseca integrates AlpenSign into "one," every 3DS challenge could optionally be AlpenSign-sealed — giving Viseca independent proof of cardholder authorization.

**Integration options:**

| Option | How it works |
|---|---|
| **Embedded** | AlpenSign's seal logic runs inside the Viseca "one" app. When a 3DS challenge arrives, the app shows payment details and seals the confirmation on Solana before responding to the ACS. |
| **Companion** | Viseca "one" delegates to the standalone AlpenSign app on the Seeker via deep link. The seal result returns to Viseca "one" which forwards it to the ACS. |

**The pitch to Viseca:** "For every disputed card transaction you can't prove was authorized, you lose the chargeback. AlpenSign gives you proof that survives court. Your 'one' app already shows the payment and asks for confirmation — AlpenSign makes that confirmation independently verifiable."

**Engagement model:** Customer + integration partner. Viseca has innovation teams. A proof-of-concept showing AlpenSign seals for card transactions — with real on-chain evidence — is a compelling business case against chargeback losses.

**Contact angle:** Viseca sponsors Swiss fintech events and has an open innovation program. The card dispute angle is directly tied to their P&L. SwissHacks is a venue where this pitch lands well.

---

## The ELCA–Securosys Connection: Why It Matters

The ELCA–Securosys relationship deserves special attention because it's not just a partnership — it's the **existing production infrastructure** of Swiss banking.

Every Swiss bank that participates in the SIC interbank clearing system has:
- A **Securosys Primus HSM** (hardware, storing the bank's signing keys)
- **ELCA's SASS software** (interface between the bank's payment application and the HSM)

These are not optional. They're mandated for SIC participation. SASS + Primus HSM is how CHF 100 billion moves between Swiss banks every day.

AlpenSign's bank-side integration follows the same pattern:

```
TODAY (SIC payments):                    TOMORROW (AlpenSign):

Bank Payment Engine                      Bank Payment Engine
       │                                        │
       ▼                                        ▼
   SASS Software (ELCA)                  AlpenSign Module (ELCA)
       │                                        │
       ▼                                        ▼
   Securosys HSM                         Securosys HSM
       │                                   (same device)
       ▼                                        │
   Signed SIC message                           ▼
   → sent to SIX/SNB                    Signed credential / verification
                                         → stored for disputes
```

The bank doesn't need new hardware. The bank doesn't need a new security architecture. The bank needs ELCA to write a new module that uses the HSM it already has, for a new purpose: AlpenSign credential and seal management.

**This is the fastest path to bank adoption.**

---

## Partner Engagement Sequence

```
Phase 1: Hackathon                Phase 2: Pilot               Phase 3: Production
(Q1 2026)                         (Q3–Q4 2026)                 (2027+)

Securosys ──── Joint demo ─────── CloudHSM pilot ─────────────── Primus HSM deployment
                                  (test AlpenSign key ops)       (on-prem at pilot bank)

ELCA ───────── Architecture ────── Integration module ──────────── SASS-adjacent service
               review             (AlpenSign ↔ HSM glue)          (offered to SIC banks)

Netcetera ──── 3DS concept ─────── ACS sandbox test ──────────── Challenge method GA
               paper               (AlpenSign as 3DS method)     (available to issuers)

Ergon ──────── Airlock POC ─────── Module development ──────────── Certified module
                                   (AlpenSign auth module)       (in Airlock catalog)

Viseca ─────── Innovation ──────── "one" app pilot ────────────── Rolled out to
               pitch               (AlpenSign seals for 3DS)     cardholders
```

**Phase 1 deliverable:** One or two partners agree to a joint presentation or PoC. A hackathon win (StableHack, SwissHacks) provides credibility.

**Phase 2 deliverable:** Working integration with at least one partner. Ideally Securosys CloudHSM + ELCA integration module, tested with a friendly bank.

**Phase 3 deliverable:** AlpenSign available as a standard option through partner channels. Banks adopt it without talking to Koivu directly.

---

## Partner Interaction Map

The five partners don't operate in isolation. Their products interact, creating natural bundle opportunities:

```
                    Securosys HSM
                   ╱              ╲
                  ╱                ╲
          ELCA SASS              AlpenSign Module
          (SIC payments)         (seal verification)
                  ╲                ╱
                   ╲              ╱
                    Bank Core System
                   ╱              ╲
                  ╱                ╲
          Airlock Gateway        Netcetera ACS
          (Ergon)                (3DS challenges)
                  ╲                ╱
                   ╲              ╱
                   Viseca "one" App
                   (consumer surface)
```

**Natural bundles:**

| Bundle | Partners | Story |
|--------|----------|-------|
| **Payment seal** | Securosys + ELCA + AlpenSign | "Same HSM that signs your SIC payments now also anchors client authorization proof" |
| **Card seal** | Netcetera + Viseca + AlpenSign | "3DS challenges backed by on-chain proof — chargeback disputes defeated" |
| **Full stack** | All five + AlpenSign | "From the Seeker in the client's hand to the HSM in the bank's data center, every layer independently verified" |

---

## Beyond Switzerland

The Swiss partner ecosystem is the launchpad, but the model scales:

| Market | Regulatory driver | Entry partner type |
|--------|------------------|--------------------|
| **EU** | eIDAS 2.0, PSD2/SCA, DORA | 3DS ACS providers, EU HSM vendors, digital identity wallets |
| **UK** | Post-Brexit SCA, Consumer Duty | UK payment processors, Open Banking providers |
| **US** | Reg E (friendly fraud), CFPB enforcement | Card network partnerships, fintech integrators |
| **APAC** | MAS (Singapore), HKMA | Regional card issuers, local HSM requirements |

The Swiss pilot proves the model. The partnerships prove the go-to-market. The regulatory tailwinds exist globally.

---

## What AlpenSign Needs to Be "Partner-Ready"

Before approaching partners, AlpenSign needs:

| Requirement | Status | Needed for |
|-------------|--------|-----------|
| Working demo on Seeker | ✅ v0.5.5 | All partners |
| Demo video | Scripted, needs recording | All partners |
| Memo privacy fix (hash-only) | Open — P0 | All partners (judges and engineers will check) |
| Bank simulator (both-ends demo) | Open — P1 | ELCA, Securosys (they need to see the bank side) |
| SAS attestation migration | Open — P1 | Securosys (typed schemas for HSM operations) |
| ISO 20022 schema alignment | Open — P1 | ELCA, Netcetera (must speak payment language) |
| 3DS message format support | Open — P2 | Netcetera, Viseca |
| Airlock module specification | Open — P2 | Ergon |
| Pitch deck (partner version) | Open — P1 | All partners |

The hackathon demos (Monolith, StableHack, SwissHacks) serve as forcing functions. Each event brings the demo closer to partner-ready.

---

## Key Contacts & Events

| Event | When | Relevance | Target partners |
|-------|------|-----------|-----------------|
| **SwissHacks** | 2026 | Swiss fintech hackathon — banking judges | ELCA, Securosys, Ergon |
| **Swiss Payment Forum** | Annual | Payment infrastructure conference | Netcetera, Viseca, ELCA |
| **Finance 2.0** | Annual | Swiss banking innovation | All |
| **Securosys User Conference (SUDC)** | Annual | HSM user community | Securosys, ELCA |
| **SIX Hack** (if offered) | TBD | SIX-sponsored innovation event | ELCA, Securosys |

---

## Reference: AlpenSign Value Chain

For context, here's where each partner sits in the full AlpenSign architecture:

```
CLIENT SIDE                    ON-CHAIN                     BANK SIDE

┌──────────────┐         ┌──────────────┐          ┌──────────────────┐
│ Seeker Phone │         │   Solana     │          │ Bank Systems     │
│              │         │              │          │                  │
│ • Seed Vault │──seal──▶│ • SAS attest │◀──verify─│ • ELCA module    │
│ • Genesis TK │         │ • Memo hash  │          │ • Airlock (Ergon)│
│ • AlpenSign  │         │              │          │ • Securosys HSM  │
│ • swiyu E-ID │         └──────────────┘          │                  │
│ • vLEI (ECR) │                                   │ • Netcetera ACS  │
└──────────────┘                                   │ • Viseca "one"   │
                                                   └──────────────────┘
```

---

*Document prepared for the AlpenSign project — Koivu GmbH*
*February 2026*
