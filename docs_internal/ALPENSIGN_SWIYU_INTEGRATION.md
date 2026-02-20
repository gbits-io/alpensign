# AlpenSign × swiyu E-ID Integration

> Standalone reference document for integrating Swiss federal E-ID verification into AlpenSign via the swiyu trust infrastructure. Contains everything needed to implement the integration — nothing more.

**Last updated:** 2026-02-20

---

## Why: The Problem This Solves

AlpenSign's evidence chain has three layers. Two are independently verifiable, one is not:

| Layer | What it proves | Source | Independent of bank? |
|-------|---------------|--------|---------------------|
| 1. Device Identity | Genuine Seeker hardware | Genesis Token (TEEPIN Guardians) | ✅ Yes |
| 2. Client Identity | Person behind the device | **Bank-issued credential** | ❌ **No — bank controls this** |
| 3. Payment Authorization | Specific payment was confirmed | Transaction Seal (Seed Vault + Solana) | ✅ Yes |

Layer 2 is the weak link. The bank does its own KYC and issues the credential. If the client disputes ("that wasn't me"), the bank's identity proof is self-serving — the same structural weakness AlpenSign was built to eliminate.

**swiyu fixes Layer 2.** The Swiss E-ID is issued by the federal government (not the bank), after passport scan + biometric liveness check. It's device-bound via the phone's secure element. If AlpenSign verifies the E-ID during enrollment, all three layers become independent of the bank:

```
Layer 1: Device genuine    → Genesis Token (decentralized Guardians)
Layer 2: Person verified   → Swiss E-ID (federal government via swiyu)  ← NEW
Layer 3: Payment authorized → Transaction Seal (Seed Vault + Solana)

In a dispute, the bank presents evidence it did not create at any layer.
```

**Strategic value:**
- Swiss banks will integrate swiyu once the e-ID Act takes effect (~Q3 2026). AlpenSign supporting it from day one positions Koivu ahead of the curve.
- First swiyu use case for financial transaction authorization (beyond age verification demos). High value for SwissHacks hackathon and media visibility.
- Eliminates the KYC dependency — the federal government already verified the person.

---

## Architecture Overview

AlpenSign acts as a **verifier** in the swiyu ecosystem. It asks the user to present their E-ID credential from the swiyu wallet. AlpenSign does not issue credentials (that's the federal government) and does not hold them (that's the swiyu wallet).

![swiyu Privacy by Design](https://prod-eidch-hcms-sdweb.imgix.net/dam/en/sd-web/fHiw0ntDr9WM/Technologie%20Privacybydesign%20EN.png?w=2048&auto=format)

### Components

```
┌─────────────────────┐     ┌──────────────────────────┐     ┌──────────────────┐
│  AlpenSign App       │     │  AlpenSign API Server     │     │  swiyu Generic    │
│  (Seeker / browser)  │     │  (Node.js — YOUR code)    │     │  Verifier         │
│                      │     │  ~150 lines               │     │  (Docker, Java)   │
│                      │     │                           │     │  Provided by the  │
│                      │     │                           │     │  federal gov      │
└──────────┬───────────┘     └─────────┬─────────────────┘     └────────┬─────────┘
           │                           │                                │
           │ HTTPS                     │ HTTP (internal)                │ HTTPS (public)
           │                           │                                │
           ▼                           ▼                                ▼
   User's Seeker phone         Your server / VPS              swiyu trust infra
                                                              (base registry,
                                                               trust registry)
```

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **swiyu Generic Verifier** | Java/Spring Boot + PostgreSQL (Docker) | Handles OID4VP protocol, signed JWTs, SD-JWT validation, trust chain verification. You configure it, don't modify it. |
| **AlpenSign API Server** | Node.js / Express (~150 lines) | Glue layer between AlpenSign app and the verifier. Creates verification requests, returns deep links, polls for results. |
| **AlpenSign App** | Existing vanilla JS app | Triggers verification, opens swiyu wallet via deep link, displays result. |

### Why a Server Is Required

A first prototype attempted pure client-side integration (OID4VP deep link with URL parameters). The swiyu wallet rejected it with "Invalid credential" because:

1. **`client_id_scheme` must be `did`** — swiyu requires a DID registered in the identifier registry, not a URL
2. **`response_mode` must be `direct_post`** — the wallet POSTs the VP token to a server endpoint
3. **Request must be a signed JWT** — not plain URL parameters
4. **`vct` must be `betaid-sdjwt`** — not the full URL Gemini suggested

The generic verifier handles all of this. Your Node.js server just talks to the verifier's management API.

---

## Sequence Diagram

```
┌──────────┐          ┌──────────────┐          ┌────────────────┐          ┌──────────────┐
│ AlpenSign │          │ AlpenSign    │          │ swiyu Generic  │          │ swiyu Wallet │
│ App       │          │ API Server   │          │ Verifier       │          │ (on phone)   │
│ (browser) │          │ (Node.js)    │          │ (Docker/Java)  │          │              │
└─────┬─────┘          └──────┬───────┘          └───────┬────────┘          └──────┬───────┘
      │                       │                          │                          │
      │ 1. Tap "Verify E-ID"  │                          │                          │
      │──────────────────────▶│                          │                          │
      │                       │                          │                          │
      │                       │ 2. POST /management/     │                          │
      │                       │    api/verifications      │                          │
      │                       │    {presentation_def,     │                          │
      │                       │     accepted_issuer_dids} │                          │
      │                       │─────────────────────────▶│                          │
      │                       │                          │                          │
      │                       │ 3. Returns:              │                          │
      │                       │    verification_id,       │                          │
      │                       │    verification_deeplink  │                          │
      │                       │◀─────────────────────────│                          │
      │                       │                          │                          │
      │ 4. Returns deeplink   │                          │                          │
      │    + verification_id  │                          │                          │
      │◀──────────────────────│                          │                          │
      │                       │                          │                          │
      │ 5. Opens swiyu wallet │                          │                          │
      │    via deep link      │                          │                          │
      │    (swiyu-verify://...) ─────────────────────────────────────────────────▶│
      │                       │                          │                          │
      │                       │                          │          6. Wallet shows │
      │                       │                          │          consent screen: │
      │                       │                          │          "Gbits wants to │
      │                       │                          │           verify your    │
      │                       │                          │           identity"      │
      │                       │                          │                          │
      │                       │                          │          7. User taps    │
      │                       │                          │             "Accept"     │
      │                       │                          │                          │
      │                       │                          │ 8. Wallet POSTs VP token │
      │                       │                          │    (direct_post to       │
      │                       │                          │     verifier's           │
      │                       │                          │     response_uri)        │
      │                       │                          │◀─────────────────────────│
      │                       │                          │                          │
      │                       │                          │ 9. Verifier validates:   │
      │                       │                          │    - SD-JWT signature    │
      │                       │                          │    - Issuer DID chain    │
      │                       │                          │    - Credential status   │
      │                       │                          │    State → SUCCESS       │
      │                       │                          │                          │
      │ 10. Poll: GET         │                          │                          │
      │     /api/verify-eid/:id                          │                          │
      │──────────────────────▶│                          │                          │
      │                       │ 11. GET /management/     │                          │
      │                       │     api/verifications/:id│                          │
      │                       │─────────────────────────▶│                          │
      │                       │                          │                          │
      │                       │ 12. Returns SUCCESS      │                          │
      │                       │     + disclosed attrs    │                          │
      │                       │◀─────────────────────────│                          │
      │                       │                          │                          │
      │ 13. Returns verified  │                          │                          │
      │     name to app       │                          │                          │
      │◀──────────────────────│                          │                          │
      │                       │                          │                          │
      │ 14. UI shows:         │                          │                          │
      │ "✅ E-ID verified:    │                          │                          │
      │  Roman Koivu"         │                          │                          │
      │                       │                          │                          │
```

---

## Onboarding Status (Gbits)

| Step | Status | Details |
|------|--------|---------|
| 1. ePortal login (AGOV/CH-Login) | ✅ Done | |
| 2. Register organisation | ✅ Done | Entity: **Gbits**, Partner ID: `32e02eb1-33e0-4669-b146-bd9066f1718c` |
| 3. Get API tokens | ✅ Done | Three API subscriptions obtained |
| 4. Create DID space | **→ Next** | |
| 5. Generate DID (didtoolbox) | Pending | |
| 6. Upload DID log | Pending | |
| 7. Deploy generic verifier | Pending | |
| 8. Build Node.js glue API | Pending | |
| 9. Integrate into AlpenSign app | Pending | |

### API Tokens Obtained

| API | Name | Purpose |
|-----|------|---------|
| `swiyucorebusiness_trust` | Trust Registry API | Register as trusted verifier (step 4 of trust onboarding) |
| `swiyucorebusiness_status` | Status Registry API | Check credential revocation status |
| `swiyucorebusiness_identifier` | Identifier Registry API | Manage DIDs on the base registry |

Portal: https://selfservice.api.admin.ch/api-selfservice/apis

### Base URLs

| Service | URL |
|---------|-----|
| Identifier Authoring API | `https://identifier-reg-api.trust-infra.swiyu-int.admin.ch` |
| Status Authoring API | `https://status-reg-api.trust-infra.swiyu-int.admin.ch` |
| Key Manager | `https://keymanager-prd.api.admin.ch` |

---

## Remaining Steps — Commands

### Step 4: Create DID Space

```bash
export SWIYU_PARTNER_ID="32e02eb1-33e0-4669-b146-bd9066f1718c"
export SWIYU_IDENTIFIER_REGISTRY_ACCESS_TOKEN="<your access token>"
export SWIYU_IDENTIFIER_REGISTRY_URL="https://identifier-reg-api.trust-infra.swiyu-int.admin.ch"

curl \
  -H "Authorization: Bearer $SWIYU_IDENTIFIER_REGISTRY_ACCESS_TOKEN" \
  -X POST "$SWIYU_IDENTIFIER_REGISTRY_URL/api/v1/identifier/business-entities/$SWIYU_PARTNER_ID/identifier-entries"
```

Response gives you `id` (→ `IDENTIFIER_REGISTRY_ID`) and `identifier_registry_url` (→ `IDENTIFIER_REGISTRY_URL` for the toolbox).

### Step 5: Generate DID

Requires Java 21+.

```bash
wget https://github.com/swiyu-admin-ch/didtoolbox-java/releases/latest/download/didtoolbox.jar

java -jar didtoolbox.jar create \
  --identifier-registry-url <IDENTIFIER_REGISTRY_URL from step 4> \
  > didlog.jsonl
```

This creates `.didtoolbox/` directory with three key pairs:
- `id_ed25519` / `id_ed25519.pem` — DID update key
- `auth-key-01` / `auth-key-01.pem` — authentication key  
- `assert-key-01` / `assert-key-01.pem` — assertion key (signs verification requests)

**⚠️ Back up `.didtoolbox/` immediately. These keys are your verifier identity.**

### Step 6: Upload DID Log

```bash
export IDENTIFIER_REGISTRY_ID="<id from step 4>"

curl --data-binary @didlog.jsonl \
  -H "Authorization: Bearer $SWIYU_IDENTIFIER_REGISTRY_ACCESS_TOKEN" \
  -H "Content-Type: application/jsonl+json" \
  -X PUT "$SWIYU_IDENTIFIER_REGISTRY_URL/api/v1/identifier/business-entities/$SWIYU_PARTNER_ID/identifier-entries/$IDENTIFIER_REGISTRY_ID"
```

Confirm:
```bash
curl "https://identifier-reg.trust-infra.swiyu-int.admin.ch/api/v1/did/$IDENTIFIER_REGISTRY_ID/did.jsonl"
```

### Step 7: Deploy Generic Verifier

```bash
# Get the compose file and env template
curl https://raw.githubusercontent.com/swiyu-admin-ch/swiyu-verifier/refs/heads/main/sample.compose.yml > docker-compose.yml
curl https://raw.githubusercontent.com/swiyu-admin-ch/swiyu-verifier/refs/heads/main/.env > .env
```

Edit `.env` with:
```
EXTERNAL_URL=https://<your-public-https-domain>/oid4vp
VERIFIER_DID=did:tdw:<scid>:identifier-reg.trust-infra.swiyu-int.admin.ch:api:v1:did:<IDENTIFIER_REGISTRY_ID>
DID_VERIFICATION_METHOD=<your DID>#auth-key-01
SIGNING_KEY=<contents of .didtoolbox/auth-key-01>
```

```bash
docker compose up -d
```

Verifier runs on port 8083 (management API, internal) and exposes OID4VP endpoints (public, HTTPS required).

### Step 8: Build the Node.js Glue API

```javascript
// server.js — AlpenSign ↔ swiyu verifier glue layer
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const VERIFIER_URL = process.env.VERIFIER_URL || 'http://localhost:8083';

// BCS issuer DID (federal government's Beta Credential Service)
// TODO: confirm this DID from swiyu documentation
const BCS_ISSUER_DID = process.env.BCS_ISSUER_DID || 'did:tdw:...';

// AlpenSign calls this to start E-ID verification
app.post('/api/verify-eid', async (req, res) => {
  try {
    const response = await fetch(`${VERIFIER_URL}/management/api/verifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accepted_issuer_dids: [BCS_ISSUER_DID],
        response_mode: 'direct_post',
        presentation_definition: {
          id: crypto.randomUUID(),
          input_descriptors: [{
            id: crypto.randomUUID(),
            format: {
              'vc+sd-jwt': {
                'sd-jwt_alg_values': ['ES256'],
                'kb-jwt_alg_values': ['ES256']
              }
            },
            constraints: {
              fields: [
                { path: ['$.vct'], filter: { type: 'string', const: 'betaid-sdjwt' } },
                { path: ['$.given_name'], purpose: 'Identity verification for payment sealing' },
                { path: ['$.family_name'], purpose: 'Identity verification for payment sealing' }
              ]
            }
          }]
        }
      })
    });

    const data = await response.json();
    res.json({
      verificationId: data.id,
      deepLink: data.verification_deeplink,
      state: 'PENDING'
    });
  } catch (err) {
    console.error('Failed to create verification:', err);
    res.status(500).json({ error: 'Verification service unavailable' });
  }
});

// AlpenSign polls this for the result
app.get('/api/verify-eid/:id', async (req, res) => {
  try {
    const response = await fetch(
      `${VERIFIER_URL}/management/api/verifications/${req.params.id}`
    );
    const data = await response.json();

    if (data.state === 'SUCCESS') {
      // TODO: extract disclosed attributes from VP token response
      // The exact field structure depends on the verifier's response format
      res.json({
        state: 'SUCCESS',
        givenName: data.disclosed_attributes?.given_name,
        familyName: data.disclosed_attributes?.family_name,
        verifiedAt: new Date().toISOString()
      });
    } else {
      res.json({ state: data.state }); // PENDING or FAILED
    }
  } catch (err) {
    console.error('Failed to check verification:', err);
    res.status(500).json({ error: 'Verification service unavailable' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AlpenSign API on port ${PORT}`));
```

### Step 9: Integrate Into AlpenSign App

In `app.js`, after Seed Vault wallet connection (enrollment step 2):

```javascript
async function verifyEID() {
  // 1. Request verification from our API server
  const resp = await fetch('https://<your-server>/api/verify-eid', { method: 'POST' });
  const { verificationId, deepLink } = await resp.json();

  // 2. Open swiyu wallet
  window.location.href = deepLink;

  // 3. When app regains focus, start polling
  const poll = setInterval(async () => {
    const result = await fetch(`https://<your-server>/api/verify-eid/${verificationId}`);
    const data = await result.json();

    if (data.state === 'SUCCESS') {
      clearInterval(poll);
      state.eidVerified = true;
      state.eidName = `${data.givenName} ${data.familyName}`;
      state.eidVerifiedAt = data.verifiedAt;
      state.eidVerificationId = verificationId;
      saveState();
      // Update UI
      $('eidStatus').innerHTML = `<span style="color: var(--green);">✅ Swiss E-ID verified: ${state.eidName}</span>`;
    } else if (data.state === 'FAILED') {
      clearInterval(poll);
      $('eidStatus').innerHTML = `<span style="color: var(--red);">❌ E-ID verification failed</span>`;
    }
  }, 2000);

  // Timeout after 120 seconds
  setTimeout(() => clearInterval(poll), 120000);
}
```

---

## Data Handling

### What AlpenSign stores where

| Data | Where | Why |
|------|-------|-----|
| Verified name | `localStorage` (AlpenSign state) | Display in UI, enrollment metadata |
| Verification timestamp | `localStorage` | Records when E-ID was verified |
| Verification ID | `localStorage` | Reference to server-side record |
| Full VP token / SD-JWT | **Server-side only** | Cryptographic proof with federal signature — too sensitive for localStorage, needed by bank for disputes |

### What does NOT go into the payment hash

The E-ID identity is bound to the **wallet**, not to individual payments. The payment hash covers: recipient, amount, IBAN, reference, timestamp. The identity link is:

```
Wallet address X → verified as "Roman Koivu" via Swiss E-ID (at enrollment)
Wallet address X → signed payment Y (at transaction time)
∴ "Roman Koivu" authorized payment Y
```

The binding is the wallet address. No need to repeat the name in every seal.

### What the bank receives in a dispute

1. Genesis Token → "Genuine Seeker device" (on-chain)
2. E-ID verification record → "Roman Koivu, verified by Swiss federal government on [date]" (VP token with federal signature, from server)
3. Transaction seal → "Wallet X authorized payment Y with biometric confirmation" (on-chain)
4. Wallet binding → Wallet X is the same across enrollment and seal

No piece of evidence was created by the bank.

---

## AlpenSign State Schema Addition

```javascript
// Added to localStorage alpensign_state
{
  // ... existing fields ...
  eidVerified: false,             // boolean
  eidName: null,                  // "Roman Koivu" — display only
  eidVerifiedAt: null,            // "2026-02-20T14:30:00Z"
  eidVerificationId: null         // "uuid-..." — reference to server record
}
```

### UI After Successful Verification (enrollment step 2)

```
✅ Seed Vault connected: 7xKp...3mNq
✅ Genesis Token verified
✅ Swiss E-ID verified: Roman Koivu
```

---

## Protocol Reference

| Parameter | Value (Public Beta) |
|-----------|-------------------|
| Credential format | SD-JWT VC |
| Signing algorithm | ES256 |
| Presentation protocol | OpenID4VP draft 20 (swiyu profile) |
| Client ID scheme | `did` (registered in swiyu identifier registry) |
| Response mode | `direct_post` |
| DID method | `did:tdw` (did:webvh v0.3) |
| Credential type (vct) | `betaid-sdjwt` — **will change for production** |
| Deep link scheme | `swiyu-verify://` |

---

## Infrastructure Requirements

| Component | Requirement |
|-----------|-------------|
| swiyu generic verifier | Docker host with PostgreSQL |
| Node.js glue API | Node.js 18+ |
| HTTPS | Required — swiyu wallet refuses non-HTTPS verifier endpoints |
| Java 21+ | For DID Toolbox (one-time DID generation, not runtime) |

Hosting options: Any VPS (Hetzner, DigitalOcean), Railway, Fly.io, or Render. The verifier + API + Postgres can share one small instance.

---

## Reference Links

| Resource | URL |
|----------|-----|
| swiyu technical docs | https://swiyu-admin-ch.github.io/introduction/ |
| Base & Trust Registry cookbook | https://swiyu-admin-ch.github.io/cookbooks/onboarding-base-and-trust-registry/ |
| Generic Verifier cookbook | https://swiyu-admin-ch.github.io/cookbooks/onboarding-generic-verifier/ |
| DID Toolbox releases | https://github.com/swiyu-admin-ch/didtoolbox-java/releases/latest |
| Generic Verifier Docker image | https://github.com/swiyu-admin-ch/swiyu-verifier |
| Community PoC (issuer + verifier) | https://github.com/eid-privacy/SWIYU-Demo |
| Interoperability profile | https://swiyu-admin-ch.github.io/specifications/interoperability-profile/ |
| Procivis interop notes | https://docs.procivis.ch/interop/swiyu |
| API self-service portal | https://selfservice.api.admin.ch/api-selfservice/apis |
| IdentityPlane BCS analysis | https://www.identityplane.com/post/swiss-e-id-beta-a-first-look |

---

*Document prepared for the AlpenSign project — github.com/gbits-io/alpensign*
*February 2026*
