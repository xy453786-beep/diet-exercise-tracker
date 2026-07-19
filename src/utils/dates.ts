/**
 * Day label ↔ ISO date utilities.
 *
 * The app UI uses Chinese weekday labels (周一-周六, 今日).
 * The backend API and database use ISO dates (YYYY-MM-DD).
 */

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六'] as const;

/**
 * Get the Monday of the current week (UTC midnight).
 */
function getMonday(d: Date): Date {
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const offset = day === 0 ? -6 : 1 - day; // If Sunday, go back 6 days; else go back to Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() + offset);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Format a Date as YYYY-MM-DD.
 */
function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convert a Chinese day label to its ISO date for the CURRENT week.
 *
 * Examples:
 *   dayLabelToDate('今日') → '2026-07-19'
 *   dayLabelToDate('周一') → '2026-07-13'  (Monday of current week)
 *   dayLabelToDate('周三') → '2026-07-15'
 */
export function dayLabelToDate(label: string): string {
  const today = new Date();

  if (label === '今日') return toISODate(today);
  if (label === '昨天') {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return toISODate(yesterday);
  }

  const idx = WEEKDAYS.indexOf(label as any);
  if (idx === -1) {
    // If it's already an ISO date or other format, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(label)) return label;
    throw new Error(`Unknown day label: ${label}`);
  }

  const monday = getMonday(today);
  monday.setDate(monday.getDate() + idx);
  return toISODate(monday);
}

/**
 * Convert an ISO date string back to a Chinese day label.
 *
 * Examples:
 *   dateToDayLabel('2026-07-19') → '今日'  (if today is July 19)
 *   dateToDayLabel('2026-07-13') → '周一'  (Monday of current week)
 *   dateToDayLabel('2026-06-15') → '6/15'  (outside current week)
 */
export function dateToDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const today = new Date();

  // Check if it's today
  if (toISODate(d) === toISODate(today)) return '今日';

  // Check if it's yesterday
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (toISODate(d) === toISODate(yesterday)) return '昨天';

  // Check if it's within current Mon-Sat
  const monday = getMonday(today);
  const diffDays = Math.round((d.getTime() - monday.getTime()) / 86400000);
  if (diffDays >= 0 && diffDays < 6) return WEEKDAYS[diffDays];

  // Fallback: M/D format
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * Get the date range for the current week (Monday to Today).
 */
export function getCurrentWeekRange(): { from: string; to: string } {
  const today = new Date();
  const monday = getMonday(today);
  return {
    from: toISODate(monday),
    to: toISODate(today),
  };
}

/**
 * Get date range for the week containing a specific day label.
 */
export function getWeekRangeForDay(dayLabel: string): { from: string; to: string } {
  const targetDate = new Date(`${dayLabelToDate(dayLabel)}T00:00:00`);
  const monday = getMonday(targetDate);
  return {
    from: toISODate(monday),
    to: toISODate(targetDate),
  };
}
