/**
 * Local calendar date utilities.
 * Uses local year/month/day components rather than UTC ISO slicing so
 * entries always belong to the user's actual local calendar date.
 */

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_KEY_PATTERN.test(value)) {
    return false;
  }
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return (
    dt.getFullYear() === y &&
    dt.getMonth() === m - 1 &&
    dt.getDate() === d
  );
}

export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/**
 * Shifts a valid `YYYY-MM-DD` local calendar key by `deltaDays` using noon local time
 * so daylight-saving transitions never skip or duplicate a calendar day.
 */
export function shiftLocalDateKey(dateKey: string, deltaDays: number): string {
  const anchor = parseLocalDateKey(dateKey);
  const shifted = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    anchor.getDate() + deltaDays,
    12,
    0,
    0,
    0
  );
  return getLocalDateKey(shifted);
}

/**
 * Returns `days` chronological local calendar keys ending on `anchorDateKey` (inclusive).
 */
export function getPastLocalDateKeys(
  days: number,
  anchorDateKey: string = getLocalDateKey()
): string[] {
  const count = Math.max(1, Math.floor(days));
  const anchor = parseLocalDateKey(anchorDateKey);
  const keys: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const dt = new Date(
      anchor.getFullYear(),
      anchor.getMonth(),
      anchor.getDate() - offset,
      12,
      0,
      0,
      0
    );
    keys.push(getLocalDateKey(dt));
  }
  return keys;
}

export function formatReadableDate(dateKey: string): string {
  if (!isValidDateKey(dateKey)) return dateKey;
  const dt = parseLocalDateKey(dateKey);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(dt);
}

export function formatShortDayLabel(dateKey: string): string {
  if (!isValidDateKey(dateKey)) return dateKey;
  const dt = parseLocalDateKey(dateKey);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
  }).format(dt);
}

export function formatDayNumber(dateKey: string): string {
  if (!isValidDateKey(dateKey)) return '';
  const dt = parseLocalDateKey(dateKey);
  return String(dt.getDate());
}

export function getTimeOfDayGreeting(hour: number = new Date().getHours()): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
