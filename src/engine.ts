/**
 * The matching engine, and the small rules that go with it.
 *
 * Everything here is computed rather than stored, so a configuration change
 * genuinely reaches the next run — and genuinely does NOT reach a result
 * already produced (Workflow PRD §5, §15.5).
 */

import { now } from './clock';
import type {
  ExtractedField,
  HardBlock,
  Invoice,
  InvoiceStatus,
  LineFinding,
  MatchResult,
  MetadataFinding,
  WorkflowConfig,
} from './types';

/* ── Formatting ───────────────────────────────────────────────────────── */

export function money(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function num(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value);
}

/** An ISO timestamp for something happening now. Formatted where it is shown. */
export function stamp(): string {
  return now();
}

/* ── Confidence ───────────────────────────────────────────────────────── */

/**
 * A field is worth a person's eye when it was read from a document and scored
 * below the threshold. A field from Zoho carries no confidence at all and is
 * never in this set — it is ground truth, not a read.
 */
export function isBelowThreshold(f: ExtractedField, threshold: number): boolean {
  return f.confidence !== null && f.confidence < threshold;
}

export function flaggedFields(invoice: Invoice, threshold: number): ExtractedField[] {
  return [...invoice.invoiceFields, ...invoice.poFields, ...invoice.grnFields].filter(
    (f) => isBelowThreshold(f, threshold),
  );
}

/**
 * Extraction is clear once every mandatory field has a value.
 *
 * A low-confidence read is flagged, not blocking: the score is shown on the
 * field and the user corrects it if it is wrong. Requiring a confirmation on
 * every flag made people click through them, which taught nothing and slowed
 * the good case down. The status still says a person should look — a flag and a
 * gate are different things.
 */
export function extractionIsClear(invoice: Invoice, config: WorkflowConfig): boolean {
  void config;
  return [...invoice.invoiceFields, ...invoice.poFields, ...invoice.grnFields]
    .filter((f) => f.mandatory)
    .every((f) => f.value.trim() !== '' && f.value.trim() !== '—');
}

/* ── Vendor normalization ─────────────────────────────────────────────── */

const LEGAL_SUFFIXES = [
  'inc', 'inc.', 'incorporated', 'llc', 'l.l.c.', 'ltd', 'ltd.', 'limited',
  'co', 'co.', 'company', 'corp', 'corp.', 'corporation', 'plc', 'gmbh',
  'pte', 'pvt', 'private', 'sa', 'nv', 'bv',
];

/**
 * The shipped normalization library (§7.2): legal-entity suffixes,
 * punctuation, casing and whitespace. No client abbreviation list required.
 */
export function normalizeVendor(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/[.,&'"()-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !LEGAL_SUFFIXES.includes(w));
  return words.join(' ');
}

/** Cheap similarity, 0–100. Enough to stand in for a real fuzzy matcher. */
export function vendorSimilarity(a: string, b: string): number {
  const x = normalizeVendor(a);
  const y = normalizeVendor(b);
  if (x === y) return 100;
  const longer = x.length >= y.length ? x : y;
  const shorter = x.length >= y.length ? y : x;
  if (longer.length === 0) return 100;

  // Levenshtein, single-row.
  let previous = Array.from({ length: shorter.length + 1 }, (_, i) => i);
  for (let i = 1; i <= longer.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= shorter.length; j += 1) {
      const cost = longer[i - 1] === shorter[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  const distance = previous[shorter.length];
  return Math.round((1 - distance / longer.length) * 100);
}

/* ── Tolerance ────────────────────────────────────────────────────────── */

/** Within tolerance if it clears EITHER the absolute or the percentage bound. */
function withinTolerance(diff: number, reference: number, abs: number, pct: number): boolean {
  const magnitude = Math.abs(diff);
  if (magnitude === 0) return true;
  if (magnitude <= abs) return true;
  if (reference !== 0 && (magnitude / Math.abs(reference)) * 100 <= pct) return true;
  return false;
}

/* ── Duplicate detection ──────────────────────────────────────────────── */

/**
 * Keys are invoice number, vendor and legal entity, and scope is tenant-wide
 * (§7.3). An invoice is the duplicate when an earlier one shares its key —
 * so the original is not flagged against its own copy.
 */
function duplicateKey(invoice: Invoice): string {
  return [
    invoice.number.trim().toLowerCase(),
    normalizeVendor(invoice.vendor),
    invoice.legalEntity.trim().toLowerCase(),
  ].join('|');
}

function findDuplicateOriginal(invoice: Invoice, all: Invoice[]): Invoice | null {
  const key = duplicateKey(invoice);
  const index = all.findIndex((i) => i.id === invoice.id);
  for (let position = 0; position < all.length; position += 1) {
    const other = all[position];
    if (other.id === invoice.id) continue;
    // Rejected records do not block a resubmission.
    if (other.status === 'Rejected') continue;
    // Only an earlier arrival can be the original.
    if (position > index) continue;
    if (duplicateKey(other) === key) return other;
  }
  return null;
}

/* ── The three checks ─────────────────────────────────────────────────── */

function fieldValue(fields: ExtractedField[], key: string): string {
  return fields.find((f) => f.key === key)?.value ?? '';
}

function fieldConfidence(fields: ExtractedField[], key: string): number | null {
  return fields.find((f) => f.key === key)?.confidence ?? null;
}

function parseMoney(text: string): number {
  const cleaned = text.replace(/[^0-9.-]/g, '');
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : 0;
}

function runMetadata(
  invoice: Invoice,
  config: WorkflowConfig,
): { state: 'pass' | 'fail'; findings: MetadataFinding[] } {
  const findings: MetadataFinding[] = [];

  const invoiceVendor = fieldValue(invoice.invoiceFields, 'vendor');
  const poVendor = fieldValue(invoice.poFields, 'poVendor');
  if (invoiceVendor && poVendor) {
    const similarity = vendorSimilarity(invoiceVendor, poVendor);
    if (similarity < config.vendorFuzzyThreshold) {
      findings.push({
        field: 'Vendor name',
        invoiceValue: invoiceVendor,
        poValue: poVendor,
        kind: 'vendor',
        invoiceConfidence: fieldConfidence(invoice.invoiceFields, 'vendor'),
        poConfidence: fieldConfidence(invoice.poFields, 'poVendor'),
      });
    }
  }

  // Currency must match; there is no FX in v0 (§7.2, §15.4).
  const invoiceCurrency = fieldValue(invoice.invoiceFields, 'currency');
  const poCurrency = fieldValue(invoice.poFields, 'poCurrency');
  if (invoiceCurrency && poCurrency && invoiceCurrency !== poCurrency) {
    findings.push({
      field: 'Currency',
      invoiceValue: invoiceCurrency,
      poValue: poCurrency,
      kind: 'currency',
      invoiceConfidence: fieldConfidence(invoice.invoiceFields, 'currency'),
      poConfidence: fieldConfidence(invoice.poFields, 'poCurrency'),
    });
  }

  // Total against the PO total, within tolerance.
  const invoiceTotal = parseMoney(fieldValue(invoice.invoiceFields, 'total'));
  const poTotal = parseMoney(fieldValue(invoice.poFields, 'poTotal'));
  if (poTotal > 0) {
    const diff = invoiceTotal - poTotal;
    const overBalance = diff > 0;
    if (!withinTolerance(diff, poTotal, config.totalToleranceAbsolute, config.totalTolerancePercent)) {
      findings.push({
        field: overBalance ? 'PO balance' : 'Total',
        invoiceValue: money(invoiceTotal, invoice.currency),
        poValue: overBalance
          ? `${money(poTotal, invoice.currency)} on the PO`
          : money(poTotal, invoice.currency),
        kind: overBalance ? 'balance' : 'total',
        invoiceConfidence: fieldConfidence(invoice.invoiceFields, 'total'),
        poConfidence: fieldConfidence(invoice.poFields, 'poTotal'),
      });
    }
  }

  return { state: findings.length === 0 ? 'pass' : 'fail', findings };
}

function runLineItem(
  invoice: Invoice,
  config: WorkflowConfig,
  threeWay: boolean,
): { state: 'pass' | 'fail'; findings: LineFinding[] } {
  const findings: LineFinding[] = [];

  for (const l of invoice.lines) {
    if (config.matchQuantity) {
      const diffPo = l.invoiceQty - l.poQty;
      const diffGrn = threeWay && l.grnQty !== null ? l.invoiceQty - l.grnQty : null;
      const poFails = !withinTolerance(diffPo, l.poQty, 0, config.lineTolerancePercent);
      const grnFails = diffGrn !== null && !withinTolerance(diffGrn, l.grnQty ?? 0, 0, config.lineTolerancePercent);
      if (poFails || grnFails) {
        findings.push({
          lineId: l.id,
          description: l.description,
          field: 'quantity',
          invoiceValue: l.invoiceQty,
          poValue: l.poQty,
          grnValue: threeWay ? l.grnQty : null,
          diffVsPo: diffPo,
          diffVsGrn: diffGrn,
        });
      }
    }

    if (config.matchUnitPrice) {
      const diffPo = l.invoiceUnitPrice - l.poUnitPrice;
      if (!withinTolerance(diffPo, l.poUnitPrice, config.lineToleranceAbsolute, config.lineTolerancePercent)) {
        findings.push({
          lineId: l.id,
          description: l.description,
          field: 'unitPrice',
          invoiceValue: l.invoiceUnitPrice,
          poValue: l.poUnitPrice,
          grnValue: null,
          diffVsPo: diffPo,
          diffVsGrn: null,
        });
      }
    }

    if (config.matchLineTotal) {
      const diffPo = l.invoiceLineTotal - l.poLineTotal;
      const grnValue = threeWay && l.grnQty !== null ? Number((l.grnQty * l.poUnitPrice).toFixed(2)) : null;
      const diffGrn = grnValue !== null ? Number((l.invoiceLineTotal - grnValue).toFixed(2)) : null;
      const poFails = !withinTolerance(diffPo, l.poLineTotal, config.lineToleranceAbsolute, config.lineTolerancePercent);
      const grnFails =
        diffGrn !== null &&
        !withinTolerance(diffGrn, grnValue ?? 0, config.lineToleranceAbsolute, config.lineTolerancePercent);
      if (poFails || grnFails) {
        findings.push({
          lineId: l.id,
          description: l.description,
          field: 'lineTotal',
          invoiceValue: l.invoiceLineTotal,
          poValue: l.poLineTotal,
          grnValue,
          diffVsPo: diffPo,
          diffVsGrn: diffGrn,
        });
      }
    }
  }

  return { state: findings.length === 0 ? 'pass' : 'fail', findings };
}

/**
 * Duplicate first — on a hit the other two are skipped. Then metadata and line
 * item, which the UI presents as running in parallel (§7).
 */
export function runMatching(invoice: Invoice, config: WorkflowConfig, all: Invoice[]): MatchResult {
  const threeWay = config.matchType === '3-way';
  const ranAt = stamp();

  const original = findDuplicateOriginal(invoice, all);
  if (original) {
    return {
      matchTypeUsed: config.matchType,
      ranAt,
      duplicate: {
        state: 'fail',
        original: {
          number: original.number,
          vendor: original.vendor,
          date: original.invoiceDate,
          processedBy: original.audit.at(-1)?.actor ?? 'System',
          metadataOnly: false,
        },
      },
      metadata: { state: 'skipped', findings: [] },
      lineItem: { state: 'skipped', findings: [] },
      hardBlock: 'duplicate',
    };
  }

  // Hard blocks: nothing to compare against.
  let hardBlock: HardBlock | null = null;
  if (invoice.poSource === 'none' || !invoice.poNumber) hardBlock = 'no-po';
  else if (threeWay && invoice.grnSource === 'none') hardBlock = 'no-grn';

  if (hardBlock) {
    return {
      matchTypeUsed: config.matchType,
      ranAt,
      duplicate: { state: 'pass' },
      metadata: { state: 'pending', findings: [] },
      lineItem: { state: 'pending', findings: [] },
      hardBlock,
    };
  }

  return {
    matchTypeUsed: config.matchType,
    ranAt,
    duplicate: { state: 'pass' },
    metadata: runMetadata(invoice, config),
    lineItem: runLineItem(invoice, config, threeWay),
    hardBlock: null,
  };
}

/* ── Reading a result ─────────────────────────────────────────────────── */

/** A finding is settled once an override has been recorded against its rule. */
export function isOverridden(invoice: Invoice, rule: string): boolean {
  return invoice.overrides.some((o) => o.rule === rule);
}

export function ruleNameForMetadata(f: MetadataFinding): string {
  return `Metadata — ${f.field}`;
}

export function ruleNameForLine(f: LineFinding): string {
  const label = f.field === 'unitPrice' ? 'unit price' : f.field === 'lineTotal' ? 'line total' : 'quantity';
  return `Line item — ${label}`;
}

/** Outstanding findings: failed, and not yet overridden. */
export function outstandingFindings(invoice: Invoice): { metadata: MetadataFinding[]; line: LineFinding[] } {
  const result = invoice.matchResult;
  if (!result) return { metadata: [], line: [] };
  return {
    metadata: result.metadata.findings.filter((f) => !isOverridden(invoice, ruleNameForMetadata(f))),
    line: result.lineItem.findings.filter((f) => !isOverridden(invoice, ruleNameForLine(f))),
  };
}

/** Matching has cleared when there is no hard block and nothing outstanding. */
export function matchingIsClear(invoice: Invoice): boolean {
  const result = invoice.matchResult;
  if (!result) return false;
  if (result.hardBlock) return false;
  if (result.metadata.state === 'pending' || result.lineItem.state === 'pending') return false;
  const outstanding = outstandingFindings(invoice);
  return outstanding.metadata.length === 0 && outstanding.line.length === 0;
}

export function isTerminal(invoice: Invoice): boolean {
  return invoice.status === 'Posted' || invoice.status === 'Exported' || invoice.status === 'Rejected';
}

/**
 * The status an invoice should be showing, given its own data and the current
 * configuration. Terminal states are left alone.
 */
export function deriveStatus(invoice: Invoice, config: WorkflowConfig): InvoiceStatus {
  if (isTerminal(invoice)) return invoice.status;

  if (invoice.stage === 'extraction') {
    /**
     * The status is a label, not the gate. Proceed stays enabled on a
     * low-confidence read — the user asked for a flag rather than a block — but
     * a flagged read is exactly what "a person should look at this" means, so
     * the queue says so. Correcting a field takes it to full confidence, which
     * is what clears this on its own.
     */
    const flagged = [...invoice.invoiceFields, ...invoice.poFields, ...invoice.grnFields].some(
      (f) => f.confidence !== null && f.confidence < config.confidenceThreshold,
    );
    return extractionIsClear(invoice, config) && !flagged ? 'Extraction' : 'Action Required';
  }
  if (invoice.stage === 'matching') {
    if (!invoice.matchResult) return 'Matching';
    return matchingIsClear(invoice) ? 'Matching' : 'Action Required';
  }
  return 'ERP posting';
}

/* ── Hard block copy ──────────────────────────────────────────────────── */

export const HARD_BLOCK_COPY: Record<HardBlock, { title: string; next: string }> = {
  duplicate: {
    title: 'Duplicate: this invoice has already been seen',
    next: 'The other two checks were skipped. Reject it to close this invoice.',
  },
  'no-po': {
    title: 'No purchase order, so matching has nothing to run against',
    next: 'Type a PO number, upload the purchase order, or reject the invoice.',
  },
  'no-grn': {
    title: 'No goods receipt, and the match type is 3-way',
    next: 'Upload the goods receipt, or change the match type to 2-way in workflow configuration.',
  },
};

/* ── CSV export ───────────────────────────────────────────────────────── */

/**
 * The CSV is the output of the matching, not a bill-import file (§10):
 * header, every line, the PO and GRN values beside them, and match status and
 * variance per line.
 */
export function buildCsv(invoices: Invoice[], config: WorkflowConfig): string {
  const rows: string[][] = [];
  rows.push([
    'Invoice number', 'Vendor', 'Legal entity', 'Invoice date', 'Currency', 'Invoice total',
    'PO number', 'PO total', 'PO source', 'GRN source', 'Match type', 'Invoice status',
    'Line', 'Description',
    'Invoice qty', 'PO qty', 'GRN qty',
    'Invoice unit price', 'PO unit price',
    'Invoice line total', 'PO line total',
    'Variance vs PO', 'Variance vs GRN',
    'Line match status', 'VAT code', 'WHT code', 'GL code',
  ]);

  for (const invoice of invoices) {
    const outstanding = outstandingFindings(invoice);
    const poTotal = invoice.poFields.find((f) => f.key === 'poTotal')?.value ?? '';
    invoice.lines.forEach((l, index) => {
      const lineFailed = outstanding.line.some((f) => f.lineId === l.id);
      const grnTotal = l.grnQty !== null ? Number((l.grnQty * l.poUnitPrice).toFixed(2)) : null;
      rows.push([
        invoice.number, invoice.vendor, invoice.legalEntity, invoice.invoiceDate,
        invoice.currency, invoice.amount.toFixed(2),
        invoice.poNumber ?? '', poTotal, invoice.poSource, invoice.grnSource,
        invoice.matchResult?.matchTypeUsed ?? config.matchType, invoice.status,
        String(index + 1), l.description,
        String(l.invoiceQty), String(l.poQty), l.grnQty === null ? '' : String(l.grnQty),
        l.invoiceUnitPrice.toFixed(2), l.poUnitPrice.toFixed(2),
        l.invoiceLineTotal.toFixed(2), l.poLineTotal.toFixed(2),
        (l.invoiceLineTotal - l.poLineTotal).toFixed(2),
        grnTotal === null ? '' : (l.invoiceLineTotal - grnTotal).toFixed(2),
        lineFailed ? 'Variance' : 'Matched',
        l.vat, l.wht, l.gl,
      ]);
    });
  }

  return rows
    .map((row) => row.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(','))
    .join('\n');
}

export function downloadCsv(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
