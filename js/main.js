let deferredPrompt;
document.addEventListener('DOMContentLoaded', async () => {
    const getStartedBtn = document.getElementById('get-started-btn');
    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', () => {
            window.location.href = 'login';
        });
    }
    if (window.matchMedia("(display-mode: standalone)").matches) {
        return;
    }
    const dontAsk = await getDontAskAgain();
    if (!dontAsk) {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            document.getElementById('install-prompt').style.display = 'block';
        });
    }
    document.getElementById('install-yes-btn').addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const choiceResult = await deferredPrompt.userChoice;
            document.getElementById('install-prompt').style.display = 'none';
            deferredPrompt = null;
            if (choiceResult.outcome === 'accepted') {
                const userAgent = navigator.userAgent.toLowerCase();
                const isChromeOS = userAgent.includes("cros");
                const isWindows = userAgent.includes("windows");
                if (isChromeOS || isWindows) {
                    setTimeout(() => {
                        window.location.href = "pin";
                    }, 500);
                }
            }
        }
    });
    document.getElementById('install-no-btn').addEventListener('click', () => {
        document.getElementById('install-prompt').style.display = 'none';
    });
    document.getElementById('install-dont-btn').addEventListener('click', async () => {
        document.getElementById('install-prompt').style.display = 'none';
        await saveDontAskAgain(true);
    });
    await loadAnnouncements();
});
function openPreferencesDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("mobank-db", 3);
        request.onupgradeneeded = event => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains("preferences")) {
                db.createObjectStore("preferences", { keyPath: "key" });
            }
            if (!db.objectStoreNames.contains("themeStore")) {
                db.createObjectStore("themeStore");
            }
        };
        request.onsuccess = event => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains("preferences")) {
                db.close();
                const deleteRequest = indexedDB.deleteDatabase("mobank-db");
                deleteRequest.onsuccess = () => {
                    openPreferencesDB().then(resolve).catch(reject);
                };
                deleteRequest.onerror = () => {
                    reject(deleteRequest.error);
                };
                return;
            }
            resolve(db);
        };
        request.onerror = event => {
            reject(event.target.error);
        };
    });
}
async function getDontAskAgain() {
    const db = await openPreferencesDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("preferences", "readonly");
        const store = transaction.objectStore("preferences");
        const req = store.get("dontAskInstall");
        req.onsuccess = () => {
            resolve(req.result ? req.result.value : false);
        };
        req.onerror = () => {
            reject(req.error);
        };
    });
}
async function saveDontAskAgain(val) {
    const db = await openPreferencesDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("preferences", "readwrite");
        const store = transaction.objectStore("preferences");
        const req = store.put({ key: "dontAskInstall", value: val });
        req.onsuccess = () => {
            resolve(true);
        };
        req.onerror = () => {
            reject(req.error);
        };
    });
}
async function loadAnnouncements() {
    try {
        const response = await fetch('/data/announcements.json');
        if (!response.ok) throw new Error('Failed to fetch announcements');
        const announcements = await response.json();
        announcements.sort((a, b) => new Date(b.date) - new Date(a.date));
        if (announcements.length > 0) {
            const mainAnn = announcements[0];
            const mainContainer = document.getElementById('main-announcement');
            mainContainer.innerHTML = '';
            const title = document.createElement('h4');
            title.innerHTML = mainAnn.title;
            const description = document.createElement('p');
            description.innerHTML = mainAnn.description;
            const date = document.createElement('div');
            date.className = 'announcement-date';
            date.textContent = mainAnn.date;
            mainContainer.appendChild(title);
            mainContainer.appendChild(description);
            mainContainer.appendChild(date);
            mainContainer.addEventListener('click', () => {
                openAnnouncementsModal(announcements);
            });
            document.getElementById('view-all-announcements').addEventListener('click', () => {
                openAnnouncementsModal(announcements);
            });
        }
    } catch (error) {
        console.error(error);
    }
}
function openAnnouncementsModal(announcements) {
    document.getElementById('content').classList.add('blurred');
    const modal = document.getElementById('announcements-modal');
    const list = document.getElementById('announcements-list');
    list.innerHTML = '';
    announcements.forEach(ann => {
        const entry = document.createElement('div');
        entry.className = 'announcement-entry';
        if (ann.id === 1) {
            entry.classList.add('highlight');
        }
        const title = document.createElement('h4');
        title.innerHTML = ann.title;
        const body = document.createElement('div');
        body.innerHTML = ann.body;
        const date = document.createElement('div');
        date.className = 'announcement-date';
        date.textContent = ann.date;
        entry.appendChild(title);
        entry.appendChild(body);
        entry.appendChild(date);
        entry.addEventListener('click', () => {
            window.location.href = '/announcement?id=' + ann.id;
        });
        list.appendChild(entry);
    });
    modal.classList.remove('hidden');
}
document.getElementById('close-announcements-modal').addEventListener('click', () => {
    document.getElementById('announcements-modal').classList.add('hidden');
    document.getElementById('content').classList.remove('blurred');
});