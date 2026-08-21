/**
 * The little that outlives a reload.
 *
 * Almost nothing here does: the prototype resets so a demo starts clean. What a
 * person put in by hand is the exception, because losing an upload they made is
 * a bug wearing a reset's clothes.
 */
const PREFIX = 'neoflo.selfserve.';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    // Private browsing, a full quota, or a shape that changed under us. A
    // default is always better than a screen that will not render.
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Nothing to do and nothing worth interrupting for.
  }
}
