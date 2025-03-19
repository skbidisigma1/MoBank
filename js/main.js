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
            console.log('beforeinstallprompt Event fired');
            e.preventDefault();
            deferredPrompt = e;
            document.getElementById('install-prompt').style.display = 'block';
        });
    }
    document.getElementById('install-yes-btn').addEventListener('click', async () => {
        if (deferredPrompt) {
            console.log('Showing install prompt');
            deferredPrompt.prompt();
            const choiceResult = await deferredPrompt.userChoice;
            console.log(`User response: ${choiceResult.outcome}`);
            document.getElementById('install-prompt').style.display = 'none';
            deferredPrompt = null;
            if (choiceResult.outcome === 'accepted') {
                console.log("PWA installed, checking OS...");
                const userAgent = navigator.userAgent.toLowerCase();
                const isChromeOS = userAgent.includes("cros");
                const isWindows = userAgent.includes("windows");
                if (isChromeOS || isWindows) {
                    console.log("Running on ChromeOS or Windows, redirecting to pin instructions...");
                    setTimeout(() => {
                        window.location.href = "pin";
                    }, 500);
                }
            }
        }
    });
    document.getElementById('install-no-btn').addEventListener('click', () => {
        console.log('User dismissed install prompt');
        document.getElementById('install-prompt').style.display = 'none';
    });
    document.getElementById('install-dont-btn').addEventListener('click', async () => {
        console.log('User chose "Don\'t ask again"');
        document.getElementById('install-prompt').style.display = 'none';
        await saveDontAskAgain(true);
    });
    await fetchAnnouncements();
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
                console.warn("Object store 'preferences' missing. Recreating DB...");
                db.close();
                const deleteRequest = indexedDB.deleteDatabase("mobank-db");
                deleteRequest.onsuccess = () => {
                    openPreferencesDB().then(resolve).catch(reject);
                };
                deleteRequest.onerror = () => {
                    console.error("Failed to delete database.");
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
async function fetchAnnouncements() {
    try {
        const response = await fetch('/data/announcements.json');
        if (!response.ok) {
            throw new Error('Failed to fetch announcements');
        }
        const announcements = await response.json();
        const container = document.getElementById('announcements-container');
        container.innerHTML = '';
        announcements.sort((a, b) => new Date(b.date) - new Date(a.date));
        announcements.forEach(announcement => {
            const annDiv = document.createElement('div');
            annDiv.className = 'announcement';
            const title = document.createElement('h4');
            title.innerHTML = announcement.title;
            const body = document.createElement('div');
            body.innerHTML = announcement.body;
            const date = document.createElement('div');
            date.className = 'announcement-date';
            date.textContent = announcement.date;
            annDiv.appendChild(title);
            annDiv.appendChild(body);
            annDiv.appendChild(date);
            if (announcement.pinned) {
                annDiv.classList.add('pinned');
            }
            annDiv.addEventListener('click', () => {
                window.location.href = '/announcement?id=' + announcement.id;
            });
            container.appendChild(annDiv);
        });
    } catch (error) {
        console.error(error);
    }
}