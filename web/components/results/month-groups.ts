export interface MonthGroup<T> {
  /** `2026-09`, stable across renders, for React keys. */
  key: string;
  /** `September 2026`. */
  label: string;
  rows: T[];
}

// A bare `2026-09-01` parses as UTC midnight, which is still August in the Americas, so a
// date-only value takes its month from the text. A timestamp takes the viewer's local month.
function monthKey(date: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date.slice(0, 7);
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  return new Date(`${key}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** Consecutive rows that share a month, in the order given: pass a list already sorted by date. */
export function groupByMonth<T>(rows: readonly T[], dateOf: (row: T) => string): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = [];
  for (const row of rows) {
    const key = monthKey(dateOf(row));
    const last = groups[groups.length - 1];
    if (last?.key === key) last.rows.push(row);
    else groups.push({ key, label: monthLabel(key), rows: [row] });
  }
  return groups;
}
