document.addEventListener('DOMContentLoaded', async () => {
    await window.auth0Promise;

    const isLoggedIn = await isAuthenticated();
    if (!isLoggedIn) {
        window.location.href = '/pages/login.html';
        return;
    }

    const profileForm = document.getElementById('profile-form');
    const submitButton = profileForm.querySelector('button[type="submit"]');

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
                window.location.href = '/pages/dashboard.html';
                return;
            }

            if (response.status === 429) {
                handleRateLimit(response);
            } else {
                const errorData = await response.json();
                alert(`Error updating profile: ${errorData.message}`);
            }
        } catch (error) {
            alert('An error occurred while updating your profile. Please reload the page and try again.');
        } finally {
            submitButton.disabled = false;
        }
    }

    function handleRateLimit(response) {
        response.json().then((errorData) => {
            let waitTime = errorData.waitTime || 60;

            submitButton.disabled = true;
            const reloadMessage = document.createElement('div');
            reloadMessage.style.textAlign = 'center';
            reloadMessage.style.fontSize = '16px';
            reloadMessage.style.color = 'red';
            profileForm.appendChild(reloadMessage);

            const interval = setInterval(() => {
                if (waitTime > 0) {
                    reloadMessage.textContent = `Please wait ${waitTime} seconds before trying again.`;
                    waitTime -= 1;
                } else {
                    clearInterval(interval);
                    reloadMessage.remove();
                    submitButton.disabled = false;
                }
            }, 1000);
        });
    }

    profileForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const classPeriod = parseInt(document.getElementById('class_period').value, 10);
        const instrument = document.getElementById('instrument').value.trim().toLowerCase();

        const validClassPeriods = [1, 2, 4, 5, 6, 7];
        const validInstruments = ['violin', 'viola', 'cello', 'bass'];

        if (!validClassPeriods.includes(classPeriod)) {
            alert('Please select a valid class period (1, 3-7).');
            return;
        }

        if (!validInstruments.includes(instrument)) {
            alert('Please select a valid instrument (violin, viola, cello, bass).');
            return;
        }

        submitButton.disabled = true;
        updateProfile(classPeriod, instrument);
    });
});