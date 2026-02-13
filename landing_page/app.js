// ============================================================
// AlpenSign v0.2.0 — Transaction Sealing for Banks
// Solana Seeker Hackathon Monolith · Q1 2026
// ============================================================

const RP_ID = window.location.hostname;

// ---- State ----
let state = {
  enrolled: false,
  credId: null,
  walletAddr: null,
  seals: [],
  currentRequest: null,
};

// ---- Helpers ----
const $ = (id) => document.getElementById(id);
const bufferify = (str) => Uint8Array.from(atob(str), c => c.charCodeAt(0));
const base64ify = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const hexify = (buf) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');

function generateWalletAddr() {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let addr = '';
  for (let i = 0; i < 44; i++) addr += chars[Math.floor(Math.random() * chars.length)];
  return addr;
}

function generateSolanaTx() {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let tx = '';
  for (let i = 0; i < 88; i++) tx += chars[Math.floor(Math.random() * chars.length)];
  return tx;
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

// ---- Persistence ----
function saveState() {
  localStorage.setItem('alpensign_state', JSON.stringify({
    enrolled: state.enrolled,
    credId: state.credId,
    walletAddr: state.walletAddr,
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
      state.seals = saved.seals || [];
    }
  } catch (e) {
    console.warn('State load failed', e);
  }
}

// ---- Navigation ----
function navigateTo(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const view = $(`view-${viewName}`);
  if (view) view.classList.add('active');

  const navItem = document.querySelector(`.nav-item[data-view="${viewName}"]`);
  if (navItem) navItem.classList.add('active');

  // Update view-specific content
  if (viewName === 'home') updateHomeView();
  if (viewName === 'history') updateHistoryView();
  if (viewName === 'settings') updateSettingsView();
}

// ---- Header Badge ----
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

// ---- Home View ----
function updateHomeView() {
  $('homeWallet').textContent = state.walletAddr ? state.walletAddr.slice(0, 8) + '...' + state.walletAddr.slice(-6) : '—';
  $('homeSealCount').textContent = state.seals.length;

  // Simulated SOL balance
  const solUsed = state.seals.length * 0.000005;
  const balance = Math.max(0, 0.01 - solUsed).toFixed(6);
  $('homeSolBalance').textContent = balance + ' SOL';

  // Recent seals
  const container = $('homeRecentSeals');
  if (state.seals.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">No seals yet</div></div>';
  } else {
    const recent = state.seals.slice(-3).reverse();
    container.innerHTML = recent.map(s => `
      <div class="history-item">
        <div class="history-icon">✅</div>
        <div class="history-details">
          <div class="history-recipient">${s.recipient}</div>
          <div class="history-time">${formatTime(s.timestamp)}</div>
        </div>
        <div>
          <div class="history-amount">${s.amount}</div>
          <div class="history-status">Sealed ✓</div>
        </div>
      </div>
    `).join('');
  }
}

// ---- History View ----
function updateHistoryView() {
  const container = $('historyList');
  $('historyCount').textContent = state.seals.length ? `${state.seals.length} seal${state.seals.length > 1 ? 's' : ''}` : '';

  if (state.seals.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">No seals recorded</div></div>';
    return;
  }

  container.innerHTML = state.seals.slice().reverse().map(s => `
    <div class="history-item">
      <div class="history-icon">✅</div>
      <div class="history-details">
        <div class="history-recipient">${s.recipient}</div>
        <div class="history-time">${formatTime(s.timestamp)}</div>
      </div>
      <div>
        <div class="history-amount">${s.amount}</div>
        <div class="history-status">Sealed ✓</div>
      </div>
    </div>
  `).join('');
}

// ---- Settings View ----
function updateSettingsView() {
  $('settingsUA').textContent = navigator.userAgent.substring(0, 60) + '...';
  $('settingsCredId').textContent = state.credId ? state.credId.substring(0, 24) + '...' : '—';
}

// ============================================================
// ENROLLMENT FLOW
// ============================================================

// Step 1: Initialize Vault (WebAuthn Create)
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
    state.walletAddr = generateWalletAddr();
    saveState();

    statusEl.innerHTML = '<span style="color: var(--accent-light);">✓ Vault key pair created</span>';

    // Advance to step 2 after brief delay
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

// Step 2: Simulate Bank Confirmation
$('btnSimulateBank').addEventListener('click', () => {
  const btn = $('btnSimulateBank');
  const statusEl = $('enrollStatus2');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Bank verifying...';
  statusEl.textContent = 'Verifying Genesis Token + issuing credential...';

  // Simulate bank verification delay
  setTimeout(() => {
    statusEl.innerHTML = '<span style="color: var(--accent-light);">✓ SAS Credential issued</span>';

    setTimeout(() => {
      statusEl.innerHTML += '<br><span style="color: var(--purple);">✓ Client NFT minted (soulbound)</span>';

      setTimeout(() => {
        state.enrolled = true;
        saveState();

        // Advance to step 3
        $('enroll-2').classList.remove('active');
        $('enroll-3').classList.add('active');
        updateHeaderBadge();
      }, 800);
    }, 1000);
  }, 1500);
});

// Step 3: Done — Go to Dashboard
$('btnEnrollDone').addEventListener('click', () => {
  navigateTo('home');
});

// ============================================================
// TRANSACTION SEALING FLOW
// ============================================================

// Sample payment requests for demo variety
const samplePayments = [
  { recipient: 'ABC GmbH', amount: 'CHF 10,500.00', iban: 'CH78 7838 3838 3823', ref: 'INV-2026-0042' },
  { recipient: 'Müller AG', amount: 'CHF 3,280.50', iban: 'CH93 0076 2011 6238 5295 7', ref: 'PO-2026-1187' },
  { recipient: 'Swiss Re Ltd', amount: 'CHF 47,000.00', iban: 'CH56 0483 5012 3456 7800 9', ref: 'PREM-Q1-2026' },
  { recipient: 'Café Sprüngli', amount: 'CHF 156.80', iban: 'CH12 0900 0000 1500 1234 5', ref: 'CATER-FEB-26' },
  { recipient: 'Kantonsspital ZH', amount: 'CHF 892.00', iban: 'CH62 0070 0110 0006 1425 8', ref: 'PAT-20260213' },
];

// Simulate incoming request
$('btnSimulateRequest').addEventListener('click', () => {
  const payment = samplePayments[Math.floor(Math.random() * samplePayments.length)];
  state.currentRequest = payment;

  // Show notification
  $('notifBody').textContent = `${payment.amount} to ${payment.recipient}`;
  $('notification').classList.add('show');

  // Auto-dismiss after 5s
  setTimeout(() => {
    $('notification').classList.remove('show');
  }, 5000);
});

// Open seal request from notification
function openSealRequest() {
  $('notification').classList.remove('show');

  if (!state.currentRequest) return;
  const p = state.currentRequest;

  // Populate seal view
  $('sealRecipient').textContent = p.recipient;
  $('sealAmount').textContent = p.amount;
  $('sealIban').textContent = p.iban;
  $('sealReference').textContent = p.ref;

  // Reset seal view state
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
// Expose to inline onclick
window.openSealRequest = openSealRequest;

// Seal with biometric
$('btnSeal').addEventListener('click', async () => {
  if (!state.credId) return;
  const btn = $('btnSeal');
  btn.disabled = true;

  // Show progress
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
    const txData = `${p.amount}|${p.recipient}|${p.iban}|${p.ref}|${Date.now()}`;
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

    // Step 4: Post to Solana (simulated)
    await activateStep(3);
    $('sealBadge').textContent = 'Posting...';

    // Simulate network delay
    await new Promise(r => setTimeout(r, 1200));
    const solanaTx = generateSolanaTx();

    // Step 5: Confirmed
    await activateStep(4);
    $(steps[3]).classList.remove('active');
    $(steps[3]).classList.add('done');

    $('sealBadge').textContent = 'Sealed ✓';
    $('sealBadge').className = 'status-badge badge-enrolled';

    // Save seal
    const seal = {
      recipient: p.recipient,
      amount: p.amount,
      iban: p.iban,
      ref: p.ref,
      hash: txHash,
      signature: signature.substring(0, 64) + '...',
      solanaTx: solanaTx,
      timestamp: Date.now(),
    };

    state.seals.push(seal);
    saveState();

    // Show result after delay
    await new Promise(r => setTimeout(r, 600));

    btn.classList.add('hidden');
    $('sealProgress').classList.add('hidden');

    $('resultHash').textContent = txHash;
    $('resultSig').textContent = signature.substring(0, 80) + '...';
    $('resultTx').textContent = solanaTx.substring(0, 32) + '...';
    $('resultTime').textContent = new Date().toISOString();
    $('sealResult').classList.remove('hidden');

  } catch (err) {
    console.error('Seal error:', err);
    $('sealBadge').textContent = 'Failed';
    $('sealBadge').className = 'status-badge';
    $('sealBadge').style.cssText = 'color: var(--red); border-color: var(--red);';
    btn.disabled = false;

    // Reset steps
    document.querySelectorAll('.seal-step').forEach(s => {
      s.classList.remove('active', 'done');
    });
    $('sealProgress').classList.add('hidden');
  }
});

// Open Solana explorer (simulated link)
function openSolanaExplorer() {
  const lastSeal = state.seals[state.seals.length - 1];
  if (lastSeal) {
    window.open(`https://explorer.solana.com/tx/${lastSeal.solanaTx}?cluster=devnet`, '_blank');
  }
}
window.openSolanaExplorer = openSolanaExplorer;

// ============================================================
// UTILITY
// ============================================================

// Copy wallet address
function copyWallet() {
  if (state.walletAddr && navigator.clipboard) {
    navigator.clipboard.writeText(state.walletAddr).then(() => {
      const el = $('walletDisplay');
      const hint = el.querySelector('.copy-hint');
      if (hint) {
        hint.textContent = 'Copied ✓';
        setTimeout(() => hint.textContent = 'Tap to copy', 2000);
      }
    });
  }
}
window.copyWallet = copyWallet;

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

function init() {
  loadState();
  updateHeaderBadge();

  if (state.enrolled) {
    // Show dashboard
    navigateTo('home');
  } else if (state.credId) {
    // Credential exists but not enrolled — show step 2
    $('view-enroll').classList.add('active');
    $('enroll-1').classList.remove('active');
    $('enroll-2').classList.add('active');
    $('walletAddr').textContent = state.walletAddr;
  } else {
    // Fresh start — show enrollment
    $('view-enroll').classList.add('active');
  }
}

init();
