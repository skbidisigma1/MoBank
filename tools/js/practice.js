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

	// New caching keys (meta-driven)
	const PRACTICE_RAW_KEY = 'practiceDataRawV1'; // raw chunks + goal
	const PRACTICE_META_KEY = 'practiceMetaV1'; // meta hash + last meta fetch
	const PRACTICE_COMPUTED_KEY = 'practiceComputedV1'; // derived aggregates
	const META_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes before probing meta again
	const RAW_EXPIRY_MS = 12 * 60 * 60 * 1000; // 12h soft expiry for raw cache
	const COMPUTED_VERSION = 'v2';
	const RECENT_LIMIT = 10;

	let cachedSummary = null; // summary for top stats
	let practiceData = null; // raw { goal, chunks }
	let computedCache = null; // full aggregate cache
	let currentMetaHash = null;

	document.addEventListener('DOMContentLoaded', init);

	async function init() {
		cacheDOM();
		bindEvents();
		await ensureAuth();
		restoreTimerFromStorage();
		await bootstrapPracticeData();
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
		dom.refreshSummaryBtn.addEventListener('click', () => manualRefreshPracticeData());
		dom.saveGoalBtn.addEventListener('click', saveGoal);
		dom.finalizeClose.addEventListener('click', closeFinalizeModal);
		dom.finalizeCancel.addEventListener('click', closeFinalizeModal);
		dom.finalizeForm.addEventListener('submit', finalizeSessionSubmit);
		if (dom.alertOk) dom.alertOk.addEventListener('click', closeAlertModal);
		if (dom.alertClose) dom.alertClose.addEventListener('click', closeAlertModal);
		if (dom.alertModal) dom.alertModal.addEventListener('click', e => { if (e.target === dom.alertModal) closeAlertModal(); });
		document.addEventListener('keydown', globalKeyHandler, true);
		initDates();
		// manual refresh already bound above; trends endpoint removed (computed client-side)
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
			sessionState.sessionId = data.sid || ('local-' + crypto.getRandomValues(new Uint32Array(1))[0].toString(36));
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

	// -------------------- New Caching + Meta Bootstrap --------------------
	function readJSON(key) { try { const raw = localStorage.getItem(key); if (!raw) return null; return JSON.parse(raw); } catch { return null; } }
	function persistMeta(meta, hash) { try { localStorage.setItem(PRACTICE_META_KEY, JSON.stringify({ ...meta, hash, _ts: Date.now() })); } catch {} }
	function persistRaw(raw) { try { localStorage.setItem(PRACTICE_RAW_KEY, JSON.stringify({ ...raw, _ts: Date.now() })); } catch {} }
	function persistComputed(comp) { try { localStorage.setItem(PRACTICE_COMPUTED_KEY, JSON.stringify({ version:COMPUTED_VERSION, ...comp, _ts: Date.now() })); } catch {} }
	function buildMetaHash(meta) { return [meta.goal||0, meta.lastIndex||0, meta.lastUpdated||'0'].join('|'); }
	function loadFromLocalCaches() {
		const raw = readJSON(PRACTICE_RAW_KEY);
		if (raw && raw.chunks && raw._ts && Date.now()-raw._ts < RAW_EXPIRY_MS) practiceData = { goal: raw.goal, chunks: raw.chunks };
		const comp = readJSON(PRACTICE_COMPUTED_KEY);
		if (comp && comp.version===COMPUTED_VERSION) computedCache = comp;
		const meta = readJSON(PRACTICE_META_KEY); if (meta) currentMetaHash = meta.hash;
		if (computedCache) {
			cachedSummary = computedCache.summary;
			renderMiniMetrics(computedCache);
			calendarSourceDays = computedCache.calendarDays; calendarDataLoaded = !!computedCache.calendarDays;
		}
	}
	async function fetchPracticeMeta() {
		const token = await auth0Client.getTokenSilently();
		const res = await fetch('/api/getPracticeData?meta=1', { headers:{ 'Authorization':`Bearer ${token}` }});
		if (!res.ok) throw new Error('meta fetch failed');
		return await res.json(); // { goal, lastIndex, lastUpdated }
	}
	async function bootstrapPracticeData() {
		loadFromLocalCaches();
		if (cachedSummary) updateSummaryUI(cachedSummary);
		if (calendarDataLoaded) maybeRenderCalendarHeatmapFromCached();
		const meta = readJSON(PRACTICE_META_KEY);
		const metaFresh = meta && (Date.now() - (meta._ts||0) < META_MAX_AGE_MS);
		if (metaFresh && computedCache && meta.hash === computedCache.metaHash) return; // all good
		try {
			const newMeta = await fetchPracticeMeta();
			const newHash = buildMetaHash(newMeta);
			currentMetaHash = newHash;
			persistMeta(newMeta, newHash);
			if (computedCache && computedCache.metaHash === newHash && practiceData) return; // unchanged
			practiceData = await fetchFullPracticeData();
			persistRaw(practiceData);
			computedCache = computeAllAggregates(practiceData, newHash);
			persistComputed(computedCache);
			cachedSummary = computedCache.summary; updateSummaryUI(cachedSummary); renderMiniMetrics(computedCache);
			calendarSourceDays = computedCache.calendarDays; calendarDataLoaded = true; maybeRenderCalendarHeatmapFromCached(true);
			showToast('Refreshed', 'Practice stats updated');
		} catch (e) {
			console.warn('Practice bootstrap/meta failure', e);
			if (!cachedSummary) showToast('Offline', 'Using cached stats');
		}
	}
	async function manualRefreshPracticeData() {
		showToast('Refreshing', 'Checking updates…');
		try {
			const newMeta = await fetchPracticeMeta();
			const newHash = buildMetaHash(newMeta);
			persistMeta(newMeta, newHash);
			if (computedCache && computedCache.metaHash === newHash && practiceData) { showToast('Up to date', 'No new sessions'); return; }
			practiceData = await fetchFullPracticeData(); persistRaw(practiceData);
			computedCache = computeAllAggregates(practiceData, newHash); persistComputed(computedCache);
			cachedSummary = computedCache.summary; updateSummaryUI(cachedSummary); renderMiniMetrics(computedCache);
			calendarSourceDays = computedCache.calendarDays; calendarDataLoaded = true; maybeRenderCalendarHeatmapFromCached(true);
			showToast('Refreshed', 'Practice data updated');
		} catch(e) { console.error(e); showToast('Error', 'Refresh failed'); }
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
		const avgLenEl = document.getElementById('insight-avg-length');
		if (avgLenEl) {
			const sessions = data.recentSessions || [];
			const avg = sessions.length ? Math.floor(sessions.reduce((a,s)=>a+(s.durationMinutes||0),0)/sessions.length) : 0;
			avgLenEl.textContent = `Avg Length: ${avg} min`;
		}
	}

	function renderMiniMetrics(agg) {
		const mini = document.getElementById('practice-mini-metrics'); if (!mini || !agg) return;
		mini.innerHTML = '';
		mini.appendChild(makeMM('Last 7', (agg.last7Minutes||0)+'m'));
		mini.appendChild(makeMM('Last 14', (agg.last14Minutes||0)+'m'));
		mini.appendChild(makeMM('Avg Session', (agg.avgSessionLength||0)+'m'));
		mini.appendChild(makeMM('Sessions', agg.sessionsCount||0));
		mini.appendChild(makeMM('Streak', (agg.currentStreak||0)+'d'));
	}

	// calendar heatmap
	let calendarDataLoaded = false;
	let calendarSourceDays = null;
	let calendarLayout = null;
	let calendarConfig = null;
	let calendarCompactMode = true;
	let calendarPrefLoaded = false;
	let calendarRenderAttempts = 0;

	// Debug logging helpers (disabled by default; enable by setting window.__CAL_DEBUG = true or localStorage practiceCalDebug=1)
	if (typeof window.__CAL_DEBUG === 'undefined') window.__CAL_DEBUG = false;
	function __calDebugEnabled(){ try { return !!(window.__CAL_DEBUG || localStorage.getItem('practiceCalDebug')==='1'); } catch { return false; } }
	function calLog(...args){ if (__calDebugEnabled()) try { console.log('[PracticeCal]', ...args); } catch {} }
	function calWarn(...args){ if (__calDebugEnabled()) try { console.warn('[PracticeCal]', ...args); } catch {} }

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
		} catch(e) { showToast('Error', e) }
	}
	function determineInitialCalendarMode(winWidth) {
		return !(winWidth >= 1440);
	}
async function maybeRenderCalendarHeatmap(force) {
	calLog('maybeRenderCalendarHeatmap', { force, attempts: calendarRenderAttempts });
	const container = document.getElementById('calendar-heatmap');
	if (!container) { return; }
	const needConfig = !calendarConfig && !!calendarSourceDays;
	const needInstance = calendarConfig && !container.querySelector('svg');
	if (force) { calendarConfig = null; }
	if (force || !calendarDataLoaded || needConfig || needInstance) {
		if (!calendarPrefLoaded) {
			try { const stored = await getCalendarPref(); if (stored === '6mo') calendarCompactMode = true; else if (stored === '12mo') calendarCompactMode = false; else calendarCompactMode = determineInitialCalendarMode(window.innerWidth); calendarPrefLoaded = true; } catch(e){}
		}
		if (!calendarSourceDays) {
			if (calendarRenderAttempts < 25) { calendarRenderAttempts++; setTimeout(()=>maybeRenderCalendarHeatmap(force), 400); }
			return;
		}
		if (calendarCompactMode) container.classList.add('compact-mode'); else container.classList.remove('compact-mode');
		if (!calendarConfig) {
			buildCalendarChart(container, calendarSourceDays);
		} else if (!container.querySelector('svg')) {
			paintCalendar(container);
		}
		setupCalendarRangeToggle(container, { reveal: true });
		calendarDataLoaded = true;
	}
}
	function maybeRenderCalendarHeatmapFromCached(force){ maybeRenderCalendarHeatmap(force); }

function buildCalendarChart(container, days) {
    calendarSourceDays = days;
    calendarConfig = { days };
    paintCalendar(container);
}

function paintCalendar(container) {
    if (!calendarConfig) return;
    hideCalTooltip();
    const model = window.PracticeCalendar.build(calendarConfig.days, {
        months: calendarCompactMode ? 6 : 12, width: container.clientWidth
    });
    calendarLayout = { width: container.clientWidth };
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const palette = [dark ? '#202429' : '#d9dde2', '#9be9a8', '#30c463', '#30a14e', '#216e39'];
    const max = Math.max(0, ...model.cells.map(cell => cell.minutes));
    const thresholds = max > 0 && max < 60
        ? [...new Set([1, Math.max(2, Math.round(max * .25)), Math.max(3, Math.round(max * .55)), Math.max(4, Math.round(max * .8))])]
        : [1, 10, 30, 60];
    const svgElement = (tag, attrs) => {
        const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
        Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
        return element;
    };
    const svg = svgElement('svg', { width: model.width, height: model.height, viewBox: `0 0 ${model.width} ${model.height}` });
    model.labels.forEach(label => {
        const text = svgElement('text', { x: label.x, y: model.padding + 12, fill: 'currentColor', 'font-size': 11 });
        text.textContent = label.text;
        svg.appendChild(text);
    });
    const today = window.PracticeCalendar.dateKey(new Date());
    model.cells.forEach(cell => {
        const level = thresholds.filter(threshold => cell.minutes >= threshold).length;
        const rect = svgElement('rect', {
            x: cell.x, y: cell.y, width: model.cell, height: model.cell, rx: 3,
            fill: palette[level], 'data-date': cell.date, 'data-value': cell.minutes,
            class: 'practice-calendar-cell'
        });
        if (cell.future) {
            rect.setAttribute('opacity', '.35');
            rect.setAttribute('aria-hidden', 'true');
        } else {
            rect.setAttribute('role', 'img');
            rect.setAttribute('tabindex', '0');
            rect.setAttribute('aria-label', `${cell.date}: ${cell.minutes} minutes`);
            if (cell.date === today) rect.setAttribute('stroke', 'var(--color-muted)');
        }
        svg.appendChild(rect);
    });
    const inner = document.createElement('div');
    inner.className = 'cal-inner';
    inner.appendChild(svg);
    container.replaceChildren(inner);
    container.classList.toggle('cal-scroll', model.width > container.clientWidth);
    const legend = document.getElementById('calendar-legend');
    if (legend) {
        legend.replaceChildren(document.createTextNode('Less '));
        palette.forEach(color => {
            const swatch = document.createElement('span');
            swatch.className = 'calendar-legend-swatch';
            swatch.style.backgroundColor = color;
            legend.appendChild(swatch);
        });
        legend.appendChild(document.createTextNode(' More'));
    }
    reflectCalendarContainerMode(container);
    initCalendarTooltipDelegation(container);
}

function reflectCalendarContainerMode(container) {
    container.classList.toggle('compact-mode', calendarCompactMode);
    const toggle = document.getElementById('calendar-range-toggle');
    if (toggle) toggle.checked = !calendarCompactMode;
    document.querySelector('.cal-range-label.cal-range-6')?.classList.toggle('active', calendarCompactMode);
    document.querySelector('.cal-range-label.cal-range-12')?.classList.toggle('active', !calendarCompactMode);
}

function setupCalendarRangeToggle(container, opts = {}) {
    const toggle = document.getElementById('calendar-range-toggle');
    if (!toggle) return;
    reflectCalendarContainerMode(container);
    if (!toggle.dataset.bound) {
        toggle.addEventListener('change', async () => {
            calendarCompactMode = !toggle.checked;
            paintCalendar(container);
            await setCalendarPref(calendarCompactMode ? '6mo' : '12mo');
        });
        toggle.dataset.bound = '1';
    }
    const wrapper = document.getElementById('calendar-range-toggle-wrapper');
    if (opts.reveal && wrapper) wrapper.hidden = false;
}

function extractRectDate(rect) {
    return window.PracticeCalendar.parseDate(rect.getAttribute('data-date'));
}

let calendarTooltipDelegated = false;
function initCalendarTooltipDelegation(container) {
    if (calendarTooltipDelegated) return;
    calendarTooltipDelegated = true;
    const show = event => {
        const cell = event.target.closest?.('.practice-calendar-cell:not([aria-hidden])');
        if (!cell || !container.contains(cell)) { hideCalTooltip(); return; }
        showCalTooltip(cell, extractRectDate(cell), cell.getAttribute('data-value'), event.type === 'mousemove' ? event : null);
    };
    container.addEventListener('mousemove', show);
    container.addEventListener('click', show);
    container.addEventListener('focusin', show);
    container.addEventListener('mouseleave', hideCalTooltip);
    container.addEventListener('focusout', hideCalTooltip);
}

function repaintCalendarOnResize() {
    const container = document.getElementById('calendar-heatmap');
    if (container && calendarConfig && container.clientWidth > 0 && calendarLayout?.width !== container.clientWidth) paintCalendar(container);
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
		const halfWidth = tooltip.getBoundingClientRect().width / 2;
		x = Math.max(window.scrollX + halfWidth + 12, Math.min(x, window.scrollX + window.innerWidth - halfWidth - 12));
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
		if (!calendarConfig) return;
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
			// recompute aggregates locally
			const meta = readJSON(PRACTICE_META_KEY) || {};
			const newHash = buildMetaHash({ goal: val, lastIndex: meta.lastIndex, lastUpdated: meta.lastUpdated });
			persistMeta({ goal: val, lastIndex: meta.lastIndex, lastUpdated: meta.lastUpdated }, newHash);
			computedCache = computeAllAggregates(practiceData, newHash); persistComputed(computedCache);
			cachedSummary = computedCache.summary; updateSummaryUI(cachedSummary); renderMiniMetrics(computedCache);
			calendarSourceDays = computedCache.calendarDays; calendarDataLoaded = true; maybeRenderCalendarHeatmapFromCached(true);
			showToast('Goal Saved', `Weekly goal set to ${val} min.`);
		} catch (e) { console.error(e); showToast('Error', 'Failed to save goal'); }
	}

	async function fetchFullPracticeData() {
		const token = await auth0Client.getTokenSilently();
		const res = await fetch('/api/getPracticeData', { headers: { 'Authorization': `Bearer ${token}` }});
		if (!res.ok) throw new Error('fetch practice data failed');
		const data = await res.json();
		if (!data.chunks) data.chunks = [];
		return data;
	}

	function computeAllAggregates(pd, metaHash) {
		const sessions = flattenSessions(pd);
		const dayMap = new Map(); let minutesAccumulator=0; let sessionsCount=0;
		for (const s of sessions) { if (!s.date) continue; const m=s.durationMinutes||0; dayMap.set(s.date,(dayMap.get(s.date)||0)+m); minutesAccumulator+=m; sessionsCount++; }
		const today = new Date(); const trendsDays=[]; const RANGE=56;
		for (let i=RANGE-1;i>=0;i--){ const d=new Date(today.getFullYear(),today.getMonth(),today.getDate()-i); const iso=dateToLocalISO(d); trendsDays.push({ date:iso, minutes:dayMap.get(iso)||0 }); }
		const sorted = Array.from(dayMap.keys()).sort(); let longest=0, run=0, prev=null;
		for (const ds of sorted){ if (prev){ const delta=(new Date(ds)-new Date(prev))/86400000; if (delta===1) run++; else run=1; } else run=1; if (run>longest) longest=run; prev=ds; }
		const todayISO = dateToLocalISO(today); let currentStreak=0; let cursor = dayMap.get(todayISO)>0 ? new Date(today) : new Date(today.getFullYear(), today.getMonth(), today.getDate()-1);
		while(true){ const iso=dateToLocalISO(cursor); if (dayMap.get(iso)>0){ currentStreak++; cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()-1);} else break; }
		const summary = computeSummary(pd);
		const last7Minutes = trendsDays.slice(-7).reduce((a,d)=>a+d.minutes,0);
		const last14Minutes = trendsDays.slice(-14).reduce((a,d)=>a+d.minutes,0);
		const avgSessionLength = sessionsCount ? Math.round(minutesAccumulator / sessionsCount) : 0;
		const calDays=[]; for (let i=399;i>=0;i--){ const d=new Date(today.getFullYear(),today.getMonth(),today.getDate()-i); const iso=dateToLocalISO(d); calDays.push({ date: iso, minutes: dayMap.get(iso)||0 }); }
		return { metaHash, summary, trendsDays, calendarDays: calDays, currentStreak, longestStreak:longest, last7Minutes, last14Minutes, avgSessionLength, sessionsCount, recentSessions: summary.recentSessions };
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
		applyLocalSessionMutation({ date: payload.date, minutes, notes: payload.notes, manual: true });
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
		applyLocalSessionMutation({ date: payload.date, minutes: payload.durationMinutes, notes: payload.notes, manual: false });
	}
	function applyLocalSessionMutation(newSession) {
		try {
			if (!practiceData || !Array.isArray(practiceData.chunks)) return;
			if (!practiceData.chunks.length) practiceData.chunks.push({ index:0, sessions: [] });
			const lastChunk = practiceData.chunks[practiceData.chunks.length -1];
			lastChunk.sessions.push({ d: newSession.date, m: newSession.minutes, n: newSession.notes, man: !!newSession.manual, t: { _seconds: Math.floor(Date.now()/1000) } });
			persistRaw(practiceData);
			const meta = readJSON(PRACTICE_META_KEY) || {}; // do not change server lastUpdated; next meta probe will reconcile if rotated
			computedCache = computeAllAggregates(practiceData, meta.hash || currentMetaHash);
			persistComputed(computedCache);
			cachedSummary = computedCache.summary; updateSummaryUI(cachedSummary); renderMiniMetrics(computedCache);
			calendarSourceDays = computedCache.calendarDays; calendarDataLoaded = true; maybeRenderCalendarHeatmapFromCached();
		} catch (e) { console.warn('applyLocalSessionMutation failed', e); }
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
