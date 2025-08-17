const { getTokenFromHeader, verifyToken } = require('../auth-helper');
const { db } = require('../firebase');

// Practice Trends / Analytics Endpoint
// Provides daily minutes heatmap data + streak + summaries + recommendation text.
// NOTE: Purely read-only; reuses existing practiceChunks structure.
// Response example:
// {
//   message: 'Success',
//   days: [{ date:'YYYY-MM-DD', minutes:Number }],
//   streak: { current:Number, longest:Number },
//   summary: { last7Minutes, last14Minutes, avgSessionLength, sessionsCount, goal },
//   recommendation: 'string'
// }

const DEFAULT_DAYS = 56; // default 8 weeks; can request up to ~400 via ?days=365

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
  const token = getTokenFromHeader(req); if (!token) return res.status(401).json({ message: 'Unauthorized' });
  let decoded; try { decoded = await verifyToken(token); } catch { return res.status(401).json({ message: 'Token verification failed' }); }
  const uid = decoded.sub;

  const userRef = db.collection('users').doc(uid);
  try {
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(404).json({ message: 'User not found' });
    const goal = userSnap.get('practice_goal') || 0;

    const chunksSnap = await userRef.collection('practiceChunks').orderBy('index').get();
    const sessions = [];
    chunksSnap.forEach(doc => {
      const data = doc.data();
      const arr = Array.isArray(data.sessions) ? data.sessions : [];
      for (const s of arr) {
        if (s && s.d && s.m) sessions.push(s);
      }
    });

    // Aggregate minutes per date
    const dayMap = new Map();
    let sessionsCount = 0; let minutesAccumulator = 0;
    for (const s of sessions) {
      const dateStr = s.d;
      const m = Number(s.m) || 0;
      dayMap.set(dateStr, (dayMap.get(dateStr) || 0) + m);
      sessionsCount++; minutesAccumulator += m;
    }

    // Determine requested range
    let rangeDays = DEFAULT_DAYS;
    try {
      const url = new URL(req.url, 'http://local');
      const d = parseInt(url.searchParams.get('days'), 10);
      if (d && d > 0 && d <= 400) rangeDays = d; // guard upper bound
    } catch {}

    // Build continuous day array (most recent rangeDays days, inclusive today)
    const today = new Date();
    const days = [];
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const ds = d.toISOString().slice(0,10);
      days.push({ date: ds, minutes: dayMap.get(ds) || 0 });
    }

    // Longest streak calculation across all days with >0 minutes
    const sortedDays = Array.from(dayMap.keys()).sort();
    let longestStreak = 0; let prev = null; let run = 0;
    for (const ds of sortedDays) {
      if (prev) {
        const prevDate = new Date(prev + 'T00:00:00Z');
        const curDate = new Date(ds + 'T00:00:00Z');
        const delta = (curDate - prevDate) / 86400000;
        if (delta === 1) run += 1; else run = 1;
      } else run = 1;
      if (run > longestStreak) longestStreak = run;
      prev = ds;
    }

    // Current streak (allow today empty but count continuous up to yesterday)
    const dateToISO = d => d.toISOString().slice(0,10);
    let currentStreak = 0;
    const todayISO = dateToISO(today);
    const hasToday = dayMap.has(todayISO) && dayMap.get(todayISO) > 0;
    let cursor = hasToday ? new Date(today) : new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    while (true) {
      const ds = dateToISO(cursor);
      if (dayMap.has(ds) && dayMap.get(ds) > 0) { currentStreak++; cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1); }
      else break;
    }

  const last7Minutes = days.slice(-7).reduce((a,d)=>a+d.minutes,0);
  const last14Minutes = days.slice(-14).reduce((a,d)=>a+d.minutes,0);
    const avgSessionLength = sessionsCount ? Math.round(minutesAccumulator / sessionsCount) : 0;

    const summary = { last7Minutes, last14Minutes, avgSessionLength, sessionsCount, goal };
    const recommendation = buildRecommendation({ last7Minutes, goal, currentStreak, longestStreak, todayMinutes: days[days.length-1]?.minutes || 0, avgSessionLength });

    return res.status(200).json({
      message: 'Success',
      days,
      streak: { current: currentStreak, longest: longestStreak },
      summary,
      recommendation,
      rangeDays
    });
  } catch (e) {
    console.error('getPracticeTrends error', e);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

function buildRecommendation(ctx) {
  const { last7Minutes, goal, currentStreak, longestStreak, todayMinutes, avgSessionLength } = ctx;
  if (last7Minutes === 0) return "Let's get started: log a short 10‑minute focused session today.";
  if (currentStreak === 0 && last7Minutes < 30) return 'Pick up where you left off—aim for a light re‑entry session today.';
  if (currentStreak >= 14) return 'Two-week momentum! Consider adding a focused challenge piece or increasing intensity.';
  if (goal && last7Minutes >= goal) return 'Goal met this week—great work. Stretch goal? Add 10% or deepen quality over quantity.';
  if (goal && last7Minutes >= goal * 0.75) return 'Close to your weekly goal—one more solid session will push you over.';
  if (todayMinutes === 0 && currentStreak >= 3) return "Don't break the streak—schedule a short focused block today.";
  if (avgSessionLength < 15 && last7Minutes >= 60) return 'Lots of short bursts—experiment with one longer, deliberate session.';
  return 'Steady progress—keep consistency and consider refining one focus area this week.';
}
