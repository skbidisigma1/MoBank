document.addEventListener('DOMContentLoaded', async () => {
    await window.auth0Promise;

    const isLoggedIn = await isAuthenticated();
    if (!isLoggedIn) {
        window.location.href = '/pages/login.html';
        return;
    }

    const profileForm = document.getElementById('profile-form');
    const submitButton = profileForm.querySelector('button[type="submit"]');

    async function updateProfile(class_period, instrument) {
        let token;
        try {
            token = await auth0Client.getTokenSilently();
        } catch (error) {
            window.location.href = '/pages/login.html';
            return;
        }

        try {
            const response = await fetch('/api/updateProfile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ class_period, instrument })
            });

            if (response.ok) {
                window.location.href = '/pages/dashboard.html';
            } else if (response.status === 429) {
                const errorData = await response.json();
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
            } else {
                const errorData = await response.json();
                alert('Error updating profile: ' + errorData.message);
                submitButton.disabled = false;
            }
        } catch (error) {
            alert("An error occurred while updating your profile. Please reload the page and try again.");
            submitButton.disabled = false;
        }
    }

    profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const class_period = parseInt(document.getElementById('class_period').value);
        const instrument = document.getElementById('instrument').value.trim().toLowerCase();

        const validClassPeriods = [1, 3, 4, 5, 6, 7];
        const validInstruments = ['violin', 'viola', 'cello', 'bass'];

        if (!validClassPeriods.includes(class_period)) {
            alert('Please enter a valid class period (1, 3-7).');
            return;
        }

        if (!validInstruments.includes(instrument)) {
            alert('Please enter a valid instrument (violin, viola, cello, bass).');
            return;
        }

        submitButton.disabled = true;
        updateProfile(class_period, instrument);
    });
});