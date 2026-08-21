import type { DocumentKind } from './types';

/**
 * What a filename suggests a document is. The user can override every guess.
 *
 * Kept in its own module because both the store and the upload dialog need it,
 * and importing it from the dialog made the store depend on a component that
 * depends on the store. That cycle leaves the context uninitialised at render.
 */
export function classifyFilename(name: string): DocumentKind {
  // Underscores are word characters, so `\binvoice\b` would not match
  // "Invoice_88213". Normalise separators before testing.
  const n = name.toLowerCase().replace(/[_.]+/g, '-');
  if (/\b(po|purchase[-_ ]?order)\b|^po[-_]/.test(n)) return 'po';
  if (/\b(grn|goods[-_ ]?receipt|receipt[-_ ]?note|delivery)\b/.test(n)) return 'grn';
  if (/faktur|tax|vat|gst|wht/.test(n)) return 'tax';
  if (/\b(inv|invoice|bill)\b|^inv[-_]/.test(n)) return 'invoice';
  return 'supporting';
}
