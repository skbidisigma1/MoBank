function handleCredentialResponse(response) {
    const token = response.credential;
    localStorage.setItem('googleToken', token);
    window.location.href = "/pages/dashboard.html";
}

function checkTokenOnLoad() {
    const token = localStorage.getItem('googleToken');
    if (token) {
        window.location.href = "/pages/dashboard.html";
    }
}

function logout() {
    localStorage.removeItem('googleToken');
    window.location.href = '/pages/login.html';
}

document.addEventListener('DOMContentLoaded', () => {
    checkTokenOnLoad();
});