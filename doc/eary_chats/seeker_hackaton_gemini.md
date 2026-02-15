# AlpineSign: Hackathon Handover Document

## 1. Project Overview
AlpineSign is a hardware-bound authorization service designed for high-value banking and 3D-Secure payments. By leveraging the **Solana Seeker’s Seed Vault**, it creates a mobile-native HSM that ensures "What You See Is What You Sign" (WYSIWYS).

- **Core Goal:** Replace insecure SMS/Software-Push with hardware-enforced cryptographic signatures.
- **Key Tech:** Solana Mobile Wallet Adapter (MWA), Seed Vault, Node.js, Socket.io.

---

## 2. Master Architecture
The solution relies on a Trusted Execution Environment (TEE) isolation model.



### Components:
1. **Merchant App (Web):** A fake flight booking site ("SeekerAir") where the transaction starts.
2. **Bridge Server (Node.js):** The signaling layer that routes requests between the laptop and the phone.
3. **AlpineSign PWA (Seeker):** The banking application that interacts with the hardware Seed Vault via MWA.

---

## 3. Implementation Plan: Sprint 0 (The Golden Path)

### Goal:
Complete a cross-device payment authorization where a fingerprint on the Seeker confirms a purchase on a laptop.

### User Flow:
1. **Enrollment:** User binds their Seeker PubKey to their banking ID in the PWA.
2. **Trigger:** Laptop checkout page sends a `payment_request` to the Bridge Server.
3. **Signal:** Bridge Server emits an `authorize_request` to the Seeker PWA via Socket.io.
4. **Action:** User taps a modal in the PWA, triggering the MWA `signMessages` call.
5. **Hardware:** User performs a biometric scan + physical double-tap on the Seeker.
6. **Verification:** Server verifies the Ed25519 signature and confirms the payment on the laptop.

---

## 4. Developer TODOs

### Bridge Server (Node.js/TypeScript)
- [ ] Set up a Socket.io server to bridge `Merchant` and `PWA` clients.
- [ ] Create `/register-device` endpoint to map `userId` to `publicKey`.
- [ ] Implement `@solana/web3.js` signature verification logic for the incoming payloads.

### Seeker Bank PWA (React + MWA)
- [ ] Implement `@solana-mobile/wallet-adapter-mobile` for `authorize` (Enrollment) and `signMessages` (Payment).
- [ ] Build a "Pseudo-Push" listener that shows a modal when a socket event is received.
- [ ] **Security Rule:** Ensure the `signMessages` payload is a hash of the transaction data.

### Frontend Merchant Site
- [ ] Simple HTML/Tailwind checkout page with a "Pay with Seeker" button.
- [ ] Listen for the `payment_verified` event to show the success state.

---

## 5. Security & Privacy Design
- **Hashing:** On-chain "receipts" (Sprints 1+) will only store SHA-256 hashes of transaction details to protect user privacy and comply with Swiss Banking Secrecy.
- **Non-Repudiation:** The combination of hardware-bound keys and physical user intent (double-tap) provides absolute legal certainty for the bank.

---

## 6. Future roadmap (Bonus Points)
- **SKR Token:** Stake SKR to unlock institutional limits.
- **SAS:** Use Solana Attestation Service to verify Seeker device health.
- **cNFTs:** Mint immutable receipts to the ledger for every transaction.
