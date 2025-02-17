document.addEventListener('DOMContentLoaded', async () => {
    await window.auth0Promise;

    const isLoggedIn = await isAuthenticated();
    if (!isLoggedIn) {
        window.location.href = '/pages/login.html';
        return;
    }

    const profileForm = document.getElementById('profile-form');
    const submitButton = profileForm.querySelector('button[type="submit"]');

    function setCachedUserData(data) {
        const cacheEntry = {
            data: data,
            timestamp: Date.now(),
        };
        localStorage.setItem('userData', JSON.stringify(cacheEntry));
    }

    async function updateProfile(classPeriod, instrument) {
        try {
            const token = await auth0Client.getTokenSilently();
            const response = await fetch('/api/updateProfile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ class_period: classPeriod, instrument }),
            });

            if (response.ok) {
                sessionStorage.setItem('cooldownTimestamp', Date.now().toString());
                const userDataResponse = await fetch('/api/getUserData', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (userDataResponse.ok) {
                    const userData = await userDataResponse.json();
                    setCachedUserData(userData);
                }
                window.location.href = '/pages/dashboard.html?profile_successful=true';
                return;
            }

            if (response.status === 429) {
                const errorData = await response.json();
                showToast('Error', `Please wait ${errorData.waitTime} seconds before trying again.`);
            } else {
                const errorData = await response.json();
                showToast('Error', `Error updating profile: ${errorData.message}`);
            }
        } catch (error) {
            showToast('Error', 'An error occurred while updating your profile. Please reload the page and try again.');
        } finally {
            submitButton.disabled = false;
        }
    }

    profileForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const classPeriod = parseInt(document.getElementById('class_period').value, 10);
        const instrument = document.getElementById('instrument').value.trim().toLowerCase();

        const validClassPeriods = [5, 6, 7];
        const validInstruments = ['violin', 'viola', 'cello', 'bass'];

        if (!validClassPeriods.includes(classPeriod)) {
            showToast('Validation Error', 'Please select a valid class period (5, 6, 7).');
            return;
        }

        if (!validInstruments.includes(instrument)) {
            showToast('Validation Error', 'Please select a valid instrument (violin, viola, cello, bass).');
            return;
        }

        const cooldownTimestamp = parseInt(sessionStorage.getItem('cooldownTimestamp'), 10) || 0;
        const now = Date.now();
        const COOLDOWN_MILLISECONDS = 30000;

        if (now - cooldownTimestamp < COOLDOWN_MILLISECONDS) {
            const remainingTime = Math.ceil((COOLDOWN_MILLISECONDS - (now - cooldownTimestamp)) / 1000);
            showToast('Error', `Please wait ${remainingTime} seconds before trying again.`);
            return;
        }

        submitButton.disabled = true;
        updateProfile(classPeriod, instrument);
    });
});
