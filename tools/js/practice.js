(function() {
	const dom = {};
	let timerInterval = null;
	let sessionState = {
		active: false,
		paused: false,
		startTs: null,
		elapsedAccumMs: 0,
		sessionId: null,
	};

	const TIMER_KEY = 'practiceTimerStateV1';
	const TIMER_MAX_IDLE_MINUTES = 12 * 60; // 12 hours cutoff

	const PRACTICE_DATA_KEY = 'practiceData';
	const PRACTICE_META_KEY = 'practiceDataMeta';
	const CACHE_TTL_MS = 30 * 1000; // 30s
	const RECENT_LIMIT = 10;

	let cachedSummary = null;
	let practiceData = null;

	document.addEventListener('DOMContentLoaded', init);

	async function init() {
		cacheDOM();
		bindEvents();
		await ensureAuth();
		restoreTimerFromStorage();
		await loadSummary();
		loadTrends(); // fire and forget; not critical for initial view
	}

	function cacheDOM() {
		dom.timerDisplay = document.getElementById('timer-display');
		dom.startBtn = document.getElementById('start-session-btn');
		dom.pauseBtn = document.getElementById('pause-session-btn');
		dom.resumeBtn = document.getElementById('resume-session-btn');
		dom.logBtn = document.getElementById('log-session-btn');
		dom.cancelBtn = document.getElementById('cancel-session-btn');
		dom.sessionStatusTitle = document.getElementById('session-status-title');
		dom.sessionStatusBadge = document.getElementById('session-status-badge');
		dom.manualForm = document.getElementById('manual-log-form');
		dom.manualOpenBtn = document.getElementById('open-manual-log-btn');
		dom.manualModal = document.getElementById('manual-modal');
		dom.manualClose = document.getElementById('manual-close');
		dom.manualCancel = document.getElementById('manual-cancel');
		dom.manualDate = document.getElementById('manual-date');
		dom.manualNotes = document.getElementById('manual-notes');
		dom.manualMinutes = document.getElementById('manual-minutes');
		dom.summaryWeekMinutesLabel = document.getElementById('week-minutes-label');
		dom.weekGoalLabel = document.getElementById('week-goal-label');
		dom.weekProgressBar = document.getElementById('week-progress-bar');
		dom.streakValue = document.getElementById('streak-value');
		dom.weekSessionsValue = document.getElementById('week-sessions-value');
		dom.goalInput = document.getElementById('goal-input');
		dom.saveGoalBtn = document.getElementById('save-goal-btn');
		dom.refreshSummaryBtn = document.getElementById('refresh-summary-btn');
		dom.recentList = document.getElementById('recent-sessions-list');
		dom.recentEmpty = document.getElementById('recent-empty');
		dom.finalizeModal = document.getElementById('finalize-modal');
		dom.finalizeClose = document.getElementById('finalize-close');
		dom.finalizeCancel = document.getElementById('finalize-cancel');
		dom.finalizeForm = document.getElementById('finalize-form');
		dom.finalizeElapsed = document.getElementById('finalize-elapsed');
		dom.finalNotes = document.getElementById('final-notes');
		dom.finalDate = document.getElementById('final-date');
		dom.finalizeSubmit = document.getElementById('finalize-submit');
		dom.manualSubmitBtn = document.getElementById('manual-submit-btn');
		dom.manualNotesCounter = document.getElementById('manual-notes-counter');
		dom.finalNotesCounter = document.getElementById('final-notes-counter');
		dom.alertModal = document.getElementById('alert-modal');
		dom.alertMessage = document.getElementById('alert-message');
		dom.alertOk = document.getElementById('alert-ok');
		dom.alertClose = document.getElementById('alert-close');
		// accessibility
		if (!document.getElementById('practice-live-region')) {
			const live = document.createElement('div');
			live.id = 'practice-live-region';
			live.className = 'visually-hidden';
			live.setAttribute('aria-live', 'polite');
			live.setAttribute('aria-atomic', 'true');
			document.body.appendChild(live);
			dom.liveRegion = live;
		} else { dom.liveRegion = document.getElementById('practice-live-region'); }

		[dom.finalizeModal, dom.alertModal].forEach(m => {
			if (m) {
				m.setAttribute('role','dialog');
				m.setAttribute('aria-modal','true');
			}
		});
	}

	function bindEvents() {
		dom.startBtn.addEventListener('click', startSession);
		dom.pauseBtn.addEventListener('click', pauseSession);
		dom.resumeBtn.addEventListener('click', resumeSession);
		dom.logBtn.addEventListener('click', openFinalizeModal);
		dom.cancelBtn.addEventListener('click', cancelSessionPrompt);
		dom.manualForm.addEventListener('submit', handleManualSubmit);
		if (dom.manualOpenBtn) dom.manualOpenBtn.addEventListener('click', openManualModal);
		if (dom.manualClose) dom.manualClose.addEventListener('click', closeManualModal);
		if (dom.manualCancel) dom.manualCancel.addEventListener('click', closeManualModal);
		if (dom.manualModal) dom.manualModal.addEventListener('click', e => { if (e.target === dom.manualModal) closeManualModal(); });
		dom.refreshSummaryBtn.addEventListener('click', loadSummary);
		dom.saveGoalBtn.addEventListener('click', saveGoal);
		dom.finalizeClose.addEventListener('click', closeFinalizeModal);
		dom.finalizeCancel.addEventListener('click', closeFinalizeModal);
		dom.finalizeForm.addEventListener('submit', finalizeSessionSubmit);
		if (dom.alertOk) dom.alertOk.addEventListener('click', closeAlertModal);
		if (dom.alertClose) dom.alertClose.addEventListener('click', closeAlertModal);
		if (dom.alertModal) dom.alertModal.addEventListener('click', e => { if (e.target === dom.alertModal) closeAlertModal(); });
		document.addEventListener('keydown', globalKeyHandler, true);
		initDates();
		document.getElementById('refresh-summary-btn')?.addEventListener('click', ()=>{ loadTrends(true); });
	}

	function announce(msg) { if (dom.liveRegion) dom.liveRegion.textContent = msg; }

	// modal helpers
	let activeModal = null;
	let lastFocusedEl = null;
	const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

	function trapFocus(e) {
		if (!activeModal) return;
		if (e.key !== 'Tab') return;
		const focusable = activeModal.querySelectorAll(FOCUSABLE);
		if (!focusable.length) return;
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
		else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
	}

	function globalKeyHandler(e) {
		if (e.key === 'Escape') {
			if (activeModal === dom.finalizeModal) { closeFinalizeModal(); }
			else if (activeModal === dom.alertModal) { closeAlertModal(); }
		}
		trapFocus(e);
	}

	function setActiveModal(modal, initialFocusSelector) {
		activeModal = modal;
		if (modal) {
			lastFocusedEl = document.activeElement;
			setTimeout(()=>{
				let target = initialFocusSelector ? modal.querySelector(initialFocusSelector) : null;
				if (!target) {
					const focusable = modal.querySelectorAll(FOCUSABLE);
					target = focusable[0];
				}
				target?.focus();
			},0);
		} else if (lastFocusedEl) {
			lastFocusedEl.focus();
			lastFocusedEl = null;
		}
	}

	function openAlertModal(msg, title='Notice') {
		if (!dom.alertModal) { showToast(title, msg); return; }
		const titleEl = document.getElementById('alert-title');
		if (titleEl) titleEl.textContent = title;
		if (dom.alertMessage) dom.alertMessage.textContent = msg;
		dom.alertModal.classList.remove('hidden');
		setActiveModal(dom.alertModal, '#alert-ok');
		announce(title + ': ' + msg);
	}
	function closeAlertModal() { if (dom.alertModal) { dom.alertModal.classList.add('hidden'); } if (activeModal === dom.alertModal) setActiveModal(null); }

	function getTodayLocalISO() {
		const d = new Date();
		const y = d.getFullYear();
		const m = String(d.getMonth()+1).padStart(2,'0');
		const day = String(d.getDate()).padStart(2,'0');
		return `${y}-${m}-${day}`;
	}

	function initDates() {
		const todayStr = getTodayLocalISO();
		const earliest = new Date(Date.now() - 90*86400000);
		const earliestStr = `${earliest.getFullYear()}-${String(earliest.getMonth()+1).padStart(2,'0')}-${String(earliest.getDate()).padStart(2,'0')}`;
		if (dom.manualDate) {
			dom.manualDate.max = todayStr;
			dom.manualDate.min = earliestStr;
			if (!dom.manualDate.value || dom.manualDate.value > todayStr || dom.manualDate.value < earliestStr) dom.manualDate.value = todayStr;
		}
		if (dom.finalDate) {
			dom.finalDate.max = todayStr;
			dom.finalDate.min = earliestStr;
			if (!dom.finalDate.value || dom.finalDate.value > todayStr || dom.finalDate.value < earliestStr) dom.finalDate.value = todayStr;
		}
	}

	async function ensureAuth() {
		try {
			await window.auth0Promise;
			const loggedIn = await isAuthenticated();
			if (!loggedIn) {
				window.location.href = '/login'; // go sign in buckaroo
			}
		} catch (e) {
			console.error('Auth init failed', e);
		}
	}

	// session timer
	async function startSession() {
		if (sessionState.active) return;
		if (dom.startBtn) { dom.startBtn.disabled = true; dom.startBtn.textContent = 'Starting…'; }
		try {
			const token = await auth0Client.getTokenSilently();
			const res = await fetch('/api/startPracticeSession', { method:'POST', headers:{ 'Authorization':`Bearer ${token}` }});
			if (!res.ok) throw new Error('start failed');
			const data = await res.json();
			sessionState.active = true;
			sessionState.paused = false;
			sessionState.elapsedAccumMs = 0;
			sessionState.startTs = Date.now();
			sessionState.sessionId = data.sid || ('local-' + Math.random().toString(36).slice(2,9));
			updateSessionUIState();
			startTimerInterval();
			showToast('Session Started', data.existing ? 'Resumed active session.' : 'Timer running.');
			persistTimerState();
		} catch (e) {
			console.error(e);
			showToast('Error', 'Could not start session');
			if (dom.startBtn) { dom.startBtn.disabled = false; dom.startBtn.textContent = 'Start Session'; }
		}
	}

	function pauseSession() {
		if (!sessionState.active || sessionState.paused) return;
		sessionState.elapsedAccumMs += Date.now() - sessionState.startTs;
		sessionState.paused = true;
		clearInterval(timerInterval);
		updateSessionUIState();
		showToast('Paused', 'Session paused.');
		persistTimerState();
	}

	function resumeSession() {
		if (!sessionState.active || !sessionState.paused) return;
		sessionState.paused = false;
		sessionState.startTs = Date.now();
		startTimerInterval();
		updateSessionUIState();
		showToast('Resumed', 'Session resumed.');
		persistTimerState();
	}

	function startTimerInterval() {
		clearInterval(timerInterval);
		timerInterval = setInterval(updateElapsed, 1000);
		updateElapsed();
	}

	function updateElapsed() {
		if (!sessionState.active) return;
		let diff = sessionState.elapsedAccumMs;
		if (!sessionState.paused && sessionState.startTs) {
			let seg = Date.now() - sessionState.startTs;
			if (seg < 0) { // clock skew guard
				sessionState.startTs = Date.now();
				seg = 0;
			}
			diff += seg;
		}
		dom.timerDisplay.textContent = formatDuration(diff);
		persistTimerState();
	}

	function formatDuration(ms) {
		const totalSeconds = Math.max(0, Math.floor(ms / 1000));
		const m = Math.floor(totalSeconds / 60);
		const s = totalSeconds % 60;
		return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
	}

	function openFinalizeModal() {
		if (!sessionState.active) return;
		let totalMs = sessionState.elapsedAccumMs;
		if (!sessionState.paused && sessionState.startTs) {
			const seg = Date.now() - sessionState.startTs;
			totalMs += Math.max(0, seg);
		}
		if (totalMs < 60000) {
			openAlertModal('Need at least 1 full minute before logging.', 'Too Short');
			return;
		}
		if (!sessionState.paused) pauseSession();
		dom.finalizeElapsed.textContent = dom.timerDisplay.textContent;
		if (dom.finalDate && !dom.finalDate.value) initDates();
		dom.finalizeModal.classList.remove('hidden');
		dom.sessionStatusBadge.textContent = 'Finalizing';
		dom.sessionStatusBadge.classList.add('finalizing');
		setActiveModal(dom.finalizeModal, 'textarea, input, button');
		announce('Finalize session dialog opened');
	}

	function closeFinalizeModal() {
		if (!dom.finalizeModal.classList.contains('hidden')) {
			dom.finalizeModal.classList.add('hidden');
			dom.sessionStatusBadge.classList.remove('finalizing');
			if (sessionState.active) dom.sessionStatusBadge.textContent = 'Active';
			if (activeModal === dom.finalizeModal) setActiveModal(null);
			announce('Finalize dialog closed');
		}
	}

	function cancelSessionPrompt() {
		if (!sessionState.active) return;
		if (confirm('Cancel current session (not saved)?')) {
			(async () => {
				try {
					const token = await auth0Client.getTokenSilently();
					await fetch('/api/cancelPracticeSession', { method:'POST', headers:{ 'Authorization':`Bearer ${token}` }});
				} catch {}
			})();
			resetSessionState();
			updateSessionUIState();
			showToast('Session Cancelled', 'No data saved.');
			announce('Session cancelled');
		}
	}

	function finalizeSessionSubmit(e) {
		e.preventDefault();
		if (dom.finalizeForm.dataset.submitting) return;
		dom.finalizeForm.dataset.submitting = '1';
		if (dom.finalizeSubmit) dom.finalizeSubmit.disabled = true;
		let totalMs = sessionState.elapsedAccumMs;
		if (!sessionState.paused && sessionState.active && sessionState.startTs) totalMs += Date.now() - sessionState.startTs;
		if (totalMs < 60000) { showToast('Validation', 'Session must be at least 1 full minute.'); finalizeCleanup(); return; }
		const minutes = Math.min(720, Math.ceil(totalMs / 60000));
		const notes = dom.finalNotes.value.trim();
		const payload = { sessionId: sessionState.sessionId, notes, durationMinutes: minutes, date: dom.finalDate?.value || getTodayLocalISO() };
		saveFinalizedSession(payload).then(() => {
			showToast('Session Saved', `${minutes} minute${minutes===1?'':'s'} logged.`);
			closeFinalizeModal();
			resetSessionState();
			updateSessionUIState();
			loadSummary();
			prependRecentSession(payload);
			announce('Session saved');
		}).catch(err => {
			console.error(err);
			showToast('Error', 'Failed to save session.');
			announce('Error saving session');
		}).finally(finalizeCleanup);
	}
	function finalizeCleanup() { delete dom.finalizeForm.dataset.submitting; if (dom.finalizeSubmit) dom.finalizeSubmit.disabled = false; }

	function resetSessionState() {
		sessionState.active = false;
		sessionState.paused = false;
		sessionState.startTs = null;
		sessionState.elapsedAccumMs = 0;
		sessionState.sessionId = null;
		dom.timerDisplay.textContent = '00:00';
		clearPersistedTimer();
	}

	function updateSessionUIState() {
		const { active, paused } = sessionState;
		if (!active) {
			clearInterval(timerInterval);
			dom.startBtn.classList.remove('hidden');
			[dom.pauseBtn, dom.resumeBtn, dom.logBtn, dom.cancelBtn].forEach(btn=>btn.classList.add('hidden'));
			if (dom.manualOpenBtn) dom.manualOpenBtn.disabled = false;
			if (dom.startBtn) { dom.startBtn.disabled = false; if (dom.startBtn.textContent !== 'Start Session') dom.startBtn.textContent = 'Start Session'; }
			dom.sessionStatusTitle.textContent = 'No Active Session';
			dom.sessionStatusBadge.textContent = 'Idle';
			dom.sessionStatusBadge.classList.remove('active','idle');
			announce('No active session');
			return;
		}
		dom.startBtn.classList.add('hidden');
		if (dom.manualOpenBtn) dom.manualOpenBtn.disabled = true;
		if (paused) {
			dom.pauseBtn.classList.add('hidden');
			dom.resumeBtn.classList.remove('hidden');
			dom.logBtn.classList.remove('hidden');
			announce('Session paused');
			dom.sessionStatusTitle.textContent = 'Paused Session';
			dom.sessionStatusBadge.textContent = 'Paused';
			dom.sessionStatusBadge.classList.remove('active');
			dom.sessionStatusBadge.classList.add('idle');
		} else {
			dom.pauseBtn.classList.remove('hidden');
			dom.resumeBtn.classList.add('hidden');
			dom.logBtn.classList.add('hidden');
			dom.sessionStatusTitle.textContent = 'Active Session';
			dom.sessionStatusBadge.textContent = 'Active';
			dom.sessionStatusBadge.classList.remove('idle');
			dom.sessionStatusBadge.classList.add('active');
		}
		dom.cancelBtn.classList.remove('hidden');
	}


	// manual logging
	function handleManualSubmit(e) {
		e.preventDefault();
		if (dom.manualSubmitBtn && dom.manualSubmitBtn.disabled) return;
		const minutes = Number(dom.manualMinutes?.value);
		const notes = (dom.manualNotes?.value || '').trim();
		const dateStr = dom.manualDate?.value || getTodayLocalISO();
		if (!minutes || minutes < 1) { showToast('Validation', 'Enter a valid minute count.'); return; }
		if (minutes > 720) { showToast('Validation', 'Minutes exceed max (720).'); return; }
		if (dom.manualSubmitBtn) dom.manualSubmitBtn.disabled = true;
		const payload = { durationMinutes: minutes, notes, manual: true, date: dateStr };
		saveManualSession(payload).then(() => {
			showToast('Logged', `${minutes} minute${minutes===1?'':'s'} added.`);
			loadSummary();
			prependRecentSession(payload);
			e.target.reset();
			initDates();
		}).catch(err => {
			console.error(err);
			showToast('Error', 'Failed to log session.');
		}).finally(() => { if (dom.manualSubmitBtn) dom.manualSubmitBtn.disabled = false; updateNoteCounters(); });
	}

	function openManualModal() {
		if (!dom.manualModal) return;
		initDates();
		dom.manualModal.classList.remove('hidden');
		setActiveModal(dom.manualModal, 'input, textarea, button');
		announce('Manual log dialog opened');
	}
	function closeManualModal() {
		if (dom.manualModal && !dom.manualModal.classList.contains('hidden')) {
			dom.manualModal.classList.add('hidden');
			if (activeModal === dom.manualModal) setActiveModal(null);
			announce('Manual log dialog closed');
		}
	}

	function prependRecentSession(session) {
		dom.recentEmpty?.remove();
		const li = renderRecentSession(session);
		dom.recentList.prepend(li);
		const items = dom.recentList.querySelectorAll('li');
		if (items.length > 10) items[items.length - 1].remove();
	} 

	function renderRecentSession(session) {
		const li = document.createElement('li');
		li.classList.add('fade-in');
		const minutes = session.durationMinutes || 0;
		const whenLabel = session.manual ? 'Manual' : 'Just now';
		const dt = session.date ? new Date(session.date + 'T00:00:00') : new Date();
		const now = new Date();
		let dateLabel;
		if (dt.toDateString() === now.toDateString()) {
			dateLabel = 'Today';
		} else {
			dateLabel = dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
		}
		const title = dateLabel + (session.manual ? ' (Manual)' : '');
		li.innerHTML = `
			<div class="recent-top">
				<div class="piece">${escapeHTML(title)}</div>
				<div class="meta"><span>${minutes} min</span><span>${whenLabel}</span></div>
			</div>
		`;
		return li;
	}

	// caching helpers
	function writeMeta(val) { try { localStorage.setItem(PRACTICE_META_KEY, JSON.stringify(val)); } catch {} }
	function readCacheWithAge(key) {
		try {
			const raw = localStorage.getItem(key); if (!raw) return null;
			const parsed = JSON.parse(raw);
			if (parsed && parsed._ts && parsed.data) {
				if (Date.now() - parsed._ts > CACHE_TTL_MS) return null;
				return parsed.data;
			}
			return parsed;
		} catch { return null; }
	}
	function writeCacheWithAge(key,data) { try { localStorage.setItem(key, JSON.stringify({ data, _ts: Date.now() })); } catch {} }

	async function loadSummary(forceRefresh=false) {
		try {
			if (!forceRefresh) {
				const cached = readCacheWithAge(PRACTICE_DATA_KEY);
				if (cached) {
					practiceData = cached;
					cachedSummary = computeSummary(practiceData);
					updateSummaryUI(cachedSummary);
					return;
				}
			}
			practiceData = await fetchFullPracticeData();
			writeCacheWithAge(PRACTICE_DATA_KEY, practiceData);
			cachedSummary = computeSummary(practiceData);
			updateSummaryUI(cachedSummary);
			showToast('Refreshed', 'Reloaded summary');
		} catch (e) {
			console.error(e);
			showToast('Error', 'Could not load summary.');
		}
	}

	function updateSummaryUI(data) {
		const weekMinutes = data.weekMinutes || 0;
		const weekGoal = data.weekGoal || 0;
		dom.summaryWeekMinutesLabel.textContent = `${weekMinutes} min`;
		dom.weekGoalLabel.textContent = `Goal: ${weekGoal}`;
		const pct = weekGoal ? Math.min(100, (weekMinutes / weekGoal) * 100) : 0;
		dom.weekProgressBar.style.width = pct + '%';
		dom.streakValue.textContent = (data.streakDays || 0) + '🔥';
		dom.weekSessionsValue.textContent = data.weekSessions || 0;
		if (Array.isArray(data.recentSessions) && data.recentSessions.length) {
			dom.recentList.innerHTML = '';
			data.recentSessions.forEach(s => dom.recentList.appendChild(renderRecentSession(s)));
		}
		const topPieceEl = document.getElementById('insight-top-piece');
		const avgLenEl = document.getElementById('insight-avg-length');
		const gapEl = document.getElementById('insight-gap');
		if (topPieceEl) {
			const first = data.recentSessions && data.recentSessions[0];
			if (first) {
				const dt = first.date ? new Date(first.date + 'T00:00:00') : new Date();
				const label = dt.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
				const snippet = first.notes ? first.notes.slice(0,30) : 'Logged session';
				topPieceEl.textContent = `${label}: ${snippet}`;
			} else {
				topPieceEl.textContent = 'No sessions yet';
			}
		}
		if (avgLenEl) {
			const sessions = data.recentSessions || [];
			const avg = sessions.length ? Math.floor(sessions.reduce((a,s)=>a+(s.durationMinutes||0),0)/sessions.length) : 0;
			avgLenEl.textContent = `Avg Length: ${avg} min`;
		}
		if (gapEl) {
			gapEl.textContent = 'Next: Keep the streak!';
		}
	}

	// trends
	let trendsCache = null; let lastTrendsFetch = 0; const TRENDS_TTL = 60 * 1000; // 1 min
	async function loadTrends(force=false) {
		try {
			if (!force && trendsCache && Date.now() - lastTrendsFetch < TRENDS_TTL) { renderTrends(trendsCache); return; }
			const token = await auth0Client.getTokenSilently();
			const res = await fetch('/api/getPracticeTrends', { headers:{ 'Authorization':`Bearer ${token}` }});
			if (!res.ok) throw new Error('trends fetch');
			const data = await res.json();
			trendsCache = data; lastTrendsFetch = Date.now();
			renderTrends(data);
		} catch (e) { console.warn('trends load failed', e); }
	}

	function renderTrends(data) {
		if (!data || !Array.isArray(data.days)) return;
		maybeRenderCalendarHeatmap();
		const recoEl = document.getElementById('insight-reco');
		if (recoEl && data.recommendation) recoEl.textContent = data.recommendation;
		const mini = document.getElementById('practice-mini-metrics');
		if (mini) {
			const s = data.summary || {}; const st = data.streak || {}; 
			mini.innerHTML = '';
			mini.appendChild(makeMM('Last 7', (s.last7Minutes||0)+'m'));
			mini.appendChild(makeMM('Last 14', (s.last14Minutes||0)+'m'));
			mini.appendChild(makeMM('Avg Session', (s.avgSessionLength||0)+'m'));
			mini.appendChild(makeMM('Sessions', s.sessionsCount||0));
			mini.appendChild(makeMM('Streak', (st.current||0)+'d')); 
		}
	}

	// calendar heatmap
	let calHeatmapInstance = null; let calendarDataLoaded = false; let calendarInitPending = false;
	let calendarSourceDays = null;
	let calendarLayout = null;
	let calendarConfig = null;
	let calendarCompactMode = true;
	let calendarPrefLoaded = false;

	// IndexedDB setup
	const CAL_DB = { NAME: 'mobank-db', VERSION: 3, STORE: 'preferences' };
	let calDBInstance = null;
	async function initCalDB() {
		if (calDBInstance) return calDBInstance;
		calDBInstance = await new Promise((resolve, reject) => {
			const req = indexedDB.open(CAL_DB.NAME, CAL_DB.VERSION);
			req.onupgradeneeded = e => {
				const db = e.target.result;
				if (!db.objectStoreNames.contains('themeStore')) db.createObjectStore('themeStore');
				if (!db.objectStoreNames.contains('preferences')) db.createObjectStore('preferences', { keyPath: 'key' });
			};
			req.onsuccess = ev => resolve(ev.target.result);
			req.onerror = () => reject(req.error);
		});
		return calDBInstance;
	}
	async function getCalendarPref() {
		try {
			const db = await initCalDB();
			return await new Promise(resolve => {
				const tx = db.transaction('preferences','readonly');
				const store = tx.objectStore('preferences');
				const getReq = store.get('practiceCalendarRange');
				getReq.onsuccess = () => resolve(getReq.result ? getReq.result.value : null);
				getReq.onerror = () => resolve(null);
			});
		} catch { return null; }
	}
	async function setCalendarPref(val) {
		try {
			const db = await initCalDB();
			await new Promise((resolve,reject)=>{
				const tx = db.transaction('preferences','readwrite');
				const store = tx.objectStore('preferences');
				const putReq = store.put({ key:'practiceCalendarRange', value: val, updated: Date.now() });
				putReq.onsuccess = resolve; putReq.onerror = () => reject(putReq.error);
			});
		} catch(e) { /* silent */ }
	}
	function determineInitialCalendarMode(winWidth) {
		return !(winWidth >= 1440);
	}
async function maybeRenderCalendarHeatmap() {
	const container = document.getElementById('calendar-heatmap');
	if (!container) return;
	if (calendarInitPending) return;
	if (typeof window.CalHeatmap === 'undefined' || typeof window.Legend === 'undefined') { setTimeout(maybeRenderCalendarHeatmap, 200); return; }
	if (!calendarDataLoaded) {
		calendarInitPending = true;
		try {
			const token = await auth0Client.getTokenSilently();
			const res = await fetch('/api/getPracticeTrends?days=400', { headers:{ 'Authorization':`Bearer ${token}` }});
			if (!res.ok) throw new Error('calendar trends failed');
			const data = await res.json();
			if (!calendarPrefLoaded) {
				const stored = await getCalendarPref();
				if (stored === '6mo') calendarCompactMode = true; else if (stored === '12mo') calendarCompactMode = false; else calendarCompactMode = determineInitialCalendarMode(window.innerWidth);
				calendarPrefLoaded = true;
			}
			calendarDataLoaded = true;
			if (calendarCompactMode) container.classList.add('compact-mode'); else container.classList.remove('compact-mode');
			buildCalendarChart(container, data.days || []);
			setupCalendarRangeToggle(container, { reveal: true });
		} catch(e) { console.warn('calendar heatmap load error', e); }
		finally { calendarInitPending = false; }
	} else if (calendarConfig && !calHeatmapInstance) {
		setupCalendarRangeToggle(container, { reveal: true });
		paintCalendar(container);
	}
}

function buildCalendarChart(container, days) {
	calendarSourceDays = days;
	const now = new Date();
	const monthsBack = calendarCompactMode ? 5 : 11;
	const start = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
	const filtered = days.filter(d => {
		const parts = d.date.split('-');
		if (parts.length !== 3) return false;
		const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
		return dt >= start && dt <= now;
	});
	const source = filtered.map(d => ({ date: d.date, minutes: d.minutes }));
	const maxVal = Math.max(0, ...source.map(s => s.minutes));
	let thresholds = [1,10,30,60];
	if (maxVal > 0 && maxVal < 60) {
		const q1 = 1;
		const q2 = Math.max(2, Math.round(maxVal * 0.25));
		const q3 = Math.max(q2+1, Math.round(maxVal * 0.55));
		const q4 = Math.max(q3+1, Math.round(maxVal * 0.8));
		thresholds = Array.from(new Set([q1,q2,q3,q4])).filter(n=>n>0).sort((a,b)=>a-b);
	}
	const dark = document.documentElement.getAttribute('data-theme') === 'dark';
	const zeroColor = dark ? '#2a2d31' : '#ebedf0';
	const palette = [zeroColor, '#9be9a8', '#30c463', '#30a14e', '#216e39'];
	calendarConfig = { thresholds, palette, start, now, source };
	paintCalendar(container);
}

function getCalendarWeeks(start, end) {
	const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
	const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
	const sSunday = new Date(s.getFullYear(), s.getMonth(), s.getDate() - s.getDay());
	const eSundayNext = new Date(e.getFullYear(), e.getMonth(), e.getDate() - e.getDay() + 7);
	return Math.round((eSundayNext - sSunday) / (7 * 86400000));
}

function computeCalendarLayout(containerWidth, containerHeight, weeks, compact) {
	const MIN_CELL = 8;
	const MAX_CELL = 20;
	let gutter = 2;
	const EDGE_PAD = 4;
	const extraPad = compact ? 4 : 0;
	let innerWidth = containerWidth - EDGE_PAD * 2 - extraPad;
	if (innerWidth < 100) innerWidth = containerWidth;
	let cell = Math.floor((innerWidth - (weeks - 1) * gutter) / weeks);
	if (cell < MIN_CELL) {
		gutter = 1;
		cell = Math.floor((innerWidth - (weeks - 1) * gutter) / weeks);
		if (cell < MIN_CELL) cell = MIN_CELL;
	}
	if (cell > MAX_CELL) {
		while (cell > MAX_CELL && gutter < 4) {
			gutter++;
			cell = Math.floor((innerWidth - (weeks - 1) * gutter) / weeks);
		}
		cell = Math.min(cell, MAX_CELL);
	}
	if (containerHeight && containerHeight > 0) {
		const labelH = 16;
		const avail = containerHeight - (EDGE_PAD * 2 + extraPad) - labelH;
		if (avail > 0) {
			const maxByHeight = Math.floor((avail - gutter * 6) / 7);
			if (maxByHeight > 0 && maxByHeight < cell) {
				cell = Math.max(MIN_CELL, maxByHeight);
			}
		}
	}
	return { cell, gutter, weeks, edgePad: EDGE_PAD, extraPad };
}

function paintCalendar(container) {
	if (!calendarConfig) return;
	const now = calendarConfig.now || new Date();
	const monthsBack = calendarCompactMode ? 5 : 11;
	calendarConfig.start = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
	const { thresholds, palette, start, source } = calendarConfig;
	container.innerHTML = '';
	const weeks = getCalendarWeeks(start, now);
	const layout = computeCalendarLayout(container.clientWidth, container.getBoundingClientRect().height || 0, weeks, calendarCompactMode);
	calendarLayout = layout;
	const DOMAIN_GUTTER = 3;
	calHeatmapInstance = new window.CalHeatmap();
	calHeatmapInstance.paint({
		itemSelector: '#calendar-heatmap',
		range: calendarCompactMode ? 6 : 12,
		date: { start, highlight: [now] },
		domain: { type: 'month', gutter: DOMAIN_GUTTER, dynamicDimension: false, label: { text: 'MMM', position: 'top', textAlign: 'start' } },
		subDomain: { type: 'ghDay', width: layout.cell, height: layout.cell, gutter: layout.gutter, radius: 3, label: null },
		data: { source, x: 'date', y: 'minutes', groupY: 'sum', defaultValue: 0 },
		scale: { color: { type: 'threshold', domain: thresholds, range: palette } },
		animationDuration: 150,
	}, [
		[window.Legend, { itemSelector: '#calendar-legend', label: 'Minutes per day' }]
	]).then(() => {
		try { adjustMonthBackgrounds(container, DOMAIN_GUTTER); } catch {}
		try { addCalendarWrapper(container); } catch {}
		try { assignCalendarCellDates(container, layout); } catch (e) { console.warn('assignCalendarCellDates failed', e); }
		try { applyCalendarA11y(container); } catch {}
		try { applyInternalSVGPadding(container, layout.edgePad + (calendarCompactMode ? 4 : 0)); } catch {}
		try { reflectCalendarContainerMode(container); } catch {}
	});
}

function reflectCalendarContainerMode(container) {
	const calEl = container;
	if (!calEl) return;
	if (calendarCompactMode) calEl.classList.add('compact-mode'); else calEl.classList.remove('compact-mode');
	const toggle = document.getElementById('calendar-range-toggle');
	if (toggle) {
		toggle.checked = !calendarCompactMode;
		const six = document.querySelector('.cal-range-label.cal-range-6');
		const twelve = document.querySelector('.cal-range-label.cal-range-12');
		if (six && twelve) {
			six.classList.toggle('active', calendarCompactMode);
			twelve.classList.toggle('active', !calendarCompactMode);
		}
	}
}

function setupCalendarRangeToggle(container, opts={}) {
	const toggle = document.getElementById('calendar-range-toggle');
	const wrapper = document.getElementById('calendar-range-toggle-wrapper');
	if (!toggle) return;
	reflectCalendarContainerMode(container);
	if (!toggle.dataset.bound) {
		toggle.addEventListener('change', async () => {
			calendarCompactMode = !toggle.checked;
			await setCalendarPref(calendarCompactMode ? '6mo' : '12mo');
			paintCalendar(container);
		});
		toggle.dataset.bound = '1';
	}
	if (opts.reveal && wrapper && wrapper.hasAttribute('hidden')) {
		wrapper.hidden = false;
	}
}

function adjustMonthBackgrounds(container, DOMAIN_GUTTER) {
	const bgs = container.querySelectorAll('.ch-domain-bg');
	bgs.forEach((bg, idx) => {
		if (idx === bgs.length - 1) return;
		const w = parseFloat(bg.getAttribute('width'));
		if (!isNaN(w)) bg.setAttribute('width', (w + DOMAIN_GUTTER) + '');
	});
}

function addCalendarWrapper(container) {
	const svg = container.querySelector('svg');
	if (svg && !container.querySelector('.cal-inner')) {
		const wrap = document.createElement('div');
		wrap.className = 'cal-inner';
		container.appendChild(wrap);
		wrap.appendChild(svg);
	}
}

function applyCalendarA11y(container) {
	const rects = container.querySelectorAll('rect');
	rects.forEach(rect => {
		if (rect.classList.contains('ch-domain-bg')) return;
		let dateObj = extractRectDate(rect);
		if (!dateObj || isNaN(dateObj.getTime())) return;
		const val = rect.getAttribute('data-value') || '0';
		const iso = dateObj.toISOString().slice(0,10);
		rect.setAttribute('role','img');
		rect.setAttribute('tabindex','0');
		rect.setAttribute('aria-label', `${iso} ${val} minutes`);
	});
	initCalendarTooltipDelegation(container);
}

function extractRectDate(rect) {
	const attrs = [
		() => rect.getAttribute('data-timestamp'),
		() => rect.parentElement && rect.parentElement.getAttribute('data-timestamp'),
		() => rect.getAttribute('data-date'),
		() => rect.getAttribute('data-cal-date'),
		() => rect.parentElement && rect.parentElement.getAttribute('data-date'),
		() => rect.parentElement && rect.parentElement.getAttribute('data-cal-date')
	];
	for (const getter of attrs) {
		const raw = getter();
		if (!raw) continue;
		if (/^\d+$/.test(raw)) {
			const num = Number(raw);
			if (!Number.isNaN(num) && num > 1000) return new Date(num * (num < 1e12 ? 1000 : 1));
		}
		if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(raw + 'T00:00:00');
	}
	return null;
}

let calendarTooltipDelegated = false;
function initCalendarTooltipDelegation(container) {
	if (calendarTooltipDelegated) return;
	calendarTooltipDelegated = true;
	container.addEventListener('mousemove', e => {
		const rectEl = findCalendarCellRect(e.target);
		if (!rectEl) { hideCalTooltip(); return; }
		const dateObj = extractRectDate(rectEl);
		if (!dateObj) { hideCalTooltip(); return; }
		const val = rectEl.getAttribute('data-value') || '0';
		showCalTooltip(rectEl, dateObj, val, e);
	});
	container.addEventListener('mouseleave', hideCalTooltip);
	container.addEventListener('focusin', e => {
		const rectEl = findCalendarCellRect(e.target);
		if (!rectEl) return;
		const dateObj = extractRectDate(rectEl);
		if (!dateObj) return;
		const val = rectEl.getAttribute('data-value') || '0';
		showCalTooltip(rectEl, dateObj, val);
	});
	container.addEventListener('focusout', hideCalTooltip);
}

function findCalendarCellRect(el) {
	if (!el) return null;
	if (el.tagName === 'rect' || el.tagName === 'RECT') {
		if (el.classList.contains('ch-domain-bg')) return null;
		return el;
	}
	if (el.querySelector) {
		const r = el.querySelector('rect');
		if (r && !r.classList.contains('ch-domain-bg')) return r;
	}
	return null;
}

function assignCalendarCellDates(container, layout) {
	if (!calendarConfig) return;
	const rects = Array.from(container.querySelectorAll('rect.ch-subdomain-bg'));
	if (!rects.length) return;
	const lefts = rects.map(r => Math.round(r.getBoundingClientRect().left));
	const uniqueLefts = Array.from(new Set(lefts)).sort((a,b)=>a-b);
	const leftToWeek = new Map(); uniqueLefts.forEach((val, idx) => leftToWeek.set(val, idx));
	const tops = rects.map(r => Math.round(r.getBoundingClientRect().top));
	const uniqueTops = Array.from(new Set(tops)).sort((a,b)=>a-b);
	const topToDay = new Map(); uniqueTops.forEach((val, idx) => topToDay.set(val, idx));

	const start = calendarConfig.start;
	let baseSunday = new Date(start.getFullYear(), start.getMonth(), start.getDate() - start.getDay());
	const today = calendarConfig.now || new Date();

	const highlight = container.querySelector('rect.highlight.ch-subdomain-bg, rect.ch-subdomain-bg.highlight');
	if (highlight) {
		const hbr = highlight.getBoundingClientRect();
		const hWeek = leftToWeek.get(Math.round(hbr.left));
		const hDay = topToDay.get(Math.round(hbr.top));
		if (hWeek != null && hDay != null) {
			const predicted = new Date(baseSunday.getFullYear(), baseSunday.getMonth(), baseSunday.getDate() + hWeek*7 + hDay);
			const norm = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
			const pd = norm(predicted); const td = norm(today);
			const diffDays = Math.round((pd - td)/86400000);
			if (diffDays !== 0) {
				baseSunday = new Date(baseSunday.getFullYear(), baseSunday.getMonth(), baseSunday.getDate() - diffDays);
			}
		}
	} else {
		const sample = rects[0];
		if (sample) {
			const br = sample.getBoundingClientRect();
			const w = leftToWeek.get(Math.round(br.left));
			const d = topToDay.get(Math.round(br.top));
			if (w != null && d != null) {
				const predictedFirst = new Date(baseSunday.getFullYear(), baseSunday.getMonth(), baseSunday.getDate() + w*7 + d);
				if (predictedFirst > start) {
					const deltaWeeks = Math.round((predictedFirst - start)/(7*86400000));
					if (deltaWeeks > 0) baseSunday = new Date(baseSunday.getFullYear(), baseSunday.getMonth(), baseSunday.getDate() - deltaWeeks*7);
				}
			}
		}
	}
	// minutes lookup map
	const minutesMap = new Map(); calendarConfig.source.forEach(d => minutesMap.set(d.date, d.minutes));

	rects.forEach(r => {
		const br = r.getBoundingClientRect();
		const weekIdx = leftToWeek.get(Math.round(br.left));
		const dayIdx = topToDay.get(Math.round(br.top));
		if (weekIdx == null || dayIdx == null) return;
		const dateObj = new Date(baseSunday.getFullYear(), baseSunday.getMonth(), baseSunday.getDate() + weekIdx*7 + dayIdx);
		if (dateObj < baseSunday || dateObj > today) return; // future or before anchor
		const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}`;
		r.setAttribute('data-date', dateStr);
		r.setAttribute('data-timestamp', Math.floor(dateObj.getTime()/1000));
		const mins = minutesMap.get(dateStr) || 0;
		r.setAttribute('data-value', String(mins));
	});
}

function applyInternalSVGPadding(container, pad) {
	const svg = container.querySelector('svg');
	if (!svg) return;
	let inner = svg.querySelector('g[data-innerwrap="1"]');
	if (!inner) {
		inner = document.createElementNS('http://www.w3.org/2000/svg','g');
		inner.setAttribute('data-innerwrap','1');
		while (svg.firstChild) inner.appendChild(svg.firstChild);
		svg.appendChild(inner);
	}
	inner.setAttribute('transform', `translate(${pad},${pad})`);
	const w = parseFloat(svg.getAttribute('width'));
	const h = parseFloat(svg.getAttribute('height'));
	if (!isNaN(w)) svg.setAttribute('width', (w + pad * 2) + '');
	if (!isNaN(h)) svg.setAttribute('height', (h + pad * 2) + '');
}

function repaintCalendarOnResize() {
	const container = document.getElementById('calendar-heatmap');
	if (!container || !calendarConfig) return;
	const weeks = getCalendarWeeks(calendarConfig.start, calendarConfig.now);
	const newLayout = computeCalendarLayout(container.clientWidth, weeks);
	if (!calendarLayout || newLayout.cell !== calendarLayout.cell || newLayout.gutter !== calendarLayout.gutter) {
		paintCalendar(container);
	}
}
	function showCalTooltip(cell, dateObj, val, ev) {
		let tooltip = document.getElementById('practice-cal-tooltip');
		if (!tooltip) {
			tooltip = document.createElement('div');
			tooltip.id = 'practice-cal-tooltip';
			tooltip.className = 'practice-cal-tooltip';
			document.body.appendChild(tooltip);
		}
		const mins = Number(val)||0;
		const month = dateObj.toLocaleString('en-US',{ month:'long'});
		const day = dateObj.getDate();
		const suf = n => (n%10==1 && n%100!=11)?'st':(n%10==2 && n%100!=12)?'nd':(n%10==3 && n%100!=13)?'rd':'th';
		tooltip.textContent = `${mins} minute${mins===1?'':'s'} on ${month} ${day}${suf(day)}`;
		let x; let y;
		if (ev && ev.clientX) {
			x = ev.clientX + 8;
			y = ev.clientY + window.scrollY - 18;
		} else {
			const rect = cell.getBoundingClientRect();
			x = rect.left + window.scrollX + rect.width/2;
			y = rect.top + window.scrollY - 6;
		}
		tooltip.style.left = x + 'px';
		tooltip.style.top = y + 'px';
		tooltip.style.opacity = '1';
	}
	function hideCalTooltip() {
		const t = document.getElementById('practice-cal-tooltip');
		if (t) t.style.opacity = '0';
	}

	let resizeTimer = null;
	window.addEventListener('resize', () => {
		if (resizeTimer) clearTimeout(resizeTimer);
		resizeTimer = setTimeout(() => { repaintCalendarOnResize(); }, 90);
	});

	const observer = new MutationObserver(muts => {
		if (!calHeatmapInstance) return;
		for (const m of muts) {
			if (m.type === 'attributes' && m.attributeName === 'data-theme') {
				const dark = document.documentElement.getAttribute('data-theme') === 'dark';
				const zero = dark ? '#2a2d31' : '#d9dde2';
				document.querySelectorAll('#calendar-heatmap rect[data-value="0"], #calendar-heatmap rect:not([data-value])').forEach(r=>{ r.setAttribute('fill', zero); });
				break;
			}
		}
	});
	observer.observe(document.documentElement, { attributes:true });

	function makeMM(label, value) {
		const div = document.createElement('div');
		div.className = 'mm-item';
		div.innerHTML = `<span>${label}</span><span class="value">${value}</span>`;
		return div;
	}

	async function saveGoal() {
		const val = Number(dom.goalInput.value);
		if (Number.isNaN(val) || val < 0 || val > 10080) { // 10080 minutes in a week, for the idiots who want to set it that high
			showToast('Validation', 'Enter a valid goal (0-10080)');
			return;
		}
		try {
			const token = await auth0Client.getTokenSilently();
			const res = await fetch('/api/setPracticeGoal', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify({ goal: val }) });
			if (!res.ok) throw new Error('bad goal save');
			if (practiceData) practiceData.goal = val;
			cachedSummary = computeSummary(practiceData);
			updateSummaryUI(cachedSummary);
			localStorage.removeItem(PRACTICE_DATA_KEY); // force fresh on next load
			writeMeta({ hash: 'invalid' });
			showToast('Goal Saved', `Weekly goal set to ${val} min.`);
		} catch (e) {
			console.error(e);
			showToast('Error', 'Failed to save goal');
		}
	}

	async function fetchFullPracticeData() {
		const token = await auth0Client.getTokenSilently();
		const res = await fetch('/api/getPracticeData', { headers: { 'Authorization': `Bearer ${token}` }});
		if (!res.ok) throw new Error('fetch practice data failed');
		const data = await res.json();
		if (!data.chunks) data.chunks = [];
		return data;
	}
	function flattenSessions(pd) {
		if (!pd || !Array.isArray(pd.chunks)) return [];
		const out = [];
		for (const ch of pd.chunks) {
			if (!ch.sessions) continue;
			for (const s of ch.sessions) {
				out.push({
					date: s.d,
					durationMinutes: s.m || 0,
					notes: s.n,
					manual: !!s.man,
					sessionId: s.sid,
					timestamp: parseSessionTimestamp(s.t, s.d)
				});
			}
		}
		out.sort((a,b)=> b.timestamp - a.timestamp);
		return out;
	}
	function parseSessionTimestamp(t, dStr) {
		if (!t) {
			if (dStr) return new Date(dStr + 'T00:00:00').getTime();
			return Date.now();
		}
		if (t._seconds) return t._seconds * 1000;
		if (t.seconds) return t.seconds * 1000;
		try { return new Date(t).getTime() || Date.now(); } catch { return Date.now(); }
	}
	function getWeekStartSunday(dateObj) {
		const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
		const day = d.getDay();
		return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day); // sunday, even though monday is obviously the start of the week
	}
	function dateToLocalISO(d) {
		const y = d.getFullYear();
		const m = String(d.getMonth()+1).padStart(2,'0');
		const day = String(d.getDate()).padStart(2,'0');
		return `${y}-${m}-${day}`;
	}
	function computeSummary(pd) {
		const sessions = flattenSessions(pd);
		const goal = pd?.goal || 0;
		const now = new Date();
		const weekStart = getWeekStartSunday(now);
		const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7); // exclusive
		let weekMinutes = 0; let weekSessions = 0;
		const todayStr = getTodayLocalISO();
		for (const s of sessions) {
			if (!s.date) continue;
			const sDate = new Date(s.date + 'T00:00:00');
			if (sDate >= weekStart && sDate < weekEnd) {
				weekMinutes += s.durationMinutes || 0;
				weekSessions += 1;
			}
		}
		const datesMap = sessions.reduce((acc,s)=>{ if (s.date) acc[s.date]=true; return acc; }, {});
		let refDate = new Date();
		const todayISO = dateToLocalISO(refDate);
		if (!datesMap[todayISO]) {
			// streak logic
			refDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate()-1);
		}
		let streak = 0; let cursor = refDate;
		while (true) {
			const ds = dateToLocalISO(cursor);
			if (datesMap[ds]) { streak++; cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()-1); }
			else break;
		}
		const recentSessions = sessions.slice(0, RECENT_LIMIT);
		return {
			weekMinutes,
			weekGoal: goal,
			weekSessions,
			streakDays: streak,
			recentSessions
		};
	}
	async function saveManualSession(payload) {
		const minutes = payload.durationMinutes;
		const body = { minutes, notes: payload.notes, date: payload.date };
		const token = await auth0Client.getTokenSilently();
		const res = await fetch('/api/logPracticeSession', { method:'POST', headers:{ 'Authorization':`Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify(body) });
		if (!res.ok) {
			if (res.status === 400) {
				const j = await res.json().catch(()=>({message:'Validation failed'}));
				throw new Error(j.message || 'Validation failed');
			}
			throw new Error('log failed');
		}
		writeMeta({ hash: 'invalid' });
		localStorage.removeItem(PRACTICE_DATA_KEY);
	}
	async function saveFinalizedSession(payload) {
		const body = { sessionId: payload.sessionId, durationMinutes: payload.durationMinutes, notes: payload.notes, date: payload.date };
		const token = await auth0Client.getTokenSilently();
		const res = await fetch('/api/endPracticeSession', { method:'POST', headers:{ 'Authorization':`Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify(body) });
		if (!res.ok) {
			if (res.status === 409) {
				const msg = (await res.json().catch(()=>({message:'Conflict'}))).message;
				throw new Error(msg || 'Conflict');
			}
			const j = await res.json().catch(()=>({message:'Save failed'}));
			throw new Error(j.message || 'Save failed');
		}
		writeMeta({ hash: 'invalid' });
		localStorage.removeItem(PRACTICE_DATA_KEY);
	}

	// timer persistence
	let lastPersist = 0;
	const PERSIST_INTERVAL_MS = 10000;
	function persistTimerState(force=false) {
		try {
			if (!sessionState.active) { clearPersistedTimer(); return; }
			const now = Date.now();
			if (!force && now - lastPersist < PERSIST_INTERVAL_MS) return;
			lastPersist = now;
			const payload = {
				v:1,
				active: sessionState.active,
				paused: sessionState.paused,
				startTs: sessionState.startTs,
				elapsedAccumMs: sessionState.elapsedAccumMs,
				sessionId: sessionState.sessionId,
				_savedAt: now
			};
			localStorage.setItem(TIMER_KEY, JSON.stringify(payload));
		} catch {}
	}
	function clearPersistedTimer() { try { localStorage.removeItem(TIMER_KEY); } catch {} }
	function restoreTimerFromStorage() {
		try {
			const raw = localStorage.getItem(TIMER_KEY); if (!raw) return;
			const data = JSON.parse(raw);
			if (!data || !data.active) return;
			const ageMinutes = (Date.now() - (data.startTs || Date.now())) / 60000;
			if (ageMinutes > TIMER_MAX_IDLE_MINUTES) { clearPersistedTimer(); return; }
			sessionState.active = true;
			sessionState.paused = !!data.paused;
			sessionState.startTs = data.startTs;
			sessionState.elapsedAccumMs = data.elapsedAccumMs || 0;
			sessionState.sessionId = data.sessionId || sessionState.sessionId || null;
			if (!sessionState.paused) {
				startTimerInterval();
			} else {
				updateElapsed();
			}
			updateSessionUIState();
		} catch {}
	}

	function updateNoteCounters() {
		if (dom.manualNotes && dom.manualNotesCounter) {
			const len = dom.manualNotes.value.length;
			dom.manualNotesCounter.textContent = `${len}/200`;
			dom.manualNotesCounter.classList.toggle('near-limit', len > 170);
		}
		if (dom.finalNotes && dom.finalNotesCounter) {
			const len2 = dom.finalNotes.value.length;
			dom.finalNotesCounter.textContent = `${len2}/200`;
			dom.finalNotesCounter.classList.toggle('near-limit', len2 > 170);
		}
	}
	['input','change'].forEach(ev => document.addEventListener(ev, e => { if (e.target === dom.manualNotes || e.target === dom.finalNotes) updateNoteCounters(); }));

	window.addEventListener('storage', e => {
		if (e.key === TIMER_KEY) {
			if (!e.newValue) { if (sessionState.active) { resetSessionState(); updateSessionUIState(); } }
			else if (!sessionState.active) { restoreTimerFromStorage(); }
		}
	});

	updateNoteCounters();

	// utilities
	function escapeHTML(str) { return str.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c] || c)); }

	// initial ARIA announcement
	announce('Practice page ready');

})();
