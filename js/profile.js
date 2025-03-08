document.addEventListener('DOMContentLoaded', async () => {
    await window.auth0Promise;

    const isLoggedIn = await isAuthenticated();
    if (!isLoggedIn) {
        window.location.href = '/pages/login.html';
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
            const token = await auth0Client.getTokenSilently();
            const response = await fetch('/api/getUserData', {
                method: 'GET',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const userData = await response.json();
                setCachedUserData(userData);
                autofillForm(userData);
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    }

    function autofillForm(userData) {
        const defaults = {
            class_period: 5,
            instrument: 'violin',
            theme: 'light'
        };

        const mergedData = { ...defaults, ...userData };

        if (classPeriodSelect) {
            classPeriodSelect.value = mergedData.class_period;
        }

        if (instrumentSelect) {
            instrumentSelect.value = mergedData.instrument.toLowerCase();
        }

        if (themeSelect) {
            themeSelect.value = mergedData.theme.toLowerCase();
        }

        document.documentElement.setAttribute('data-theme', mergedData.theme.toLowerCase());
    }

    function setCachedUserData(data) {
        localStorage.setItem('userData', JSON.stringify({ data, timestamp: Date.now() }));
    }

    function getCachedUserData() {
        const cached = localStorage.getItem('userData');
        return cached ? JSON.parse(cached).data : null;
    }

    themeSelect.addEventListener('change', () => {
        document.documentElement.setAttribute('data-theme', themeSelect.value.toLowerCase());
    });

    const cachedUserData = getCachedUserData();
    cachedUserData ? autofillForm(cachedUserData) : fetchAndCacheUserData();

    profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const classPeriod = parseInt(classPeriodSelect.value, 10);
        const instrument = instrumentSelect.value.trim().toLowerCase();
        const theme = themeSelect.value.trim().toLowerCase();

        const validClassPeriods = [5, 6, 7];
        const validInstruments = ['violin', 'viola', 'cello', 'bass'];
        const validThemes = ['light', 'dark'];

        if (!validClassPeriods.includes(classPeriod)) return showToast('Validation Error', 'Please select a valid class period (5, 6, 7).');
        if (!validInstruments.includes(instrument)) return showToast('Validation Error', 'Please select a valid instrument (violin, viola, cello, bass).');
        if (!validThemes.includes(theme)) return showToast('Validation Error', 'Please select a valid theme (light, dark).');

        const cooldownTimestamp = parseInt(sessionStorage.getItem('cooldownTimestamp'), 10) || 0;
        const now = Date.now();
        const COOLDOWN_MILLISECONDS = 15000;

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
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ class_period: classPeriod, instrument, theme }),
            });

            if (response.ok) {
                sessionStorage.setItem('cooldownTimestamp', Date.now().toString());
                const userDataResponse = await fetch('/api/getUserData', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (userDataResponse.ok) setCachedUserData(await userDataResponse.json());
                window.location.href = '/pages/dashboard.html?profile_successful=true';
                return;
            }

            const errorData = await response.json();
            showToast('Error', response.status === 429 ? 
                `Please wait ${errorData.waitTime} seconds before trying again.` : 
                `Error updating profile: ${errorData.message}`);
        } catch (error) {
            showToast('Error', 'An error occurred. Please reload and try again.');
        } finally {
            submitButton.disabled = false;
        }
    }
});
