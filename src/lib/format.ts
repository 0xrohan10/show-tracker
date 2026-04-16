/**
 * Format a tvmaze airtime (HH:MM, US Eastern) to the user's local time.
 * Returns a consistent 12h format like "8:00 PM" or "10:30 PM".
 * Pass the airdate for correct DST handling.
 */
export function formatAirtime(airtime: string | null | undefined, airdate: string | null | undefined): string {
  if (!airtime) return '';
  const [h, m] = airtime.split(':').map(Number);
  // Build a date in US Eastern using the airdate for correct EDT/EST
  const dateStr = airdate || '2026-01-01';
  const eastern = new Date(new Date(`${dateStr}T${airtime}:00`).toLocaleString('en-US', { timeZone: 'America/New_York' }));
  // Re-parse as Eastern, then format in local timezone
  const utc = new Date(`${dateStr}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00-${isEDT(dateStr) ? '04:00' : '05:00'}`);
  return utc.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Rough EDT check: second Sunday of March to first Sunday of November */
function isEDT(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00');
  const year = d.getFullYear();
  const marchSecondSun = nthDayOfMonth(year, 2, 0, 2); // March, Sunday, 2nd
  const novFirstSun = nthDayOfMonth(year, 10, 0, 1); // November, Sunday, 1st
  return d >= marchSecondSun && d < novFirstSun;
}

function nthDayOfMonth(year: number, month: number, dayOfWeek: number, n: number): Date {
  const d = new Date(year, month, 1);
  let count = 0;
  while (count < n) {
    if (d.getDay() === dayOfWeek) count++;
    if (count < n) d.setDate(d.getDate() + 1);
  }
  return d;
}
