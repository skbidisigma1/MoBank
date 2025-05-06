let deferredPrompt;
let loadingTimeout;
let lastActiveElement;
let isViewingSingleAnnouncement = false;
let allAnnouncements = [];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const loadingIndicator = document.getElementById('loading-indicator');
        loadingIndicator.style.display = 'none';
        
        await Promise.all([
            initializeInstallPrompt(),
            initializeAnnouncementsSystem(),
            initializeEventListeners()
        ]);

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('showAnnouncements') === 'true') {
            setTimeout(() => loadAndOpenAllAnnouncements(), 500);
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
            if (isViewingSingleAnnouncement) {
                openAnnouncementsModal(allAnnouncements);
            } else {
                closeAnnouncementsModal();
            }
        });
        closeModalBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (isViewingSingleAnnouncement) {
                    openAnnouncementsModal(allAnnouncements);
                } else {
                    closeAnnouncementsModal();
                }
            }
        });
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                if (isViewingSingleAnnouncement) {
                    openAnnouncementsModal(allAnnouncements);
                } else {
                    closeAnnouncementsModal();
                }
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

async function loadAndOpenAllAnnouncements() {
    try {
        // Check cache first
        const cachedAnnouncements = getCachedAnnouncements();
        if (cachedAnnouncements) {
            openAnnouncementsModal(cachedAnnouncements);
            return;
        }
        
        // Fetch from API if not cached
        const response = await fetch('/api/announcements');
        if (!response.ok) throw new Error('Failed to fetch announcements');
        
        const announcements = await response.json();
        // Store globally and cache
        allAnnouncements = announcements;
        setCachedAnnouncements(announcements);
        
        // Sort and open modal
        announcements.sort((a, b) => {
            const dateA = a.date && a.date.seconds ? new Date(a.date.seconds * 1000) : 
                         a.date && a.date._seconds ? new Date(a.date._seconds * 1000) :
                         new Date(a.date);
            const dateB = b.date && b.date.seconds ? new Date(b.date.seconds * 1000) : 
                         b.date && b.date._seconds ? new Date(b.date._seconds * 1000) :
                         new Date(b.date);
            return dateB - dateA;
        });
        
        openAnnouncementsModal(announcements);
    } catch (error) {
        console.error('Error loading announcements:', error);
        showToast('Error', 'Failed to load announcements. Please try again.');
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
    try {
        // Check if we have cached announcements
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
        
        // Sort by date, handling Firestore timestamp objects
        announcements.sort((a, b) => {
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
            const mainContainer = document.getElementById('main-announcement');
            
            if (mainContainer) {
                const fragment = document.createDocumentFragment();
                
                const title = document.createElement('h4');
                title.textContent = mainAnn.title;
                
                const description = document.createElement('p');
                description.innerHTML = mainAnn.description;
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
                
                fragment.appendChild(title);
                fragment.appendChild(description);
                fragment.appendChild(date);
                
                // Add creator if available
                if (mainAnn.createdBy) {
                    const creator = document.createElement('div');
                    creator.className = 'announcement-creator';
                    creator.textContent = `Posted by: ${mainAnn.createdBy}`;
                    fragment.appendChild(creator);
                }
                
                mainContainer.innerHTML = '';
                mainContainer.appendChild(fragment);
                
                mainContainer.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openAnnouncementsModal(announcements);
                });
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

function openAnnouncementsModal(announcements) {
    const modal = document.getElementById('announcements-modal');
    const list = document.getElementById('announcements-list');
    const closeBtn = document.getElementById('close-announcements-modal');
    
    if (!modal || !list) return;
    
    lastActiveElement = document.activeElement;
    const fragment = document.createDocumentFragment();
    
    // Check if we're viewing a single announcement in detail view
    // This is only true if we're viewing a single announcement AND it's not the initial "all" view
    isViewingSingleAnnouncement = announcements.length === 1 && 
        allAnnouncements.length !== 1 && 
        announcements[0].id === allAnnouncements.find(a => a.id === announcements[0].id)?.id;
    
    if (closeBtn) {
        closeBtn.textContent = isViewingSingleAnnouncement ? 'Back to All' : 'Close';
        closeBtn.setAttribute('aria-label', isViewingSingleAnnouncement ? 'Back to all announcements' : 'Close announcements');
    }
    
    announcements.forEach(ann => {
        const card = document.createElement('div');
        card.className = 'announcement-card';
        card.tabIndex = 0;
        card.setAttribute('role', 'article');
        card.setAttribute('aria-labelledby', `announcement-title-${ann.id}`);
        
        if (ann.id === 1) {
            card.classList.add('highlighted-announcement');
        }
        
        const title = document.createElement('h4');
        title.id = `announcement-title-${ann.id}`;
        title.textContent = ann.title;
        
        // When viewing all announcements, show description instead of full body
        const contentElement = document.createElement('div');
        if (isViewingSingleAnnouncement || announcements.length === allAnnouncements.length) {
            // If single detail view OR initial view of all announcements
            contentElement.innerHTML = ann.body;
        } else {
            // For the "all announcements" view with condensed items
            contentElement.innerHTML = ann.description;
        }
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
        
        // Add creator name if available
        const creator = document.createElement('div');
        creator.className = 'announcement-creator';
        if (ann.createdBy) {
            creator.textContent = `Posted by: ${ann.createdBy}`;
        }
        
        card.appendChild(title);
        card.appendChild(contentElement);
        card.appendChild(date);
        if (ann.createdBy) {
            card.appendChild(creator);
        }
        
        // Add click handlers only if not already in detail view or if there are multiple announcements
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

