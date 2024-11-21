document.addEventListener('DOMContentLoaded', () => {
    const getStartedBtn = document.getElementById('get-started-btn');
    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', () => {
            window.location.href = '/pages/login.html';
        });
    }

    setTimeout(() => {
        showToast('Welcome to MoBank!');
    }, 1000);
});
