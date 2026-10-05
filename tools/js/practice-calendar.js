(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PracticeCalendar = api;
})(typeof window === 'undefined' ? globalThis : window, function() {
  const dayNumber = date => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  function parseDate(key) {
    if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
    const [year, month, day] = key.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return dateKey(date) === key ? date : null;
  }

  function build(days, { now = new Date(), months = 6, width = 800 } = {}) {
    const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const baseDay = dayNumber(start) - start.getDay();
    const today = dayNumber(now);
    const weeks = Math.ceil((dayNumber(end) - baseDay + 1) / 7);
    const padding = 16, gutter = 2, labelHeight = 24;
    const cell = Math.max(8, Math.min(18, Math.floor((width - padding * 2 + gutter) / weeks) - gutter));
    const minutes = new Map();
    for (const entry of days || []) {
      if (!parseDate(entry.date) || !Number.isFinite(entry.minutes) || entry.minutes < 0) continue;
      minutes.set(entry.date, (minutes.get(entry.date) || 0) + entry.minutes);
    }
    const cells = [], labels = [];
    for (let date = start; date <= end; date = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)) {
      const key = dateKey(date), offset = dayNumber(date) - baseDay;
      const column = Math.floor(offset / 7), row = date.getDay();
      const x = padding + column * (cell + gutter), y = padding + labelHeight + row * (cell + gutter);
      const future = dayNumber(date) > today;
      cells.push({ date: key, minutes: future ? 0 : minutes.get(key) || 0, column, row, x, y, future });
      if (date.getDate() === 1) labels.push({ text: date.toLocaleString('en-US', { month: 'short' }), x });
    }
    return { cells, labels, cell, gutter, padding, weeks,
      width: padding * 2 + weeks * (cell + gutter) - gutter,
      height: padding * 2 + labelHeight + 7 * (cell + gutter) - gutter };
  }
  return { build, dateKey, parseDate };
});
