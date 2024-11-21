document.addEventListener('DOMContentLoaded', () => {
    const getStartedBtn = document.getElementById('get-started-btn');
    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', () => {
            window.location.href = '/pages/login.html';
        });
    }

    setTimeout(() => {
        showToast('Achievement Get!', 'Welcome to MoBank!', 'images/achievement_icon.png');
    }, 1000);
});
