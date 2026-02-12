const CACHE = {
  USER_KEY: 'userData',
  TOKEN_KEY: '__mobank_token',
  USER_MAX_AGE: 20 * 1000,   // 20 seconds
  TOKEN_MAX_AGE: 5 * 60 * 1000,        // 5 minutes
  
  // Internal DB Promise
  _dbPromise: null,
  
  _initDB() {
    if (this._dbPromise) return this._dbPromise;
    this._dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('MoBankStoreDB', 1);
      request.onerror = event => {
        console.error('IndexedDB error:', event.target.error);
        resolve(null); // Resolve null to gracefully fail to memory/network
      };
      request.onsuccess = event => resolve(event.target.result);
      request.onupgradeneeded = event => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('images')) {
          db.createObjectStore('images', { keyPath: 'id' });
        }
      };
    });
    return this._dbPromise;
  },

  read(key) {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    
    try {
      const parsed = JSON.parse(raw);
      
      // Check if data has timestamp (for expiration checking)
      if (parsed && typeof parsed === 'object' && parsed.timestamp && parsed.data) {
        const age = Date.now() - parsed.timestamp;
        const maxAge = key === this.USER_KEY ? this.USER_MAX_AGE : this.TOKEN_MAX_AGE;
        
        if (age > maxAge) {
          localStorage.removeItem(key);
          return null;
        }
        
        return parsed.data;
      }
      
      // Return data as-is if no timestamp structure
      return parsed;
    } catch (e) {
      console.error(`CACHE.read: Failed to parse data for '${key}':`, e);
      localStorage.removeItem(key);
      return null;
    }
  },
  write(key, value, maxAge) {
    
    // Wrap with timestamp for expiration checking
    const cacheEntry = {
      data: value,
      timestamp: Date.now()
    };
    
    localStorage.setItem(key, JSON.stringify(cacheEntry));
  },
  remove(key) {
    localStorage.removeItem(key);
  },
  
  images: {
    // 10 minutes validity for Stale-While-Revalidate
    VALIDITY_WINDOW: 10 * 60 * 1000, 
    
    async get(itemId, versionToken) {
        if (!itemId || !versionToken) return null;
        
        try {
            const db = await CACHE._initDB();
            if (!db) return null;
            
            return new Promise((resolve) => {
                const tx = db.transaction(['images'], 'readonly');
                const store = tx.objectStore('images');
                const request = store.get(itemId);
                
                request.onsuccess = () => {
                   const record = request.result;
                   const now = Date.now();
                   
                   // 1. Missing Record -> Fetch Fresh
                   if (!record) {
                       this._fetchAndCache(itemId, versionToken).then(resolve).catch(() => resolve(null));
                       return;
                   }
                   
                   // 2. Version Mismatch -> Return Stale immediately (if exists), Fetch Fresh background
                   // 3. Expired -> Return Stale immediately, Fetch Fresh background
                   if (record.version !== versionToken || (now - record.fetchedAt > this.VALIDITY_WINDOW)) {
                       // Return stale immediately
                       resolve(record.base64);
                       // Background update
                       this._fetchAndCache(itemId, versionToken).catch(err => console.error('Background image update failed', err));
                       return;
                   }
                   
                   // 4. Fresh -> Return
                   resolve(record.base64);
                };
                
                request.onerror = () => resolve(null);
            });
        } catch (e) {
            console.error('IDB Error', e);
            return null;
        }
    },
    
    async _fetchAndCache(itemId, versionToken) {
        try {
            // Need token for API
            // Accessing token from CACHE.read might fail if this is strictly module scoped, 
            // but CACHE is defined in constant scope so it's fine.
            let token = null;
            const tokenData = CACHE.read(CACHE.TOKEN_KEY);
            if (tokenData && tokenData.token) token = tokenData.token;
            // Note: If no token, we can't fetch. We assume store.js handles auth before rendering.
            
            if (!token) return null;

            const res = await fetch(`/api/getItemImage?id=${itemId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (!res.ok) return null;
            
            const data = await res.json();
            if (!data.base64) return null;
            
            const db = await CACHE._initDB();
            if (db) {
                const tx = db.transaction(['images'], 'readwrite');
                const store = tx.objectStore('images');
                store.put({
                    id: itemId,
                    base64: data.base64,
                    version: versionToken, // Store the item version this corresponds to
                    fetchedAt: Date.now()
                });
            }
            
            return data.base64;
        } catch (e) {
            console.error('Image fetch failed', e);
            throw e;
        }
    }
  }
};
