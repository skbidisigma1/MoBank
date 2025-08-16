// note: client-only for now
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

	document.addEventListener('DOMContentLoaded', init);

	async function init() {
		cacheDOM();
		bindEvents();
		await ensureAuth();
		await loadSummary();
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
		dom.manualToggle = document.getElementById('manual-toggle');
		dom.manualDate = document.getElementById('manual-date');
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
	}

	function bindEvents() {
		dom.startBtn.addEventListener('click', startSession);
		dom.pauseBtn.addEventListener('click', pauseSession);
		dom.resumeBtn.addEventListener('click', resumeSession);
		dom.logBtn.addEventListener('click', openFinalizeModal);
		dom.cancelBtn.addEventListener('click', cancelSessionPrompt);
		dom.manualForm.addEventListener('submit', handleManualSubmit);
		dom.manualToggle.addEventListener('click', toggleManualCard);
		dom.refreshSummaryBtn.addEventListener('click', loadSummary);
		dom.saveGoalBtn.addEventListener('click', saveGoal);
		dom.finalizeClose.addEventListener('click', closeFinalizeModal);
		dom.finalizeCancel.addEventListener('click', closeFinalizeModal);
		dom.finalizeForm.addEventListener('submit', finalizeSessionSubmit);
		window.addEventListener('beforeunload', handleBeforeUnload);
		initDates();
	}

	function debounce(fn, ms) { let t; return function() { clearTimeout(t); t = setTimeout(fn, ms); }; }

	function getTodayLocalISO() {
		const d = new Date();
		const y = d.getFullYear();
		const m = String(d.getMonth()+1).padStart(2,'0');
		const day = String(d.getDate()).padStart(2,'0');
		return `${y}-${m}-${day}`;
	}

	function initDates() {
		const todayStr = getTodayLocalISO();
		if (dom.manualDate) {
			dom.manualDate.max = todayStr;
			if (!dom.manualDate.value) dom.manualDate.value = todayStr;
		}
		if (dom.finalDate) {
			dom.finalDate.max = todayStr;
			if (!dom.finalDate.value) dom.finalDate.value = todayStr;
		}
	}

	async function ensureAuth() {
		try {
			await window.auth0Promise;
			const loggedIn = await isAuthenticated();
			if (!loggedIn) {
				// redirect pattern like other pages
				window.location.href = '/login';
			}
		} catch (e) {
			console.error('Auth init failed', e);
		}
	}

	// (Intensity & focus tags removed for minimal iteration)

	// Session Timer Logic
	function startSession() {
		if (sessionState.active) return;
		sessionState.active = true;
		sessionState.paused = false;
		sessionState.elapsedAccumMs = 0;
		sessionState.startTs = Date.now();
		// TODO: call real start endpoint -> returns sessionId
		sessionState.sessionId = 'local-' + Math.random().toString(36).slice(2, 9);
		updateSessionUIState();
		startTimerInterval();
		showToast('Session Started', 'Timer running.');
	}

	function pauseSession() {
		if (!sessionState.active || sessionState.paused) return;
		sessionState.elapsedAccumMs += Date.now() - sessionState.startTs;
		sessionState.paused = true;
		clearInterval(timerInterval);
		updateSessionUIState();
		showToast('Paused', 'Session paused.');
	}

	function resumeSession() {
		if (!sessionState.active || !sessionState.paused) return;
		sessionState.paused = false;
		sessionState.startTs = Date.now();
		startTimerInterval();
		updateSessionUIState();
		showToast('Resumed', 'Session resumed.');
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
			diff += Date.now() - sessionState.startTs;
		}
		dom.timerDisplay.textContent = formatDuration(diff);
	}

	function formatDuration(ms) {
		const totalSeconds = Math.max(0, Math.floor(ms / 1000));
		const m = Math.floor(totalSeconds / 60);
		const s = totalSeconds % 60;
		return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
	}

	function openFinalizeModal() {
		if (!sessionState.active) return;
		if (!sessionState.paused) {
			pauseSession(); // ensure paused before logging
		}
		// compute final elapsed (already reflected in display)
		dom.finalizeElapsed.textContent = dom.timerDisplay.textContent;
		// no separate piece field anymore
		if (dom.finalDate && !dom.finalDate.value) initDates();
		dom.finalizeModal.classList.remove('hidden');
		dom.sessionStatusBadge.textContent = 'Finalizing';
		dom.sessionStatusBadge.classList.add('finalizing');
	}

	function closeFinalizeModal() {
		dom.finalizeModal.classList.add('hidden');
		dom.sessionStatusBadge.classList.remove('finalizing');
		if (sessionState.active) {
			dom.sessionStatusBadge.textContent = 'Active';
		}
	}

	function cancelSessionPrompt() {
		if (!sessionState.active) return;
		if (confirm('Cancel current session (not saved)?')) {
			resetSessionState();
			updateSessionUIState();
			showToast('Session Cancelled', 'No data saved.');
		}
	}

	function finalizeSessionSubmit(e) {
		e.preventDefault();
		// total elapsed in ms
		let totalMs = sessionState.elapsedAccumMs;
		if (!sessionState.paused && sessionState.active && sessionState.startTs) {
			// Shouldn't happen because we pause before log, but just in case
			totalMs += Date.now() - sessionState.startTs;
		}
		const minutes = Math.max(1, Math.round(totalMs / 60000));
		const notes = dom.finalNotes.value.trim();
		const payload = {
			sessionId: sessionState.sessionId,
			intensity: 3, // default placeholder (removed from minimal UI)
			focusTags: [],
			notes,
			durationMinutes: minutes,
			date: dom.finalDate?.value || getTodayLocalISO()
		};
		saveFinalizedSession(payload).then(() => {
			showToast('Session Saved', `${minutes} minute${minutes===1?'':'s'} logged.`);
			closeFinalizeModal();
			resetSessionState();
			updateSessionUIState();
			loadSummary();
			prependRecentSession(payload);
		}).catch(err => {
			console.error(err);
			showToast('Error', 'Failed to save session.');
		});
	}

	function resetSessionState() {
		sessionState.active = false;
		sessionState.paused = false;
		sessionState.startTs = null;
		sessionState.elapsedAccumMs = 0;
		sessionState.sessionId = null;
		// reset handled (no piece field)
		dom.timerDisplay.textContent = '00:00';
	}

	function updateSessionUIState() {
		if (sessionState.active) {
			if (sessionState.paused) {
				// paused state
				dom.startBtn.classList.add('hidden');
				dom.pauseBtn.classList.add('hidden');
				dom.resumeBtn.classList.remove('hidden');
				dom.logBtn.classList.remove('hidden');
				dom.cancelBtn.classList.remove('hidden');
				dom.sessionStatusTitle.textContent = 'Paused Session';
				dom.sessionStatusBadge.textContent = 'Paused';
				dom.sessionStatusBadge.classList.remove('active');
				dom.sessionStatusBadge.classList.add('idle');
			} else {
				// active running
				dom.startBtn.classList.add('hidden');
				dom.pauseBtn.classList.remove('hidden');
				dom.resumeBtn.classList.add('hidden');
				dom.logBtn.classList.add('hidden');
				dom.cancelBtn.classList.remove('hidden');
				dom.sessionStatusTitle.textContent = 'Active Session';
				dom.sessionStatusBadge.textContent = 'Active';
				dom.sessionStatusBadge.classList.remove('idle');
				dom.sessionStatusBadge.classList.add('active');
			}
		} else {
			clearInterval(timerInterval);
			dom.startBtn.classList.remove('hidden');
			dom.pauseBtn.classList.add('hidden');
			dom.resumeBtn.classList.add('hidden');
			dom.logBtn.classList.add('hidden');
			dom.cancelBtn.classList.add('hidden');
			dom.sessionStatusTitle.textContent = 'No Active Session';
			dom.sessionStatusBadge.textContent = 'Idle';
			dom.sessionStatusBadge.classList.remove('active');
		}
	}

	function handleBeforeUnload(e) {
		if (sessionState.active) {
			e.preventDefault();
			e.returnValue = '';
		}
	}

	// manual logging
	function handleManualSubmit(e) {
		e.preventDefault();
		const piece = undefined; // removed
		const minutes = Number(document.getElementById('manual-minutes').value);
		const notes = document.getElementById('manual-notes').value.trim();
		const dateStr = dom.manualDate?.value || getTodayLocalISO();
		if (!minutes || minutes < 1) {
			showToast('Validation', 'Enter a valid minute count.');
			return;
		}
		const payload = { durationMinutes: minutes, intensity: 3, focusTags: [], notes, manual: true, date: dateStr };
		saveManualSession(payload).then(() => {
			showToast('Logged', `${minutes} minute${minutes===1?'':'s'} added.`);
			loadSummary();
			prependRecentSession(payload);
			e.target.reset();
			initDates(); // reset date to today
		}).catch(err => {
			console.error(err);
			showToast('Error', 'Failed to log session.');
		});
	}

	function toggleManualCard() {
		const form = document.getElementById('manual-log-form');
		const expanded = dom.manualToggle.getAttribute('aria-expanded') === 'true';
		if (expanded) {
			form.style.display = 'none';
			dom.manualToggle.textContent = 'Show';
			dom.manualToggle.setAttribute('aria-expanded', 'false');
		} else {
			form.style.display = 'flex';
			dom.manualToggle.textContent = 'Hide';
			dom.manualToggle.setAttribute('aria-expanded', 'true');
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

	function shortTag(t) { return t; }

	// stub
	let cachedSummary = null;
	async function loadSummary() {
		try {
			const data = await fetchPracticeSummary();
			cachedSummary = data;
			updateSummaryUI(data);
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
		// Dummy insights population
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
			const avg = sessions.length ? Math.round(sessions.reduce((a,s)=>a+(s.durationMinutes||0),0)/sessions.length) : 0;
			avgLenEl.textContent = `Avg Length: ${avg} min`;
		}
		if (gapEl) {
			gapEl.textContent = 'Next: Keep the streak!';
		}
	}

	function saveGoal() {
		const val = Number(dom.goalInput.value);
		if (Number.isNaN(val) || val < 0) {
			showToast('Validation', 'Enter a valid goal');
			return;
		}
		// Stub: just update UI locally
		if (!cachedSummary) cachedSummary = {};
		cachedSummary.weekGoal = val;
		updateSummaryUI(cachedSummary);
		showToast('Goal Saved', `Weekly goal set to ${val} min.`);
	}

	// ---- Server Interaction Stubs ----
	async function fetchPracticeSummary() {
		// TODO replace with real endpoint call /api/getPracticeSummary
		// If we already have a cached summary, increment a fake timestamp to mimic refresh
		return new Promise(resolve => {
			setTimeout(() => {
				resolve(cachedSummary || {
					weekMinutes: 0,
					weekGoal: 180,
					weekSessions: 0,
					avgIntensity: 0,
					weekWeightedMinutes: 0,
					streakDays: 0,
					recentSessions: []
				});
			}, 250);
		});
	}

	async function saveManualSession(payload) {
		// TODO call /api/logPracticeSession
		return new Promise(resolve => setTimeout(resolve, 250));
	}

	async function saveFinalizedSession(payload) {
		// TODO call /api/endPracticeSession
		return new Promise(resolve => setTimeout(resolve, 250));
	}

	// Utilities ---------------------------------------------------------------
	function escapeHTML(str) { return str.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c] || c)); }

})();

