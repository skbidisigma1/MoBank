async function loadAdminContent() {
  await window.auth0Promise;
  const user = await getUser();
  const roles = (user && user['https://mo-bank.vercel.app/roles']) || [];

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

  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formId = form.id;
      const period = formId.split('-')[1];

      const studentNameInput = form.querySelector(`#period-${period}-student-name`);
      const amountInput = form.querySelector(`#period-${period}-amount`);

      const studentName = studentNameInput.value.trim();
      const amount = parseInt(amountInput.value, 10);

      if (!studentName) {
        showToast('Validation Error', 'Please enter a valid student name.');
        return;
      }

      if (!amount) {
        showToast('Validation Error', 'Please enter a valid integer for the amount.');
        return;
      }

      try {
        const token = await getToken();

        const response = await fetch('/api/adminAdjustBalance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: studentName,
            period: parseInt(period, 10),
            amount,
          }),
        });

        const result = await response.json();

        if (response.ok) {
          showToast('Success', result.message);
        } else {
          showToast('Error', result.message || 'An error occurred.');
        }
      } catch (error) {
        showToast('Network Error', 'Failed to process the request. Please try again later.');
      }

      studentNameInput.value = '';
      amountInput.value = '';
    });
  });
}

loadAdminContent();
