/**
 * Types for the self-serve prototype. Shaped by the three PRDs:
 * Signup/Onboarding, Workflow (Invoice Processing), and the User Journey.
 */

/* ── Onboarding ───────────────────────────────────────────────────────── */

export type SignupMethod = 'google' | 'password';

/** Which of the four routing paths in Signup PRD §3 the user came in on. */
export type RoutePath = 'first-of-domain' | 'joined' | 'created-own' | 'invited';

/** What the signup form worked out about an address before submitting it. */
export type DomainVerdict =
  /** The domain already has a tenant, so workspaces may be offered. */
  | 'existing-tenant'
  /** Nobody from this domain has signed up, so a tenant gets created. */
  | 'first-of-domain'
  /** A free provider. Never a join key, so it always forms its own tenant. */
  | 'personal-provider';

export type Screen =
  | 'signup'
  | 'routing'
  | 'profile'
  | 'ask-neo'
  | 'queue'
  | 'invoice'
  /** Workflow-level: match type, tolerances, thresholds, memory. */
  | 'workflow-config'
  /** Workspace-level: integrations, and who can join. */
  | 'workspace-config'
  | 'members'
  | 'reporting'
  /** Product documentation. The same for every workspace, so it sits outside them. */
  | 'documentation';

/**
 * Who can join a workspace. Public by default, so a colleague who signs up
 * lands somewhere useful instead of stalling. Private is the setting managed
 * tenants run on (Signup PRD §10).
 */
export type WorkspaceVisibility = 'public' | 'approval' | 'private';

export interface DiscoverableWorkspace {
  id: string;
  name: string;
  owner: string;
  members: number;
  visibility: WorkspaceVisibility;
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

/** How an uploaded file is read. Guessed from the filename, changeable by hand. */
export type DocumentKind = 'invoice' | 'po' | 'grn' | 'tax' | 'supporting';

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
  mandatory: boolean;
  /** Whether memory is allowed to learn this field (§9 — never per-transaction fields). */
  learnable: boolean;
  /** Set when the user edits the value, so the audit trail can say so. */
  editedFrom?: string;
  /** The purchase order's value for the same field, for the comparison view. */
  poValue?: string;
  /**
   * Where on the document this value was read from, as percentages of the page.
   * Clicking the field takes the reader to it and shows the confidence there,
   * beside the evidence, rather than on the field itself.
   */
  region?: { page: number; x: number; y: number; w: number; h: number };
  /**
   * Set where the value is not on the document at all and was worked out from
   * something else — a currency taken from the bill-to country, say. There is
   * nothing to highlight and nothing was read, so it is put to the user as a
   * suggestion rather than presented as a reading.
   */
  inferred?: { because: string };
}

/** How a line came out of matching, for the dot on its row. */
export type LineMatchState = 'matched' | 'warning' | 'failed' | 'unchecked';

/** A line on the GRN side of the comparison. */
export interface GrnLine {
  id: string;
  poNo: string;
  grnNo: string;
  description: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  /** Which invoice line it was matched to, if any. */
  matchedTo: string | null;
}

/** The payload written to the ERP, as the posting screen shows it. */
export interface ErpPayload {
  poNumber: string;
  amountBeforeVat: number;
  totalAfterVat: number;
  referenceNumber: string;
  text: string;
  refKeyHead1: string;
  refKeyHead2: string;
  assignment: string;
  docHeader: string;
  refKey2: string;
  variance: number;
  /**
   * What the ERP said when the payload was dry-run. The GL account per line is
   * derived by the ERP from the purchase order, so it comes back from here
   * rather than being picked on the line.
   */
  simulated: {
    at: string;
    ok: boolean;
    message: string;
    lines: { lineId: string; description: string; gl: string; taxAmount: number }[];
  } | null;
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
  /** Item number as it reads on the invoice. */
  itemNo: string;
  /** Where this line ended up, for the dot on its row. */
  state: LineMatchState;
  /**
   * How clearly the line was read off the document. A line is read like any
   * other value, so it carries a score like any other value.
   */
  confidence: number;
  /**
   * The deliveries the line actually arrived on. A quantity rarely turns up in
   * one drop, so a single invoice line is satisfied by several goods receipts
   * booked on different days and sometimes against different purchase orders.
   * Absent means the whole received quantity came on one receipt.
   */
  receipts?: { grnNo: string; qty: number; poNo?: string }[];
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
  /** The GRN side of the line comparison. */
  grnLines: GrnLine[];
  /** The ERP payload, shown and edited on the posting stage. */
  erp: ErpPayload;

  /**
   * Documents attached to the invoice that are not matching inputs: tax
   * documents including Faktur Pajak, delivery notes, approval mail. Stored and
   * carried to posting, never validated (Workflow PRD §3, §14).
   */
  attachments: { name: string; kind: 'Tax document' | 'Supporting document' }[];

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
  /**
   * What the workspace expects to post in a month. Reporting reads coverage
   * against it, pro-rated to whatever window is on screen — so the target is
   * the workspace's own number rather than one reporting made up.
   */
  monthlyPostingTarget: number;
  /**
   * Minutes an invoice took before this workflow existed. Every SLA figure is
   * read against it: a percentile means nothing without the thing it beat.
   */
  manualBaselineMinutes: number;
}

/* ── Connections ──────────────────────────────────────────────────────── */

export interface Connections {
  zohoBooks: boolean;
  zohoInventory: boolean;
  mailboxProvider: 'gmail' | 'outlook' | null;
  mailboxAddress: string;
  mailboxFolder: string;
  /** Ticketing, where invoices arrive as tickets rather than mail. */
  ticketing: 'freshdesk' | 'zendesk' | null;
}

/* ── People ───────────────────────────────────────────────────────────── */

export type WorkflowRole = 'Workflow admin' | 'Reviewer' | 'Agent' | 'None';
export type MemberStatus = 'Active' | 'Suspended' | 'Invite pending';

export interface Member {
  id: string;
  name: string;
  email: string;
  invoiceProcessing: WorkflowRole;
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
  /** Consecutive identical codings. At config.memoryThreshold it suggests. */
  streak: number;
  lastSeen: string;
}

/* ── Ask Neo ──────────────────────────────────────────────────────────── */

/**
 * A document the user has indexed. Page counts are large on purpose: taking a
 * 200-page contract is the capability being exposed here, where general
 * assistants cap out around thirty.
 */
export interface IndexedDocument {
  id: string;
  name: string;
  pages: number;
  kind: 'Contract' | 'Policy' | 'Handbook' | 'Report';
  indexedAt: string;
  /** Where it came from, for the grounding summary. */
  origin: 'Upload' | 'Mailbox' | 'Workflow';
  /** Passages an answer can quote back with a page reference. */
  passages: { topics: string[]; page: number; text: string }[];
  /** Set for a file that came off disk. */
  sizeBytes?: number;
  /**
   * False for a file whose text this prototype could not reach. It is held and
   * counted, but has no passages, so nothing is quoted from it.
   */
  contentRead?: boolean;
  /** Set for a long document added to demonstrate the capability, not uploaded. */
  isSample?: boolean;
}

/** What Ask Neo is allowed to reach on a given surface. */
export type NeoScope = 'workspace' | 'workflow';

/** A source Ask Neo can ground an answer in, for the summary on the page. */
/** The workflows a workspace can run. Membership is per person, per workflow. */
export type WorkflowKey = 'invoiceProcessing';

/**
 * What a question may be answered from.
 *
 * A workflow, or the documents you attached by hand. Connected systems are not
 * on this list on purpose: an ERP or a mailbox is reached through the workflow
 * that ingests from it, so it is not a source you pick separately.
 */
export type SourceId = `workflow:${WorkflowKey}` | 'uploads';

export interface GroundingSource {
  id: SourceId;
  label: string;
  detail: string;
  connected: boolean;
  /**
   * False when this person cannot reach the source at all — a workflow they hold
   * no role in. An unavailable source is not offered, rather than offered and
   * refused.
   */
  available: boolean;
}

export interface Citation {
  label: string;
  detail: string;
}

/**
 * One conversation with Neo, kept after it ends.
 *
 * The title is the question that started it, which is what a person recognizes
 * a conversation by. Turns are stored whole so reopening one shows the answers
 * as they were given, rather than re-asking and getting today's data.
 */
export interface Conversation {
  id: string;
  title: string;
  turns: ChatTurn[];
  startedAt: string;
  lastAt: string;
}

export interface ChatTurn {
  id: string;
  role: 'user' | 'neo';
  text: string;
  citations?: Citation[];
  /** True when Neo declined for want of a grounded source (Journey §2). */
  ungrounded?: boolean;
  /** True when the surface cannot reach far enough, and the page can. */
  outOfScope?: boolean;
  /**
   * True when a source that could have answered is switched off. Distinct from
   * ungrounded: the material exists, the selection excludes it.
   */
  sourceOff?: boolean;
  /** Which switch puts it back, so the notice names the right one. */
  remedy?: 'source' | 'document';
}
