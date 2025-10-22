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
    if (!data.description || typeof data.description !== 'string' || data.description.trim().length === 0) {
      errors.push('Description is required');
    } else if (data.description.trim().length > 500) {
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
    // Category removed from schema - ignore if present
  }

  if (!isUpdate || data.maxPerUser !== undefined) {
    if (data.maxPerUser !== null && (typeof data.maxPerUser !== 'number' || data.maxPerUser < 1 || !Number.isInteger(data.maxPerUser))) {
      errors.push('maxPerUser must be null or a positive integer');
    } else if (data.maxPerUser !== null && data.maxPerUser > 100) {
      errors.push('maxPerUser cannot exceed 100');
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
  const catalogRef = db.collection('store_catalog');

  try {
    // CREATE
    if (req.method === 'POST') {
      const errors = validateItem(bodyData, false);
      if (errors.length > 0) {
        return res.status(400).json({ message: 'Validation failed', errors });
      }

      const newItem = {
        name: sanitize(bodyData.name),
        description: sanitize(bodyData.description),
        price: bodyData.price,
        stock: bodyData.stock,
        maxPerUser: bodyData.maxPerUser,
        validPeriods: bodyData.validPeriods || [],
        enabled: bodyData.enabled !== undefined ? bodyData.enabled : true,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };

      const docRef = await catalogRef.add(newItem);
      return res.status(201).json({ 
        message: 'Item created successfully',
        id: docRef.id,
        item: { id: docRef.id, ...newItem }
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

      const itemRef = catalogRef.doc(id);
      const itemDoc = await itemRef.get();
      
      if (!itemDoc.exists) {
        return res.status(404).json({ message: 'Item not found' });
      }

      const sanitizedUpdates = {};
      if (updates.name !== undefined) sanitizedUpdates.name = sanitize(updates.name);
      if (updates.description !== undefined) sanitizedUpdates.description = sanitize(updates.description);
      if (updates.price !== undefined) sanitizedUpdates.price = updates.price;
      if (updates.stock !== undefined) sanitizedUpdates.stock = updates.stock;
      if (updates.maxPerUser !== undefined) sanitizedUpdates.maxPerUser = updates.maxPerUser;
      if (updates.validPeriods !== undefined) sanitizedUpdates.validPeriods = updates.validPeriods;
      if (updates.enabled !== undefined) sanitizedUpdates.enabled = updates.enabled;
      sanitizedUpdates.updatedAt = admin.firestore.Timestamp.now();

      await itemRef.update(sanitizedUpdates);
      
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

      const itemRef = catalogRef.doc(id);
      const itemDoc = await itemRef.get();
      
      if (!itemDoc.exists) {
        return res.status(404).json({ message: 'Item not found' });
      }

      await itemRef.delete();
      
      return res.status(200).json({ message: 'Item deleted successfully' });
    }

  } catch (error) {
    console.error('manageCatalogItem error:', error);
    return res.status(500).json({ message: 'Failed to manage catalog item' });
  }
};
