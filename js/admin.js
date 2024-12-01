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

  const namesCache = {};

  tabButtons.forEach((button) => {
    button.addEventListener('click', async () => {
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

      if (!namesCache[period]) {
        namesCache[period] = await getNamesForPeriod(period);
      }

      setupFormForPeriod(period, namesCache[period]);
    });
  });

  function getCachedNames(period) {
    const cachedData = localStorage.getItem(`namesByPeriod-${period}`);
    const timestamp = localStorage.getItem(`namesByPeriodTimestamp-${period}`);
    if (cachedData && timestamp) {
      const currentTime = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      if (currentTime - parseInt(timestamp, 10) < fiveMinutes) {
        return JSON.parse(cachedData);
      }
    }
    return null;
  }

  async function getNamesForPeriod(period) {
    let names = getCachedNames(period);
    if (names) {
      return names;
    }
    try {
      const token = await getToken();
      const response = await fetch(`/api/getUserNames?period=${period}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      names = await response.json();
      localStorage.setItem(`namesByPeriod-${period}`, JSON.stringify(names));
      localStorage.setItem(`namesByPeriodTimestamp-${period}`, Date.now().toString());
      return names;
    } catch (error) {
      showToast('Error', `Failed to load student names for period ${period}.`);
      console.error(error);
      return [];
    }
  }

  function setupFormForPeriod(period, names) {
    const form = document.querySelector(`#period-${period}-form`);
    const studentNameInput = form.querySelector(`#period-${period}-student-name`);
    const suggestionsContainer = form.querySelector('.suggestions-container');

    studentNameInput.addEventListener('input', () => {
      const query = studentNameInput.value.trim().toLowerCase();
      suggestionsContainer.innerHTML = '';

      if (!query) return;

      const matches = names.filter((name) => name.toLowerCase().includes(query));

      matches.forEach((name) => {
        const suggestion = document.createElement('div');
        suggestion.classList.add('suggestion-item');
        suggestion.textContent = name;
        suggestion.addEventListener('click', () => {
          studentNameInput.value = name;
          suggestionsContainer.innerHTML = '';
        });
        suggestionsContainer.appendChild(suggestion);
      });
    });

    document.addEventListener('click', (e) => {
      if (!form.contains(e.target)) {
        suggestionsContainer.innerHTML = '';
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitButton = form.querySelector('button[type="submit"]');
      if (submitButton.disabled) return;
      submitButton.disabled = true;

      const amountInput = form.querySelector(`#period-${period}-amount`);

      const studentName = studentNameInput.value.trim();
      const amount = parseInt(amountInput.value, 10);

      if (!studentName) {
        showToast('Validation Error', 'Please enter a valid student name.');
        submitButton.disabled = false;
        return;
      }

      if (!amount) {
        showToast('Validation Error', 'Please enter a valid integer for the amount.');
        submitButton.disabled = false;
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
      suggestionsContainer.innerHTML = '';
      setTimeout(() => {
        submitButton.disabled = false;
      }, 2000);
    });
  }

  const activeButton = document.querySelector('.tab-button.active');
  if (activeButton) {
    activeButton.click();
  }
}

loadAdminContent();
