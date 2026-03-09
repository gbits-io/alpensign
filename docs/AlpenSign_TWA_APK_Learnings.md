# AlpenSign TWA / APK Learnings

**Project:** AlpenSign v0.7.0 — Solana Seeker Hackathon  
**Date:** March 2026  
**Context:** Packaging AlpenSign as an Android APK via PWABuilder for hackathon submission

---

## Background

AlpenSign is a zero-dependency Progressive Web App (PWA) that uses Solana Mobile's **Mobile Wallet Adapter (MWA)** to communicate with the Seeker phone's Seed Vault for biometric payment signing. It runs entirely in the browser — no backend, no build step.

For the Solana Seeker Hackathon, an APK is a mandatory submission artifact. We used **PWABuilder** to wrap the PWA as a **Trusted Web Activity (TWA)** — a standard approach for packaging PWAs as Android apps.

Two critical issues surfaced immediately.

---

## Issue 1: MWA WebSocket Fails Inside TWA

### How MWA Works

MWA follows a multi-step protocol for dApp ↔ wallet communication:

1. The dApp calls `transact()`, which fires a `solana-wallet://` Android intent
2. The intent launches the Seed Vault app
3. Seed Vault starts a **local WebSocket server** on a random port (e.g., `ws://localhost:51931/solana-wallet`)
4. The MWA library in the browser connects to this localhost WebSocket
5. All communication (authorization, signing) happens over this encrypted WebSocket channel

### What Breaks

Inside a TWA, step 4 fails. The error:

```
Failed to connect to the wallet websocket at ws://localhost:51931/solana-wallet
```

The intent fires (the port is negotiated), but the WebSocket connection from the TWA's Chrome Custom Tab process to the Seed Vault's localhost server is blocked. This is a **platform-level limitation** — the TWA process either cannot access localhost WebSocket servers started by other apps, or the intent dispatch doesn't properly launch the Seed Vault activity in a way that allows the return WebSocket connection.

### Why It Cannot Be Fixed in JavaScript

This is not a code bug. The MWA protocol fundamentally requires `ws://localhost` connectivity between two Android processes (the dApp browser context and the wallet app). In a regular Chrome tab, this works because Chrome on Android permits `ws://localhost` from HTTPS pages (localhost is treated as a secure context). The TWA's Chrome Custom Tab process does not have the same behavior.

No amount of JavaScript can make a blocked WebSocket connection succeed. The restriction is in the Android/Chrome process model, not in the web application.

### Workarounds Attempted

| Approach | Result |
|----------|--------|
| Detect TWA and show "Open in Chrome" button | Works technically, but terrible UX — user installs app, then app tells them to open Chrome |
| Detect TWA upfront and skip MWA entirely | Defeats the purpose — the app's core feature is Seed Vault signing |
| Wait for MWA timeout, then show fallback | 30-second wait before showing an error — unacceptable |

All JavaScript-level workarounds result in a fundamentally broken user experience.

---

## Issue 2: BroadcastChannel Doesn't Cross TWA Boundary

### The Problem

AlpenSign and the Bank Simulator communicate via `BroadcastChannel`. In Chrome, both pages share the same browser profile and origin, so messages flow freely.

A TWA runs in a separate Chrome Custom Tab process. `BroadcastChannel` only works between browsing contexts that share the **same origin AND the same browser profile/process**. The TWA's process is isolated.

### The Fix

We implemented a **dual-transport StorageBridge**: messages are sent via both `BroadcastChannel` (fast-path, for same-process contexts) and `localStorage` + the `storage` event (cross-context fallback). The `storage` event fires in other tabs/contexts when a key changes and reliably crosses the TWA boundary since `localStorage` is shared across all contexts on the same origin.

This fix is clean, non-invasive, and has zero user-facing impact. It remains in the codebase regardless of the APK approach.

---

## Issue 3: Shared State Between TWA and Chrome

### The Problem

Because `localStorage` is shared between the TWA and Chrome (same origin), any state from a previous Chrome session bleeds into the TWA. If the user previously used AlpenSign in Chrome (e.g., completed enrollment step 1), the TWA inherits that state and skips the welcome screen, dropping the user into the middle of an enrollment flow with no context.

### Implication

This is actually correct behavior for a production app — you *want* state continuity. But for the hackathon demo, it creates confusing first impressions when judges open the APK and land on an unexpected screen.

---

## Issue 4: Duplicate Activity on Intent Return

When MWA fires the `solana-wallet://` intent from inside the TWA, Android needs to return to AlpenSign after the Seed Vault finishes. Android sees two handlers for the `alpensign.com` URL — the TWA app and Chrome. This can cause a **second instance** of the TWA activity to launch, or an app chooser dialog to appear. This is the classic "TWA duplicate activity" problem with Android intents.

---

## Root Cause Analysis

All four issues share a single root cause: **a TWA is not a native app**. It's a Chrome Custom Tab with a verified Digital Asset Link that hides the URL bar. It inherits Chrome's security model, process isolation, and intent handling — but with subtle differences that break assumptions made by protocols like MWA.

MWA was designed for two scenarios:

1. **Native Android apps** using the Kotlin/Java MWA client library (full intent + WebSocket control)
2. **Chrome browser tabs** where localhost WebSocket and intent dispatch work natively

A TWA is neither. It's a hybrid that sits in between, and MWA's localhost WebSocket protocol falls through the gap.

---

## Solution: The `apk.html` Launch Page

Since an APK is mandatory for submission but the core feature (MWA/Seed Vault) only works in Chrome, we created a **branded launch page** that bridges the gap:

### Architecture

```
manifest.json → start_url: "/apk.html"

┌─────────────────────────────┐
│  APK (TWA)                  │
│  ┌───────────────────────┐  │
│  │  apk.html             │  │
│  │  - AlpenSign branding │  │
│  │  - Feature overview   │  │
│  │  - Judge disclaimer   │  │
│  │  - "Launch" button ───┼──┼──→ Chrome (intent://...package=com.android.chrome)
│  └───────────────────────┘  │         │
└─────────────────────────────┘         ▼
                                   app.html + app.js
                                   (full MWA, Seed Vault, everything works)
```

### How It Works

1. The APK opens `apk.html` — a static page with the AlpenSign logo, a one-line pitch, trust badges, and a "Launch AlpenSign" button
2. A short disclaimer explains to hackathon judges why the app opens in Chrome (MWA requires localhost WebSocket only available in the browser)
3. The button fires an Android intent targeting Chrome specifically: `intent://alpensign.com/app.html#Intent;scheme=https;package=com.android.chrome;end`
4. Chrome opens with full MWA/Seed Vault functionality
5. `apk.html` has zero JavaScript dependencies, zero MWA, zero WebSocket — nothing that can break inside the TWA

### Why This Works

- **Zero TWA limitations** — `apk.html` is pure static HTML/CSS, nothing to break
- **Full functionality** — Chrome handles MWA natively, no workarounds needed
- **Clean UX** — one tap from app icon to working app, with context for the judges
- **Honest** — doesn't pretend the TWA is a native app; explains the constraint transparently

### Files Changed

| File | Change |
|------|--------|
| `apk.html` | **New** — branded launch page with Chrome redirect |
| `manifest.json` | `start_url` changed from `/` to `/apk.html` |
| `app.js` | StorageBridge + improved Seeker detection (no TWA workarounds) |
| `bank-simulator.html` | StorageBridge (matching transport) |
| `app.html` | Unchanged |

---

## Key Takeaways

1. **TWA ≠ native app.** Don't assume native Android capabilities (localhost networking, intent handling) work inside a TWA. They often don't.

2. **MWA is Chrome-only on the web side.** The Solana Mobile docs state this: *"Mobile Wallet Adapter library is built to support functionality on the Android Chrome browser."* TWA is not Chrome — it's a Chrome Custom Tab wrapper with different process isolation.

3. **Don't fight the platform.** We spent significant time building JavaScript workarounds (TWA detection, Chrome redirect buttons, state synchronization) that each made the UX worse. The right answer was to accept the constraint and design around it.

4. **PWABuilder TWAs are fine for simple apps.** If your PWA only uses standard web APIs (fetch, localStorage, service workers, push notifications), a TWA works great. The problem is specifically with protocols that rely on **localhost inter-process communication** like MWA.

5. **For the Seeker dApp Store**, the correct distribution path is likely the **PWA URL itself**, not a wrapped APK. The Seeker's dApp runtime is designed for web apps. The APK is a hackathon submission artifact, not the production distribution method.

---

## For Future Reference

If Solana Mobile adds a TWA-compatible MWA transport (e.g., Android Bound Service IPC instead of localhost WebSocket, or a content provider-based bridge), the TWA approach could work. Until then, AlpenSign's "zero backend, View Source" PWA architecture is both a design strength and the technically correct distribution method for the Seeker platform.
