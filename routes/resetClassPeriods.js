const crypto = require('crypto');
const { admin, db } = require('../firebase');
const { getTokenFromHeader, verifyToken } = require('../auth-helper');

const PAGE_SIZE = 400;
const YEAR_PATTERN = /^\d{4}-\d{4}$/;
const migrationCollection = db.collection('school_year_migrations');
const migrationLockRef = db.collection('maintenance').doc('classPeriodReset');

function validateYearPair(sourceYear, targetYear) {
  if (typeof sourceYear !== 'string' || typeof targetYear !== 'string' ||
      !YEAR_PATTERN.test(sourceYear) || !YEAR_PATTERN.test(targetYear)) {
    return false;
  }

  const [sourceStart, sourceEnd] = sourceYear.split('-').map(Number);
  const [targetStart, targetEnd] = targetYear.split('-').map(Number);
  return sourceEnd === sourceStart + 1 &&
    targetStart === sourceEnd &&
    targetEnd === targetStart + 1;
}

async function getAssignedUserCount() {
  const users = db.collection('users');
  const pageSize = 400;
  let cursor = null;
  let count = 0;

  while (true) {
    let query = users
      .orderBy(admin.firestore.FieldPath.documentId())
      .select('class_period')
      .limit(pageSize);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    count += page.docs.filter(doc => {
      const period = doc.data().class_period;
      return period !== null && typeof period !== 'undefined';
    }).length;
    if (page.size < pageSize) return count;
    cursor = page.docs[page.docs.length - 1].id;
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
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

  const roles = decoded['https://mo-classroom.us/roles'] || [];
  if (!roles.includes('admin')) {
    return res.status(403).json({ message: 'Admins only' });
  }

  const { sourceYear, targetYear, dryRun, confirm, initializeBaseline } = req.body || {};
  if (!validateYearPair(sourceYear, targetYear)) {
    return res.status(400).json({ message: 'Use consecutive school years, for example 2025-2026 and 2026-2027.' });
  }
  if (dryRun !== true && confirm !== true) {
    return res.status(400).json({ message: 'Preview the migration first, then confirm it to reset class periods.' });
  }

  const migrationRef = migrationCollection.doc(`class_period_reset_${targetYear}`);

  try {
    if (dryRun) {
      const [migrationDoc, lockDoc, usersToReset] = await Promise.all([
        migrationRef.get(),
        migrationLockRef.get(),
        getAssignedUserCount()
      ]);

      const migration = migrationDoc.exists ? migrationDoc.data() : null;
      if (migration && migration.sourceYear !== sourceYear) {
        return res.status(409).json({ message: 'A migration for this target year already exists with a different source year.' });
      }
      if (migration?.status === 'complete') {
        return res.status(200).json({
          status: 'complete', sourceYear, targetYear,
          usersToReset: 0, resetUsers: migration.resetUsers || 0,
          processedUsers: migration.processedUsers || 0
        });
      }

      const lock = lockDoc.exists ? lockDoc.data() : null;
      if (lock?.currentSchoolYear && lock.currentSchoolYear !== sourceYear) {
        return res.status(409).json({
          message: `The recorded current school year is ${lock.currentSchoolYear}. Use that as the source year for the next reset.`
        });
      }
      if (lock?.status === 'running' && lock.targetYear !== targetYear) {
        return res.status(409).json({
          message: `A school-year reset for ${lock.targetYear} is already in progress. Resume or complete that reset first.`
        });
      }

      return res.status(200).json({
        status: migration?.status || 'preview',
        sourceYear,
        targetYear,
        requiresBaseline: !lock?.currentSchoolYear,
        currentSchoolYear: lock?.currentSchoolYear || null,
        usersToReset,
        resetUsers: migration?.resetUsers || 0,
        processedUsers: migration?.processedUsers || 0
      });
    }

    const leaseId = crypto.randomUUID();
    const now = Date.now();
    let migrationState;
    try {
      migrationState = await db.runTransaction(async tx => {
        const [migrationDoc, lockDoc] = await Promise.all([
          tx.get(migrationRef),
          tx.get(migrationLockRef)
        ]);
        const migration = migrationDoc.exists ? migrationDoc.data() : null;
        const lock = lockDoc.exists ? lockDoc.data() : null;

        if (migration?.sourceYear && migration.sourceYear !== sourceYear) {
          throw new Error('MIGRATION_SOURCE_MISMATCH');
        }
        if (migration?.status === 'complete') {
          throw new Error('MIGRATION_ALREADY_COMPLETE');
        }
        if (lock?.currentSchoolYear && lock.currentSchoolYear !== sourceYear) {
          throw new Error('MIGRATION_SOURCE_YEAR_MISMATCH');
        }
        if (!lock?.currentSchoolYear && initializeBaseline !== true) {
          throw new Error('MIGRATION_BASELINE_REQUIRED');
        }
        if (lock?.status === 'running') {
          if (lock.targetYear !== targetYear) throw new Error('OTHER_MIGRATION_RUNNING');
          if (Number(lock.leaseExpiresAt || 0) > now) throw new Error('MIGRATION_BUSY');
        }

        const state = {
          sourceYear,
          targetYear,
          status: 'running',
          runId: migration?.runId || crypto.randomUUID(),
          lastUid: migration?.lastUid || null,
          processedUsers: migration?.processedUsers || 0,
          resetUsers: migration?.resetUsers || 0,
          startedAt: migration?.startedAt || admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        tx.set(migrationRef, state, { merge: true });
        tx.set(migrationLockRef, {
          sourceYear,
          targetYear,
          currentSchoolYear: lock?.currentSchoolYear || sourceYear,
          status: 'running',
          leaseId,
          leaseExpiresAt: now + 60_000,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        return state;
      });
    } catch (error) {
      const conflictMessages = {
        MIGRATION_SOURCE_MISMATCH: 'A migration for this target year already exists with a different source year.',
        MIGRATION_ALREADY_COMPLETE: 'This school-year reset has already completed and cannot be run again.',
        MIGRATION_SOURCE_YEAR_MISMATCH: 'The recorded current school year does not match the supplied source year. Use the recorded current school year as the source year.',
        MIGRATION_BASELINE_REQUIRED: 'The current school year has not been recorded. Preview the reset, verify the source year, and confirm the first rollover.',
        OTHER_MIGRATION_RUNNING: 'Another school-year reset is in progress. Complete it before starting this one.',
        MIGRATION_BUSY: 'Another administrator is currently processing this reset. Please retry shortly.'
      };
      if (conflictMessages[error.message]) {
        return res.status(409).json({ message: conflictMessages[error.message] });
      }
      throw error;
    }

    const updatedState = await db.runTransaction(async tx => {
      const [migrationDoc, lockDoc] = await Promise.all([
        tx.get(migrationRef),
        tx.get(migrationLockRef)
      ]);
      const currentMigration = migrationDoc.exists ? migrationDoc.data() : null;
      const lock = lockDoc.exists ? lockDoc.data() : null;

      if (!lock || lock.status !== 'running' || lock.leaseId !== leaseId) {
        throw new Error('MIGRATION_LEASE_LOST');
      }
      if (!currentMigration || currentMigration.status !== 'running' ||
          (currentMigration.lastUid || null) !== (migrationState.lastUid || null)) {
        throw new Error('MIGRATION_CURSOR_CHANGED');
      }

      let query = db.collection('users')
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(PAGE_SIZE + 1);
      if (migrationState.lastUid) query = query.startAfter(migrationState.lastUid);
      const page = await tx.get(query);
      const users = page.docs.slice(0, PAGE_SIZE);
      const hasMore = page.docs.length > PAGE_SIZE;
      let resetUsers = 0;

      for (const userDoc of users) {
        const userData = userDoc.data();
        if (userData.class_period !== null && typeof userData.class_period !== 'undefined') {
          tx.update(userDoc.ref, { class_period: null });
          resetUsers += 1;
        }
      }

      const complete = !hasMore;
      const lastUid = users.length ? users[users.length - 1].id : migrationState.lastUid;
      const fieldValue = admin.firestore.FieldValue;

      const nextState = {
        ...currentMigration,
        status: complete ? 'complete' : 'running',
        lastUid,
        processedUsers: (currentMigration.processedUsers || 0) + users.length,
        resetUsers: (currentMigration.resetUsers || 0) + resetUsers,
        updatedAt: fieldValue.serverTimestamp(),
        ...(complete ? { completedAt: fieldValue.serverTimestamp() } : {})
      };
      tx.set(migrationRef, nextState, { merge: true });
      tx.set(migrationLockRef, {
        status: complete ? 'complete' : 'running',
        ...(complete ? { currentSchoolYear: targetYear } : {}),
        leaseId: null,
        leaseExpiresAt: null,
        updatedAt: fieldValue.serverTimestamp(),
        ...(complete ? { completedAt: fieldValue.serverTimestamp() } : {})
      }, { merge: true });

      return { ...nextState, hasMore: !complete };
    });

    return res.status(200).json({
      status: updatedState.status,
      sourceYear,
      targetYear,
      processedUsers: updatedState.processedUsers || 0,
      resetUsers: updatedState.resetUsers || 0,
      hasMore: updatedState.hasMore
    });
  } catch (error) {
    if (error.message === 'MIGRATION_LEASE_LOST' || error.message === 'MIGRATION_CURSOR_CHANGED') {
      return res.status(409).json({
        message: 'Another administrator advanced this reset. Preview again to see the latest progress.'
      });
    }
    console.error('resetClassPeriods error:', error);
    return res.status(500).json({ message: 'Failed to process the school-year reset.' });
  }
};
