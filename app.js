// VerifyOnce - Client-side Interactive Prototype
// DEMO ONLY: All cryptographic signatures, OTP verification, and DigiLocker responses
// are simulated client-side for demonstration purposes only.

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag] || tag));
}

// Real Cryptographic Signing & Verification Layer using Web Crypto API (crypto.subtle)
let issuerKeyPair = null;
let exportedPublicKeyBase64 = '';
let exportedPublicKeyHex = '';

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function arrayBufferToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function base64UrlEncode(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return decodeURIComponent(escape(atob(base64)));
}

function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlToBuffer(base64url) {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function initWebCrypto() {
  if (issuerKeyPair) return;
  issuerKeyPair = await window.crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256"
    },
    true,
    ["sign", "verify"]
  );

  const spkiBuffer = await window.crypto.subtle.exportKey("spki", issuerKeyPair.publicKey);
  exportedPublicKeyBase64 = arrayBufferToBase64(spkiBuffer);
  exportedPublicKeyHex = arrayBufferToHex(spkiBuffer);

  const keyDisplay = byId('publicKeyDisplay');
  if (keyDisplay) keyDisplay.textContent = exportedPublicKeyBase64;
}

async function signCredential(payload) {
  if (!issuerKeyPair) {
    await initWebCrypto();
  }
  const header = { alg: "ES256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signatureBuffer = await window.crypto.subtle.sign(
    {
      name: "ECDSA",
      hash: { name: "SHA-256" }
    },
    issuerKeyPair.privateKey,
    new TextEncoder().encode(signingInput)
  );

  const encodedSignature = bufferToBase64Url(signatureBuffer);
  const token = `${signingInput}.${encodedSignature}`;
  const signatureHex = arrayBufferToHex(signatureBuffer);
  const signatureBase64 = arrayBufferToBase64(signatureBuffer);

  return {
    token,
    signatureHex,
    signatureBase64,
    payload
  };
}

async function verifyCredential(token, expectedPhone = null) {
  try {
    if (!token || typeof token !== 'string') {
      return { valid: false, reason: "No proof token presented" };
    }
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, reason: "Malformed token structure (expected 3-part compact JWT)" };
    }
    const [headerB64, payloadB64, sigB64] = parts;
    const signingInput = `${headerB64}.${payloadB64}`;
    const signatureBuffer = base64UrlToBuffer(sigB64);

    let payload;
    try {
      payload = JSON.parse(base64UrlDecode(payloadB64));
    } catch (e) {
      return { valid: false, reason: "Invalid JSON in credential payload" };
    }

    if (!issuerKeyPair) {
      await initWebCrypto();
    }

    const isCryptoValid = await window.crypto.subtle.verify(
      {
        name: "ECDSA",
        hash: { name: "SHA-256" }
      },
      issuerKeyPair.publicKey,
      signatureBuffer,
      new TextEncoder().encode(signingInput)
    );

    if (!isCryptoValid) {
      return {
        valid: false,
        reason: "Cryptographic signature mismatch! The payload data was modified after signing (ECDSA verification failed).",
        payload
      };
    }

    if (expectedPhone && payload.citizen_id && payload.citizen_id !== expectedPhone) {
      return {
        valid: false,
        reason: `Identity mismatch: credential citizen_id (${payload.citizen_id}) does not match requested phone (${expectedPhone}).`,
        payload
      };
    }

    if (payload.expires_at && Date.now() > payload.expires_at) {
      return {
        valid: false,
        reason: "Credential has expired.",
        payload
      };
    }

    return {
      valid: true,
      reason: "Cryptographically verified using ECDSA P-256 / SHA-256",
      payload,
      signatureHex: arrayBufferToHex(signatureBuffer)
    };
  } catch (err) {
    return {
      valid: false,
      reason: `Verification error: ${err.message}`
    };
  }
}

function updateTechPanel(token, signatureHex, payload, isTampered = false) {
  if (byId('publicKeyDisplay')) byId('publicKeyDisplay').textContent = exportedPublicKeyBase64 || 'Generating...';
  if (byId('signatureDisplay')) byId('signatureDisplay').textContent = signatureHex || 'N/A';
  if (byId('payloadDisplay')) byId('payloadDisplay').textContent = payload ? JSON.stringify(payload, null, 2) : 'N/A';
  if (byId('jwtToken')) byId('jwtToken').textContent = token || '';
  if (byId('tamperStatus')) {
    if (isTampered) {
      byId('tamperStatus').textContent = 'Status: Tampered (Signature Mismatch!)';
      byId('tamperStatus').className = 'tech-badge tech-badge-danger';
    } else {
      byId('tamperStatus').textContent = 'Status: Signature Valid';
      byId('tamperStatus').className = 'tech-badge tech-badge-success';
    }
  }
}

const seedExpiry = new Date(Date.now() + 90 * 86400000);
const seed = {
  name: 'Meera Patel',
  phone: '9876543210',
  aadhaarNum: 'XXXX XXXX 8912',
  verifiedAt: Date.now() - 86400000 * 2,
  validUntil: seedExpiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
  verifiedBy: 'Ration Card Portal',
  documents: ['Aadhaar', 'Address proof']
};

const seedDuplicate = {
  name: 'Rohan Verma (Duplicate Test)',
  phone: '9123456780',
  aadhaarNum: 'XXXX XXXX 8912', // Reusing the same Aadhaar number as Meera Patel with a different phone
  verifiedAt: Date.now() - 86400000 * 5,
  validUntil: seedExpiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
  verifiedBy: 'Ration Card Portal',
  documents: ['Aadhaar', 'Address proof']
};

let vault = JSON.parse(localStorage.getItem('verifyOnceVault') || 'null') || [seed, seedDuplicate];
let consentLog = JSON.parse(localStorage.getItem('verifyOnceConsent') || 'null') || [];
let certApplications = JSON.parse(localStorage.getItem('verifyOnceCertApplications') || 'null') || [];

const byId = id => document.getElementById(id);

const persist = () => {
  localStorage.setItem('verifyOnceVault', JSON.stringify(vault));
  localStorage.setItem('verifyOnceConsent', JSON.stringify(consentLog));
  localStorage.setItem('verifyOnceCertApplications', JSON.stringify(certApplications));
  const countEl = byId('vaultCount');
  if (countEl) countEl.textContent = vault.length;
};

const showToast = (msg, isSuccess = true) => {
  const t = byId('toast');
  if (!t) return;
  byId('toastMsg').textContent = msg;
  t.className = isSuccess ? 'success show' : 'show';
  setTimeout(() => { t.className = ''; }, 3000);
};

const formatTime = (ts) => {
  const diff = Math.floor((Date.now() - ts) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff} min${diff > 1 ? 's' : ''} ago`;
  if (diff < 1440) {
    const h = Math.floor(diff / 60);
    return `${h} hr${h > 1 ? 's' : ''} ago`;
  }
  return new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

// Tab Navigation
document.querySelectorAll('.tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.tab, .view').forEach(x => x.classList.remove('active'));
    tab.classList.add('active');
    const viewEl = byId(tab.dataset.view);
    if (viewEl) viewEl.classList.add('active');
    if (tab.dataset.view === 'consent') renderConsent();
    if (tab.dataset.view === 'officer') renderOfficerDashboard();
  };
});

// File Inputs Label Sync
[['aadhaar', 'aadhaarName'], ['address', 'addressName']].forEach(([input, text]) => {
  const inputEl = byId(input);
  if (inputEl) {
    inputEl.onchange = e => {
      const textEl = byId(text);
      if (textEl) textEl.textContent = e.target.files[0]?.name || 'Upload a mock image or PDF';
    };
  }
});

// Step Navigation (Portal A)
let currentStep = 1;
const goToStep = (step) => {
  document.querySelectorAll('.step-container').forEach(el => el.classList.remove('active'));
  const target = byId(`step${step}`);
  if (target) target.classList.add('active');
  currentStep = step;
  const pBar = byId('pBar');
  const label = byId('stepLabel');
  if (!pBar || !label) return;
  if (step === 1) { pBar.style.width = '33%'; label.textContent = 'Step 1 of 3: Phone number'; }
  if (step === 2) { pBar.style.width = '66%'; label.textContent = 'Step 2 of 3: Verify OTP'; }
  if (step === 3) { pBar.style.width = '80%'; label.textContent = 'Step 3 of 3: Verification method'; }
  if (step === 4) { pBar.style.width = '100%'; label.textContent = 'Step 3 of 3: Complete verification'; }
};

// Wire up back buttons using data attributes
document.querySelectorAll('.back-btn[data-goto]').forEach(btn => {
  btn.onclick = () => goToStep(Number(btn.dataset.goto));
});

// Tech panel toggle
const techHeader = byId('techPanelHeader');
if (techHeader) {
  techHeader.onclick = () => {
    const tp = byId('techPanel');
    if (tp) tp.classList.toggle('open');
  };
}

// Phone & OTP Submission
let isSendingOtp = false;
const sendOtpBtn = byId('sendOtp');
if (sendOtpBtn) {
  sendOtpBtn.onclick = () => {
    if (isSendingOtp) return;
    isSendingOtp = true;
    setTimeout(() => { isSendingOtp = false; }, 2000);
    const phoneInput = byId('rPhone');
    const phone = phoneInput ? phoneInput.value.trim() : '';
    if (!/^\d{10}$/.test(phone)) {
      if (phoneInput) phoneInput.classList.add('error');
      const errEl = byId('phoneError');
      if (errEl) errEl.style.display = 'block';
      return;
    }
    if (phoneInput) phoneInput.classList.remove('error');
    const errEl = byId('phoneError');
    if (errEl) errEl.style.display = 'none';
    goToStep(2);
    showToast('OTP sent successfully');
  };
}

const otpInput = byId('otp');
if (otpInput) {
  otpInput.oninput = () => {
    if (otpInput.value === '123456') goToStep(3);
  };
}

const fetchDigiBtn = byId('fetchDigi');
if (fetchDigiBtn) {
  fetchDigiBtn.onclick = () => {
    byId('digiModal')?.classList.add('show');
  };
}

const denyDigiBtn = byId('denyDigi');
if (denyDigiBtn) {
  denyDigiBtn.onclick = () => {
    byId('digiModal')?.classList.remove('show');
    byId('manualEntry')?.click();
  };
}

const manualEntryBtn = byId('manualEntry');
if (manualEntryBtn) {
  manualEntryBtn.onclick = () => {
    goToStep(4);
    byId('extraFields')?.classList.add('hidden');
    byId('manualUploads')?.classList.remove('hidden');
    const aadhaarInput = byId('aadhaar');
    const addressInput = byId('address');
    if (aadhaarInput) aadhaarInput.required = true;
    if (addressInput) addressInput.required = true;

    const rNameInput = byId('rName');
    if (rNameInput) rNameInput.value = '';
    const aadhaarNumInput = byId('aadhaarNum');
    if (aadhaarNumInput) aadhaarNumInput.value = '';
    ['nameBadge', 'dobBadge', 'addressBadge', 'aadhaarNumBadge'].forEach(id => byId(id)?.classList.add('hidden'));
  };
}

const allowDigiBtn = byId('allowDigi');
if (allowDigiBtn) {
  allowDigiBtn.onclick = () => {
    byId('digiModal')?.classList.remove('show');
    byId('rationForm')?.classList.add('hidden');
    byId('rProgress')?.classList.add('hidden');

    const ver = byId('verifying');
    if (ver) ver.style.display = 'block';
    const loadMsg = byId('loadMsg');
    if (loadMsg) loadMsg.textContent = ' Fetching from DigiLocker…';

    setTimeout(() => {
      goToStep(4);
      if (byId('rName')) byId('rName').value = 'Anjali Sharma';
      if (byId('aadhaarNum')) byId('aadhaarNum').value = 'XXXX XXXX 8912';
      if (byId('dob')) byId('dob').value = '1996-04-18';
      if (byId('addressText')) byId('addressText').value = '12, Shanti Nagar, Pune, Maharashtra';

      ['nameBadge', 'aadhaarNumBadge', 'dobBadge', 'addressBadge'].forEach(id => byId(id)?.classList.remove('hidden'));
      byId('manualUploads')?.classList.add('hidden');
      byId('extraFields')?.classList.remove('hidden');

      if (byId('aadhaar')) byId('aadhaar').required = false;
      if (byId('address')) byId('address').required = false;

      if (ver) ver.style.display = 'none';
      byId('rationForm')?.classList.remove('hidden');
      byId('rProgress')?.classList.remove('hidden');

      showToast('Details fetched securely');
    }, 2000);
  };
}

// Submit Portal A Form
const rationForm = byId('rationForm');
if (rationForm) {
  rationForm.onsubmit = e => {
    e.preventDefault();
    const phone_val = byId('rPhone')?.value.trim() || '';
    const isDigilocker = !byId('extraFields')?.classList.contains('hidden');
    const aadhaar_val = byId('aadhaarNum')?.value.trim() || (isDigilocker ? 'XXXX XXXX 8912' : '');

    const dupAlert = byId('duplicateAlert');
    if (dupAlert) {
      dupAlert.classList.add('hidden');
      dupAlert.innerHTML = '';
    }

    // FEATURE 2: Duplicate Identity Detection
    // Check if this Aadhaar number already exists in the vault under a DIFFERENT phone number
    const normalizeAadhaar = (num) => String(num || '').replace(/\s+/g, '').toUpperCase();
    if (aadhaar_val) {
      const duplicateCitizen = vault.find(v => 
        v.phone !== phone_val && 
        v.aadhaarNum && 
        normalizeAadhaar(v.aadhaarNum) === normalizeAadhaar(aadhaar_val)
      );

      if (duplicateCitizen) {
        if (dupAlert) {
          dupAlert.innerHTML = `
            <div class="duplicate-warning-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              <span>⚠️ Possible duplicate identity detected — this Aadhaar number is already linked to another account. Verification blocked for review.</span>
            </div>
            <div class="duplicate-warning-sub">
              This Aadhaar is already registered to <b>${escapeHTML(duplicateCitizen.name)} (${escapeHTML(duplicateCitizen.phone)})</b>. Multiple citizen registrations with identical national IDs are prevented.
            </div>
          `;
          dupAlert.classList.remove('hidden');
        }
        showToast('⚠️ Duplicate identity detected — verification blocked!', false);
        return; // Halt and block verification
      }
    }

    byId('rationForm')?.classList.add('hidden');
    byId('rProgress')?.classList.add('hidden');

    const ver = byId('verifying');
    if (ver) ver.style.display = 'block';
    const loadMsg = byId('loadMsg');
    if (loadMsg) loadMsg.textContent = ' Checking documents & cryptographically signing credential…';

    setTimeout(async () => {
      const docs_val = isDigilocker ? ['Aadhaar Card', 'PAN Record', 'Driving License', 'Address proof'] : ['Aadhaar', 'Address proof'];

      const expiry = new Date(Date.now() + 90 * 86400000);
      const newPerson = {
        name: byId('rName')?.value.trim() || '',
        phone: phone_val,
        aadhaarNum: aadhaar_val || 'XXXX XXXX 8912',
        verifiedAt: Date.now(),
        validUntil: expiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        verifiedBy: 'Ration Card Portal',
        documents: docs_val
      };

      const payload = {
        citizen_id: phone_val,
        verified_by: newPerson.verifiedBy,
        verified_at: newPerson.verifiedAt,
        expires_at: expiry.getTime()
      };

      const signed = await signCredential(payload);
      newPerson.proofToken = signed.token;
      newPerson.proofSignature = signed.signatureHex;

      const action = () => {
        vault = vault.filter(v => v.phone !== phone_val);
        vault.push(newPerson);
        persist();
      };

      if (offline) {
        addOfflineAction('Verify identity for ' + newPerson.name, action);
      } else {
        action();
      }

      updateTechPanel(signed.token, signed.signatureHex, payload, false);
      if (ver) ver.style.display = 'none';
      const successBox = byId('rationSuccess');
      if (successBox) successBox.style.display = 'block';
      showToast('Identity verified and signed cryptographically (ECDSA P-256)');
    }, 2000);
  };
}

// Portal B (Scholarship)
const trySampleBtn = byId('trySample');
if (trySampleBtn) {
  trySampleBtn.onclick = () => {
    if (byId('sPhone')) byId('sPhone').value = seed.phone;
    checkVault();
  };
}

const checkVaultBtn = byId('checkVault');
if (checkVaultBtn) {
  checkVaultBtn.onclick = checkVault;
}

async function checkVault() {
  const phone = byId('sPhone')?.value.trim() || '';
  const person = vault.find(v => v.phone === phone);

  if (byId('reuseBanner')) byId('reuseBanner').style.display = 'none';
  if (byId('fallback')) byId('fallback').style.display = 'none';
  if (byId('appDone')) byId('appDone').style.display = 'none';

  if (!phone) {
    byId('sPhone')?.focus();
    return;
  }

  if (person) {
    if (person.revoked) {
      if (byId('fallbackTitle')) byId('fallbackTitle').textContent = 'Verification revoked';
      if (byId('fallbackSub')) byId('fallbackSub').textContent = 'Verification revoked — please re-verify.';
      if (byId('fallback')) byId('fallback').style.display = 'block';
      return;
    }

    if (byId('sValidating')) {
      byId('sValidating').innerHTML = '<div class="spinner"></div> Cryptographically validating ECDSA signature...';
      byId('sValidating').style.display = 'flex';
    }
    if (byId('checkVault')) byId('checkVault').style.display = 'none';

    // Real cryptographic signature check via Web Crypto API
    const verification = await verifyCredential(person.proofToken, person.phone);

    setTimeout(() => {
      if (byId('sValidating')) byId('sValidating').style.display = 'none';
      if (byId('checkVault')) byId('checkVault').style.display = 'inline-flex';

      if (verification.valid) {
        if (byId('reuseText')) {
          byId('reuseText').innerHTML = `<b class="citizen-highlight">${escapeHTML(person.name)}'s</b> identity was verified via <b>${escapeHTML(person.verifiedBy)}</b> on ${new Date(person.verifiedAt).toLocaleDateString('en-IN')}. Valid until ${escapeHTML(person.validUntil)}.<div class="tech-badge tech-badge-success mt-20">✓ ECDSA P-256 Signature Verified (Web Crypto API)</div>`;
        }

        const banner = byId('reuseBanner');
        if (banner) {
          banner.style.display = 'block';
          banner.classList.remove('celebrate');
          void banner.offsetWidth;
          banner.classList.add('celebrate');
        }

        const useBtn = byId('useIdentity');
        if (useBtn) useBtn.dataset.phone = phone;
      } else {
        // Tamper detected or invalid signature
        if (byId('fallbackTitle')) byId('fallbackTitle').textContent = '❌ Verification Failed: Signature Invalid';
        if (byId('fallbackSub')) {
          byId('fallbackSub').innerHTML = `<strong>Tampering Detected:</strong> Web Crypto signature verification failed.<br><span class="text-danger">${escapeHTML(verification.reason)}</span>`;
        }
        if (byId('fallback')) byId('fallback').style.display = 'block';
        showToast('Cryptographic signature verification failed: Tampered proof!', false);
      }
    }, 600);
  } else {
    if (byId('fallbackTitle')) byId('fallbackTitle').textContent = 'Identity not found in shared vault';
    if (byId('fallbackSub')) byId('fallbackSub').textContent = 'Please upload your Aadhaar and address proof to continue.';
    if (byId('fallback')) byId('fallback').style.display = 'block';
  }
}

const useIdentityBtn = byId('useIdentity');
if (useIdentityBtn) {
  useIdentityBtn.onclick = () => byId('consentModal')?.classList.add('show');
}
const denyConsentBtn = byId('denyConsent');
if (denyConsentBtn) {
  denyConsentBtn.onclick = () => byId('consentModal')?.classList.remove('show');
}

const allowConsentBtn = byId('allowConsent');
if (allowConsentBtn) {
  allowConsentBtn.onclick = () => {
    const phone = byId('useIdentity')?.dataset.phone;
    const person = vault.find(v => v.phone === phone);
    if (!person) return;

    const action = () => {
      consentLog.unshift({
        name: person.name,
        phone,
        usedBy: 'Scholarship Portal',
        source: person.verifiedBy,
        date: Date.now(),
        scope: 'Identity verified, address verified, validity date'
      });
      persist();
      renderConsent();
    };

    if (offline) {
      addOfflineAction('Scholarship Consent for ' + person.name, action);
    } else {
      action();
    }

    byId('consentModal')?.classList.remove('show');
    if (byId('reuseBanner')) byId('reuseBanner').style.display = 'none';
    if (byId('appDone')) byId('appDone').style.display = 'block';
    showToast('Consent granted for reuse');
  };
}

// Portal C (PDS Rural)
const pdsTrySampleBtn = byId('pdsTrySample');
if (pdsTrySampleBtn) {
  pdsTrySampleBtn.onclick = () => {
    if (byId('pPhone')) byId('pPhone').value = seed.phone;
    checkPdsVault();
  };
}

const pdsCheckVaultBtn = byId('pdsCheckVault');
if (pdsCheckVaultBtn) {
  pdsCheckVaultBtn.onclick = checkPdsVault;
}

function checkPdsVault() {
  const phone = byId('pPhone')?.value.trim() || '';
  if (!phone) {
    byId('pPhone')?.focus();
    return;
  }

  if (byId('pdsReuseBanner')) byId('pdsReuseBanner').style.display = 'none';
  if (byId('pdsFallback')) byId('pdsFallback').style.display = 'none';
  if (byId('pdsDone')) byId('pdsDone').style.display = 'none';
  if (byId('pdsVerifying')) byId('pdsVerifying').style.display = 'block';
  if (byId('pdsCheckVault')) byId('pdsCheckVault').style.display = 'none';

  setTimeout(async () => {
    if (byId('pdsVerifying')) byId('pdsVerifying').style.display = 'none';

    const person = vault.find(v => v.phone === phone);
    if (person) {
      if (person.revoked) {
        if (byId('pdsCheckVault')) byId('pdsCheckVault').style.display = 'inline-flex';
        if (byId('pdsFallbackTitle')) byId('pdsFallbackTitle').textContent = 'Verification revoked';
        if (byId('pdsFallbackSub')) byId('pdsFallbackSub').textContent = 'Verification revoked — please re-verify.';
        if (byId('pdsFallback')) byId('pdsFallback').style.display = 'block';
        return;
      }

      const validating = document.createElement('div');
      validating.className = 'validating-step';
      validating.style.display = 'flex';
      validating.style.margin = '0 0 24px 0';
      validating.innerHTML = '<div class="spinner"></div> Cryptographically validating ECDSA signature...';
      byId('pdsCheckVault')?.parentElement.insertBefore(validating, byId('pdsReuseBanner'));

      // Real signature verification
      const verification = await verifyCredential(person.proofToken, person.phone);

      setTimeout(() => {
        validating.remove();
        if (byId('pdsCheckVault')) byId('pdsCheckVault').style.display = 'inline-flex';

        if (verification.valid) {
          if (byId('pdsReuseText')) {
            byId('pdsReuseText').innerHTML = `<b>${escapeHTML(person.name)}'s</b> identity was verified by <b>${escapeHTML(person.verifiedBy)}</b>.<br><span class="tech-badge tech-badge-success" style="margin-top:6px;">✓ ECDSA Signature Verified</span>`;
          }
          const banner = byId('pdsReuseBanner');
          if (banner) {
            banner.style.display = 'block';
            banner.classList.remove('celebrate');
            void banner.offsetWidth;
            banner.classList.add('celebrate');
          }
          const useBtn = byId('pdsUseIdentity');
          if (useBtn) useBtn.dataset.phone = phone;
        } else {
          // Signature invalid / tampered
          if (byId('pdsFallbackTitle')) byId('pdsFallbackTitle').textContent = '❌ Signature Verification Failed';
          if (byId('pdsFallbackSub')) byId('pdsFallbackSub').innerHTML = `Tamper detected: Web Crypto verification failed.<br><span class="text-danger">${escapeHTML(verification.reason)}</span>`;
          if (byId('pdsFallback')) byId('pdsFallback').style.display = 'block';
          showToast('PDS verification failed: Tampered proof!', false);
        }
      }, 700);
    } else {
      if (byId('pdsCheckVault')) byId('pdsCheckVault').style.display = 'inline-flex';
      if (byId('pdsFallbackTitle')) byId('pdsFallbackTitle').textContent = 'No identity found.';
      if (byId('pdsFallbackSub')) byId('pdsFallbackSub').textContent = 'Cannot proceed without documents.';
      if (byId('pdsFallback')) byId('pdsFallback').style.display = 'block';
    }
  }, 1200);
}

const pdsUseIdentityBtn = byId('pdsUseIdentity');
if (pdsUseIdentityBtn) {
  pdsUseIdentityBtn.onclick = () => {
    const phone = byId('pdsUseIdentity')?.dataset.phone;
    const person = vault.find(v => v.phone === phone);
    if (!person) return;

    const action = () => {
      consentLog.unshift({
        name: person.name,
        phone,
        usedBy: 'PDS Portal (Rural)',
        source: person.verifiedBy,
        date: Date.now(),
        scope: 'Verified identity'
      });
      persist();
      renderConsent();
    };

    if (offline) {
      addOfflineAction('PDS Consent for ' + person.name, action);
    } else {
      action();
    }
    if (byId('pdsReuseBanner')) byId('pdsReuseBanner').style.display = 'none';
    if (byId('pdsDone')) byId('pdsDone').style.display = 'block';
    showToast('Identity securely reused on low bandwidth');
  };
}

// Portal D (Certificate Portal)
let certAppInterval;
const certTrySampleBtn = byId('certTrySample');
if (certTrySampleBtn) {
  certTrySampleBtn.onclick = () => {
    if (byId('cPhone')) byId('cPhone').value = '9876543210';
    byId('cCheckVault')?.click();
  };
}

const cCheckVaultBtn = byId('cCheckVault');
if (cCheckVaultBtn) {
  cCheckVaultBtn.onclick = async () => {
    const phone = byId('cPhone')?.value.trim() || '';
    const person = vault.find(v => v.phone === phone);

    if (byId('cFallback')) byId('cFallback').style.display = 'none';

    if (!phone) {
      byId('cPhone')?.focus();
      return;
    }

    if (person && !person.revoked) {
      if (byId('cValidating')) {
        byId('cValidating').innerHTML = '<div class="spinner"></div> Cryptographically validating ECDSA signature...';
        byId('cValidating').style.display = 'flex';
      }
      if (byId('cCheckVault')) byId('cCheckVault').style.display = 'none';

      // Real signature verification
      const verification = await verifyCredential(person.proofToken, person.phone);

      setTimeout(() => {
        if (byId('cValidating')) byId('cValidating').style.display = 'none';

        if (verification.valid) {
          if (byId('certStep1')) byId('certStep1').style.display = 'none';

          if (byId('cIdentText')) {
            byId('cIdentText').innerHTML = `<b class="citizen-highlight">${escapeHTML(person.name)}'s</b> identity (via ${escapeHTML(person.verifiedBy)}) is instantly reused.<br><span class="tech-badge tech-badge-success" style="margin-top:6px;">✓ ECDSA Signature Verified</span>`;
          }
          if (byId('certStep2')) byId('certStep2').style.display = 'block';

          const action = () => {
            consentLog.unshift({
              name: person.name,
              phone,
              usedBy: 'Certificate Portal',
              source: person.verifiedBy,
              date: Date.now(),
              scope: 'Identity verified'
            });
            persist();
            renderConsent();
          };

          if (offline) {
            addOfflineAction('Certificate Consent for ' + person.name, action);
          } else {
            action();
          }
        } else {
          if (byId('cCheckVault')) byId('cCheckVault').style.display = 'inline-flex';
          if (byId('cFallback')) {
            byId('cFallback').innerHTML = `<h3 class="text-danger">❌ Signature Verification Failed</h3><p>Tampering detected! The stored proof signature does not match the claims data.</p><p class="text-danger" style="font-size:12px;">${escapeHTML(verification.reason)}</p>`;
            byId('cFallback').style.display = 'block';
          }
          showToast('Certificate portal: Cryptographic verification failed!', false);
        }
      }, 700);
    } else {
      if (byId('cFallback')) byId('cFallback').style.display = 'block';
      if (byId('cCheckVault')) byId('cCheckVault').style.display = 'inline-flex';
    }
  };
}

const certForm = byId('certForm');
if (certForm) {
  certForm.onsubmit = e => {
    e.preventDefault();
    if (byId('certStep2')) byId('certStep2').style.display = 'none';
    if (byId('certStep3')) byId('certStep3').style.display = 'block';

    const appId = 'CERT-' + Math.floor(Math.random() * 1000000);
    if (byId('cAppId')) byId('cAppId').textContent = appId;
    if (byId('cDate')) byId('cDate').textContent = new Date().toLocaleDateString('en-IN');

    // Register application for Officer Dashboard
    const cPhoneVal = byId('cPhone')?.value.trim() || '9876543210';
    const applicant = vault.find(v => v.phone === cPhoneVal) || { name: 'Meera Patel', phone: cPhoneVal };
    const certType = byId('certType')?.value || 'Income Certificate';

    certApplications.unshift({
      appId,
      name: applicant.name,
      phone: applicant.phone,
      type: certType,
      date: Date.now(),
      status: 'Under Review',
      daysRemaining: '15 days',
      escalated: false
    });
    localStorage.setItem('verifyOnceCertApplications', JSON.stringify(certApplications));
    renderOfficerDashboard();

    const slaBox = byId('slaBox');
    if (slaBox) slaBox.className = 'sla-box';
    const slaTimer = byId('slaTimer');
    if (slaTimer) {
      slaTimer.className = 'sla-timer';
      slaTimer.textContent = '15 days 00:00:00';
    }
    if (byId('fastForwardBtn')) byId('fastForwardBtn').style.display = 'inline-flex';
    if (byId('reviewSpinner')) byId('reviewSpinner').style.display = 'block';
    if (byId('escalatedIcon')) byId('escalatedIcon').style.display = 'none';

    const statusText = byId('statusText');
    if (statusText) {
      statusText.textContent = 'Under Review';
      statusText.className = 'status-text-under-review';
    }
    const statusSub = byId('statusSub');
    if (statusSub) statusSub.innerHTML = 'Awaiting official approval';

    let timeRemaining = 15 * 86400;
    clearInterval(certAppInterval);

    const updateTimer = () => {
      if (timeRemaining <= 0) {
        clearInterval(certAppInterval);
        triggerEscalation(appId);
        return;
      }
      const d = Math.floor(timeRemaining / 86400);
      const h = Math.floor((timeRemaining % 86400) / 3600);
      const m = Math.floor((timeRemaining % 3600) / 60);
      const s = timeRemaining % 60;
      if (slaTimer) slaTimer.textContent = `${d} days ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      timeRemaining--;
    };

    certAppInterval = setInterval(updateTimer, 1000);
    updateTimer();
  };
}

const fastForwardBtn = byId('fastForwardBtn');
if (fastForwardBtn) {
  fastForwardBtn.onclick = () => {
    clearInterval(certAppInterval);
    const appId = byId('cAppId')?.textContent || '';
    triggerEscalation(appId);
  };
}

let escalations = JSON.parse(localStorage.getItem('verifyOnceEscalations') || 'null') || [];

function triggerEscalation(appId) {
  const slaBox = byId('slaBox');
  if (slaBox) slaBox.className = 'sla-box sla-box-breached';
  const slaTimer = byId('slaTimer');
  if (slaTimer) {
    slaTimer.textContent = 'SLA Breached';
    slaTimer.className = 'sla-timer sla-timer-breached';
  }
  if (byId('fastForwardBtn')) byId('fastForwardBtn').style.display = 'none';

  if (byId('reviewSpinner')) byId('reviewSpinner').style.display = 'none';
  if (byId('escalatedIcon')) byId('escalatedIcon').style.display = 'grid';

  const statusText = byId('statusText');
  if (statusText) {
    statusText.textContent = 'Escalated to District Officer';
    statusText.className = 'status-text-escalated';
  }
  const statusSub = byId('statusSub');
  if (statusSub) statusSub.innerHTML = '⚠️ SLA missed. Auto-escalated.';

  const type = byId('certType')?.value || 'Certificate';
  escalations.unshift({
    appId,
    type,
    date: Date.now(),
    status: 'Escalated to DO'
  });
  localStorage.setItem('verifyOnceEscalations', JSON.stringify(escalations));

  // Update in certApplications for Officer Dashboard
  const targetApp = certApplications.find(a => a.appId === appId);
  if (targetApp) {
    targetApp.status = 'Escalated to District Officer';
    targetApp.daysRemaining = 'SLA Breached';
    targetApp.escalated = true;
  } else {
    certApplications.unshift({
      appId,
      name: 'Meera Patel',
      phone: '9876543210',
      type,
      date: Date.now(),
      status: 'Escalated to District Officer',
      daysRemaining: 'SLA Breached',
      escalated: true
    });
  }
  localStorage.setItem('verifyOnceCertApplications', JSON.stringify(certApplications));

  renderEscalations();
  renderOfficerDashboard();
}

function renderEscalations() {
  const node = byId('escalationList');
  if (!node) return;
  node.innerHTML = escalations.length ? escalations.map(x => `
    <div class="consent-row">
      <div class="consent-icon escalation-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg></div>
      <div style="flex:1">
        <b class="escalation-title">${escapeHTML(x.appId)} - ${escapeHTML(x.type)}</b>
        <p class="escalation-desc">Status: ${escapeHTML(x.status)} · 15-day SLA Breached</p>
      </div>
      <span class="date escalation-date">${formatTime(x.date)}</span>
    </div>
  `).join('') : `
    <div class="empty">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      <p style="font-size:16px;font-weight:500;color:var(--navy)">No escalations yet.</p>
      <p>Applications that breach their SLA will appear here.</p>
    </div>
  `;
}

// Consent & Revocation
function revokeVerification(phone) {
  const person = vault.find(v => v.phone === phone);
  if (person) {
    person.revoked = true;
    persist();
    renderConsent();
    showToast('Verification revoked successfully');
  }
}

// Event delegation for active proofs revocation (CSP safe)
const activeProofsContainer = byId('activeProofsList');
if (activeProofsContainer) {
  activeProofsContainer.onclick = e => {
    const btn = e.target.closest('.revoke-btn');
    if (btn && btn.dataset.phone) {
      revokeVerification(btn.dataset.phone);
    }
  };
}

function renderConsent() {
  const activeNode = byId('activeProofsList');
  if (activeNode) {
    const activeProofs = vault.filter(v => !v.revoked);
    activeNode.innerHTML = activeProofs.length ? activeProofs.map(x => `
      <div class="consent-row">
        <div class="consent-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        <div style="flex:1">
          <b>${escapeHTML(x.verifiedBy)}</b>
          <p>Verified on ${new Date(x.verifiedAt).toLocaleDateString('en-IN')} · Valid until ${escapeHTML(x.validUntil)}</p>
          ${x.proofToken ? `<div class="active-proof-token">Token: ${escapeHTML(x.proofToken.substring(0, 40))}...</div>` : ''}
        </div>
        <div>
          <button class="revoke-btn" data-phone="${escapeHTML(x.phone)}">Revoke my verification</button>
        </div>
      </div>
    `).join('') : `
      <div class="empty" style="padding:20px;">
        <p style="margin:0;font-size:14px;color:var(--muted)">No active verifications found.</p>
      </div>
    `;
  }

  const node = byId('consentList');
  if (node) {
    node.innerHTML = consentLog.length ? consentLog.map(x => `
      <div class="consent-row">
        <div class="consent-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        <div>
          <b>Your identity was shared with ${escapeHTML(x.usedBy)}</b>
          <p>Using verification from ${escapeHTML(x.source)} · ${escapeHTML(x.scope) || 'Verified identity'} · ${escapeHTML(x.name)} (${escapeHTML(x.phone)})</p>
        </div>
        <span class="date">${formatTime(x.date)}</span>
      </div>
    `).join('') : `
      <div class="empty">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <p style="font-size:16px;font-weight:500;color:var(--navy)">No identity reuse yet.</p>
        <p>When you approve a portal to use your verified identity, it will appear here.</p>
      </div>
    `;
  }
}

// Offline Queue
let offlineQueue = [];
function addOfflineAction(description, actionFn) {
  offlineQueue.push({ description, actionFn });
  renderOfflineQueue();
  showToast('Action saved for offline sync', false);
}

function renderOfflineQueue() {
  const list = byId('offlineQueueList');
  const container = byId('offlineQueueContainer');
  if (!list || !container) return;
  list.innerHTML = offlineQueue.map(q => `<li>${escapeHTML(q.description)} <span class="sync-status">(Pending)</span></li>`).join('');
  container.style.display = offlineQueue.length > 0 ? 'block' : 'none';
}

let offline = false;
const offlineToggleBtn = byId('offlineToggle');
if (offlineToggleBtn) {
  offlineToggleBtn.onclick = () => {
    offline = !offline;
    offlineToggleBtn.innerHTML = offline ?
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path><path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg> Offline' :
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path><path d="M2 12h20"></path></svg> Online';
    offlineToggleBtn.style.color = offline ? '#92400e' : '';
    offlineToggleBtn.style.background = offline ? '#fde68a' : '';
    if (byId('offlineNote')) byId('offlineNote').style.display = offline ? 'flex' : 'none';

    if (!offline && offlineQueue.length > 0) {
      const listItems = byId('offlineQueueList')?.querySelectorAll('li');
      if (listItems) {
        listItems.forEach(li => {
          const stat = li.querySelector('.sync-status');
          if (stat) {
            stat.textContent = '(Processing...)';
            stat.className = 'sync-status sync-processing';
          }
        });
      }
      setTimeout(() => {
        offlineQueue.forEach(q => q.actionFn());
        if (listItems) {
          listItems.forEach(li => {
            const stat = li.querySelector('.sync-status');
            if (stat) {
              stat.textContent = '(Synced ✓)';
              stat.className = 'sync-status sync-done';
            }
          });
        }
        showToast('All offline actions synced!');
        setTimeout(() => {
          offlineQueue = [];
          renderOfflineQueue();
        }, 2000);
      }, 1500);
    }
  };
}

// CSC Mode
let currentCscPhone = '';
const cscLookupBtn = byId('cscLookup');
if (cscLookupBtn) {
  cscLookupBtn.onclick = async () => {
    const phone = byId('cscPhone')?.value.trim() || '';
    const p = vault.find(x => x.phone === phone);
    const n = byId('cscResult');
    if (!n) return;
    if (p && p.revoked) {
      n.style.display = 'block';
      n.innerHTML = '<span class="csc-denied-notice">Verification revoked — please re-verify.</span>';
      return;
    }
    if (p) {
      const verification = await verifyCredential(p.proofToken, p.phone);
      if (!verification.valid) {
        n.style.display = 'block';
        n.innerHTML = `<span class="csc-denied-notice">❌ Verification Failed: Signature mismatch! Altered proof detected.<br><small>${escapeHTML(verification.reason)}</small></span>`;
        showToast('CSC Lookup: Cryptographic verification failed!', false);
        return;
      }
      currentCscPhone = phone;
      byId('cscCitizenModal')?.classList.add('show');
    } else {
      n.style.display = 'block';
      n.innerHTML = 'No verified identity found. Help the citizen complete the Ration Card verification.';
    }
  };
}

const cscDenyConsentBtn = byId('cscDenyConsent');
if (cscDenyConsentBtn) {
  cscDenyConsentBtn.onclick = () => {
    byId('cscCitizenModal')?.classList.remove('show');
    const n = byId('cscResult');
    if (n) {
      n.style.display = 'block';
      n.innerHTML = '<span class="csc-denied-notice">Citizen denied the request.</span>';
    }
  };
}

const cscAllowConsentBtn = byId('cscAllowConsent');
if (cscAllowConsentBtn) {
  cscAllowConsentBtn.onclick = () => {
    byId('cscCitizenModal')?.classList.remove('show');
    const p = vault.find(x => x.phone === currentCscPhone);
    if (!p) return;

    const action = () => {
      consentLog.unshift({
        name: p.name,
        phone: currentCscPhone,
        usedBy: 'CSC Operator',
        source: p.verifiedBy,
        date: Date.now(),
        scope: 'Verified identity'
      });
      persist();
      renderConsent();
      const n = byId('cscResult');
      if (n) {
        n.style.display = 'block';
        n.innerHTML = `<span class="csc-verified-header"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> ${escapeHTML(p.name)} is verified</span>Valid until ${escapeHTML(p.validUntil)}.`;
      }
    };

    if (offline) {
      addOfflineAction('CSC Consent for ' + p.name, action);
      const n = byId('cscResult');
      if (n) {
        n.style.display = 'block';
        n.innerHTML = `<span class="csc-offline-notice">Consent saved locally. Will sync when online.</span>`;
      }
    } else {
      action();
    }
  };
}

// Language / Translation Support
const dict = {
  "Ration Card Portal": "राशन कार्ड पोर्टल",
  "Scholarship Portal": "छात्रवृत्ति पोर्टल",
  "🌾 PDS Portal (Rural)": "🌾 पीडीएस पोर्टल (ग्रामीण)",
  "Certificate Portal": "प्रमाणपत्र पोर्टल",
  "My consent log": "मेरा सहमति लॉग",
  "Escalation log": "वृद्धि लॉग",
  "CSC assisted mode": "सीएससी सहायता मोड",
  "Verify your identity": "अपनी पहचान सत्यापित करें",
  "Start scholarship application": "छात्रवृत्ति आवेदन शुरू करें",
  "Get your Ration": "अपना राशन प्राप्त करें",
  "Apply for Certificate": "प्रमाणपत्र के लिए आवेदन करें",
  "Escalation Log": "वृद्धि लॉग",
  "Your consent, clearly recorded": "आपकी सहमति, स्पष्ट रूप से दर्ज",
  "Active verifications": "सक्रिय सत्यापन",
  "Consent activity": "सहमति गतिविधि",
  "Help a citizen reuse verification": "नागरिक को सत्यापन का पुन: उपयोग करने में मदद करें",
  "Send OTP": "OTP भेजें",
  "Verify documents": "दस्तावेज़ सत्यापित करें",
  "Fetch details from DigiLocker": "DigiLocker से विवरण प्राप्त करें",
  "Check verification": "सत्यापन जांचें",
  "Review and use verified identity": "सत्यापित पहचान की समीक्षा करें और उपयोग करें",
  "Check Verified Identity": "सत्यापित पहचान जांचें",
  "Use Identity Now": "अब पहचान का उपयोग करें",
  "Verify Identity": "पहचान सत्यापित करें",
  "Submit Application": "आवेदन जमा करें",
  "Find verified identity": "सत्यापित पहचान खोजें",
  "Phone number": "फ़ोन नंबर",
  "Citizen Phone Number": "नागरिक फ़ोन नंबर",
  "Citizen phone number": "नागरिक फ़ोन नंबर",
  "Full name": "पूरा नाम",
  "Enter OTP": "OTP दर्ज करें",
  "SLA Breaches": "SLA उल्लंघन"
};

let isHindi = false;
function walkAndTranslate(node) {
  if (node.nodeType === 3) {
    let t = node.nodeValue.trim();
    if (!t) return;
    if (!node.originalText) { node.originalText = t; }
    const key = node.originalText;
    if (dict[key]) {
      node.nodeValue = isHindi ? node.nodeValue.replace(key, dict[key]) : node.nodeValue.replace(dict[key], key);
    }
  } else if (node.nodeType === 1 && node.nodeName !== 'SCRIPT' && node.nodeName !== 'STYLE') {
    node.childNodes.forEach(walkAndTranslate);
  }
}

const langToggleBtn = byId('langToggle');
if (langToggleBtn) {
  langToggleBtn.onclick = () => {
    isHindi = !isHindi;
    langToggleBtn.textContent = isHindi ? 'English' : 'हिंदी';
    const heroH1 = document.querySelector('.hero h1');
    if (heroH1) heroH1.textContent = isHindi ? 'एक बार सत्यापित करें। तेजी से आवेदन करें। जवाबदेह रहें।' : 'Verify once. Apply faster. Stay accountable.';
    const heroP = document.querySelector('.hero p:nth-of-type(2)');
    if (heroP) {
      heroP.innerHTML = isHindi ?
        'डिजिलॉकर आपके दस्तावेज़ सुरक्षित रखता है। VerifyOnce आपका भरोसा सुरक्षित रखता है।<br><span class="hero-sub-text">कोई बार-बार अपलोड नहीं, कोई बार-बार जांच नहीं। सरकारी पोर्टल आपकी सहमति से पहले से सत्यापित दस्तावेज़ों का उपयोग कर सकते हैं।</span>' :
        'DigiLocker stores your documents. VerifyOnce stores your trust.<br><span class="hero-sub-text">No re-uploads, no re-checks, ever. Government portals can instantly use already verified documents with simple consent.</span>';
    }
    document.querySelectorAll('.tab, .card, .consent-hero, label, button').forEach(walkAndTranslate);
  };
}

// Tamper Demonstration Controls
const tamperProofBtn = byId('tamperProofBtn');
if (tamperProofBtn) {
  tamperProofBtn.onclick = () => {
    const p = vault.find(x => x.phone === seed.phone) || vault[0];
    if (!p || !p.proofToken) {
      showToast('No proof token available to tamper', false);
      return;
    }
    const parts = p.proofToken.split('.');
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(base64UrlDecode(parts[1]));
        // Tamper with citizen ID and issuing authority
        payload.citizen_id = '9999999999';
        payload.tampered = true;
        payload.verified_by = 'Forged / Altered Portal';
        const tamperedPayloadB64 = base64UrlEncode(JSON.stringify(payload));
        // Keep original signature with modified data to prove cryptographic detection
        p.proofToken = `${parts[0]}.${tamperedPayloadB64}.${parts[2]}`;
        persist();
        updateTechPanel(p.proofToken, p.proofSignature, payload, true);
        showToast('Proof payload tampered! Test verification in Scholarship or PDS portal.', false);
      } catch (e) {
        showToast('Failed to tamper token: ' + e.message, false);
      }
    }
  };
}

const restoreProofBtn = byId('restoreProofBtn');
if (restoreProofBtn) {
  restoreProofBtn.onclick = async () => {
    const p = vault.find(x => x.phone === seed.phone) || vault[0];
    if (!p) return;
    const payload = {
      citizen_id: p.phone,
      verified_by: 'Ration Card Portal',
      verified_at: p.verifiedAt || Date.now(),
      expires_at: seedExpiry.getTime()
    };
    const signed = await signCredential(payload);
    p.proofToken = signed.token;
    p.proofSignature = signed.signatureHex;
    persist();
    updateTechPanel(signed.token, signed.signatureHex, payload, false);
    showToast('Valid cryptographic signature re-generated & restored!');
  };
}

// Officer Dashboard Logic
let loggedInOfficerId = sessionStorage.getItem('verifyOnceOfficerId') || '';

const officerLoginForm = byId('officerLoginForm');
if (officerLoginForm) {
  officerLoginForm.onsubmit = e => {
    e.preventDefault();
    const idInput = byId('officerIdInput');
    const officerId = idInput ? idInput.value.trim() : '';
    if (!officerId) return;
    loggedInOfficerId = officerId;
    sessionStorage.setItem('verifyOnceOfficerId', officerId);
    showToast('Logged in as Officer ' + officerId);
    renderOfficerDashboard();
  };
}

const officerLogoutBtn = byId('officerLogoutBtn');
if (officerLogoutBtn) {
  officerLogoutBtn.onclick = () => {
    loggedInOfficerId = '';
    sessionStorage.removeItem('verifyOnceOfficerId');
    const idInput = byId('officerIdInput');
    if (idInput) idInput.value = '';
    showToast('Signed out of Officer Dashboard');
    renderOfficerDashboard();
  };
}

function renderOfficerDashboard() {
  const loginView = byId('officerLoginView');
  const dashView = byId('officerDashView');
  if (!loginView || !dashView) return;

  if (!loggedInOfficerId) {
    loginView.classList.remove('hidden');
    dashView.classList.add('hidden');
    return;
  }

  loginView.classList.add('hidden');
  dashView.classList.remove('hidden');

  const badgeText = byId('officerBadgeText');
  if (badgeText) badgeText.textContent = 'Officer: ' + loggedInOfficerId;

  // If escalations exist from earlier sessions, ensure they appear in certApplications
  if (escalations.length > 0 && certApplications.length === 0) {
    escalations.forEach(esc => {
      certApplications.push({
        appId: esc.appId,
        name: 'Meera Patel',
        phone: '9876543210',
        type: esc.type || 'Income Certificate',
        date: esc.date || Date.now(),
        status: 'Escalated to District Officer',
        daysRemaining: 'SLA Breached',
        escalated: true
      });
    });
    localStorage.setItem('verifyOnceCertApplications', JSON.stringify(certApplications));
  }

  // Summary statistics
  const total = certApplications.length;
  const escalated = certApplications.filter(a => a.escalated || a.status === 'Escalated to District Officer').length;
  const pending = total - escalated;

  if (byId('officerStatTotal')) byId('officerStatTotal').textContent = total;
  if (byId('officerStatPending')) byId('officerStatPending').textContent = pending;
  if (byId('officerStatEscalated')) byId('officerStatEscalated').textContent = escalated;

  const tbody = byId('officerTableBody');
  const emptyState = byId('officerEmptyState');
  const tableContainer = byId('officerTableContainer');

  if (total === 0) {
    if (tableContainer) tableContainer.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    if (tbody) tbody.innerHTML = '';
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  if (tableContainer) tableContainer.classList.remove('hidden');

  // Sort: Breached applications (status = "Escalated to District Officer") must be sorted to the top
  const sorted = [...certApplications].sort((a, b) => {
    const aBreached = (a.escalated || a.status === 'Escalated to District Officer') ? 1 : 0;
    const bBreached = (b.escalated || b.status === 'Escalated to District Officer') ? 1 : 0;
    return bBreached - aBreached;
  });

  if (tbody) {
    tbody.innerHTML = sorted.map(app => {
      const isBreached = app.escalated || app.status === 'Escalated to District Officer';
      const rowClass = isBreached ? 'officer-row officer-row-breached' : 'officer-row';
      const statusBadge = isBreached ?
        '<span class="officer-badge officer-badge-breached">Escalated to District Officer</span>' :
        '<span class="officer-badge officer-badge-pending">Under Review</span>';
      const slaPill = isBreached ?
        '<span class="officer-sla-pill sla-alert">⚠️ SLA Breached (0 days)</span>' :
        `<span class="officer-sla-pill sla-ok">${escapeHTML(app.daysRemaining || '15 days')}</span>`;
      const filedDate = app.date ? new Date(app.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Today';

      return `
        <tr class="${rowClass}">
          <td class="officer-td">
            <b>${escapeHTML(app.name)}</b>
            <div style="font-size:12px;color:var(--muted);">${escapeHTML(app.phone || '')} · ${escapeHTML(app.appId || '')}</div>
          </td>
          <td class="officer-td">${escapeHTML(app.type || 'Certificate')}</td>
          <td class="officer-td">${escapeHTML(filedDate)}</td>
          <td class="officer-td">${statusBadge}</td>
          <td class="officer-td">${slaPill}</td>
        </tr>
      `;
    }).join('');
  }
}

// Initial Web Crypto App Bootstrap
async function initApp() {
  try {
    await initWebCrypto();
    // Cryptographically sign the pre-verified seed citizen with real private key
    const seedPayload = {
      citizen_id: seed.phone,
      verified_by: seed.verifiedBy,
      verified_at: seed.verifiedAt,
      expires_at: seedExpiry.getTime()
    };
    const signedSeed = await signCredential(seedPayload);
    seed.proofToken = signedSeed.token;
    seed.proofSignature = signedSeed.signatureHex;

    const existingSeed = vault.find(v => v.phone === seed.phone);
    if (existingSeed) {
      existingSeed.proofToken = signedSeed.token;
      existingSeed.proofSignature = signedSeed.signatureHex;
      existingSeed.aadhaarNum = seed.aadhaarNum;
    } else {
      vault.unshift(seed);
    }

    // Cryptographically sign the pre-seeded duplicate citizen for demonstration
    const dupPayload = {
      citizen_id: seedDuplicate.phone,
      verified_by: seedDuplicate.verifiedBy,
      verified_at: seedDuplicate.verifiedAt,
      expires_at: seedExpiry.getTime()
    };
    const signedDup = await signCredential(dupPayload);
    seedDuplicate.proofToken = signedDup.token;
    seedDuplicate.proofSignature = signedDup.signatureHex;

    const existingDup = vault.find(v => v.phone === seedDuplicate.phone);
    if (existingDup) {
      existingDup.proofToken = signedDup.token;
      existingDup.proofSignature = signedDup.signatureHex;
      existingDup.aadhaarNum = seedDuplicate.aadhaarNum;
    } else {
      vault.push(seedDuplicate);
    }

    persist();
    renderConsent();
    renderEscalations();
    renderOfficerDashboard();
    updateTechPanel(signedSeed.token, signedSeed.signatureHex, seedPayload, false);
  } catch (err) {
    console.error('Web Crypto initialization error:', err);
  }
}

initApp();
