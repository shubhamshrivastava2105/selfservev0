/**
 * Every piece of sample data in the prototype lives here, so changing what is
 * on screen never means opening a component.
 *
 * Country: United States. Tax and GL codes, vendors, currency and document
 * formats are all the US set (Workflow PRD §3, §8).
 */

import { NOW, at, formatDate } from './clock';
import type {
  Connections,
  RefSource,
  DomainVerdict,
  ErpPayload,
  GrnLine,
  IndexedDocument,
  DiscoverableWorkspace,
  ExtractedField,
  Invoice,
  InvoiceSource,
  MatchLine,
  Member,
  MemoryPattern,
  WorkflowConfig,
} from './types';

/* ── The signed-in person and their tenant ────────────────────────────── */


export const SIGNED_IN = {
  firstName: 'Shubham',
  lastName: 'Shrivastava',
  email: 'shubham.s@neoflo.ai',
  initials: 'SS',
};

/**
 * Domains that already have a tenant in this prototype. Anyone else is the
 * first from their domain, which is a different flow: there is no organization
 * to show them yet, so no workspace list either.
 */
export const EXISTING_TENANT_DOMAINS = ['neoflo.ai'];

/**
 * Free providers. A personal address is refused at signup: a tenant is keyed on
 * a company domain, so gmail.com would put unrelated people in one organization.
 */
export const PERSONAL_PROVIDERS = [
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'icloud.com',
  'proton.me',
];

/** The workspace and role an invited user arrives with. */
export const PENDING_INVITE = {
  workspaceName: 'AP EMEA',
  invitedBy: 'Kaustav Dutta',
  invoiceProcessingRole: 'Reviewer' as const,
};

/** What will happen when this address signs up. Shown on the form itself. */
export function readDomain(email: string): {
  verdict: DomainVerdict;
  domain: string;
} {
  const domain = (email.split('@')[1] ?? '').toLowerCase();
  if (PERSONAL_PROVIDERS.includes(domain)) return { verdict: 'personal-provider', domain };
  if (EXISTING_TENANT_DOMAINS.includes(domain)) return { verdict: 'existing-tenant', domain };
  return { verdict: 'first-of-domain', domain };
}
export const LEGAL_ENTITY = 'Neoflo Inc.';

/**
 * The letterhead each vendor prints on its own invoices.
 *
 * The document view draws a real page, and a real page carries the sender's
 * address and bank. Those cannot be one company's details reused for everyone —
 * open a Puget Logistics invoice and it would show Sierra Networks' account
 * number.
 */
export const VENDOR_LETTERHEAD: Record<
  string,
  { street: string; city: string; contact: string; bank: string; account: string }
> = {
  'Sierra Networks': {
    street: '2400 Bridgeway, Suite 210',
    city: 'Sausalito, CA 94965 · United States',
    contact: 'ar@sierranetworks.example · +1 415 555 0114',
    bank: 'Golden Gate Bank',
    account: 'Routing 121000248 · Account ••••4417',
  },
  'Puget Logistics': {
    street: '815 Terminal Way',
    city: 'Tacoma, WA 98421 · United States',
    contact: 'billing@pugetlogistics.example · +1 253 555 0188',
    bank: 'Cascadia Commercial Bank',
    account: 'Routing 125000024 · Account ••••8213',
  },
  'Cascade Industrial Parts': {
    street: '4120 Foundry Road',
    city: 'Portland, OR 97210 · United States',
    contact: 'accounts@cascadeparts.example · +1 503 555 0142',
    bank: 'Columbia River Bank',
    account: 'Routing 123006800 · Account ••••4432',
  },
  'Redwood Office Supply': {
    street: '18 Cedar Street',
    city: 'Sacramento, CA 95814 · United States',
    contact: 'ar@redwoodoffice.example · +1 916 555 0177',
    bank: 'Valley First Bank',
    account: 'Routing 121042882 · Account ••••9051',
  },
  'Bayline Freight': {
    street: '77 Harbor Point Drive',
    city: 'Oakland, CA 94607 · United States',
    contact: 'invoices@baylinefreight.example · +1 510 555 0163',
    bank: 'Bay Mercantile',
    account: 'Routing 121000358 · Account ••••0448',
  },
  'Harbor Print Co': {
    street: '260 Wharf Lane',
    city: 'Seattle, WA 98101 · United States',
    contact: 'ar@harborprint.example · +1 206 555 0119',
    bank: 'Puget Sound Savings',
    account: 'Routing 125008547 · Account ••••3312',
  },
};

/** What to print for a vendor with no entry, so the page is never blank. */
export const letterheadFor = (vendor: string) =>
  VENDOR_LETTERHEAD[vendor] ?? {
    street: 'Address on file',
    city: 'United States',
    contact: 'Billing contact on file',
    bank: 'Bank on file',
    account: 'Account details on file',
  };

/**
 * A second set of books in the same workspace.
 *
 * Real AP runs across entities, and reporting has a per-entity cut because that
 * is a question people actually ask. One entity would make that cut a single
 * 100% bar, which teaches nothing about the metric.
 */
export const LEGAL_ENTITY_WEST = 'Neoflo West LLC';

/** Where the user last visited, for the returning-visit briefing (Journey §2). */
const NOW_HOUR = NOW.getHours();
const NOW_MINUTE = NOW.getMinutes();

/* ── Onboarding options ───────────────────────────────────────────────── */

export const JOB_FUNCTIONS = [
  'AP / Finance',
  'Finance Lead',
  'Procurement',
  'IT',
  'Other',
] as const;

/** Country is required and sets tax defaults for the whole tenant, not the person. */
export const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'DE', name: 'Germany' },
  { code: 'SG', name: 'Singapore' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'PH', name: 'Philippines' },
  { code: 'GB', name: 'United Kingdom' },
] as const;

/**
 * Same-domain workspaces the routing screen offers (Signup PRD §3).
 * Auto-approve on means an instant join; off means a workspace is provisioned
 * for the user now and the request goes to the owner.
 */
export const DISCOVERABLE_WORKSPACES: DiscoverableWorkspace[] = [
  { id: 'ws-finance', name: 'Finance', owner: 'Vibhor Sharma', members: 6, visibility: 'public' },
  { id: 'ws-ap-emea', name: 'AP EMEA', owner: 'Kaustav Dutta', members: 3, visibility: 'approval' },
  { id: 'ws-procurement', name: 'Procurement', owner: 'Hemshankar Rao', members: 4, visibility: 'public' },
  // Never listed on the routing screen. It exists here to prove that.
  { id: 'ws-payroll', name: 'Payroll', owner: 'Vibhor Sharma', members: 2, visibility: 'private' },
];

/** Copy for each visibility setting, used on the routing and members screens. */
export const VISIBILITY_COPY: Record<
  DiscoverableWorkspace['visibility'],
  { label: string; short: string; detail: string }
> = {
  public: {
    label: 'Public to your organization',
    short: 'Joins instantly',
    detail: 'Anyone with a company email address can find this workspace and join it themselves.',
  },
  approval: {
    label: 'Needs approval to join',
    short: 'Needs approval',
    detail:
      'People can find it and ask to join. You approve each request, and they get their own workspace to work in meanwhile.',
  },
  private: {
    label: 'Private',
    short: 'Invitation only',
    detail: 'Nobody can find this workspace. The only way in is an invitation from you.',
  },
};

/* ── Tax and GL code lists (US) ───────────────────────────────────────── */

export const VAT_CODES = [
  'US-EXEMPT',
  'US-CA-SALES-7.25',
  'US-NY-SALES-8.875',
  'US-WA-SALES-10.25',
  'US-USE-TAX',
];

export const WHT_CODES = ['US-NONE', 'US-1099-NEC', 'US-BACKUP-24'];

/** The one sales-tax code the seed set uses, so a line and its header agree. */
const SALES_TAX_CA = 'US-CA-SALES-7.25';

/* ── Defaults ─────────────────────────────────────────────────────────── */

/**
 * Every parameter ships with a working default (Workflow PRD §5). The real
 * numbers come from Sundip before build; these stand in for them.
 */
export const DEFAULT_CONFIG: WorkflowConfig = {
  matchType: '3-way',
  confidenceThreshold: 85,
  autoAdvance: true,
  straightThrough: true,
  totalToleranceAbsolute: 25,
  totalTolerancePercent: 2,
  lineToleranceAbsolute: 10,
  lineTolerancePercent: 2,
  matchQuantity: true,
  matchUnitPrice: true,
  matchLineTotal: true,
  vendorFuzzyThreshold: 90,
  memoryThreshold: 3,
  duplicateKeys: ['Invoice number', 'Vendor', 'Legal entity'],
  monthlyPostingTarget: 20,
  manualBaselineMinutes: 6,
};

/**
 * Zoho Books connected, Inventory not — which is the dependency Journey §8.2
 * calls out: receipts live in Inventory, so 3-way only works from uploaded
 * GRN documents until Inventory is connected too.
 */
export const DEFAULT_CONNECTIONS: Connections = {
  zohoBooks: true,
  zohoInventory: false,
  mailboxProvider: 'gmail',
  mailboxAddress: 'ap@neoflo.ai',
  mailboxFolder: 'Invoices/Inbound',
  ticketing: null,
};

/* ── Members ──────────────────────────────────────────────────────────── */

export const MEMBERS: Member[] = [
  {
    id: 'm-1',
    name: 'Shubham Shrivastava',
    email: 'shubham.s@neoflo.ai',
    invoiceProcessing: 'Workflow admin',
    status: 'Active',
    lastActive: at(0, NOW_HOUR, NOW_MINUTE),
    isWorkspaceOwner: true,
    isTenantOwner: true,
  },
  {
    id: 'm-2',
    name: 'Kaustav Dutta',
    email: 'kaustav.d@neoflo.ai',
    invoiceProcessing: 'Reviewer',
    status: 'Active',
    lastActive: at(0, Math.max(0, NOW_HOUR - 2), NOW_MINUTE),
    isWorkspaceOwner: false,
    isTenantOwner: false,
  },
  {
    id: 'm-3',
    name: 'Hemshankar Rao',
    email: 'hem.r@neoflo.ai',
    invoiceProcessing: 'Agent',
    status: 'Active',
    lastActive: at(1, 16, 20),
    isWorkspaceOwner: false,
    isTenantOwner: false,
  },
  {
    id: 'm-4',
    name: 'Sundip Menon',
    email: 'sundip.m@neoflo.ai',
    invoiceProcessing: 'Reviewer',
    status: 'Suspended',
    lastActive: at(9, 11, 5),
    isWorkspaceOwner: false,
    isTenantOwner: false,
  },
  {
    id: 'm-5',
    name: 'vibs@neoflo.ai',
    email: 'vibs@neoflo.ai',
    invoiceProcessing: 'Agent',
    status: 'Invite pending',
    lastActive: at(3, 9, 30),
    isWorkspaceOwner: false,
    isTenantOwner: false,
  },
];

/* ── Memory ───────────────────────────────────────────────────────────── */

/**
 * Two patterns sit at a streak of 2. The threshold is 3, so coding either one
 * the same way once more forms a memory in front of you — the only way to see
 * §9 happen inside one sitting.
 */
export const MEMORY_PATTERNS: MemoryPattern[] = [
  {
    id: 'mem-1',
    field: 'GL code',
    fieldKey: 'gl',
    patternKey: 'Redwood Office Supply · office consumables',
    suggestedValue: '6200 · Office supplies',
    streak: 2,
    lastSeen: at(6),
  },
  {
    id: 'mem-2',
    field: 'VAT code',
    fieldKey: 'vat',
    patternKey: 'Cascade Industrial Parts · all lines',
    suggestedValue: 'US-CA-SALES-7.25',
    streak: 2,
    lastSeen: at(7),
  },
  {
    id: 'mem-3',
    field: 'Vendor mapping',
    fieldKey: 'vendor',
    patternKey: 'REDWOOD OFFICE SUPPLY CO → Redwood Office Supply',
    suggestedValue: 'Redwood Office Supply',
    streak: 4,
    lastSeen: at(8),
  },
];

/**
 * Where each field sits on the page, as percentages. The document facsimile is
 * drawn from these same coordinates, so a highlight always lands exactly on the
 * text it refers to.
 */
export const FIELD_REGIONS: Record<
  string,
  { page: number; x: number; y: number; w: number; h: number }
> = {
  vendor: { page: 1, x: 6, y: 4, w: 46, h: 4.5 },
  vendorCode: { page: 1, x: 6, y: 9, w: 46, h: 3.5 },
  vendorTaxId: { page: 1, x: 6, y: 13, w: 46, h: 3.5 },
  number: { page: 1, x: 6, y: 25, w: 22, h: 4.5 },
  date: { page: 1, x: 30, y: 25, w: 21, h: 4.5 },
  dueDate: { page: 1, x: 53, y: 25, w: 21, h: 4.5 },
  po: { page: 1, x: 76, y: 25, w: 20, h: 4.5 },
  terms: { page: 1, x: 6, y: 32, w: 26, h: 4 },
  currency: { page: 1, x: 34, y: 32, w: 16, h: 4 },
  taxCode: { page: 1, x: 52, y: 32, w: 24, h: 4 },
  subtotal: { page: 1, x: 64, y: 74, w: 32, h: 4 },
  tax: { page: 1, x: 64, y: 79, w: 32, h: 4 },
  total: { page: 1, x: 64, y: 84, w: 32, h: 5 },
};

/* ── Field builders ───────────────────────────────────────────────────── */

function field(
  key: string,
  label: string,
  value: string,
  confidence: number | null,
  mandatory = true,
  learnable = false,
): ExtractedField {
  return { key, label, value, confidence, mandatory, learnable };
}

/**
 * The invoice field set, in the order and wording the product shows it, with the
 * purchase order's value alongside for the matching comparison.
 */
function invoiceFields(
  values: {
    number: string;
    date: string;
    dueDate?: string;
    vendor: string;
    vendorCode?: string;
    vendorTaxId?: string;
    po: string | null;
    currency: string;
    subtotal: string;
    tax: string;
    total: string;
    terms?: string;
    remitTo?: string;
    taxCode?: string;
  },
  conf: Record<string, number> = {},
  base = 97,
  /** Fields where the PO disagrees. Anything absent matches the invoice. */
  poOverrides: Record<string, string> = {},
  /**
   * Fields the document does not carry, mapped to why the value was proposed
   * anyway. These get no region: there is nothing on the page to point at.
   */
  inferred: Record<string, string> = {},
): ExtractedField[] {
  const c = (k: string) => conf[k] ?? base;
  const rows: [string, string, string, boolean, boolean][] = [
    // key, label, value, mandatory, learnable
    ['po', 'Purchase Order Number', values.po ?? '—', false, false],
    ['number', 'Invoice Number', values.number, true, false],
    ['date', 'Invoice Date', values.date, true, false],
    ['dueDate', 'Due Date', values.dueDate ?? values.date, false, false],
    ['vendor', 'Vendor Name', values.vendor, true, true],
    ['vendorCode', 'Vendor Code', values.vendorCode ?? '—', true, true],
    ['vendorTaxId', 'Vendor Tax ID', values.vendorTaxId ?? values.vendorCode ?? '—', true, false],
    ['terms', 'Payment Terms', values.terms ?? 'Net 30', false, true],
    ['currency', 'Currency', values.currency, true, false],
    ['total', 'Total Amount', values.total, true, false],
    ['tax', 'Tax Amount', values.tax, false, false],
    ['subtotal', 'Amount before tax', values.subtotal, false, false],
    ['taxCode', 'Tax code', values.taxCode ?? 'US-EXEMPT', false, true],
  ];
  return rows.map(([key, label, value, mandatory, learnable]) => ({
    ...field(key, label, value, c(key), mandatory, learnable),
    poValue: poOverrides[key] ?? value,
    region: inferred[key] ? undefined : FIELD_REGIONS[key],
    inferred: inferred[key] ? { because: inferred[key] } : undefined,
  }));
}

/** A PO read from a document carries confidence; one from Zoho does not. */
function poFields(
  values: { number: string; vendor: string; currency: string; total: string },
  source: 'zoho' | 'uploaded',
  conf: Record<string, number> = {},
): ExtractedField[] {
  const c = (k: string) => (source === 'zoho' ? null : (conf[k] ?? 96));
  return [
    field('poNumber', 'PO number', values.number, c('poNumber')),
    field('poVendor', 'Vendor', values.vendor, c('poVendor')),
    field('poCurrency', 'Currency', values.currency, c('poCurrency')),
    field('poTotal', 'PO total', values.total, c('poTotal')),
  ];
}

function grnFields(
  values: { number: string; poRef: string; receiptDate: string },
  source: 'zoho' | 'uploaded',
  conf: Record<string, number> = {},
): ExtractedField[] {
  const c = (k: string) => (source === 'zoho' ? null : (conf[k] ?? 95));
  return [
    field('grnNumber', 'GRN number', values.number, c('grnNumber')),
    field('grnPoRef', 'PO reference', values.poRef, c('grnPoRef')),
    field('grnDate', 'Receipt date', values.receiptDate, c('grnDate')),
  ];
}

function line(
  id: string,
  description: string,
  invoiceQty: number,
  poQty: number,
  grnQty: number | null,
  unitPrice: number,
  gl: string,
  vat = 'US-EXEMPT',
  wht = 'US-NONE',
  poUnitPrice?: number,
  confidence = 97,
): MatchLine {
  const poUnit = poUnitPrice ?? unitPrice;
  const invoiceLineTotal = Number((invoiceQty * unitPrice).toFixed(2));
  const poLineTotal = Number((poQty * poUnit).toFixed(2));
  return {
    id,
    itemNo: `ILI-${id.replace(/\D/g, '').padStart(4, '0')}`,
    confidence,
    description,
    invoiceQty,
    poQty,
    grnQty,
    invoiceUnitPrice: unitPrice,
    poUnitPrice: poUnit,
    invoiceLineTotal,
    poLineTotal,
    vat,
    wht,
    gl,
    // The dot on the row: exact, inside tolerance, or out.
    state:
      invoiceQty === poQty && invoiceLineTotal === poLineTotal
        ? 'matched'
        : Math.abs(invoiceLineTotal - poLineTotal) <= 10
          ? 'warning'
          : 'failed',
  };
}

/** Marks the deliveries a line arrived on, for a line built by `line()`. */
function received(
  l: MatchLine,
  receipts: { grnNo: string; qty: number; poNo?: string }[],
): MatchLine {
  return { ...l, receipts };
}

/**
 * The GRN side of the comparison, built from the lines that were received. The
 * product shows receipts as their own rows carrying a PO and GRN number, so a
 * line that arrived in three deliveries appears three times and the panel adds
 * them up against the invoice line they satisfy.
 *
 * A line that names no receipts arrived in one, on the receipt raised against
 * its own purchase order.
 */
function grnLinesFor(lines: MatchLine[], poNumber: string | null): GrnLine[] {
  const fallbackGrn = poNumber ? `GRN-${poNumber.replace(/\D/g, '').slice(-5)}` : 'GRN-—';
  return lines
    .filter((l) => l.grnQty !== null)
    .flatMap((l) => {
      const receipts = l.receipts ?? [{ grnNo: fallbackGrn, qty: l.grnQty as number }];
      return receipts.map((r, index) => ({
        id: `grn-${l.id}-${index}`,
        poNo: r.poNo ?? poNumber ?? '—',
        grnNo: r.grnNo,
        description: l.description,
        qty: r.qty,
        unitPrice: l.poUnitPrice,
        lineTotal: Number((r.qty * l.poUnitPrice).toFixed(2)),
        matchedTo: l.id,
      }));
    });
}

/** The payload the posting stage writes, derived from what was matched. */
function erpFor(
  invoice: { poNumber: string | null; amount: number; number: string; lines: MatchLine[] },
): ErpPayload {
  const beforeVat = invoice.lines.reduce((sum, l) => sum + l.invoiceLineTotal, 0);
  const poTotal = invoice.lines.reduce((sum, l) => sum + l.poLineTotal, 0);
  // Both sides of the variance are pre-tax. Comparing the tax-inclusive header
  // total against tax-exclusive order lines reports the tax as a variance,
  // which is only invisible while every invoice in the set is tax-exempt.
  const variance = Number((beforeVat - poTotal).toFixed(2));
  return {
    poNumber: invoice.poNumber ?? '',
    amountBeforeVat: Number(beforeVat.toFixed(2)),
    totalAfterVat: invoice.amount,
    referenceNumber: `NL${invoice.number.replace(/\D/g, '').padStart(9, '0')}`,
    text: invoice.number,
    refKeyHead1: '',
    refKeyHead2: '',
    assignment: '',
    // The ERP's own line of prose about the document. Seeded from the first
    // line, which is what an AP clerk types there.
    docHeader: invoice.lines[0]?.description ?? '',
    refKey2: '',
    variance,
    simulated: null,
  };
}

/** Fills in the views the product shows but the seed literals do not spell out. */
function withDerived(invoice: Omit<Invoice, 'grnLines' | 'erp'>): Invoice {
  return {
    ...invoice,
    grnLines: grnLinesFor(invoice.lines, invoice.poNumber),
    erp: erpFor(invoice),
  };
}

function audit(at: string, action: string, detail?: string, actor = 'System'): {
  at: string;
  actor: string;
  action: string;
  detail?: string;
} {
  return { at, actor, action, detail };
}

/* ── Sources ──────────────────────────────────────────────────────────── */

export const SOURCES: InvoiceSource[] = [
  {
    id: 'src-mail-1',
    kind: 'Mailbox',
    label: 'ap@neoflo.ai · Invoices/Inbound · "August freight + network"',
    arrivedAt: at(1, 8, 12),
    heldDocuments: [],
  },
  {
    id: 'src-upload-1',
    kind: 'Upload',
    label: 'august-batch.zip · 9 documents',
    arrivedAt: at(2, 14, 3),
    heldDocuments: ['PO-US-91004.pdf'],
  },
  {
    id: 'src-mail-2',
    kind: 'Mailbox',
    label: 'ap@neoflo.ai · Invoices/Inbound · "Statement — no attachment"',
    arrivedAt: at(3, 11, 47),
    heldDocuments: ['vendor-statement-aug.pdf'],
  },
];

/* ── Invoices ─────────────────────────────────────────────────────────── */

/**
 * The queue this workspace opens with. Deliberately mid-flight: a couple of
 * terminal records so reporting and the returning-visit briefing have
 * something true to say, and three live exceptions to work.
 *
 * The three pre-computed samples (§12) are NOT here — they arrive when you
 * click "Run a sample" on the queue, which is the route the PRD describes.
 */
const SEED_INVOICES: Omit<Invoice, 'grnLines' | 'erp'>[] = [
  /* Clean, mid-extraction. Nothing wrong with it, it just arrived. */
  {
    id: 'inv-90551',
    number: 'INV-90551',
    vendor: 'Redwood Office Supply',
    legalEntity: LEGAL_ENTITY,
    currency: 'USD',
    amount: 6120.0,
    invoiceDate: at(0, 8, 5),
    poNumber: 'PO-US-90551',
    source: 'Mailbox',
    sourceId: 'src-mail-1',
    isSample: false,
    stpPosted: false,
    stage: 'extraction',
    status: 'Extraction',
    invoiceFields: invoiceFields({
      number: 'INV-90551',
      date: formatDate(at(0, 8, 5)),
      vendor: 'Redwood Office Supply',
      vendorCode: '299017764 (ROS-1180)',
      vendorTaxId: '299017764 (ROS-1180)',
      po: 'PO-US-90551',
      currency: 'USD',
      subtotal: '6,120.00',
      tax: '0.00',
      total: '6,120.00',
    }),
    poFields: poFields(
      { number: 'PO-US-90551', vendor: 'Redwood Office Supply', currency: 'USD', total: '6,120.00' },
      'zoho',
    ),
    grnFields: grnFields(
      { number: 'GRN-US-90551', poRef: 'PO-US-90551', receiptDate: formatDate(at(1, 14, 0)) },
      'uploaded',
    ),
    poSource: 'zoho',
    grnSource: 'uploaded',
    lines: [
      line('l1', 'Desk risers — adjustable', 24, 24, 24, 185.0, '6200 · Office supplies'),
      line('l2', 'Monitor arms — dual', 12, 12, 12, 140.0, '6200 · Office supplies'),
    ],
    attachments: [],
    matchResult: null,
    overrides: [],
    audit: [
      audit(at(0, 8, 5), 'Ingested', 'Mailbox · Invoices/Inbound'),
      audit(at(0, 8, 6), 'Extraction complete', 'Every field cleared its threshold'),
    ],
    ingestedAt: at(0, 8, 5),
    firstSurfacedAt: at(0, 8, 6),
    terminalAt: null,
  },

  /* Clean, mid-matching. Checks passed, waiting to be validated. */
  {
    id: 'inv-90448',
    number: 'INV-90448',
    vendor: 'Bayline Freight',
    legalEntity: LEGAL_ENTITY_WEST,
    currency: 'USD',
    amount: 3480.0,
    invoiceDate: at(1, 11, 20),
    poNumber: 'PO-US-90448',
    source: 'Upload',
    sourceId: 'src-upload-1',
    isSample: false,
    stpPosted: false,
    stage: 'matching',
    status: 'Matching',
    invoiceFields: invoiceFields({
      number: 'INV-90448',
      date: formatDate(at(1, 11, 20)),
      vendor: 'Bayline Freight',
      vendorCode: '551220398 (BF-5589)',
      vendorTaxId: '551220398 (BF-5589)',
      po: 'PO-US-90448',
      currency: 'USD',
      subtotal: '3,480.00',
      tax: '0.00',
      total: '3,480.00',
    }),
    poFields: poFields(
      { number: 'PO-US-90448', vendor: 'Bayline Freight', currency: 'USD', total: '3,480.00' },
      'zoho',
    ),
    grnFields: grnFields(
      { number: 'GRN-US-90448', poRef: 'PO-US-90448', receiptDate: formatDate(at(2, 9, 15)) },
      'uploaded',
    ),
    poSource: 'zoho',
    grnSource: 'uploaded',
    lines: [line('l1', 'Air freight — express', 1, 1, 1, 3480.0, '7100 · Freight and delivery')],
    attachments: [],
    matchResult: {
      matchTypeUsed: '3-way',
      ranAt: at(1, 11, 22),
      duplicate: { state: 'pass' },
      metadata: { state: 'pass', findings: [] },
      lineItem: { state: 'pass', findings: [] },
      hardBlock: null,
    },
    overrides: [],
    audit: [
      audit(at(1, 11, 20), 'Ingested', 'Upload · august-batch.zip'),
      audit(at(1, 11, 21), 'Extraction complete'),
      audit(at(1, 11, 22), 'Matching run', 'All three checks passed'),
    ],
    ingestedAt: at(1, 11, 20),
    firstSurfacedAt: at(1, 11, 22),
    terminalAt: null,
  },

  /* Low-confidence extraction. A poor scan, still usable. */
  {
    id: 'inv-77120',
    number: 'INV-77120',
    vendor: 'Sierra Networks',
    legalEntity: LEGAL_ENTITY,
    currency: 'USD',
    amount: 3940.24,
    invoiceDate: at(1),
    poNumber: 'PO-US-77004',
    source: 'Mailbox',
    sourceId: 'src-mail-1',
    isSample: false,
    stpPosted: false,
    stage: 'extraction',
    status: 'Action Required',
    invoiceFields: invoiceFields(
      {
        number: 'INV-77120',
        date: formatDate(at(1)),
        vendor: 'Sierra Networks',
        vendorCode: '760114882 (SN-4471)',
        vendorTaxId: '760114882 (SN-4471)',
        po: 'PO-US-77004',
        currency: 'USD',
        subtotal: '3,940.24',
        tax: '0.00',
        total: '3,940.24',
        remitTo: '1188 Alder Way, Bellevue WA 98004',
        taxCode: 'US-WA-SALES-10.25',
      },
      // A clean digital invoice: everything printed on it is read clearly. The
      // only uncertain value is the one that is not printed at all.
      { currency: 58 },
      97,
      {},
      {
        // Not printed anywhere on this invoice, which is common enough. The
        // value is a proposal from the bill-to country, offered for a person to
        // agree with rather than presented as something that was read.
        currency: 'Not printed on this invoice. Proposed from the bill-to address, which is in the United States.',
      },
    ),
    poFields: poFields(
      { number: 'PO-US-77004', vendor: 'Sierra Networks', currency: 'USD', total: '3,940.24' },
      'zoho',
    ),
    grnFields: [],
    poSource: 'zoho',
    grnSource: 'none',
    /**
     * Six lines rather than two. An extraction screen with a two-row table does
     * not look like an invoice anybody has actually received, and this is the
     * record the extraction scenarios open. The totals still add to 3,940.24.
     */
    lines: [
      line('l1', 'Network switch — 48 port PoE+', 4, 4, null, 720.0, '6400 · IT and software'),
      line('l2', 'SFP+ transceiver — 10GbE SR', 8, 8, null, 41.5, '6400 · IT and software'),
      line('l3', 'Patch cable — Cat6A, 3 ft', 24, 24, null, 4.85, '6400 · IT and software'),
      line('l4', 'Rack shelf — 1U vented', 2, 2, null, 38.0, '6500 · Repairs and maintenance'),
      line('l5', 'Cable management arm', 4, 4, null, 22.6, '6500 · Repairs and maintenance'),
      line('l6', 'Install labor — on site', 8, 8, null, 55.68, '6400 · IT and software'),
    ],
    attachments: [
      { name: 'faktur-pajak-77120.pdf', kind: 'Tax document' },
      { name: 'delivery-note-77120.pdf', kind: 'Supporting document' },
    ],
    matchResult: null,
    overrides: [],
    audit: [
      audit(at(1, 8, 12), 'Ingested', 'Mailbox · Invoices/Inbound'),
      audit(at(1, 8, 12), 'Extraction started'),
      audit(at(1, 8, 13), 'Surfaced as Action Required', '4 fields below the 85% threshold'),
    ],
    ingestedAt: at(1, 8, 12),
    firstSurfacedAt: at(1, 8, 13),
    terminalAt: null,
  },

  /*
   * A 3-way match that came out clean, sitting at matching waiting to be
   * validated. Six lines, each received across the deliveries it actually
   * arrived on, so the receipt panel adds three rows up against one invoice
   * line rather than showing a tidy one-to-one that no warehouse produces.
   *
   * One line is off: the cable arms were billed at 22.60 against 22.00 on the
   * order. Inside tolerance, so nothing blocks — it is the case the screen
   * exists for, a group that is plausibly right but does not add up.
   */
  {
    id: 'inv-77655',
    number: 'INV-77655',
    vendor: 'Sierra Networks',
    legalEntity: LEGAL_ENTITY,
    currency: 'USD',
    amount: 13257.52,
    invoiceDate: at(3),
    poNumber: 'PO-US-77655',
    source: 'Mailbox',
    sourceId: 'src-mail-1',
    isSample: false,
    stpPosted: false,
    stage: 'matching',
    status: 'Matching',
    invoiceFields: invoiceFields(
      {
        number: 'INV-77655',
        date: formatDate(at(3)),
        dueDate: formatDate(at(-27)),
        vendor: 'Sierra Networks',
        // The same vendor as INV-77120, so the same codes.
        vendorCode: '760114882 (SN-4471)',
        vendorTaxId: '760114882 (SN-4471)',
        po: 'PO-US-77655',
        currency: 'USD',
        terms: 'Net 30',
        subtotal: '13,257.52',
        tax: '0.00',
        total: '13,257.52',
        remitTo: '2200 Sierra Point Pkwy, Brisbane CA 94005',
        taxCode: 'US-EXEMPT',
      },
      {},
      97,
      // The one header field the two documents disagree on, and the reason the
      // order is 7.20 lighter than the bill.
      { total: '13,250.32', subtotal: '13,250.32' },
    ),
    poFields: poFields(
      { number: 'PO-US-77655', vendor: 'Sierra Networks', currency: 'USD', total: '13,250.32' },
      'zoho',
    ),
    grnFields: grnFields(
      { number: 'GRN-4471', poRef: 'PO-US-77655', receiptDate: formatDate(at(6)) },
      'zoho',
    ),
    poSource: 'zoho',
    grnSource: 'zoho',
    lines: [
      // Switches came in three drops, the last one against a second order.
      received(line('l1', 'Network switch — 48 port PoE+', 12, 12, 12, 720.0, '6400 · IT and software'), [
        { grnNo: 'GRN-4471', qty: 5 },
        { grnNo: 'GRN-4488', qty: 4 },
        { grnNo: 'GRN-4502', qty: 3, poNo: 'PO-US-77660' },
      ]),
      received(line('l2', 'SFP+ transceiver — 10GbE SR', 40, 40, 40, 41.5, '6400 · IT and software'), [
        { grnNo: 'GRN-4471', qty: 24 },
        { grnNo: 'GRN-4488', qty: 16 },
      ]),
      received(line('l3', 'Patch cable — Cat6A, 3 ft', 200, 200, 200, 4.85, '6400 · IT and software'), [
        { grnNo: 'GRN-4471', qty: 120 },
        { grnNo: 'GRN-4502', qty: 80, poNo: 'PO-US-77660' },
      ]),
      received(line('l4', 'Rack shelf — 1U vented', 10, 10, 10, 38.0, '6500 · Repairs and maintenance'), [
        { grnNo: 'GRN-4488', qty: 10 },
      ]),
      // Billed at 22.60 against 22.00 on the order. 7.20 over, inside both
      // line tolerances, so it is shown rather than blocked.
      received(
        line('l5', 'Cable management arm', 12, 12, 12, 22.6, '6500 · Repairs and maintenance', 'US-EXEMPT', 'US-NONE', 22.0),
        [{ grnNo: 'GRN-4502', qty: 12, poNo: 'PO-US-77660' }],
      ),
      received(line('l6', 'PDU — 8 outlet, 1U', 24, 24, 24, 55.68, '6400 · IT and software'), [
        { grnNo: 'GRN-4488', qty: 16 },
        { grnNo: 'GRN-4519', qty: 8 },
      ]),
    ],
    attachments: [{ name: 'delivery-note-77655.pdf', kind: 'Supporting document' }],
    matchResult: {
      matchTypeUsed: '3-way',
      ranAt: at(3, 8, 40),
      duplicate: { state: 'pass' },
      metadata: { state: 'pass', findings: [] },
      lineItem: { state: 'pass', findings: [] },
      hardBlock: null,
    },
    overrides: [],
    audit: [
      audit(at(3, 8, 38), 'Ingested', 'Mailbox · Invoices/Inbound'),
      audit(at(3, 8, 39), 'Extraction complete', 'Every mandatory field cleared its threshold'),
      audit(at(3, 8, 40), 'Auto-advanced to matching'),
      audit(at(3, 8, 40), 'Matching run', 'All three checks passed. One line inside tolerance'),
    ],
    ingestedAt: at(3, 8, 38),
    firstSurfacedAt: at(3, 8, 40),
    terminalAt: null,
  },

  /* 3-way with no receipt raised. Hard block — the designed stall, Journey §8.1. */
  {
    id: 'inv-88213',
    number: 'INV-88213',
    vendor: 'Puget Logistics',
    legalEntity: LEGAL_ENTITY,
    currency: 'USD',
    amount: 7215.6,
    invoiceDate: at(2),
    poNumber: 'PO-US-88213',
    source: 'Mailbox',
    sourceId: 'src-mail-1',
    isSample: false,
    stpPosted: false,
    stage: 'matching',
    status: 'Action Required',
    invoiceFields: invoiceFields({
      number: 'INV-88213',
      date: formatDate(at(2)),
      vendor: 'Puget Logistics',
      po: 'PO-US-88213',
      currency: 'USD',
      subtotal: '7,215.60',
      tax: '0.00',
      total: '7,215.60',
      remitTo: '400 Harbor Ave SW, Seattle WA 98126',
      taxCode: 'US-EXEMPT',
    }),
    poFields: poFields(
      { number: 'PO-US-88213', vendor: 'Puget Logistics', currency: 'USD', total: '7,215.60' },
      'zoho',
    ),
    grnFields: [],
    poSource: 'zoho',
    grnSource: 'none',
    lines: [
      line('l1', 'Freight — inbound, August', 1, 1, null, 5400.0, '7100 · Freight and delivery'),
      line('l2', 'Fuel surcharge', 1, 1, null, 1815.6, '7100 · Freight and delivery'),
    ],
    attachments: [],
    matchResult: {
      matchTypeUsed: '3-way',
      ranAt: at(2, 9, 20),
      duplicate: { state: 'pass' },
      metadata: { state: 'pending', findings: [] },
      lineItem: { state: 'pending', findings: [] },
      hardBlock: 'no-grn',
    },
    overrides: [],
    audit: [
      audit(at(2, 9, 19), 'Ingested', 'Mailbox · Invoices/Inbound'),
      audit(at(2, 9, 20), 'Extraction complete', 'Every mandatory field cleared its threshold'),
      audit(at(2, 9, 20), 'Auto-advanced to matching'),
      audit(at(2, 9, 20), 'Hard block', 'No GRN, and the match type is 3-way'),
    ],
    ingestedAt: at(2, 9, 19),
    firstSurfacedAt: at(2, 9, 20),
    terminalAt: null,
  },

  /* Invoice exceeds the PO balance. Overridable with a reason — not a hard block. */
  {
    id: 'inv-44320',
    number: 'INV-44320',
    vendor: 'Cascade Industrial Parts',
    legalEntity: LEGAL_ENTITY_WEST,
    currency: 'USD',
    amount: 21900.0,
    invoiceDate: at(7),
    poNumber: 'PO-US-44320',
    source: 'Upload',
    sourceId: 'src-upload-1',
    isSample: false,
    stpPosted: false,
    stage: 'matching',
    status: 'Action Required',
    invoiceFields: invoiceFields({
      number: 'INV-44320',
      date: formatDate(at(7)),
      vendor: 'Cascade Industrial Parts',
      po: 'PO-US-44320',
      currency: 'USD',
      subtotal: '21,900.00',
      tax: '0.00',
      total: '21,900.00',
      remitTo: '2020 Foundry Rd, Portland OR 97210',
      taxCode: 'US-EXEMPT',
    }),
    poFields: poFields(
      { number: 'PO-US-44320', vendor: 'Cascade Industrial Parts', currency: 'USD', total: '25,000.00' },
      'zoho',
    ),
    grnFields: grnFields(
      { number: 'GRN-US-44320', poRef: 'PO-US-44320', receiptDate: formatDate(at(8)) },
      'uploaded',
    ),
    poSource: 'zoho',
    grnSource: 'uploaded',
    lines: [line('l1', 'Conveyor belting — 600mm', 300, 300, 300, 73.0, '6500 · Repairs and maintenance', 'US-CA-SALES-7.25')],
    attachments: [{ name: 'approval-email-44320.eml', kind: 'Supporting document' }],
    matchResult: {
      matchTypeUsed: '3-way',
      ranAt: at(7, 16, 41),
      duplicate: { state: 'pass' },
      metadata: {
        state: 'fail',
        findings: [
          {
            field: 'PO balance',
            invoiceValue: '21,900.00',
            poValue: '17,000.00 remaining of 25,000.00',
            kind: 'balance',
            invoiceConfidence: 97,
            poConfidence: null,
          },
        ],
      },
      lineItem: { state: 'pass', findings: [] },
      hardBlock: null,
    },
    overrides: [],
    audit: [
      audit(at(7, 16, 40), 'Ingested', 'Upload · august-batch.zip'),
      audit(at(7, 16, 41), 'Extraction complete'),
      audit(at(7, 16, 41), 'Matching run', 'Duplicate passed. Line item passed. Metadata failed.'),
      audit(at(7, 16, 41), 'Surfaced as Action Required', 'Invoice exceeds the remaining PO balance by 4,900.00'),
    ],
    ingestedAt: at(7, 16, 40),
    firstSurfacedAt: at(7, 16, 41),
    terminalAt: null,
  },

  /*
   * Sitting at posting, matched and waiting for a dry run. Twelve lines, which
   * is what the posting table was built for: enough to page, enough for the
   * tax-code column to be a column of decisions rather than one repeated
   * value, and a service line at the bottom that withholds where the goods
   * above it do not.
   *
   * The only record in the set carrying sales tax, so the header's two amounts
   * are two different numbers the way they are on a real posting.
   */
  {
    id: 'inv-51288',
    number: 'INV-51288',
    vendor: 'Cascade Industrial Parts',
    legalEntity: LEGAL_ENTITY,
    currency: 'USD',
    amount: 16453.22,
    invoiceDate: at(4),
    poNumber: 'PO-US-51288',
    source: 'Mailbox',
    sourceId: 'src-mail-1',
    isSample: false,
    stpPosted: false,
    stage: 'posting',
    status: 'ERP posting',
    invoiceFields: invoiceFields({
      number: 'INV-51288',
      date: formatDate(at(4)),
      dueDate: formatDate(at(-26)),
      vendor: 'Cascade Industrial Parts',
      vendorCode: 'CIP-0088',
      vendorTaxId: '91-2044517',
      po: 'PO-US-51288',
      currency: 'USD',
      terms: 'Net 30',
      subtotal: '15,435.50',
      tax: '1,017.72',
      total: '16,453.22',
      remitTo: '2020 Foundry Rd, Portland OR 97210',
      taxCode: 'US-CA-SALES-7.25',
    }),
    poFields: poFields(
      {
        number: 'PO-US-51288',
        vendor: 'Cascade Industrial Parts',
        currency: 'USD',
        total: '16,453.22',
      },
      'zoho',
    ),
    grnFields: grnFields(
      { number: 'GRN-51288', poRef: 'PO-US-51288', receiptDate: formatDate(at(5)) },
      'zoho',
    ),
    poSource: 'zoho',
    grnSource: 'zoho',
    lines: [
      line('l1', 'Steel toe boots — size 10', 24, 24, 24, 118.5, '6300 · Safety and workwear', SALES_TAX_CA),
      line('l2', 'Reflective safety vest — class 2', 60, 60, 60, 21.75, '6300 · Safety and workwear', SALES_TAX_CA),
      line('l3', 'Industrial ear muffs — 25dB', 40, 40, 40, 18.4, '6300 · Safety and workwear', SALES_TAX_CA),
      line('l4', 'Welding face shield', 12, 12, 12, 96.25, '6300 · Safety and workwear', SALES_TAX_CA),
      line('l5', 'Nitrile gloves — box of 100', 80, 80, 80, 14.6, '6300 · Safety and workwear', SALES_TAX_CA),
      line('l6', 'Dust respirator N95 — box of 20', 30, 30, 30, 32.8, '6300 · Safety and workwear', SALES_TAX_CA),
      line('l7', 'Fall harness kit', 8, 8, 8, 289.0, '6300 · Safety and workwear', SALES_TAX_CA),
      line('l8', 'Fire retardant coverall', 16, 16, 16, 145.9, '6300 · Safety and workwear', SALES_TAX_CA),
      line('l9', 'First aid station — wall mount', 4, 4, 4, 212.4, '6300 · Safety and workwear', SALES_TAX_CA),
      line('l10', 'Eye wash station refill', 6, 6, 6, 58.25, '6300 · Safety and workwear', SALES_TAX_CA),
      line('l11', 'Safety signage — bilingual set', 10, 10, 10, 44.8, '6300 · Safety and workwear'),
      // Labour, not goods: no sales tax on it, and it is the one line that
      // withholds.
      line('l12', 'On-site safety training — half day', 1, 1, 1, 950.0, '6600 · Training and development', 'US-EXEMPT', 'US-1099-NEC'),
    ],
    attachments: [
      { name: 'delivery-note-51288.pdf', kind: 'Supporting document' },
      { name: 'coa-51288.pdf', kind: 'Supporting document' },
    ],
    matchResult: {
      matchTypeUsed: '3-way',
      ranAt: at(4, 10, 5),
      duplicate: { state: 'pass' },
      metadata: { state: 'pass', findings: [] },
      lineItem: { state: 'pass', findings: [] },
      hardBlock: null,
    },
    overrides: [],
    audit: [
      audit(at(4, 10, 2), 'Ingested', 'Mailbox · Invoices/Inbound'),
      audit(at(4, 10, 4), 'Extraction complete', 'Every mandatory field cleared its threshold'),
      audit(at(4, 10, 5), 'Matching run', 'All three checks passed'),
      audit(at(4, 10, 6), 'Validated', 'Moved to ERP posting', 'Vibhor Sharma'),
    ],
    ingestedAt: at(4, 10, 2),
    firstSurfacedAt: at(4, 10, 5),
    terminalAt: null,
  },

  /* Clean, ERP connected, nothing flagged — posted on its own and never surfaced. */
  {
    id: 'inv-66004',
    number: 'INV-66004',
    vendor: 'Redwood Office Supply',
    legalEntity: LEGAL_ENTITY,
    currency: 'USD',
    amount: 2180.0,
    invoiceDate: at(8),
    poNumber: 'PO-US-66004',
    source: 'Mailbox',
    sourceId: 'src-mail-1',
    isSample: false,
    stpPosted: true,
    stage: 'posting',
    status: 'Posted',
    invoiceFields: invoiceFields({
      number: 'INV-66004',
      date: formatDate(at(8)),
      vendor: 'Redwood Office Supply',
      po: 'PO-US-66004',
      currency: 'USD',
      subtotal: '2,180.00',
      tax: '0.00',
      total: '2,180.00',
      remitTo: '18 Cedar St, Sacramento CA 95814',
    }),
    poFields: poFields(
      { number: 'PO-US-66004', vendor: 'Redwood Office Supply', currency: 'USD', total: '2,180.00' },
      'zoho',
    ),
    grnFields: grnFields(
      { number: 'GRN-US-66004', poRef: 'PO-US-66004', receiptDate: formatDate(at(9)) },
      'uploaded',
    ),
    poSource: 'zoho',
    grnSource: 'uploaded',
    lines: [line('l1', 'Filing cabinets — 4 drawer', 4, 4, 4, 545.0, '6200 · Office supplies')],
    attachments: [],
    matchResult: {
      matchTypeUsed: '3-way',
      ranAt: at(8, 7, 2),
      duplicate: { state: 'pass' },
      metadata: { state: 'pass', findings: [] },
      lineItem: { state: 'pass', findings: [] },
      hardBlock: null,
    },
    overrides: [],
    audit: [
      audit(at(8, 7, 1), 'Ingested', 'Mailbox · Invoices/Inbound'),
      audit(at(8, 7, 2), 'Extraction complete', 'Every field cleared its threshold'),
      audit(at(8, 7, 2), 'Matching run', 'All three checks passed'),
      audit(at(8, 7, 2), 'Posted by straight-through processing', 'Never surfaced to a user. Zoho Books ZB-BILL-10442'),
    ],
    erpReference: 'ZB-BILL-10442',
    ingestedAt: at(8, 7, 1),
    firstSurfacedAt: null,
    terminalAt: at(8, 7, 2),
  },

  /* Surfaced, worked by a person, posted. Gives touch time something to measure. */
  {
    id: 'inv-33128',
    number: 'INV-33128',
    vendor: 'Redwood Office Supply',
    legalEntity: LEGAL_ENTITY_WEST,
    currency: 'USD',
    amount: 9340.0,
    invoiceDate: at(6),
    poNumber: 'PO-US-33128',
    source: 'Upload',
    sourceId: 'src-upload-1',
    isSample: false,
    stpPosted: false,
    stage: 'posting',
    status: 'Posted',
    invoiceFields: invoiceFields({
      number: 'INV-33128',
      date: formatDate(at(6)),
      vendor: 'Redwood Office Supply',
      po: 'PO-US-33128',
      currency: 'USD',
      subtotal: '9,340.00',
      tax: '0.00',
      total: '9,340.00',
      remitTo: '18 Cedar St, Sacramento CA 95814',
    }),
    poFields: poFields(
      { number: 'PO-US-33128', vendor: 'Redwood Office Supply', currency: 'USD', total: '9,340.00' },
      'zoho',
    ),
    grnFields: grnFields(
      { number: 'GRN-US-33128', poRef: 'PO-US-33128', receiptDate: formatDate(at(7)) },
      'uploaded',
    ),
    poSource: 'zoho',
    grnSource: 'uploaded',
    lines: [
      line('l1', 'Printer paper — A4 80gsm', 100, 100, 100, 58.0, '6200 · Office supplies'),
      line('l2', 'Labels — thermal 4x6', 60, 60, 60, 59.0, '6200 · Office supplies'),
    ],
    attachments: [],
    matchResult: {
      matchTypeUsed: '3-way',
      ranAt: at(6, 10, 26),
      duplicate: { state: 'pass' },
      metadata: { state: 'pass', findings: [] },
      lineItem: { state: 'pass', findings: [] },
      hardBlock: null,
    },
    overrides: [
      {
        rule: 'Line item — quantity',
        reason: 'Short shipment agreed with the vendor; remaining 4 cartons canceled on the PO.',
        at: at(6, 10, 31),
        actor: 'Kaustav Dutta',
      },
    ],
    audit: [
      audit(at(6, 10, 24), 'Ingested', 'Upload · august-batch.zip'),
      audit(at(6, 10, 25), 'Extraction complete'),
      audit(at(6, 10, 26), 'Matching run', 'Line item failed on quantity'),
      audit(at(6, 10, 31), 'Override recorded', 'Line item — quantity. Reason given.', 'Kaustav Dutta'),
      audit(at(6, 10, 33), 'Posted to Zoho Books', 'ZB-BILL-10488', 'Kaustav Dutta'),
    ],
    erpReference: 'ZB-BILL-10488',
    ingestedAt: at(6, 10, 24),
    firstSurfacedAt: at(6, 10, 26),
    terminalAt: at(6, 10, 33),
  },

  /* Terminal at Exported — downloaded before Zoho was connected. */
  {
    id: 'inv-55891',
    number: 'INV-55891',
    vendor: 'Bayline Freight',
    legalEntity: LEGAL_ENTITY,
    currency: 'USD',
    amount: 5602.4,
    invoiceDate: at(13),
    poNumber: 'PO-US-55891',
    source: 'Upload',
    sourceId: 'src-upload-1',
    isSample: false,
    stpPosted: false,
    stage: 'posting',
    status: 'Exported',
    invoiceFields: invoiceFields({
      number: 'INV-55891',
      date: formatDate(at(13)),
      vendor: 'Bayline Freight',
      po: 'PO-US-55891',
      currency: 'USD',
      subtotal: '5,602.40',
      tax: '0.00',
      total: '5,602.40',
      remitTo: '77 Dockside Blvd, Oakland CA 94607',
    }),
    poFields: poFields(
      { number: 'PO-US-55891', vendor: 'Bayline Freight', currency: 'USD', total: '5,602.40' },
      'uploaded',
    ),
    grnFields: grnFields(
      { number: 'GRN-US-55891', poRef: 'PO-US-55891', receiptDate: formatDate(at(14)) },
      'uploaded',
    ),
    poSource: 'uploaded',
    grnSource: 'uploaded',
    lines: [line('l1', 'Ocean freight — FCL 40ft', 1, 1, 1, 5602.4, '7100 · Freight and delivery')],
    attachments: [],
    matchResult: {
      matchTypeUsed: '3-way',
      ranAt: at(13, 13, 10),
      duplicate: { state: 'pass' },
      metadata: { state: 'pass', findings: [] },
      lineItem: { state: 'pass', findings: [] },
      hardBlock: null,
    },
    overrides: [],
    audit: [
      audit(at(13, 13, 8), 'Ingested', 'Upload · august-batch.zip'),
      audit(at(13, 13, 9), 'Extraction complete', 'PO and GRN read from uploaded documents'),
      audit(at(13, 13, 10), 'Matching run', 'All three checks passed'),
      audit(at(13, 13, 14), 'Exported', 'Matched-data CSV downloaded. No ERP connected at the time.', 'Shubham Shrivastava'),
    ],
    ingestedAt: at(13, 13, 8),
    firstSurfacedAt: at(13, 13, 10),
    terminalAt: at(13, 13, 14),
  },

  /* Closed by a person, with the reason on the record. */
  {
    id: 'inv-22016',
    number: 'INV-22016',
    vendor: 'Harbor Print Co',
    legalEntity: LEGAL_ENTITY_WEST,
    currency: 'USD',
    amount: 1120.0,
    invoiceDate: at(9),
    poNumber: 'PO-US-22016',
    source: 'Mailbox',
    sourceId: 'src-mail-2',
    isSample: false,
    stpPosted: false,
    stage: 'matching',
    status: 'Rejected',
    invoiceFields: invoiceFields({
      number: 'INV-22016',
      date: formatDate(at(9)),
      vendor: 'Harbor Print Co',
      po: 'PO-US-22016',
      currency: 'USD',
      subtotal: '1,120.00',
      tax: '0.00',
      total: '1,120.00',
      remitTo: '9 Wharf Rd, Long Beach CA 90802',
      taxCode: 'US-CA-SALES-7.25',
    }),
    poFields: poFields(
      { number: 'PO-US-22016', vendor: 'Harbor Print Co', currency: 'USD', total: '1,120.00' },
      'zoho',
    ),
    grnFields: [],
    poSource: 'zoho',
    grnSource: 'none',
    lines: [line('l1', 'Brochures — A5 gloss, 5000', 5000, 5000, null, 0.224, '7400 · Printing and marketing', 'US-CA-SALES-7.25')],
    attachments: [],
    matchResult: {
      matchTypeUsed: '3-way',
      ranAt: at(9, 15, 2),
      duplicate: {
        state: 'fail',
        original: {
          number: 'INV-22016',
          vendor: 'Harbor Print Co',
          date: formatDate(at(9)),
          processedBy: 'Hemshankar Rao',
          metadataOnly: true,
        },
      },
      metadata: { state: 'skipped', findings: [] },
      lineItem: { state: 'skipped', findings: [] },
      hardBlock: 'duplicate',
    },
    overrides: [],
    audit: [
      audit(at(9, 15, 1), 'Ingested', 'Mailbox · Invoices/Inbound'),
      audit(at(9, 15, 2), 'Matching run', 'Duplicate hit. Metadata and line item skipped.'),
      audit(at(9, 15, 44), 'Rejected', 'Already processed in AP EMEA. The vendor re-sent it in error.', 'Shubham Shrivastava'),
    ],
    rejectReason: 'Already processed in AP EMEA. The vendor re-sent it in error.',
    ingestedAt: at(9, 15, 1),
    firstSurfacedAt: at(9, 15, 2),
    terminalAt: at(9, 15, 44),
  },
];

/** The queue this workspace opens with. */
export const INITIAL_INVOICES: Invoice[] = SEED_INVOICES.map(withDerived);

/* ── The pre-computed sample set (Workflow PRD §12) ───────────────────── */

/**
 * Three samples, matched to the tenant's country: a clean match that passes end
 * to end, one with a deliberate line variance so matching visibly catches
 * something, and a duplicate of the first so detection demonstrates itself.
 *
 * They start at extraction rather than auto-advancing, because the point of the
 * sample run is to force every stage to be shown — otherwise a user with clean
 * data first meets a stage only when something has gone wrong.
 *
 * Built fresh on each call, so "Run a sample" can be clicked more than once.
 */
export function buildSamples(batch: number): Invoice[] {
  const suffix = batch > 1 ? `-${batch}` : '';
  const ingestedAt = at(0, 9, 0);

  const cleanLines = [
    line('l1', 'Copy paper — A4 80gsm, carton of 5', 40, 40, 40, 62.0, '6200 · Office supplies'),
    line('l2', 'Toner cartridge — mono, high yield', 25, 25, 25, 240.0, '6200 · Office supplies'),
    line('l3', 'Task chair — mesh back', 8, 8, 8, 500.0, '6200 · Office supplies'),
  ];

  const clean: Omit<Invoice, 'grnLines' | 'erp'> = {
    id: `sample-clean${suffix}`,
    number: `INV-2026-4417${suffix}`,
    vendor: 'Redwood Office Supply',
    legalEntity: LEGAL_ENTITY,
    currency: 'USD',
    amount: 12480.0,
    invoiceDate: at(5),
    poNumber: `PO-US-88214${suffix}`,
    source: 'Sample',
    sourceId: `src-sample${suffix}`,
    isSample: true,
    stpPosted: false,
    stage: 'extraction',
    status: 'Extraction',
    invoiceFields: invoiceFields({
      number: `INV-2026-4417${suffix}`,
      date: formatDate(at(5)),
      vendor: 'Redwood Office Supply',
      po: `PO-US-88214${suffix}`,
      vendorCode: '84-2199407',
      vendorTaxId: '84-2199407',
      currency: 'USD',
      subtotal: '12,480.00',
      tax: '0.00',
      total: '12,480.00',
      remitTo: '18 Cedar St, Sacramento CA 95814',
    }),
    poFields: poFields(
      {
        number: `PO-US-88214${suffix}`,
        vendor: 'Redwood Office Supply',
        currency: 'USD',
        total: '12,480.00',
      },
      'uploaded',
    ),
    grnFields: grnFields(
      { number: `GRN-US-53301${suffix}`, poRef: `PO-US-88214${suffix}`, receiptDate: formatDate(at(6)) },
      'uploaded',
    ),
    poSource: 'uploaded',
    grnSource: 'uploaded',
    lines: cleanLines,
    attachments: [],
    matchResult: null,
    overrides: [],
    audit: [
      audit(ingestedAt, 'Ingested', 'Pre-computed sample set · United States'),
      audit(ingestedAt, 'Extraction complete', 'Invoice, PO and GRN all read. Every field cleared its threshold.'),
      audit(ingestedAt, 'Held at extraction', 'Sample invoices show every stage rather than auto-advancing.'),
    ],
    ingestedAt: ingestedAt,
    firstSurfacedAt: ingestedAt,
    terminalAt: null,
  };

  const variance: Omit<Invoice, 'grnLines' | 'erp'> = {
    id: `sample-variance${suffix}`,
    number: `INV-2026-4418${suffix}`,
    vendor: 'Cascade Industrial Parts',
    legalEntity: LEGAL_ENTITY,
    currency: 'USD',
    amount: 18639.0,
    invoiceDate: at(4),
    poNumber: `PO-US-88301${suffix}`,
    source: 'Sample',
    sourceId: `src-sample${suffix}`,
    isSample: true,
    stpPosted: false,
    stage: 'extraction',
    status: 'Extraction',
    invoiceFields: invoiceFields({
      number: `INV-2026-4418${suffix}`,
      date: formatDate(at(4)),
      vendor: 'Cascade Industrial Parts',
      po: `PO-US-88301${suffix}`,
      vendorCode: '84-2199407',
      vendorTaxId: '84-2199407',
      currency: 'USD',
      subtotal: '18,639.00',
      tax: '0.00',
      total: '18,639.00',
      remitTo: '2020 Foundry Rd, Portland OR 97210',
      taxCode: 'US-CA-SALES-7.25',
    }),
    poFields: poFields(
      {
        number: `PO-US-88301${suffix}`,
        vendor: 'Cascade Industrial Parts',
        currency: 'USD',
        total: '15,789.00',
      },
      'uploaded',
    ),
    grnFields: grnFields(
      { number: `GRN-US-53302${suffix}`, poRef: `PO-US-88301${suffix}`, receiptDate: formatDate(at(5)) },
      'uploaded',
    ),
    poSource: 'uploaded',
    grnSource: 'uploaded',
    lines: [
      line('l1', 'Hex bolt M12 — zinc, box of 100', 500, 500, 500, 1.85, '6500 · Repairs and maintenance', 'US-CA-SALES-7.25'),
      // Invoiced 120, ordered and received 100. The deliberate variance.
      line('l2', 'Bearing assembly — 6205-2RS', 120, 100, 100, 142.5, '6500 · Repairs and maintenance', 'US-CA-SALES-7.25'),
      line('l3', 'Gasket — nitrile, 80mm', 200, 200, 200, 3.07, '6500 · Repairs and maintenance', 'US-CA-SALES-7.25'),
    ],
    attachments: [],
    matchResult: null,
    overrides: [],
    audit: [
      audit(ingestedAt, 'Ingested', 'Pre-computed sample set · United States'),
      audit(ingestedAt, 'Extraction complete', 'Invoice, PO and GRN all read.'),
      audit(ingestedAt, 'Held at extraction', 'Sample invoices show every stage rather than auto-advancing.'),
    ],
    ingestedAt: ingestedAt,
    firstSurfacedAt: ingestedAt,
    terminalAt: null,
  };

  /* Same number, vendor and legal entity as the clean one — so the duplicate
     check finds it against the sample that arrived a moment earlier. */
  const duplicate: Omit<Invoice, 'grnLines' | 'erp'> = {
    ...clean,
    id: `sample-duplicate${suffix}`,
    invoiceDate: at(5),
    sourceId: `src-sample${suffix}`,
    audit: [
      audit(ingestedAt, 'Ingested', 'Pre-computed sample set · United States'),
      audit(ingestedAt, 'Extraction complete', 'Same invoice number, vendor and legal entity as the first sample.'),
      audit(ingestedAt, 'Held at extraction', 'Sample invoices show every stage rather than auto-advancing.'),
    ],
    invoiceFields: invoiceFields({
      number: `INV-2026-4417${suffix}`,
      date: formatDate(at(5)),
      vendor: 'Redwood Office Supply',
      po: `PO-US-88214${suffix}`,
      vendorCode: '84-2199407',
      vendorTaxId: '84-2199407',
      currency: 'USD',
      subtotal: '12,480.00',
      tax: '0.00',
      total: '12,480.00',
      remitTo: '18 Cedar St, Sacramento CA 95814',
    }),
    lines: cleanLines.map((l) => ({ ...l })),
  };

  return [clean, variance, duplicate].map(withDerived);
}

/**
 * An invoice record built from files the user actually chose. The extracted
 * values are representative rather than read from the file, but the filenames,
 * the document types and the invoice number all come from what they uploaded.
 */
export function buildFromUpload(input: {
  invoiceFile: string;
  poFile?: string;
  grnFile?: string;
  attachments: { name: string; kind: 'Tax document' | 'Supporting document' }[];
  sourceId: string;
  index: number;
  /** Decides whether an unmatched PO or receipt can be fetched instead. */
  connections: Connections;
}): Invoice {
  const stampedAt = at(0, NOW.getHours(), NOW.getMinutes());
  const { connections } = input;
  const base = input.invoiceFile.replace(/\.[^.]+$/, '');
  // Use a number from the filename where there is one, so the record matches
  // the document the user recognizes.
  const digits = base.match(/\d{3,}/)?.[0];
  const number = digits ? `INV-${digits}` : `INV-${base.slice(0, 18).toUpperCase()}`;
  const quantity = 20 + input.index * 5;
  const unitPrice = 62.0;
  const total = Number((quantity * unitPrice).toFixed(2));

  /**
   * These are PO-based invoices, so the number is on the invoice face whether or
   * not the user uploaded the purchase order. Where it resolves from follows the
   * PRD's order: the document they gave us, then Zoho, then nowhere, which is a
   * hard block they can clear by typing the number or attaching the file.
   */
  const poNumber = `PO-US-${digits ?? '91004'}`;
  const poSource: RefSource = input.poFile ? 'uploaded' : connections.zohoBooks ? 'zoho' : 'none';
  // Receipts live in Inventory, so Books alone cannot supply one.
  const grnSource: RefSource = input.grnFile
    ? 'uploaded'
    : connections.zohoInventory
      ? 'zoho'
      : 'none';
  const grnQuantity = grnSource === 'none' ? null : quantity;

  return withDerived({
    id: `inv-upload-${input.sourceId}-${input.index}`,
    number,
    vendor: 'Redwood Office Supply',
    legalEntity: LEGAL_ENTITY,
    currency: 'USD',
    amount: total,
    invoiceDate: at(0),
    poNumber,
    source: 'Upload',
    sourceId: input.sourceId,
    isSample: false,
    stpPosted: false,
    stage: 'extraction',
    status: 'Action Required',
    invoiceFields: invoiceFields(
      {
        number,
        date: formatDate(at(0)),
        vendor: 'REDWOOD OFFICE SUPPLY CO',
        vendorCode: '299017764 (ROS-1180)',
        vendorTaxId: '299017764 (ROS-1180)',
        po: poNumber,
        currency: 'USD',
        subtotal: total.toFixed(2),
        tax: '0.00',
        total: total.toFixed(2),
        remitTo: '18 Cedar St, Sacramento CA 95814',
      },
      { vendor: 71, subtotal: 80 },
    ),
    poFields:
      poSource === 'none'
        ? []
        : poFields(
            { number: poNumber, vendor: 'Redwood Office Supply', currency: 'USD', total: total.toFixed(2) },
            poSource,
            { poTotal: 82 },
          ),
    grnFields:
      grnSource === 'none'
        ? []
        : grnFields(
            { number: `GRN-US-${digits ?? '91004'}`, poRef: poNumber, receiptDate: formatDate(at(1)) },
            grnSource,
          ),
    poSource,
    grnSource,
    lines: [
      line('l1', 'Copy paper — A4 80gsm, carton of 5', quantity, quantity, grnQuantity, unitPrice, ''),
    ],
    attachments: input.attachments,
    matchResult: null,
    overrides: [],
    audit: [
      audit(stampedAt, 'Ingested', `Upload · ${input.invoiceFile}`),
      audit(stampedAt, 'Extraction started'),
      audit(
        stampedAt,
        'Purchase order resolved',
        poSource === 'uploaded'
          ? `Read from ${input.poFile}`
          : poSource === 'zoho'
            ? `${poNumber} fetched from Zoho Books`
            : `${poNumber} is on the invoice, but no purchase order was supplied`,
      ),
      audit(stampedAt, 'Surfaced as Action Required', 'Fields below the confidence threshold'),
    ],
    ingestedAt: stampedAt,
    firstSurfacedAt: stampedAt,
    terminalAt: null,
  });
}

/** An uploaded invoice, for the queue's Upload action. */
export function buildUpload(batch: number): Invoice {
  const stampedAt = at(0, NOW_HOUR, NOW_MINUTE);
  const n = 91000 + batch;
  return withDerived({
    id: `inv-upload-${n}`,
    number: `INV-${n}`,
    vendor: 'Redwood Office Supply',
    legalEntity: LEGAL_ENTITY,
    currency: 'USD',
    amount: 4265.0,
    invoiceDate: at(0),
    poNumber: 'PO-US-91004',
    source: 'Upload',
    sourceId: 'src-upload-1',
    isSample: false,
    stpPosted: false,
    stage: 'extraction',
    status: 'Action Required',
    invoiceFields: invoiceFields(
      {
        number: `INV-${n}`,
        date: formatDate(at(0)),
        vendor: 'REDWOOD OFFICE SUPPLY CO',
        vendorCode: '299017764 (ROS-1180)',
        vendorTaxId: '299017764 (ROS-1180)',
        po: 'PO-US-91004',
        currency: 'USD',
        subtotal: '4,265.00',
        tax: '0.00',
        total: '4,265.00',
        remitTo: '18 Cedar St, Sacramento CA 95814',
      },
      // A middling scan: two fields land under the threshold.
      { vendor: 71, subtotal: 80 },
    ),
    poFields: poFields(
      { number: 'PO-US-91004', vendor: 'Redwood Office Supply', currency: 'USD', total: '4,265.00' },
      'uploaded',
      { poTotal: 82 },
    ),
    grnFields: grnFields(
      { number: 'GRN-US-91004', poRef: 'PO-US-91004', receiptDate: formatDate(at(1)) },
      'uploaded',
    ),
    poSource: 'uploaded',
    grnSource: 'uploaded',
    lines: [
      line('l1', 'Copy paper — A4 80gsm, carton of 5', 35, 35, 35, 62.0, '', 'US-EXEMPT'),
      line('l2', 'Whiteboard marker — assorted, box of 12', 45, 45, 45, 45.0, '', 'US-EXEMPT'),
    ],
    attachments: [],
    matchResult: null,
    overrides: [],
    audit: [
      audit(stampedAt, 'Ingested', 'Upload · invoice + PO + GRN'),
      audit(stampedAt, 'Extraction started'),
      audit(stampedAt, 'Surfaced as Action Required', '3 fields below the threshold'),
    ],
    ingestedAt: stampedAt,
    firstSurfacedAt: stampedAt,
    terminalAt: null,
  });
}



/* ── Indexed documents (Ask Neo) ──────────────────────────────────────── */

/**
 * Deliberately long. A 214-page master agreement is the point: a general
 * assistant refuses it, and answering across the whole thing with a page
 * reference is the capability being sold.
 */
export const INDEXED_DOCUMENTS: IndexedDocument[] = [
  {
    id: 'doc-msa-redwood',
    name: 'FY26 Master Services Agreement — Redwood Office Supply.pdf',
    pages: 214,
    kind: 'Contract',
    indexedAt: at(7),
    origin: 'Upload',
    passages: [
      {
        topics: ['payment terms', 'net', 'terms', 'due', 'payment'],
        page: 18,
        text: 'Payment terms are Net 45 from invoice receipt, not invoice date. A 2% early-settlement discount applies where payment clears within 10 days.',
      },
      {
        topics: ['price', 'pricing', 'increase', 'uplift', 'escalation'],
        page: 61,
        text: 'Unit prices are fixed for the first twelve months. Any increase after that is capped at CPI or 4%, whichever is lower, and needs 60 days written notice.',
      },
      {
        topics: ['tolerance', 'variance', 'short', 'shipment', 'quantity'],
        page: 97,
        text: 'Quantity variance up to 2% on a shipment is accepted without amendment. Anything beyond that requires a credit note against the original invoice.',
      },
      {
        topics: ['dispute', 'reject', 'rejection', 'query'],
        page: 143,
        text: 'An invoice must be disputed within 30 days of receipt. After that it is deemed accepted, whether or not it was matched.',
      },
      {
        topics: ['termination', 'terminate', 'exit', 'notice period', 'cancel'],
        page: 186,
        text: 'Either party may terminate for convenience on 90 days written notice. Purchase orders already raised are honored to completion, and consigned stock returns within 30 days.',
      },
    ],
  },
  {
    id: 'doc-ap-policy',
    name: 'AP policy and approval matrix.pdf',
    pages: 38,
    kind: 'Policy',
    indexedAt: at(10),
    origin: 'Upload',
    passages: [
      {
        topics: ['approval', 'threshold', 'sign-off', 'limit', 'authority'],
        page: 7,
        text: 'Invoices up to $10,000 need no second approver. Between $10,000 and $50,000 a finance lead signs off. Above $50,000 the CFO signs off.',
      },
      {
        topics: ['override', 'exception', 'reason'],
        page: 12,
        text: 'Any tolerance override must carry a written reason naming the counterparty agreement it relies on. Overrides are reviewed monthly.',
      },
      {
        topics: ['duplicate', 'payment', 'twice'],
        page: 22,
        text: 'Duplicate payment is the single largest leakage risk. Detection runs across all entities, and a suspected duplicate is never paid pending written confirmation.',
      },
    ],
  },
  {
    id: 'doc-vendor-handbook',
    name: 'Vendor onboarding handbook.pdf',
    pages: 92,
    kind: 'Handbook',
    indexedAt: at(14),
    origin: 'Mailbox',
    passages: [
      {
        topics: ['onboarding', 'vendor', 'new', 'setup'],
        page: 14,
        text: 'A new vendor needs a signed W-9, banking details verified by callback, and a named business owner before the first PO is raised.',
      },
      {
        topics: ['tax', 'vat', 'wht', 'withholding', '1099'],
        page: 44,
        text: 'US vendors classified as contractors are subject to 1099-NEC reporting. Backup withholding of 24% applies where the TIN is missing or unmatched.',
      },
    ],
  },
];

/**
 * A long sample document, for showing what a big upload does without needing a
 * real 187-page PDF to hand. Marked as a sample wherever it appears, because a
 * real upload of a PDF cannot be read in the browser and this one can.
 */
export function buildUploadedDocument(batch: number): IndexedDocument {
  const variants = [
    {
      name: 'Q3 vendor contract bundle.pdf',
      pages: 187,
      kind: 'Contract' as const,
      passages: [
        {
          topics: ['freight', 'delivery', 'shipping', 'incoterms'],
          page: 63,
          text: 'Freight is DAP destination. Fuel surcharges are recoverable only where quoted on the original PO.',
        },
        {
          topics: ['termination', 'notice', 'exit'],
          page: 121,
          text: 'Either party may terminate for convenience on 90 days written notice. Open POs are honored to completion.',
        },
      ],
    },
    {
      name: 'Group tax memorandum FY26.pdf',
      pages: 156,
      kind: 'Report' as const,
      passages: [
        {
          topics: ['tax', 'nexus', 'sales tax', 'state'],
          page: 29,
          text: 'Economic nexus is established in 14 states. Sales tax is self-assessed where the vendor does not charge it, and coded to use tax.',
        },
      ],
    },
  ];
  const pick = variants[(batch - 1) % variants.length];
  return {
    id: `doc-upload-${batch}`,
    name: pick.name,
    pages: pick.pages,
    kind: pick.kind,
    indexedAt: at(0),
    origin: 'Upload',
    passages: pick.passages,
    contentRead: true,
    isSample: true,
  };
}
