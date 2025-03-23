(async function () {
    const THEME = {
        LIGHT: 'light',
        DARK: 'dark'
    };

    const DB = {
        NAME: 'mobank-db',
        VERSION: 3,
        STORES: {
            THEME: 'themeStore',
            PREFERENCES: 'preferences'
        }
    };

    let themeCache = null;
    let dbInstance = null;

    function safeParse(str) {
        try {
            return JSON.parse(str);
        } catch (e) {
            return null;
        }
    }

    async function getStoredTheme() {
        if (themeCache) return themeCache;

        const userDataStr = localStorage.getItem('userData');
        const userData = safeParse(userDataStr);
        
        if (userData?.data?.theme) {
            const theme = userData.data.theme;
            if (isValidTheme(theme)) {
                await updateIndexedDBTheme(theme);
                themeCache = theme;
                return theme;
            }
        }

        try {
            const theme = await getThemeFromIndexedDB();
            themeCache = theme;
            return theme;
        } catch (e) {
            console.warn('Failed to get theme from IndexedDB:', e);
            return getDefaultTheme();
        }
    }

    function isValidTheme(theme) {
        return theme === THEME.LIGHT || theme === THEME.DARK;
    }

    function getDefaultTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return THEME.DARK;
        }
        return THEME.LIGHT;
    }

    function initDB() {
        return new Promise((resolve, reject) => {
            if (dbInstance) {
                resolve(dbInstance);
                return;
            }

            const request = indexedDB.open(DB.NAME, DB.VERSION);
            
            request.onupgradeneeded = function (e) {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(DB.STORES.THEME)) {
                    db.createObjectStore(DB.STORES.THEME);
                }
                if (!db.objectStoreNames.contains(DB.STORES.PREFERENCES)) {
                    db.createObjectStore(DB.STORES.PREFERENCES, { keyPath: 'key' });
                }
            };

            request.onsuccess = function (event) {
                dbInstance = event.target.result;
                resolve(dbInstance);
            };

            request.onerror = function () {
                console.error('Failed to open IndexedDB:', request.error);
                reject(request.error);
            };
        });
    }

    function getThemeFromIndexedDB() {
        return new Promise(async (resolve, reject) => {
            try {
                const db = await initDB();
                const tx = db.transaction(DB.STORES.THEME, 'readonly');
                const store = tx.objectStore(DB.STORES.THEME);
                const getReq = store.get('theme');
                
                getReq.onsuccess = function () {
                    const theme = getReq.result;
                    resolve(isValidTheme(theme) ? theme : getDefaultTheme());
                };
                
                getReq.onerror = function () {
                    console.warn('Failed to get theme from IndexedDB:', getReq.error);
                    resolve(getDefaultTheme());
                };
            } catch (e) {
                console.warn('IndexedDB error:', e);
                resolve(getDefaultTheme());
            }
        });
    }

    async function updateIndexedDBTheme(theme) {
        if (!isValidTheme(theme)) {
            console.warn('Invalid theme value:', theme);
            return;
        }

        try {
            const db = await initDB();
            const tx = db.transaction(DB.STORES.THEME, 'readwrite');
            const store = tx.objectStore(DB.STORES.THEME);
            await new Promise((resolve, reject) => {
                const putRequest = store.put(theme, 'theme');
                putRequest.onsuccess = resolve;
                putRequest.onerror = () => reject(putRequest.error);
            });
            themeCache = theme;
        } catch (e) {
            console.error('Failed to update theme in IndexedDB:', e);
            throw e;
        }
    }

    async function updateTheme(newTheme) {
        if (!isValidTheme(newTheme)) return;

        try {
            document.documentElement.setAttribute('data-theme', newTheme);
            
            const userData = safeParse(localStorage.getItem('userData')) || { data: {} };
            userData.data.theme = newTheme;
            localStorage.setItem('userData', JSON.stringify(userData));
            
            await updateIndexedDBTheme(newTheme);
            
            window.dispatchEvent(new CustomEvent('themechange', { 
                detail: { theme: newTheme }
            }));
        } catch (e) {
            console.error('Failed to update theme:', e);
        }
    }

    function addToggleListener() {
        const toggleButton = document.getElementById('theme-toggle');
        if (!toggleButton) return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        toggleButton.addEventListener('click', async function() {
            const current = document.documentElement.getAttribute('data-theme');
            const newTheme = current === THEME.DARK ? THEME.LIGHT : THEME.DARK;
            await updateTheme(newTheme);
        });

        mediaQuery.addListener(async (e) => {
            const userData = safeParse(localStorage.getItem('userData'));
            if (!userData?.data?.theme) {
                const newTheme = e.matches ? THEME.DARK : THEME.LIGHT;
                await updateTheme(newTheme);
            }
        });

        toggleButton.addEventListener('keydown', async function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const current = document.documentElement.getAttribute('data-theme');
                const newTheme = current === THEME.DARK ? THEME.LIGHT : THEME.DARK;
                await updateTheme(newTheme);
            }
        });
    }

    try {
        const theme = await getStoredTheme();
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.style.transition = 'background-color 0.3s, color 0.3s';
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', addToggleListener);
        } else {
            addToggleListener();
        }
    } catch (e) {
        console.error('Failed to initialize theme:', e);
        document.documentElement.setAttribute('data-theme', THEME.LIGHT);
    }
})();
