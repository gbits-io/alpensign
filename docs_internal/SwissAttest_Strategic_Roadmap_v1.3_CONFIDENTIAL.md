# SwissAttest — Strategic Roadmap (CONFIDENTIAL)

> Evolving AlpenSign's transaction-sealing technology into a Swiss Attestation Authority for the AI age.

**Classification: Non-public / Internal strategic document**
**Prepared by: Koivu GmbH · February 2026**
**Version: 1.3 — Updated February 24, 2026**
**Changelog v1.3:** Added AI Platform Collaboration Certificates to competitive landscape (Section 2.1), added Phase 0 demand-side validation strategy (Swiss AI Dispute Monitor), updated next steps. Previous: v1.2 added Section 1.5 (Technical Solution Architecture), revised Phase 1 GTM targeting, integrated MediaTek/TEE scaling strategy into Phase 2, added "Big Bank Objection" analysis to Section 6, added QES legal opinion milestone.

---

## Executive Summary

AlpenSign proves that independent, cryptographic attestation of human decisions is technically feasible using commodity hardware (Solana Seeker) and public blockchains. The current product targets a narrow use case: payment authorization seals for banks.

This document describes the strategic evolution from **AlpenSign** (a transaction-sealing app) into **SwissAttest** (a Swiss-domiciled attestation authority for AI-era verification). The thesis: as AI-generated content floods every industry, the demand for proving "a real human made this decision / wrote this / approved this" will become a multi-billion-dollar market. Switzerland's institutional credibility, neutrality, and legal framework make it the natural home for this infrastructure.

SwissAttest is not a pivot away from AlpenSign — it is AlpenSign's natural destination. Every layer of the AlpenSign stack (device verification, credential issuance, cryptographic sealing, evidence bundles) generalizes directly to the broader attestation market.

---

## 1. The Concept: Swiss Attestation Authority for AI Outputs

### 1.1 The Problem in Detail

By 2028–2030, the following will be routine:

- AI systems drafting and filing legal documents, contracts, and regulatory submissions
- AI-generated financial reports, audit opinions, and investment research
- AI-produced medical diagnoses, treatment plans, and insurance assessments
- AI-written news articles, corporate communications, and marketing content
- AI agents negotiating, executing, and settling commercial transactions autonomously

The fundamental question in every one of these scenarios: **"Was a qualified human involved in this decision, and can you prove it?"**

Today's answer is: "Trust us, a human reviewed it." This is the same self-serving evidence problem AlpenSign already solves for bank payments. The AI age scales this problem to every industry simultaneously.

### 1.2 What SwissAttest Does

SwissAttest provides **legally recognized, cryptographically anchored attestation** that a specific human, using a verified device, reviewed and approved a specific document or decision at a specific time. The attestation is:

- **Independent** — not controlled by the organization that produced the document
- **Immutable** — anchored on-chain (Solana) with off-chain evidence bundles
- **Legally structured** — issued under Swiss law, designed for cross-border recognition
- **Privacy-preserving** — only cryptographic proofs on-chain, full data held by parties

Think of it as **"Swiss Made" for information integrity** — the same trust premium Switzerland commands for watches, banking, and arbitration, applied to the question of human authorship and approval in the AI age.

### 1.3 Three Concrete Examples

#### Example A: AI-Assisted Legal Contract — "Who Actually Approved This?"

**Scenario:** A Zürich-based law firm uses an AI system to draft a complex M&A agreement. The AI produces a 200-page contract. A senior partner reviews and approves the final version. Six months later, a clause is disputed, and the opposing party claims the contract was "fully AI-generated with no meaningful human review" — attempting to argue diminished legal authority.

**How SwissAttest works here:**

1. The law firm's document management system integrates the SwissAttest SDK.
2. When the partner opens the final draft for review, SwissAttest records the session: device identity (verified Seeker or hardware token), biometric confirmation (the partner, not an assistant), document hash (SHA-256 of the exact PDF).
3. The partner reads, makes final edits, and taps "Approve & Seal" on their verified device.
4. SwissAttest posts a cryptographic seal to Solana: the document hash, the partner's credential (issued by the firm, bound to their Swiss bar admission), the device attestation, and a timestamp.
5. The firm receives an **evidence bundle** — a self-contained package (PDF + JSON + on-chain references) that proves: this specific person, on this verified device, approved this exact document, at this exact time.

**In the dispute:** The firm presents the SwissAttest evidence bundle. The opposing party cannot credibly claim "no human reviewed it" — the cryptographic chain proves a named, credentialed partner spent 47 minutes in the document and biometrically sealed their approval. The attestation is independent of the firm's own systems.

**Revenue model:** Per-attestation fee (CHF 2–5 per seal) + annual firm subscription for the SDK and credential management.

#### Example B: AI-Generated Medical Diagnosis — "Did a Doctor Actually See This?"

**Scenario:** A Swiss health insurer receives a claim based on a diagnosis generated by an AI diagnostic system at a cantonal hospital. The AI analyzed imaging data and produced a diagnosis of a condition requiring expensive treatment. The insurer questions whether a qualified physician meaningfully reviewed the AI's output before the diagnosis was issued.

**How SwissAttest works here:**

1. The hospital's radiology department uses an AI-assisted diagnostic platform.
2. The AI flags a finding and drafts a diagnostic report. A board-certified radiologist reviews the imaging and the AI's analysis on their workstation.
3. The radiologist's SwissAttest credential (bound to their FMH medical license via SAS attestation) is active on their verified device.
4. After reviewing the images and confirming or modifying the AI's finding, the radiologist seals the final diagnostic report via SwissAttest.
5. The seal captures: the radiologist's medical credential, device verification, biometric confirmation, the hash of the final diagnostic report (including any modifications from the AI draft), and the viewing duration.

**In the insurance dispute:** The hospital presents the SwissAttest evidence bundle. It proves that Dr. [Name], FMH-certified radiologist, reviewed the imaging data for 12 minutes on a verified device and biometrically sealed the modified diagnosis. The insurer's concern about "rubber-stamped AI output" is addressed with independent, cryptographic proof of physician involvement.

**Why Swiss:** Swiss medical data protection (nDSG) is stringent. SwissAttest's privacy-preserving design (only hashes on-chain, full data held by the hospital) aligns with Swiss health data regulations. Switzerland's reputation for medical excellence adds credibility to the attestation framework.

**Revenue model:** Per-attestation fee + hospital/clinic subscription + potential integration with Swiss health insurance infrastructure (SASIS, TARMED successors).

#### Example C: Financial Research Report — "Is This Human Analysis or AI Slop?"

**Scenario:** A Swiss asset management firm publishes investment research to institutional clients. Regulators (FINMA, and increasingly MiFID II for EU-distributed research) require that published research reflects genuine analyst judgment. The firm uses AI to assist with data gathering and draft generation, but the final opinions and recommendations must be human. A competing firm files a complaint alleging that the research is essentially AI-generated and misleadingly attributed to named analysts.

**How SwissAttest works here:**

1. The research platform integrates SwissAttest into the analyst workflow.
2. An analyst uses AI tools to compile data, generate charts, and draft sections. The AI's contributions are logged internally.
3. The analyst reviews the full report, writes the conclusion and investment recommendation, and seals the final version via SwissAttest on their verified device.
4. The seal captures: the analyst's credential (bound to their FINMA-registered role at the firm), the document hash of the final report, the biometric confirmation, and crucially — the **diff between the AI draft and the final sealed version**, proving the analyst made substantive modifications.

**In the regulatory inquiry:** FINMA requests evidence that the research reflects genuine analyst judgment. The firm provides SwissAttest evidence bundles for each published report, showing: which analyst sealed each report, how long they spent reviewing, and what changes they made to the AI draft. The competing firm's complaint is addressed with auditable, independent proof.

**Why this is different from "just signing a PDF":** A digital signature proves the file wasn't tampered with after signing. SwissAttest proves the **process** — that a qualified human engaged with the content on a verified device for a meaningful duration before approval. It's the difference between notarizing a signature and witnessing a decision.

**Revenue model:** Per-report attestation fee (CHF 5–15 for financial research, given regulatory value) + annual compliance subscription + FINMA audit-readiness package.

### 1.4 The Core Technical Stack (Built on AlpenSign)

| AlpenSign Component | SwissAttest Generalization |
|---|---|
| Genesis Token (device is genuine Seeker) | **Device Attestation Layer** — Genesis Token for Seeker, manufacturer attestation for Ledger/Trezor/Yubikey, TPM attestation for enterprise laptops |
| Bank Credential (SAS attestation from bank) | **Professional Credential Layer** — SAS attestation from any credentialing authority: law firms, medical boards, financial regulators, corporate HR |
| Transaction Seal (biometric + payment hash on Solana) | **Decision Seal** — biometric confirmation + document/decision hash on Solana, with session metadata (duration, interaction pattern, modifications) |
| Evidence Bundle (court-admissible package) | **Attestation Certificate** — self-contained, legally structured evidence package designed for cross-jurisdictional recognition |

Every piece of AlpenSign's architecture maps directly. The SDK, HSM integration (Securosys), privacy enhancements (ZK proofs), and credential recovery flows all carry over unchanged.

### 1.5 Technical Solution Architecture: What SwissAttest Actually Is

The fundamental question for any investor or customer: *What does the user experience actually look like when a lawyer, banker, or doctor "attests" that they reviewed something?*

SwissAttest proves one thing: **a specific credentialed human made a conscious decision about a specific document or output at a specific time.** Everything else is implementation detail.

#### The Three Layers

**Layer 1 — The Attestation Moment (UX)**

The professional works in their normal environment — reviewing an AI-drafted legal brief in Word, examining an AI-flagged transaction in their banking terminal, reading an AI-generated radiology summary. At the moment they exercise professional judgment, they trigger an attestation.

The trigger can be: a browser extension or desktop agent sitting in the system tray, a keystroke or gesture, or a biometric confirmation (fingerprint on their existing laptop reader, Face ID, or Seeker Seed Vault). Think of it as **"git commit" for professional decisions** — the professional doesn't change their workflow, they just cryptographically sign off at decision points.

**Layer 2 — The Cryptographic Proof Chain (What Gets Sealed)**

When the attestation triggers, the system captures and signs a bundle:

1. **Content hash** — SHA-256 of the document or output being reviewed
2. **Identity proof** — derived from the hardware security module (TPM on Windows, Secure Enclave on Mac, TEE on Android via MediaTek/TEEPIN, or Seed Vault on Seeker). Bound to biometric. The Swiyu E-ID (or equivalent) maps "this cryptographic key belongs to Dr. Elena Furrer, licensed by FMH"
3. **Credential proof** — an on-chain SAS attestation confirming "this E-ID holder is a licensed [lawyer/doctor/banker] as of [date]," issued by the relevant professional body (SAV, FMH, FINMA-regulated entity)
4. **Timestamp** — anchored on Solana (low cost, high throughput, immutable)
5. **Context metadata** — which tool generated the content (e.g., "GPT-4 via Microsoft Copilot"), what action the professional took (approve / modify / reject), session duration, interaction pattern

This bundle is hashed and written to chain. The full data stays encrypted off-chain (IPFS, Arweave, or Swiss-hosted sovereign storage for regulated industries).

**Layer 3 — Verification & Dispute Resolution**

When a dispute arises — "Did a human actually review this AI-drafted contract?" — any party can independently verify the attestation chain without trusting SwissAttest as a company. This is the fundamental advantage of a public blockchain anchor over a centralized database.

#### Why Existing Components Don't Solve It Alone

| Component | What It Proves | What It Doesn't Prove |
|---|---|---|
| TPM / Secure Enclave / SecureBoot | Hardware-rooted key storage, biometric binding | What was reviewed, who holds which professional credentials |
| Swiyu E-ID | Civil identity | Professional credentials, what specific content was reviewed |
| DocuSign / Adobe Acrobat | Consent to a document (centralized trust) | Process (time spent, modifications made, AI vs. human contribution); opposing party can challenge centralized logs |
| YubiKey / Google Titan | "This person logged in" (FIDO2 auth) | "This person reviewed this specific content with these credentials" |
| MS Teams recording | Presence in a meeting | Professional judgment exercised; a lawyer on a call is not proof of oversight |
| WORM audit logs | Immutability within an org's perimeter | Independence — these are self-serving logs, challengeable across trust boundaries |

**SwissAttest's value is the integration layer** — it combines device attestation + professional credential + content hash + biometric + timestamp into a single, independently verifiable proof package. No existing product does this.

#### The Actual Product, Concretely

**Phase 1 product (MVP):** A lightweight desktop/mobile agent that integrates with the professional's existing workflow. The API surface is simple:

```
SwissAttest.seal({
  contentHash: "sha256:abc...",
  action: "APPROVED",
  context: { generator: "copilot-v4", documentType: "legal-brief" }
})
```

The SDK handles biometric capture, hardware security module interaction, credential verification against the relevant professional body's oracle, and chain submission. The professional body (FMH, SAV, etc.) operates or delegates a credential oracle that the SDK checks before allowing a seal.

**Phase 2 product (Generalized SDK):** The SDK becomes embeddable in any enterprise application — document management systems, EHR platforms, compliance tools, research platforms. Any app can call `SwissAttest.seal()`.

**Phase 3 product (Network infrastructure):** Courts, regulators, and insurers begin requiring SwissAttest-compatible proofs. At this point SwissAttest transitions from product to critical infrastructure.

---

## 2. Competitive Landscape

### 2.1 Companies Operating in Adjacent Spaces

**DocuSign / Adobe Sign (e-signatures)**
These platforms prove a document was signed, but not that the signer meaningfully reviewed or understood the content. They also rely on centralized trust — DocuSign is the sole authority on whether a signature is valid. SwissAttest adds the decision-process layer (time spent, modifications made, device verification) and decentralizes the trust anchor.

**Worldcoin / World ID (proof of humanness)**
World ID proves "this is a real human" via iris scanning. It does not prove "this human is qualified to make this decision" or "this human actually reviewed this specific document." SwissAttest builds on the proof-of-humanness concept but adds professional credentials and document-specific sealing. World ID could be a complementary identity layer.

**OpenAI's Content Credentials / C2PA (content provenance)**
The Coalition for Content Provenance and Authenticity (C2PA), backed by Adobe, Microsoft, and others, focuses on tagging AI-generated content with provenance metadata. This is the supply-side approach: labeling what AI made. SwissAttest is the demand-side complement: proving what a human approved. They are not competitors but natural partners — C2PA tags the AI's contribution, SwissAttest seals the human's approval.

**Notarize / eNotarize platforms**
Digital notarization platforms bring traditional notarial functions online. They are limited to notarial acts (identity verification, witnessing signatures) and operate within specific legal jurisdictions. SwissAttest goes beyond notarization to continuous process attestation — not just "this person signed" but "this person engaged with this content for X minutes and made Y modifications on a verified device."

**Civic / RNS.ID / Sumsub (identity verification on Solana)**
These Solana-ecosystem companies provide identity verification and credentialing using SAS attestations. They are potential partners, not competitors — Civic's identity verification could feed into SwissAttest's professional credential issuance. The key differentiation: these companies verify identity; SwissAttest verifies decisions.

**Securitize / tZERO (regulated digital securities)**
These platforms handle securities issuance and compliance on blockchain. They face the same "who approved this?" question for regulatory filings and compliance decisions. They are potential enterprise customers for SwissAttest, not competitors.

**AI Platform Collaboration Certificates (Anthropic, OpenAI, Google, Microsoft — EMERGING THREAT)**
AI platforms already possess all the raw data to produce signed "certificates of collaboration" — session duration, number of prompts, files uploaded, code iterations generated, edits accepted/rejected. For example, Anthropic could issue a cryptographically signed attestation: "User Roman spent 23 hours across 127 prompts building AlpenSign via Claude Opus 4.6, uploaded 10 documents, created 34 versions of app.js, reported 17 bugs." GitHub Copilot, Cursor, and similar tools have equivalent data. It is only a matter of time before these platforms ship this as a standard feature — likely for free, as a value-add to their subscription.

**Why this is both a threat and a validation:** It validates the market (AI platforms see demand for proving human involvement). But their certificates have the same structural weakness as bank WORM logs: they are **self-serving evidence from the AI vendor itself**. Anthropic signing a certificate about what happened on Anthropic's servers is Anthropic saying "trust us." In a dispute, this can be challenged: Was the person actually at the keyboard, or did they share credentials? Did they substantively review the output, or just click "accept"? Anthropic has commercial incentive to make their platform look responsibly used — they are not a neutral party.

**SwissAttest's differentiation from AI platform certificates has three dimensions:**

1. **Independence.** SwissAttest is not controlled by the AI vendor. The attestation is verifiable without trusting Anthropic, OpenAI, or any single platform.
2. **Biometric and device binding.** Platform certificates prove an account was active. SwissAttest proves a specific human was biometrically present on a verified device at the moment of approval.
3. **Cross-platform synthesis.** A professional workflow typically spans multiple tools — Copilot for drafting, Claude for research, Adobe for final formatting, a browser for fact-checking. Each AI platform only sees its own slice. SwissAttest sits as an **independent layer across all platforms**, attesting to the human's holistic review process. No single AI vendor can or will provide this, because they are competitors and will not share session data with each other.

**Strategic positioning:** Let AI platforms ship activity logs and collaboration certificates. This grows awareness of the attestation need. SwissAttest's pitch becomes: "Your AI platform tells you what the AI did. SwissAttest proves what the human decided." The analogy: each AI platform is a bank keeping its own transaction logs. SwissAttest is the blockchain — the neutral, independent layer that neither party controls.

### 2.2 Why No One Has Built This Yet

Four reasons:

1. **The AI trust crisis hasn't peaked yet.** In 2026, most organizations are still excited about AI capabilities and haven't internalized the liability problem. By 2028–2030, the first wave of lawsuits over AI-generated errors in legal, medical, and financial contexts will create urgent demand.

2. **The hardware is only now becoming ubiquitous.** Before the Solana Seeker, there was no consumer device that combined biometric-gated signing from a hardware-isolated secure element with on-chain posting in a single gesture. However, Solana Mobile's partnership with MediaTek and Trustonic (TEE and biometric-to-chain signing on mainstream Android) is solving the hardware distribution problem. Enterprise laptops already have TPM + biometric readers (Windows Hello, Touch ID). The hardware bottleneck that existed in 2024 is dissolving rapidly.

3. **The real bottleneck is credential infrastructure.** The hardest part is not the technology — it's the chicken-and-egg problem of professional credential issuers. The FMH must agree to operate (or delegate) a credential oracle for doctors. The SAV must do the same for lawyers. Without professional bodies issuing on-chain credentials, SwissAttest is a signing tool but not an attestation authority. This is why the Phase 1 go-to-market must target segments where credential issuance can be bootstrapped within a single organization.

4. **Switzerland hasn't positioned itself yet.** The Swiss government and FINMA are focused on crypto regulation and DeFi, not on AI attestation infrastructure. The opportunity is to build the private-sector framework before the regulatory mandate arrives — and then be the incumbent when it does.

---

## 3. Roadmap: From AlpenSign to SwissAttest

### Phase 0: Demand-Side Validation — The Swiss AI Dispute Monitor (Now – Q3 2026)
*Prove the market exists before building the product. Come for the content, stay for the tool.*

Rather than building infrastructure and hoping professionals adopt it, Phase 0 flips the approach: **systematically document the problem** and let the solution sell itself.

**The Swiss AI Dispute Monitor** is a structured, continuously updated registry of incidents where clients, patients, counterparties, or regulators challenged professional work as insufficiently human-reviewed. This serves three purposes simultaneously:

1. **Proves the market to investors.** A case database with 50–100 documented incidents replaces hypothetical scenarios with real names, real disputes, and real financial damage. Investors asking "is this a real problem?" get a data-driven answer.
2. **Builds relationships with future customers.** The professionals who contribute cases are the ones who feel the pain. A law firm partner who shares "my client accused us of using ChatGPT and we couldn't disprove it" is the first pilot customer — they came to SwissAttest with a problem, not the other way around.
3. **Establishes authority and creates a content moat.** "Koivu GmbH publishes the Swiss AI Dispute Monitor" earns speaking invitations, press coverage, and credibility with professional bodies (SAV, FMH) before the product even ships. By the time Koivu approaches them about credential issuance, it is the recognized expert on the problem.

**Data collection channels:**

- **Public court decisions:** Crawl bger.ch and cantonal court databases for disputes mentioning AI-generated content, automated decisions, or AI quality challenges. AI-assisted desk research can build the public-record baseline.
- **Professional liability insurers (critical channel):** Companies like Zurich Insurance, AXA, and Allianz underwriting Berufshaftpflicht for lawyers, doctors, and financial advisors are sitting on claims data. They know how many claims mention AI. They are also massively incentivized to support SwissAttest because it reduces their future payout risk. Approach them as data partners, not customers: "Your anonymized claims data makes the Monitor authoritative. In return, we're building the tool that prevents these claims."
- **Ombudsman offices:** Swiss Banking Ombudsman, cantonal Patient Ombudsmen, Bar Association complaint bodies — they handle disputes before formal litigation and see early signals.
- **Direct professional outreach:** A short survey — "Has a client, patient, or counterparty ever questioned whether your work was AI-generated?" — distributed via LinkedIn, Zürcher Anwaltsverband, cantonal medical societies. Framed as research, not sales.
- **International precedent tracking:** US and UK cases (e.g., lawyers sanctioned for AI-hallucinated citations) as "coming attractions" for the Swiss market.

**What AI can and cannot do here:** AI (Claude, Gemini) can run the desk research — crawling court databases, scanning regulatory actions, monitoring news, structuring findings. This is fast and nearly free. But the most valuable cases — the private disputes that haven't reached court, the quiet settlements, the clients who moved assets — live in people's heads and in confidential communications. Getting those requires a human founder with credibility picking up the phone, attending SAV events, having coffee with insurers. The combination of AI-powered public research + human-sourced private insights is the proprietary asset no competitor can replicate.

**Risk:** The Swiss case database might come back thin in 2026. Switzerland could be 12–18 months behind the US on AI malpractice incidents. Mitigation: expand scope to DACH + EU to prove global market, and frame thin Swiss data as "this is imminent" rather than "this is here."

- Publish first Swiss AI Dispute Monitor report (aim for 30+ documented incidents including international precedents)
- Present findings at 1–2 Swiss professional events (SAV, banking, or medtech conferences)
- From the case database, identify 3–5 professionals/firms most affected by AI trust disputes and approach them as design partners
- **Key milestone:** At least one professional liability insurer engaged as a data partner, and at least 3 firms expressing interest in a pilot based on their own AI dispute experience

### Phase 1: AlpenSign + First Beachhead Customers (Now – Q4 2026)
*Prove the core technology and find paying customers who feel the pain today.*

**Technical milestones (unchanged):**
- Complete AlpenSign hackathon submissions (Monolith, StableHack, SwissHacks)
- Build bank simulator and demo airline app
- Migrate to SAS attestations on Solana
- Native Android app on Seeker

**Go-to-market: Revised targeting**

The original plan targeted Tier 1 bank fraud departments. Reality check: large Swiss banks will argue (correctly, within their perimeter) that their existing stack — 2FA, WORM-based audit logs, Adobe Acrobat + SharePoint — already provides immutable evidence for FINMA audits. The response "we have a central logging system and we don't need AlpenSign" is rational for intra-organizational disputes.

SwissAttest's value proposition activates **when disputes cross trust boundaries** — when the party challenging the evidence doesn't trust (and has no reason to trust) the organization's self-generated internal logs.

**Revised Phase 1 targets, in priority order:**

1. **Small/mid-size fiduciaries and external asset managers (EAMs).** FINMA-regulated since January 2020, but without Goldman Sachs-grade audit infrastructure. ~2,500 in Switzerland. They use off-the-shelf compliance tools and face personal liability exposure. They cannot afford to build WORM infrastructure. SwissAttest as a lightweight compliance proof layer is genuinely valuable. They can self-issue credentials within their organization, bootstrapping the credential system without waiting for professional body buy-in.

2. **Law firms using AI for client work.** A lawyer who uses Copilot to draft a contract has zero institutional infrastructure to prove they reviewed the AI output. The SAV has no standard for this. When a client sues because an AI hallucinated a fake precedent (this has already happened in the US), the lawyer's only defense is "trust me, I checked it." SwissAttest turns that into a verifiable proof chain. Lawyers buy things that protect them from malpractice liability. Credential issuance maps naturally to firm-level authority (partner attests for associate).

3. **Medtech and clinical decision support.** When a radiologist reviews an AI-flagged scan and concurs, the hospital's EHR records the sign-off. But if the patient sues, the trust-boundary problem applies. Swiss hospitals are increasingly deploying AI triage. The FMH has no attestation standard for AI-assisted diagnosis. First mover advantage.

4. **Banks — but repositioned.** Don't sell to UBS internal compliance. Instead, position for **cross-institutional use cases**: correspondent banking attestation, inter-bank sanctions screening proof, trade finance document verification. Sell to Swiss Bankers Association or SIX Group as shared infrastructure. The pitch is not "your internal logs aren't good enough" — it's **"your internal logs protect you when FINMA audits you. SwissAttest protects you when someone who doesn't trust your internal logs challenges you."** This includes: cross-institutional disputes (Bank A vs. Bank B's lawyers), criminal prosecution of individual compliance officers (Bundesanwaltschaft cases where the bank's own WORM logs are challenged as potentially self-serving), and the coming EU AI Act enforcement wave requiring proof that human oversight was "substantive, not performative."

- Secure first pilot via Swiss partner ecosystem (Securosys, Netcetera, Ergon, Viseca) — now targeting EAMs and fiduciaries alongside banks
- **Key milestone:** At least one paying customer running SwissAttest in production (any vertical), plus one Swiss bank engaged on the cross-institutional attestation concept

### Phase 2: Generalize the Stack + Universal Device Strategy (Q1 2027 – Q4 2027)
*Extract the attestation engine from AlpenSign, make it domain-agnostic, and solve the hardware distribution problem.*

- Refactor AlpenSign SDK into **SwissAttest SDK** — credential issuance, decision sealing, evidence bundle generation as a generic library
- Define **SwissAttest Schema Registry** — typed SAS attestation schemas for different verticals (legal, medical, financial, corporate governance)
- Build **credential authority onboarding** — a self-service portal where organizations (law firms, hospitals, asset managers) can become SwissAttest credential issuers
- **MediaTek/TEEPIN integration (critical scaling mechanism):** Solana Mobile's partnership with MediaTek and Trustonic brings TEE-backed biometric-to-chain signing to mainstream Android devices. This transitions SwissAttest from a hardware-dependent deployment (Seeker-only) to a software SDK deployable on millions of compatible Android devices that enterprise employees already own. Phase 2 should deliver SwissAttest compatibility with MediaTek TEE-enabled Android devices, dramatically expanding the addressable device base.
- **Full enterprise device support:** Expand beyond Seeker to: (a) MediaTek TEEPIN-enabled Android phones, (b) Windows laptops with TPM 2.0 + Windows Hello biometrics, (c) Apple devices with Secure Enclave + Touch ID / Face ID, (d) hardware security keys (Ledger, Trezor, Yubikey) as fallback. Every professional already has a compatible device — the SDK abstracts the hardware layer.
- **Security audit budget:** Expanding from a tightly controlled Seeker environment to general Android TPMs introduces security fragmentation risk. Allocate budget and timeline for third-party penetration testing, EMFI (electromagnetic fault injection) resilience audits, and comparative security analysis across device classes. This is critical for proving to FINMA or Swiss courts that a seal generated on a general Android device meets the same evidentiary standard as one from a Seeker Seed Vault.
- Engage with Swiss legal community (ZertES, electronic signatures law) to position SwissAttest certificates within Swiss evidentiary frameworks
- Publish revenue bridge plan: how Phase 1 customer revenue and relationships fund the SDK generalization. Will EAM and law firm clients become the first credential issuers for Phase 2?
- **Key milestone:** SwissAttest SDK used by at least two non-banking customers (e.g., one law firm, one hospital or EAM), running on at least two different device classes (Seeker + laptop TPM or MediaTek Android)

### Phase 3: Establish the Authority (2028+)
*Become the recognized Swiss standard for AI-era human attestation.*

- Establish **SwissAttest Association** (Verein) — a multi-stakeholder governance body for schema standards, credential authority accreditation, and dispute resolution
- Pursue formal recognition under Swiss electronic signatures law (ZertES) for SwissAttest certificates as qualified evidence
- Build partnerships with EU eIDAS framework for cross-border recognition
- Launch **SwissAttest Compliance Dashboard** — a SaaS product for enterprises to manage their attestation portfolio, audit trails, and regulatory reporting
- Engage with AI regulation frameworks (EU AI Act, potential Swiss AI regulation) to position SwissAttest as a compliance tool for "human-in-the-loop" requirements
- **Key milestone:** SwissAttest referenced in at least one regulatory guidance document as an acceptable method for proving human oversight of AI systems

---

## 4. Revenue Model

| Revenue Stream | Phase 1 (Banking) | Phase 2 (Multi-vertical) | Phase 3 (Authority) |
|---|---|---|---|
| Per-seal/attestation fee | CHF 0.50–2.00 | CHF 2–15 (varies by vertical) | CHF 2–15 |
| SDK subscription | — | CHF 5,000–50,000/yr per org | CHF 5,000–50,000/yr |
| Credential authority onboarding | — | CHF 10,000 setup | CHF 10,000 setup |
| Compliance dashboard SaaS | — | — | CHF 1,000–10,000/mo per org |
| Evidence bundle expert witness | — | — | CHF 500–2,000 per case |
| Association membership fees | — | — | CHF 5,000–25,000/yr |

**Target by 2030:** 500+ organizations issuing SwissAttest credentials, 10M+ attestations per year, CHF 20–50M annual revenue.

---

## 5. Why Switzerland — The Structural Advantages

1. **Legal neutrality.** Swiss attestations are not subject to US subpoena, EU jurisdiction shopping, or Chinese data access requirements. For multinational organizations, a Swiss attestation authority is uniquely neutral.

2. **ZertES framework.** Swiss electronic signatures law already provides legal frameworks for qualified electronic signatures and seals. SwissAttest certificates can be designed to fit within (or extend) this framework.

3. **FINMA and banking trust.** Switzerland's existing reputation for financial trust transfers directly to information trust. "Swiss-attested" carries the same premium as "Swiss-made" or "Swiss-banked."

4. **Energy and infrastructure.** Switzerland's hydropower-dominated energy grid provides sustainable, low-cost electricity for any computational infrastructure. Cool alpine climate is ideal for data center operations.

5. **Data protection.** The new Swiss Federal Act on Data Protection (nDSG) provides strong privacy guarantees that align with SwissAttest's privacy-preserving design. Swiss data protection is recognized by the EU as "adequate," enabling cross-border data flows.

6. **Talent and ecosystem.** ETH Zürich, EPFL, Swiss Crypto Valley (Zug), and the established fintech ecosystem provide both technical talent and institutional credibility.

---

## 6. Risks and Open Questions

| Risk | Mitigation |
|---|---|
| AI trust crisis doesn't materialize as expected | AlpenSign (banking) remains a viable standalone business regardless |
| **"Big Bank Objection" — Tier 1 banks say they already have 2FA + WORM + Adobe** | **Revised GTM: don't lead with big banks. Target EAMs, law firms, and medtech where internal infrastructure is weaker. For banks, reposition as cross-institutional/cross-trust-boundary infrastructure, not a replacement for internal logs. The pitch: "Your logs protect you from FINMA. SwissAttest protects you from people who don't trust your logs."** |
| Regulatory framework moves faster than SwissAttest can establish | Early engagement with FINMA, BJ (Federal Office of Justice), and industry associations |
| C2PA or similar consortium captures the standard | Position SwissAttest as complementary (human approval) not competing (content tagging) |
| Device ecosystem remains too narrow (Seeker-only) | Phase 2 explicitly leverages MediaTek/TEEPIN for mainstream Android, plus TPM/Secure Enclave on enterprise laptops. Hardware is no longer the bottleneck. |
| **Credential chicken-and-egg problem** | **Professional bodies (FMH, SAV) must agree to issue or delegate on-chain credentials. Phase 1 bootstraps by targeting segments that can self-issue credentials (EAMs, law firm partners, hospital departments). Build traction and case law before approaching national professional bodies.** |
| **Security fragmentation on general Android/TPM devices** | **Budget for third-party penetration testing and EMFI resilience audits in Phase 2. Comparative security analysis across device classes. Tiered attestation confidence levels (Seeker Seed Vault > MediaTek TEE > general TPM) communicated transparently to verifiers.** |
| Swiss legal recognition is slow or uncertain | Build market adoption first; legal recognition follows commercial traction |
| Established e-signature companies (DocuSign, Adobe) move into this space | Their architecture is centralized and not designed for process attestation; SwissAttest's on-chain independence is structurally different. However, do not underestimate their distribution power — if they acquire a Web3 startup for decentralized process attestation, they could lock SwissAttest out of the enterprise market. Speed of adoption and legal embedding are the moat. |
| **AI platforms ship free "collaboration certificates"** | **Let them — this validates the market. Their certificates are self-serving (same problem as bank WORM logs). SwissAttest differentiates on: (1) independence from the AI vendor, (2) biometric/device binding, (3) cross-platform synthesis across tools that won't share data with each other. Position as complementary: "Your AI platform logs what the AI did. SwissAttest proves what the human decided."** |
| **First Swiss AI malpractice case hasn't happened yet** | **The "struggling moment" that drives purchasing may require a catalyst — a Swiss lawyer sued for AI-hallucinated precedents, a doctor challenged on AI-assisted diagnosis, a compliance officer personally prosecuted. SwissAttest must be ready (product exists, documentation is solid, pilots are running) before this moment arrives, not scrambling to build after.** |

---

## 7. Immediate Next Steps

**Phase 0 — Demand-Side Validation (start immediately, parallel to AlpenSign hackathon work):**

1. **Launch Swiss AI Dispute Monitor desk research** — use AI tools to crawl bger.ch, cantonal courts, FINMA enforcement actions, and international legal databases for AI-related professional disputes. Build the initial case database.
2. **Approach 2–3 professional liability insurers** (Zurich Insurance, AXA, Allianz) as data partners for the Monitor. Frame as: "Your anonymized claims data makes this authoritative. We're building the tool that prevents future claims."
3. **Contact Swiss Banking Ombudsman and cantonal Patient Ombudsmen** for anonymized dispute trend data involving AI-generated professional work.
4. **Draft and distribute a short survey** — "Has a client ever questioned whether your work was AI-generated?" — to Zürcher Anwaltsverband, cantonal medical societies, and EAM professional networks.
5. **Publish first Swiss AI Dispute Monitor report** — target 30+ documented incidents (Swiss + international precedents). Present at 1–2 professional events.

**Phase 1 — Technical & Commercial Foundation (parallel):**

6. **Complete AlpenSign hackathon submissions** (Monolith, StableHack, SwissHacks) — validates the entire technical stack and provides visibility
7. **File Swiss trademark for "SwissAttest"** — protect the brand early
8. **Obtain preliminary legal opinion on QES mapping** — how hardware-generated biometric seals (Seeker Seed Vault, TPM, MediaTek TEE) map to Qualified Electronic Signatures under ZertES. Critical investor ask.
9. **Draft white paper** — "Human Attestation in the AI Age: A Swiss Framework" for distribution to legal, medical, and financial industry contacts
10. **Engage ETH Zürich** — explore academic partnership for research on cryptographic attestation of human decision processes
11. **Map the legal landscape** — expand QES opinion into full comparative analysis covering ZertES, eIDAS, and common-law evidence rules
12. **Identify and approach 3–5 EAMs and 2–3 law firms** as Phase 1 pilot candidates — prioritize firms surfaced through the AI Dispute Monitor who have firsthand experience with AI trust disputes
13. **Define the revenue bridge from Phase 1 to Phase 2** — how will early customer revenue and relationships fund the SDK generalization?

---

*CONFIDENTIAL — Koivu GmbH internal strategic document*
*Not for distribution outside Koivu GmbH without written approval*
*February 2026 · v1.3*
*v1.3: Added AI Platform Collaboration Certificates to competitive landscape, Phase 0 demand-side validation (Swiss AI Dispute Monitor), cross-platform independence positioning.*
*v1.2: Technical solution architecture, revised GTM targeting, MediaTek/TEE scaling, trust-boundary positioning, credential bottleneck analysis, QES legal milestone, security audit budget.*
