document.addEventListener('DOMContentLoaded', async () => {
    await window.auth0Promise;

    const isLoggedIn = await isAuthenticated();
    if (!isLoggedIn) {
        window.location.href = '/pages/login.html';
        return;
    }

    const token = await getToken();

    if (!token) {
        alert('Session expired. Please log in again.');
        window.location.href = '/pages/login.html';
        return;
    }

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
            } else {
                let errorData;
                try {
                    errorData = await response.json();
                } catch {
                    errorData = { message: await response.text() };
                }
                alert('Error updating profile: ' + errorData.message);
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            alert("An error occurred while updating your profile. Please reload the page and try again.");
        }
    }

    function handleFormSubmit(e) {
        e.preventDefault();
        const class_period = parseInt(document.getElementById('class_period').value);
        const instrument = document.getElementById('instrument').value.trim();

        if (!class_period || !instrument) {
            alert('Please fill out all fields.');
            return;
        }

        profileForm.removeEventListener('submit', handleFormSubmit);

        submitButton.remove();

        const reloadMessage = document.createElement('div');
        reloadMessage.textContent = 'Please reload the page to use the button again.';
        reloadMessage.style.textAlign = 'center';
        reloadMessage.style.fontSize = '16px';
        reloadMessage.style.color = 'red';
        profileForm.appendChild(reloadMessage);

        profileForm.querySelectorAll('input, select, button').forEach((input) => {
            input.disabled = true;
        });

        updateProfile(class_period, instrument);
    }

    profileForm.addEventListener('submit', handleFormSubmit);
});