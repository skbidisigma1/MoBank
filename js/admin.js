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
  }  const cancelBtn = document.getElementById('editor-cancel-btn');
  const hiddenTextarea = document.getElementById('announcement-body');  if (document.getElementById('tinymce-editor') && cancelBtn && hiddenTextarea) {
    tinymce.init({
      target: document.getElementById('tinymce-editor'),      height: 300,
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
      forced_root_block: 'p',
      forced_root_block_attrs: {
        'class': 'editor-paragraph'
      },
      valid_classes: {
        '*': 'align-left align-center align-right align-justify font-bold font-italic font-underline editor-paragraph'
      },
      formats: {
        alignleft: { selector: 'p,h1,h2,h3,h4,h5,h6,td,th,div,ul,ol,li', classes: 'align-left' },
        aligncenter: { selector: 'p,h1,h2,h3,h4,h5,h6,td,th,div,ul,ol,li', classes: 'align-center' },
        alignright: { selector: 'p,h1,h2,h3,h4,h5,h6,td,th,div,ul,ol,li', classes: 'align-right' },
        alignjustify: { selector: 'p,h1,h2,h3,h4,h5,h6,td,th,div,ul,ol,li', classes: 'align-justify' },
        bold: { inline: 'span', classes: 'font-bold' },
        italic: { inline: 'span', classes: 'font-italic' },
        underline: { inline: 'span', classes: 'font-underline' },
        paragraph: { block: 'p', classes: 'editor-paragraph' },
      },
      style_formats: [
        { title: 'Alignment', items: [
          { title: 'Left', format: 'alignleft' },
          { title: 'Center', format: 'aligncenter' },
          { title: 'Right', format: 'alignright' },
          { title: 'Justify', format: 'alignjustify' }
        ]},
        { title: 'Text', items: [
          { title: 'Bold', format: 'bold' },
          { title: 'Italic', format: 'italic' },
          { title: 'Underline', format: 'underline' }
        ]}
      ],      inline_styles: false,
      valid_elements: '*[*]',  
      extended_valid_elements: '*[*]',
      invalid_elements: 'style',
      invalid_styles: '*',
      
      setup(editor) {
        editor.on('BeforeSetContent', function(e) {
          if (!e.content) return;
          e.content = e.content.replace(/ style="[^"]*"/g, '');
        });
        
        editor.on('GetContent', function(e) {
          if (!e.content) return;
          e.content = e.content.replace(/ style="[^"]*"/g, '');
        });
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

      manageAnnouncementsBtn.classList.remove('active');
      announcementsPanel.classList.add('hidden');

      tabButtons.forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');

      tabPanels.forEach((panel) => {
        if (panel.id !== 'announcements-panel') {
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

  if (manageAnnouncementsBtn) {
    manageAnnouncementsBtn.addEventListener('click', () => {
      tabButtons.forEach((btn) => btn.classList.remove('active'));
      manageAnnouncementsBtn.classList.add('active');

      tabPanels.forEach((panel) => {
         if (panel.id !== 'announcements-panel') {
            panel.classList.add('hidden');
         }
      });

      announcementsPanel.classList.remove('hidden');

      loadCurrentAnnouncements(); 
    });
  }

  function getAdminCachedAnnouncements() {
    const cached = localStorage.getItem('admin-announcements');
    const ADMIN_ANNOUNCEMENTS_COOLDOWN_MILLISECONDS = 30 * 1000;
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < ADMIN_ANNOUNCEMENTS_COOLDOWN_MILLISECONDS) {
        return parsed.data;
      }
    }
    return null;
  }

  function setAdminCachedAnnouncements(data) {
    const cacheEntry = {
      data: data,
      timestamp: Date.now()
    };
    localStorage.setItem('admin-announcements', JSON.stringify(cacheEntry));
  }

  function clearAdminAnnouncementsCache() {
    localStorage.removeItem('admin-announcements');
    localStorage.removeItem('announcements');
  }

  async function loadCurrentAnnouncements(forceRefresh = false) {
    if (!currentAnnouncementsList) return;

    const cachedAnnouncements = forceRefresh ? null : getAdminCachedAnnouncements();
    
    if (cachedAnnouncements) {
      displayAnnouncements(cachedAnnouncements);
      return;
    }
    
    currentAnnouncementsList.innerHTML = '<p>Loading announcements...</p>';

    try {
      const token = await getToken();
      const response = await fetch('/api/announcements', {
        headers: { Authorization: `Bearer ${token}` },
        cache: forceRefresh ? 'no-cache' : 'default'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch announcements: ${response.statusText}`);
      }

      const announcements = await response.json();
      
      setAdminCachedAnnouncements(announcements);
      
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

    announcements.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      
      const dateA = a.date && a.date.seconds ? new Date(a.date.seconds * 1000) : 
                  a.date && a.date._seconds ? new Date(a.date._seconds * 1000) :
                  new Date(a.date);
      const dateB = b.date && b.date.seconds ? new Date(b.date.seconds * 1000) : 
                  b.date && b.date._seconds ? new Date(b.date._seconds * 1000) :
                  new Date(b.date);
      return dateB - dateA;
    });

    currentAnnouncementsList.innerHTML = '';
    const ul = document.createElement('ul');
    ul.className = 'announcements-admin-list';

    announcements.forEach(ann => {
      const li = document.createElement('li');
      li.className = 'announcement-admin-item';
      li.dataset.id = ann.id;
      
      if (ann.pinned) {
        li.classList.add('pinned');
      }

      const title = document.createElement('span');
      title.className = 'announcement-admin-title';
      title.textContent = ann.title;
      if (ann.pinned) {
        title.textContent += ' (Pinned)';
      }
      
      const metaContainer = document.createElement('div');
      metaContainer.className = 'announcement-admin-meta';
      
      const dateSpan = document.createElement('span');
      dateSpan.className = 'announcement-admin-date';
      dateSpan.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z" />
        </svg>
      `;
      
      try {
        let date;
        if (ann.date && ann.date.seconds) {
          date = new Date(ann.date.seconds * 1000);
        } else if (ann.date && ann.date._seconds) {
          date = new Date(ann.date._seconds * 1000);
        } else if (ann.date) {
          date = new Date(ann.date);
        }
        dateSpan.innerHTML += (date ? date.toLocaleString() : 'Unknown Date');
      } catch (e) {
        console.error("Error parsing date:", ann.date, e);
        dateSpan.innerHTML += 'Unknown Date';
      }
      
      metaContainer.appendChild(dateSpan);
      
      if (ann.createdBy) {
        const creatorSpan = document.createElement('span');
        creatorSpan.className = 'announcement-admin-creator';
        creatorSpan.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z" />
          </svg>
          Posted by: ${ann.createdBy}
        `;
        metaContainer.appendChild(creatorSpan);
      }

      if (ann.isEdited && ann.editedBy) {
        const editedSpan = document.createElement('span');
        editedSpan.className = 'announcement-admin-edited';
        editedSpan.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" />
          </svg>
          Edited by: ${ann.editedBy}
        `;
        metaContainer.appendChild(editedSpan);
      }

      const actions = document.createElement('div');
      actions.className = 'announcement-admin-actions';

      const editButton = document.createElement('button');
      editButton.className = 'edit-button';
      editButton.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" />
        </svg>
        Edit
      `;
      editButton.addEventListener('click', () => handleEditAnnouncement(ann));

      const deleteButton = document.createElement('button');
      deleteButton.className = 'delete-button';
      deleteButton.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
        </svg>
        Delete
      `;
      deleteButton.addEventListener('click', () => handleDeleteAnnouncement(ann.id));

      actions.appendChild(editButton);
      actions.appendChild(deleteButton);
      
      li.appendChild(title);
      li.appendChild(metaContainer);
      li.appendChild(actions);
      ul.appendChild(li);
    });

    currentAnnouncementsList.appendChild(ul);
  }
  
  function handleEditAnnouncement(announcement) {
    console.log('Edit announcement:', announcement);
    
    const titleInput = document.getElementById('announcement-title');
    const descriptionInput = document.getElementById('announcement-description');
    const bodyTextarea = document.getElementById('announcement-body');
    const pinnedCheckbox = document.getElementById('announcement-pinned');
    const submitButton = document.querySelector('#announcement-form .submit-button');
    
    titleInput.value = announcement.title || '';
    descriptionInput.value = announcement.description || '';
    bodyTextarea.value = announcement.body || '';
    
    if (tinymce.get('tinymce-editor')) {
        tinymce.get('tinymce-editor').setContent(announcement.body || '');
    }
    
    pinnedCheckbox.checked = announcement.pinned || false;
    
    submitButton.innerHTML = `
        <svg class="button-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z"/></svg>
        Update Announcement`;
    
    if (announcement.createdBy) {
        showToast('Info', `Editing announcement created by ${announcement.createdBy}`);
    }
    
    document.getElementById('announcement-form').scrollIntoView({ behavior: 'smooth' });
    
    const form = document.getElementById('announcement-form');
    
    form.dataset.announcementId = announcement.id;
    
    const oldForm = form;
    const newForm = oldForm.cloneNode(true);
    oldForm.parentNode.replaceChild(newForm, oldForm);
    
    newForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        await handleUpdateAnnouncement(newForm);
    });
  }

  async function handleUpdateAnnouncement(form) {
    const id = form.dataset.announcementId;
    if (!id) {
      showToast('Error', 'Missing announcement ID');
      return;
    }

    const titleInput = document.getElementById('announcement-title');
    const descriptionInput = document.getElementById('announcement-description');
    const bodyTextarea = document.getElementById('announcement-body');
    const pinnedCheckbox = document.getElementById('announcement-pinned');
    const submitButton = form.querySelector('button[type="submit"]');
    
    if (submitButton) {
      submitButton.disabled = true;
    }
    
    // Get the content from TinyMCE
    let body = bodyTextarea.value;
    if (tinymce.get('tinymce-editor')) {
      body = tinymce.get('tinymce-editor').getContent();
      bodyTextarea.value = body;
    }
    
    if (!titleInput.value || !body) {
      showToast('Error', 'Title and body are required');
      if (submitButton) {
        submitButton.disabled = false;
      }
      return;
    }
    
    try {
      const token = await getToken();
      const response = await fetch(`/api/announcements?id=${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: titleInput.value,
          description: descriptionInput.value,
          body: body,
          pinned: pinnedCheckbox.checked
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update announcement: ${response.statusText}`);
      }
      
      showToast('Success', 'Announcement updated successfully');
      
      // Clear cache when an announcement is updated
      clearAdminAnnouncementsCache();
      
      // Reset form to create mode
      resetAnnouncementForm();
      
      // Reload announcements list
      loadCurrentAnnouncements();
      
    } catch (error) {
      console.error('Error updating announcement:', error);
      showToast('Error', `Failed to update announcement: ${error.message}`);
    } finally {
      if (submitButton) {
        setTimeout(() => { submitButton.disabled = false; }, 1000);
      }
    }
  }
  // Function to reset announcement form
  function resetAnnouncementForm() {
    const form = document.getElementById('announcement-form');
    form.reset();
    
    const titleInput = document.getElementById('announcement-title');
    const descriptionInput = document.getElementById('announcement-description');
    const bodyTextarea = document.getElementById('announcement-body');
    const pinnedCheckbox = document.getElementById('announcement-pinned');
    
    titleInput.value = '';
    descriptionInput.value = '';
    bodyTextarea.value = '';
    pinnedCheckbox.checked = false;
    
    if (tinymce.get('tinymce-editor')) {
      tinymce.get('tinymce-editor').setContent('');
    }
    
    const submitButton = document.querySelector('#announcement-form .submit-button');
    submitButton.innerHTML = `
      <svg class="button-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z"/></svg>
      Save & Create Announcement`;
    
    delete form.dataset.announcementId;
    
    form.onsubmit = originalAnnouncementFormSubmit;
  }
  
  let originalAnnouncementFormSubmit;
  if (announcementForm) {
    originalAnnouncementFormSubmit = async function(e) {
      e.preventDefault();
      const submitButton = announcementForm.querySelector('button[type="submit"]');
      if (submitButton.disabled) return;

      submitButton.disabled = true;

      const titleInput = document.getElementById('announcement-title');
      const descriptionInput = document.getElementById('announcement-description');
      const pinnedInput = document.getElementById('announcement-pinned');
      const hiddenTextarea = document.getElementById('announcement-body');
      
      const bodyContent = tinymce.get('tinymce-editor')?.getContent();
      if (hiddenTextarea && bodyContent) {
        hiddenTextarea.value = bodyContent;
      }

      const title = titleInput.value.trim();
      const description = descriptionInput.value.trim();
      const pinned = pinnedInput.checked;
      const patchnoteInput = document.getElementById('announcement-patchnote');
      const patchnote = patchnoteInput ? patchnoteInput.checked : false;

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
        patchnote,
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
          titleInput.value = '';
          descriptionInput.value = '';
          pinnedInput.checked = false;
          tinymce.get('tinymce-editor')?.setContent('');
          loadCurrentAnnouncements();
        } else {
          showToast('Error', result.message || 'Failed to create announcement.');
        }
      } catch (error) {
        console.error('Error creating announcement:', error);
        showToast('Network Error', 'Failed to create announcement. Please try again later.');
      } finally {
        setTimeout(() => { submitButton.disabled = false; }, 1000);
      }
    };
    
    announcementForm.addEventListener('submit', originalAnnouncementFormSubmit);
  }
  async function handleDeleteAnnouncement(announcementId) {
    if (!announcementId) {
      showToast('Error', 'Missing announcement ID');
      return;
    }

    const confirmed = await showConfirmationModal('Are you sure you want to delete this announcement?');
    if (!confirmed) return;

    try {
      const token = await getToken();
      const response = await fetch(`/api/announcements?id=${announcementId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete announcement: ${response.statusText}`);
      }
      
      showToast('Success', 'Announcement deleted successfully');
      
      const form = document.getElementById('announcement-form');
      if (form && form.dataset.announcementId === announcementId) {
        resetAnnouncementForm();
      }
      
      clearAdminAnnouncementsCache();
      
      loadCurrentAnnouncements();
      
    } catch (error) {
      console.error('Error deleting announcement:', error);
      showToast('Error', `Failed to delete announcement: ${error.message}`);
    }
  }

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

document.addEventListener('DOMContentLoaded', loadAdminContent);
