const { verifyToken, getTokenFromHeader } = require('../auth-helper')
const { admin, db } = require('../firebase')
const { MOBANK_MAX_BALANCE: MAX_BALANCE } = require('../js/balance-limits')
const VALID_PERIODS = new Set(require('../js/class-periods').map(({ value }) => value))
const MAX_TRANSACTION_HISTORY = 100
const MAX_NOTIFICATION_HISTORY = 10
const MAX_CONCURRENT_ADJUSTMENTS = 20
const CLASS_PERIOD_RESET_REF = db.collection('maintenance').doc('classPeriodReset')

function formatMoBucks(value) {
  const absoluteValue = Math.abs(value)
  return `${absoluteValue} ${absoluteValue === 1 ? 'MoBuck' : 'MoBucks'}`
}

function createTransaction(amount, timestamp) {
  return {
    type: amount >= 0 ? 'credit' : 'debit',
    amount: Math.abs(amount),
    counterpart: 'Admin',
    timestamp,
  }
}

function createNotification(amount, scope, timestamp) {
  return {
    message: amount >= 0
      ? `You received ${formatMoBucks(amount)} from Admin${scope ? ` (${scope})` : ''}`
      : `You were charged ${formatMoBucks(amount)} by Admin${scope ? ` (${scope})` : ''}`,
    type: 'admin_transfer',
    timestamp,
    read: false,
  }
}

function parsePeriod(rawPeriod) {
  if (typeof rawPeriod !== 'number' && typeof rawPeriod !== 'string') return null
  if (typeof rawPeriod === 'string' && !rawPeriod.trim()) return null

  const period = Number(rawPeriod)
  return Number.isInteger(period) && VALID_PERIODS.has(period) ? period : null
}

function parseAmount(rawAmount) {
  if (typeof rawAmount === 'string' && !rawAmount.trim()) return null
  if (typeof rawAmount !== 'number' && typeof rawAmount !== 'string') return null

  const amount = Number(rawAmount)
  if (!Number.isSafeInteger(amount) || amount === 0 || Math.abs(amount) > MAX_BALANCE) {
    return null
  }
  return amount
}

async function applyAdjustment(userRef, amount, scope, target) {
  return db.runTransaction(async transaction => {
    const [resetDoc, userDoc] = await Promise.all([
      transaction.get(CLASS_PERIOD_RESET_REF),
      transaction.get(userRef),
    ])
    if (resetDoc.exists && resetDoc.get('status') === 'running') {
      const error = new Error('School-year reset is in progress')
      error.code = 'CLASS_PERIOD_RESET_RUNNING'
      throw error
    }
    if (!userDoc.exists) throw new Error('User no longer exists')

    const userData = userDoc.data()
    if ((target.period !== undefined && userData.class_period !== target.period) ||
        (target.name !== undefined && userData.name !== target.name) ||
        (target.instrument !== undefined && userData.instrument !== target.instrument)) {
      const error = new Error('User no longer matches the adjustment target')
      error.code = 'ADJUSTMENT_TARGET_CHANGED'
      throw error
    }

    const rawBalance = userData.currency_balance ?? 0
    const currentBalance = Number(rawBalance)
    if (!Number.isFinite(currentBalance) || Math.abs(currentBalance) > Number.MAX_SAFE_INTEGER) {
      throw new Error('User has an invalid balance')
    }

    const timestamp = admin.firestore.Timestamp.now()
    const outsideBalanceLimit = Math.abs(currentBalance) > MAX_BALANCE
    if (outsideBalanceLimit && Math.sign(currentBalance) === Math.sign(amount)) {
      throw new Error('Adjustment would increase an already out-of-range balance')
    }
    const proposedBalance = currentBalance + amount
    const updatedBalance = outsideBalanceLimit
      ? proposedBalance
      : Math.max(-MAX_BALANCE, Math.min(MAX_BALANCE, proposedBalance))
    const appliedAmount = updatedBalance - currentBalance
    if (appliedAmount === 0) return false

    const transactions = Array.isArray(userData.transactions) ? userData.transactions : []
    const notifications = Array.isArray(userData.notifications) ? userData.notifications : []

    transaction.update(userRef, {
      currency_balance: updatedBalance,
      transactions: [createTransaction(appliedAmount, timestamp), ...transactions]
        .slice(0, MAX_TRANSACTION_HISTORY),
      notifications: [createNotification(appliedAmount, scope, timestamp), ...notifications]
        .slice(0, MAX_NOTIFICATION_HISTORY),
    })

    return true
  })
}

async function applyToUsers(userDocs, amount, scope, target) {
  let nextIndex = 0
  let updatedCount = 0
  let unchangedCount = 0
  let failedCount = 0
  let blockedCount = 0
  let targetChangedCount = 0

  const workerCount = Math.min(MAX_CONCURRENT_ADJUSTMENTS, userDocs.length)
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < userDocs.length) {
      const index = nextIndex++
      try {
        const updated = await applyAdjustment(userDocs[index].ref, amount, scope, target)
        if (updated) updatedCount += 1
        else unchangedCount += 1
      } catch (error) {
        if (error.code === 'CLASS_PERIOD_RESET_RUNNING') {
          blockedCount += 1
        } else if (error.code === 'ADJUSTMENT_TARGET_CHANGED') {
          targetChangedCount += 1
        } else {
          failedCount += 1
          console.error(`adminAdjustBalance failed for user ${userDocs[index].id}:`, error)
        }
      }
    }
  }))

  return { updatedCount, unchangedCount, failedCount, blockedCount, targetChangedCount }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const token = getTokenFromHeader(req)
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  let decoded
  try {
    decoded = await verifyToken(token)
  } catch (error) {
    return res.status(401).json({ message: 'Token verification failed' })
  }

  const roles = decoded?.['https://mo-classroom.us/roles'] || []
  if (!roles.includes('admin')) {
    return res.status(403).json({ message: 'Forbidden: Admins only' })
  }

  let bodyData = req.body
  if (typeof bodyData === 'string') {
    try {
      bodyData = JSON.parse(bodyData || '{}')
    } catch (error) {
      return res.status(400).json({ message: 'Invalid JSON' })
    }
  } else if (!bodyData || typeof bodyData !== 'object' || Array.isArray(bodyData)) {
    let raw = ''
    try {
      await new Promise((resolve, reject) => {
        req.on('data', chunk => (raw += chunk))
        req.on('end', resolve)
        req.on('error', reject)
      })
    } catch (error) {
      return res.status(400).json({ message: 'Invalid request body' })
    }

    try {
      bodyData = JSON.parse(raw || '{}')
    } catch (error) {
      return res.status(400).json({ message: 'Invalid JSON' })
    }
  }

  const { name, period: rawPeriod, amount: rawAmount, instrument } = bodyData
  const hasName = name !== null && name !== undefined
  const hasInstrument = instrument !== null && instrument !== undefined
  if ((hasName && (typeof name !== 'string' || !name.trim())) ||
      (hasInstrument && (typeof instrument !== 'string' || !instrument.trim())) ||
      (hasName && hasInstrument)) {
    return res.status(400).json({ message: 'Invalid adjustment target' })
  }

  const amount = parseAmount(rawAmount)
  if (amount === null) {
    return res.status(400).json({
      message: `Amount must be a non-zero whole number between -${MAX_BALANCE} and ${MAX_BALANCE}`,
    })
  }

  const isAllPeriods = rawPeriod === null
  const period = parsePeriod(rawPeriod)
  if (isAllPeriods ? (hasName || hasInstrument) : period === null) {
    return res.status(400).json({ message: 'Invalid period' })
  }

  try {
    const resetLock = await CLASS_PERIOD_RESET_REF.get()
    if (resetLock.exists && resetLock.get('status') === 'running') {
      return res.status(409).json({
        message: 'Balance adjustments are paused while the school-year reset is running.',
      })
    }

    let query = db.collection('users')
    let scope = ''
    const target = {}

    if (hasName) {
      const studentName = name.trim()
      target.period = period
      target.name = studentName
      query = query
        .where('class_period', '==', period)
        .where('name', '==', studentName)
      scope = ''
    } else if (hasInstrument) {
      const section = instrument.trim()
      target.period = period
      target.instrument = section
      query = query
        .where('class_period', '==', period)
        .where('instrument', '==', section)
      scope = `${section} section`
    } else if (period !== null) {
      target.period = period
      query = query.where('class_period', '==', period)
      scope = 'class-wide'
    } else {
      scope = 'all classes'
    }

    const snapshot = await query.get()
    if (snapshot.empty) {
      if (hasName) return res.status(404).json({ message: 'User not found' })
      if (hasInstrument) {
        return res.status(404).json({ message: `No ${instrument} players found in period ${period}` })
      }
      return res.status(404).json({ message: 'No users found for this target' })
    }

    if (hasName && snapshot.size > 1) {
      return res.status(409).json({ message: 'Multiple users have that name in this period' })
    }

    const { updatedCount, unchangedCount, failedCount, blockedCount, targetChangedCount } = await applyToUsers(
      snapshot.docs,
      amount,
      scope,
      target
    )
    if (blockedCount > 0 && updatedCount === 0 && failedCount === 0) {
      return res.status(409).json({
        message: 'Balance adjustments were stopped because the school-year reset started.',
      })
    }
    if (targetChangedCount > 0 && updatedCount === 0 && failedCount === 0 && blockedCount === 0) {
      return res.status(409).json({
        message: 'The adjustment target changed while this request was running. Refresh the roster and try again.',
      })
    }
    if (failedCount > 0 || blockedCount > 0 || targetChangedCount > 0) {
      return res.status(500).json({
        message: `Adjustment partially applied: updated ${updatedCount} of ${snapshot.size} users; ${unchangedCount} were at their balance limits, ${failedCount} failed, ${blockedCount} were blocked by the school-year reset, and ${targetChangedCount} no longer matched the target.`,
        updatedCount,
        unchangedCount,
        failedCount,
        blockedCount,
        targetChangedCount,
      })
    }

    const successMessage = hasName ? 'Balance adjusted successfully' : 'Balances updated successfully'
    return res.status(200).json({
      message: unchangedCount > 0
        ? `${successMessage}; ${updatedCount} updated and ${unchangedCount} unchanged at the balance limit.`
        : successMessage,
      updatedCount,
      unchangedCount,
    })
  } catch (error) {
    console.error('adminAdjustBalance error:', error)
    return res.status(500).json({ message: 'Internal Server Error' })
  }
}
