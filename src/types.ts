/**
 * Types for the self-serve prototype. Shaped by the three PRDs:
 * Signup/Onboarding, Workflow (Invoice Processing), and the User Journey.
 */

/* ── Onboarding ───────────────────────────────────────────────────────── */

export type SignupMethod = 'google' | 'password';

/** Which of the four routing paths in Signup PRD §3 the user came in on. */
export type RoutePath = 'first-of-domain' | 'joined' | 'created-own' | 'invited';

export type Screen =
  | 'signup'
  | 'routing'
  | 'profile'
  | 'ask-neo'
  | 'queue'
  | 'invoice'
  | 'config'
  | 'connections'
  | 'members'
  | 'reporting';

export interface DiscoverableWorkspace {
  id: string;
  name: string;
  owner: string;
  members: number;
  autoApprove: boolean;
}

/* ── Workflow ─────────────────────────────────────────────────────────── */

export type Stage = 'extraction' | 'matching' | 'posting';

/** Workflow PRD §3. One status per invoice, following the stage it is in. */
export type InvoiceStatus =
  | 'Extraction'
  | 'Matching'
  | 'ERP posting'
  | 'Action Required'
  | 'Posted'
  | 'Exported'
  | 'Rejected';

export type SourceKind = 'Upload' | 'Mailbox' | 'Sample';

export type CheckState = 'pending' | 'pass' | 'fail' | 'skipped';

/** Where a reference document's values came from. Workflow PRD §4. */
export type RefSource = 'zoho' | 'uploaded' | 'none';

/** The three hard blocks. None overridable. Workflow PRD §1. */
export type HardBlock = 'duplicate' | 'no-po' | 'no-grn';

export interface ExtractedField {
  key: string;
  label: string;
  value: string;
  /**
   * null means the value is structured ground truth from Zoho — no error bars,
   * nothing for the user to check (Workflow PRD §4).
   */
  confidence: number | null;
  acknowledged: boolean;
  mandatory: boolean;
  /** Whether memory is allowed to learn this field (§9 — never per-transaction fields). */
  learnable: boolean;
  /** Set when the user edits the value, so the audit trail can say so. */
  editedFrom?: string;
}

export interface MatchLine {
  id: string;
  description: string;
  invoiceQty: number;
  poQty: number;
  grnQty: number | null;
  invoiceUnitPrice: number;
  poUnitPrice: number;
  invoiceLineTotal: number;
  poLineTotal: number;
  vat: string;
  wht: string;
  gl: string;
}

export interface MetadataFinding {
  field: string;
  invoiceValue: string;
  poValue: string;
  kind: 'vendor' | 'currency' | 'header' | 'total' | 'balance';
  /** Confidence on each side, so a real discrepancy reads apart from a misread. */
  invoiceConfidence: number | null;
  poConfidence: number | null;
}

export interface LineFinding {
  lineId: string;
  description: string;
  field: 'quantity' | 'unitPrice' | 'lineTotal';
  invoiceValue: number;
  poValue: number;
  grnValue: number | null;
  diffVsPo: number;
  diffVsGrn: number | null;
}

export interface DuplicateRef {
  number: string;
  vendor: string;
  date: string;
  processedBy: string;
  /** True when the original sits in a workspace this user cannot see (§7.3). */
  metadataOnly: boolean;
}

export interface MatchResult {
  matchTypeUsed: MatchType;
  ranAt: string;
  duplicate: { state: CheckState; original?: DuplicateRef };
  metadata: { state: CheckState; findings: MetadataFinding[] };
  lineItem: { state: CheckState; findings: LineFinding[] };
  hardBlock: HardBlock | null;
}

export interface AuditEntry {
  at: string;
  actor: string;
  action: string;
  detail?: string;
}

export interface OverrideRecord {
  rule: string;
  reason: string;
  at: string;
  actor: string;
}

export interface Invoice {
  id: string;
  number: string;
  vendor: string;
  legalEntity: string;
  currency: string;
  amount: number;
  invoiceDate: string;
  poNumber: string | null;

  source: SourceKind;
  sourceId: string;
  /** Sample data: excluded from reporting, never posted to a real ERP (§3). */
  isSample: boolean;
  /** Posted by straight-through processing without ever surfacing (§5). */
  stpPosted: boolean;

  stage: Stage;
  status: InvoiceStatus;

  invoiceFields: ExtractedField[];
  poFields: ExtractedField[];
  grnFields: ExtractedField[];
  poSource: RefSource;
  grnSource: RefSource;

  lines: MatchLine[];

  /**
   * The frozen result of the last matching run. Nothing is re-evaluated
   * retroactively (§15.5) — a config change reaches this only on a re-run.
   */
  matchResult: MatchResult | null;

  overrides: OverrideRecord[];
  audit: AuditEntry[];
  rejectReason?: string;
  erpReference?: string;

  ingestedAt: string;
  /** First time it needed the user. Null for anything that never surfaced. */
  firstSurfacedAt: string | null;
  terminalAt: string | null;
}

export interface InvoiceSource {
  id: string;
  kind: SourceKind;
  label: string;
  arrivedAt: string;
  /** Documents that arrived with no invoice among them (§14). */
  heldDocuments: string[];
}

/* ── Configuration ────────────────────────────────────────────────────── */

export type MatchType = '2-way' | '3-way';

export interface WorkflowConfig {
  matchType: MatchType;
  /** Confidence threshold per field, invoice and reference alike. */
  confidenceThreshold: number;
  autoAdvance: boolean;
  straightThrough: boolean;
  totalToleranceAbsolute: number;
  totalTolerancePercent: number;
  lineToleranceAbsolute: number;
  lineTolerancePercent: number;
  matchQuantity: boolean;
  matchUnitPrice: boolean;
  matchLineTotal: boolean;
  vendorFuzzyThreshold: number;
  memoryThreshold: number;
  duplicateKeys: string[];
}

/* ── Connections ──────────────────────────────────────────────────────── */

export interface Connections {
  zohoBooks: boolean;
  zohoInventory: boolean;
  mailboxProvider: 'gmail' | 'outlook' | null;
  mailboxAddress: string;
  mailboxFolder: string;
}

/* ── People ───────────────────────────────────────────────────────────── */

export type WorkflowRole = 'Workflow admin' | 'Reviewer' | 'Agent' | 'None';
export type MemberStatus = 'Active' | 'Suspended' | 'Invite pending';

export interface Member {
  id: string;
  name: string;
  email: string;
  invoiceProcessing: WorkflowRole;
  agenticSearch: WorkflowRole;
  status: MemberStatus;
  lastActive: string;
  isWorkspaceOwner: boolean;
  isTenantOwner: boolean;
}

/* ── Memory ───────────────────────────────────────────────────────────── */

export interface MemoryPattern {
  id: string;
  field: string;
  fieldKey: string;
  patternKey: string;
  suggestedValue: string;
  /** Consecutive identical acknowledgements. At config.memoryThreshold it suggests. */
  streak: number;
  lastSeen: string;
}

/* ── Ask Neo ──────────────────────────────────────────────────────────── */

export interface Citation {
  label: string;
  detail: string;
}

export interface ChatTurn {
  id: string;
  role: 'user' | 'neo';
  text: string;
  citations?: Citation[];
  /** True when Neo declined for want of a grounded source (Journey §2). */
  ungrounded?: boolean;
}
