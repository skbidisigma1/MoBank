async function loadAdminContent() {
    await window.auth0Promise;
    const user = await getUser();
    const roles = user && user['https://mo-bank.vercel.app/roles'] || [];

    if (!roles.includes('admin')) {
        window.location.href = '/pages/dashboard.html';
        return;
    }

    document.getElementById('admin-content').classList.remove('hidden');

    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const period = button.dataset.period;

            tabButtons.forEach((btn) => btn.classList.remove('active'));
            button.classList.add('active');

            tabPanels.forEach((panel) => {
                if (panel.id === `period-${period}-panel`) {
                    panel.classList.remove('hidden');
                } else {
                    panel.classList.add('hidden');
                }
            });
        });
    });
}

loadAdminContent();
