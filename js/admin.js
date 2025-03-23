async function loadAdminContent() {
  await window.auth0Promise;
  const user = await getUser();
  const roles = (user && user['https://mo-classroom.us/roles']) || [];

  if (!roles.includes('admin')) {
    window.location.href = '/dashboard';
    return;
  }

  document.getElementById('admin-content').classList.remove('hidden');

  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
  const namesCache = {};

  // Create modal elements
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'confirmation-modal-overlay';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'confirmation-modal';
  
  const modalMessage = document.createElement('div');
  modalMessage.className = 'confirmation-modal-message';
  
  const modalButtons = document.createElement('div');
  modalButtons.className = 'confirmation-modal-buttons';
  
  const confirmButton = document.createElement('button');
  confirmButton.className = 'confirmation-modal-button confirm';
  confirmButton.textContent = 'Yes';
  
  const cancelButton = document.createElement('button');
  cancelButton.className = 'confirmation-modal-button cancel';
  cancelButton.textContent = 'No';
  
  modalButtons.appendChild(confirmButton);
  modalButtons.appendChild(cancelButton);
  modalContent.appendChild(modalMessage);
  modalContent.appendChild(modalButtons);
  modalOverlay.appendChild(modalContent);
  document.body.appendChild(modalOverlay);

  function showConfirmationModal(message) {
    return new Promise((resolve) => {
      modalMessage.textContent = message;
      modalOverlay.classList.add('active');

      const handleConfirm = () => {
        modalOverlay.classList.remove('active');
        cleanup();
        resolve(true);
      };

      const handleCancel = () => {
        modalOverlay.classList.remove('active');
        cleanup();
        resolve(false);
      };

      const handleOutsideClick = (e) => {
        if (e.target === modalOverlay) {
          handleCancel();
        }
      };

      const cleanup = () => {
        confirmButton.removeEventListener('click', handleConfirm);
        cancelButton.removeEventListener('click', handleCancel);
        modalOverlay.removeEventListener('click', handleOutsideClick);
      };

      confirmButton.addEventListener('click', handleConfirm);
      cancelButton.addEventListener('click', handleCancel);
      modalOverlay.addEventListener('click', handleOutsideClick);
    });
  }

  function formatConfirmationMessage(amount, target, action = 'add', preposition = 'to') {
    const absAmount = Math.abs(amount);
    const mobucks = absAmount === 1 ? 'MoBuck' : 'MoBucks';
    action = amount < 0 ? 'remove' : action;
    preposition = amount < 0 ? 'from' : preposition;
    return `Are you sure you want to ${action} ${absAmount} ${mobucks} ${preposition} ${target}?`;
  }

  tabButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const period = button.dataset.period;
      
      tabButtons.forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');
      
      tabPanels.forEach((panel) => {
        panel.classList.toggle('hidden', panel.id !== `period-${period}-panel`);
      });
      
      if (!namesCache[period]) {
        const loadingIndicator = document.createElement('div');
        loadingIndicator.classList.add('loader');
        loadingIndicator.id = `period-${period}-loader`;
        document.querySelector(`#period-${period}-panel`).appendChild(loadingIndicator);
        
        namesCache[period] = await getNamesForPeriod(period);
        
        const loader = document.getElementById(`period-${period}-loader`);
        if (loader) loader.remove();
      }
      
      setupFormForPeriod(period, namesCache[period]);
      setupInstrumentFormForPeriod(period);
    });
  });

  function getCachedNames(period) {
    const cached = localStorage.getItem(`namesByPeriod-${period}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      const now = Date.now();
      if (now - parsed.timestamp < CACHE_DURATION) {
        return parsed.data;
      }
    }
    return null;
  }

  function setCachedNames(period, data) {
    const cacheEntry = { data: data, timestamp: Date.now() };
    localStorage.setItem(`namesByPeriod-${period}`, JSON.stringify(cacheEntry));
  }

  async function getNamesForPeriod(period) {
    let names = getCachedNames(period);
    if (names) {
      return names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }
    
    try {
      const token = await getToken();
      const response = await fetch(`/api/getUserNames?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const data = await response.json();
      if (response.ok) {
        setCachedNames(period, data);
        return data.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      } else {
        showToast('Error', data.message || `Failed to load student names for period ${period}.`);
        return [];
      }
    } catch (error) {
      showToast('Error', `Failed to load student names for period ${period}.`);
      return [];
    }
  }

  function setupFormForPeriod(period, names) {
    const form = document.getElementById(`period-${period}-form`);
    if (!form) return;

    const studentNameInput = form.querySelector(`#period-${period}-student-name`);
    const suggestionsContainer = form.querySelector('.suggestions-container');
    
    studentNameInput.addEventListener('input', () => {
      const query = studentNameInput.value.trim().toLowerCase();
      suggestionsContainer.innerHTML = '';
      
      if (!query) return;
      
      const matches = names.filter((name) => name.toLowerCase().includes(query));
      matches.slice(0, 8).forEach((name) => {
        const suggestion = document.createElement('div');
        suggestion.classList.add('suggestion-item');
        
        const highlightedName = name.replace(
          new RegExp(query, 'gi'),
          (match) => `<span class="highlighted">${match}</span>`
        );
        
        suggestion.innerHTML = highlightedName;
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
      
      if (isNaN(amount)) {
        showToast('Validation Error', 'Please enter a valid integer for the amount.');
        submitButton.disabled = false;
        return;
      }

      const confirmed = await showConfirmationModal(formatConfirmationMessage(amount, studentName));
      if (!confirmed) {
        submitButton.disabled = false;
        return;
      }
      
      try {
        const token = await getToken();
        const response = await fetch('/api/adminAdjustBalance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: studentName, period: parseInt(period, 10), amount }),
        });
        
        const result = await response.json();
        if (response.ok) {
          showToast('Success', result.message || `Successfully updated ${studentName}'s balance by ${amount}`);
          studentNameInput.value = '';
          amountInput.value = '';
          suggestionsContainer.innerHTML = '';
        } else {
          showToast('Error', result.message || 'An error occurred.');
        }
      } catch (error) {
        showToast('Network Error', 'Failed to process the request. Please try again later.');
      }
      
      setTimeout(() => {
        submitButton.disabled = false;
      }, 1500);
    });
  }

  function setupInstrumentFormForPeriod(period) {
    const form = document.getElementById(`period-${period}-instrument-form`);
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitButton = form.querySelector('button[type="submit"]');
      if (submitButton.disabled) return;
      
      submitButton.disabled = true;
      
      const instrumentSelect = form.querySelector(`#period-${period}-instrument`);
      const amountInput = form.querySelector(`#period-${period}-instrument-amount`);
      
      const instrument = instrumentSelect.value;
      const amount = parseInt(amountInput.value, 10);
      
      if (!instrument) {
        showToast('Validation Error', 'Please select an instrument.');
        submitButton.disabled = false;
        return;
      }
      
      if (isNaN(amount)) {
        showToast('Validation Error', 'Please enter a valid integer for the amount.');
        submitButton.disabled = false;
        return;
      }

      const target = `all ${instrument} players in period ${period}`;
      const confirmed = await showConfirmationModal(formatConfirmationMessage(amount, target));
      if (!confirmed) {
        submitButton.disabled = false;
        return;
      }
      
      try {
        const token = await getToken();
        const response = await fetch('/api/adminAdjustBalance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ 
            period: parseInt(period, 10),
            amount,
            instrument: instrument
          }),
        });
        
        const result = await response.json();
        if (response.ok) {
          showToast('Success', result.message || `Successfully updated balances for ${instrument} players in period ${period}`);
          instrumentSelect.value = '';
          amountInput.value = '';
        } else {
          showToast('Error', result.message || 'An error occurred.');
        }
      } catch (error) {
        showToast('Network Error', 'Failed to process the request. Please try again later.');
      }
      
      setTimeout(() => {
        submitButton.disabled = false;
      }, 1500);
    });
  }

  const updateByClassForm = document.getElementById('update-by-class-form');
  if (updateByClassForm) {
    updateByClassForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amountInput = document.getElementById('global-currency-amount');
      const submitButton = updateByClassForm.querySelector('button[type="submit"]');
      
      if (submitButton.disabled) return;
      submitButton.disabled = true;

      const amount = parseInt(amountInput.value, 10);
      const activeTab = document.querySelector('.tab-button.active');
      let period = activeTab ? activeTab.dataset.period : 'all';
      
      if (isNaN(amount)) {
        showToast('Validation Error', 'Please enter a valid amount.');
        submitButton.disabled = false;
        return;
      }

      const target = period !== 'all' ? `all students in period ${period}` : 'all students';
      const confirmed = await showConfirmationModal(formatConfirmationMessage(amount, target));
      if (!confirmed) {
        submitButton.disabled = false;
        return;
      }
      
      try {
        const token = await getToken();
        const response = await fetch('/api/adminAdjustBalance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ 
            name: null, 
            period: period === 'all' ? null : parseInt(period, 10), 
            amount 
          }),
        });
        
        const result = await response.json();
        if (response.ok) {
          showToast('Success', `Successfully updated balances for ${period === 'all' ? 'all students' : `students in period ${period}`} by ${amount}`);
          amountInput.value = '';
        } else {
          showToast('Error', result.message || 'An error occurred.');
        }
      } catch (error) {
        showToast('Network Error', 'Failed to process the request. Please try again later.');
      }

      setTimeout(() => {
        submitButton.disabled = false;
      }, 1500);
    });
  }

  const activeButton = document.querySelector('.tab-button.active');
  if (activeButton) {
    activeButton.click();
  }
}

document.addEventListener('DOMContentLoaded', loadAdminContent);