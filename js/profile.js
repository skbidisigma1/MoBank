document.addEventListener('DOMContentLoaded', async () => {
    await window.auth0Promise;

    const isLoggedIn = await isAuthenticated();
    if (!isLoggedIn) {
        window.location.href = '/pages/login.html';
        return;
    }

    const token = await getToken();
    const profileForm = document.getElementById('profile-form');
    const submitButton = profileForm.querySelector('button[type="submit"]');

    async function updateProfile(class_period, instrument) {
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

                // Disable the button and show a countdown
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
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            alert("An error occurred while updating your profile. Please reload the page and try again.");
        }
    }

    profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const class_period = parseInt(document.getElementById('class_period').value);
        const instrument = document.getElementById('instrument').value.trim();

        if (!class_period || !instrument) {
            alert('Please fill out all fields.');
            return;
        }

        updateProfile(class_period, instrument);
    });
});