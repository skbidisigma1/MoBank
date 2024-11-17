async function loadTransferPage() {
    await window.auth0Promise;

    const isLoggedIn = await isAuthenticated();
    if (!isLoggedIn) {
        window.location.href = '/pages/login.html';
        return;
    }

    const user = await getUser();
    document.getElementById('current-balance').textContent = `$${user.currency_balance || 0}`;
    // This will show transaction history but will be added later
}

document.addEventListener('DOMContentLoaded', loadTransferPage);
