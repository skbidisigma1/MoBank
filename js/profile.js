document.addEventListener('DOMContentLoaded', async () => {
    await window.auth0Promise;

    const isLoggedIn = await isAuthenticated();
    if (!isLoggedIn) {
        window.location.href = '/pages/login.html';
        return;
    }

    const token = await getToken();
    const profileForm = document.getElementById('profile-form');

    function debounce(func, delay) {
        let timer;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => func.apply(this, args), delay);
        };
    }

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
            alert("An error occurred while updating your profile. Please don't spam the button and refresh the page.");
        }
    }

    const debouncedUpdateProfile = debounce(updateProfile, 5000);

    profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const class_period = parseInt(document.getElementById('class_period').value);
        const instrument = document.getElementById('instrument').value.trim();

        if (!class_period || !instrument) {
            alert('Please fill out all fields.');
            return;
        }

        debouncedUpdateProfile(class_period, instrument);
    });
});
