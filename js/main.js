let deferredPrompt;

document.addEventListener('DOMContentLoaded', async () => {
  const getStartedBtn = document.getElementById('get-started-btn');
  if (getStartedBtn) {
    getStartedBtn.addEventListener('click', () => {
      window.location.href = '/pages/login.html';
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
});

function openPreferencesDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("mobank-db", 1);
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("preferences")) {
        db.createObjectStore("preferences", { keyPath: "key" });
      }
    };
    request.onsuccess = event => {
      resolve(event.target.result);
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
