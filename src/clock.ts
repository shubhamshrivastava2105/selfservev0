/**
 * One clock for the whole app.
 *
 * Every date is stored as an ISO timestamp and formatted at the point it is
 * rendered, so nothing is a pre-baked display string and nothing goes stale.
 * Seed records are positioned relative to the moment the app loads, which is
 * why an invoice that arrived "two days ago" still reads that way next month.
 */

/** Captured once, so a long session does not drift mid-render. */
export const NOW = new Date();

/** An ISO timestamp, `days` before now, at the given local time. */
export function at(days: number, hour = 9, minute = 0): string {
  const date = new Date(NOW);
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

/** The current moment, for anything the user does now. */
export function now(): string {
  return new Date().toISOString();
}

// US conventions, because the customers are US finance teams: month first, and
// a 12-hour clock.
const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const TIME_FORMAT = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** "Aug 17, 2026" */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return DATE_FORMAT.format(date);
}

/** "Aug 17, 2026 at 9:19 AM" */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${formatDate(iso)} at ${TIME_FORMAT.format(date)}`;
}

/** "9:19 AM", for a timestamp whose day is already obvious from context. */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return TIME_FORMAT.format(date);
}

/** "just now", "2 hours ago", "yesterday", "9 days ago" */
export function formatRelative(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const minutes = Math.round((NOW.getTime() - date.getTime()) / 60_000);
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

/** Whole days between an ISO timestamp and now, floored at zero. */
export function ageInDays(iso: string): number {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((NOW.getTime() - date.getTime()) / 86_400_000));
}

/** Milliseconds between two ISO timestamps, or null if either is unusable. */
export function elapsed(fromIso: string | null, toIso: string | null): number | null {
  if (!fromIso || !toIso) return null;
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return to - from;
}

/** "26 min", "4h 12m", "2d 3h" */
export function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}
