let deferredPrompt;
document.addEventListener('DOMContentLoaded', async () => {
    const getStartedBtn = document.getElementById('get-started-btn');
    if(getStartedBtn){
        getStartedBtn.addEventListener('click', () => {
            window.location.href = 'login';
        });
    }
    if(window.matchMedia("(display-mode: standalone)").matches){
        return;
    }
    const dontAsk = await getDontAskAgain();
    if(!dontAsk){
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            document.getElementById('install-prompt').style.display = 'block';
        });
    }
    document.getElementById('install-yes-btn').addEventListener('click', async () => {
        if(deferredPrompt){
            deferredPrompt.prompt();
            const choiceResult = await deferredPrompt.userChoice;
            document.getElementById('install-prompt').style.display = 'none';
            deferredPrompt = null;
            if(choiceResult.outcome === 'accepted'){
                const userAgent = navigator.userAgent.toLowerCase();
                const isChromeOS = userAgent.includes("cros");
                const isWindows = userAgent.includes("windows");
                if(isChromeOS || isWindows){
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
    document.getElementById('close-announcements-modal').addEventListener('click', closeAnnouncementsModal);
    document.getElementById('announcements-modal').addEventListener('click', (e) => {
        if(e.target === document.getElementById('announcements-modal')){
            closeAnnouncementsModal();
        }
    });

    // Notification functionality
    const notifIcon = document.getElementById('notification-icon');
    const notifDropdown = document.getElementById('notification-dropdown');
    const notifCount = document.getElementById('notification-count');
    let notifications = [];

    function updateNotificationsUI(){
        if(notifications.length > 0){
            notifCount.textContent = notifications.length;
            notifCount.classList.remove('hidden');
            notifDropdown.innerHTML = '';
            notifications.forEach(n => {
                const p = document.createElement('p');
                p.textContent = n;
                p.classList.add('notification-item');
                notifDropdown.appendChild(p);
            });
        } else {
            notifCount.classList.add('hidden');
            notifDropdown.innerHTML = '<p class="notification-empty">No new notifications</p>';
        }
    }

    function handleNotificationToggle(e) {
        e.preventDefault();
        e.stopPropagation();
        notifDropdown.classList.toggle('hidden');
        notifIcon.classList.toggle('active');
    }

    function handleNotificationToggle(e) {
        e.preventDefault();
        e.stopPropagation();
        notifDropdown.classList.toggle('hidden');
        notifIcon.classList.toggle('active');
    }

    if (notifIcon) {
        notifIcon.addEventListener('touchstart', handleNotificationToggle, {passive: false});
        notifIcon.addEventListener('click', handleNotificationToggle);

        if (notifCount) {
            notifCount.addEventListener('touchstart', handleNotificationToggle, {passive: false});
            notifCount.addEventListener('click', handleNotificationToggle);
        }

        document.addEventListener('click', (e) => {
            if (e.target !== notifIcon && e.target !== notifCount && !notifDropdown.contains(e.target)) {
                notifDropdown.classList.add('hidden');
                notifIcon.classList.remove('active');
            }
        });

        document.addEventListener('touchstart', (e) => {
            if (e.target !== notifIcon && e.target !== notifCount && !notifDropdown.contains(e.target)) {
                notifDropdown.classList.add('hidden');
                notifIcon.classList.remove('active');
            }
        }, {passive: true});

        notifications.push("Welcome to MoBank notifications");
        updateNotificationsUI();
    }
});

function openPreferencesDB(){
    return new Promise((resolve,reject) => {
        const request = indexedDB.open("mobank-db",3);
        request.onupgradeneeded = event => {
            const db = event.target.result;
            if(!db.objectStoreNames.contains("preferences")){
                db.createObjectStore("preferences",{keyPath:"key"});
            }
            if(!db.objectStoreNames.contains("themeStore")){
                db.createObjectStore("themeStore");
            }
        };
        request.onsuccess = event => {
            const db = event.target.result;
            if(!db.objectStoreNames.contains("preferences")){
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

async function getDontAskAgain(){
    const db = await openPreferencesDB();
    return new Promise((resolve,reject) => {
        const transaction = db.transaction("preferences","readonly");
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

async function saveDontAskAgain(val){
    const db = await openPreferencesDB();
    return new Promise((resolve,reject) => {
        const transaction = db.transaction("preferences","readwrite");
        const store = transaction.objectStore("preferences");
        const req = store.put({key:"dontAskInstall",value:val});
        req.onsuccess = () => {
            resolve(true);
        };
        req.onerror = () => {
            reject(req.error);
        };
    });
}

async function loadAnnouncements(){
    try{
        const response = await fetch('/data/announcements.json');
        if(!response.ok) throw new Error('Failed to fetch announcements');
        const announcements = await response.json();
        announcements.sort((a,b)=>new Date(b.date)-new Date(a.date));
        if(announcements.length>0){
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
            mainContainer.addEventListener('click', ()=>{
                openAnnouncementsModal(announcements);
            });
            document.getElementById('view-all-announcements').addEventListener('click', ()=>{
                openAnnouncementsModal(announcements);
            });
        }
    } catch(error){
        console.error(error);
    }
}

function openAnnouncementsModal(announcements){
    const modal = document.getElementById('announcements-modal');
    const list = document.getElementById('announcements-list');
    list.innerHTML = '';
    announcements.forEach(ann=>{
        const card = document.createElement('div');
        card.className = 'announcement-card';
        if(ann.id===1){
            card.classList.add('highlighted-announcement');
        }
        const title = document.createElement('h4');
        title.innerHTML = ann.title;
        const body = document.createElement('div');
        body.innerHTML = ann.body;
        const date = document.createElement('div');
        date.className = 'announcement-date';
        date.textContent = ann.date;
        card.appendChild(title);
        card.appendChild(body);
        card.appendChild(date);
        card.addEventListener('click',(e)=>{
            e.stopPropagation();
            openAnnouncementsModal([ann]);
        });
        list.appendChild(card);
    });
    modal.classList.remove('hidden');
}

function closeAnnouncementsModal(){
    document.getElementById('announcements-modal').classList.add('hidden');
}