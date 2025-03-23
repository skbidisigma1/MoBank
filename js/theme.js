(async function () {

    function safeParse(str) {
        try {
            return JSON.parse(str);
        } catch (e) {
            return null;
        }
    }
    async function getStoredTheme() {
        const userDataStr = localStorage.getItem("userData");
        const userData = safeParse(userDataStr);
        if (userData && userData.data && typeof userData.data.theme === "string") {
            await updateIndexedDBTheme(userData.data.theme);
            return userData.data.theme;
        }
        try {
            return (await getThemeFromIndexedDB()) || "light";
        } catch (e) {
            return "light";
        }
    }
    function getThemeFromIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("mobank-db", 3);
            request.onupgradeneeded = function (e) {
                const db = e.target.result;
                if (!db.objectStoreNames.contains("themeStore")) {
                    db.createObjectStore("themeStore");
                }
                if (!db.objectStoreNames.contains("preferences")) {
                    db.createObjectStore("preferences", { keyPath: "key" });
                }
            };
            request.onsuccess = function (event) {
                const db = event.target.result;
                const tx = db.transaction("themeStore", "readonly");
                const store = tx.objectStore("themeStore");
                const getReq = store.get("theme");
                getReq.onsuccess = function () {
                    resolve(getReq.result || "light");
                };
                getReq.onerror = function () {
                    reject(getReq.error);
                };
            };
            request.onerror = function () {
                reject(request.error);
            };
        });
    }
    function updateIndexedDBTheme(theme) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("mobank-db", 3);
            request.onupgradeneeded = function (e) {
                const db = e.target.result;
                if (!db.objectStoreNames.contains("themeStore")) {
                    db.createObjectStore("themeStore");
                }
                if (!db.objectStoreNames.contains("preferences")) {
                    db.createObjectStore("preferences", { keyPath: "key" });
                }
            };
            request.onsuccess = function (event) {
                const db = event.target.result;
                const tx = db.transaction("themeStore", "readwrite");
                const store = tx.objectStore("themeStore");
                const putRequest = store.put(theme, "theme");
                putRequest.onsuccess = function () {
                    resolve();
                };
                putRequest.onerror = function () {
                    reject(new Error("Failed to update theme in IndexedDB"));
                };
            };
            request.onerror = function () {
                reject(request.error);
            };
        });
    }
    const theme = await getStoredTheme();
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.transition = "background-color 0.3s, color 0.3s";
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", addToggleListener);
    } else {
        addToggleListener();
    }
    function addToggleListener() {
        let toggleButton = document.getElementById("theme-toggle");
        if (toggleButton) {
            toggleButton.addEventListener("click", async function () {
                const current = document.documentElement.getAttribute("data-theme");
                const newTheme = current === "dark" ? "light" : "dark";
                document.documentElement.setAttribute("data-theme", newTheme);
                let userData = safeParse(localStorage.getItem("userData")) || { data: {} };
                userData.data.theme = newTheme;
                localStorage.setItem("userData", JSON.stringify(userData));
                await updateIndexedDBTheme(newTheme);
            });
        }
    }
})();
