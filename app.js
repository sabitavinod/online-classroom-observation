const state = {
  idToken: '',
  user: null,
  schools: [],
  schedule: null,
  activeSession: loadActiveSession()
};

const els = {
  signinPanel: document.getElementById('signinPanel'),
  appPanel: document.getElementById('appPanel'),
  googleSignInButton: document.getElementById('googleSignInButton'),
  signinStatus: document.getElementById('signinStatus'),
  schoolSelect: document.getElementById('schoolSelect'),
  refreshButton: document.getElementById('refreshButton'),
  dateLine: document.getElementById('dateLine'),
  userLine: document.getElementById('userLine'),
  timetableButton: document.getElementById('timetableButton'),
  activeBanner: document.getElementById('activeBanner'),
  pageStatus: document.getElementById('pageStatus'),
  cameraGrid: document.getElementById('cameraGrid'),
  historyList: document.getElementById('historyList'),
  observationModal: document.getElementById('observationModal'),
  modalClass: document.getElementById('modalClass'),
  remarks: document.getElementById('remarks'),
  modalStatus: document.getElementById('modalStatus'),
  submitObservation: document.getElementById('submitObservation'),
  closeModal: document.getElementById('closeModal')
};

window.addEventListener('load', initialiseGoogleSignIn);
els.schoolSelect.addEventListener('change', loadToday);
els.refreshButton.addEventListener('click', loadToday);
els.submitObservation.addEventListener('click', submitObservation);
els.closeModal.addEventListener('click', () => els.observationModal.classList.add('hidden'));

function initialiseGoogleSignIn() {
  validateConfiguration();
  google.accounts.id.initialize({
    client_id: window.APP_CONFIG.GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse,
    hosted_domain: window.APP_CONFIG.ALLOWED_DOMAIN,
    auto_select: false
  });
  google.accounts.id.renderButton(els.googleSignInButton, {
    theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', width: 280
  });
}

function validateConfiguration() {
  if (window.APP_CONFIG.API_URL.includes('PASTE_') || window.APP_CONFIG.GOOGLE_CLIENT_ID.includes('PASTE_')) {
    setStatus(els.signinStatus, 'Configuration is incomplete. Add the Apps Script URL and Google Client ID in config.js.', 'error');
  }
}

async function handleCredentialResponse(response) {
  try {
    state.idToken = response.credential;
    const result = await apiGet('schools');
    if (!result.ok) throw new Error(result.error || 'Sign-in failed.');
    state.user = result.user;
    state.schools = result.schools;
    populateSchools();
    els.signinPanel.classList.add('hidden');
    els.appPanel.classList.remove('hidden');
    els.userLine.textContent = `Signed in as ${state.user.name} (${state.user.email})`;
    await loadToday();
    await loadHistory();
  } catch (error) {
    setStatus(els.signinStatus, error.message, 'error');
  }
}

function populateSchools() {
  els.schoolSelect.innerHTML = state.schools.map(s =>
    `<option value="${escapeHtml(s.schoolId)}">${escapeHtml(s.shortName)}</option>`
  ).join('');
  const saved = localStorage.getItem('selectedSchool');
  if (saved && state.schools.some(s => s.schoolId === saved)) els.schoolSelect.value = saved;
}

async function loadToday() {
  try {
    clearStatus(els.pageStatus);
    const schoolId = els.schoolSelect.value;
    localStorage.setItem('selectedSchool', schoolId);
    const result = await apiGet('today', { schoolId });
    if (!result.ok) throw new Error(result.error || 'Could not load today’s schedule.');
    state.schedule = result.data;
    renderSchedule();
    renderActiveSession();
  } catch (error) {
    setStatus(els.pageStatus, error.message, 'error');
  }
}

function renderSchedule() {
  const s = state.schedule;
  els.dateLine.textContent = `${s.day}, ${s.date}`;
  els.timetableButton.href = s.timetableFolder;

  if (s.nonWorkingDay) {
    els.cameraGrid.innerHTML = `<div class="panel empty">${escapeHtml(s.message)}</div>`;
    return;
  }
  if (!s.cameras.length) {
    els.cameraGrid.innerHTML = '<div class="panel empty">No schedule is available for today.</div>';
    return;
  }

  els.cameraGrid.innerHTML = s.cameras.map(cam => `
    <article class="camera-card">
      <div class="camera-top"></div>
      <div class="camera-body">
        <div class="camera-title">
          <div>
            <h3>${escapeHtml(cam.camera)}</h3>
            <div class="grade">${escapeHtml(cam.grade)}</div>
          </div>
        </div>
        <div class="section">Class ${escapeHtml(cam.section)}</div>
        <div class="camera-actions">
          <button class="primary-button full" data-start-camera="${escapeHtml(cam.camera)}">Start Observation & Join Meet</button>
        </div>
      </div>
    </article>
  `).join('');

  document.querySelectorAll('[data-start-camera]').forEach(button => {
    button.addEventListener('click', () => startObservation(button.dataset.startCamera));
  });
}

async function startObservation(camera) {
  try {
    if (state.activeSession) {
      throw new Error('Complete your active observation before starting another one.');
    }
    const result = await apiPost({ action: 'start', schoolId: state.schedule.schoolId, camera });
    if (!result.ok) throw new Error(result.error || 'Could not start the observation.');

    state.activeSession = {
      sessionId: result.sessionId,
      startedAt: result.startedAt,
      schoolId: state.schedule.schoolId,
      schoolName: state.schedule.schoolName,
      camera,
      classLabel: result.classLabel,
      meetLink: result.meetLink
    };
    saveActiveSession(state.activeSession);
    renderActiveSession();
    window.open(result.meetLink, '_blank', 'noopener');
  } catch (error) {
    setStatus(els.pageStatus, error.message, 'error');
  }
}

function renderActiveSession() {
  if (!state.activeSession) {
    els.activeBanner.classList.add('hidden');
    return;
  }
  els.activeBanner.classList.remove('hidden');
  updateActiveBanner();
}

function updateActiveBanner() {
  if (!state.activeSession) return;
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(state.activeSession.startedAt).getTime()) / 1000));
  const minutesPart = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secondsPart = String(seconds % 60).padStart(2, '0');
  els.activeBanner.innerHTML = `
    <strong>Active Observation</strong><br>
    ${escapeHtml(state.activeSession.schoolName)} · ${escapeHtml(state.activeSession.camera)} · Class ${escapeHtml(state.activeSession.classLabel)}
    <div class="timer">${minutesPart}:${secondsPart}</div>
    <div class="camera-actions" style="margin-top:10px">
      <a class="secondary-button full" href="${escapeHtml(state.activeSession.meetLink)}" target="_blank" rel="noopener">Return to Meet</a>
      <button id="completeActive" class="primary-button full">Complete Observation</button>
    </div>`;
  document.getElementById('completeActive').addEventListener('click', openObservationModal);
}
setInterval(updateActiveBanner, 1000);

function openObservationModal() {
  if (!state.activeSession) return;
  els.modalClass.textContent = `${state.activeSession.schoolName} · ${state.activeSession.camera} · Class ${state.activeSession.classLabel}`;
  els.remarks.value = '';
  clearStatus(els.modalStatus);
  els.observationModal.classList.remove('hidden');
}

async function submitObservation() {
  try {
    const remarks = els.remarks.value.trim();
    els.submitObservation.disabled = true;
    const result = await apiPost({ action: 'submit', sessionId: state.activeSession.sessionId, remarks });
    if (!result.ok) throw new Error(result.error || 'Could not submit the observation.');
    setStatus(els.modalStatus, `Observation submitted. Duration: ${result.durationMinutes} minutes.`, 'success');
    state.activeSession = null;
    saveActiveSession(null);
    renderActiveSession();
    await loadHistory();
    setTimeout(() => els.observationModal.classList.add('hidden'), 900);
  } catch (error) {
    setStatus(els.modalStatus, error.message, 'error');
  } finally {
    els.submitObservation.disabled = false;
  }
}

async function loadHistory() {
  try {
    const result = await apiGet('history');
    if (!result.ok) throw new Error(result.error || 'Could not load observation history.');
    if (!result.history.length) {
      els.historyList.innerHTML = '<div class="empty">No observations submitted yet.</div>';
      return;
    }
    els.historyList.innerHTML = result.history.map(item => `
      <div class="history-card">
        <div class="history-head"><span>${escapeHtml(item.school)} · ${escapeHtml(item.section)}</span><span>${escapeHtml(item.status)}</span></div>
        <div class="history-meta">${escapeHtml(item.date)} · ${escapeHtml(item.startTime)}–${escapeHtml(item.submitTime || 'Not submitted')} · ${escapeHtml(String(item.durationMinutes || ''))}${item.durationMinutes !== '' ? ' min' : ''}</div>
        ${item.remarks ? `<div class="history-remarks">${escapeHtml(item.remarks)}</div>` : ''}
      </div>`).join('');
  } catch (error) {
    els.historyList.innerHTML = `<div class="status error">${escapeHtml(error.message)}</div>`;
  }
}

async function apiGet(action, params = {}) {
  const url = new URL(window.APP_CONFIG.API_URL);
  url.searchParams.set('action', action);
  url.searchParams.set('idToken', state.idToken);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
  return response.json();
}

async function apiPost(payload) {
  const response = await fetch(window.APP_CONFIG.API_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...payload, idToken: state.idToken })
  });
  return response.json();
}

function loadActiveSession() {
  try { return JSON.parse(localStorage.getItem('activeObservation') || 'null'); }
  catch (_) { return null; }
}
function saveActiveSession(session) {
  if (session) localStorage.setItem('activeObservation', JSON.stringify(session));
  else localStorage.removeItem('activeObservation');
}
function setStatus(element, message, type) { element.innerHTML = `<div class="status ${type}">${escapeHtml(message)}</div>`; }
function clearStatus(element) { element.innerHTML = ''; }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}
