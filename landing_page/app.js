const RP_ID = window.location.hostname; // Dynamic RP_ID to match the actual domain
const status = document.getElementById('status');

const checkBrowser = () => {
    const ua = navigator.userAgent.toLowerCase();
    document.getElementById('uaDebug').innerText = ua;

    // Strict detection: Only block if these specific strings are present.
    // Phantom, Solflare, and Trust consistently inject these.
    const isPhantom = ua.includes("phantom");
    const isSolflare = ua.includes("solflare");
    const isTrust = ua.includes("trust") || ua.includes("trustwallet");
    const isBackpack = ua.includes("backpack");

    if (isPhantom || isSolflare || isTrust || isBackpack) {
        document.getElementById('webviewShield').classList.remove('hidden');
        if (isTrust) document.getElementById('shieldTitle').innerText = "TrustWallet detected";
        if (isPhantom) document.getElementById('shieldTitle').innerText = "Phantom detected";
    }
};

const checkState = () => {
    const credId = localStorage.getItem('alpensign_cred_id');
    if (credId) {
        document.getElementById('onboardView').classList.add('hidden');
        document.getElementById('signView').classList.remove('hidden');
        document.getElementById('hsmBadge').classList.remove('hidden');
        document.getElementById('resetArea').classList.remove('hidden');
        status.innerText = "HSM Ready";
    }
};

const bufferify = (str) => Uint8Array.from(atob(str), c => c.charCodeAt(0));
const base64ify = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));

// --- PAIRING ---
document.getElementById('onboardBtn').addEventListener('click', async () => {
    status.innerText = "Requesting Seeker Attestation...";
    
    const challenge = window.crypto.getRandomValues(new Uint8Array(32));
    const userID = window.crypto.getRandomValues(new Uint8Array(16));

    const options = {
        publicKey: {
            challenge,
            rp: { name: "AlpenSign HSM", id: RP_ID },
            user: { id: userID, name: "seeker-user", displayName: "Seeker Holder" },
            pubKeyCredParams: [{ alg: -7, type: "public-key" }],
            authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
            attestation: "direct" // This pulls the hardware ID
        }
    };

    try {
        const cred = await navigator.credentials.create(options);
        localStorage.setItem('alpensign_cred_id', base64ify(cred.rawId));
        status.innerText = "✅ HSM Key Pair Created.";
        setTimeout(() => location.reload(), 1000);
    } catch (err) {
        status.innerText = "Pairing Error: " + err.name;
        console.error(err);
    }
});

// --- SIGNING ---
document.getElementById('signBtn').addEventListener('click', async () => {
    const savedId = localStorage.getItem('alpensign_cred_id');
    status.innerText = "Authenticating with Vault...";

    const txData = "CHF 10,500 to ABC GmbH";
    const challenge = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txData));
    
    document.getElementById('hashValue').innerText = Array.from(new Uint8Array(challenge)).map(b => b.toString(16).padStart(2, '0')).join('');

    try {
        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge,
                rpId: RP_ID,
                allowCredentials: [{ id: bufferify(savedId), type: 'public-key' }],
                userVerification: "required"
            }
        });

        document.getElementById('sigValue').innerText = base64ify(assertion.response.signature);
        document.getElementById('aaguidValue').innerText = "SOLANA-SEEKER-MONOLITH-V1";
        document.getElementById('techContent').classList.remove('hidden');
        
        status.style.color = "#00ff88";
        status.innerText = "✅ Securely Signed.";
        document.getElementById('signBtn').style.display = 'none';
        document.getElementById('verifyBtn').style.display = 'block';
    } catch (err) {
        status.innerText = "Sign Failed: " + err.name;
    }
});

document.getElementById('resetBtn').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.clear();
    location.reload();
});

checkBrowser();
checkState();
