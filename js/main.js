document.addEventListener('DOMContentLoaded', () => {
    const getStartedBtn = document.getElementById('get-started-btn');
    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', () => {
            window.location.href = '/pages/login.html';
        });
    }

    setTimeout(() => {
        showToast('Achievement Get!', 'Watch 100000000000000000000000000000000000000000000 unskippable advertisements!');
    }, 1000);
});
