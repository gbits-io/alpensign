// ============================================================
// AlpenSign v0.4.0 — Transaction Sealing for Banks
// Solana Seeker Hackathon Monolith · Q1 2026
// ============================================================

const RP_ID = window.location.hostname;

// ---- Solana Setup ----
const SOLANA_RPC = 'https://api.devnet.solana.com';
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
let solanaConnection = null;
let solanaKeypair = null;
let solanaReady = false;

// ---- State ----
let state = {
  enrolled: false,
  credId: null,
  walletAddr: null,
  solanaSecretKey: null,
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

function isSeeker() { return state.deviceType === 'SOLANA_SEEKER'; }

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

  // 1. Primary: User-Agent Client Hints (bypass Chrome UA reduction)
  if (navigator.userAgentData) {
    try {
      const isSolanaBrand = navigator.userAgentData.brands.some(b =>
        /solanamobile/i.test(b.brand)
      );
      const hints = await navigator.userAgentData.getHighEntropyValues(['model']);
      deviceModel = hints.model || 'Unknown';
      seekerDetected = isSolanaBrand || /seeker|solana/i.test(deviceModel);
    } catch (e) {
      console.warn('Client Hints failed, falling back to UA string.', e);
    }
  }

  // 2. Fallback: UA string parsing
  if (!seekerDetected) {
    seekerDetected = /seeker|solanamobile|solana\s*mobile|saga/i.test(ua);
    const modelMatch = ua.match(/;\s*([^;)]+?)(?:(?:\s+Build\/)|(?:\s*Webkit)|(?:\s*[\);]))/i);
    if (modelMatch && deviceModel === 'Unknown Device') {
      deviceModel = modelMatch[1].trim();
    }
  }

  const isAndroid = /android/i.test(ua);
  const isIOS = /iphone|ipad|ipod/i.test(ua);

  if (seekerDetected) {
    state.deviceType = 'SOLANA_SEEKER';
    state.deviceModel = deviceModel || 'Solana Seeker';
    banner.className = 'device-banner show seeker';
    icon.textContent = '✅';
    msg.textContent = 'Solana Seeker detected — Seed Vault available';
    modelEl.textContent = state.deviceModel;
  } else if (isAndroid) {
    state.deviceType = 'GENERIC_ANDROID';
    state.deviceModel = deviceModel;
    banner.className = 'device-banner show warning';
    icon.textContent = '⚠️';
    msg.innerHTML = 'Non-Seeker device — signatures are <b>not</b> backed by Genesis Token or TEEPIN';
    modelEl.textContent = deviceModel;
  } else if (isIOS) {
    state.deviceType = 'IOS';
    state.deviceModel = 'iPhone / iPad';
    banner.className = 'device-banner show warning';
    icon.textContent = '⚠️';
    msg.innerHTML = 'iOS device — no Seed Vault or Genesis Token available';
    modelEl.textContent = 'Apple Secure Enclave (no Solana integration)';
  } else {
    state.deviceType = 'DESKTOP';
    state.deviceModel = 'Desktop Browser';
    banner.className = 'device-banner show desktop';
    icon.textContent = '🖥️';
    msg.textContent = 'Desktop browser — demo mode only, no hardware secure element';
    modelEl.textContent = navigator.platform || 'Unknown platform';
  }

  return state.deviceType;
}

// ============================================================
// SOLANA WALLET
// ============================================================

function initSolana() {
  try {
    if (typeof solanaWeb3 === 'undefined') {
      console.warn('solanaWeb3 not loaded');
      return false;
    }

    solanaConnection = new solanaWeb3.Connection(SOLANA_RPC, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 30000,
    });

    if (state.solanaSecretKey) {
      try {
        const secretArray = new Uint8Array(JSON.parse(state.solanaSecretKey));
        solanaKeypair = solanaWeb3.Keypair.fromSecretKey(secretArray);
      } catch (e) {
        console.warn('Saved keypair invalid, generating new one');
        solanaKeypair = solanaWeb3.Keypair.generate();
        state.solanaSecretKey = JSON.stringify(Array.from(solanaKeypair.secretKey));
        saveState();
      }
    } else {
      solanaKeypair = solanaWeb3.Keypair.generate();
      state.solanaSecretKey = JSON.stringify(Array.from(solanaKeypair.secretKey));
      saveState();
    }

    console.log('Solana wallet:', solanaKeypair.publicKey.toBase58());
    return true;
  } catch (e) {
    console.error('Solana init failed:', e);
    return false;
  }
}

async function getSolBalance() {
  if (!solanaConnection || !solanaKeypair) return 0;
  try {
    const balance = await solanaConnection.getBalance(solanaKeypair.publicKey);
    return balance / solanaWeb3.LAMPORTS_PER_SOL;
  } catch (e) {
    console.warn('Balance check failed:', e);
    return -1; // indicate error
  }
}

async function requestAirdrop() {
  if (!solanaConnection || !solanaKeypair) return false;
  try {
    // Request 0.01 SOL = 10,000,000 lamports
    const sig = await solanaConnection.requestAirdrop(
      solanaKeypair.publicKey,
      0.01 * solanaWeb3.LAMPORTS_PER_SOL
    );
    console.log('Airdrop requested, sig:', sig);
    await solanaConnection.confirmTransaction(sig, 'confirmed');
    console.log('Airdrop confirmed');
    return true;
  } catch (e) {
    console.error('Airdrop failed:', e.message || e);
    return false;
  }
}

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
  console.log(`Memo payload: ${json.length} bytes`, json);
  return json;
}

async function postMemoTransaction(memoData) {
  if (!solanaConnection || !solanaKeypair) {
    throw new Error('Solana not initialized');
  }

  const balance = await solanaConnection.getBalance(solanaKeypair.publicKey);
  console.log('Wallet balance (lamports):', balance);
  if (balance < 5000) {
    throw new Error('NO_SOL');
  }

  const encoded = new TextEncoder().encode(memoData);
  if (encoded.length > 566) {
    console.warn(`Memo ${encoded.length}B > 566B limit, truncating`);
    memoData = memoData.substring(0, 500);
  }

  const memoInstruction = new solanaWeb3.TransactionInstruction({
    keys: [],
    programId: new solanaWeb3.PublicKey(MEMO_PROGRAM_ID),
    data: new TextEncoder().encode(memoData),
  });

  const transaction = new solanaWeb3.Transaction().add(memoInstruction);

  const { blockhash, lastValidBlockHeight } = await solanaConnection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = solanaKeypair.publicKey;
  transaction.sign(solanaKeypair);

  console.log('Sending transaction...');
  const txSignature = await solanaConnection.sendRawTransaction(
    transaction.serialize(),
    { skipPreflight: false, preflightCommitment: 'confirmed' }
  );
  console.log('TX sent, signature:', txSignature);

  const confirmation = await solanaConnection.confirmTransaction(
    { signature: txSignature, blockhash, lastValidBlockHeight },
    'confirmed'
  );

  if (confirmation.value && confirmation.value.err) {
    throw new Error('TX error: ' + JSON.stringify(confirmation.value.err));
  }

  console.log('TX confirmed:', txSignature);
  return txSignature;
}

// ============================================================
// PERSISTENCE
// ============================================================

function saveState() {
  localStorage.setItem('alpensign_state', JSON.stringify({
    enrolled: state.enrolled,
    credId: state.credId,
    walletAddr: state.walletAddr,
    solanaSecretKey: state.solanaSecretKey,
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
      state.solanaSecretKey = saved.solanaSecretKey || null;
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

  const navItem = document.querySelector(`.nav-item[data-view="${viewName}"]`);
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
  const walletAddr = solanaKeypair ? solanaKeypair.publicKey.toBase58() : (state.walletAddr || '—');
  $('homeWallet').textContent = walletAddr.slice(0, 8) + '...' + walletAddr.slice(-6);
  $('homeSealCount').textContent = state.seals.length;

  const bal = await getSolBalance();
  if (bal >= 0) {
    $('homeSolBalance').textContent = bal.toFixed(6) + ' SOL';
    $('homeSolBalance').style.color = bal > 0 ? 'var(--accent-light)' : 'var(--text-dim)';
  } else {
    $('homeSolBalance').textContent = '— (offline)';
    $('homeSolBalance').style.color = 'var(--text-dim)';
  }

  const container = $('homeRecentSeals');
  if (state.seals.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">No seals yet</div></div>';
  } else {
    container.innerHTML = state.seals.slice(-3).reverse().map(sealItemHTML).join('');
  }
}

function sealItemHTML(s) {
  const clickable = s.solanaTxReal && s.solanaTx;
  return `
    <div class="history-item" ${clickable ? `onclick="window.open('https://explorer.solana.com/tx/${s.solanaTx}?cluster=devnet','_blank')" style="cursor:pointer;"` : ''}>
      <div class="history-icon">${s.solanaTxReal ? '✅' : '🔏'}</div>
      <div class="history-details">
        <div class="history-recipient">${s.recipient}</div>
        <div class="history-time">${formatTime(s.timestamp)}</div>
      </div>
      <div>
        <div class="history-amount">${s.amount}</div>
        <div class="history-status">${s.solanaTxReal ? 'On-chain ✓' : 'Local proof'}</div>
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

  container.innerHTML = state.seals.slice().reverse().map(sealItemHTML).join('');
}

// ============================================================
// SETTINGS VIEW
// ============================================================

async function updateSettingsView() {
  $('settingsUA').textContent = navigator.userAgent.substring(0, 60) + '...';
  $('settingsCredId').textContent = state.credId ? state.credId.substring(0, 24) + '...' : '—';
  $('settingsDevice').textContent = `${state.deviceType} (${state.deviceModel})`;
  $('settingsDevice').style.color = isSeeker() ? 'var(--accent-light)' : 'var(--amber)';

  if (solanaKeypair) {
    const addr = solanaKeypair.publicKey.toBase58();
    $('settingsSolAddr').textContent = addr.substring(0, 12) + '...' + addr.slice(-6);
    const bal = await getSolBalance();
    if (bal >= 0) {
      $('settingsSolBal').textContent = bal.toFixed(6) + ' SOL';
      $('settingsSolBal').style.color = bal > 0 ? 'var(--accent-light)' : 'var(--red)';
    } else {
      $('settingsSolBal').textContent = '— (offline)';
      $('settingsSolBal').style.color = 'var(--text-dim)';
    }
  }
}

// ============================================================
// DEVICE-ADAPTIVE SEAL STEPS
// ============================================================

function adaptSealStepsForDevice() {
  if (isSeeker()) {
    // Seeker: full trust chain
    $('step-auth-sub').textContent = 'Seed Vault signing';
    $('step-sign-text').textContent = 'Sign with Seed Vault';
    $('step-sign-sub').textContent = 'ECDSA-SHA256 (P-256) · Hardware-bound';
    $('step-post-text').textContent = 'Post Seal to Solana';
    $('step-post-sub').textContent = 'Memo transaction on Devnet';
    $('step-confirm-text').textContent = 'Seal Confirmed';
    $('step-confirm-sub').textContent = 'Immutable on-chain record';
  } else {
    // Non-Seeker: local proof only
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

  if (isSeeker()) {
    device.textContent = 'Solana Seeker';
    device.style.color = 'var(--accent-light)';
    cred.textContent = 'Hardware-Attested (Seed Vault)';
    cred.style.color = 'var(--accent-light)';
    tokenLabel.textContent = 'Genesis Token';
    tokenValue.textContent = 'Verified ✓';
    tokenValue.style.color = 'var(--purple)';
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

$('btnInitVault').addEventListener('click', async () => {
  const statusEl = $('enrollStatus1');
  const btn = $('btnInitVault');
  btn.disabled = true;
  statusEl.textContent = isSeeker() ? 'Requesting Seeker attestation...' : 'Requesting platform attestation...';

  const challenge = window.crypto.getRandomValues(new Uint8Array(32));
  const userID = window.crypto.getRandomValues(new Uint8Array(16));

  const options = {
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
  };

  try {
    const cred = await navigator.credentials.create(options);
    state.credId = base64ify(cred.rawId);

    state.walletAddr = solanaKeypair
      ? solanaKeypair.publicKey.toBase58()
      : (() => { const c = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; let a = ''; for (let i = 0; i < 44; i++) a += c[Math.floor(Math.random() * c.length)]; return a; })();

    saveState();
    statusEl.innerHTML = '<span style="color: var(--accent-light);">✓ Key pair created</span>';

    setTimeout(() => {
      $('enroll-1').classList.remove('active');
      $('enroll-2').classList.add('active');
      $('walletAddr').textContent = state.walletAddr;
      updateHeaderBadge();
    }, 800);

  } catch (err) {
    statusEl.textContent = 'Error: ' + err.name;
    btn.disabled = false;
    console.error('Enrollment error:', err);
  }
});

$('btnSimulateBank').addEventListener('click', () => {
  const btn = $('btnSimulateBank');
  const statusEl = $('enrollStatus2');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Bank verifying...';
  statusEl.textContent = isSeeker()
    ? 'Verifying Genesis Token + issuing credential...'
    : 'Verifying device attestation...';

  setTimeout(() => {
    statusEl.innerHTML = isSeeker()
      ? '<span style="color: var(--accent-light);">✓ SAS Credential issued</span>'
      : '<span style="color: var(--amber);">✓ Platform credential registered</span>';
    setTimeout(() => {
      if (isSeeker()) {
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

  setTimeout(() => { $('notification').classList.remove('show'); }, 5000);
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

  // Reset seal view
  $('btnSeal').classList.remove('hidden');
  $('btnSeal').disabled = false;
  $('btnSeal').innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 11c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2z"/><path d="M18.5 8A6.5 6.5 0 0 0 12 1.5 6.5 6.5 0 0 0 5.5 8v2H4v10h16V10h-1.5V8z"/></svg> Seal with Biometric';
  $('sealProgress').classList.add('hidden');
  $('sealResult').classList.add('hidden');
  $('sealBadge').textContent = 'Pending';
  $('sealBadge').className = 'status-badge badge-pending';
  $('sealPaymentCard').style.display = '';

  document.querySelectorAll('.seal-step').forEach(s => {
    s.classList.remove('active', 'done');
  });

  // Adapt step labels for this device
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
    // Step 1: Biometric auth
    await activateStep(0);

    const p = state.currentRequest;
    const txData = [
      p.amount, p.recipient, p.town, p.country,
      p.iban, p.ref, Date.now().toString()
    ].join('|');
    const challengeBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txData));
    const txHash = hexify(challengeBuffer);

    // WebAuthn assertion (triggers biometric)
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

    // Step 4: Post / Record
    await activateStep(3);

    let solanaTxId = null;
    let onChain = false;
    let failReason = '';

    if (isSeeker() && solanaReady) {
      // Seeker: attempt real Solana posting
      $('sealBadge').textContent = 'Posting...';
      const memoPayload = buildMemoPayload(p, txHash, signature);

      try {
        solanaTxId = await postMemoTransaction(memoPayload);
        onChain = true;
        console.log('✅ On-chain TX:', solanaTxId);
      } catch (solanaErr) {
        failReason = solanaErr.message;
        console.warn('Solana TX failed:', failReason);
      }
    } else if (!isSeeker()) {
      // Non-Seeker: local proof only (no Solana posting)
      $('sealBadge').textContent = 'Recording...';
      failReason = 'NON_SEEKER';
      await new Promise(r => setTimeout(r, 800)); // brief pause for UX
    } else {
      failReason = 'Solana not available';
      await new Promise(r => setTimeout(r, 800));
    }

    // Step 5: Confirmed
    await activateStep(4);
    $(steps[3]).classList.remove('active');
    $(steps[3]).classList.add('done');

    if (onChain) {
      $('sealBadge').textContent = 'Sealed ✓';
    } else if (!isSeeker()) {
      $('sealBadge').textContent = 'Local ✓';
    } else {
      $('sealBadge').textContent = 'Sealed (local)';
    }
    $('sealBadge').className = 'status-badge badge-enrolled';

    // Save seal record
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

    // Show result
    await new Promise(r => setTimeout(r, 600));

    btn.classList.add('hidden');
    $('sealProgress').classList.add('hidden');

    // Populate result
    $('resultHash').textContent = txHash;
    $('resultSig').textContent = signature.substring(0, 80) + '...';
    $('resultDeviceType').textContent = state.deviceType;
    $('resultChannel').textContent = isSeeker()
      ? 'INDEPENDENT_DEVICE (Seed Vault)'
      : 'INDEPENDENT_DEVICE (WebAuthn)';
    $('resultTime').textContent = new Date().toISOString();

    const titleEl = $('sealResultTitle');
    const subEl = $('sealResultSubtitle');

    if (onChain) {
      titleEl.textContent = 'Transaction Sealed';
      titleEl.style.color = 'var(--accent-light)';
      subEl.textContent = 'Immutable proof posted to Solana Devnet';
      $('resultTx').textContent = solanaTxId;
      $('resultTx').style.cursor = 'pointer';
      $('resultTxConfirm').textContent = 'CONFIRMED on Devnet ✓';
      $('resultTxConfirm').style.color = 'var(--accent-light)';
      $('btnViewExplorer').classList.remove('hidden');
    } else if (!isSeeker()) {
      titleEl.textContent = 'Local Proof Created';
      titleEl.style.color = 'var(--amber)';
      subEl.textContent = 'Signed with platform key — not posted to Solana (requires Seeker)';
      $('resultTx').textContent = '— (Seeker required for on-chain posting)';
      $('resultTx').style.cursor = 'default';
      $('resultTxConfirm').textContent = 'NOT POSTED — device has no Genesis Token';
      $('resultTxConfirm').style.color = 'var(--amber)';
      $('btnViewExplorer').classList.add('hidden');
    } else {
      // Seeker but Solana failed
      titleEl.textContent = 'Seal Created (Local)';
      titleEl.style.color = 'var(--amber)';
      subEl.textContent = 'Signed by Seed Vault but could not post to Solana';
      $('resultTx').textContent = '—';
      $('resultTx').style.cursor = 'default';
      $('resultTxConfirm').textContent = failReason === 'NO_SOL'
        ? 'NOT POSTED — wallet has no SOL. Use Settings → Airdrop.'
        : 'NOT POSTED — ' + (failReason || 'Solana unavailable');
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

    document.querySelectorAll('.seal-step').forEach(s => {
      s.classList.remove('active', 'done');
    });
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
// UTILITY
// ============================================================

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

// Airdrop with retry
$('btnAirdrop').addEventListener('click', async () => {
  const btn = $('btnAirdrop');
  btn.disabled = true;
  btn.textContent = '💧 Requesting airdrop...';

  let success = await requestAirdrop();

  // Retry once on failure
  if (!success) {
    btn.textContent = '💧 Retrying...';
    await new Promise(r => setTimeout(r, 2000));
    success = await requestAirdrop();
  }

  if (success) {
    btn.textContent = '✅ Airdrop received!';
    btn.style.color = 'var(--accent-light)';
    await updateSettingsView();
  } else {
    // Show faucet fallback
    const addr = solanaKeypair ? solanaKeypair.publicKey.toBase58() : '';
    btn.innerHTML = '❌ Airdrop failed — <a href="https://faucet.solana.com/?amount=0.01&address=' + addr + '&cluster=devnet" target="_blank" style="color:var(--purple);text-decoration:underline;">use web faucet</a>';
    btn.style.color = 'var(--red)';
  }

  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = '💧 Request Devnet Airdrop (0.01 SOL)';
    btn.style.color = '';
  }, 8000);
});

// Reset
$('btnReset').addEventListener('click', () => {
  if (confirm('Remove all keys and seal history? This cannot be undone.')) {
    localStorage.removeItem('alpensign_state');
    window.location.reload();
  }
});

// ============================================================
// INIT
// ============================================================

async function init() {
  loadState();
  await detectDevice();
  solanaReady = initSolana();
  updateHeaderBadge();

  if (solanaReady) {
    console.log('Solana wallet:', solanaKeypair.publicKey.toBase58());
    getSolBalance().then(bal => {
      if (bal === 0) console.log('⚠️ No SOL. Use Settings → Airdrop.');
      else if (bal > 0) console.log('SOL balance:', bal);
    });
  }

  // Routing
  if (state.enrolled) {
    navigateTo('home');
  } else if (state.credId) {
    $('view-enroll').classList.add('active');
    $('enroll-1').classList.remove('active');
    $('enroll-2').classList.add('active');
    $('walletAddr').textContent = state.walletAddr;
  } else if (state.welcomeSeen) {
    $('view-enroll').classList.add('active');
  } else {
    $('view-welcome').classList.add('active');
  }
}

init();
