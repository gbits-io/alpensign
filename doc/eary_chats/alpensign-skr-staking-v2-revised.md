# AlpenSign — Revised SKR Staking Model (v2)

## Why the Original Client-Staking Model Was Wrong

The initial design assumed bank clients would stake SKR tokens as collateral against their signing privileges. This fails for two reasons:

1. **Bank clients won't do it.** A corporate treasurer wants to authorize payments, not become a DeFi participant. Asking them to acquire SKR, manage token balances, and accept crypto price exposure just to sign a wire transfer adds friction and risk that defeats the purpose.

2. **Most failures aren't the client's fault.** Bugs in Koivu's software, Solana SMS updates breaking TEEPIN flows, MediaTek firmware issues, RPC outages — none of these are attributable to the person holding the Seeker. Slashing a client for infrastructure failures they can't control would be unjust and legally problematic under Swiss contract law.

Staking/slashing is a validator economics metaphor. It doesn't map onto the bank-client relationship.

## The Corrected Model: Koivu Stakes, Client Just Signs

### Actors and Roles

**User (bank client with Seeker)** — holds the device, authenticates with fingerprint, signs transactions. Has no direct relationship with SKR tokens or the Solana program. The Seeker and Genesis NFT are their only on-chain footprint.

**Koivu** — the service provider making claims about signing integrity. Koivu stakes SKR as a service-level guarantee to the bank. Koivu operates the Solana program, pays all transaction fees, and bears the economic risk for infrastructure failures.

**Bank** — consumes Koivu's signing service. Verifies signatures against stored public keys and checks on-chain attestations. In case of disputes, the bank's recourse is against Koivu's stake, not the client's wallet.

**Solana program (Koivu's smart contract)** — manages Koivu's staking pool, records signing attestations, and enforces slashing conditions.

### The Lifecycle

#### 1. Koivu Onboarding With a Bank

Koivu enters a service agreement with the bank. As part of the agreement, Koivu stakes a defined amount of SKR into a bank-specific escrow account on Solana. The stake amount is proportional to the transaction volume or risk tier agreed with the bank. The bank receives the escrow account address and can verify the stake independently via RPC at any time.

This stake is Koivu's declaration: "We stand behind the integrity of our signing infrastructure, and here's economic collateral to prove it."

#### 2. Client Onboarding (Unchanged, Simple)

The client receives a Seeker (or already owns one). They open the Koivu app, generate a key pair in the Seed Vault, and the Genesis NFT verifies device authenticity. Koivu registers the client's public key with the bank. The client never touches SKR, never interacts with a Solana wallet, never thinks about staking. From their perspective, they paired a phone and can now sign payments with their fingerprint.

#### 3. Active Signing (Unchanged)

The client signs transactions via biometric authentication. Koivu writes attestations to Solana (paying the tx fees). The bank verifies signatures and can audit the on-chain trail. The client's experience is identical to any banking app — no crypto friction.

#### 4. Dispute / Failure Handling

A bank detects an issue — a fraudulent signature, a failed attestation, or a verification anomaly. The bank investigates and determines the cause.

**If the cause is client-side** (e.g., the client lost their Seeker and someone else used it before reporting it): This is handled through standard banking procedures — device revocation, fraud investigation, insurance. No slashing. The client's key is deregistered, and they onboard a new device.

**If the cause is Koivu's infrastructure** (e.g., a software bug forwarded a bad signature, an attestation wasn't written due to a Koivu server error, or a Solana SMS update broke the signing flow): The bank submits a slashing claim against Koivu's staked SKR. The claim references the on-chain attestation (or absence thereof) as evidence. Koivu has a challenge period (e.g., 14 days) to investigate and respond. If the claim is valid, the Solana program executes the slash.

**If the cause is ambiguous or systemic** (e.g., a MediaTek TEE vulnerability affecting all Seekers): This falls under the service agreement's force majeure provisions. Koivu must notify the bank, suspend affected devices, and remediate. Slashing may or may not apply depending on the contractual terms, but the on-chain record provides a transparent timeline of when Koivu knew about the issue and how fast it responded.

#### 5. Slashing Execution

When a valid claim is confirmed, the Solana program transfers SKR from Koivu's escrow to a penalty address. Options for slashed tokens:

- **Sent to the bank** — direct compensation for the service failure.
- **Burned** — reduces SKR supply, which benefits the ecosystem if Koivu holds significant SKR reserves (aligning Koivu's incentive to maintain quality).
- **Sent to an insurance pool** — managed by a DAO or multi-sig for future dispute resolution.

The most practical option for Swiss banking is probably direct compensation to the bank, converted to CHF equivalent. This keeps it simple and legally familiar.

#### 6. Stake Maintenance

Koivu must maintain its stake above the contractually agreed minimum. If slashing events reduce the stake below this threshold, Koivu must top it up within a defined period or the bank can suspend the service. The bank monitors the stake balance on-chain — no need to request reports from Koivu.

This creates a transparent, real-time creditworthiness signal: if a bank sees Koivu's stake declining across multiple bank escrows, that's an early warning about systemic quality issues.

#### 7. Service Termination

If Koivu and the bank end their relationship, there's a cooldown period (e.g., 90 days) matching the bank's dispute window for recent transactions. After the cooldown, remaining staked SKR is returned to Koivu.

## What the Client Experiences

The client's journey is deliberately crypto-free:

1. Receive a Seeker phone (or buy one).
2. Open the Koivu app, scan fingerprint, pair device.
3. See payment details, tap to sign.
4. Done.

No wallet setup. No token purchases. No staking UI. No gas fees. The Seeker's Genesis NFT and on-chain attestations happen silently in the background, managed entirely by Koivu.

## What the Bank Gets

- A hardware-attested signing key per client, verified via on-chain Genesis NFT.
- An immutable audit trail of every signed transaction on Solana.
- Economic collateral from Koivu that can be slashed without courts.
- Independent, real-time verification of Koivu's service quality via on-chain stake monitoring.
- No dependency on Google, Apple, or any single US tech company for the trust chain.

## What Koivu Gets

- A credible, verifiable commitment to service quality that differentiates it from competitors.
- A trust model that Swiss banks can understand: collateral-backed guarantees with transparent monitoring.
- Alignment with the Solana Seeker ecosystem (SKR usage, Genesis NFT integration) without forcing crypto complexity onto bank clients.

## Remaining Considerations

**Stake sizing** — needs to be meaningful relative to the transaction volumes Koivu processes for each bank. Too small and it's theater; too large and it's a capital burden that makes the business unviable. This is a commercial negotiation, not a protocol parameter.

**SKR price volatility** — if the stake is denominated in SKR but the obligation is denominated in CHF, a price crash could make the stake worthless as a guarantee. Options: over-collateralize, use a stablecoin alongside SKR, or define the stake in CHF-equivalent terms with automatic top-up triggers.

**Legal enforceability** — the on-chain slashing mechanism should be mirrored in a Swiss-law service agreement. The smart contract executes the economic consequence, but the contractual framework defines what constitutes a valid claim. Belt and suspenders.
