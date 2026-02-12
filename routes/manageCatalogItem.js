const { db } = require('../firebase');
const { getTokenFromHeader, verifyToken } = require('../auth-helper');

const sanitize = str => (str || '').toString().trim().slice(0, 500);

const validateItem = (data, isUpdate = false) => {
  const errors = [];

  if (!isUpdate || data.name !== undefined) {
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.push('Name is required');
    } else if (data.name.trim().length > 100) {
      errors.push('Name must be 100 characters or less');
    }
  }

  if (!isUpdate || data.description !== undefined) {
    if (data.description !== undefined && data.description !== null && typeof data.description !== 'string') {
      errors.push('Description must be a string');
    } else if (data.description && data.description.trim().length > 500) {
      errors.push('Description must be 500 characters or less');
    }
  }

  if (!isUpdate || data.price !== undefined) {
    if (typeof data.price !== 'number' || data.price < 0 || !Number.isInteger(data.price)) {
      errors.push('Price must be a non-negative integer');
    } else if (data.price > 100000000) {
      errors.push('Price cannot exceed 100,000,000');
    }
  }

  if (!isUpdate || data.stock !== undefined) {
    if (data.stock !== null && (typeof data.stock !== 'number' || data.stock < 0 || !Number.isInteger(data.stock))) {
      errors.push('Stock must be null or a non-negative integer');
    } else if (data.stock !== null && data.stock > 1000000) {
      errors.push('Stock cannot exceed 1,000,000');
    }
  }

  if (!isUpdate || data.category !== undefined) {
    // ignore if present
  }

  if (!isUpdate || data.maxPerUser !== undefined) {
    if (data.maxPerUser !== null && (typeof data.maxPerUser !== 'number' || data.maxPerUser < 1 || !Number.isInteger(data.maxPerUser))) {
      errors.push('maxPerUser must be null or a positive integer');
    } else if (data.maxPerUser !== null && data.maxPerUser > 10000) {
      errors.push('maxPerUser cannot exceed 10,000');
    }
  }

  if (!isUpdate || data.validPeriods !== undefined) {
    if (!Array.isArray(data.validPeriods)) {
      errors.push('validPeriods must be an array');
    } else {
      const validPeriodNumbers = [4, 5, 6, 7, 8, 10];
      for (const period of data.validPeriods) {
        if (!validPeriodNumbers.includes(period)) {
          errors.push('validPeriods must contain only valid period numbers: 4, 5, 6, 7, 8, 10');
          break;
        }
      }
      if (data.validPeriods.length > 6) {
        errors.push('validPeriods array too large');
      }
    }
  }

  if (!isUpdate || data.enabled !== undefined) {
    if (typeof data.enabled !== 'boolean') {
      errors.push('enabled must be a boolean');
    }
  }

  return errors;
};

module.exports = async (req, res) => {
  if (!['POST', 'PUT', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const token = getTokenFromHeader(req);
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch {
    return res.status(401).json({ message: 'Token verification failed' });
  }

  // Check admin role
  const roles = decoded['https://mo-classroom.us/roles'] || [];
  if (!roles.includes('admin')) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  let bodyData = {};
  if (req.body && Object.keys(req.body).length) {
    bodyData = req.body;
  } else {
    let raw = '';
    await new Promise((resolve, reject) => {
      req.on('data', chunk => (raw += chunk));
      req.on('end', resolve);
      req.on('error', reject);
    });
    try {
      bodyData = JSON.parse(raw || '{}');
    } catch {
      return res.status(400).json({ message: 'Invalid JSON format' });
    }
  }

  const admin = require('firebase-admin');
  const catalogRef = db.collection('store_catalog').doc('items');

  // Helper to handle image persistence
  const handleImage = async (itemId, imageBase64) => {
    if (!imageBase64 || typeof imageBase64 !== 'string') return null;
    
    // Strict server-side limit (1MB max for Firestore doc)
    // Client should have compressed to ~750KB
    if (imageBase64.length > 1000000) {
      throw new Error('Image too large (server limit 1MB)'); 
    }
    
    const version = Date.now();
    // Use set with merge: true to avoid overwriting other potential future fields
    await db.collection('store_images').doc(itemId).set({
      base64: imageBase64,
      id: itemId,
      updatedAt: version
    }, { merge: true });
    
    return version;
  };

  try {
    // CREATE
    if (req.method === 'POST') {
      const errors = validateItem(bodyData, false);
      if (errors.length > 0) {
        return res.status(400).json({ message: 'Validation failed', errors });
      }

      // Generate unique ID
      const itemId = db.collection('_').doc().id;
      
      const newItem = {
        id: itemId,
        name: sanitize(bodyData.name),
        description: sanitize(bodyData.description),
        price: bodyData.price,
        stock: bodyData.stock,
        maxPerUser: bodyData.maxPerUser,
        validPeriods: bodyData.validPeriods || [],
        enabled: bodyData.enabled !== undefined ? bodyData.enabled : true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // Handle Image
      if (bodyData.imageBase64) {
         try {
           const v = await handleImage(itemId, bodyData.imageBase64);
           newItem.hasImage = true;
           newItem.imageVersion = v;
         } catch (e) {
           return res.status(400).json({ message: e.message });
         }
      }

      // Get existing catalog or create new
      const catalogDoc = await catalogRef.get();
      const catalogData = catalogDoc.exists ? catalogDoc.data() : { items: [] };
      const items = catalogData.items || [];
      
      items.push(newItem);
      
      await catalogRef.set({
        items,
        version: Date.now(),
        lastUpdated: admin.firestore.Timestamp.now()
      });

      return res.status(201).json({ 
        message: 'Item created successfully',
        id: itemId,
        item: newItem
      });
    }

    // UPDATE
    if (req.method === 'PUT') {
      const { id, ...updates } = bodyData;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ message: 'Item ID required' });
      }

      const errors = validateItem(updates, true);
      if (errors.length > 0) {
        return res.status(400).json({ message: 'Validation failed', errors });
      }

      const catalogDoc = await catalogRef.get();
      if (!catalogDoc.exists) {
        return res.status(404).json({ message: 'Catalog not found' });
      }

      const catalogData = catalogDoc.data();
      const items = catalogData.items || [];
      const itemIndex = items.findIndex(item => item.id === id);
      
      if (itemIndex === -1) {
        return res.status(404).json({ message: 'Item not found' });
      }

      // Apply updates
      const item = items[itemIndex];
      if (updates.name !== undefined) item.name = sanitize(updates.name);
      if (updates.description !== undefined) item.description = sanitize(updates.description);
      if (updates.price !== undefined) item.price = updates.price;
      if (updates.stock !== undefined) item.stock = updates.stock;
      if (updates.maxPerUser !== undefined) item.maxPerUser = updates.maxPerUser;
      if (updates.validPeriods !== undefined) item.validPeriods = updates.validPeriods;
      if (updates.enabled !== undefined) item.enabled = updates.enabled;
      item.updatedAt = Date.now();

      // Handle Image Removal
      if (bodyData.removeImage) {
          item.hasImage = false;
          item.imageVersion = null;
          try {
             await db.collection('store_images').doc(id).delete();
          } catch(e) {}
      }

      // Handle Image Update
      if (bodyData.imageBase64) {
         try {
           const v = await handleImage(id, bodyData.imageBase64);
           item.hasImage = true;
           item.imageVersion = v;
         } catch (e) {
           return res.status(400).json({ message: e.message });
         }
      }

      items[itemIndex] = item;

      await catalogRef.set({
        items,
        version: Date.now(),
        lastUpdated: admin.firestore.Timestamp.now()
      });
      
      return res.status(200).json({ 
        message: 'Item updated successfully',
        id
      });
    }

    // DELETE
    if (req.method === 'DELETE') {
      const { id } = bodyData;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ message: 'Item ID required' });
      }

      const catalogDoc = await catalogRef.get();
      if (!catalogDoc.exists) {
        return res.status(404).json({ message: 'Catalog not found' });
      }

      const catalogData = catalogDoc.data();
      const items = catalogData.items || [];
      const itemIndex = items.findIndex(item => item.id === id);
      
      if (itemIndex === -1) {
        return res.status(404).json({ message: 'Item not found' });
      }

      items.splice(itemIndex, 1);

      await catalogRef.set({
        items,
        version: Date.now(),
        lastUpdated: admin.firestore.Timestamp.now()
      });
      
      // Attempt to delete associated image (fire and forget)
      try {
        await db.collection('store_images').doc(id).delete();
      } catch (e) {
        console.warn('Failed to delete associated image', e);
      }
      
      return res.status(200).json({ message: 'Item deleted successfully' });
    }

  } catch (error) {
    console.error('manageCatalogItem error:', error);
    return res.status(500).json({ message: 'Failed to manage catalog item' });
  }
};
