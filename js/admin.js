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
  let adminLogs = [];

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
          addAdminLog(`Updated ${studentName}'s balance by ${amount > 0 ? '+' : ''}${amount} MoBucks`);
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
      }, 1500);
    });
  }

  function addAdminLog(message) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    const dateStr = now.toLocaleDateString();
    
    adminLogs.unshift({
      message,
      time: `${dateStr} ${timeStr}`
    });
    
    if (adminLogs.length > 50) {
      adminLogs = adminLogs.slice(0, 50);
    }
    
    updateAdminLogs();
    
    localStorage.setItem('adminLogs', JSON.stringify(adminLogs));
  }

  function updateAdminLogs() {
    const logsContainer = document.getElementById('admin-logs');
    if (!logsContainer) return;
    
    if (adminLogs.length === 0) {
      logsContainer.innerHTML = '<li class="admin-log-empty">No recent actions to display</li>';
      return;
    }
    
    logsContainer.innerHTML = adminLogs.map(log => `
      <li>
        <div class="log-content">
          <div class="log-message">${log.message}</div>
          <div class="log-time">${log.time}</div>
        </div>
      </li>
    `).join('');
  }

  try {
    const storedLogs = localStorage.getItem('adminLogs');
    if (storedLogs) {
      adminLogs = JSON.parse(storedLogs);
      updateAdminLogs();
    }
  } catch (error) {
    console.error('Failed to load admin logs:', error);
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
      
      if (!confirm(`Are you sure you want to add ${amount} MoBucks to all students ${period !== 'all' ? `in period ${period}` : ''}?`)) {
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
          addAdminLog(`Applied ${amount > 0 ? '+' : ''}${amount} MoBucks to ${period === 'all' ? 'all students' : `period ${period}`}`);
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