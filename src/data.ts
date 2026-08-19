/**
 * Every piece of sample data in the prototype lives here, so changing what is
 * on screen never means opening a component.
 *
 * Country: United States. Tax and GL codes, vendors, currency and document
 * formats are all the US set (Workflow PRD §3, §8).
 */

import type {
  Connections,
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

export const TODAY = '2026-08-19';

export const SIGNED_IN = {
  firstName: 'Shubham',
  lastName: 'Shrivastava',
  email: 'shubham.s@neoflo.ai',
  initials: 'SS',
};

export const TENANT_NAME = 'Neoflo';
export const LEGAL_ENTITY = 'Neoflo Inc.';

/** Where the user last visited, for the returning-visit briefing (Journey §2). */
export const LAST_VISIT = '18 Aug 2026, 17:40';

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
  { id: 'ws-finance', name: 'Finance', owner: 'Vibhor Sharma', members: 6, autoApprove: true },
  { id: 'ws-ap-emea', name: 'AP — EMEA', owner: 'Kaustav Dutta', members: 3, autoApprove: false },
  { id: 'ws-procurement', name: 'Procurement', owner: 'Hemshankar Rao', members: 4, autoApprove: true },
];

/* ── Tax and GL code lists (US) ───────────────────────────────────────── */

export const VAT_CODES = [
  'US-EXEMPT',
  'US-CA-SALES-7.25',
  'US-NY-SALES-8.875',
  'US-WA-SALES-10.25',
  'US-USE-TAX',
];

export const WHT_CODES = ['US-NONE', 'US-1099-NEC', 'US-BACKUP-24'];

export const GL_CODES = [
  '5010 — Cost of goods sold',
  '6200 — Office supplies',
  '6400 — IT and software',
  '6500 — Repairs and maintenance',
  '7100 — Freight and delivery',
  '7400 — Printing and marketing',
];

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
};

/* ── Members ──────────────────────────────────────────────────────────── */

export const MEMBERS: Member[] = [
  {
    id: 'm-1',
    name: 'Shubham Shrivastava',
    email: 'shubham.s@neoflo.ai',
    invoiceProcessing: 'Workflow admin',
    agenticSearch: 'Workflow admin',
    status: 'Active',
    lastActive: 'Just now',
    isWorkspaceOwner: true,
    isTenantOwner: true,
  },
  {
    id: 'm-2',
    name: 'Kaustav Dutta',
    email: 'kaustav.d@neoflo.ai',
    invoiceProcessing: 'Reviewer',
    agenticSearch: 'Agent',
    status: 'Active',
    lastActive: '2 hours ago',
    isWorkspaceOwner: false,
    isTenantOwner: false,
  },
  {
    id: 'm-3',
    name: 'Hemshankar Rao',
    email: 'hem.r@neoflo.ai',
    invoiceProcessing: 'Agent',
    agenticSearch: 'Agent',
    status: 'Active',
    lastActive: 'Yesterday',
    isWorkspaceOwner: false,
    isTenantOwner: false,
  },
  {
    id: 'm-4',
    name: 'Sundip Menon',
    email: 'sundip.m@neoflo.ai',
    invoiceProcessing: 'Reviewer',
    agenticSearch: 'None',
    status: 'Suspended',
    lastActive: '9 days ago',
    isWorkspaceOwner: false,
    isTenantOwner: false,
  },
  {
    id: 'm-5',
    name: 'vibs@neoflo.ai',
    email: 'vibs@neoflo.ai',
    invoiceProcessing: 'Agent',
    agenticSearch: 'Agent',
    status: 'Invite pending',
    lastActive: 'Invited 3 days ago',
    isWorkspaceOwner: false,
    isTenantOwner: false,
  },
];

/* ── Memory ───────────────────────────────────────────────────────────── */

/**
 * Two patterns sit at a streak of 2. The threshold is 3, so the next
 * acknowledgement of either forms a memory in front of you — which is the
 * only way to see §9 happen inside one sitting.
 */
export const MEMORY_PATTERNS: MemoryPattern[] = [
  {
    id: 'mem-1',
    field: 'GL code',
    fieldKey: 'gl',
    patternKey: 'Redwood Office Supply · office consumables',
    suggestedValue: '6200 — Office supplies',
    streak: 2,
    lastSeen: '13 Aug 2026',
  },
  {
    id: 'mem-2',
    field: 'VAT code',
    fieldKey: 'vat',
    patternKey: 'Cascade Industrial Parts · all lines',
    suggestedValue: 'US-CA-SALES-7.25',
    streak: 2,
    lastSeen: '12 Aug 2026',
  },
  {
    id: 'mem-3',
    field: 'Vendor mapping',
    fieldKey: 'vendor',
    patternKey: 'REDWOOD OFFICE SUPPLY CO → Redwood Office Supply',
    suggestedValue: 'Redwood Office Supply',
    streak: 4,
    lastSeen: '11 Aug 2026',
  },
];

/* ── Field builders ───────────────────────────────────────────────────── */

function field(
  key: string,
  label: string,
  value: string,
  confidence: number | null,
  mandatory = true,
  learnable = false,
): ExtractedField {
  return { key, label, value, confidence, acknowledged: false, mandatory, learnable };
}

/** The standard invoice set (Workflow PRD §5). `conf` overrides per field. */
function invoiceFields(
  values: {
    number: string;
    date: string;
    vendor: string;
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
): ExtractedField[] {
  const c = (k: string) => conf[k] ?? base;
  return [
    field('number', 'Invoice number', values.number, c('number')),
    field('date', 'Invoice date', values.date, c('date')),
    field('vendor', 'Vendor name', values.vendor, c('vendor'), true, true),
    field('po', 'PO number', values.po ?? '—', c('po')),
    field('currency', 'Currency', values.currency, c('currency')),
    field('subtotal', 'Subtotal', values.subtotal, c('subtotal')),
    field('tax', 'Tax', values.tax, c('tax')),
    field('total', 'Total', values.total, c('total')),
    field('taxCode', 'Tax code', values.taxCode ?? 'US-EXEMPT', c('taxCode'), false, true),
    field('terms', 'Payment terms', values.terms ?? 'Net 30', c('terms'), false, true),
    field('remitTo', 'Remit-to address', values.remitTo ?? '—', c('remitTo'), false, false),
  ];
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
): MatchLine {
  const poUnit = poUnitPrice ?? unitPrice;
  return {
    id,
    description,
    invoiceQty,
    poQty,
    grnQty,
    invoiceUnitPrice: unitPrice,
    poUnitPrice: poUnit,
    invoiceLineTotal: Number((invoiceQty * unitPrice).toFixed(2)),
    poLineTotal: Number((poQty * poUnit).toFixed(2)),
    vat,
    wht,
    gl,
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
    arrivedAt: '18 Aug 2026, 08:12',
    heldDocuments: [],
  },
  {
    id: 'src-upload-1',
    kind: 'Upload',
    label: 'august-batch.zip · 9 documents',
    arrivedAt: '17 Aug 2026, 14:03',
    heldDocuments: ['PO-US-91004.pdf'],
  },
  {
    id: 'src-mail-2',
    kind: 'Mailbox',
    label: 'ap@neoflo.ai · Invoices/Inbound · "Statement — no attachment"',
    arrivedAt: '16 Aug 2026, 11:47',
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
export const INITIAL_INVOICES: Invoice[] = [
  /* Low-confidence extraction. A poor scan, still usable. */
  {
    id: 'inv-77120',
    number: 'INV-77120',
    vendor: 'Sierra Networks',
    legalEntity: LEGAL_ENTITY,
    currency: 'USD',
    amount: 3940.24,
    invoiceDate: '18 Aug 2026',
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
        date: '18 Aug 2026',
        vendor: 'Sierra Netwoks',
        po: 'PO-US-77004',
        currency: 'USD',
        subtotal: '3,940.24',
        tax: '0.00',
        total: '3,940.24',
        remitTo: '1188 Alder Way, Bellevue WA 98004',
        taxCode: 'US-WA-SALES-10.25',
      },
      { number: 61, total: 68, vendor: 74, date: 79 },
    ),
    poFields: poFields(
      { number: 'PO-US-77004', vendor: 'Sierra Networks', currency: 'USD', total: '3,940.24' },
      'zoho',
    ),
    grnFields: [],
    poSource: 'zoho',
    grnSource: 'none',
    lines: [
      line('l1', 'Network switches — 48 port', 4, 4, null, 720.0, '6400 — IT and software'),
      line('l2', 'Install labour', 8, 8, null, 132.53, '6400 — IT and software'),
    ],
    matchResult: null,
    overrides: [],
    audit: [
      audit('18 Aug 2026, 08:12', 'Ingested', 'Mailbox · Invoices/Inbound'),
      audit('18 Aug 2026, 08:12', 'Extraction started'),
      audit('18 Aug 2026, 08:13', 'Surfaced as Action Required', '4 fields below the 85% threshold'),
    ],
    ingestedAt: '18 Aug 2026, 08:12',
    firstSurfacedAt: '18 Aug 2026, 08:13',
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
    invoiceDate: '17 Aug 2026',
    poNumber: 'PO-US-88213',
    source: 'Mailbox',
    sourceId: 'src-mail-1',
    isSample: false,
    stpPosted: false,
    stage: 'matching',
    status: 'Action Required',
    invoiceFields: invoiceFields({
      number: 'INV-88213',
      date: '17 Aug 2026',
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
      line('l1', 'Freight — inbound, August', 1, 1, null, 5400.0, '7100 — Freight and delivery'),
      line('l2', 'Fuel surcharge', 1, 1, null, 1815.6, '7100 — Freight and delivery'),
    ],
    matchResult: {
      matchTypeUsed: '3-way',
      ranAt: '17 Aug 2026, 09:20',
      duplicate: { state: 'pass' },
      metadata: { state: 'pending', findings: [] },
      lineItem: { state: 'pending', findings: [] },
      hardBlock: 'no-grn',
    },
    overrides: [],
    audit: [
      audit('17 Aug 2026, 09:19', 'Ingested', 'Mailbox · Invoices/Inbound'),
      audit('17 Aug 2026, 09:20', 'Extraction complete', 'Every mandatory field cleared its threshold'),
      audit('17 Aug 2026, 09:20', 'Auto-advanced to matching'),
      audit('17 Aug 2026, 09:20', 'Hard block', 'No GRN, and the match type is 3-way'),
    ],
    ingestedAt: '17 Aug 2026, 09:19',
    firstSurfacedAt: '17 Aug 2026, 09:20',
    terminalAt: null,
  },

  /* Invoice exceeds the PO balance. Overridable with a reason — not a hard block. */
  {
    id: 'inv-44320',
    number: 'INV-44320',
    vendor: 'Cascade Industrial Parts',
    legalEntity: LEGAL_ENTITY,
    currency: 'USD',
    amount: 21900.0,
    invoiceDate: '12 Aug 2026',
    poNumber: 'PO-US-44320',
    source: 'Upload',
    sourceId: 'src-upload-1',
    isSample: false,
    stpPosted: false,
    stage: 'matching',
    status: 'Action Required',
    invoiceFields: invoiceFields({
      number: 'INV-44320',
      date: '12 Aug 2026',
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
      { number: 'GRN-US-44320', poRef: 'PO-US-44320', receiptDate: '11 Aug 2026' },
      'uploaded',
    ),
    poSource: 'zoho',
    grnSource: 'uploaded',
    lines: [line('l1', 'Conveyor belting — 600mm', 300, 300, 300, 73.0, '6500 — Repairs and maintenance', 'US-CA-SALES-7.25')],
    matchResult: {
      matchTypeUsed: '3-way',
      ranAt: '12 Aug 2026, 16:41',
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
      audit('12 Aug 2026, 16:40', 'Ingested', 'Upload · august-batch.zip'),
      audit('12 Aug 2026, 16:41', 'Extraction complete'),
      audit('12 Aug 2026, 16:41', 'Matching run', 'Duplicate passed. Line item passed. Metadata failed.'),
      audit('12 Aug 2026, 16:41', 'Surfaced as Action Required', 'Invoice exceeds the remaining PO balance by 4,900.00'),
    ],
    ingestedAt: '12 Aug 2026, 16:40',
    firstSurfacedAt: '12 Aug 2026, 16:41',
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
    invoiceDate: '11 Aug 2026',
    poNumber: 'PO-US-66004',
    source: 'Mailbox',
    sourceId: 'src-mail-1',
    isSample: false,
    stpPosted: true,
    stage: 'posting',
    status: 'Posted',
    invoiceFields: invoiceFields({
      number: 'INV-66004',
      date: '11 Aug 2026',
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
      { number: 'GRN-US-66004', poRef: 'PO-US-66004', receiptDate: '10 Aug 2026' },
      'uploaded',
    ),
    poSource: 'zoho',
    grnSource: 'uploaded',
    lines: [line('l1', 'Filing cabinets — 4 drawer', 4, 4, 4, 545.0, '6200 — Office supplies')],
    matchResult: {
      matchTypeUsed: '3-way',
      ranAt: '11 Aug 2026, 07:02',
      duplicate: { state: 'pass' },
      metadata: { state: 'pass', findings: [] },
      lineItem: { state: 'pass', findings: [] },
      hardBlock: null,
    },
    overrides: [],
    audit: [
      audit('11 Aug 2026, 07:01', 'Ingested', 'Mailbox · Invoices/Inbound'),
      audit('11 Aug 2026, 07:02', 'Extraction complete', 'Every field cleared its threshold'),
      audit('11 Aug 2026, 07:02', 'Matching run', 'All three checks passed'),
      audit('11 Aug 2026, 07:02', 'Posted by straight-through processing', 'Never surfaced to a user. Zoho Books ZB-BILL-10442'),
    ],
    erpReference: 'ZB-BILL-10442',
    ingestedAt: '11 Aug 2026, 07:01',
    firstSurfacedAt: null,
    terminalAt: '11 Aug 2026, 07:02',
  },

  /* Surfaced, worked by a person, posted. Gives touch time something to measure. */
  {
    id: 'inv-33128',
    number: 'INV-33128',
    vendor: 'Redwood Office Supply',
    legalEntity: LEGAL_ENTITY,
    currency: 'USD',
    amount: 9340.0,
    invoiceDate: '13 Aug 2026',
    poNumber: 'PO-US-33128',
    source: 'Upload',
    sourceId: 'src-upload-1',
    isSample: false,
    stpPosted: false,
    stage: 'posting',
    status: 'Posted',
    invoiceFields: invoiceFields({
      number: 'INV-33128',
      date: '13 Aug 2026',
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
      { number: 'GRN-US-33128', poRef: 'PO-US-33128', receiptDate: '12 Aug 2026' },
      'uploaded',
    ),
    poSource: 'zoho',
    grnSource: 'uploaded',
    lines: [
      line('l1', 'Printer paper — A4 80gsm', 100, 100, 100, 58.0, '6200 — Office supplies'),
      line('l2', 'Labels — thermal 4x6', 60, 60, 60, 59.0, '6200 — Office supplies'),
    ],
    matchResult: {
      matchTypeUsed: '3-way',
      ranAt: '13 Aug 2026, 10:26',
      duplicate: { state: 'pass' },
      metadata: { state: 'pass', findings: [] },
      lineItem: { state: 'pass', findings: [] },
      hardBlock: null,
    },
    overrides: [
      {
        rule: 'Line item — quantity',
        reason: 'Short shipment agreed with the vendor; remaining 4 cartons cancelled on the PO.',
        at: '13 Aug 2026, 10:31',
        actor: 'Kaustav Dutta',
      },
    ],
    audit: [
      audit('13 Aug 2026, 10:24', 'Ingested', 'Upload · august-batch.zip'),
      audit('13 Aug 2026, 10:25', 'Extraction complete'),
      audit('13 Aug 2026, 10:26', 'Matching run', 'Line item failed on quantity'),
      audit('13 Aug 2026, 10:31', 'Override recorded', 'Line item — quantity. Reason given.', 'Kaustav Dutta'),
      audit('13 Aug 2026, 10:33', 'Posted to Zoho Books', 'ZB-BILL-10488', 'Kaustav Dutta'),
    ],
    erpReference: 'ZB-BILL-10488',
    ingestedAt: '13 Aug 2026, 10:24',
    firstSurfacedAt: '13 Aug 2026, 10:26',
    terminalAt: '13 Aug 2026, 10:33',
  },

  /* Terminal at Exported — downloaded before Zoho was connected. */
  {
    id: 'inv-55891',
    number: 'INV-55891',
    vendor: 'Bayline Freight',
    legalEntity: LEGAL_ENTITY,
    currency: 'USD',
    amount: 5602.4,
    invoiceDate: '06 Aug 2026',
    poNumber: 'PO-US-55891',
    source: 'Upload',
    sourceId: 'src-upload-1',
    isSample: false,
    stpPosted: false,
    stage: 'posting',
    status: 'Exported',
    invoiceFields: invoiceFields({
      number: 'INV-55891',
      date: '06 Aug 2026',
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
      { number: 'GRN-US-55891', poRef: 'PO-US-55891', receiptDate: '05 Aug 2026' },
      'uploaded',
    ),
    poSource: 'uploaded',
    grnSource: 'uploaded',
    lines: [line('l1', 'Ocean freight — FCL 40ft', 1, 1, 1, 5602.4, '7100 — Freight and delivery')],
    matchResult: {
      matchTypeUsed: '3-way',
      ranAt: '06 Aug 2026, 13:10',
      duplicate: { state: 'pass' },
      metadata: { state: 'pass', findings: [] },
      lineItem: { state: 'pass', findings: [] },
      hardBlock: null,
    },
    overrides: [],
    audit: [
      audit('06 Aug 2026, 13:08', 'Ingested', 'Upload · august-batch.zip'),
      audit('06 Aug 2026, 13:09', 'Extraction complete', 'PO and GRN read from uploaded documents'),
      audit('06 Aug 2026, 13:10', 'Matching run', 'All three checks passed'),
      audit('06 Aug 2026, 13:14', 'Exported', 'Matched-data CSV downloaded. No ERP connected at the time.', 'Shubham Shrivastava'),
    ],
    ingestedAt: '06 Aug 2026, 13:08',
    firstSurfacedAt: '06 Aug 2026, 13:10',
    terminalAt: '06 Aug 2026, 13:14',
  },

  /* Closed by a person, with the reason on the record. */
  {
    id: 'inv-22016',
    number: 'INV-22016',
    vendor: 'Harbor Print Co',
    legalEntity: LEGAL_ENTITY,
    currency: 'USD',
    amount: 1120.0,
    invoiceDate: '10 Aug 2026',
    poNumber: 'PO-US-22016',
    source: 'Mailbox',
    sourceId: 'src-mail-2',
    isSample: false,
    stpPosted: false,
    stage: 'matching',
    status: 'Rejected',
    invoiceFields: invoiceFields({
      number: 'INV-22016',
      date: '10 Aug 2026',
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
    lines: [line('l1', 'Brochures — A5 gloss, 5000', 5000, 5000, null, 0.224, '7400 — Printing and marketing', 'US-CA-SALES-7.25')],
    matchResult: {
      matchTypeUsed: '3-way',
      ranAt: '10 Aug 2026, 15:02',
      duplicate: {
        state: 'fail',
        original: {
          number: 'INV-22016',
          vendor: 'Harbor Print Co',
          date: '10 Aug 2026',
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
      audit('10 Aug 2026, 15:01', 'Ingested', 'Mailbox · Invoices/Inbound'),
      audit('10 Aug 2026, 15:02', 'Matching run', 'Duplicate hit. Metadata and line item skipped.'),
      audit('10 Aug 2026, 15:44', 'Rejected', 'Already processed in AP — EMEA. Vendor re-sent in error.', 'Shubham Shrivastava'),
    ],
    rejectReason: 'Already processed in AP — EMEA. Vendor re-sent in error.',
    ingestedAt: '10 Aug 2026, 15:01',
    firstSurfacedAt: '10 Aug 2026, 15:02',
    terminalAt: '10 Aug 2026, 15:44',
  },
];

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
  const at = '19 Aug 2026, 09:00';

  const cleanLines = [
    line('l1', 'Copy paper — A4 80gsm, carton of 5', 40, 40, 40, 62.0, '6200 — Office supplies'),
    line('l2', 'Toner cartridge — mono, high yield', 25, 25, 25, 240.0, '6200 — Office supplies'),
    line('l3', 'Task chair — mesh back', 8, 8, 8, 500.0, '6200 — Office supplies'),
  ];

  const clean: Invoice = {
    id: `sample-clean${suffix}`,
    number: `INV-2026-4417${suffix}`,
    vendor: 'Redwood Office Supply',
    legalEntity: LEGAL_ENTITY,
    currency: 'USD',
    amount: 12480.0,
    invoiceDate: '14 Aug 2026',
    poNumber: `PO-US-88214${suffix}`,
    source: 'Sample',
    sourceId: `src-sample${suffix}`,
    isSample: true,
    stpPosted: false,
    stage: 'extraction',
    status: 'Extraction',
    invoiceFields: invoiceFields({
      number: `INV-2026-4417${suffix}`,
      date: '14 Aug 2026',
      vendor: 'Redwood Office Supply',
      po: `PO-US-88214${suffix}`,
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
      { number: `GRN-US-53301${suffix}`, poRef: `PO-US-88214${suffix}`, receiptDate: '13 Aug 2026' },
      'uploaded',
    ),
    poSource: 'uploaded',
    grnSource: 'uploaded',
    lines: cleanLines,
    matchResult: null,
    overrides: [],
    audit: [
      audit(at, 'Ingested', 'Pre-computed sample set · United States'),
      audit(at, 'Extraction complete', 'Invoice, PO and GRN all read. Every field cleared its threshold.'),
      audit(at, 'Held at extraction', 'Sample invoices show every stage rather than auto-advancing.'),
    ],
    ingestedAt: at,
    firstSurfacedAt: at,
    terminalAt: null,
  };

  const variance: Invoice = {
    id: `sample-variance${suffix}`,
    number: `INV-2026-4418${suffix}`,
    vendor: 'Cascade Industrial Parts',
    legalEntity: LEGAL_ENTITY,
    currency: 'USD',
    amount: 18639.0,
    invoiceDate: '15 Aug 2026',
    poNumber: `PO-US-88301${suffix}`,
    source: 'Sample',
    sourceId: `src-sample${suffix}`,
    isSample: true,
    stpPosted: false,
    stage: 'extraction',
    status: 'Extraction',
    invoiceFields: invoiceFields({
      number: `INV-2026-4418${suffix}`,
      date: '15 Aug 2026',
      vendor: 'Cascade Industrial Parts',
      po: `PO-US-88301${suffix}`,
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
      { number: `GRN-US-53302${suffix}`, poRef: `PO-US-88301${suffix}`, receiptDate: '14 Aug 2026' },
      'uploaded',
    ),
    poSource: 'uploaded',
    grnSource: 'uploaded',
    lines: [
      line('l1', 'Hex bolt M12 — zinc, box of 100', 500, 500, 500, 1.85, '6500 — Repairs and maintenance', 'US-CA-SALES-7.25'),
      // Invoiced 120, ordered and received 100. The deliberate variance.
      line('l2', 'Bearing assembly — 6205-2RS', 120, 100, 100, 142.5, '6500 — Repairs and maintenance', 'US-CA-SALES-7.25'),
      line('l3', 'Gasket — nitrile, 80mm', 200, 200, 200, 3.07, '6500 — Repairs and maintenance', 'US-CA-SALES-7.25'),
    ],
    matchResult: null,
    overrides: [],
    audit: [
      audit(at, 'Ingested', 'Pre-computed sample set · United States'),
      audit(at, 'Extraction complete', 'Invoice, PO and GRN all read.'),
      audit(at, 'Held at extraction', 'Sample invoices show every stage rather than auto-advancing.'),
    ],
    ingestedAt: at,
    firstSurfacedAt: at,
    terminalAt: null,
  };

  /* Same number, vendor and legal entity as the clean one — so the duplicate
     check finds it against the sample that arrived a moment earlier. */
  const duplicate: Invoice = {
    ...clean,
    id: `sample-duplicate${suffix}`,
    invoiceDate: '14 Aug 2026',
    sourceId: `src-sample${suffix}`,
    audit: [
      audit(at, 'Ingested', 'Pre-computed sample set · United States'),
      audit(at, 'Extraction complete', 'Same invoice number, vendor and legal entity as the first sample.'),
      audit(at, 'Held at extraction', 'Sample invoices show every stage rather than auto-advancing.'),
    ],
    invoiceFields: invoiceFields({
      number: `INV-2026-4417${suffix}`,
      date: '14 Aug 2026',
      vendor: 'Redwood Office Supply',
      po: `PO-US-88214${suffix}`,
      currency: 'USD',
      subtotal: '12,480.00',
      tax: '0.00',
      total: '12,480.00',
      remitTo: '18 Cedar St, Sacramento CA 95814',
    }),
    lines: cleanLines.map((l) => ({ ...l })),
  };

  return [clean, variance, duplicate];
}

/** An uploaded invoice, for the queue's Upload action. */
export function buildUpload(batch: number): Invoice {
  const at = stampNow();
  const n = 91000 + batch;
  return {
    id: `inv-upload-${n}`,
    number: `INV-${n}`,
    vendor: 'Redwood Office Supply',
    legalEntity: LEGAL_ENTITY,
    currency: 'USD',
    amount: 4265.0,
    invoiceDate: '19 Aug 2026',
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
        date: '19 Aug 2026',
        vendor: 'REDWOOD OFFICE SUPPLY CO',
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
      { number: 'GRN-US-91004', poRef: 'PO-US-91004', receiptDate: '18 Aug 2026' },
      'uploaded',
    ),
    poSource: 'uploaded',
    grnSource: 'uploaded',
    lines: [
      line('l1', 'Copy paper — A4 80gsm, carton of 5', 35, 35, 35, 62.0, '', 'US-EXEMPT'),
      line('l2', 'Whiteboard marker — assorted, box of 12', 45, 45, 45, 45.0, '', 'US-EXEMPT'),
    ],
    matchResult: null,
    overrides: [],
    audit: [
      audit(at, 'Ingested', 'Upload · invoice + PO + GRN'),
      audit(at, 'Extraction started'),
      audit(at, 'Surfaced as Action Required', '3 fields below the threshold'),
    ],
    ingestedAt: at,
    firstSurfacedAt: at,
    terminalAt: null,
  };
}

function stampNow(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `19 Aug 2026, ${hh}:${mm}`;
}
