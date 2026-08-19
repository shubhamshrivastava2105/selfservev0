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
  INITIAL_INVOICES,
  LEGAL_ENTITY,
  MEMBERS,
  MEMORY_PATTERNS,
  SIGNED_IN,
  SOURCES,
  buildSamples,
  buildUpload,
} from './data';
import { deriveStatus, runMatching, stamp } from './engine';
import type {
  AuditEntry,
  ChatTurn,
  Connections,
  Invoice,
  InvoiceSource,
  Member,
  MemoryPattern,
  RoutePath,
  Screen,
  SignupMethod,
  WorkflowConfig,
  WorkflowRole,
} from './types';

export type FieldScope = 'invoice' | 'po' | 'grn';

export interface Profile {
  firstName: string;
  lastName: string;
  email: string;
  method: SignupMethod | null;
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
  joinWorkspace: (name: string, autoApprove: boolean) => void;
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

  chat: ChatTurn[];
  pushChat: (turns: ChatTurn[]) => void;
  visitedAskNeo: boolean;
  markAskNeoVisited: () => void;

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
  const [chat, setChat] = React.useState<ChatTurn[]>([]);
  const [visitedAskNeo, setVisitedAskNeo] = React.useState(false);
  const [sampleBatch, setSampleBatch] = React.useState(0);
  const [uploadBatch, setUploadBatch] = React.useState(0);
  const [progress, setProgress] = React.useState<SessionProgress>({
    ingested: false,
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

  /* ── Onboarding ─────────────────────────────────────────────────────── */

  const signUp = React.useCallback<Store['signUp']>((method, firstName, lastName, email) => {
    const domain = email.split('@')[1]?.toLowerCase() ?? '';
    const publicDomains = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com'];
    const isPublic = publicDomains.includes(domain);

    // A public domain is never a join key, so it can only form its own tenant.
    // Every other domain in this prototype matches the existing Neoflo tenant,
    // which is what puts the routing screen on the path.
    const matchesTenant = !isPublic;

    setProfile((previous) => ({
      ...previous,
      method,
      firstName,
      lastName,
      email,
      routePath: matchesTenant ? null : 'first-of-domain',
      workspaceName: matchesTenant ? '' : `${firstName}'s workspace`,
      pendingRequestFor: null,
    }));

    if (matchesTenant) {
      setScreen('routing');
    } else {
      // No domain match: tenant, workspace and membership are created here, in
      // one transaction, with no name requested (Signup PRD §4).
      setScreen('profile');
    }
  }, []);

  const joinWorkspace = React.useCallback<Store['joinWorkspace']>((name, autoApprove) => {
    setProfile((previous) => ({
      ...previous,
      routePath: 'joined',
      // Auto-approve off never blocks: a workspace is provisioned now and the
      // request goes to the owner (Signup PRD §7).
      workspaceName: autoApprove ? name : `${previous.firstName}'s workspace`,
      pendingRequestFor: autoApprove ? null : name,
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
                  detail: 'Still open — a download does not close an invoice that has not cleared matching.',
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
              { key: 'grnDate', label: 'Receipt date', value: '18 Aug 2026', confidence: 91, acknowledged: false, mandatory: true, learnable: false },
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
          return { ...pattern, streak, lastSeen: '19 Aug 2026' };
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
    setProgress((p) => ({ ...p, ingested: true }));
  }, [sampleBatch, log]);

  const uploadInvoice = React.useCallback<Store['uploadInvoice']>(() => {
    const batch = uploadBatch + 1;
    setUploadBatch(batch);
    const built = buildUpload(batch);
    setInvoices((previous) => [built, ...previous]);
    log('Invoice uploaded', `${built.number} with its PO and GRN`);
    setProgress((p) => ({ ...p, ingested: true }));
  }, [uploadBatch, log]);

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

  /* ── Assembly ───────────────────────────────────────────────────────── */

  const value: Store = {
    screen,
    goTo: setScreen,
    profile,
    signUp,
    joinWorkspace,
    createOwnWorkspace,
    submitProfile,
    invoices,
    sources,
    openInvoiceId,
    openInvoice: (id) => {
      setOpenInvoiceId(id);
      setScreen('invoice');
    },
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
    chat,
    pushChat: (turns) => setChat((previous) => [...previous, ...turns]),
    visitedAskNeo,
    markAskNeoVisited: () => setVisitedAskNeo(true),
    activity,
    progress,
    dismissChecklist: () => setProgress((p) => ({ ...p, checklistDismissed: true })),
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
    inviteMember,
    setMemberRole,
    toggleSuspend,
    removeMember,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export { LEGAL_ENTITY };
