async function loadAdminContent() {
  await window.auth0Promise;
  const user = await getUser();
  const roles = (user && user['https://mo-classroom.us/roles']) || [];
  const periodNames = {
  '5': 'Period 5',
  '6': 'Period 6',
  '7': 'Period 7',
  '8': 'Symphonic Orchestra',
  '9': 'Full Orchestra',
  '10': 'Chamber Orchestra'
  };
  if (!roles.includes('admin')) {
    window.location.href = '/dashboard';
    return;
  }
  const saveBtn = document.getElementById('editor-save-btn');
  const cancelBtn = document.getElementById('editor-cancel-btn');
  const hiddenTextarea = document.getElementById('announcement-body');
  if (document.getElementById('tinymce-editor') && saveBtn && cancelBtn && hiddenTextarea) {
    tinymce.init({
      target: document.getElementById('tinymce-editor'),
      height: 300,
      menubar: false,
      inline: true,
      plugins: 'lists link wordcount table advlist autolink charmap code fullscreen emoticons media help',
      toolbar: [
        'undo redo | formatselect | bold italic underline | alignleft aligncenter alignright',
        'bullist numlist | link media table | code fullscreen removeformat'
      ],
      toolbar_mode: 'wrap',
      width: 'auto',
      content_css: '/css/tinymce-custom.css',
      fixed_toolbar_container: '#tinymce-toolbar-container',
      setup(editor) {
        editor.on('init', () => {
          editor.setContent(hiddenTextarea.value);
          editor.execCommand('JustifyLeft');
          
          const observer = new MutationObserver(() => {
            const toolbars = document.querySelectorAll('.tox-toolbar__primary');
            toolbars.forEach(toolbar => {
              if (toolbar.style.position === 'fixed') {
                toolbar.style.position = 'relative';
              }
            });
          });
          
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true
          });
        });
      },
    });

    saveBtn.addEventListener('click', () => {
      const content = tinymce.get('tinymce-editor').getContent();
      hiddenTextarea.value = content;
    });

    cancelBtn.addEventListener('click', () => {
      const editor = tinymce.get('tinymce-editor');
      if (editor) {
        editor.setContent(hiddenTextarea.value);
      }
    });
  }

  document.getElementById('admin-content').classList.remove('hidden');

  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const manageAnnouncementsBtn = document.getElementById('manage-announcements-btn'); // Added
  const announcementsPanel = document.getElementById('announcements-panel'); // Added
  const announcementForm = document.getElementById('announcement-form'); // Added
  const currentAnnouncementsList = document.getElementById('current-announcements-list'); // Added
  const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
  const namesCache = {};

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

      // Deactivate announcement button and hide its panel
      manageAnnouncementsBtn.classList.remove('active'); // Added
      announcementsPanel.classList.add('hidden'); // Added

      tabButtons.forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');

      tabPanels.forEach((panel) => {
        // Ensure announcement panel remains hidden unless explicitly shown
        if (panel.id !== 'announcements-panel') { // Added condition
          panel.classList.toggle('hidden', panel.id !== `period-${period}-panel`);
        }
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
      setupClassPeriodForm(period);
    });
  });

  // Add event listener for the Manage Announcements button
  if (manageAnnouncementsBtn) {
    manageAnnouncementsBtn.addEventListener('click', () => {
      // Deactivate all period tab buttons
      tabButtons.forEach((btn) => btn.classList.remove('active'));
      // Activate the announcement button
      manageAnnouncementsBtn.classList.add('active');

      // Hide all period tab panels
      tabPanels.forEach((panel) => {
         if (panel.id !== 'announcements-panel') { // Don't hide the announcement panel itself
            panel.classList.add('hidden');
         }
      });

      // Show the announcement panel
      announcementsPanel.classList.remove('hidden');

      // Load current announcements when the tab is clicked
      loadCurrentAnnouncements(); 
    });
  }

  // --- Announcement Management Functions ---

  async function loadCurrentAnnouncements() {
    if (!currentAnnouncementsList) return; // Exit if the list element doesn't exist

    currentAnnouncementsList.innerHTML = '<p>Loading announcements...</p>'; // Show loading state

    try {
      const token = await getToken();
      const response = await fetch('/api/announcements', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch announcements: ${response.statusText}`);
      }

      const announcements = await response.json();
      displayAnnouncements(announcements);

    } catch (error) {
      console.error('Error loading announcements:', error);
      currentAnnouncementsList.innerHTML = '<p class="error-message">Failed to load announcements.</p>';
      showToast('Error', 'Failed to load announcements.');
    }
  }

  function displayAnnouncements(announcements) {
    if (!currentAnnouncementsList) return;

    if (announcements.length === 0) {
      currentAnnouncementsList.innerHTML = '<p>No announcements found.</p>';
      return;
    }

    currentAnnouncementsList.innerHTML = ''; // Clear previous content
    const ul = document.createElement('ul');
    ul.className = 'announcements-admin-list';

    announcements.forEach(ann => {
      const li = document.createElement('li');
      li.className = 'announcement-admin-item';
      li.dataset.id = ann.id;

      const title = document.createElement('span');
      title.className = 'announcement-admin-title';
      title.textContent = ann.title;
      if (ann.pinned) {
        title.textContent += ' (Pinned)';
        li.classList.add('pinned');
      }


      const dateSpan = document.createElement('span');
      dateSpan.className = 'announcement-admin-date';
      try {
        // Firestore timestamp handling
        let date;
        if (ann.date && ann.date.seconds) {
           date = new Date(ann.date.seconds * 1000);
        } else if (ann.date && ann.date._seconds) { // Handle potential alternative structure
           date = new Date(ann.date._seconds * 1000);
        } else if (ann.date) { // Fallback if it's already a string/number
           date = new Date(ann.date);
        }
        dateSpan.textContent = date ? date.toLocaleString() : 'Invalid Date';
      } catch (e) {
         console.error("Error parsing date:", ann.date, e);
         dateSpan.textContent = 'Invalid Date';
      }


      const actions = document.createElement('div');
      actions.className = 'announcement-admin-actions';

      const editButton = document.createElement('button');
      editButton.textContent = 'Edit';
      editButton.className = 'edit-button small-button';
      editButton.addEventListener('click', () => handleEditAnnouncement(ann));

      const deleteButton = document.createElement('button');
      deleteButton.textContent = 'Delete';
      deleteButton.className = 'delete-button small-button';
      deleteButton.addEventListener('click', () => handleDeleteAnnouncement(ann.id));

      actions.appendChild(editButton);
      actions.appendChild(deleteButton);

      li.appendChild(title);
      li.appendChild(dateSpan);
      li.appendChild(actions);
      ul.appendChild(li);
    });

    currentAnnouncementsList.appendChild(ul);
  }
  
  // Placeholder for edit functionality
  function handleEditAnnouncement(announcement) {
    console.log('Edit announcement:', announcement);
    showToast('Info', 'Edit functionality not yet implemented.');
    // TODO: Populate form, change submit handler to PUT
  }

  // Placeholder for delete functionality
  async function handleDeleteAnnouncement(id) {
     const confirmed = await showConfirmationModal(`Are you sure you want to delete this announcement? This action cannot be undone.`);
     if (!confirmed) return;

     try {
        const token = await getToken();
        const response = await fetch(`/api/announcements?id=${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to delete announcement');
        }

        showToast('Success', 'Announcement deleted successfully.');
        loadCurrentAnnouncements(); // Refresh the list

     } catch (error) {
        console.error('Error deleting announcement:', error);
        showToast('Error', `Failed to delete announcement: ${error.message}`);
     }
  }


  // Add submit event listener for the announcement form
  if (announcementForm) {
    announcementForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitButton = announcementForm.querySelector('button[type="submit"]');
      if (submitButton.disabled) return;

      submitButton.disabled = true;

      // Get form data
      const titleInput = document.getElementById('announcement-title');
      const descriptionInput = document.getElementById('announcement-description');
      const pinnedInput = document.getElementById('announcement-pinned');
      const bodyContent = tinymce.get('tinymce-editor')?.getContent(); // Get content from TinyMCE

      const title = titleInput.value.trim();
      const description = descriptionInput.value.trim();
      const pinned = pinnedInput.checked;

      // Basic validation
      if (!title) {
        showToast('Validation Error', 'Please enter a title for the announcement.');
        submitButton.disabled = false;
        return;
      }
      if (!bodyContent) {
        showToast('Validation Error', 'Please enter the announcement body text.');
        submitButton.disabled = false;
        return;
      }

      const announcementData = {
        title,
        description,
        body: bodyContent,
        pinned,
      };

      try {
        const token = await getToken();
        const response = await fetch('/api/announcements', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(announcementData),
        });

        const result = await response.json();

        if (response.ok) {
          showToast('Success', 'Announcement created successfully!');
          // Clear the form
          titleInput.value = '';
          descriptionInput.value = '';
          pinnedInput.checked = false;
          tinymce.get('tinymce-editor')?.setContent('');
          // Refresh the list of announcements
          loadCurrentAnnouncements();
        } else {
          showToast('Error', result.message || 'Failed to create announcement.');
        }
      } catch (error) {
        console.error('Error creating announcement:', error);
        showToast('Network Error', 'Failed to create announcement. Please try again later.');
      } finally {
        // Re-enable submit button after a short delay or immediately
         setTimeout(() => { submitButton.disabled = false; }, 1000);
      }
    });
  }


  // --- End Announcement Management Functions ---


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

      const target = `all ${instrument} players in ${periodNames[period] || `Period ${period}`}`;
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

  function setupClassPeriodForm(period) {
    const form = document.getElementById(`update-by-class-form-${period}`);
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitButton = form.querySelector('button[type="submit"]');
      if (submitButton.disabled) return;
      
      submitButton.disabled = true;
      const amountInput = form.querySelector(`#period-${period}-class-amount`);
      const amount = parseInt(amountInput.value, 10);
      
      if (isNaN(amount)) {
        showToast('Validation Error', 'Please enter a valid amount.');
        submitButton.disabled = false;
        return;
      }

      const target = `all students in ${periodNames[period] || `Period ${period}`}`;
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
            period: parseInt(period, 10), 
            amount 
          }),
        });
        
        const result = await response.json();
        if (response.ok) {
          showToast('Success', `Successfully updated balances for students in period ${period} by ${amount}`);
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

      const target = period !== 'all' ? `all students in ${periodNames[period] || `Period ${period}`}` : 'all students';
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
s
document.addEventListener('DOMContentLoaded', loadAdminContent);