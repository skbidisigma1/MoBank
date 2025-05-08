let deferredPrompt;
let loadingTimeout;
let lastActiveElement;
let isViewingSingleAnnouncement = false;
let allAnnouncements = [];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await Promise.all([
            initializeInstallPrompt(),
            initializeAnnouncementsSystem(),
            initializeEventListeners()
        ]);

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('showAnnouncements') === 'true') {
            // If there is a specific announcement ID in the URL, highlight that announcement
            const announcementId = urlParams.get('announcementId');
            setTimeout(() => loadAndOpenAllAnnouncements(announcementId), 500);
        }

    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Error', 'Failed to initialize application. Please refresh the page.');
    }
});

async function initializeInstallPrompt() {
    if (!window.matchMedia('(display-mode: standalone)').matches) {
        const dontAsk = await getDontAskAgain();
        if (!dontAsk) {
            window.addEventListener('beforeinstallprompt', handleInstallPrompt);
        }
    }

    const installYesBtn = document.getElementById('install-yes-btn');
    const installNoBtn = document.getElementById('install-no-btn');
    const installDontBtn = document.getElementById('install-dont-btn');

    if (installYesBtn) {
        installYesBtn.addEventListener('click', handleInstallAccept);
    }
    if (installNoBtn) {
        installNoBtn.addEventListener('click', handleInstallDecline);
    }
    if (installDontBtn) {
        installDontBtn.addEventListener('click', handleInstallDontAsk);
    }
}

function handleInstallPrompt(e) {
    e.preventDefault();
    deferredPrompt = e;
    const installPrompt = document.getElementById('install-prompt');
    if (installPrompt) {
        installPrompt.style.display = 'block';
    }
}

async function handleInstallAccept() {
    if (!deferredPrompt) return;

    try {
        const { outcome } = await deferredPrompt.prompt();
        document.getElementById('install-prompt').style.display = 'none';
        deferredPrompt = null;

        if (outcome === 'accepted') {
            const userAgent = navigator.userAgent.toLowerCase();
            const isChromeOS = userAgent.includes('cros');
            const isWindows = userAgent.includes('windows');
            
            if (isChromeOS || isWindows) {
                setTimeout(() => window.location.href = 'pin', 500);
            }
        }
    } catch (error) {
        console.error('Installation error:', error);
        showToast('Error', 'Failed to install application. Please try again.');
    }
}

function handleInstallDecline() {
    document.getElementById('install-prompt').style.display = 'none';
}

async function handleInstallDontAsk() {
    try {
        document.getElementById('install-prompt').style.display = 'none';
        await saveDontAskAgain(true);
    } catch (error) {
        console.error('Failed to save preference:', error);
    }
}

async function initializeAnnouncementsSystem() {
    const viewAllBtn = document.getElementById('view-all-announcements');
    const closeModalBtn = document.getElementById('close-announcements-modal');
    const modal = document.getElementById('announcements-modal');

    if (viewAllBtn) {
        const handler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            loadAndOpenAllAnnouncements();
        };

        viewAllBtn.addEventListener('click', handler);
        viewAllBtn.addEventListener('touchend', handler);
        viewAllBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handler(e);
            }
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            closeAnnouncementsModal();
        });
        closeModalBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                closeAnnouncementsModal();
            }
        });
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeAnnouncementsModal();
            }
        });

        modal.addEventListener('keydown', handleModalKeyboard);
    }

    await loadAnnouncements();
}

function handleModalKeyboard(e) {
    const modal = e.currentTarget;
    const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    const announcementCards = modal.querySelectorAll('.announcement-card');
    let currentCard = Array.from(announcementCards).find(card => card === document.activeElement);
    
    switch (e.key) {
        case 'Escape':
            e.preventDefault();
            closeAnnouncementsModal();
            break;
            
        case 'Tab':
            if (e.shiftKey) {
                if (document.activeElement === firstFocusable) {
                    e.preventDefault();
                    lastFocusable.focus();
                }
            } else {
                if (document.activeElement === lastFocusable) {
                    e.preventDefault();
                    firstFocusable.focus();
                }
            }
            break;
            
        case 'ArrowDown':
            e.preventDefault();
            if (currentCard) {
                const nextCard = currentCard.nextElementSibling;
                if (nextCard && nextCard.classList.contains('announcement-card')) {
                    nextCard.focus();
                }
            } else if (announcementCards.length > 0) {
                announcementCards[0].focus();
            }
            break;
            
        case 'ArrowUp':
            e.preventDefault();
            if (currentCard) {
                const prevCard = currentCard.previousElementSibling;
                if (prevCard && prevCard.classList.contains('announcement-card')) {
                    prevCard.focus();
                }
            } else if (announcementCards.length > 0) {
                announcementCards[announcementCards.length - 1].focus();
            }
            break;
            
        case 'Home':
            e.preventDefault();
            if (announcementCards.length > 0) {
                announcementCards[0].focus();
            }
            break;
            
        case 'End':
            e.preventDefault();
            if (announcementCards.length > 0) {
                announcementCards[announcementCards.length - 1].focus();
            }
            break;
    }
}

function initializeEventListeners() {
    const getStartedBtn = document.getElementById('get-started-btn');
    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', async () => {
            try {
                if (auth0Client && await isAuthenticated()) {
                    window.location.href = 'dashboard';
                } else {
                    window.location.href = 'login';
                }
            } catch (error) {
                console.error('Auth check failed:', error);
                window.location.href = 'login';
            }
        });
    }

    const moToolsBtn = document.getElementById('motools-btn');
    if (moToolsBtn) {
        moToolsBtn.addEventListener('click', () => {
            window.location.href = 'tools';
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !document.getElementById('announcements-modal').classList.contains('hidden')) {
            closeAnnouncementsModal();
        }
    });
}

async function loadAndOpenAllAnnouncements(targetAnnouncementId) {
    const announcementsModal = document.getElementById('announcements-modal');
    const announcementsList = document.getElementById('announcements-list');
    
    // Show the modal immediately with a loading spinner
    if (announcementsModal && announcementsList) {
        announcementsModal.classList.remove('hidden');
        announcementsList.innerHTML = `
            <div class="loader" aria-label="Loading announcements...">
                <span class="sr-only">Loading announcements...</span>
            </div>
        `;
    }

    try {
        // Check cache first
        const cachedAnnouncements = getCachedAnnouncements();
        let announcements;
        
        if (cachedAnnouncements) {
            announcements = cachedAnnouncements;
            
            // If a specific announcement is requested, find it and display it directly
            if (targetAnnouncementId) {
                const targetAnnouncement = announcements.find(ann => ann.id === targetAnnouncementId);
                if (targetAnnouncement) {
                    openAnnouncementsModal([targetAnnouncement]);
                    return;
                }
            }
            
            openAnnouncementsModal(announcements, targetAnnouncementId);
            return;
        }
        
        // Fetch from API if not cached
        const response = await fetch('/api/announcements');
        if (!response.ok) throw new Error('Failed to fetch announcements');
        
        announcements = await response.json();
        // Store globally and cache
        allAnnouncements = announcements;
        setCachedAnnouncements(announcements);
        
        // Sort announcements: pinned first, then by date
        announcements.sort((a, b) => {
            // First sort by pinned status
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            
            // If both have the same pin status, sort by date descending
            const dateA = a.date && a.date.seconds ? new Date(a.date.seconds * 1000) : 
                        a.date && a.date._seconds ? new Date(a.date._seconds * 1000) :
                        new Date(a.date);
            const dateB = b.date && b.date.seconds ? new Date(b.date.seconds * 1000) : 
                        b.date && b.date._seconds ? new Date(b.date._seconds * 1000) :
                        new Date(b.date);
            return dateB - dateA;
        });
        
        // If a specific announcement is requested, find it and display it directly
        if (targetAnnouncementId) {
            const targetAnnouncement = announcements.find(ann => ann.id === targetAnnouncementId);
            if (targetAnnouncement) {
                openAnnouncementsModal([targetAnnouncement]);
                return;
            } else {
                // If not found, still open all announcements but highlight the target
                openAnnouncementsModal(announcements, targetAnnouncementId);
                return;
            }
        }
        openAnnouncementsModal(announcements);
    } catch (error) {
        console.error('Error loading announcements:', error);
        showToast('Error', 'Failed to load announcements. Please try again.');
        
        // Display error in modal if it's open
        if (announcementsModal && !announcementsModal.classList.contains('hidden') && announcementsList) {
            announcementsList.innerHTML = '<p class="error-message">Failed to load announcements. Please try again.</p>';
        }
    }
}

function openPreferencesDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('mobank-db', 3);
        
        request.onupgradeneeded = event => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('preferences')) {
                db.createObjectStore('preferences', { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains('themeStore')) {
                db.createObjectStore('themeStore');
            }
        };

        request.onsuccess = event => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('preferences')) {
                db.close();
                const deleteRequest = indexedDB.deleteDatabase('mobank-db');
                deleteRequest.onsuccess = () => {
                    openPreferencesDB().then(resolve).catch(reject);
                };
                deleteRequest.onerror = () => reject(deleteRequest.error);
                return;
            }
            resolve(db);
        };

        request.onerror = event => reject(event.target.error);
    });
}

async function getDontAskAgain() {
    try {
        const db = await openPreferencesDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('preferences', 'readonly');
            const store = transaction.objectStore('preferences');
            const request = store.get('dontAskInstall');
            
            request.onsuccess = () => resolve(request.result ? request.result.value : false);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error getting preference:', error);
        return false;
    }
}

async function saveDontAskAgain(val) {
    try {
        const db = await openPreferencesDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('preferences', 'readwrite');
            const store = transaction.objectStore('preferences');
            const request = store.put({ key: 'dontAskInstall', value: val });
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error saving preference:', error);
        throw error;
    }
}

async function loadAnnouncements() {
    const mainContainer = document.getElementById('main-announcement');
    if (mainContainer) {
        // Show loading spinner while fetching announcements
        mainContainer.innerHTML = `
            <div class="loader" aria-label="Loading announcements...">
                <span class="sr-only">Loading announcements...</span>
            </div>
        `;
    }

    try {
        const cachedAnnouncements = getCachedAnnouncements();
        let announcements;
        
        if (cachedAnnouncements) {
            announcements = cachedAnnouncements;
            allAnnouncements = cachedAnnouncements;
        } else {
            // Fetch from API if no cache
            const response = await fetch('/api/announcements');
            if (!response.ok) throw new Error('Failed to fetch announcements');
            
            announcements = await response.json();
            // Store all announcements globally for later use
            allAnnouncements = announcements;
            
            // Cache the announcements
            setCachedAnnouncements(announcements);
        }
        
        // Sort announcements: pinned first, then by date
        announcements.sort((a, b) => {
            // First sort by pinned status
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            
            // If both have the same pin status, sort by date descending
            const dateA = a.date && a.date.seconds ? new Date(a.date.seconds * 1000) : 
                        a.date && a.date._seconds ? new Date(a.date._seconds * 1000) :
                        new Date(a.date);
            const dateB = b.date && b.date.seconds ? new Date(b.date.seconds * 1000) : 
                        b.date && b.date._seconds ? new Date(b.date._seconds * 1000) :
                        new Date(b.date);
            return dateB - dateA;
        });
        
        if (announcements.length > 0) {
            const mainAnn = announcements[0];
            
            if (mainContainer) {
                const fragment = document.createDocumentFragment();
                
                const title = document.createElement('h4');
                title.textContent = mainAnn.title;
                
                const description = document.createElement('p');
                description.innerHTML = mainAnn.description || '';
                
                fragment.appendChild(title);
                fragment.appendChild(description);
                
                // Create a meta container for date and creator information
                const metaContainer = document.createElement('div');
                metaContainer.className = 'announcement-meta';
                
                const date = document.createElement('div');
                date.className = 'announcement-date';
                
                // Format the date properly for Firestore timestamp
                try {
                    let formattedDate;
                    if (mainAnn.date && mainAnn.date.seconds) {
                        formattedDate = new Date(mainAnn.date.seconds * 1000).toLocaleString();
                    } else if (mainAnn.date && mainAnn.date._seconds) {
                        formattedDate = new Date(mainAnn.date._seconds * 1000).toLocaleString();
                    } else if (mainAnn.date) {
                        formattedDate = new Date(mainAnn.date).toLocaleString();
                    } else {
                        formattedDate = 'Unknown Date';
                    }
                    date.textContent = formattedDate;
                } catch (e) {
                    console.error("Error parsing date:", mainAnn.date, e);
                    date.textContent = 'Unknown Date';
                }
                
                metaContainer.appendChild(date);
                
                // Add creator if available
                if (mainAnn.createdBy) {
                    const creator = document.createElement('div');
                    creator.className = 'announcement-creator';
                    creator.textContent = `Posted by: ${mainAnn.createdBy}`;
                    metaContainer.appendChild(creator);
                    
                    // Show edit info if the announcement has been edited
                    if (mainAnn.isEdited && mainAnn.editedBy) {
                        const editInfo = document.createElement('div');
                        editInfo.className = 'announcement-edited';
                        editInfo.innerHTML = `<span class="edited-badge">Edited</span> by ${mainAnn.editedBy}`;
                        metaContainer.appendChild(editInfo);
                    }
                }
                
                // Add the meta container to the fragment
                fragment.appendChild(metaContainer);
                
                // Apply any pinned styling if the announcement is pinned
                if (mainAnn.pinned) {
                    mainContainer.classList.add('pinned');
                } else {
                    mainContainer.classList.remove('pinned');
                }
                
                mainContainer.innerHTML = '';
                mainContainer.appendChild(fragment);
                
                // Make the entire container clickable and keyboard accessible
                mainContainer.style.cursor = 'pointer';
                mainContainer.tabIndex = 0;
                mainContainer.setAttribute('role', 'button');
                mainContainer.setAttribute('aria-label', `View announcement: ${mainAnn.title}`);
                
                // Clear any existing event listeners by cloning the node
                const newContainer = mainContainer.cloneNode(true);
                mainContainer.parentNode.replaceChild(newContainer, mainContainer);
                
                // Add click event to the new container
                newContainer.addEventListener('click', () => {
                    openAnnouncementsModal([mainAnn]);
                });
                
                // Add keyboard accessibility
                newContainer.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openAnnouncementsModal([mainAnn]);
                    }
                });
            }
        } else {
            // Handle case where there are no announcements
            if (mainContainer) {
                mainContainer.innerHTML = '<p>No announcements available</p>';
            }
        }
    } catch (error) {
        console.error('Error loading announcements:', error);
        const mainContainer = document.getElementById('main-announcement');
        if (mainContainer) {
            mainContainer.innerHTML = '<p class="error-message">Failed to load announcements</p>';
        }
    }
}

function openAnnouncementsModal(announcements, targetAnnouncementId) {
    const modal = document.getElementById('announcements-modal');
    const list = document.getElementById('announcements-list');
    const closeBtn = document.getElementById('close-announcements-modal');
    const modalHeading = document.getElementById('modal-heading');
    
    if (!modal || !list) return;
    
    lastActiveElement = document.activeElement;
    const fragment = document.createDocumentFragment();
      // Track which view we're showing
    // Three possible states:
    // 1. Initial loading of all announcements
    // 2. Showing detailed view of a specific announcement
    // 3. Showing all announcements after viewing a detailed announcement
    
    // Store the view state in a marker attribute on the modal
    const initialLoad = !modal.dataset.loaded;
    
    // Simpler logic: If we're displaying exactly one announcement, show it in detail view
    // regardless of any other conditions
    isViewingSingleAnnouncement = (announcements.length === 1);

    // If this is the first time opening the modal, mark it as loaded
    if (initialLoad) {
        modal.dataset.loaded = "true";
    }
    
    // Update modal title based on view mode
    if (modalHeading) {
        modalHeading.textContent = isViewingSingleAnnouncement ? 'Announcement' : 'All Announcements';
    }
    
    if (closeBtn) {
        if (isViewingSingleAnnouncement) {
            if (allAnnouncements.length > 1) {
                closeBtn.textContent = 'Back to All Announcements';
                closeBtn.setAttribute('aria-label', 'Back to all announcements');
                
                // Override the normal close button behavior when viewing a single announcement
                closeBtn.onclick = () => {
                    openAnnouncementsModal(allAnnouncements);
                };
            } else {
                closeBtn.textContent = 'Close';
                closeBtn.setAttribute('aria-label', 'Close announcement');
            }
        } else {
            closeBtn.textContent = 'Close';
            closeBtn.setAttribute('aria-label', 'Close announcements');
            
            // Reset the close button behavior
            closeBtn.onclick = closeAnnouncementsModal;
        }
    }
    
    announcements.forEach(ann => {
        const card = document.createElement('div');
        card.className = 'announcement-card';
        card.tabIndex = 0;
        card.setAttribute('role', 'article');
        card.setAttribute('aria-labelledby', `announcement-title-${ann.id}`);
        card.dataset.id = ann.id;
        
        // Apply pinned styling if the announcement is pinned
        if (ann.pinned) {
            card.classList.add('pinned');
        }
        
        // Highlight the specific announcement if requested
        if (targetAnnouncementId && ann.id === targetAnnouncementId) {
            card.classList.add('highlighted-announcement');
            
            // Scroll into view with a small delay to ensure the DOM is ready
            setTimeout(() => {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.focus();
            }, 100);
        }
        
        const title = document.createElement('h4');
        title.id = `announcement-title-${ann.id}`;
        title.textContent = ann.title;
        
        // When viewing all announcements, show description instead of full body
        const contentElement = document.createElement('div');
        contentElement.className = 'announcement-body-content';
        if (isViewingSingleAnnouncement) {
            // In single detail view, show the full body
            contentElement.innerHTML = ann.body;
        } else {
            // For the "all announcements" view with condensed items
            contentElement.innerHTML = ann.description || ann.body.substring(0, 200) + (ann.body.length > 200 ? '...' : '');
        }
        
        // Create a meta container for date and creator information
        const metaContainer = document.createElement('div');
        metaContainer.className = 'announcement-meta';
        
        const date = document.createElement('div');
        date.className = 'announcement-date';
        
        // Format Firestore timestamp
        try {
            let formattedDate;
            if (ann.date && ann.date.seconds) {
                formattedDate = new Date(ann.date.seconds * 1000).toLocaleString();
            } else if (ann.date && ann.date._seconds) {
                formattedDate = new Date(ann.date._seconds * 1000).toLocaleString();
            } else if (ann.date) {
                formattedDate = new Date(ann.date).toLocaleString();
            } else {
                formattedDate = 'Unknown Date';
            }
            date.textContent = formattedDate;
        } catch (e) {
            console.error("Error parsing date:", ann.date, e);
            date.textContent = 'Unknown Date';
        }
        
        metaContainer.appendChild(date);
        
        // Add creator name if available
        if (ann.createdBy) {
            const creator = document.createElement('div');
            creator.className = 'announcement-creator';
            creator.textContent = `Posted by: ${ann.createdBy}`;
            metaContainer.appendChild(creator);
            
            // Show edited information if available
            if (ann.isEdited && ann.editedBy) {
                const editInfo = document.createElement('div');
                editInfo.className = 'announcement-edited';
                editInfo.innerHTML = `<span class="edited-badge">Edited</span> by ${ann.editedBy}`;
                metaContainer.appendChild(editInfo);
            }
        }
        
        card.appendChild(title);
        card.appendChild(contentElement);
        card.appendChild(metaContainer);
        
        // Add click handlers only if not already in detail view
        if (!isViewingSingleAnnouncement) {
            card.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                card.focus();
                openAnnouncementsModal([ann]);
            });
            
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openAnnouncementsModal([ann]);
                }
            });
        }
        
        fragment.appendChild(card);
    });
    
    list.innerHTML = '';
    list.appendChild(fragment);
    modal.classList.remove('hidden');
    
    const firstCard = list.querySelector('.announcement-card');
    if (firstCard) {
        firstCard.focus();
    }
}

function closeAnnouncementsModal() {
    const modal = document.getElementById('announcements-modal');
    if (modal) {
        modal.classList.add('hidden');
        if (lastActiveElement) {
            lastActiveElement.focus();
        }
    }
}

window.addEventListener('unload', () => {
    window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    clearTimeout(loadingTimeout);
});

function showToast(title, message) {
    const event = new CustomEvent('show-toast', {
        detail: { title, message }
    });
    document.dispatchEvent(event);
}

// Helper function to get cached announcements
function getCachedAnnouncements() {
    const cached = localStorage.getItem('announcements');
    const ANNOUNCEMENTS_COOLDOWN_MILLISECONDS = 60 * 1000; // 1 minute cache
    if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < ANNOUNCEMENTS_COOLDOWN_MILLISECONDS) {
            return parsed.data;
        }
    }
    return null;
}

// Helper function to cache announcements
function setCachedAnnouncements(data) {
    const cacheEntry = {
        data: data,
        timestamp: Date.now()
    };
    localStorage.setItem('announcements', JSON.stringify(cacheEntry));
}

