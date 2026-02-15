# AlpenSign: Why a Solana Seeker Trust Model Could Be Stronger Than Google Titan M2

## The Google Titan M2 Problem Is the Trust Anchor

With the Pixel path, the attestation chain is: your signing key → Titan M2 attestation certificate → Google's intermediate CA → Google's root CA. The bank must trust Google. That means trusting that Google maintains its root keys properly, doesn't revoke your attestation for non-security reasons (e.g., you violated some ToS), and continues operating the service. For a Swiss bank subject to FINMA, having a critical authentication dependency on a US big tech company is a regulatory and operational risk. Google can change its attestation policies unilaterally, deprecate APIs, or get hit with a US government subpoena that compromises the root.

## What the Solana Chain Gives You Instead

The Seeker's Seed Vault generates a key pair. The TEEPIN architecture attests that this key was generated inside genuine Seeker hardware. That attestation gets written to Solana as an on-chain record — immutable, timestamped, publicly verifiable without calling anyone's server.

Now layer on the additional signals:

### Genesis NFT as Device Identity

The soulbound token is minted once per physical device and can't be transferred. The bank stores the Seeker's public key and checks on-chain: does this key belong to a wallet that holds a Genesis NFT? If yes, this is a real Seeker device, not an emulator. This is device authentication that doesn't depend on any single company's API being online.

### SKR Tokens as a Reputation/Staking Layer

This is where it gets interesting for banking. If the signing key's wallet holds staked SKR, the bank has an economic signal: the device owner has skin in the game. You could design a scheme where Koivu requires a minimum SKR stake as a "security deposit" for signing privileges. Fraudulent signing would result in slashing. This is something that has no equivalent in the Google model — you can't "stake" your Titan M2 attestation.

### On-Chain Audit Trail

Every attestation is on Solana, meaning the bank's compliance team can independently verify the full signing history without requesting logs from Koivu, Solana Mobile, or anyone. A FINMA auditor can check the chain directly. With Google, the attestation is ephemeral — it happens at signing time and isn't recorded anywhere unless you build that infrastructure yourself.

## The Deeper Architectural Point

The Titan M2 gives you better *hardware* security but a *centralized, opaque* trust model. The Seeker gives you *adequate* hardware security with a *decentralized, transparent, composable* trust model. For a Swiss bank, the second set of properties may matter more because:

- The bank doesn't have to trust a single foreign entity.
- The attestation record survives even if Solana Mobile goes bankrupt — the chain persists.
- The bank can programmatically verify everything (Genesis NFT, SKR stake, signing history) with a single RPC call, no bilateral API agreements needed.
- The whole model is auditable by regulators without depending on any company's cooperation.

## Where to Be Honest About the Tradeoff

The Seeker's TEE is not certified to EAL4+ like the Titan M2. If a sophisticated attacker physically compromises the MediaTek TEE, the on-chain attestation becomes garbage-in-garbage-out. The blockchain can't tell you the hardware was tampered with — it just faithfully records what the TEE claims. So the Solana model is stronger at the *trust and verification* layer but weaker at the *hardware tamper resistance* layer. For Koivu's use case — monitoring payments between banks, not guarding nuclear launch codes — that's probably the right tradeoff.
