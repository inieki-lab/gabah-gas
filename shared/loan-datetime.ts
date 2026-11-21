/**
 * Loan schedules are entered as browser datetime-local values and represent
 * the company's business timezone (Asia/Jakarta), not the server's timezone.
 * Jakarta is UTC+07:00 year-round. Explicitly zoned ISO timestamps remain
 * absolute instants; legacy date-only and naive datetime strings are treated
 * as Jakarta wall-clock time.
 */
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

export function parseLoanDateTimestamp(value: unknown): number {
  if (typeof value !== 'string') return Number.NaN;
  const text = value.trim();
  if (!text) return Number.NaN;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const dateTime = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.(\d{1,3}))?)?$/.exec(text);
  const match = dateTime || dateOnly;

  if (match) {
    const [, yearText, monthText, dayText, hourText = '00', minuteText = '00', secondText = '00', fractionText = '0'] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const second = Number(secondText);
    const millisecond = Number(fractionText.padEnd(3, '0'));
    const utcWallClock = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
    const check = new Date(utcWallClock);

    if (check.getUTCFullYear() !== year
      || check.getUTCMonth() !== month - 1
      || check.getUTCDate() !== day
      || check.getUTCHours() !== hour
      || check.getUTCMinutes() !== minute
      || check.getUTCSeconds() !== second) {
      return Number.NaN;
    }

    return utcWallClock - JAKARTA_OFFSET_MS;
  }

  if (/T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    const timestamp = Date.parse(text);
    return Number.isFinite(timestamp) ? timestamp : Number.NaN;
  }

  return Number.NaN;
}
