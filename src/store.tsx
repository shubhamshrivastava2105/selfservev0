/**
 * One store for the whole prototype, held in React state.
 *
 * Nothing is persisted on purpose: a prototype that remembers the last person
 * who used it cannot be reset before the next demo.
 */

import * as React from 'react';
import {
  DEFAULT_CONFIG,
  DEFAULT_CONNECTIONS,
  DISCOVERABLE_WORKSPACES,
  INDEXED_DOCUMENTS,
  INITIAL_INVOICES,
  LEGAL_ENTITY,
  MEMBERS,
  MEMORY_PATTERNS,
  PENDING_INVITE,
  SIGNED_IN,
  SOURCES,
  VISIBILITY_COPY,
  buildFromUpload,
  buildSamples,
  buildUpload,
  buildUploadedDocument,
  readDomain,
} from './data';
import { deriveStatus, runMatching, stamp } from './engine';
import { at, formatDate, now } from './clock';
import type { ScenarioId } from './scenarios';
import type {
  AuditEntry,
  ChatTurn,
  Connections,
  DiscoverableWorkspace,
  DocumentKind,
  DomainVerdict,
  IndexedDocument,
  Invoice,
  InvoiceSource,
  Member,
  MemoryPattern,
  RoutePath,
  Screen,
  SignupMethod,
  WorkflowConfig,
  WorkflowRole,
  WorkspaceVisibility,
} from './types';

export type FieldScope = 'invoice' | 'po' | 'grn';

export interface Profile {
  firstName: string;
  lastName: string;
  email: string;
  method: SignupMethod | null;
  /** What the form worked out about the address. */
  domainVerdict: DomainVerdict | null;
  domain: string;
  routePath: RoutePath | null;
  workspaceName: string;
  jobFunction: string;
  country: string;
  /**
   * Set when the user asked to join a workspace whose auto-approve is off. They
   * are working in a provisioned workspace of their own while the request sits
   * with that workspace's owner (Signup PRD §7).
   */
  pendingRequestFor: string | null;
  /** True once the profile screen has been submitted. */
  onboarded: boolean;
}

export interface SessionProgress {
  ingested: boolean;
  /** A sample run and an upload of your own are different steps. */
  sampleRun: boolean;
  uploaded: boolean;
  reviewed: boolean;
  completed: boolean;
  invited: boolean;
  checklistDismissed: boolean;
}

interface Store {
  screen: Screen;
  goTo: (screen: Screen) => void;

  profile: Profile;
  signUp: (method: SignupMethod, firstName: string, lastName: string, email: string) => void;
  /** Routing resolves at authentication (Signup PRD §3), before the profile screen. */
  /** Arriving on an invite link, which skips routing entirely. */
  acceptInvite: (firstName: string, lastName: string, email: string) => void;
  joinWorkspace: (name: string, visibility: WorkspaceVisibility) => void;
  createOwnWorkspace: () => void;
  submitProfile: (jobFunction: string, country: string) => void;

  invoices: Invoice[];
  sources: InvoiceSource[];
  openInvoiceId: string | null;
  openInvoice: (id: string) => void;

  config: WorkflowConfig;
  updateConfig: (patch: Partial<WorkflowConfig>) => void;

  connections: Connections;
  updateConnections: (patch: Partial<Connections>) => void;

  members: Member[];
  memory: MemoryPattern[];

  /** State rather than a constant, so a scenario can make them all private. */
  discoverableWorkspaces: DiscoverableWorkspace[];

  documents: IndexedDocument[];
  addDocument: () => void;
  removeDocument: (id: string) => void;

  /** The last invoice opened, so a return visit can offer to resume it. */
  lastOpenedInvoiceId: string | null;

  /** Demo aid. See scenarios.ts. */
  applyScenario: (id: ScenarioId) => void;

  /** Who can join the workspace you are in. Public by default. */
  workspaceVisibility: WorkspaceVisibility;
  setWorkspaceVisibility: (visibility: WorkspaceVisibility) => void;

  chat: ChatTurn[];
  pushChat: (turns: ChatTurn[]) => void;
  /** Back to the landing state, with the thread cleared. */
  clearChat: () => void;
  /** The Ask Neo panel, which opens over whatever screen you are on. */
  askNeoOpen: boolean;
  askNeoInvoiceId: string | null;
  /** A question the panel could not answer, carried to the full page. */
  handoffQuestion: string | null;
  takeToFullPage: (question: string) => void;
  clearHandoff: () => void;
  openAskNeo: (invoiceId?: string | null) => void;
  closeAskNeo: () => void;
  panelChat: ChatTurn[];
  pushPanelChat: (turns: ChatTurn[]) => void;
  visitedAskNeo: boolean;
  /**
   * Which landing the Ask Neo page should show. Decided when the screen is
   * entered rather than inside the page: the page does not remount on every
   * arrival, so a value it captured once would go stale.
   */
  landingMode: 'first' | 'return';

  activity: AuditEntry[];
  progress: SessionProgress;
  dismissChecklist: () => void;

  /* Invoice actions */
  editField: (id: string, scope: FieldScope, key: string, value: string) => void;
  acknowledgeField: (id: string, scope: FieldScope, key: string) => void;
  acknowledgeAll: (id: string) => void;
  advanceToMatching: (id: string) => void;
  advanceToPosting: (id: string) => void;
  rerunMatching: (id: string) => void;
  recordOverride: (id: string, rule: string, reason: string) => void;
  rejectInvoice: (id: string, reason: string) => void;
  postInvoice: (id: string) => void;
  markExported: (ids: string[]) => void;
  setPoNumber: (id: string, poNumber: string) => void;
  attachReference: (id: string, which: 'po' | 'grn') => void;
  setLineCode: (id: string, lineId: string, field: 'vat' | 'wht' | 'gl', value: string) => void;
  goBackToExtraction: (id: string) => void;

  /* Ingestion */
  runSamples: () => void;
  uploadInvoice: () => void;
  /** Files the user actually chose, classified in the upload dialog. */
  ingestUpload: (files: { name: string; kind: DocumentKind }[]) => void;

  /* People */
  inviteMember: (email: string, invoiceProcessing: WorkflowRole, agenticSearch: WorkflowRole) => void;
  setMemberRole: (id: string, workflow: 'invoiceProcessing' | 'agenticSearch', role: WorkflowRole) => void;
  toggleSuspend: (id: string) => void;
  removeMember: (id: string) => void;
}

const StoreContext = React.createContext<Store | null>(null);

export function useStore(): Store {
  const store = React.useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreen] = React.useState<Screen>('signup');
  const [profile, setProfile] = React.useState<Profile>({
    firstName: '',
    lastName: '',
    email: '',
    method: null,
    domainVerdict: null,
    domain: '',
    routePath: null,
    workspaceName: '',
    jobFunction: '',
    country: 'US',
    pendingRequestFor: null,
    onboarded: false,
  });

  const [invoices, setInvoices] = React.useState<Invoice[]>(INITIAL_INVOICES);
  const [sources, setSources] = React.useState<InvoiceSource[]>(SOURCES);
  const [openInvoiceId, setOpenInvoiceId] = React.useState<string | null>(null);
  const [config, setConfig] = React.useState<WorkflowConfig>(DEFAULT_CONFIG);
  const [connections, setConnections] = React.useState<Connections>(DEFAULT_CONNECTIONS);
  const [members, setMembers] = React.useState<Member[]>(MEMBERS);
  const [memory, setMemory] = React.useState<MemoryPattern[]>(MEMORY_PATTERNS);
  const [workspaceVisibility, setVisibility] = React.useState<WorkspaceVisibility>('public');
  const [chat, setChat] = React.useState<ChatTurn[]>([]);
  const [panelChat, setPanelChat] = React.useState<ChatTurn[]>([]);
  const [askNeoOpen, setAskNeoOpen] = React.useState(false);
  const [askNeoInvoiceId, setAskNeoInvoiceId] = React.useState<string | null>(null);
  const [handoffQuestion, setHandoffQuestion] = React.useState<string | null>(null);
  const [documents, setDocuments] = React.useState<IndexedDocument[]>(INDEXED_DOCUMENTS);
  const [documentBatch, setDocumentBatch] = React.useState(0);
  const [lastOpenedInvoiceId, setLastOpenedInvoiceId] = React.useState<string | null>(null);
  const [discoverableWorkspaces, setDiscoverableWorkspaces] =
    React.useState<DiscoverableWorkspace[]>(DISCOVERABLE_WORKSPACES);
  const [visitedAskNeo, setVisitedAskNeo] = React.useState(false);
  const [landingMode, setLandingMode] = React.useState<'first' | 'return'>('first');
  const [sampleBatch, setSampleBatch] = React.useState(0);
  const [uploadBatch, setUploadBatch] = React.useState(0);
  const [progress, setProgress] = React.useState<SessionProgress>({
    ingested: false,
    sampleRun: false,
    uploaded: false,
    reviewed: false,
    completed: false,
    invited: false,
    checklistDismissed: false,
  });
  const [activity, setActivity] = React.useState<AuditEntry[]>([]);

  const actor = profile.firstName
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : `${SIGNED_IN.firstName} ${SIGNED_IN.lastName}`;

  const log = React.useCallback(
    (action: string, detail?: string) => {
      setActivity((previous) => [{ at: stamp(), actor, action, detail }, ...previous]);
    },
    [actor],
  );

  /** Apply a change to one invoice, then let its status fall out of its data. */
  const patch = React.useCallback(
    (id: string, change: (invoice: Invoice) => Invoice) => {
      setInvoices((previous) =>
        previous.map((invoice) => {
          if (invoice.id !== id) return invoice;
          const next = change(invoice);
          return { ...next, status: deriveStatus(next, config) };
        }),
      );
    },
    [config],
  );

  const appendAudit = (invoice: Invoice, action: string, detail?: string, who = actor): AuditEntry[] => [
    ...invoice.audit,
    { at: stamp(), actor: who, action, detail },
  ];

  /**
   * Navigation. Arriving at Ask Neo decides which landing to show, so the page
   * itself never has to work it out.
   */
  const goTo = React.useCallback(
    (next: Screen) => {
      if (next === 'ask-neo') {
        setLandingMode((previous) => {
          void previous;
          return visitedAskNeo ? 'return' : 'first';
        });
        setVisitedAskNeo(true);
      }
      setScreen(next);
    },
    [visitedAskNeo],
  );

  /* ── Onboarding ─────────────────────────────────────────────────────── */

  const signUp = React.useCallback<Store['signUp']>((method, firstName, lastName, email) => {
    const { verdict, domain } = readDomain(email);

    // A personal address cannot form or join a tenant, because a tenant is keyed
    // on a company domain. The form blocks this before it gets here; refusing
    // again keeps the rule in one place that cannot be bypassed.
    if (verdict === 'personal-provider') return;

    // Only an existing tenant can offer workspaces. The first person from a
    // domain has nothing to be shown: their tenant does not exist until now.

    setProfile((previous) => ({
      ...previous,
      method,
      firstName,
      lastName,
      email,
      domainVerdict: verdict,
      domain,
      routePath: verdict === 'existing-tenant' ? null : 'first-of-domain',
      // Named after the user, and renameable at any time (Signup PRD §4).
      workspaceName: verdict === 'existing-tenant' ? '' : `${firstName}'s workspace`,
      pendingRequestFor: null,
    }));

    if (verdict === 'existing-tenant') {
      // Either a list to choose from, or an honest empty state saying the
      // organization exists but nothing is open to join.
      setScreen('routing');
    } else {
      // Tenant, workspace and membership are created here in one transaction,
      // with no name requested.
      setScreen('profile');
    }
  }, []);

  /** Arriving on an invite link: no routing, and the role comes with it. */
  const acceptInvite = React.useCallback<Store['acceptInvite']>((firstName, lastName, email) => {
    setProfile((previous) => ({
      ...previous,
      method: 'password',
      firstName,
      lastName,
      email,
      domainVerdict: 'existing-tenant',
      domain: (email.split('@')[1] ?? '').toLowerCase(),
      routePath: 'invited',
      workspaceName: PENDING_INVITE.workspaceName,
      pendingRequestFor: null,
    }));
    setScreen('profile');
  }, []);

  const joinWorkspace = React.useCallback<Store['joinWorkspace']>((name, visibility) => {
    const instant = visibility === 'public';
    setProfile((previous) => ({
      ...previous,
      routePath: 'joined',
      // A workspace that needs approval never blocks: one is provisioned now and
      // the request goes to its owner (Signup PRD §7).
      workspaceName: instant ? name : `${previous.firstName}'s workspace`,
      pendingRequestFor: instant ? null : name,
    }));
    setScreen('profile');
  }, []);

  const createOwnWorkspace = React.useCallback<Store['createOwnWorkspace']>(() => {
    setProfile((previous) => ({
      ...previous,
      routePath: 'created-own',
      workspaceName: `${previous.firstName}'s workspace`,
      pendingRequestFor: null,
    }));
    setScreen('profile');
  }, []);

  const submitProfile = React.useCallback<Store['submitProfile']>(
    (jobFunction, country) => {
      setProfile((previous) => ({ ...previous, jobFunction, country, onboarded: true }));
      log('Signed up', `Workspace created. Tenant country set to ${country}.`);
      setLandingMode('first');
      setVisitedAskNeo(true);
      setScreen('ask-neo');
    },
    [log],
  );

  /* ── Fields ─────────────────────────────────────────────────────────── */

  const fieldsFor = (invoice: Invoice, scope: FieldScope) =>
    scope === 'invoice' ? invoice.invoiceFields : scope === 'po' ? invoice.poFields : invoice.grnFields;

  const withFields = (invoice: Invoice, scope: FieldScope, next: Invoice['invoiceFields']): Invoice =>
    scope === 'invoice'
      ? { ...invoice, invoiceFields: next }
      : scope === 'po'
        ? { ...invoice, poFields: next }
        : { ...invoice, grnFields: next };

  const editField = React.useCallback<Store['editField']>(
    (id, scope, key, value) => {
      patch(id, (invoice) => {
        const fields = fieldsFor(invoice, scope);
        const target = fields.find((f) => f.key === key);
        if (!target || target.value === value) return invoice;
        const next = fields.map((f) =>
          f.key === key
            ? {
                ...f,
                value,
                editedFrom: f.editedFrom ?? f.value,
                // A corrected value is verified by a person, so it stops
                // being a low-confidence read.
                confidence: f.confidence === null ? null : 100,
                acknowledged: true,
              }
            : f,
        );
        return {
          ...withFields(invoice, scope, next),
          audit: appendAudit(
            invoice,
            'Field corrected',
            `${target.label}: "${target.value}" → "${value}"`,
          ),
        };
      });
      setProgress((p) => ({ ...p, reviewed: true }));
    },
    [patch, actor],
  );

  const acknowledgeField = React.useCallback<Store['acknowledgeField']>(
    (id, scope, key) => {
      patch(id, (invoice) => {
        const fields = fieldsFor(invoice, scope);
        const target = fields.find((f) => f.key === key);
        if (!target) return invoice;
        const next = fields.map((f) => (f.key === key ? { ...f, acknowledged: true } : f));
        return {
          ...withFields(invoice, scope, next),
          audit: appendAudit(
            invoice,
            'Field acknowledged',
            `${target.label} accepted as read at ${target.confidence}% confidence`,
          ),
        };
      });
      setProgress((p) => ({ ...p, reviewed: true }));
    },
    [patch, actor],
  );

  const acknowledgeAll = React.useCallback<Store['acknowledgeAll']>(
    (id) => {
      patch(id, (invoice) => {
        const ack = (fields: Invoice['invoiceFields']) =>
          fields.map((f) =>
            f.confidence !== null && f.confidence < config.confidenceThreshold && !f.acknowledged
              ? { ...f, acknowledged: true }
              : f,
          );
        const count = [...invoice.invoiceFields, ...invoice.poFields, ...invoice.grnFields].filter(
          (f) => f.confidence !== null && f.confidence < config.confidenceThreshold && !f.acknowledged,
        ).length;
        if (count === 0) return invoice;
        return {
          ...invoice,
          invoiceFields: ack(invoice.invoiceFields),
          poFields: ack(invoice.poFields),
          grnFields: ack(invoice.grnFields),
          audit: appendAudit(invoice, 'Fields acknowledged', `${count} low-confidence fields accepted as read`),
        };
      });
      setProgress((p) => ({ ...p, reviewed: true }));
    },
    [patch, config.confidenceThreshold, actor],
  );

  /* ── Stages ─────────────────────────────────────────────────────────── */

  const runAndStore = React.useCallback(
    (id: string, note: string) => {
      setInvoices((previous) => {
        const target = previous.find((i) => i.id === id);
        if (!target) return previous;
        const result = runMatching(target, config, previous);
        const described = result.hardBlock
          ? `Hard block: ${result.hardBlock}`
          : `Duplicate ${result.duplicate.state}. Metadata ${result.metadata.state}. Line item ${result.lineItem.state}.`;
        return previous.map((invoice) => {
          if (invoice.id !== id) return invoice;
          const next: Invoice = {
            ...invoice,
            stage: 'matching' as const,
            matchResult: result,
            firstSurfacedAt: invoice.firstSurfacedAt ?? stamp(),
            audit: [
              ...invoice.audit,
              { at: stamp(), actor, action: note, detail: described },
            ],
          };
          return { ...next, status: deriveStatus(next, config) };
        });
      });
      setProgress((p) => ({ ...p, reviewed: true }));
    },
    [config, actor],
  );

  const advanceToMatching = React.useCallback<Store['advanceToMatching']>(
    (id) => runAndStore(id, 'Advanced to matching'),
    [runAndStore],
  );

  const rerunMatching = React.useCallback<Store['rerunMatching']>(
    (id) => runAndStore(id, 'Matching re-run'),
    [runAndStore],
  );

  /** An invoice that clears matching surfaces at ERP posting. */
  const advanceToPosting = React.useCallback<Store['advanceToPosting']>(
    (id) => {
      patch(id, (invoice) => ({
        ...invoice,
        stage: 'posting',
        firstSurfacedAt: invoice.firstSurfacedAt ?? stamp(),
        audit: appendAudit(invoice, 'Surfaced at ERP posting', 'Matching cleared. There is no separate approval step.'),
      }));
    },
    [patch, actor],
  );

  const goBackToExtraction = React.useCallback<Store['goBackToExtraction']>(
    (id) => {
      patch(id, (invoice) => ({
        ...invoice,
        stage: 'extraction',
        audit: appendAudit(invoice, 'Returned to extraction', 'Back-navigation before posting'),
      }));
    },
    [patch, actor],
  );

  const recordOverride = React.useCallback<Store['recordOverride']>(
    (id, rule, reason) => {
      patch(id, (invoice) => ({
        ...invoice,
        overrides: [...invoice.overrides, { rule, reason, at: stamp(), actor }],
        audit: appendAudit(invoice, 'Override recorded', `${rule}. Reason: ${reason}`),
      }));
      log('Override recorded', rule);
    },
    [patch, actor, log],
  );

  const rejectInvoice = React.useCallback<Store['rejectInvoice']>(
    (id, reason) => {
      patch(id, (invoice) => ({
        ...invoice,
        status: 'Rejected',
        rejectReason: reason,
        terminalAt: stamp(),
        audit: appendAudit(invoice, 'Rejected', reason),
      }));
      log('Invoice rejected', reason);
      setProgress((p) => ({ ...p, completed: true }));
    },
    [patch, actor, log],
  );

  const postInvoice = React.useCallback<Store['postInvoice']>(
    (id) => {
      const reference = `ZB-BILL-${10500 + Math.floor(Math.random() * 400)}`;
      patch(id, (invoice) => ({
        ...invoice,
        stage: 'posting',
        status: 'Posted',
        erpReference: reference,
        terminalAt: stamp(),
        audit: appendAudit(invoice, 'Posted to Zoho Books', `${reference}. Document attached to the bill.`),
      }));
      log('Invoice posted', reference);
      setProgress((p) => ({ ...p, completed: true }));
    },
    [patch, actor, log],
  );

  /**
   * Only an invoice that has cleared matching becomes Exported. One still open
   * appears in the file with its current state and stays open (§10).
   */
  const markExported = React.useCallback<Store['markExported']>(
    (ids) => {
      setInvoices((previous) =>
        previous.map((invoice) => {
          if (!ids.includes(invoice.id)) return invoice;
          const cleared =
            invoice.matchResult !== null &&
            !invoice.matchResult.hardBlock &&
            invoice.matchResult.metadata.state !== 'pending' &&
            invoice.matchResult.lineItem.state !== 'pending' &&
            invoice.matchResult.metadata.findings.every((f) =>
              invoice.overrides.some((o) => o.rule === `Metadata — ${f.field}`),
            ) &&
            invoice.matchResult.lineItem.findings.every((f) =>
              invoice.overrides.some((o) =>
                o.rule ===
                `Line item — ${f.field === 'unitPrice' ? 'unit price' : f.field === 'lineTotal' ? 'line total' : 'quantity'}`,
              ),
            );

          if (invoice.status === 'Posted' || invoice.status === 'Rejected') return invoice;
          if (!cleared) {
            // Included in the file, but not closed by the download.
            return {
              ...invoice,
              audit: [
                ...invoice.audit,
                {
                  at: stamp(),
                  actor,
                  action: 'Included in a bulk download',
                  detail: 'Still open. A download does not close an invoice that has not cleared matching.',
                },
              ],
            };
          }
          const next: Invoice = {
            ...invoice,
            stage: 'posting',
            status: 'Exported',
            terminalAt: invoice.terminalAt ?? stamp(),
            audit: [
              ...invoice.audit,
              { at: stamp(), actor, action: 'Exported', detail: 'Matched-data CSV downloaded.' },
            ],
          };
          return { ...next, status: deriveStatus(next, config) };
        }),
      );
      log('CSV downloaded', `${ids.length} invoice${ids.length === 1 ? '' : 's'}`);
      setProgress((p) => ({ ...p, completed: true }));
    },
    [actor, config, log],
  );

  /** Typing or changing a PO number re-runs matching (§6). */
  const setPoNumber = React.useCallback<Store['setPoNumber']>(
    (id, poNumber) => {
      patch(id, (invoice) => ({
        ...invoice,
        poNumber,
        poSource: connections.zohoBooks ? 'zoho' : invoice.poSource,
        poFields: connections.zohoBooks
          ? [
              { key: 'poNumber', label: 'PO number', value: poNumber, confidence: null, acknowledged: true, mandatory: true, learnable: false },
              { key: 'poVendor', label: 'Vendor', value: invoice.vendor, confidence: null, acknowledged: true, mandatory: true, learnable: false },
              { key: 'poCurrency', label: 'Currency', value: invoice.currency, confidence: null, acknowledged: true, mandatory: true, learnable: false },
              { key: 'poTotal', label: 'PO total', value: invoice.amount.toFixed(2), confidence: null, acknowledged: true, mandatory: true, learnable: false },
            ]
          : invoice.poFields,
        audit: appendAudit(
          invoice,
          'PO number set',
          connections.zohoBooks
            ? `${poNumber} — fetched from Zoho Books as structured ground truth`
            : `${poNumber} — typed. No ERP connected, so nothing was fetched.`,
        ),
      }));
      rerunMatching(id);
    },
    [patch, connections.zohoBooks, rerunMatching, actor],
  );

  /** Attaching a missing PO or GRN, then re-running the stage. */
  const attachReference = React.useCallback<Store['attachReference']>(
    (id, which) => {
      patch(id, (invoice) => {
        if (which === 'grn') {
          return {
            ...invoice,
            grnSource: 'uploaded',
            grnFields: [
              { key: 'grnNumber', label: 'GRN number', value: `GRN-US-${invoice.number.replace(/\D/g, '').slice(-5)}`, confidence: 93, acknowledged: false, mandatory: true, learnable: false },
              { key: 'grnPoRef', label: 'PO reference', value: invoice.poNumber ?? '—', confidence: 96, acknowledged: false, mandatory: true, learnable: false },
              { key: 'grnDate', label: 'Receipt date', value: formatDate(at(2)), confidence: 91, acknowledged: false, mandatory: true, learnable: false },
            ],
            // The receipt matches what was ordered.
            lines: invoice.lines.map((l) => ({ ...l, grnQty: l.poQty })),
            audit: appendAudit(invoice, 'GRN attached', 'Uploaded document, extracted with confidence per field'),
          };
        }
        return {
          ...invoice,
          poSource: 'uploaded',
          poFields: [
            { key: 'poNumber', label: 'PO number', value: invoice.poNumber ?? 'PO-US-00000', confidence: 94, acknowledged: false, mandatory: true, learnable: false },
            { key: 'poVendor', label: 'Vendor', value: invoice.vendor, confidence: 92, acknowledged: false, mandatory: true, learnable: false },
            { key: 'poCurrency', label: 'Currency', value: invoice.currency, confidence: 97, acknowledged: false, mandatory: true, learnable: false },
            { key: 'poTotal', label: 'PO total', value: invoice.amount.toFixed(2), confidence: 88, acknowledged: false, mandatory: true, learnable: false },
          ],
          audit: appendAudit(invoice, 'PO attached', 'Uploaded document, extracted with confidence per field'),
        };
      });
      rerunMatching(id);
    },
    [patch, rerunMatching, actor],
  );

  /**
   * Assigning a tax or GL code per line. A code that matches a memory pattern
   * for this vendor builds its streak, and at the threshold the memory forms —
   * with no admin gate (§9).
   */
  const setLineCode = React.useCallback<Store['setLineCode']>(
    (id, lineId, field, value) => {
      let vendor = '';
      patch(id, (invoice) => {
        vendor = invoice.vendor;
        return {
          ...invoice,
          lines: invoice.lines.map((l) => (l.id === lineId ? { ...l, [field]: value } : l)),
          audit: appendAudit(invoice, 'Code assigned', `${field.toUpperCase()} on one line set to ${value}`),
        };
      });

      setMemory((previous) =>
        previous.map((pattern) => {
          if (pattern.fieldKey !== field) return pattern;
          if (!pattern.patternKey.toLowerCase().includes(vendor.toLowerCase())) return pattern;
          if (pattern.suggestedValue !== value) {
            // Divergence pauses the streak rather than destroying it.
            return pattern;
          }
          const streak = pattern.streak + 1;
          if (streak === config.memoryThreshold) {
            log('Memory formed', `${pattern.field} · ${pattern.patternKey} → ${pattern.suggestedValue}`);
          }
          return { ...pattern, streak, lastSeen: now() };
        }),
      );
      setProgress((p) => ({ ...p, reviewed: true }));
    },
    [patch, config.memoryThreshold, actor, log],
  );

  /* ── Ingestion ──────────────────────────────────────────────────────── */

  const runSamples = React.useCallback<Store['runSamples']>(() => {
    const batch = sampleBatch + 1;
    setSampleBatch(batch);
    const built = buildSamples(batch);
    setInvoices((previous) => [...built, ...previous]);
    setSources((previous) => [
      {
        id: `src-sample${batch > 1 ? `-${batch}` : ''}`,
        kind: 'Sample',
        label: 'Pre-computed sample set · United States · 3 invoices with POs and GRNs',
        arrivedAt: stamp(),
        heldDocuments: [],
      },
      ...previous,
    ]);
    log('Sample set run', 'Three invoices: a clean match, a line variance, and a duplicate of the first');
    setProgress((p) => ({ ...p, ingested: true, sampleRun: true }));
  }, [sampleBatch, log]);

  const uploadInvoice = React.useCallback<Store['uploadInvoice']>(() => {
    const batch = uploadBatch + 1;
    setUploadBatch(batch);
    const built = buildUpload(batch);
    setInvoices((previous) => [built, ...previous]);
    log('Invoice uploaded', `${built.number} with its PO and GRN`);
    setProgress((p) => ({ ...p, ingested: true, uploaded: true }));
  }, [uploadBatch, log]);

  /**
   * Turn the files the user picked into records. One invoice per file they
   * classified as an invoice; everything else is attached or held on the upload.
   */
  const ingestUpload = React.useCallback<Store['ingestUpload']>(
    (files) => {
      if (files.length === 0) return;
      const batch = uploadBatch + 1;
      setUploadBatch(batch);
      const sourceId = `src-upload-${batch}`;

      const invoiceFiles = files.filter((f) => f.kind === 'invoice');
      const poFile = files.find((f) => f.kind === 'po')?.name;
      const grnFile = files.find((f) => f.kind === 'grn')?.name;
      const attachments = files
        .filter((f) => f.kind === 'tax' || f.kind === 'supporting')
        .map((f) => ({
          name: f.name,
          kind: (f.kind === 'tax' ? 'Tax document' : 'Supporting document') as
            | 'Tax document'
            | 'Supporting document',
        }));

      // Documents with no invoice among them are held on the source, not lost.
      const held = invoiceFiles.length === 0 ? files.map((f) => f.name) : [];

      setSources((previous) => [
        {
          id: sourceId,
          kind: 'Upload',
          label:
            files.length === 1
              ? files[0].name
              : `${files.length} documents · ${files[0].name} and ${files.length - 1} more`,
          arrivedAt: now(),
          heldDocuments: held,
        },
        ...previous,
      ]);

      if (invoiceFiles.length > 0) {
        const built = invoiceFiles.map((file, index) =>
          buildFromUpload({
            invoiceFile: file.name,
            poFile,
            grnFile,
            attachments,
            sourceId,
            index,
            connections,
          }),
        );
        setInvoices((previous) => [...built, ...previous]);
        log(
          'Documents uploaded',
          `${files.length} files, ${built.length} invoice${built.length === 1 ? '' : 's'} created`,
        );
        setProgress((p) => ({ ...p, ingested: true, uploaded: true }));
        // Land on the first one, since that is what they came to do.
        setOpenInvoiceId(built[0].id);
        setLastOpenedInvoiceId(built[0].id);
        setScreen('invoice');
      } else {
        log('Documents uploaded', `${files.length} files held, no invoice among them`);
        setScreen('queue');
      }
    },
    [uploadBatch, log, connections],
  );

  /* ── People ─────────────────────────────────────────────────────────── */

  const inviteMember = React.useCallback<Store['inviteMember']>(
    (email, invoiceProcessing, agenticSearch) => {
      setMembers((previous) => {
        const existing = previous.find((m) => m.email.toLowerCase() === email.toLowerCase());
        // Inviting an existing member is a no-op; a second invite to a pending
        // address resends rather than duplicating (Signup PRD §7).
        if (existing) return previous;
        return [
          ...previous,
          {
            id: `m-${previous.length + 1}`,
            name: email,
            email,
            invoiceProcessing,
            agenticSearch,
            status: 'Invite pending',
            lastActive: 'Invited just now',
            isWorkspaceOwner: false,
            isTenantOwner: false,
          },
        ];
      });
      log('Member invited', `${email} · Invoice Processing: ${invoiceProcessing}`);
      setProgress((p) => ({ ...p, invited: true }));
    },
    [log],
  );

  const setMemberRole = React.useCallback<Store['setMemberRole']>(
    (id, workflow, role) => {
      setMembers((previous) =>
        previous.map((m) => (m.id === id ? { ...m, [workflow]: role } : m)),
      );
      const who = members.find((m) => m.id === id)?.name ?? id;
      log('Role changed', `${who} · ${workflow === 'invoiceProcessing' ? 'Invoice Processing' : 'Agentic Search'}: ${role}`);
    },
    [members, log],
  );

  const toggleSuspend = React.useCallback<Store['toggleSuspend']>(
    (id) => {
      setMembers((previous) =>
        previous.map((m) =>
          m.id === id
            ? { ...m, status: m.status === 'Suspended' ? 'Active' : 'Suspended' }
            : m,
        ),
      );
      const target = members.find((m) => m.id === id);
      log(target?.status === 'Suspended' ? 'Member unsuspended' : 'Member suspended', target?.name);
    },
    [members, log],
  );

  const removeMember = React.useCallback<Store['removeMember']>(
    (id) => {
      const target = members.find((m) => m.id === id);
      setMembers((previous) => previous.filter((m) => m.id !== id));
      log('Member removed', `${target?.name ?? id} — processing history and audit entries retained`);
    },
    [members, log],
  );

  /**
   * These are referenced in consumers' useMemo deps, most importantly the
   * DataGrid's column definitions. A fresh arrow on every render invalidates
   * those memos and makes the grid re-initialise, which is a visible pause.
   */
  const openInvoice = React.useCallback((id: string) => {
    setOpenInvoiceId(id);
    setLastOpenedInvoiceId(id);
    setScreen('invoice');
  }, []);

  const pushChat = React.useCallback(
    (turns: ChatTurn[]) => setChat((previous) => [...previous, ...turns]),
    [],
  );
  const clearChat = React.useCallback(() => setChat([]), []);
  const pushPanelChat = React.useCallback(
    (turns: ChatTurn[]) => setPanelChat((previous) => [...previous, ...turns]),
    [],
  );
  const openAskNeo = React.useCallback((invoiceId: string | null = null) => {
    setAskNeoInvoiceId((previous) => {
      if (previous !== invoiceId) setPanelChat([]);
      return invoiceId;
    });
    setAskNeoOpen(true);
  }, []);
  const closeAskNeo = React.useCallback(() => setAskNeoOpen(false), []);
  const takeToFullPage = React.useCallback((question: string) => {
    setAskNeoOpen(false);
    setHandoffQuestion(question);
    setScreen('ask-neo');
  }, []);
  const clearHandoff = React.useCallback(() => setHandoffQuestion(null), []);
  const dismissChecklist = React.useCallback(
    () => setProgress((p) => ({ ...p, checklistDismissed: true })),
    [],
  );

  /* ── Demo scenarios ─────────────────────────────────────────────────── */

  /**
   * Puts the app into a named state in one step. A demo aid: it writes the same
   * state the UI would have produced, so nothing here is a special code path the
   * product does not otherwise reach.
   */
  const applyScenario = React.useCallback<Store['applyScenario']>((id) => {
    const signedIn: Profile = {
      firstName: 'Shubham',
      lastName: 'Shrivastava',
      email: 'shubham.s@neoflo.ai',
      method: 'google',
      domainVerdict: 'existing-tenant',
      domain: 'neoflo.ai',
      routePath: 'joined',
      workspaceName: 'Finance',
      pendingRequestFor: null,
      jobFunction: 'AP / Finance',
      country: 'US',
      onboarded: true,
    };

    // Everything back to the opening position before the scenario's own changes.
    const reset = () => {
      setInvoices(INITIAL_INVOICES);
      setSources(SOURCES);
      setConfig(DEFAULT_CONFIG);
      setConnections(DEFAULT_CONNECTIONS);
      setMembers(MEMBERS);
      setMemory(MEMORY_PATTERNS);
      setDocuments(INDEXED_DOCUMENTS);
      setDiscoverableWorkspaces(DISCOVERABLE_WORKSPACES);
      setChat([]);
      setPanelChat([]);
      setAskNeoOpen(false);
      setAskNeoInvoiceId(null);
      setHandoffQuestion(null);
      setOpenInvoiceId(null);
      setLastOpenedInvoiceId(null);
      setVisibility('public');
      setSampleBatch(0);
      setUploadBatch(0);
      setDocumentBatch(0);
      setActivity([]);
      setProgress({
        ingested: false,
        sampleRun: false,
        uploaded: false,
        reviewed: false,
        completed: false,
        invited: false,
        checklistDismissed: false,
      });
      setVisitedAskNeo(false);
    };

    /** Land inside the app, past onboarding. */
    const enterApp = (screen: Screen = 'queue') => {
      setProfile(signedIn);
      setVisitedAskNeo(true);
      setLandingMode('return');
      setScreen(screen);
    };

    /** Open one invoice from a given list, at the stage it is actually at. */
    const openFrom = (list: Invoice[], invoiceId: string) => {
      setInvoices(list);
      setOpenInvoiceId(invoiceId);
      setLastOpenedInvoiceId(invoiceId);
      setScreen('invoice');
    };

    /** The three samples, with matching already run on each. */
    const withSamples = () => {
      const samples = buildSamples(1);
      const all = [...samples, ...INITIAL_INVOICES];
      return all.map((invoice) =>
        invoice.isSample
          ? { ...invoice, stage: 'matching' as const, matchResult: runMatching(invoice, DEFAULT_CONFIG, all) }
          : invoice,
      );
    };

    /** INV-88213 with its receipt supplied, so all three checks pass. */
    const withGrnSupplied = () => {
      const patched = INITIAL_INVOICES.map((invoice) => {
        if (invoice.id !== 'inv-88213') return invoice;
        return {
          ...invoice,
          grnSource: 'uploaded' as const,
          grnFields: [
            { key: 'grnNumber', label: 'GRN number', value: 'GRN-US-88213', confidence: 93, acknowledged: true, mandatory: true, learnable: false },
            { key: 'grnPoRef', label: 'PO reference', value: 'PO-US-88213', confidence: 96, acknowledged: true, mandatory: true, learnable: false },
            { key: 'grnDate', label: 'Receipt date', value: formatDate(at(4)), confidence: 91, acknowledged: true, mandatory: true, learnable: false },
          ],
          lines: invoice.lines.map((l) => ({ ...l, grnQty: l.poQty })),
        };
      });
      return patched.map((invoice) =>
        invoice.id === 'inv-88213'
          ? { ...invoice, matchResult: runMatching(invoice, DEFAULT_CONFIG, patched) }
          : invoice,
      );
    };

    /** Stage the signup form with an address, so the shared step stays visible. */
    const stageSignup = (firstName: string, lastName: string, email: string) => {
      const { verdict, domain } = readDomain(email);
      setProfile({
        firstName, lastName, email,
        method: null,
        domainVerdict: verdict,
        domain,
        routePath: null,
        workspaceName: '',
        pendingRequestFor: null,
        jobFunction: '',
        country: 'US',
        onboarded: false,
      });
      setScreen('signup');
    };

    reset();

    switch (id) {
      case 'reset':
        setProfile({
          firstName: '', lastName: '', email: '', method: null, domainVerdict: null,
          domain: '', routePath: null, workspaceName: '', pendingRequestFor: null,
          jobFunction: '', country: 'US', onboarded: false,
        });
        setScreen('signup');
        break;

      case 'signup-existing-tenant':
        stageSignup('Shubham', 'Shrivastava', 'shubham.s@neoflo.ai');
        break;

      case 'signup-nothing-open':
        setDiscoverableWorkspaces(DISCOVERABLE_WORKSPACES.map((w) => ({ ...w, visibility: 'private' })));
        stageSignup('Shubham', 'Shrivastava', 'shubham.s@neoflo.ai');
        break;

      case 'signup-first-of-domain':
        stageSignup('Ravi', 'Menon', 'ravi@acmefoods.com');
        break;

      case 'signup-personal-provider':
        stageSignup('Shubham', 'Shrivastava', 'shubham@gmail.com');
        break;

      case 'signup-invited':
        setProfile({
          ...signedIn,
          firstName: 'Priya',
          lastName: 'Raman',
          email: 'priya@neoflo.ai',
          routePath: 'invited',
          workspaceName: PENDING_INVITE.workspaceName,
          jobFunction: '',
          onboarded: false,
        });
        setScreen('profile');
        break;

      case 'landing-first-visit':
        setProfile(signedIn);
        setVisitedAskNeo(false);
        setLandingMode('first');
        setScreen('ask-neo');
        break;

      case 'landing-return':
        enterApp('ask-neo');
        setLandingMode('return');
        setLastOpenedInvoiceId('inv-77120');
        break;

      case 'extraction-low-confidence':
      case 'extraction-attachments':
        enterApp();
        openFrom(INITIAL_INVOICES, 'inv-77120');
        break;

      case 'matching-no-po': {
        // No ERP, and an invoice arriving on its own: the number is on its face
        // but there is nothing to resolve it against.
        const offline = { ...DEFAULT_CONNECTIONS, zohoBooks: false, zohoInventory: false };
        setConnections(offline);
        enterApp();
        setProgress((p) => ({ ...p, ingested: true, uploaded: true }));
        const alone = buildFromUpload({
          invoiceFile: 'INV-55501.pdf',
          attachments: [],
          sourceId: 'src-upload-alone',
          index: 0,
          connections: offline,
        });
        const cleared: Invoice = {
          ...alone,
          invoiceFields: alone.invoiceFields.map((f) => ({ ...f, acknowledged: true })),
          stage: 'matching',
        };
        const list = [cleared, ...INITIAL_INVOICES];
        openFrom(
          list.map((invoice) =>
            invoice.id === cleared.id
              ? { ...invoice, matchResult: runMatching(invoice, DEFAULT_CONFIG, list) }
              : invoice,
          ),
          cleared.id,
        );
        break;
      }

      case 'matching-no-grn':
        enterApp();
        openFrom(INITIAL_INVOICES, 'inv-88213');
        break;

      case 'matching-po-balance':
        enterApp();
        openFrom(INITIAL_INVOICES, 'inv-44320');
        break;

      case 'matching-duplicate':
        enterApp();
        setSampleBatch(1);
        setProgress((p) => ({ ...p, ingested: true, sampleRun: true }));
        openFrom(withSamples(), 'sample-duplicate');
        break;

      case 'matching-variance':
        enterApp();
        setSampleBatch(1);
        setProgress((p) => ({ ...p, ingested: true, sampleRun: true }));
        openFrom(withSamples(), 'sample-variance');
        break;

      case 'posting-ready': {
        enterApp();
        const cleared = withGrnSupplied().map((invoice) =>
          invoice.id === 'inv-88213' ? { ...invoice, stage: 'posting' as const, status: 'ERP posting' as const } : invoice,
        );
        openFrom(cleared, 'inv-88213');
        break;
      }

      case 'posting-sample-blocked': {
        enterApp();
        setSampleBatch(1);
        setProgress((p) => ({ ...p, ingested: true }));
        const list = withSamples().map((invoice) =>
          invoice.id === 'sample-clean'
            ? { ...invoice, stage: 'posting' as const, status: 'ERP posting' as const }
            : invoice,
        );
        openFrom(list, 'sample-clean');
        break;
      }

      case 'posting-exported':
        enterApp();
        openFrom(INITIAL_INVOICES, 'inv-55891');
        break;

      case 'memory-about-to-form': {
        enterApp();
        setUploadBatch(1);
        setProgress((p) => ({ ...p, ingested: true, uploaded: true, reviewed: true }));
        const uploaded = buildUpload(1);
        // Extraction already dealt with, so the demo starts at the coding table.
        const ready: Invoice = {
          ...uploaded,
          invoiceFields: uploaded.invoiceFields.map((f) => ({ ...f, acknowledged: true })),
          poFields: uploaded.poFields.map((f) => ({ ...f, acknowledged: true })),
          grnFields: uploaded.grnFields.map((f) => ({ ...f, acknowledged: true })),
          stage: 'matching',
        };
        const list = [ready, ...INITIAL_INVOICES];
        openFrom(
          list.map((invoice) =>
            invoice.id === ready.id
              ? { ...invoice, matchResult: runMatching(invoice, DEFAULT_CONFIG, list) }
              : invoice,
          ),
          ready.id,
        );
        break;
      }

      case 'config-drift':
        enterApp();
        setConfig({ ...DEFAULT_CONFIG, matchType: '2-way' });
        openFrom(INITIAL_INVOICES, 'inv-88213');
        break;

      case 'stp-inert':
        enterApp('workflow-config');
        setConnections({ ...DEFAULT_CONNECTIONS, zohoBooks: false, zohoInventory: false });
        break;

      case 'queue-empty':
        enterApp();
        setInvoices([]);
        setSources([]);
        break;
    }
  }, []);

  /* ── Assembly ───────────────────────────────────────────────────────── */

  const value: Store = {
    screen,
    goTo,
    profile,
    signUp,
    acceptInvite,
    joinWorkspace,
    createOwnWorkspace,
    submitProfile,
    invoices,
    sources,
    openInvoiceId,
    openInvoice,
    lastOpenedInvoiceId,
    applyScenario,
    discoverableWorkspaces,
    config,
    updateConfig: (patchValue) => {
      setConfig((previous) => ({ ...previous, ...patchValue }));
      const [key, next] = Object.entries(patchValue)[0] ?? [];
      if (key) log('Configuration changed', `${key} → ${String(next)}. Applies to what runs next.`);
    },
    connections,
    updateConnections: (patchValue) => {
      setConnections((previous) => ({ ...previous, ...patchValue }));
      const [key, next] = Object.entries(patchValue)[0] ?? [];
      if (key) log('Connection changed', `${key} → ${String(next)}`);
    },
    members,
    memory,
    documents,
    addDocument: () => {
      const batch = documentBatch + 1;
      setDocumentBatch(batch);
      const built = buildUploadedDocument(batch);
      setDocuments((previous) => [built, ...previous]);
      log('Document indexed', `${built.name} · ${built.pages} pages`);
    },
    removeDocument: (id) => {
      const target = documents.find((d) => d.id === id);
      setDocuments((previous) => previous.filter((d) => d.id !== id));
      log('Document removed', `${target?.name ?? id}. Answers stop drawing on it immediately.`);
    },
    workspaceVisibility,
    setWorkspaceVisibility: (visibility) => {
      setVisibility(visibility);
      log('Workspace visibility changed', VISIBILITY_COPY[visibility].label);
    },
    chat,
    pushChat,
    clearChat,
    askNeoOpen,
    askNeoInvoiceId,
    // A panel opened from a different record starts a fresh thread, so an answer
    // about the last invoice is never left sitting above this one.
    openAskNeo,
    closeAskNeo,
    handoffQuestion,
    // The panel could not reach far enough, so the question travels rather than
    // making the user type it again.
    takeToFullPage,
    clearHandoff,
    panelChat,
    pushPanelChat,
    visitedAskNeo,
    landingMode,
    activity,
    progress,
    dismissChecklist,
    editField,
    acknowledgeField,
    acknowledgeAll,
    advanceToMatching,
    advanceToPosting,
    rerunMatching,
    recordOverride,
    rejectInvoice,
    postInvoice,
    markExported,
    setPoNumber,
    attachReference,
    setLineCode,
    goBackToExtraction,
    runSamples,
    uploadInvoice,
    ingestUpload,
    inviteMember,
    setMemberRole,
    toggleSuspend,
    removeMember,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export { LEGAL_ENTITY };
