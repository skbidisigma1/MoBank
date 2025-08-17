const { admin } = require('../firebase');

const MAX_NOTES_LEN = 200;
const MAX_BACKDATE_DAYS = 90;
const MAX_MINUTES = 720;

function validateNotes(notesRaw) {
  if (!notesRaw) return '';
  const str = notesRaw.toString();
  if (str.length > MAX_NOTES_LEN) throw new Error('NOTES_LEN');
  return str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function validateDate(dateStr) {
  const todayStr = new Date().toISOString().slice(0,10);
  if (!dateStr) return todayStr;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw new Error('DATE_FMT');
  if (dateStr > todayStr) throw new Error('DATE_FUTURE');
  const earliestDateStr = new Date(Date.now() - MAX_BACKDATE_DAYS * 86400000).toISOString().slice(0,10);
  if (dateStr < earliestDateStr) throw new Error('DATE_PAST');
  return dateStr;
}

function ensureMinuteRange(minutes, max = MAX_MINUTES, manual = false) {
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > max) throw new Error('MINUTES_RANGE');
  return Math.round(minutes);
}

function buildSession({ minutes, dateStr, notes, manual, sid }) {
  const nowTs = admin.firestore.Timestamp.now();
  const session = { t: nowTs, d: dateStr, m: Math.max(1, Math.round(minutes)), man: !!manual };
  if (!manual && sid) session.sid = sid;
  if (notes) session.n = notes;
  return { session, nowTs };
}

module.exports = {
  MAX_NOTES_LEN,
  MAX_BACKDATE_DAYS,
  MAX_MINUTES,
  validateNotes,
  validateDate,
  ensureMinuteRange,
  buildSession
};
