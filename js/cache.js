const CACHE = {
  USER_KEY: 'userData',
  TOKEN_KEY: '__mobank_token',
  USER_MAX_AGE: 20 * 1000,   // 20 seconds
  TOKEN_MAX_AGE: 5 * 60 * 1000,        // 5 minutes
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
  }
};