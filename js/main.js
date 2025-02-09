document.addEventListener('DOMContentLoaded', () => {
  const getStartedBtn = document.getElementById('get-started-btn');
  if (getStartedBtn) {
    getStartedBtn.addEventListener('click', () => {
      window.location.href = '/pages/login.html';
    });
  }
  if (window.matchMedia("(display-mode: standalone)").matches) {
    return;
  }
  getDontAskAgain(flag => {
    if (!flag) {
      window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        window.deferredPrompt = e;
        document.getElementById('install-prompt').style.display = 'block';
      });
    }
  });
  document.getElementById('install-yes-btn').addEventListener('click', async () => {
    if (window.deferredPrompt) {
      window.deferredPrompt.prompt();
      await window.deferredPrompt.userChoice;
      document.getElementById('install-prompt').style.display = 'none';
      window.deferredPrompt = null;
    }
  });
  document.getElementById('install-no-btn').addEventListener('click', () => {
    document.getElementById('install-prompt').style.display = 'none';
  });
  document.getElementById('install-dont-btn').addEventListener('click', () => {
    document.getElementById('install-prompt').style.display = 'none';
    saveDontAskAgain(true);
  });
});

function getDontAskAgain(callback) {
  const req = indexedDB.open("mobank-db", 1);
  req.onupgradeneeded = e => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains("preferences")) {
      db.createObjectStore("preferences", { keyPath: "key" });
    }
  };
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction("preferences", "readonly");
    const store = tx.objectStore("preferences");
    const getReq = store.get("dontAskInstall");
    getReq.onsuccess = () => {
      callback(getReq.result ? getReq.result.value : false);
    };
  };
}

function saveDontAskAgain(val) {
  const req = indexedDB.open("mobank-db", 1);
  req.onupgradeneeded = e => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains("preferences")) {
      db.createObjectStore("preferences", { keyPath: "key" });
    }
  };
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction("preferences", "readwrite");
    const store = tx.objectStore("preferences");
    store.put({ key: "dontAskInstall", value: val });
  };
}
