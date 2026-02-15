# AlpenSign — Sequence Diagram (Solana Seeker + Koivu)

```
Actors:
  [User]     = Bank client with Solana Seeker phone
  [Seeker]   = Seed Vault / TEE on the Seeker device
  [Koivu-C]  = Koivu client app (runs on Seeker, WebAuthn + Solana)
  [Koivu-S]  = Koivu server (payment orchestration)
  [Solana]   = Solana blockchain (via RPC provider)
  [Bank]     = Financial institution


═══════════════════════════════════════════════════════════════════════════════════
 PHASE 1: DEVICE ONBOARDING & KEY REGISTRATION
═══════════════════════════════════════════════════════════════════════════════════

  User          Seeker         Koivu-C        Koivu-S        Solana         Bank
   │              │              │              │              │              │
   │  Power on    │              │              │              │              │
   │  + setup     │              │              │              │              │
   ├─────────────>│              │              │              │              │
   │              │              │              │              │              │
   │              │ Generate     │              │              │              │
   │              │ key pair     │              │              │              │
   │              │ in TEE       │              │              │              │
   │              │─ ─ ─ ─ ┐    │              │              │              │
   │              │         │    │              │              │              │
   │              │<─ ─ ─ ─ ┘    │              │              │              │
   │              │ (privkey     │              │              │              │
   │              │  never       │              │              │              │
   │              │  leaves)     │              │              │              │
   │              │              │              │              │              │
   │              │  Mint Genesis NFT (soulbound)              │              │
   │              │──────────────┼──────────────┼─────────────>│              │
   │              │              │              │              │              │
   │              │  Write TEEPIN attestation                  │              │
   │              │──────────────┼──────────────┼─────────────>│              │
   │              │              │              │       ┌──────│              │
   │              │              │              │       │ store│              │
   │              │              │              │       │ on   │              │
   │              │              │              │       │ chain │              │
   │              │              │              │       └─────>│              │
   │              │              │              │              │              │
   │  Open Koivu  │              │              │              │              │
   │  client app  │              │              │              │              │
   ├──────────────┼─────────────>│              │              │              │
   │              │              │              │              │              │
   │              │  Export      │              │              │              │
   │              │  public key  │              │              │              │
   │              ├─────────────>│              │              │              │
   │              │              │              │              │              │
   │              │              │  Register    │              │              │
   │              │              │  pubkey +    │              │              │
   │              │              │  wallet addr │              │              │
   │              │              ├─────────────>│              │              │
   │              │              │              │              │              │
   │              │              │              │  Verify Genesis NFT        │
   │              │              │              ├─────────────>│              │
   │              │              │              │<─────────────┤              │
   │              │              │              │  ✓ valid     │              │
   │              │              │              │              │              │
   │              │              │              │  Verify TEEPIN attestation │
   │              │              │              ├─────────────>│              │
   │              │              │              │<─────────────┤              │
   │              │              │              │  ✓ genuine   │              │
   │              │              │              │  hardware    │              │
   │              │              │              │              │              │
   │              │              │              │  Check SKR stake           │
   │              │              │              ├─────────────>│              │
   │              │              │              │<─────────────┤              │
   │              │              │              │  ✓ staked    │              │
   │              │              │              │              │              │
   │              │              │              │  Register    │              │
   │              │              │              │  pubkey +    │              │
   │              │              │              │  device ID   │              │
   │              │              │              │  with bank   │              │
   │              │              │              ├──────────────┼─────────────>│
   │              │              │              │              │              │
   │              │              │              │              │    Verify    │
   │              │              │              │              │    on-chain  │
   │              │              │              │              │<─────────────┤
   │              │              │              │              ├─────────────>│
   │              │              │              │              │    ✓ NFT     │
   │              │              │              │              │    ✓ TEE     │
   │              │              │              │              │    ✓ SKR     │
   │              │              │              │              │              │
   │              │              │              │              │  Store pubkey│
   │              │              │              │<─────────────┼──────────────┤
   │              │              │              │  ✓ registered│              │
   │              │              │<─────────────┤              │              │
   │<─────────────┼──────────────┤              │              │              │
   │  "HSM Ready" │              │              │              │              │
   │              │              │              │              │              │


═══════════════════════════════════════════════════════════════════════════════════
 PHASE 2: TRANSACTION SIGNING
═══════════════════════════════════════════════════════════════════════════════════

  User          Seeker         Koivu-C        Koivu-S        Solana         Bank
   │              │              │              │              │              │
   │              │              │              │              │  Payment     │
   │              │              │              │              │  order       │
   │              │              │              │<─────────────┼──────────────┤
   │              │              │              │              │              │
   │              │              │  Push tx     │              │              │
   │              │              │  details     │              │              │
   │              │              │<─────────────┤              │              │
   │              │              │              │              │              │
   │  Show payment│              │              │              │              │
   │  details     │              │              │              │              │
   │<─────────────┼──────────────┤              │              │              │
   │              │              │              │              │              │
   │  ┌─────────────────────┐   │              │              │              │
   │  │ Recipient: ABC GmbH │   │              │              │              │
   │  │ Amount: CHF 10,500  │   │              │              │              │
   │  │ IBAN: CH78 7838 ... │   │              │              │              │
   │  └─────────────────────┘   │              │              │              │
   │              │              │              │              │              │
   │  Approve     │              │              │              │              │
   │  (fingerprint)              │              │              │              │
   ├─────────────>│              │              │              │              │
   │              │              │              │              │              │
   │              │ ┌──────────┐ │              │              │              │
   │              │ │ SHA-256  │ │              │              │              │
   │              │ │ hash tx  │ │              │              │              │
   │              │ │          │ │              │              │              │
   │              │ │ ECDSA    │ │              │              │              │
   │              │ │ sign     │ │              │              │              │
   │              │ │ (P-256)  │ │              │              │              │
   │              │ │          │ │              │              │              │
   │              │ │ inside   │ │              │              │              │
   │              │ │ TEE      │ │              │              │              │
   │              │ └──────────┘ │              │              │              │
   │              │              │              │              │              │
   │              │  Signature   │              │              │              │
   │              ├─────────────>│              │              │              │
   │              │              │              │              │              │
   │              │              │  Signature + │              │              │
   │              │              │  tx hash     │              │              │
   │              │              ├─────────────>│              │              │
   │              │              │              │              │              │
   │              │              │              │  Write signing attestation │
   │              │              │              │  (tx hash, sig, timestamp) │
   │              │              │              ├─────────────>│              │
   │              │              │              │       ┌──────│              │
   │              │              │              │       │ immut│              │
   │              │              │              │       │ able │              │
   │              │              │              │       │ audit│              │
   │              │              │              │       │ trail│              │
   │              │              │              │       └─────>│              │
   │              │              │              │              │              │
   │              │              │              │  Forward sig │              │
   │              │              │              │  + tx hash   │              │
   │              │              │              │  + Solana tx │              │
   │              │              │              ├──────────────┼─────────────>│
   │              │              │              │              │              │
   │              │              │              │              │   ┌─────────┐│
   │              │              │              │              │   │ Verify  ││
   │              │              │              │              │   │ sig vs  ││
   │              │              │              │              │   │ stored  ││
   │              │              │              │              │   │ pubkey  ││
   │              │              │              │              │   └─────────┘│
   │              │              │              │              │              │
   │              │              │              │              │  Verify      │
   │              │              │              │              │  on-chain    │
   │              │              │              │              │  attestation │
   │              │              │              │              │<─────────────┤
   │              │              │              │              ├─────────────>│
   │              │              │              │              │   ✓ recorded │
   │              │              │              │              │              │
   │              │              │              │  Payment     │              │
   │              │              │              │  authorized  │              │
   │              │              │              │<─────────────┼──────────────┤
   │              │              │<─────────────┤              │              │
   │<─────────────┼──────────────┤              │              │              │
   │  "✓ Signed"  │              │              │              │              │
   │              │              │              │              │              │


═══════════════════════════════════════════════════════════════════════════════════
 PHASE 3: AUDIT / COMPLIANCE (async, anytime)
═══════════════════════════════════════════════════════════════════════════════════

  User          Seeker         Koivu-C        Koivu-S        Solana         Bank
   │              │              │              │              │              │
   │              │              │              │              │   FINMA      │
   │              │              │              │              │   auditor    │
   │              │              │              │              │   requests   │
   │              │              │              │              │   proof      │
   │              │              │              │              │<─────────────┤
   │              │              │              │              │              │
   │              │              │              │              │  Return:     │
   │              │              │              │              │  • Genesis   │
   │              │              │              │              │    NFT mint  │
   │              │              │              │              │  • TEEPIN    │
   │              │              │              │              │    attesta-  │
   │              │              │              │              │    tions     │
   │              │              │              │              │  • All tx    │
   │              │              │              │              │    signing   │
   │              │              │              │              │    records   │
   │              │              │              │              │  • SKR stake │
   │              │              │              │              │    history   │
   │              │              │              │              ├─────────────>│
   │              │              │              │              │              │
   │              │              │              │              │  ✓ Full      │
   │              │              │              │              │  audit trail │
   │              │              │              │              │  without     │
   │              │              │              │              │  requesting  │
   │              │              │              │              │  data from   │
   │              │              │              │              │  Koivu or    │
   │              │              │              │              │  Solana      │
   │              │              │              │              │  Mobile      │
   │              │              │              │              │              │


═══════════════════════════════════════════════════════════════════════════════════
 TRUST MODEL SUMMARY
═══════════════════════════════════════════════════════════════════════════════════

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                                                                         │
  │  GOOGLE TITAN M2 PATH          SOLANA SEEKER PATH                      │
  │  ─────────────────────         ──────────────────────                   │
  │                                                                         │
  │  Signing Key                   Signing Key                              │
  │       │                             │                                   │
  │       ▼                             ▼                                   │
  │  Titan M2 Attestation          TEEPIN Attestation                      │
  │       │                             │                                   │
  │       ▼                             ▼                                   │
  │  Google Intermediate CA        Solana On-Chain Record                   │
  │       │                             │                                   │
  │       ▼                             ├──> Genesis NFT (device proof)     │
  │  Google Root CA                     ├──> SKR Stake (economic skin)      │
  │       │                             └──> Tx History (immutable audit)   │
  │       ▼                                                                 │
  │  ⚠ Single point of trust      ✓ Decentralized verification            │
  │  ⚠ US jurisdiction risk        ✓ No single trust dependency            │
  │  ⚠ Ephemeral attestation       ✓ Persistent on-chain proof             │
  │  ✓ EAL4+ certified HW         ⚠ TEE (no public certification)         │
  │                                                                         │
  └─────────────────────────────────────────────────────────────────────────┘
```
