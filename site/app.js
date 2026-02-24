// ============================================================
// AlpenSign v0.5.5 — Transaction Sealing for Banks
// Solana Seeker Hackathon · Q1 2026
//
// Zero dependencies. Zero build step. Zero backend.
// Intentional: auditability over convenience.
// A bank compliance officer can View Source and read every line.
//
// KEY CHANGE: Uses Solana Mobile Wallet Adapter (MWA) to sign
// and send transactions via the Seeker's real Seed Vault wallet.
// No more browser-generated keypairs or devnet airdrops.
// ============================================================

const RP_ID = window.location.hostname;

// ---- Solana Constants ----
const SOLANA_RPC = 'https://api.devnet.solana.com';
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const APP_IDENTITY = {
  name: 'AlpenSign',
  uri: window.location.origin,
  icon: './images/alpensign_logo_small_dark.png',
};

let solanaConnection = null;

// ============================================================
// MWA — Mobile Wallet Adapter (preloaded in HTML <script type="module">)
// ============================================================

let mwaTransact = null;
let mwaReady = false;
let mwaLoadError = null;

// Check if MWA was preloaded, or wait for it (up to 15s)
async function loadMWA() {
  // Already available?
  if (mwaTransact) return true;

  // Check global set by preload script
  if (window.__mwaTransact) {
    mwaTransact = window.__mwaTransact;
    mwaReady = true;
    console.log('[MWA] Using preloaded transact()');
    return true;
  }

  // Already failed?
  if (window.__mwaLoadError) {
    mwaLoadError = window.__mwaLoadError;
    return false;
  }

  // Wait for preload to complete (up to 15 seconds)
  console.log('[MWA] Waiting for preload...');
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.error('[MWA] Preload timeout (15s)');
      mwaLoadError = 'Preload timeout';
      resolve(false);
    }, 15000);

    window.addEventListener('mwa-ready', () => {
      clearTimeout(timeout);
      mwaTransact = window.__mwaTransact;
      mwaReady = true;
      console.log('[MWA] Preload completed');
      resolve(true);
    }, { once: true });

    window.addEventListener('mwa-failed', () => {
      clearTimeout(timeout);
      mwaLoadError = window.__mwaLoadError || 'Preload failed';
      console.error('[MWA] Preload failed');
      resolve(false);
    }, { once: true });

    // Double-check in case event fired before listener was registered
    if (window.__mwaTransact) {
      clearTimeout(timeout);
      mwaTransact = window.__mwaTransact;
      mwaReady = true;
      resolve(true);
    }
  });
}

// Timeout wrapper — prevents MWA transact() from hanging forever
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

// Authorize with Seed Vault and get wallet address
async function mwaAuthorize() {
  if (!mwaTransact) throw new Error('MWA not loaded');

  console.log('[MWA] Starting authorize...');
  const config = state.mwaWalletUriBase
    ? { baseUri: state.mwaWalletUriBase }
    : undefined;

  const result = await withTimeout(
    mwaTransact(async (wallet) => {
      console.log('[MWA] Session established, calling authorize...');
      const auth = await wallet.authorize({
        chain: 'solana:devnet',
        identity: APP_IDENTITY,
        auth_token: state.mwaAuthToken || undefined,
      });
      console.log('[MWA] Authorized. Accounts:', auth.accounts.length);
      return auth;
    }, config),
    60000,
    'MWA authorize'
  );

  // Decode base64 address → bytes → base58
  const addrBytes = Uint8Array.from(atob(result.accounts[0].address), c => c.charCodeAt(0));
  const walletBase58 = base58encode(addrBytes);

  state.mwaAuthToken = result.auth_token;
  if (result.wallet_uri_base) state.mwaWalletUriBase = result.wallet_uri_base;
  state.walletAddr = walletBase58;
  saveState();

  console.log('[MWA] ✅ Wallet:', walletBase58);
  return walletBase58;
}

// Sign and send a memo transaction via Seed Vault
async function mwaSignAndSend(memoPayload, walletBase58) {
  if (!mwaTransact) throw new Error('MWA not loaded');

  // 1. Build the unsigned transaction
  console.log('[MWA] Building memo TX...');
  const memoInstruction = new solanaWeb3.TransactionInstruction({
    keys: [],
    programId: new solanaWeb3.PublicKey(MEMO_PROGRAM_ID),
    data: new TextEncoder().encode(memoPayload),
  });

  const { blockhash, lastValidBlockHeight } =
    await solanaConnection.getLatestBlockhash('confirmed');

  const transaction = new solanaWeb3.Transaction({
    recentBlockhash: blockhash,
    feePayer: new solanaWeb3.PublicKey(walletBase58),
  }).add(memoInstruction);

  // 2. Serialize to base64 (unsigned)
  const serialized = transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
  const txBase64 = btoa(String.fromCharCode(...serialized));
  console.log('[MWA] TX serialized:', serialized.length, 'bytes');

  // 3. Send to Seed Vault via MWA (with 60s timeout)
  const config = state.mwaWalletUriBase
    ? { baseUri: state.mwaWalletUriBase }
    : undefined;

  const signatureBase64 = await withTimeout(
    mwaTransact(async (wallet) => {
      console.log('[MWA] Session established, reauthorizing...');
      const auth = await wallet.authorize({
        chain: 'solana:devnet',
        identity: APP_IDENTITY,
        auth_token: state.mwaAuthToken || undefined,
      });
      state.mwaAuthToken = auth.auth_token;
      if (auth.wallet_uri_base) state.mwaWalletUriBase = auth.wallet_uri_base;
      saveState();

      console.log('[MWA] Calling signAndSendTransactions...');
      const result = await wallet.signAndSendTransactions({
        payloads: [txBase64],
      });
      console.log('[MWA] signAndSendTransactions returned');
      return result[0];
    }, config),
    60000,
    'MWA signAndSend'
  );

  // 4. Decode signature to base58 for Explorer
  const sigBytes = (signatureBase64 instanceof Uint8Array)
    ? signatureBase64
    : Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));
  const txSignature = base58encode(sigBytes);

  console.log('[MWA] ✅ TX confirmed:', txSignature);
  return txSignature;
}

// ---- State ----
let state = {
  enrolled: false,
  credId: null,
  walletAddr: null,       // Real Seed Vault wallet address (base58)
  mwaAuthToken: null,     // MWA reauthorization token
  mwaWalletUriBase: null, // Custom wallet URI for faster reconnection
  genesisVerified: false, // True if SGT ownership confirmed on mainnet
  genesisTokenMint: null, // SGT mint address (real on-chain data)
  seals: [],
  currentRequest: null,
  deviceType: 'UNKNOWN',
  deviceModel: '',
  welcomeSeen: false,
};

// ---- Helpers ----
const $ = (id) => document.getElementById(id);
const bufferify = (str) => Uint8Array.from(atob(str), c => c.charCodeAt(0));
const base64ify = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const hexify = (buf) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');

// ---- Base58 Encoder (for TX signature display) ----
const B58_ALPHA = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58encode(bytes) {
  if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
  if (bytes.length === 0) return '';
  let zeros = 0;
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) zeros++;
  const digits = [0];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let r = '';
  for (let i = 0; i < zeros; i++) r += '1';
  for (let i = digits.length - 1; i >= 0; i--) r += B58_ALPHA[digits[i]];
  return r;
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
}

function isSeekerDevice() { return state.deviceType === 'SOLANA_SEEKER'; }

// ---- WebView Detection ----
// Wallet apps (Phantom, Solflare, etc.) embed a WebView that doesn't support WebAuthn.
// Detect this and tell the user to open in a real browser instead.
function isWalletWebView() {
  const ua = navigator.userAgent;
  // Phantom, Solflare, and other wallet in-app browsers
  if (/Phantom|Solflare/i.test(ua)) return true;
  // Generic Android WebView indicators
  // "wv" flag in Chrome UA string = WebView, also "WebView" in older builds
  if (/; wv\)/.test(ua)) return true;
  // In-app browser: has Android Chrome but NOT "Chrome/xxx" as standalone
  // (WebView often reports "Version/x.x Chrome/xxx" pattern)
  if (/Android/.test(ua) && /Version\/[\d.]+/.test(ua) && /Chrome\/[\d.]+/.test(ua)) return true;
  // Instagram, Twitter, Facebook, Telegram in-app browsers
  if (/FBAN|FBAV|Instagram|Twitter|Telegram/i.test(ua)) return true;
  return false;
}

// ---- Genesis Token (SGT) Verification ----
// Real on-chain check via beeman's open-source SGT indexer
// https://github.com/beeman/solana-mobile-seeker-genesis-holders
const SGT_API = 'https://sgt-api.beeman.dev/api/holders';

async function verifySGT(walletAddress) {
  try {
    console.log('[SGT] Verifying Genesis Token for:', walletAddress);
    const res = await fetch(`${SGT_API}/${walletAddress}`);
    if (res.status === 404) {
      console.log('[SGT] Wallet is not an SGT holder (404)');
      return null;
    }
    if (!res.ok) {
      console.warn('[SGT] API returned status:', res.status);
      return null;
    }
    const data = await res.json();
    const mint = data.mints?.[0]?.mint || null;
    if (mint) console.log('[SGT] ✅ Verified. Mint:', mint);
    return mint;
  } catch (e) {
    console.warn('[SGT] Verification failed (network?):', e.message);
    return null; // Fail open — allow enrollment with warning
  }
}

// ============================================================
// DEVICE DETECTION (Client Hints + UA fallback)
// ============================================================

async function detectDevice() {
  const ua = navigator.userAgent;
  const banner = $('deviceBanner');
  const icon = $('deviceIcon');
  const msg = $('deviceMessage');
  const modelEl = $('deviceModel');

  let deviceModel = 'Unknown Device';
  let seekerDetected = false;

  // ---- Strategy 1: Client Hints API (Chrome on Seeker) ----
  if (navigator.userAgentData) {
    try {
      // Check brands for SolanaMobile (works in Chrome, may be stripped in Brave)
      const isSolanaBrand = navigator.userAgentData.brands.some(b =>
        /solanamobile/i.test(b.brand)
      );
      const hints = await navigator.userAgentData.getHighEntropyValues(['model', 'platform', 'platformVersion']);
      deviceModel = hints.model || 'Unknown';
      seekerDetected = isSolanaBrand || /seeker|solana/i.test(deviceModel);
    } catch (e) {
      console.warn('Client Hints failed:', e);
    }
  }

  // ---- Strategy 2: User-Agent string (all browsers) ----
  if (!seekerDetected) {
    seekerDetected = /seeker|solanamobile|solana\s*mobile|saga/i.test(ua);
    const m = ua.match(/;\s*([^;)]+?)(?:(?:\s+Build\/)|(?:\s*Webkit)|(?:\s*[\);]))/i);
    if (m && deviceModel === 'Unknown Device') deviceModel = m[1].trim();
  }

  // ---- Strategy 3: Brave browser on Android — probe for Seed Vault ----
  // Brave strips device model from UA (always "K") and may strip Client Hints brands.
  // If we're on Android but haven't detected Seeker yet, check for MWA availability.
  // The presence of a working MWA transact() + Seed Vault wallet is definitive proof
  // of Seeker hardware, regardless of what the UA says.
  const isAndroid = /android/i.test(ua);
  const isBrave = !!(navigator.brave && typeof navigator.brave.isBrave === 'function');

  if (!seekerDetected && isAndroid) {
    // Quick check: is MWA already preloaded? (from the <script type="module"> in HTML)
    if (window.__mwaTransact) {
      // MWA is available — on a real non-Seeker Android, the solana-wallet:// Intent
      // would fail or no wallet would respond. If MWA loaded successfully and we're
      // on Android, this is very likely a Seeker. We'll confirm definitively when
      // the user connects their wallet.
      seekerDetected = true;
      deviceModel = isBrave ? 'Solana Seeker (Brave)' : (deviceModel === 'K' || deviceModel === 'Unknown' ? 'Solana Seeker' : deviceModel);
      console.log('[Device] Seeker detected via MWA availability' + (isBrave ? ' (Brave browser)' : ''));
    } else if (isBrave) {
      // Brave on Android but MWA not loaded yet — wait briefly for the preload
      console.log('[Device] Brave on Android detected, waiting for MWA preload...');
      const mwaAvailable = await new Promise((resolve) => {
        // Check if it loads within 3 seconds
        if (window.__mwaTransact) { resolve(true); return; }
        const t = setTimeout(() => resolve(false), 3000);
        window.addEventListener('mwa-ready', () => { clearTimeout(t); resolve(true); }, { once: true });
        window.addEventListener('mwa-failed', () => { clearTimeout(t); resolve(false); }, { once: true });
      });
      if (mwaAvailable) {
        seekerDetected = true;
        deviceModel = 'Solana Seeker (Brave)';
        console.log('[Device] Seeker confirmed via MWA in Brave');
      }
    }
  }

  // Check for wallet WebView first (overrides normal device detection message)
  const inWebView = isWalletWebView();

  if (seekerDetected) {
    state.deviceType = 'SOLANA_SEEKER';
    state.deviceModel = deviceModel || 'Solana Seeker';
    banner.className = 'device-banner show seeker';
    icon.textContent = '✅';
    msg.textContent = isBrave
      ? 'Solana Seeker detected (Brave) — Seed Vault available'
      : 'Solana Seeker detected — Seed Vault available';
    modelEl.textContent = state.deviceModel;
  } else if (inWebView) {
    state.deviceType = isAndroid ? 'GENERIC_ANDROID' : 'DESKTOP';
    state.deviceModel = deviceModel;
    banner.className = 'device-banner show warning';
    icon.textContent = '🚫';
    msg.innerHTML = '<b>Wallet browser detected</b> — please open in Chrome for full functionality';
    modelEl.textContent = deviceModel;
  } else if (isAndroid) {
    state.deviceType = 'GENERIC_ANDROID';
    state.deviceModel = deviceModel;
    banner.className = 'device-banner show warning';
    icon.textContent = '⚠️';
    msg.innerHTML = 'Non-Seeker device — signatures are <b>not</b> backed by Genesis Token';
    modelEl.textContent = deviceModel;
  } else if (/iphone|ipad/i.test(ua)) {
    state.deviceType = 'IOS';
    state.deviceModel = 'iPhone / iPad';
    banner.className = 'device-banner show warning';
    icon.textContent = '⚠️';
    msg.innerHTML = 'iOS device — no Seed Vault or MWA support';
    modelEl.textContent = 'Apple Secure Enclave';
  } else {
    state.deviceType = 'DESKTOP';
    state.deviceModel = 'Desktop Browser';
    banner.className = 'device-banner show desktop';
    icon.textContent = '🖥️';
    msg.textContent = 'Desktop browser — demo mode only';
    modelEl.textContent = navigator.platform || 'Unknown';
  }

  return state.deviceType;
}

// Auto-dismiss device banner after 5 seconds — ONLY for Seeker (positive confirmation)
// Non-Seeker banners persist so users understand the device limitation
function autoDismissBanner() {
  const banner = $('deviceBanner');
  if (banner && banner.classList.contains('show') && isSeekerDevice()) {
    setTimeout(() => {
      banner.style.transition = 'opacity 0.5s ease';
      banner.style.opacity = '0';
      setTimeout(() => {
        banner.classList.remove('show');
        banner.style.opacity = '';
        banner.style.transition = '';
      }, 500);
    }, 5000);
  }
}


// ============================================================
// SOLANA RPC (read-only, for balance/confirmation checks)
// ============================================================

function initSolanaRPC() {
  try {
    if (typeof solanaWeb3 === 'undefined') {
      console.warn('solanaWeb3 not loaded');
      return false;
    }
    solanaConnection = new solanaWeb3.Connection(SOLANA_RPC, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 30000,
    });
    return true;
  } catch (e) {
    console.error('Solana RPC init failed:', e);
    return false;
  }
}

async function getWalletBalance(walletBase58) {
  if (!solanaConnection || !walletBase58) return -1;
  try {
    const pubkey = new solanaWeb3.PublicKey(walletBase58);
    const balance = await solanaConnection.getBalance(pubkey);
    return balance / solanaWeb3.LAMPORTS_PER_SOL;
  } catch (e) {
    console.warn('Balance check failed:', e);
    return -1;
  }
}

/*
// OLD function from Claude Opus 4.6:
// Compact memo payload (<300 bytes, well under 566 limit)
function buildMemoPayload(payment, txHash, deviceSignature) {
  const payload = {
    v: 1,
    t: 'ALPENSIGN_SEAL',
    h: txHash,
    sig: deviceSignature.substring(0, 44),
    d: state.deviceType,
    r: payment.recipient.substring(0, 40),
    loc: `${payment.town}, ${payment.country}`,
    amt: payment.amount,
    ts: Math.floor(Date.now() / 1000),
  };
  const json = JSON.stringify(payload);
  console.log(`Memo payload: ${json.length} bytes`);
  return json;
}
*/

// From Gemini Pro (because Claude weekly limitations)
// Compact memo payload — Privacy preserved (Hash only)
function buildMemoPayload(payment, txHash, deviceSignature) {
  const payload = {
    v: 1,
    t: 'ALPENSIGN_SEAL',
    h: txHash,                         // SHA-256 hash of payment details (Anchor)
    sig: deviceSignature.substring(0, 44),
    d: state.deviceType,
    // REMOVED: Plaintext fields (r, loc, amt) to ensure privacy
    ts: Math.floor(Date.now() / 1000), // Approximate timestamp for indexing
  };
  const json = JSON.stringify(payload);
  console.log(`Memo payload: ${json.length} bytes`);
  return json;
}

// ============================================================
// PERSISTENCE
// ============================================================

function saveState() {
  localStorage.setItem('alpensign_state', JSON.stringify({
    enrolled: state.enrolled,
    credId: state.credId,
    walletAddr: state.walletAddr,
    mwaAuthToken: state.mwaAuthToken,
    mwaWalletUriBase: state.mwaWalletUriBase,
    genesisVerified: state.genesisVerified,
    genesisTokenMint: state.genesisTokenMint,
    seals: state.seals,
    welcomeSeen: state.welcomeSeen,
  }));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem('alpensign_state'));
    if (saved) {
      state.enrolled = saved.enrolled || false;
      state.credId = saved.credId || null;
      state.walletAddr = saved.walletAddr || null;
      state.mwaAuthToken = saved.mwaAuthToken || null;
      state.mwaWalletUriBase = saved.mwaWalletUriBase || null;
      state.genesisVerified = saved.genesisVerified || false;
      state.genesisTokenMint = saved.genesisTokenMint || null;
      state.seals = saved.seals || [];
      state.welcomeSeen = saved.welcomeSeen || false;
    }
  } catch (e) {
    console.warn('State load failed', e);
  }
}

// ============================================================
// NAVIGATION
// ============================================================

function navigateTo(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const view = $(`view-${viewName}`);
  if (view) view.classList.add('active');

  // About page keeps Settings highlighted in nav
  const navTarget = viewName === 'about' ? 'settings' : viewName;
  const navItem = document.querySelector(`.nav-item[data-view="${navTarget}"]`);
  if (navItem) navItem.classList.add('active');

  if (viewName === 'home') updateHomeView();
  if (viewName === 'history') updateHistoryView();
  if (viewName === 'settings') updateSettingsView();
}

function updateHeaderBadge() {
  const badge = $('headerBadge');
  if (state.enrolled) {
    badge.textContent = 'Enrolled';
    badge.className = 'status-badge badge-enrolled';
  } else if (state.credId) {
    badge.textContent = 'Pending';
    badge.className = 'status-badge badge-pending';
  } else {
    badge.textContent = 'Not Enrolled';
    badge.className = 'status-badge badge-not-enrolled';
  }
}

// ============================================================
// HOME VIEW
// ============================================================

async function updateHomeView() {
  const addr = state.walletAddr;
  $('homeWallet').textContent = addr
    ? addr.slice(0, 8) + '...' + addr.slice(-6)
    : '—';
  $('homeSealCount').textContent = state.seals.length;

  const wtEl = $('homeWalletType');
  if (isSeekerDevice() && addr) {
    wtEl.textContent = 'Seed Vault (Devnet)';
    wtEl.style.color = 'var(--accent-light)';
  } else if (addr) {
    wtEl.textContent = 'Local only';
    wtEl.style.color = 'var(--amber)';
  } else {
    wtEl.textContent = '—';
    wtEl.style.color = 'var(--text-dim)';
  }

  const container = $('homeRecentSeals');
  if (state.seals.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">No seals yet</div></div>';
  } else {
    container.innerHTML = state.seals.slice(-3).reverse().map(s => sealItemHTML(s, false)).join('');
  }
}

function sealItemHTML(s, expanded) {
  const clickable = s.solanaTxReal && s.solanaTx;
  const explorerUrl = clickable ? `https://explorer.solana.com/tx/${s.solanaTx}?cluster=devnet` : '';
  const hashShort = s.hash ? s.hash.substring(0, 10) + '…' + s.hash.slice(-6) : '—';
  const txShort = s.solanaTx ? s.solanaTx.substring(0, 10) + '…' + s.solanaTx.slice(-4) : '—';
  const ts = formatTime(s.timestamp);
  const tsLong = new Date(s.timestamp).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (!expanded) {
    // Compact view for Home (unchanged layout + clickable)
    return `
    <div class="history-item" ${clickable ? `onclick="window.open('${explorerUrl}','_blank')" style="cursor:pointer;"` : ''}>
      <div class="history-icon">${s.solanaTxReal ? '✅' : '🔏'}</div>
      <div class="history-details">
        <div class="history-recipient">${s.recipient}</div>
        <div class="history-time">${ts}</div>
      </div>
      <div>
        <div class="history-amount">${s.amount}</div>
        <div class="history-status">${s.solanaTxReal ? 'On-chain ✓' : 'Local proof'}</div>
      </div>
    </div>`;
  }

  // Expanded view for History page
  return `
    <div class="history-item-expanded">
      <div class="history-item-header">
        <div class="history-icon">${s.solanaTxReal ? '✅' : '🔏'}</div>
        <div class="history-details">
          <div class="history-recipient">${s.recipient}</div>
          <div class="history-meta">${s.town || ''}${s.country ? ', ' + s.country : ''}</div>
        </div>
        <div>
          <div class="history-amount">${s.amount}</div>
          <div class="history-status">${s.solanaTxReal ? 'On-chain ✓' : 'Local proof'}</div>
        </div>
      </div>
      <div class="history-detail-rows">
        <div class="history-detail-row">
          <span class="history-detail-label">Time</span>
          <span class="history-detail-value">${tsLong}</span>
        </div>
        <div class="history-detail-row">
          <span class="history-detail-label">IBAN</span>
          <span class="history-detail-value font-mono">${s.iban || '—'}</span>
        </div>
        <div class="history-detail-row">
          <span class="history-detail-label">Reference</span>
          <span class="history-detail-value font-mono">${s.ref || '—'}</span>
        </div>
        <div class="history-detail-row">
          <span class="history-detail-label">Payment Hash</span>
          <span class="history-detail-value font-mono" title="${s.hash || ''}">${hashShort}</span>
        </div>
        <div class="history-detail-row">
          <span class="history-detail-label">Solana TX</span>
          ${clickable
            ? `<a class="history-detail-value font-mono history-link" href="${explorerUrl}" target="_blank">${txShort} ↗</a>`
            : `<span class="history-detail-value font-mono text-dim">${s.solanaTx ? txShort : '— (local only)'}</span>`
          }
        </div>
        <div class="history-detail-row">
          <span class="history-detail-label">Device</span>
          <span class="history-detail-value">${s.deviceType === 'SOLANA_SEEKER' ? 'Seeker · Seed Vault' : s.deviceType || '—'}</span>
        </div>
      </div>
    </div>`;
}

// ============================================================
// HISTORY VIEW
// ============================================================

function updateHistoryView() {
  const container = $('historyList');
  const count = state.seals.length;
  $('historyCount').textContent = count ? `${count} seal${count > 1 ? 's' : ''}` : '';

  if (count === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">No seals recorded</div></div>';
    return;
  }
  container.innerHTML = state.seals.slice().reverse().map(s => sealItemHTML(s, true)).join('');
}

// ============================================================
// SETTINGS VIEW
// ============================================================

async function updateSettingsView() {
  $('settingsUA').textContent = navigator.userAgent.substring(0, 60) + '...';
  $('settingsCredId').textContent = state.credId ? state.credId.substring(0, 24) + '...' : '—';
  $('settingsDevice').textContent = `${state.deviceType} (${state.deviceModel})`;
  $('settingsDevice').style.color = isSeekerDevice() ? 'var(--accent-light)' : 'var(--amber)';

  // Wallet info
  const badge = $('settingsWalletBadge');
  const source = $('settingsWalletSource');
  const addr = $('settingsSolAddr');
  const reconnectBtn = $('btnReconnectWallet');

  if (state.walletAddr && isSeekerDevice()) {
    badge.textContent = 'Connected';
    badge.className = 'status-badge badge-enrolled';
    source.textContent = 'Seed Vault (MWA)';
    source.style.color = 'var(--accent-light)';
    addr.textContent = state.walletAddr.substring(0, 12) + '...' + state.walletAddr.slice(-6);
    reconnectBtn.classList.remove('hidden');
  } else if (state.walletAddr) {
    badge.textContent = 'Local';
    badge.className = 'status-badge badge-pending';
    source.textContent = 'Platform Key (no Solana)';
    source.style.color = 'var(--amber)';
    addr.textContent = '— (no on-chain wallet)';
    reconnectBtn.classList.add('hidden');
  } else {
    badge.textContent = 'Not Connected';
    badge.className = 'status-badge badge-not-enrolled';
    source.textContent = '—';
    addr.textContent = '—';
    reconnectBtn.classList.add('hidden');
  }

  // Genesis Token status
  const sgtEl = $('settingsGenesis');
  if (state.genesisVerified && state.genesisTokenMint) {
    const short = state.genesisTokenMint.substring(0, 8) + '...' + state.genesisTokenMint.slice(-4);
    sgtEl.textContent = `Verified ✓ ${short}`;
    sgtEl.style.color = 'var(--purple)';
  } else if (state.walletAddr && isSeekerDevice()) {
    sgtEl.textContent = 'Not found ⚠';
    sgtEl.style.color = 'var(--amber)';
  } else {
    sgtEl.textContent = '—';
    sgtEl.style.color = '';
  }

  // MWA diagnostic status
  const mwaEl = $('settingsMWAStatus');
  if (mwaReady) {
    mwaEl.textContent = 'Loaded ✓';
    mwaEl.style.color = 'var(--accent-light)';
  } else if (mwaLoadError) {
    mwaEl.textContent = 'Error: ' + mwaLoadError;
    mwaEl.style.color = 'var(--red)';
  } else if (window.__mwaTransact) {
    mwaEl.textContent = 'Preloaded ✓';
    mwaEl.style.color = 'var(--accent-light)';
  } else if (window.__mwaLoadError) {
    mwaEl.textContent = 'Preload error: ' + window.__mwaLoadError;
    mwaEl.style.color = 'var(--red)';
  } else {
    mwaEl.textContent = 'Loading...';
    mwaEl.style.color = 'var(--amber)';
  }
}

// ============================================================
// DEVICE-ADAPTIVE UI
// ============================================================

function adaptSealStepsForDevice() {
  if (isSeekerDevice()) {
    $('step-auth-sub').textContent = 'Seed Vault signing';
    $('step-sign-text').textContent = 'Sign with Seed Vault';
    $('step-sign-sub').textContent = state.genesisVerified
      ? 'ECDSA-SHA256 (P-256) · Hardware-bound · SGT ✓'
      : 'ECDSA-SHA256 (P-256) · Hardware-bound';
    $('step-post-text').textContent = 'Post Seal to Solana';
    $('step-post-sub').textContent = 'Memo via MWA → Seed Vault → Devnet';
    $('step-confirm-text').textContent = 'Seal Confirmed';
    $('step-confirm-sub').textContent = 'Immutable on-chain record';
  } else {
    $('step-auth-sub').textContent = 'WebAuthn platform authenticator';
    $('step-sign-text').textContent = 'Sign with Platform Key';
    $('step-sign-sub').textContent = 'ECDSA-SHA256 (P-256) · No Genesis Token';
    $('step-post-text').textContent = 'Record Proof Locally';
    $('step-post-sub').textContent = 'No on-chain posting without Seeker';
    $('step-confirm-text').textContent = 'Seal Complete';
    $('step-confirm-sub').textContent = 'Local cryptographic proof (not on-chain)';
  }
}

function adaptEnrollmentForDevice() {
  const device = $('enrollDevice');
  const cred = $('enrollCredential');
  const tokenLabel = $('enrollTokenLabel');
  const tokenValue = $('enrollTokenValue');

  if (isSeekerDevice()) {
    device.textContent = 'Solana Seeker';
    device.style.color = 'var(--accent-light)';
    cred.textContent = 'Hardware-Attested (Seed Vault)';
    cred.style.color = 'var(--accent-light)';
    tokenLabel.textContent = 'Genesis Token';
    if (state.genesisVerified && state.genesisTokenMint) {
      const short = state.genesisTokenMint.substring(0, 8) + '...' + state.genesisTokenMint.slice(-4);
      tokenValue.textContent = `Verified ✓ ${short}`;
      tokenValue.style.color = 'var(--purple)';
    } else {
      tokenValue.textContent = 'Not verified ⚠';
      tokenValue.style.color = 'var(--amber)';
    }
  } else {
    device.textContent = state.deviceModel || 'Android Device';
    device.style.color = 'var(--amber)';
    cred.textContent = 'Platform-Attested (WebAuthn)';
    cred.style.color = 'var(--amber)';
    tokenLabel.textContent = 'Trust Level';
    tokenValue.textContent = 'Limited — no Genesis Token';
    tokenValue.style.color = 'var(--amber)';
  }
}

// Adapt enrollment step 2 for device type
function adaptEnrollStep2() {
  if (isSeekerDevice()) {
    $('enroll2Icon').textContent = '🔗';
    $('enroll2Title').textContent = 'Connect Seed Vault Wallet';
    $('enroll2Desc').textContent = 'Authorize AlpenSign to use your Seeker\'s Seed Vault wallet for signing Solana transactions.';
    $('btnConnectWallet').classList.remove('hidden');
    // Button content kept as original HTML (has SVG icon)
  } else {
    $('enroll2Icon').textContent = '🔒';
    $('enroll2Title').textContent = 'Platform Key Created';
    $('enroll2Desc').textContent = 'Your device\'s WebAuthn key is ready. On-chain sealing requires a Solana Seeker with Seed Vault.';
    $('btnConnectWallet').classList.add('hidden');
    $('btnSimulateBank').classList.remove('hidden');
    $('bankPairingSection').classList.remove('hidden');
    $('enrollStatus2').textContent = 'On-chain posting not available without Seeker.';
  }
}

// ============================================================
// WELCOME SCREEN
// ============================================================

$('btnGetStarted').addEventListener('click', () => {
  state.welcomeSeen = true;
  saveState();
  $('view-welcome').classList.remove('active');
  $('view-enroll').classList.add('active');
});

// ============================================================
// ENROLLMENT FLOW
// ============================================================

// Step 1: Create WebAuthn credential
$('btnInitVault').addEventListener('click', async () => {
  const statusEl = $('enrollStatus1');
  const btn = $('btnInitVault');

  // Block wallet WebViews — they don't support WebAuthn
  if (isWalletWebView()) {
    statusEl.innerHTML = '<span style="color: var(--red);">⚠ Wallet browser detected</span><br>'
      + '<span style="color: var(--text-secondary); font-size: 0.82rem;">'
      + 'This app requires features not available in wallet browsers.<br>'
      + 'Please open <b>alpensign.com/app.html</b> directly in <b>Chrome</b>.</span>';
    btn.disabled = true;
    return;
  }

  btn.disabled = true;
  statusEl.textContent = isSeekerDevice()
    ? 'Requesting Seeker attestation...'
    : 'Requesting platform attestation...';

  const challenge = window.crypto.getRandomValues(new Uint8Array(32));
  const userID = window.crypto.getRandomValues(new Uint8Array(16));

  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "AlpenSign", id: RP_ID },
        user: { id: userID, name: "seeker-user", displayName: "Seeker Holder" },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required"
        },
        attestation: "direct"
      }
    });

    state.credId = base64ify(cred.rawId);
    saveState();
    statusEl.innerHTML = '<span style="color: var(--accent-light);">✓ Key pair created</span>';

    setTimeout(() => {
      $('enroll-1').classList.remove('active');
      $('enroll-2').classList.add('active');
      adaptEnrollStep2();
      updateHeaderBadge();
    }, 800);

  } catch (err) {
    if (err.name === 'NotSupportedError') {
      statusEl.innerHTML = '<span style="color: var(--red);">⚠ WebAuthn not supported</span><br>'
        + '<span style="color: var(--text-secondary); font-size: 0.82rem;">'
        + 'This browser doesn\'t support the required security features.<br>'
        + 'Please open <b>alpensign.com/app.html</b> directly in <b>Chrome</b>.</span>';
    } else {
      statusEl.textContent = 'Error: ' + err.name;
    }
    btn.disabled = false;
    console.error('Enrollment error:', err);
  }
});

// Step 2: Connect Seed Vault wallet (Seeker only)
// CRITICAL: Chrome blocks custom URI scheme navigation (`solana-wallet://`)
// unless it happens synchronously within a user gesture. We must call
// transact() IMMEDIATELY — zero awaits before it. This preserves the
// "user activation" that Chrome requires for Intent dispatch.
$('btnConnectWallet').addEventListener('click', () => {  // NOT async!
  const btn = $('btnConnectWallet');
  const statusEl = $('enrollStatus2');
  btn.disabled = true;
  statusEl.style.color = '';

  // Synchronous check — MWA must already be preloaded from HTML <script>
  const transactFn = window.__mwaTransact || mwaTransact;
  if (!transactFn) {
    statusEl.textContent = '❌ MWA not loaded yet. Wait a moment and try again.';
    statusEl.style.color = 'var(--red)';
    btn.disabled = false;
    return;
  }

  statusEl.textContent = 'Opening Seed Vault — approve in wallet popup...';

  // Fire transact() IMMEDIATELY from the click handler — no await before this line!
  // This ensures Chrome treats the Intent navigation as a user gesture.
  transactFn(async (wallet) => {
    console.log('[MWA] Session established, calling authorize...');
    const auth = await wallet.authorize({
      chain: 'solana:devnet',
      identity: APP_IDENTITY,
      auth_token: state.mwaAuthToken || undefined,
    });
    console.log('[MWA] Authorized. Accounts:', auth.accounts.length);
    return auth;
  })
  .then(async (result) => {
    // Decode base64 address → bytes → base58
    const addrBytes = Uint8Array.from(atob(result.accounts[0].address), c => c.charCodeAt(0));
    const walletBase58 = base58encode(addrBytes);

    state.mwaAuthToken = result.auth_token;
    if (result.wallet_uri_base) state.mwaWalletUriBase = result.wallet_uri_base;
    state.walletAddr = walletBase58;
    saveState();

    $('walletDisplay').classList.remove('hidden');
    $('walletAddr').textContent = walletBase58;
    statusEl.innerHTML = `<span style="color: var(--accent-light);">✓ Wallet connected: ${walletBase58.substring(0, 8)}...${walletBase58.slice(-4)}</span>`;
    console.log('[MWA] ✅ Wallet:', walletBase58);

    // ---- Real Genesis Token verification (mainnet) ----
    statusEl.innerHTML += '<br><span style="color: var(--text-dim);">Verifying Genesis Token on mainnet...</span>';
    const sgtMint = await verifySGT(walletBase58);
    if (sgtMint) {
      state.genesisVerified = true;
      state.genesisTokenMint = sgtMint;
      const shortMint = sgtMint.substring(0, 6) + '...' + sgtMint.slice(-4);
      statusEl.innerHTML = `<span style="color: var(--accent-light);">✓ Wallet connected</span>`
        + `<br><span style="color: var(--purple);">✓ Genesis Token verified (${shortMint})</span>`;
    } else {
      state.genesisVerified = false;
      state.genesisTokenMint = null;
      statusEl.innerHTML = `<span style="color: var(--accent-light);">✓ Wallet connected</span>`
        + `<br><span style="color: var(--amber);">⚠ Genesis Token not found</span>`;
    }
    saveState();

    $('btnSimulateBank').classList.remove('hidden');
    $('bankPairingSection').classList.remove('hidden');
  })
  .catch((err) => {
    console.error('[MWA] Authorize failed:', err);
    const msg = err.message || String(err);
    if (msg.includes('WALLET_NOT_FOUND') || msg.includes('not found')) {
      statusEl.textContent = '❌ No MWA wallet found. Check Seed Vault is enabled.';
    } else if (msg.includes('USER_DECLINED') || msg.includes('declined')) {
      statusEl.textContent = '❌ Authorization was declined in the wallet.';
    } else {
      statusEl.textContent = '❌ Connection failed: ' + msg;
    }
    statusEl.style.color = 'var(--red)';
    btn.disabled = false;
  });
});

// Step 2b: Bank confirms enrollment (simulated)
$('btnSimulateBank').addEventListener('click', () => {
  const btn = $('btnSimulateBank');
  const statusEl = $('enrollStatus2');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Bank verifying...';
  statusEl.textContent = isSeekerDevice()
    ? (state.genesisVerified ? 'Genesis Token verified ✓ — issuing credential...' : 'No Genesis Token found — issuing credential with reduced trust...')
    : 'Verifying device attestation...';

  setTimeout(() => {
    statusEl.innerHTML = isSeekerDevice()
      ? '<span style="color: var(--accent-light);">✓ SAS Credential issued</span>'
      : '<span style="color: var(--amber);">✓ Platform credential registered</span>';
    setTimeout(() => {
      if (isSeekerDevice()) {
        statusEl.innerHTML += '<br><span style="color: var(--purple);">✓ Client NFT minted (soulbound)</span>';
      }
      setTimeout(() => {
        state.enrolled = true;
        saveState();
        adaptEnrollmentForDevice();
        $('enroll-2').classList.remove('active');
        $('enroll-3').classList.add('active');
        updateHeaderBadge();
      }, 800);
    }, 1000);
  }, 1500);
});

$('btnEnrollDone').addEventListener('click', () => {
  navigateTo('home');
});

// ============================================================
// TRANSACTION SEALING FLOW
// ============================================================

const samplePayments = [
  { recipient: 'ABC GmbH', town: 'Zürich', country: 'CH', amount: 'CHF 10,500.00', iban: 'CH78 7838 3838 3823', ref: 'INV-2026-0042' },
  { recipient: 'Müller Maschinenbau AG', town: 'Basel', country: 'CH', amount: 'CHF 3,280.50', iban: 'CH93 0076 2011 6238 5295 7', ref: 'PO-2026-1187' },
  { recipient: 'Swiss Re Ltd', town: 'Zürich', country: 'CH', amount: 'CHF 47,000.00', iban: 'CH56 0483 5012 3456 7800 9', ref: 'PREM-Q1-2026' },
  { recipient: 'Café Sprüngli AG', town: 'Zürich', country: 'CH', amount: 'CHF 156.80', iban: 'CH12 0900 0000 1500 1234 5', ref: 'CATER-FEB-26' },
  { recipient: 'Universitätsspital ZH', town: 'Zürich', country: 'CH', amount: 'CHF 892.00', iban: 'CH62 0070 0110 0006 1425 8', ref: 'PAT-20260213' },
  { recipient: 'Boulangerie du Pont SA', town: 'Genève', country: 'CH', amount: 'CHF 234.00', iban: 'CH44 0026 0026 0100 0001 1', ref: 'CMD-2026-088' },
  { recipient: 'Schmidt & Partner GmbH', town: 'München', country: 'DE', amount: 'EUR 8,750.00', iban: 'DE89 3704 0044 0532 0130 00', ref: 'CONSUL-FEB26' },
];

$('btnSimulateRequest').addEventListener('click', () => {
  const payment = samplePayments[Math.floor(Math.random() * samplePayments.length)];
  state.currentRequest = payment;
  $('notifBody').textContent = `${payment.amount} to ${payment.recipient}`;
  $('notification').classList.add('show');
});

function openSealRequest() {
  $('notification').classList.remove('show');
  if (!state.currentRequest) return;
  const p = state.currentRequest;

  $('sealRecipient').textContent = p.recipient;
  $('sealLocation').textContent = `${p.town}, ${p.country}`;
  $('sealAmount').textContent = p.amount;
  $('sealIban').textContent = p.iban;
  $('sealReference').textContent = p.ref;

  // Reset
  $('btnSeal').classList.remove('hidden');
  $('btnSeal').disabled = false;
  $('btnSeal').innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 11c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2z"/><path d="M18.5 8A6.5 6.5 0 0 0 12 1.5 6.5 6.5 0 0 0 5.5 8v2H4v10h16V10h-1.5V8z"/></svg> Seal with Biometric';
  $('sealProgress').classList.add('hidden');
  $('sealResult').classList.add('hidden');
  $('sealBadge').textContent = 'Pending';
  $('sealBadge').className = 'status-badge badge-pending';
  $('sealPaymentCard').style.display = '';

  document.querySelectorAll('.seal-step').forEach(s => s.classList.remove('active', 'done'));
  adaptSealStepsForDevice();

  navigateTo('seal');
}
window.openSealRequest = openSealRequest;

// ---- SEAL EXECUTION ----
$('btnSeal').addEventListener('click', async () => {
  if (!state.credId) return;
  const btn = $('btnSeal');
  btn.disabled = true;

  $('sealProgress').classList.remove('hidden');
  const steps = ['step-auth', 'step-hash', 'step-sign', 'step-post', 'step-confirm'];

  async function activateStep(index) {
    return new Promise(resolve => {
      if (index > 0) $(steps[index - 1]).classList.remove('active');
      if (index > 0) $(steps[index - 1]).classList.add('done');
      $(steps[index]).classList.add('active');
      setTimeout(resolve, index === 0 ? 100 : 600);
    });
  }

  try {
    // Step 1: Biometric auth + WebAuthn signature
    await activateStep(0);

    const p = state.currentRequest;
    const txData = [
      p.amount, p.recipient, p.town, p.country,
      p.iban, p.ref, Date.now().toString()
    ].join('|');
    const challengeBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txData));
    const txHash = hexify(challengeBuffer);

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: new Uint8Array(challengeBuffer),
        rpId: RP_ID,
        allowCredentials: [{ id: bufferify(state.credId), type: 'public-key' }],
        userVerification: "required"
      }
    });
    const signature = base64ify(assertion.response.signature);

    // Step 2: Hash
    await activateStep(1);

    // Step 3: Sign
    await activateStep(2);

    // Step 4: Post to Solana (Seeker) or record locally (other)
    await activateStep(3);

    let solanaTxId = null;
    let onChain = false;
    let failReason = '';

    if (isSeekerDevice() && state.walletAddr) {
      // Build the memo TX payload and serialize BEFORE opening wallet session
      // (RPC calls shouldn't happen while Chrome is backgrounded by MWA)
      const memoPayload = buildMemoPayload(p, txHash, signature);

      $('step-post-sub').textContent = 'Preparing transaction...';
      let txBase64;
      try {
        const memoIx = new solanaWeb3.TransactionInstruction({
          keys: [],
          programId: new solanaWeb3.PublicKey(MEMO_PROGRAM_ID),
          data: new TextEncoder().encode(memoPayload),
        });

        const { blockhash } = await solanaConnection.getLatestBlockhash('confirmed');
        console.log('[Seal] Blockhash:', blockhash);

        const tx = new solanaWeb3.Transaction({
          recentBlockhash: blockhash,
          feePayer: new solanaWeb3.PublicKey(state.walletAddr),
        }).add(memoIx);

        const serialized = tx.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        });
        txBase64 = btoa(String.fromCharCode(...serialized));
        console.log('[Seal] TX serialized:', serialized.length, 'bytes');
      } catch (buildErr) {
        failReason = 'TX build failed: ' + (buildErr.message || buildErr);
        console.error('[Seal]', failReason);
      }

      if (txBase64 && !failReason) {
        // CHROME GESTURE REQUIREMENT: fresh user tap for MWA Intent
        const step4El = $('step-post');
        $('step-post-sub').textContent = '👆 Tap here to open Seed Vault';
        step4El.style.cursor = 'pointer';
        step4El.classList.add('awaiting-tap');

        solanaTxId = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            step4El.removeEventListener('click', handler);
            step4El.style.cursor = '';
            step4El.classList.remove('awaiting-tap');
            reject(new Error('Timed out waiting for tap (30s)'));
          }, 30000);

          function handler() {
            step4El.removeEventListener('click', handler);
            step4El.style.cursor = '';
            step4El.classList.remove('awaiting-tap');
            clearTimeout(timeout);

            $('step-post-sub').textContent = 'Signing with Seed Vault...';
            $('sealBadge').textContent = 'Posting...';

            const transactFn = window.__mwaTransact || mwaTransact;
            if (!transactFn) {
              reject(new Error('MWA not loaded'));
              return;
            }

            // transact() fires IMMEDIATELY from click — no async before this
            transactFn(async (wallet) => {
              console.log('[MWA] Seal session established, authorizing...');
              const auth = await wallet.authorize({
                chain: 'solana:devnet',
                identity: APP_IDENTITY,
                auth_token: state.mwaAuthToken || undefined,
              });
              state.mwaAuthToken = auth.auth_token;
              if (auth.wallet_uri_base) state.mwaWalletUriBase = auth.wallet_uri_base;
              saveState();
              console.log('[MWA] Authorized, sending pre-built TX...');

              const result = await wallet.signAndSendTransactions({
                payloads: [txBase64],
              });
              console.log('[MWA] signAndSendTransactions returned:', typeof result, result);
              return result;
            })
            .then((result) => {
              // MWA can return signatures in multiple formats:
              // - { signatures: [Uint8Array] }
              // - [Uint8Array]
              // - Uint8Array (single)
              // - base64 string
              // - { signatures: [base64string] }
              let sigRaw;
              if (result && result.signatures) {
                sigRaw = result.signatures[0];
              } else if (Array.isArray(result)) {
                sigRaw = result[0];
              } else {
                sigRaw = result;
              }

              console.log('[MWA] Signature raw type:', typeof sigRaw,
                sigRaw instanceof Uint8Array ? '(Uint8Array)' : '',
                ArrayBuffer.isView(sigRaw) ? '(TypedArray)' : '',
                typeof sigRaw === 'string' ? `len=${sigRaw.length}` : '');

              let sigBytes;
              if (sigRaw instanceof Uint8Array) {
                sigBytes = sigRaw;
              } else if (ArrayBuffer.isView(sigRaw) || sigRaw instanceof ArrayBuffer) {
                sigBytes = new Uint8Array(sigRaw.buffer || sigRaw);
              } else if (typeof sigRaw === 'string') {
                // Could be base64 or base58 — try base64 first
                try {
                  sigBytes = Uint8Array.from(atob(sigRaw), c => c.charCodeAt(0));
                } catch (e) {
                  // Already base58? Return as-is
                  console.log('[MWA] Signature appears to be base58 already:', sigRaw.substring(0, 20));
                  resolve(sigRaw);
                  return;
                }
              } else {
                throw new Error('Unknown signature format: ' + typeof sigRaw + ' = ' + JSON.stringify(sigRaw).substring(0, 100));
              }

              console.log('[MWA] Signature bytes length:', sigBytes.length);
              const txSig = base58encode(sigBytes);
              console.log('[MWA] ✅ TX confirmed:', txSig);
              resolve(txSig);
            })
            .catch((e) => {
              console.error('[MWA] signAndSend failed:', e);
              reject(e);
            });
          }

          step4El.addEventListener('click', handler);
        }).then((txId) => {
          onChain = true;
          console.log('✅ On-chain TX:', txId);
          return txId;
        }).catch((solanaErr) => {
          failReason = solanaErr.message || String(solanaErr);
          console.warn('Solana posting failed:', failReason);
          return null;
        });
      }

    } else if (!isSeekerDevice()) {
      $('sealBadge').textContent = 'Recording...';
      failReason = 'NON_SEEKER';
      await new Promise(r => setTimeout(r, 800));
    } else {
      failReason = 'Wallet not connected';
      await new Promise(r => setTimeout(r, 800));
    }

    // Step 5: Confirmed
    await activateStep(4);
    $(steps[3]).classList.remove('active');
    $(steps[3]).classList.add('done');

    // Show fail reason on step 4 for diagnostics
    if (failReason && failReason !== 'NON_SEEKER') {
      $('step-post-sub').textContent = '❌ ' + failReason;
      $('step-post-sub').style.color = 'var(--red)';
    }

    if (onChain) {
      $('sealBadge').textContent = 'Sealed ✓';
    } else if (!isSeekerDevice()) {
      $('sealBadge').textContent = 'Local ✓';
    } else {
      $('sealBadge').textContent = 'Sealed (local)';
    }
    $('sealBadge').className = 'status-badge badge-enrolled';

    // Save seal
    const seal = {
      recipient: p.recipient,
      town: p.town,
      country: p.country,
      amount: p.amount,
      iban: p.iban,
      ref: p.ref,
      hash: txHash,
      signature: signature.substring(0, 64) + '...',
      solanaTx: solanaTxId,
      solanaTxReal: onChain,
      deviceType: state.deviceType,
      timestamp: Date.now(),
    };

    state.seals.push(seal);
    state._lastTxId = solanaTxId;
    state._lastTxReal = onChain;
    saveState();

    // Notify bank simulator via BroadcastChannel
    notifyBankSealComplete(seal);

    // Show result
    await new Promise(r => setTimeout(r, 600));
    btn.classList.add('hidden');
    $('sealProgress').classList.add('hidden');

    $('resultHash').textContent = txHash;
    $('resultSig').textContent = signature.substring(0, 80) + '...';
    $('resultDeviceType').textContent = state.deviceType;
    $('resultChannel').textContent = isSeekerDevice()
      ? 'INDEPENDENT_DEVICE (Seed Vault)'
      : 'INDEPENDENT_DEVICE (WebAuthn)';
    // Genesis Token status (real on-chain check)
    const sgtEl = $('resultGenesis');
    if (state.genesisVerified && state.genesisTokenMint) {
      const short = state.genesisTokenMint.substring(0, 8) + '...' + state.genesisTokenMint.slice(-4);
      sgtEl.textContent = `VERIFIED ✓ ${short}`;
      sgtEl.style.color = 'var(--purple)';
    } else if (isSeekerDevice()) {
      sgtEl.textContent = 'NOT FOUND ⚠';
      sgtEl.style.color = 'var(--amber)';
    } else {
      sgtEl.textContent = 'N/A (requires Seeker)';
      sgtEl.style.color = 'var(--text-dim)';
    }
    $('resultTime').textContent = new Date().toISOString();

    const titleEl = $('sealResultTitle');
    const subEl = $('sealResultSubtitle');

    if (onChain) {
      titleEl.textContent = 'Transaction Sealed';
      titleEl.style.color = 'var(--accent-light)';
      subEl.textContent = 'Immutable proof posted to Solana Devnet via Seed Vault';
      $('resultTx').textContent = solanaTxId;
      $('resultTx').style.cursor = 'pointer';
      $('resultTxConfirm').textContent = 'CONFIRMED on Devnet ✓';
      $('resultTxConfirm').style.color = 'var(--accent-light)';
      $('btnViewExplorer').classList.remove('hidden');
    } else if (!isSeekerDevice()) {
      titleEl.textContent = 'Local Proof Created';
      titleEl.style.color = 'var(--amber)';
      subEl.textContent = 'Signed with platform key — not posted to Solana (requires Seeker)';
      $('resultTx').textContent = '— (Seeker required for on-chain posting)';
      $('resultTx').style.cursor = 'default';
      $('resultTxConfirm').textContent = 'NOT POSTED — device has no Genesis Token';
      $('resultTxConfirm').style.color = 'var(--amber)';
      $('btnViewExplorer').classList.add('hidden');
    } else {
      titleEl.textContent = 'Seal Created (Local)';
      titleEl.style.color = 'var(--amber)';
      subEl.textContent = 'Seed Vault signing succeeded but Solana posting failed';
      $('resultTx').textContent = '—';
      $('resultTx').style.cursor = 'default';
      $('resultTxConfirm').textContent = 'NOT POSTED — ' + (failReason || 'unknown error');
      $('resultTxConfirm').style.color = 'var(--amber)';
      $('btnViewExplorer').classList.add('hidden');
    }

    $('sealResult').classList.remove('hidden');

  } catch (err) {
    console.error('Seal error:', err);
    $('sealBadge').textContent = 'Failed';
    $('sealBadge').className = 'status-badge';
    $('sealBadge').style.cssText = 'color: var(--red); border-color: var(--red);';
    btn.disabled = false;
    document.querySelectorAll('.seal-step').forEach(s => s.classList.remove('active', 'done'));
    $('sealProgress').classList.add('hidden');
  }
});

function openSolanaExplorer() {
  if (state._lastTxId && state._lastTxReal) {
    window.open(`https://explorer.solana.com/tx/${state._lastTxId}?cluster=devnet`, '_blank');
  }
}
window.openSolanaExplorer = openSolanaExplorer;

// ============================================================
// SETTINGS ACTIONS
// ============================================================

// Reconnect Seed Vault wallet
$('btnReconnectWallet').addEventListener('click', async () => {
  const btn = $('btnReconnectWallet');
  btn.disabled = true;
  btn.textContent = '🔗 Connecting...';

  try {
    const loaded = await loadMWA();
    if (!loaded) throw new Error(mwaLoadError || 'MWA not available');
    const addr = await mwaAuthorize();
    btn.textContent = '✅ Connected: ' + addr.substring(0, 8) + '...';
    await updateSettingsView();
  } catch (e) {
    btn.textContent = '❌ Failed: ' + (e.message || e);
  }

  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = '🔗 Reconnect Seed Vault Wallet';
  }, 4000);
});

// Reset
$('btnReset').addEventListener('click', () => {
  if (confirm('Remove all keys and seal history? This cannot be undone.')) {
    localStorage.removeItem('alpensign_state');
    window.location.reload();
  }
});

// Copy wallet address
function copyWallet() {
  if (state.walletAddr && navigator.clipboard) {
    navigator.clipboard.writeText(state.walletAddr).then(() => {
      const hint = $('walletDisplay').querySelector('.copy-hint');
      if (hint) {
        hint.textContent = 'Copied ✓';
        setTimeout(() => hint.textContent = 'Tap to copy', 2000);
      }
    });
  }
}
window.copyWallet = copyWallet;

// About page
$('btnAbout').addEventListener('click', () => navigateTo('about'));
$('btnAboutBack').addEventListener('click', () => navigateTo('settings'));



async function invokeSwiyu() {
  const presentationDefinition = {
    id: "alpensign-identity-request",
    input_descriptors: [{
      id: "ch.admin.eid",
      format: { 
        "vc+sd-jwt": { 
          "sd-jwt_alg_values": ["ES256"],
          "kb-jwt_alg_values": ["ES256"] 
        } 
      },
      constraints: {
        fields: [
          { 
            path: ["$.vct"], 
            filter: { type: "string", const: "https://identity.admin.ch/credentials/v1/SwissEid" } 
          },
          { path: ["$.given_name"], purpose: "To verify your identity" },
          { path: ["$.family_name"], purpose: "To bind your name to the seal" }
        ]
      }
    }]
  };

  const params = new URLSearchParams({
    client_id: window.location.origin, // Ideally a DID, but use this with the scheme below
    client_id_scheme: "redirect_uri",   // CRITICAL: Tells swiyu how to treat the client_id
    response_type: "vp_token",
    response_mode: "fragment", 
    redirect_uri: window.location.origin + window.location.pathname,
    nonce: crypto.randomUUID(),        // Use a real UUID for better wallet compatibility
    presentation_definition: JSON.stringify(presentationDefinition)
  });

  // The custom scheme used by swiyu for OID4VP presentation
  const deepLink = `openid4vp://authorize?${params.toString()}`;
  
  window.location.href = deepLink;
}

document.getElementById('btnConnectEID')?.addEventListener('click', invokeSwiyu);

// ============================================================
// BROADCASTCHANNEL — Bank Simulator Bridge
// ============================================================

const bankChannel = new BroadcastChannel('alpensign-bank-bridge');

bankChannel.onmessage = (event) => {
  const msg = event.data;
  console.log('[BankBridge] Received:', msg.type);

  if (msg.type === 'payment-request') {
    // Bank sent a payment for sealing
    const p = msg.payment;
    state.currentRequest = {
      recipient: p.creditor,
      town: p.address ? p.address.split(',').pop().trim() : 'CH',
      country: 'CH',
      amount: `CHF ${p.amount}`,
      iban: p.iban,
      ref: p.reference,
      _bankRequestId: msg.requestId, // Track for response
    };
    // Show notification
    $('notifBody').textContent = `CHF ${p.amount} to ${p.creditor}`;
    $('notification').classList.add('show');
    console.log('[BankBridge] Payment request shown as notification');
  }

  if (msg.type === 'attestation-confirmed') {
    // Bank confirmed the attestation — complete enrollment
    console.log('[BankBridge] Attestation confirmed by bank');
    if (state.credId && state.walletAddr && !state.enrolled) {
      state.enrolled = true;
      saveState();
      adaptEnrollmentForDevice();
      $('enroll-2').classList.remove('active');
      $('enroll-3').classList.add('active');
      updateHeaderBadge();
      const statusEl = $('enrollStatus2');
      if (statusEl) {
        statusEl.innerHTML = '<span style="color: var(--accent-light);">✓ Bank attestation confirmed via portal</span>';
      }
    }
  }
};

// Send seal completion back to bank
function notifyBankSealComplete(seal) {
  bankChannel.postMessage({
    type: 'seal-complete',
    requestId: state.currentRequest?._bankRequestId || null,
    seal: {
      hash: seal.hash,
      signature: seal.signature,
      solanaTx: seal.solanaTx,
      solanaTxReal: seal.solanaTxReal,
      deviceType: seal.deviceType,
      timestamp: seal.timestamp,
      recipient: seal.recipient,
      amount: seal.amount,
    },
  });
  console.log('[BankBridge] Seal completion sent to bank');
}

// ============================================================
// CHALLENGE SIGNING (Bank Pairing)
// ============================================================

let challengeSignatureRaw = null;

$('btnSignChallenge').addEventListener('click', async () => {
  const input = $('challengeInput');
  const statusEl = $('challengeStatus');
  const btn = $('btnSignChallenge');
  const challenge = input.value.trim();

  if (!challenge) {
    statusEl.innerHTML = '<span style="color: var(--red);">Enter the challenge from the bank portal</span>';
    return;
  }

  if (!state.credId) {
    statusEl.innerHTML = '<span style="color: var(--red);">Complete Seed Vault initialization first</span>';
    return;
  }

  btn.disabled = true;
  statusEl.textContent = isSeekerDevice()
    ? 'Requesting Seed Vault biometric...'
    : 'Requesting platform authentication...';

  try {
    // Hash the challenge string
    const challengeBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(challenge)
    );

    // WebAuthn assertion — biometric-gated signature over the challenge
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: new Uint8Array(challengeBuffer),
        rpId: RP_ID,
        allowCredentials: [{
          id: bufferify(state.credId),
          type: 'public-key'
        }],
        userVerification: 'required'
      }
    });

    const sigBase64 = base64ify(assertion.response.signature);
    challengeSignatureRaw = sigBase64;

    // Display signature
    $('challengeSigDisplay').textContent = sigBase64.substring(0, 44) + '...' + sigBase64.slice(-8);
    $('challengeResult').classList.remove('hidden');

    statusEl.innerHTML = '<span style="color: var(--accent-light);">✓ Challenge signed with Seed Vault biometric</span>';

    // Show the bank confirm button
    $('btnSimulateBank').classList.remove('hidden');

  } catch (err) {
    console.error('Challenge signing error:', err);
    if (err.name === 'NotAllowedError') {
      statusEl.innerHTML = '<span style="color: var(--red);">Biometric cancelled or failed</span>';
    } else {
      statusEl.innerHTML = `<span style="color: var(--red);">Error: ${err.name}</span>`;
    }
  }

  btn.disabled = false;
});

function copyChallengeSignature() {
  if (challengeSignatureRaw && navigator.clipboard) {
    navigator.clipboard.writeText(challengeSignatureRaw).then(() => {
      const hint = $('challengeCopyHint');
      if (hint) {
        hint.textContent = 'Copied ✓';
        setTimeout(() => hint.textContent = 'Tap to copy — share with bank advisor', 2000);
      }
    });
  }
}
window.copyChallengeSignature = copyChallengeSignature;

// ============================================================
// INIT
// ============================================================

async function init() {
  loadState();
  await detectDevice();
  autoDismissBanner();
  initSolanaRPC();
  updateHeaderBadge();

  // Pre-load MWA on Seeker
  if (isSeekerDevice()) {
    loadMWA().then(ok => {
      if (ok) console.log('MWA pre-loaded');
      else console.warn('MWA pre-load failed (will retry on demand)');
    });
  }

  // Routing
  if (state.enrolled) {
    navigateTo('home');
  } else if (state.credId) {
    $('view-enroll').classList.add('active');
    $('enroll-1').classList.remove('active');
    $('enroll-2').classList.add('active');
    adaptEnrollStep2();
    if (state.walletAddr) {
      $('walletDisplay').classList.remove('hidden');
      $('walletAddr').textContent = state.walletAddr;
      $('btnSimulateBank').classList.remove('hidden');
      $('bankPairingSection').classList.remove('hidden');
    }
  } else if (state.welcomeSeen) {
    $('view-enroll').classList.add('active');
  } else {
    $('view-welcome').classList.add('active');
  }

  // Dismiss splash screen
  const splash = $('splashScreen');
  if (splash) {
    splash.classList.add('fade-out');
    setTimeout(() => splash.remove(), 700);
  }
}

init();
