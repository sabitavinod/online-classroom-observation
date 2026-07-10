const state = {
  idToken: '',
  user: null,
  schools: [],
  technicianSchools: [],
  schedule: null,
  activeSessions: loadActiveSessions(),
  selectedSessionId: null,
  googleInitialised: false
};

const els = {
  rolePanel: document.getElementById('rolePanel'),
  observerAccessButton: document.getElementById('observerAccessButton'),
  technicianAccessButton: document.getElementById('technicianAccessButton'),
  signinPanel: document.getElementById('signinPanel'),
  backFromSignin: document.getElementById('backFromSignin'),
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
  closeModal: document.getElementById('closeModal'),
  technicianPanel: document.getElementById('technicianPanel'),
  backFromTechnician: document.getElementById('backFromTechnician'),
  technicianSchoolSelect: document.getElementById('technicianSchoolSelect'),
  technicianRefreshButton: document.getElementById('technicianRefreshButton'),
  technicianDateLine: document.getElementById('technicianDateLine'),
  technicianStatus: document.getElementById('technicianStatus'),
  technicianGrid: document.getElementById('technicianGrid'),
  technicianNextDateLine: document.getElementById('technicianNextDateLine'),
  technicianNextGrid: document.getElementById('technicianNextGrid')
};

els.observerAccessButton.addEventListener('click', openObserverLogin);
els.technicianAccessButton.addEventListener('click', openTechnicianView);
els.backFromSignin.addEventListener('click', showRolePanel);
els.backFromTechnician.addEventListener('click', showRolePanel);
els.schoolSelect.addEventListener('change', loadToday);
els.refreshButton.addEventListener('click', loadToday);
els.submitObservation.addEventListener('click', submitObservation);
els.closeModal.addEventListener('click', () => els.observationModal.classList.add('hidden'));
els.technicianSchoolSelect.addEventListener('change', loadTechnicianToday);
els.technicianRefreshButton.addEventListener('click', loadTechnicianToday);

function showRolePanel() {
  els.rolePanel.classList.remove('hidden');
  els.signinPanel.classList.add('hidden');
  els.technicianPanel.classList.add('hidden');
}

function openObserverLogin() {
  els.rolePanel.classList.add('hidden');
  els.signinPanel.classList.remove('hidden');
  initialiseGoogleSignIn();
}

async function openTechnicianView() {
  els.rolePanel.classList.add('hidden');
  els.technicianPanel.classList.remove('hidden');
  try {
    clearStatus(els.technicianStatus);
    if (!state.technicianSchools.length) {
      const result = await apiGetPublic('technicianschools');
      if (!result.ok) throw new Error(result.error || 'Could not load schools.');
      state.technicianSchools = result.schools;
      populateTechnicianSchools();
    }
    await loadTechnicianToday();
  } catch (error) {
    setStatus(els.technicianStatus, error.message, 'error');
  }
}

function initialiseGoogleSignIn() {
  validateConfiguration();
  if (state.googleInitialised) return;
  if (!window.google || !google.accounts || !google.accounts.id) {
    setTimeout(initialiseGoogleSignIn, 300);
    return;
  }
  google.accounts.id.initialize({
    client_id: window.APP_CONFIG.GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse,
    hosted_domain: window.APP_CONFIG.ALLOWED_DOMAIN,
    auto_select: false
  });
  google.accounts.id.renderButton(els.googleSignInButton, {
    theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', width: 280
  });
  state.googleInitialised = true;
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

function populateTechnicianSchools() {
  els.technicianSchoolSelect.innerHTML = state.technicianSchools.map(s =>
    `<option value="${escapeHtml(s.schoolId)}">${escapeHtml(s.shortName)}</option>`
  ).join('');
  const saved = localStorage.getItem('technicianSchool');
  if (saved && state.technicianSchools.some(s => s.schoolId === saved)) {
    els.technicianSchoolSelect.value = saved;
  }
}

async function loadTechnicianToday() {
  try {
    clearStatus(els.technicianStatus);
    const schoolId = els.technicianSchoolSelect.value;
    if (!schoolId) return;
    localStorage.setItem('technicianSchool', schoolId);
    const result = await apiGetPublic('techniciantoday', { schoolId });
    if (!result.ok) throw new Error(result.error || 'Could not load today’s allocation.');
    renderTechnicianSchedules(result.data);
  } catch (error) {
    setStatus(els.technicianStatus, error.message, 'error');
  }
}

function renderTechnicianSchedules(data) {
  renderTechnicianScheduleBlock(data.today, els.technicianDateLine, els.technicianGrid, 'today');

  if (!data.next) {
    els.technicianNextDateLine.textContent = '';
    els.technicianNextGrid.innerHTML = '<div class="panel empty">No future allocation is available in the schedule.</div>';
    return;
  }
  renderTechnicianScheduleBlock(data.next, els.technicianNextDateLine, els.technicianNextGrid, 'next');
}

function renderTechnicianScheduleBlock(schedule, dateElement, gridElement, period) {
  dateElement.textContent = `${schedule.schoolName} · ${schedule.day}, ${schedule.date}`;
  if (schedule.nonWorkingDay) {
    gridElement.innerHTML = `<div class="panel empty">${escapeHtml(schedule.message)}</div>`;
    return;
  }
  if (!schedule.cameras.length) {
    gridElement.innerHTML = `<div class="panel empty">No allocation is available for ${period === 'today' ? 'today' : 'the next working day'}.</div>`;
    return;
  }
  gridElement.innerHTML = schedule.cameras.map(cam => `
    <article class="camera-card technician-card">
      <div class="camera-top"></div>
      <div class="camera-body">
        <div class="camera-title">
          <div>
            <h3>${escapeHtml(cam.camera)}</h3>
            <div class="grade">${escapeHtml(formatGradeLabel(cam.grade))}</div>
          </div>
        </div>
        <div class="section">${escapeHtml(formatSectionLabel(cam.section))}</div>
      </div>
    </article>
  `).join('');
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
    renderPendingSessions();
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
        <div class="camera-title"><div><h3>${escapeHtml(cam.camera)}</h3><div class="grade">${escapeHtml(formatGradeLabel(cam.grade))}</div></div></div>
        <div class="section">${escapeHtml(formatSectionLabel(cam.section))}</div>
        <div class="camera-actions"><button class="primary-button full" data-start-camera="${escapeHtml(cam.camera)}">Start Observation & Join Meet</button></div>
      </div>
    </article>
  `).join('');
  document.querySelectorAll('[data-start-camera]').forEach(button => {
    button.addEventListener('click', () => startObservation(button.dataset.startCamera));
  });
}

async function startObservation(camera) {
  try {
    const result = await apiPost({ action: 'start', schoolId: state.schedule.schoolId, camera });
    if (!result.ok) throw new Error(result.error || 'Could not start the observation.');
    const newSession = {
      sessionId: result.sessionId,
      startedAt: result.startedAt,
      schoolId: state.schedule.schoolId,
      schoolName: state.schedule.schoolName,
      camera,
      classLabel: result.classLabel,
      meetLink: result.meetLink
    };
    state.activeSessions.push(newSession);
    saveActiveSessions(state.activeSessions);
    renderPendingSessions();
    window.open(result.meetLink, '_blank', 'noopener');
  } catch (error) {
    setStatus(els.pageStatus, error.message, 'error');
  }
}

function renderPendingSessions() {
  if (!state.activeSessions.length) {
    els.activeBanner.classList.add('hidden');
    els.activeBanner.innerHTML = '';
    return;
  }
  els.activeBanner.classList.remove('hidden');
  updatePendingSessions();
}

function updatePendingSessions() {
  if (!state.activeSessions.length) return;
  els.activeBanner.innerHTML = `
    <div class="pending-heading"><strong>Pending Observations (${state.activeSessions.length})</strong><span>You can open another class and submit each observation later.</span></div>
    <div class="pending-list">
      ${state.activeSessions.map(session => {
        const seconds = Math.max(0, Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000));
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        const timer = hours > 0 ? `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')}` : `${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
        return `<div class="pending-card"><div><strong>${escapeHtml(session.schoolName)} · ${escapeHtml(session.camera)}</strong><div>${escapeHtml(formatSectionLabel(session.classLabel))}</div><div class="timer">${timer}</div></div><div class="pending-actions"><a class="secondary-button" href="${escapeHtml(session.meetLink)}" target="_blank" rel="noopener">Open Meet</a><button class="primary-button" data-complete-session="${escapeHtml(session.sessionId)}">Submit</button></div></div>`;
      }).join('')}
    </div>`;
  document.querySelectorAll('[data-complete-session]').forEach(button => {
    button.addEventListener('click', () => openObservationModal(button.dataset.completeSession));
  });
}
setInterval(updatePendingSessions, 1000);

function openObservationModal(sessionId) {
  const session = state.activeSessions.find(item => item.sessionId === sessionId);
  if (!session) return;
  state.selectedSessionId = sessionId;
  els.modalClass.textContent = `${session.schoolName} · ${session.camera} · ${formatSectionLabel(session.classLabel)}`;
  els.remarks.value = '';
  clearStatus(els.modalStatus);
  els.observationModal.classList.remove('hidden');
}

async function submitObservation() {
  try {
    const session = state.activeSessions.find(item => item.sessionId === state.selectedSessionId);
    if (!session) throw new Error('Please select a pending observation.');
    const remarks = els.remarks.value.trim();
    els.submitObservation.disabled = true;
    const result = await apiPost({ action: 'submit', sessionId: session.sessionId, remarks });
    if (!result.ok) throw new Error(result.error || 'Could not submit the observation.');
    setStatus(els.modalStatus, `Observation submitted. Duration: ${result.durationMinutes} minutes.`, 'success');
    state.activeSessions = state.activeSessions.filter(item => item.sessionId !== session.sessionId);
    state.selectedSessionId = null;
    saveActiveSessions(state.activeSessions);
    renderPendingSessions();
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

async function apiGetPublic(action, params = {}) {
  const url = new URL(window.APP_CONFIG.API_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
  return response.json();
}

async function apiPost(payload) {
  const response = await fetch(window.APP_CONFIG.API_URL, {
    method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...payload, idToken: state.idToken })
  });
  return response.json();
}

function loadActiveSessions() {
  try { const stored = JSON.parse(localStorage.getItem('activeObservations') || '[]'); return Array.isArray(stored) ? stored : []; }
  catch (_) { return []; }
}
function saveActiveSessions(sessions) { localStorage.setItem('activeObservations', JSON.stringify(sessions)); localStorage.removeItem('activeObservation'); }
function formatGradeLabel(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.replace(/^Class\s+/i, 'Grade ');
}

function formatSectionLabel(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^no class/i.test(text) || /second saturday/i.test(text)) return 'No Class';
  return `Section ${text}`;
}

function setStatus(element, message, type) { element.innerHTML = `<div class="status ${type}">${escapeHtml(message)}</div>`; }
function clearStatus(element) { element.innerHTML = ''; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char])); }
