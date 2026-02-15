# AlpenSign — SKR Staking & Slashing Mechanism Design

## Why Not Naive Staking?

In crypto validator staking, slashing is automated — the protocol detects double-signing mathematically. In payment authorization, "fraud" is a human judgment that happens days or weeks later. So the mechanism needs to be designed differently.

## The Actors and Their Roles

**User (bank client with Seeker)** — the one staking SKR as collateral against their signing privileges.

**Koivu** — operates the smart contract (Solana program) that manages the staking, defines the slashing conditions, and acts as the intermediary between the bank's fraud determination and the on-chain consequence.

**Bank** — determines whether a signed transaction was legitimate or fraudulent, based on its own investigation processes. The bank is the *oracle* in this system — it's the source of truth about whether a real-world payment was authorized.

**Solana program (Koivu's smart contract)** — enforces the staking rules, lock-up periods, and slashing execution on-chain.

## The Lifecycle

### 1. Staking (Before Any Signing Happens)

The user acquires SKR tokens (bought, earned through Seeker ecosystem participation, or provided by Koivu as part of onboarding). The user calls Koivu's Solana program to stake a minimum amount — say 500 SKR — into a signing escrow account. This stake is locked and associated with the user's Seeker public key. The Koivu server verifies the stake exists before allowing that device to be registered with the bank. The bank can also verify independently via RPC: "does the wallet behind this pubkey have an active stake?"

The stake serves as a declaration: "I am a real person with a real device and I'm putting economic value behind my signing authority."

### 2. Active Signing (Normal Operations)

Every time the user signs a transaction through AlpenSign, the Koivu server checks that the stake is still active and above the minimum threshold before forwarding the signature to the bank. The signing attestation written to Solana now also references the staking account, creating a link between the economic commitment and each individual transaction.

### 3. Dispute / Fraud Detection (The Hard Part)

A bank detects a fraudulent or unauthorized payment — maybe through its own monitoring, a customer complaint, or a Koivu continuous verification test that reveals anomalies. The bank notifies Koivu: "Transaction X, signed by device Y, is disputed."

Now here's the critical design decision: **who can trigger slashing?**

**Option A: Bank-triggered slashing** — The bank is given the role of a slashing authority on the smart contract. It submits a signed slashing request to the Solana program, referencing the disputed transaction's on-chain attestation. The program verifies the bank's signature (the bank has its own keypair registered in the contract) and executes the slash. This is simple but gives the bank unilateral power, which the user might not accept.

**Option B: Multi-sig slashing** — Slashing requires signatures from both the bank AND Koivu. Neither can slash alone. This protects the user from a single actor acting maliciously. Koivu acts as a check on the bank's fraud determination.

**Option C: Time-locked dispute with challenge** — The bank submits a slashing proposal with evidence (the disputed tx hash). There's a challenge period (say 7 days) during which the user can submit counter-evidence. If unchallenged, the slash executes automatically. If challenged, it escalates to a pre-agreed arbitration process (which could be a DAO, a Swiss arbitration body, or simply Koivu as arbiter). This is the most fair but the most complex.

### 4. Slashing Execution

When slashing is triggered and confirmed, the Solana program transfers a portion (or all) of the staked SKR to a penalty address. Where do the slashed tokens go? Options:

- **Burned** — deflationary, benefits all SKR holders.
- **Sent to the bank** — direct compensation.
- **Sent to a Koivu insurance pool** — funds future dispute resolution.

The user's signing privileges are simultaneously revoked — the Koivu server sees the stake is below minimum and stops forwarding signatures. The bank is notified on-chain that the device is no longer authorized.

### 5. Voluntary Unstaking (Offboarding)

When a user wants to stop using AlpenSign, they initiate an unstaking request. There's a mandatory cooldown period — say 30 days — during which the bank can still submit slashing claims for recently signed transactions. After the cooldown, the remaining SKR is returned to the user's wallet, and the signing key is deregistered.

## What Makes This Stronger Than Pure Hardware Attestation

The Titan M2 path has no economic layer at all. If a Pixel user's key is compromised and used to sign a fraudulent payment, the only recourse is legal — lawsuits, police, insurance claims. The hardware attestation proves nothing about intent or accountability.

With SKR staking, you get several things that don't exist in the Google model:

- The user has pre-committed collateral that can be seized programmatically without courts.
- The response time is minutes (on-chain) rather than months (legal).
- The entire dispute history is transparent and auditable on Solana.
- The economic incentive is *preventive* — a user with 500 SKR at risk is less likely to be careless with their device.

## Honest Caveats

The stake amount needs to be meaningful relative to the transaction values. If you're signing CHF 10,500 payments but only staking CHF 50 worth of SKR, the economic deterrent is negligible. There's also a bootstrapping problem: early users may not have SKR, so Koivu might need to front the initial stake or accept a grace period. And finally, slashing doesn't reverse the fraudulent payment — it's a penalty, not a remedy. The bank still needs its own fraud recovery processes.
