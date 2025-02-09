document.addEventListener('DOMContentLoaded', () => {
  var getStartedBtn = document.getElementById('get-started-btn');
  if(getStartedBtn){
    getStartedBtn.addEventListener('click', function(){
      window.location.href = '/pages/login.html';
    });
  }
  if(window.matchMedia("(display-mode: standalone)").matches){
    return;
  }
  getDontAskAgain(function(flag){
    if(!flag){
      window.addEventListener('beforeinstallprompt', function(e){
        e.preventDefault();
        window.deferredPrompt = e;
        document.getElementById('install-prompt').style.display = 'block';
      });
    }
  });
  document.getElementById('install-yes-btn').addEventListener('click', async function(){
    if(window.deferredPrompt){
      window.deferredPrompt.prompt();
      var choice = await window.deferredPrompt.userChoice;
      document.getElementById('install-prompt').style.display = 'none';
      window.deferredPrompt = null;
    }
  });
  document.getElementById('install-no-btn').addEventListener('click', function(){
    document.getElementById('install-prompt').style.display = 'none';
  });
  document.getElementById('install-dont-btn').addEventListener('click', function(){
    document.getElementById('install-prompt').style.display = 'none';
    saveDontAskAgain(true);
  });
});

function getDontAskAgain(callback){
  var req = indexedDB.open("mobank-db", 1);
  req.onupgradeneeded = function(e){
    var db = e.target.result;
    if(!db.objectStoreNames.contains("preferences")){
      db.createObjectStore("preferences", {keyPath:"key"});
    }
  };
  req.onsuccess = function(e){
    var db = e.target.result;
    var tx = db.transaction("preferences", "readonly");
    var store = tx.objectStore("preferences");
    var getReq = store.get("dontAskInstall");
    getReq.onsuccess = function(){
      callback(getReq.result ? getReq.result.value : false);
    };
  };
}

function saveDontAskAgain(val){
  var req = indexedDB.open("mobank-db", 1);
  req.onupgradeneeded = function(e){
    var db = e.target.result;
    if(!db.objectStoreNames.contains("preferences")){
      db.createObjectStore("preferences", {keyPath:"key"});
    }
  };
  req.onsuccess = function(e){
    var db = e.target.result;
    var tx = db.transaction("preferences", "readwrite");
    var store = tx.objectStore("preferences");
    store.put({key:"dontAskInstall", value:val});
  };
}
