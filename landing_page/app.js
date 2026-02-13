// ============================================================
// AlpenSign v0.3.0 — Transaction Sealing for Banks
// Solana Seeker Hackathon Monolith · Q1 2026
// ============================================================

const RP_ID = window.location.hostname;

// ---- Solana Setup ----
const SOLANA_RPC = 'https://api.devnet.solana.com';
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
let solanaConnection = null;
let solanaKeypair = null;

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

// ============================================================
// DEVICE DETECTION
// ============================================================

function detectDevice() {
  const ua = navigator.userAgent;
  const banner = $('deviceBanner');
  const icon = $('deviceIcon');
  const msg = $('deviceMessage');
  const model = $('deviceModel');

  let deviceModel = 'Unknown';
  const androidMatch = ua.match(/;\s*([^;)]+?)\s*Build\//);
  if (androidMatch) {
    deviceModel = androidMatch[1].trim();
  }

  const isSeeker = /seeker|solana\s*mobile|saga/i.test(ua) || /seeker/i.test(deviceModel);
  const isAndroid = /android/i.test(ua);
  const isIOS = /iphone|ipad|ipod/i.test(ua);

  if (isSeeker) {
    state.deviceType = 'SOLANA_SEEKER';
    state.deviceModel = deviceModel;
    banner.className = 'device-banner show seeker';
    icon.textContent = '✅';
    msg.textContent = 'Solana Seeker detected — Seed Vault available';
    model.textContent = deviceModel;
  } else if (isAndroid) {
    state.deviceType = 'GENERIC_ANDROID';
    state.deviceModel = deviceModel;
    banner.className = 'device-banner show warning';
    icon.textContent = '⚠️';
    msg.innerHTML = 'Non-Seeker device — signatures are <b>not</b> backed by Genesis Token or TEEPIN';
    model.textContent = deviceModel;
  } else if (isIOS) {
    state.deviceType = 'IOS';
    state.deviceModel = 'iPhone / iPad';
    banner.className = 'device-banner show warning';
    icon.textContent = '⚠️';
    msg.innerHTML = 'iOS device — no Seed Vault or Genesis Token available';
    model.textContent = 'Apple Secure Enclave (no Solana integration)';
  } else {
    state.deviceType = 'DESKTOP';
    state.deviceModel = 'Desktop Browser';
    banner.className = 'device-banner show desktop';
    icon.textContent = '🖥️';
    msg.textContent = 'Desktop browser — demo mode only, no hardware secure element';
    model.textContent = navigator.platform || 'Unknown platform';
  }

  return state.deviceType;
}

// ============================================================
// SOLANA WALLET (BROWSER-SIDE FOR MEMO TX)
// ============================================================

function initSolana() {
  try {
    if (typeof solanaWeb3 === 'undefined') {
      console.warn('solanaWeb3 not loaded');
      return false;
    }

    solanaConnection = new solanaWeb3.Connection(SOLANA_RPC, 'confirmed');

    if (state.solanaSecretKey) {
      const secretArray = new Uint8Array(JSON.parse(state.solanaSecretKey));
      solanaKeypair = solanaWeb3.Keypair.fromSecretKey(secretArray);
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
    return 0;
  }
}

async function requestAirdrop() {
  if (!solanaConnection || !solanaKeypair) return false;
  try {
    const sig = await solanaConnection.requestAirdrop(
      solanaKeypair.publicKey,
      1 * solanaWeb3.LAMPORTS_PER_SOL
    );
    await solanaConnection.confirmTransaction(sig, 'confirmed');
    return true;
  } catch (e) {
    console.error('Airdrop failed:', e);
    return false;
  }
}

async function postMemoTransaction(memoData) {
  if (!solanaConnection || !solanaKeypair) {
    throw new Error('Solana not initialized');
  }

  const balance = await solanaConnection.getBalance(solanaKeypair.publicKey);
  if (balance < 5000) {
    throw new Error('Insufficient SOL. Request an airdrop in Settings.');
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

  const rawTx = transaction.serialize();
  const txSignature = await solanaConnection.sendRawTransaction(rawTx, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  await solanaConnection.confirmTransaction({
    signature: txSignature,
    blockhash,
    lastValidBlockHeight,
  }, 'confirmed');

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

  try {
    const bal = await getSolBalance();
    $('homeSolBalance').textContent = bal.toFixed(6) + ' SOL';
    $('homeSolBalance').style.color = bal > 0 ? 'var(--accent-light)' : 'var(--text-dim)';
  } catch (e) {
    $('homeSolBalance').textContent = '— (offline)';
  }

  const container = $('homeRecentSeals');
  if (state.seals.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">No seals yet</div></div>';
  } else {
    const recent = state.seals.slice(-3).reverse();
    container.innerHTML = recent.map(s => `
      <div class="history-item" ${s.solanaTxReal ? `onclick="window.open('https://explorer.solana.com/tx/${s.solanaTx}?cluster=devnet','_blank')" style="cursor:pointer;"` : ''}>
        <div class="history-icon">${s.solanaTxReal ? '✅' : '⏳'}</div>
        <div class="history-details">
          <div class="history-recipient">${s.recipient}</div>
          <div class="history-time">${formatTime(s.timestamp)}</div>
        </div>
        <div>
          <div class="history-amount">${s.amount}</div>
          <div class="history-status">${s.solanaTxReal ? 'On-chain ✓' : 'Simulated'}</div>
        </div>
      </div>
    `).join('');
  }
}

// ============================================================
// HISTORY VIEW
// ============================================================

function updateHistoryView() {
  const container = $('historyList');
  $('historyCount').textContent = state.seals.length ? `${state.seals.length} seal${state.seals.length > 1 ? 's' : ''}` : '';

  if (state.seals.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">No seals recorded</div></div>';
    return;
  }

  container.innerHTML = state.seals.slice().reverse().map(s => `
    <div class="history-item" ${s.solanaTxReal ? `onclick="window.open('https://explorer.solana.com/tx/${s.solanaTx}?cluster=devnet','_blank')" style="cursor:pointer;"` : ''}>
      <div class="history-icon">${s.solanaTxReal ? '✅' : '⏳'}</div>
      <div class="history-details">
        <div class="history-recipient">${s.recipient}</div>
        <div class="history-time">${formatTime(s.timestamp)}</div>
      </div>
      <div>
        <div class="history-amount">${s.amount}</div>
        <div class="history-status">${s.solanaTxReal ? 'On-chain ✓' : 'Simulated'}</div>
      </div>
    </div>
  `).join('');
}

// ============================================================
// SETTINGS VIEW
// ============================================================

async function updateSettingsView() {
  $('settingsUA').textContent = navigator.userAgent.substring(0, 60) + '...';
  $('settingsCredId').textContent = state.credId ? state.credId.substring(0, 24) + '...' : '—';
  $('settingsDevice').textContent = `${state.deviceType} (${state.deviceModel})`;
  $('settingsDevice').style.color = state.deviceType === 'SOLANA_SEEKER' ? 'var(--accent-light)' : 'var(--amber)';

  if (solanaKeypair) {
    $('settingsSolAddr').textContent = solanaKeypair.publicKey.toBase58().substring(0, 20) + '...';
    try {
      const bal = await getSolBalance();
      $('settingsSolBal').textContent = bal.toFixed(6) + ' SOL';
      $('settingsSolBal').style.color = bal > 0 ? 'var(--accent-light)' : 'var(--red)';
    } catch (e) {
      $('settingsSolBal').textContent = '— (offline)';
    }
  }
}

// ============================================================
// ENROLLMENT FLOW
// ============================================================

$('btnInitVault').addEventListener('click', async () => {
  const statusEl = $('enrollStatus1');
  const btn = $('btnInitVault');
  btn.disabled = true;
  statusEl.textContent = 'Requesting Seeker attestation...';

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

    // Use real Solana address if available
    state.walletAddr = solanaKeypair
      ? solanaKeypair.publicKey.toBase58()
      : (() => { const c = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; let a = ''; for (let i = 0; i < 44; i++) a += c[Math.floor(Math.random() * c.length)]; return a; })();

    saveState();
    statusEl.innerHTML = '<span style="color: var(--accent-light);">✓ Vault key pair created</span>';

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
  statusEl.textContent = 'Verifying Genesis Token + issuing credential...';

  setTimeout(() => {
    statusEl.innerHTML = '<span style="color: var(--accent-light);">✓ SAS Credential issued</span>';
    setTimeout(() => {
      statusEl.innerHTML += '<br><span style="color: var(--purple);">✓ Client NFT minted (soulbound)</span>';
      setTimeout(() => {
        state.enrolled = true;
        saveState();
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
  { recipient: 'Universitätsspital Zürich', town: 'Zürich', country: 'CH', amount: 'CHF 892.00', iban: 'CH62 0070 0110 0006 1425 8', ref: 'PAT-20260213' },
  { recipient: 'Boulangerie du Pont SA', town: 'Genève', country: 'CH', amount: 'CHF 234.00', iban: 'CH44 0026 0026 0100 0001 1', ref: 'CMD-2026-088' },
  { recipient: 'Schmidt & Partner GmbH', town: 'München', country: 'DE', amount: 'EUR 8,750.00', iban: 'DE89 3704 0044 0532 0130 00', ref: 'CONSUL-FEB26' },
];

function buildSealPayload(payment, txHash, deviceSignature) {
  return JSON.stringify({
    v: 1,
    type: 'ALPENSIGN_SEAL',
    schema: 'alpensign:seal:v1',
    payment_hash: txHash,
    device_sig: deviceSignature.substring(0, 64),
    auth: {
      method: 'BIOMETRIC_HARDWARE',
      channel: 'INDEPENDENT_DEVICE',
      device_type: state.deviceType,
    },
    recipient: {
      name: payment.recipient,
      town: payment.town,
      country: payment.country,
    },
    amount: payment.amount,
    iban: payment.iban,
    ref: payment.ref,
    ts: Math.floor(Date.now() / 1000),
  });
}

$('btnSimulateRequest').addEventListener('click', () => {
  const payment = samplePayments[Math.floor(Math.random() * samplePayments.length)];
  state.currentRequest = payment;

  $('notifBody').textContent = `${payment.amount} to ${payment.recipient}`;
  $('notification').classList.add('show');

  setTimeout(() => {
    $('notification').classList.remove('show');
  }, 5000);
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

  $('btnSeal').classList.remove('hidden');
  $('btnSeal').disabled = false;
  $('sealProgress').classList.add('hidden');
  $('sealResult').classList.add('hidden');
  $('sealBadge').textContent = 'Pending';
  $('sealBadge').className = 'status-badge badge-pending';
  $('sealPaymentCard').style.display = '';

  document.querySelectorAll('.seal-step').forEach(s => {
    s.classList.remove('active', 'done');
  });

  navigateTo('seal');
}
window.openSealRequest = openSealRequest;

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

    // Step 4: Post to Solana
    await activateStep(3);
    $('sealBadge').textContent = 'Posting...';

    const memoPayload = buildSealPayload(p, txHash, signature);
    let solanaTxId = null;
    let onChain = false;

    try {
      solanaTxId = await postMemoTransaction(memoPayload);
      onChain = true;
      console.log('✅ Real Solana TX:', solanaTxId);
    } catch (solanaErr) {
      console.warn('Solana TX failed, falling back to simulated:', solanaErr.message);
      const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
      solanaTxId = '';
      for (let i = 0; i < 88; i++) solanaTxId += chars[Math.floor(Math.random() * chars.length)];
    }

    // Step 5: Confirmed
    await activateStep(4);
    $(steps[3]).classList.remove('active');
    $(steps[3]).classList.add('done');

    $('sealBadge').textContent = onChain ? 'Sealed ✓' : 'Sealed (sim)';
    $('sealBadge').className = 'status-badge badge-enrolled';

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
    saveState();

    await new Promise(r => setTimeout(r, 600));

    btn.classList.add('hidden');
    $('sealProgress').classList.add('hidden');

    $('resultHash').textContent = txHash;
    $('resultSig').textContent = signature.substring(0, 80) + '...';
    $('resultTx').textContent = solanaTxId.substring(0, 44) + '...';
    $('resultTxConfirm').textContent = onChain ? 'CONFIRMED on Devnet ✓' : 'SIMULATED (no SOL balance)';
    $('resultTxConfirm').style.color = onChain ? 'var(--accent-light)' : 'var(--amber)';
    $('resultDeviceType').textContent = state.deviceType;
    $('resultChannel').textContent = state.deviceType === 'SOLANA_SEEKER' ? 'INDEPENDENT_DEVICE (Seed Vault)' : 'INDEPENDENT_DEVICE (WebAuthn)';
    $('resultTime').textContent = new Date().toISOString();

    state._lastTxId = solanaTxId;
    state._lastTxReal = onChain;

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
  if (state._lastTxId) {
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

$('btnAirdrop').addEventListener('click', async () => {
  const btn = $('btnAirdrop');
  btn.disabled = true;
  btn.textContent = '💧 Requesting airdrop...';

  const success = await requestAirdrop();
  if (success) {
    btn.textContent = '💧 Airdrop received ✓';
    btn.style.color = 'var(--accent-light)';
    updateSettingsView();
  } else {
    btn.textContent = '💧 Airdrop failed — try again';
    btn.style.color = 'var(--red)';
  }

  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = '💧 Request Devnet Airdrop (1 SOL)';
    btn.style.color = '';
  }, 3000);
});

$('btnReset').addEventListener('click', () => {
  if (confirm('Remove all keys and seal history? This cannot be undone.')) {
    localStorage.removeItem('alpensign_state');
    window.location.reload();
  }
});

// ============================================================
// INIT
// ============================================================

function init() {
  loadState();
  detectDevice();
  const solanaReady = initSolana();
  updateHeaderBadge();

  if (solanaReady) {
    console.log('Solana wallet:', solanaKeypair.publicKey.toBase58());
  }

  if (state.enrolled) {
    navigateTo('home');
  } else if (state.credId) {
    $('view-enroll').classList.add('active');
    $('enroll-1').classList.remove('active');
    $('enroll-2').classList.add('active');
    $('walletAddr').textContent = state.walletAddr;
  } else {
    $('view-enroll').classList.add('active');
  }
}

init();
