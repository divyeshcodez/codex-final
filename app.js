// VerifyOnce - Client-side Interactive Prototype
// DEMO ONLY: All cryptographic signatures, OTP verification, and DigiLocker responses
// are simulated client-side for demonstration purposes only.

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag] || tag));
}

function generateMockJWT(payload) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const data = btoa(JSON.stringify(payload));
  const sig = btoa("mock-signature-" + Date.now()).substring(0, 43);
  return `${header}.${data}.${sig}`;
}

const seedExpiry = new Date(Date.now() + 90 * 86400000);
const seed = {
  name: 'Meera Patel',
  phone: '9876543210',
  verifiedAt: Date.now() - 86400000 * 2,
  validUntil: seedExpiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
  verifiedBy: 'Ration Card Portal',
  documents: ['Aadhaar', 'Address proof']
};
seed.proofToken = generateMockJWT({
  citizen_id: seed.phone,
  verified_by: seed.verifiedBy,
  verified_at: seed.verifiedAt,
  expires_at: seedExpiry.getTime()
});

let vault = JSON.parse(localStorage.getItem('verifyOnceVault') || 'null') || [seed];
let consentLog = JSON.parse(localStorage.getItem('verifyOnceConsent') || 'null') || [];

const byId = id => document.getElementById(id);

const persist = () => {
  localStorage.setItem('verifyOnceVault', JSON.stringify(vault));
  localStorage.setItem('verifyOnceConsent', JSON.stringify(consentLog));
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
    byId('rationForm')?.classList.add('hidden');
    byId('rProgress')?.classList.add('hidden');

    const ver = byId('verifying');
    if (ver) ver.style.display = 'block';
    const loadMsg = byId('loadMsg');
    if (loadMsg) loadMsg.textContent = ' Checking documents securely…';

    setTimeout(() => {
      const phone_val = byId('rPhone')?.value.trim() || '';
      const isDigilocker = !byId('extraFields')?.classList.contains('hidden');
      const docs_val = isDigilocker ? ['Aadhaar Card', 'PAN Record', 'Driving License', 'Address proof'] : ['Aadhaar', 'Address proof'];

      const expiry = new Date(Date.now() + 90 * 86400000);
      const newPerson = {
        name: byId('rName')?.value.trim() || '',
        phone: phone_val,
        verifiedAt: Date.now(),
        validUntil: expiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        verifiedBy: 'Ration Card Portal',
        documents: docs_val
      };

      const token = generateMockJWT({
        citizen_id: phone_val,
        verified_by: newPerson.verifiedBy,
        verified_at: newPerson.verifiedAt,
        expires_at: expiry.getTime()
      });
      newPerson.proofToken = token;

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

      if (byId('jwtToken')) byId('jwtToken').textContent = token;
      if (ver) ver.style.display = 'none';
      const successBox = byId('rationSuccess');
      if (successBox) successBox.style.display = 'block';
      showToast('Identity verified and saved to vault');
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

function checkVault() {
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

    if (byId('sValidating')) byId('sValidating').style.display = 'flex';
    if (byId('checkVault')) byId('checkVault').style.display = 'none';

    setTimeout(() => {
      if (byId('sValidating')) byId('sValidating').style.display = 'none';
      if (byId('checkVault')) byId('checkVault').style.display = 'inline-flex';

      if (byId('reuseText')) {
        byId('reuseText').innerHTML = `<b class="citizen-highlight">${escapeHTML(person.name)}'s</b> identity was verified via <b>${escapeHTML(person.verifiedBy)}</b> on ${new Date(person.verifiedAt).toLocaleDateString('en-IN')}. Valid until ${escapeHTML(person.validUntil)}.`;
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
    }, 1000);
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

  setTimeout(() => {
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
      validating.innerHTML = '<div class="spinner"></div> Validating signature ✓';
      byId('pdsCheckVault')?.parentElement.insertBefore(validating, byId('pdsReuseBanner'));

      setTimeout(() => {
        validating.remove();
        if (byId('pdsCheckVault')) byId('pdsCheckVault').style.display = 'inline-flex';
        if (byId('pdsReuseText')) {
          byId('pdsReuseText').innerHTML = `<b>${escapeHTML(person.name)}'s</b> identity was verified by <b>${escapeHTML(person.verifiedBy)}</b>.`;
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
      }, 1000);
    } else {
      if (byId('pdsCheckVault')) byId('pdsCheckVault').style.display = 'inline-flex';
      if (byId('pdsFallbackTitle')) byId('pdsFallbackTitle').textContent = 'No identity found.';
      if (byId('pdsFallbackSub')) byId('pdsFallbackSub').textContent = 'Cannot proceed without documents.';
      if (byId('pdsFallback')) byId('pdsFallback').style.display = 'block';
    }
  }, 2500);
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
  cCheckVaultBtn.onclick = () => {
    const phone = byId('cPhone')?.value.trim() || '';
    const person = vault.find(v => v.phone === phone);

    if (byId('cFallback')) byId('cFallback').style.display = 'none';

    if (!phone) {
      byId('cPhone')?.focus();
      return;
    }

    if (person && !person.revoked) {
      if (byId('cValidating')) byId('cValidating').style.display = 'flex';
      if (byId('cCheckVault')) byId('cCheckVault').style.display = 'none';

      setTimeout(() => {
        if (byId('cValidating')) byId('cValidating').style.display = 'none';
        if (byId('certStep1')) byId('certStep1').style.display = 'none';

        if (byId('cIdentText')) {
          byId('cIdentText').innerHTML = `<b class="citizen-highlight">${escapeHTML(person.name)}'s</b> identity (via ${escapeHTML(person.verifiedBy)}) is instantly reused.`;
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
      }, 1000);
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
  renderEscalations();
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
  cscLookupBtn.onclick = () => {
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

// Initial Render
persist();
renderConsent();
renderEscalations();
