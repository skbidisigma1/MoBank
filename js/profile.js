document.addEventListener('DOMContentLoaded', async () => {
    await window.auth0Promise;

    const isLoggedIn = await isAuthenticated();
    if (!isLoggedIn) {
        window.location.href = 'login';
        return;
    }

    const profileForm = document.getElementById('profile-form');
    const submitButton = profileForm.querySelector('button[type="submit"]');
    const classPeriodSelect = document.getElementById('class_period');
    const instrumentSelect = document.getElementById('instrument');
    const themeSelect = document.getElementById('theme');

    if (!themeSelect) return;

    async function fetchAndCacheUserData() {
        try {
            const cachedData = CACHE.read(CACHE.USER_KEY);
            if (cachedData) {
                autofillForm(cachedData);
                return;
            }

            let attempts = 0;
            const maxAttempts = 10;
            while (!window.userDataPromise && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            if (window.userDataPromise) {
                const userData = await window.userDataPromise;
                if (userData) {
                    autofillForm(userData);
                    return;
                }
            }

            // Fallback direct API
            const token = await auth0Client.getTokenSilently();
            const response = await fetch('/api/getUserData', {
                method: 'GET',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const userData = await response.json();
                CACHE.write(CACHE.USER_KEY, userData, CACHE.USER_MAX_AGE);
                autofillForm(userData);
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    }

    // migration banner for new school year and new users
    function injectMigrationBanner(userData) {
        try {
            const params = new URLSearchParams(window.location.search);
            const force = params.get('welcome') === '1';
            const needsPeriod = userData.class_period == null;
            if (!force && !needsPeriod) return;
            const returning = !!(userData.instrument || (userData.transactions && userData.transactions.length) || (userData.currency_balance && userData.currency_balance !== 0));
            const msg = returning ? 'Complete your settings to begin the new school year.' : 'Complete your settings to get started.';
            const section = document.querySelector('.profile-section');
            if (section && !document.getElementById('migration-banner')) {
                const div = document.createElement('div');
                div.id = 'migration-banner';
                div.className = 'migration-banner';
                div.innerHTML = `<strong>${returning ? 'Welcome Back!' : 'Welcome!'}</strong> ${msg}`;
                section.insertBefore(div, section.firstChild);
            }
        } catch (e) {
            console.warn('migration banner failed:', e);
        }
    }

    function autofillForm(userData) {
        const defaults = { class_period: 5, instrument: 'violin', theme: 'light' };
        const mergedData = { ...defaults, ...userData };

        if (classPeriodSelect) {
            if (mergedData.class_period == null) {
                classPeriodSelect.value = '';
            } else {
                classPeriodSelect.value = mergedData.class_period;
            }
        }
        if (instrumentSelect && mergedData.instrument) {
            instrumentSelect.value = mergedData.instrument.toLowerCase();
        }
        if (themeSelect && mergedData.theme) {
            themeSelect.value = mergedData.theme.toLowerCase();
            document.documentElement.setAttribute('data-theme', mergedData.theme.toLowerCase());
        }
        injectMigrationBanner(userData || {});
    }

    function setCachedUserData(data) {
        CACHE.write(CACHE.USER_KEY, data, CACHE.USER_MAX_AGE);
    }
    function getCachedUserData() { return CACHE.read(CACHE.USER_KEY); }

    themeSelect.addEventListener('change', () => {
        document.documentElement.setAttribute('data-theme', themeSelect.value.toLowerCase());
    });

    const cachedUserData = getCachedUserData();
    cachedUserData ? autofillForm(cachedUserData) : await fetchAndCacheUserData();

    profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const classPeriod = parseInt(classPeriodSelect.value, 10);
        const instrument = instrumentSelect.value.trim().toLowerCase();
        const theme = themeSelect.value.trim().toLowerCase();

        const validClassPeriods = [4, 5, 6, 7, 8, 10];
        const validInstruments = ['violin', 'viola', 'cello', 'bass', 'other'];
        const validThemes = ['light', 'dark'];

        if (!validClassPeriods.includes(classPeriod)) return showToast('Validation Error', 'Please select a valid class period (4, 5, 6, 7, Symphonic, Chamber).');
        if (!validInstruments.includes(instrument)) return showToast('Validation Error', 'Please select a valid instrument (violin, viola, cello, bass, other).');
        if (!validThemes.includes(theme)) return showToast('Validation Error', 'Please select a valid theme (light, dark).');

        const cooldownTimestamp = parseInt(sessionStorage.getItem('cooldownTimestamp'), 10) || 0;
        const now = Date.now();
        const COOLDOWN_MILLISECONDS = 5000;
        if (now - cooldownTimestamp < COOLDOWN_MILLISECONDS) {
            const remainingTime = Math.ceil((COOLDOWN_MILLISECONDS - (now - cooldownTimestamp))) / 1000;
            return showToast('Error', `Please wait ${remainingTime} seconds before trying again.`);
        }

        submitButton.disabled = true;
        updateProfile(classPeriod, instrument, theme);
    });

    async function updateProfile(classPeriod, instrument, theme) {
        try {
            const token = await auth0Client.getTokenSilently();
            const response = await fetch('/api/updateProfile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ class_period: classPeriod, instrument, theme }),
            });
            if (response.ok) {
                sessionStorage.setItem('cooldownTimestamp', Date.now().toString());
                localStorage.removeItem(CACHE.USER_KEY);
                window.location.href = 'dashboard?profile_successful=true';
                return;
            }
            const errorData = await response.json();
            showToast('Error', response.status === 429 ? `Please wait ${errorData.waitTime} seconds before trying again.` : `Error updating profile: ${errorData.message}`);
        } catch (error) {
            showToast('Error', 'An error occurred. Please reload and try again.');
        } finally {
            submitButton.disabled = false;
        }
    }
});
