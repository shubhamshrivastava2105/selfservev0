/**
 * One store for the whole prototype, held in React state.
 *
 * Almost nothing is persisted on purpose: a prototype that remembers the last
 * person who used it cannot be reset before the next demo. The exception is what
 * a person put in by hand — an uploaded document, and which sources they left
 * switched on — because losing those is a bug, not a reset.
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
import { load as loadPersisted, save as savePersisted } from './persist';
import { documentFromFile } from './upload';
import { deriveStatus, runMatching, stamp } from './engine';
import { availableSources } from './neo';
import { classifyFilename } from './classify';
import { at, formatDate, now } from './clock';
import type { ScenarioId } from './scenarios';
import type {
  AuditEntry,
  ChatTurn,
  Connections,
  DiscoverableWorkspace,
  ErpPayload,
  DocumentKind,
  DomainVerdict,
  IndexedDocument,
  Invoice,
  InvoiceSource,
  Conversation,
  Member,
  SourceId,
  WorkflowKey,
  MemoryPattern,
  RoutePath,
  Screen,
  SignInMethod,
  WorkflowConfig,
  WorkflowRole,
  WorkspaceVisibility,
} from './types';

export type FieldScope = 'invoice' | 'po' | 'grn';

export interface Profile {
  firstName: string;
  lastName: string;
  email: string;
  method: SignInMethod | null;
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

/**
 * The three things this person does on the way to their first posted invoice.
 *
 * Their own actions, not the workspace's history — someone joining a team that
 * already posts invoices has still not reviewed one themselves. Persisted,
 * because a journey that resets on reload would put the guide back in front of
 * somebody who has finished it.
 */
export interface FirstRun {
  ingested: boolean;
  reviewed: boolean;
  posted: boolean;
}

interface Store {
  screen: Screen;
  goTo: (screen: Screen) => void;

  profile: Profile;
  signIn: (method: SignInMethod, firstName: string, lastName: string, email: string) => void;
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

  /** Seeded sample documents plus whatever the user uploaded, newest first. */
  documents: IndexedDocument[];
  /**
   * Files the user picked. Real names, real sizes, and real passages where the
   * browser could read the text. Returns what it could not read, so the caller
   * can say so rather than the upload failing quietly.
   */
  addDocuments: (files: File[]) => Promise<{ indexed: number; unread: string[] }>;
  /**
   * Move an upload out of the library. Only the misfiled-invoice route uses
   * this: a file that became an invoice record has no business also being
   * reading material. There is no delete in the interface.
   */
  removeDocument: (id: string) => void;
  /** Documents excluded from answers, by id. */
  excludedDocumentIds: string[];
  setDocumentIncluded: (id: string, included: boolean) => void;

  /** How far this person has got on their first invoice. */
  firstRun: FirstRun;

  /**
   * Which sources Ask Neo may draw on. Null means every source the person can
   * reach, which is the default and is not the same as an empty list.
   */
  selectedSources: SourceId[] | null;
  setSourceSelected: (id: SourceId, on: boolean) => void;
  /** The signed-in person's member record, which carries their workflow roles. */
  viewer: Member | null;

  /** The last invoice opened, so a return visit can offer to resume it. */
  lastOpenedInvoiceId: string | null;

  /** Demo aid. See scenarios.ts. */
  applyScenario: (id: ScenarioId) => void;

  /** Who can join the workspace you are in. Public by default. */
  workspaceVisibility: WorkspaceVisibility;
  setWorkspaceVisibility: (visibility: WorkspaceVisibility) => void;

  /** The turns of the open conversation, or none if a new one is being started. */
  chat: ChatTurn[];
  pushChat: (turns: ChatTurn[]) => void;

  /** Every conversation that has been had, newest first. */
  conversations: Conversation[];
  /** Which one is on screen. Null means a fresh one nobody has spoken in yet. */
  activeConversationId: string | null;
  openConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  /** Back to the landing state, with the thread cleared. */
  /** Put the current conversation away and start a new one. Nothing is lost. */
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

  /* Invoice actions */
  editField: (id: string, scope: FieldScope, key: string, value: string) => void;
  advanceToMatching: (id: string) => void;
  advanceToPosting: (id: string) => void;
  rerunMatching: (id: string) => void;
  recordOverride: (id: string, rule: string, reason: string) => void;
  rejectInvoice: (id: string, reason: string) => void;
  postInvoice: (id: string) => void;
  markExported: (ids: string[]) => void;
  setPoNumber: (id: string, poNumber: string) => void;
  attachReference: (id: string, which: 'po' | 'grn') => void;
  /**
   * Attach a document that arrived without an invoice. It is consumed off the
   * source it was held on, so it cannot be attached twice.
   */
  attachHeldDocument: (id: string, which: 'po' | 'grn', name: string) => void;
  /** Documents held on sources that could serve as a PO or a receipt. */
  heldDocumentsFor: (which: 'po' | 'grn') => string[];
  setLineCode: (id: string, lineId: string, field: 'vat' | 'wht' | 'gl', value: string) => void;
  /** Edit a field on the ERP payload. */
  setErpField: (id: string, key: keyof ErpPayload, value: string) => void;
  /** Dry-run the posting against the ERP without writing anything. */
  simulatePosting: (id: string) => void;
  goBackToExtraction: (id: string) => void;

  /* Ingestion */
  runSamples: () => void;
  uploadInvoice: () => void;
  /** Files the user actually chose, classified in the upload dialog. */
  ingestUpload: (files: { name: string; kind: DocumentKind }[]) => void;

  /* People */
  inviteMember: (email: string, invoiceProcessing: WorkflowRole) => void;
  setMemberRole: (id: string, workflow: WorkflowKey, role: WorkflowRole) => void;
  toggleSuspend: (id: string) => void;
  removeMember: (id: string) => void;
}

/** What the chart of accounts maps a line to, by what it is. */
function glForLine(description: string): string {
  const d = description.toLowerCase();
  if (/freight|delivery|shipping|ocean|fuel/.test(d)) return '7100 · Freight and delivery';
  if (/switch|network|software|install|licence|license/.test(d)) return '6400 · IT and software';
  if (/bolt|bearing|gasket|belting|conveyor|repair/.test(d)) return '6500 · Repairs and maintenance';
  if (/brochure|print|label/.test(d)) return '7400 · Printing and marketing';
  if (/paper|toner|chair|cabinet|marker|supplies/.test(d)) return '6200 · Office supplies';
  return '5010 · Cost of goods sold';
}

/** The rate a tax code carries, for the simulated tax per line. */
function taxRateFor(code: string): number {
  const match = /(\d+(?:\.\d+)?)/.exec(code);
  if (!match || /EXEMPT|NONE/i.test(code)) return 0;
  return Number(match[1]) / 100;
}

const StoreContext = React.createContext<Store | null>(null);

export function useStore(): Store {
  const store = React.useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreen] = React.useState<Screen>('signin');
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
  /**
   * Conversations outlive a reload for the same reason an upload does: a person
   * asked those questions. A scenario clears them, because a scenario is an
   * explicit request for a clean slate before a demo.
   */
  const [conversations, setConversations] = React.useState<Conversation[]>(() =>
    loadPersisted<Conversation[]>('conversations', []),
  );
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
  const [panelChat, setPanelChat] = React.useState<ChatTurn[]>([]);
  const [askNeoOpen, setAskNeoOpen] = React.useState(false);
  const [askNeoInvoiceId, setAskNeoInvoiceId] = React.useState<string | null>(null);
  const [handoffQuestion, setHandoffQuestion] = React.useState<string | null>(null);
  /**
   * Uploads outlive a reload; the seeded corpus does not need to, since it comes
   * back from data.ts. Kept apart so a change to the seeds still shows up.
   */
  const [uploads, setUploads] = React.useState<IndexedDocument[]>(() =>
    loadPersisted<IndexedDocument[]>('uploads', []),
  );
  /**
   * Documents left out of answers.
   *
   * Excluded, not deleted: a document you attached is still yours, and taking it
   * out of scope for a question is not the same as destroying it. Persisted for
   * the same reason the uploads are.
   */
  const [excludedDocumentIds, setExcludedDocumentIds] = React.useState<string[]>(() =>
    loadPersisted<string[]>('excludedDocuments', []),
  );
  const [firstRun, setFirstRun] = React.useState<FirstRun>(() =>
    loadPersisted<FirstRun>('firstRun', { ingested: false, reviewed: false, posted: false }),
  );
  const did = React.useCallback(
    (step: keyof FirstRun) => setFirstRun((previous) => ({ ...previous, [step]: true })),
    [],
  );
  const [selectedSources, setSelectedSources] = React.useState<SourceId[] | null>(() =>
    loadPersisted<SourceId[] | null>('sources', null),
  );
  const [lastOpenedInvoiceId, setLastOpenedInvoiceId] = React.useState<string | null>(null);
  const [discoverableWorkspaces, setDiscoverableWorkspaces] =
    React.useState<DiscoverableWorkspace[]>(DISCOVERABLE_WORKSPACES);
  const [visitedAskNeo, setVisitedAskNeo] = React.useState(false);
  const [landingMode, setLandingMode] = React.useState<'first' | 'return'>('first');
  const [sampleBatch, setSampleBatch] = React.useState(0);
  const [uploadBatch, setUploadBatch] = React.useState(0);
  const [activity, setActivity] = React.useState<AuditEntry[]>([]);

  const actor = profile.firstName
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : `${SIGNED_IN.firstName} ${SIGNED_IN.lastName}`;

  /* ── What a person put in by hand, kept across reloads ─────────────── */

  React.useEffect(() => savePersisted('uploads', uploads), [uploads]);
  React.useEffect(
    () => savePersisted('excludedDocuments', excludedDocumentIds),
    [excludedDocumentIds],
  );
  React.useEffect(() => savePersisted('firstRun', firstRun), [firstRun]);
  React.useEffect(() => savePersisted('sources', selectedSources), [selectedSources]);
  React.useEffect(() => savePersisted('conversations', conversations), [conversations]);

  /** The turns on screen: the open conversation's, or none for a fresh one. */
  const chat = React.useMemo(
    () => conversations.find((c) => c.id === activeConversationId)?.turns ?? [],
    [conversations, activeConversationId],
  );

  /** Uploads first, then the seeded corpus minus anything the user removed. */
  const documents = React.useMemo(
    () => [...uploads, ...INDEXED_DOCUMENTS],
    [uploads],
  );

  /**
   * The signed-in person's member record. Matched on the address they signed in
   * with, falling back to the seeded owner so the prototype has a viewer before
   * anyone signs up.
   */
  const viewer = React.useMemo(
    () =>
      members.find((m) => m.email.toLowerCase() === profile.email.toLowerCase()) ??
      members[0] ??
      null,
    [members, profile.email],
  );

  /** The sources this person could switch on. Membership decides. */
  const reachable = React.useMemo(
    () =>
      availableSources({
        invoices,
        memory,
        config,
        members,
        documents,
        connections,
        viewer,
      }),
    [invoices, memory, config, members, documents, connections, viewer],
  );

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

  const signIn = React.useCallback<Store['signIn']>((method, firstName, lastName, email) => {
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

  /**
   * A corrected field that the record also holds as a value of its own.
   *
   * Correcting "Vendor Name" means the document says something different from
   * what was read — so the record says it too. Without this the correction
   * reaches the field and nothing else: the dashboard, reporting, the CSV, the
   * ERP payload and Neo all keep quoting the misread value, and the record
   * header sits above a table that disagrees with it.
   *
   * Typed values are parsed, and a value that will not parse is left alone. The
   * field keeps whatever the user typed either way — a date that reads as prose
   * is still their correction, it just cannot become a timestamp.
   */
  const promoteToRecord = (invoice: Invoice, key: string, value: string): Invoice => {
    const text = value.trim();
    switch (key) {
      case 'number':
        return text === '' ? invoice : { ...invoice, number: text };
      case 'vendor':
        return text === '' ? invoice : { ...invoice, vendor: text };
      case 'currency':
        return text === '' ? invoice : { ...invoice, currency: text.toUpperCase() };
      case 'po':
        return { ...invoice, poNumber: text === '' || text === '\u2014' ? null : text };
      case 'date': {
        const parsed = new Date(text);
        if (Number.isNaN(parsed.getTime())) return invoice;
        return { ...invoice, invoiceDate: parsed.toISOString() };
      }
      case 'total': {
        const amount = Number(text.replace(/[^0-9.-]/g, ''));
        if (!Number.isFinite(amount)) return invoice;
        return { ...invoice, amount: Number(amount.toFixed(2)) };
      }
      default:
        return invoice;
    }
  };

  /**
   * The ERP fields the posting screen derives and shows disabled, refreshed
   * after a correction moved what they derive from. The ones a person types are
   * never touched — that is exactly the line the screen already draws between
   * greyed and live.
   */
  const withDerivedErp = (invoice: Invoice): Invoice => {
    const poTotal = invoice.lines.reduce((sum, l) => sum + l.poLineTotal, 0);
    const beforeVat = invoice.lines.reduce((sum, l) => sum + l.invoiceLineTotal, 0);
    return {
      ...invoice,
      erp: {
        ...invoice.erp,
        poNumber: invoice.poNumber ?? '',
        amountBeforeVat: Number(beforeVat.toFixed(2)),
        totalAfterVat: invoice.amount,
        referenceNumber: `NL${invoice.number.replace(/\D/g, '').padStart(9, '0')}`,
        variance: Number((invoice.amount - poTotal).toFixed(2)),
      },
    };
  };

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
              }
            : f,
        );
        const edited = withFields(invoice, scope, next);
        // Only the invoice's own reads speak for the record. A PO or receipt
        // field is what the counterparty's document says, not what ours does.
        const promoted =
          scope === 'invoice' ? withDerivedErp(promoteToRecord(edited, key, value)) : edited;
        return {
          ...promoted,
          audit: appendAudit(
            invoice,
            'Field corrected',
            `${target.label}: "${target.value}" → "${value}"`,
          ),
        };
      });
      did('reviewed');
    },
    [patch, actor, did],
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
    },
    [config, actor],
  );

  const advanceToMatching = React.useCallback<Store['advanceToMatching']>(
    (id) => {
      // Proceeding is the person saying they have looked at the reading — a
      // clean invoice needs no correction, and should still count as checked.
      did('reviewed');
      runAndStore(id, 'Advanced to matching');
    },
    [runAndStore, did],
  );

  const rerunMatching = React.useCallback<Store['rerunMatching']>(
    (id) => runAndStore(id, 'Matching re-run'),
    [runAndStore, did],
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
      did('reviewed');
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
      did('posted');
      log('Invoice posted', reference);
    },
    [patch, actor, log],
  );

  /**
   * Only an invoice that has cleared matching becomes Exported. One still open
   * appears in the file with its current state and stays open (§10).
   */
  const markExported = React.useCallback<Store['markExported']>(
    (ids) => {
      did('posted');
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
              { key: 'poNumber', label: 'PO number', value: poNumber, confidence: null, mandatory: true, learnable: false },
              { key: 'poVendor', label: 'Vendor', value: invoice.vendor, confidence: null, mandatory: true, learnable: false },
              { key: 'poCurrency', label: 'Currency', value: invoice.currency, confidence: null, mandatory: true, learnable: false },
              { key: 'poTotal', label: 'PO total', value: invoice.amount.toFixed(2), confidence: null, mandatory: true, learnable: false },
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
              { key: 'grnNumber', label: 'GRN number', value: `GRN-US-${invoice.number.replace(/\D/g, '').slice(-5)}`, confidence: 93, mandatory: true, learnable: false },
              { key: 'grnPoRef', label: 'PO reference', value: invoice.poNumber ?? '—', confidence: 96, mandatory: true, learnable: false },
              { key: 'grnDate', label: 'Receipt date', value: formatDate(at(2)), confidence: 91, mandatory: true, learnable: false },
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
            { key: 'poNumber', label: 'PO number', value: invoice.poNumber ?? 'PO-US-00000', confidence: 94, mandatory: true, learnable: false },
            { key: 'poVendor', label: 'Vendor', value: invoice.vendor, confidence: 92, mandatory: true, learnable: false },
            { key: 'poCurrency', label: 'Currency', value: invoice.currency, confidence: 97, mandatory: true, learnable: false },
            { key: 'poTotal', label: 'PO total', value: invoice.amount.toFixed(2), confidence: 88, mandatory: true, learnable: false },
          ],
          audit: appendAudit(invoice, 'PO attached', 'Uploaded document, extracted with confidence per field'),
        };
      });
      rerunMatching(id);
    },
    [patch, rerunMatching, actor],
  );

  /**
   * Documents that arrived with no invoice among them. They create no queue row,
   * which is why they surface at the moment an invoice needs one rather than as
   * a notice on the dashboard.
   */
  const heldDocumentsFor = React.useCallback<Store['heldDocumentsFor']>(
    (which) => {
      const wanted = which === 'po' ? 'po' : 'grn';
      return sources
        .flatMap((source) => source.heldDocuments)
        .filter((name) => classifyFilename(name) === wanted);
    },
    [sources],
  );

  const attachHeldDocument = React.useCallback<Store['attachHeldDocument']>(
    (id, which, name) => {
      // Consumed off whichever source was holding it.
      setSources((previous) =>
        previous.map((source) =>
          source.heldDocuments.includes(name)
            ? { ...source, heldDocuments: source.heldDocuments.filter((d) => d !== name) }
            : source,
        ),
      );
      patch(id, (invoice) => ({
        ...invoice,
        audit: appendAudit(
          invoice,
          which === 'po' ? 'PO attached' : 'GRN attached',
          `${name}, which arrived earlier without an invoice`,
        ),
      }));
      attachReference(id, which);
    },
    [patch, actor],
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
    },
    [patch, config.memoryThreshold, actor, log],
  );

  const setErpField = React.useCallback<Store['setErpField']>(
    (id, key, value) => {
      patch(id, (invoice) => ({ ...invoice, erp: { ...invoice.erp, [key]: value } }));
    },
    [patch],
  );

  /**
   * A dry run: the ERP validates the payload and reports back without writing.
   * It fails where a mandatory code is still missing, which is the case worth
   * catching before a real post.
   */
  const simulatePosting = React.useCallback<Store['simulatePosting']>(
    (id) => {
      patch(id, (invoice) => {
        const missingTax = invoice.lines.filter((l) => l.vat === '' || l.wht === '').length;
        const ok = missingTax === 0 && invoice.erp.text.trim() !== '';

        // The ERP derives the GL account from the purchase order, so a
        // successful dry run is what tells you where each line will land.
        const lines = ok
          ? invoice.lines.map((l) => ({
              lineId: l.id,
              description: l.description,
              gl: glForLine(l.description),
              taxAmount: Number((l.invoiceLineTotal * taxRateFor(l.vat)).toFixed(2)),
            }))
          : [];

        const message = ok
          ? `Accepted. ${invoice.lines.length} lines will post against ${invoice.erp.poNumber || 'the order'}.`
          : missingTax > 0
            ? `${missingTax} line${missingTax === 1 ? '' : 's'} are missing a tax code. The ERP rejected the payload.`
            : 'Text is required on the document header.';

        return {
          ...invoice,
          erp: { ...invoice.erp, simulated: { at: stamp(), ok, message, lines } },
          audit: appendAudit(invoice, ok ? 'Posting simulated' : 'Simulation failed', message),
        };
      });
    },
    [patch, actor],
  );

  /* ── Ingestion ──────────────────────────────────────────────────────── */

  const runSamples = React.useCallback<Store['runSamples']>(() => {
    const batch = sampleBatch + 1;
    setSampleBatch(batch);
    const built = buildSamples(batch);
    setInvoices((previous) => [...built, ...previous]);
    did('ingested');
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
  }, [sampleBatch, log]);

  const uploadInvoice = React.useCallback<Store['uploadInvoice']>(() => {
    const batch = uploadBatch + 1;
    setUploadBatch(batch);
    const built = buildUpload(batch);
    setInvoices((previous) => [built, ...previous]);
    did('ingested');
    log('Invoice uploaded', `${built.number} with its PO and GRN`);
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
        did('ingested');
        log(
          'Documents uploaded',
          `${files.length} files, ${built.length} invoice${built.length === 1 ? '' : 's'} created`,
        );
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
    (email, invoiceProcessing) => {
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
            status: 'Invite pending',
            lastActive: 'Invited just now',
            isWorkspaceOwner: false,
            isTenantOwner: false,
          },
        ];
      });
      log('Member invited', `${email} · Invoice Processing: ${invoiceProcessing}`);
    },
    [log],
  );

  const setMemberRole = React.useCallback<Store['setMemberRole']>(
    (id, workflow, role) => {
      setMembers((previous) =>
        previous.map((m) => (m.id === id ? { ...m, [workflow]: role } : m)),
      );
      const who = members.find((m) => m.id === id)?.name ?? id;
      void workflow;
      log('Role changed', `${who} · Invoice Processing: ${role}`);
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
   * those memos and makes the grid re-initialize, which is a visible pause.
   */
  const openInvoice = React.useCallback((id: string) => {
    setOpenInvoiceId(id);
    setLastOpenedInvoiceId(id);
    setScreen('invoice');
  }, []);

  /** The first question, as the name a person will recognize it by later. */
  const titleFrom = (turns: ChatTurn[]) => {
    const asked = turns.find((t) => t.role === 'user')?.text.trim() ?? 'New conversation';
    return asked.length > 64 ? `${asked.slice(0, 63).trimEnd()}…` : asked;
  };

  const pushChat = React.useCallback(
    (turns: ChatTurn[]) => {
      if (turns.length === 0) return;
      const at = stamp();
      setConversations((previous) => {
        const active = activeConversationId
          ? previous.find((c) => c.id === activeConversationId)
          : undefined;
        if (!active) {
          // The first turn is what creates the conversation, so an empty one is
          // never left lying in the history.
          const created: Conversation = {
            id: `conv-${at}`,
            title: titleFrom(turns),
            turns,
            startedAt: at,
            lastAt: at,
          };
          setActiveConversationId(created.id);
          return [created, ...previous];
        }
        return previous.map((c) =>
          c.id === active.id ? { ...c, turns: [...c.turns, ...turns], lastAt: at } : c,
        );
      });
    },
    [activeConversationId],
  );

  const clearChat = React.useCallback(() => setActiveConversationId(null), []);
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
      // Uploads and source choices are the user's, so a scenario leaves them be.
      setExcludedDocumentIds([]);
      setFirstRun({ ingested: false, reviewed: false, posted: false });
      setDiscoverableWorkspaces(DISCOVERABLE_WORKSPACES);
      setConversations([]);
      setActiveConversationId(null);
      setPanelChat([]);
      setAskNeoOpen(false);
      setAskNeoInvoiceId(null);
      setHandoffQuestion(null);
      setOpenInvoiceId(null);
      setLastOpenedInvoiceId(null);
      setVisibility('public');
      setSampleBatch(0);
      setUploadBatch(0);
      setActivity([]);
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
            { key: 'grnNumber', label: 'GRN number', value: 'GRN-US-88213', confidence: 93, mandatory: true, learnable: false },
            { key: 'grnPoRef', label: 'PO reference', value: 'PO-US-88213', confidence: 96, mandatory: true, learnable: false },
            { key: 'grnDate', label: 'Receipt date', value: formatDate(at(4)), confidence: 91, mandatory: true, learnable: false },
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
      setScreen('signin');
    };

    reset();

    switch (id) {
      case 'reset':
        setProfile({
          firstName: '', lastName: '', email: '', method: null, domainVerdict: null,
          domain: '', routePath: null, workspaceName: '', pendingRequestFor: null,
          jobFunction: '', country: 'US', onboarded: false,
        });
        setScreen('signin');
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

      case 'landing-long-document':
        enterApp('ask-neo');
        setLandingMode('return');
        // A long document with quotable passages, because a real PDF's text
        // cannot be read in the browser and this capability needs something to
        // be demonstrated on.
        setUploads((previous) => {
          const built = buildUploadedDocument(1);
          return [built, ...previous.filter((d) => d.id !== built.id)];
        });
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
        const alone = buildFromUpload({
          invoiceFile: 'INV-55501.pdf',
          attachments: [],
          sourceId: 'src-upload-alone',
          index: 0,
          connections: offline,
        });
        const cleared: Invoice = {
          ...alone,
          invoiceFields: alone.invoiceFields.map((f) => ({ ...f })),
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
        openFrom(withSamples(), 'sample-duplicate');
        break;

      case 'matching-variance':
        enterApp();
        setSampleBatch(1);
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
        // Coding is on the posting stage now, so that is where a memory forms.
        const list = withGrnSupplied().map((invoice) =>
          invoice.id === 'inv-44320'
            ? {
                ...invoice,
                stage: 'posting' as const,
                status: 'ERP posting' as const,
                lines: invoice.lines.map((l) => ({ ...l, vat: 'US-EXEMPT' })),
              }
            : invoice,
        );
        openFrom(list, 'inv-44320');
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
        // Nothing has happened here yet, so this is a first visit by
        // definition. visitedAskNeo has to go too, or navigating to Ask Neo
        // recomputes the landing back to a return.
        setVisitedAskNeo(false);
        setLandingMode('first');
        setMemory([]);
        break;
    }
  }, []);

  /* ── Assembly ───────────────────────────────────────────────────────── */

  const value: Store = {
    screen,
    goTo,
    profile,
    signIn,
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
    addDocuments: async (files) => {
      const built = await Promise.all(files.map((file) => documentFromFile(file, now())));
      // Re-uploading the same file replaces it rather than indexing it twice.
      setUploads((previous) => [
        ...built,
        ...previous.filter((p) => !built.some((b) => b.id === p.id)),
      ]);
      const unread = built.filter((d) => !d.contentRead).map((d) => d.name);
      const pages = built.reduce((sum, d) => sum + d.pages, 0);
      log(
        built.length === 1 ? 'Document indexed' : `${built.length} documents indexed`,
        `${built.map((d) => d.name).join(', ')} · ${pages} pages`,
      );
      return { indexed: built.length, unread };
    },
    removeDocument: (id) => {
      const target = documents.find((d) => d.id === id);
      setUploads((previous) => previous.filter((d) => d.id !== id));
      log('Document moved', `${target?.name ?? id} left the reading library.`);
    },
    firstRun,
    excludedDocumentIds,
    setDocumentIncluded: (id, included) => {
      const target = documents.find((d) => d.id === id);
      setExcludedDocumentIds((previous) =>
        included ? previous.filter((d) => d !== id) : [...new Set([...previous, id])],
      );
      log(
        included ? 'Document included' : 'Document set aside',
        `${target?.name ?? id}${included ? ' is back in scope for answers.' : ' is out of scope until you put it back.'}`,
      );
    },
    selectedSources,
    setSourceSelected: (id, on) => {
      const current = selectedSources ?? reachable.map((s) => s.id);
      const next = on ? [...new Set([...current, id])] : current.filter((s) => s !== id);
      setSelectedSources(next);
      const source = reachable.find((s) => s.id === id);
      log(on ? 'Source switched on' : 'Source switched off', source?.label ?? id);
    },
    viewer,
    workspaceVisibility,
    setWorkspaceVisibility: (visibility) => {
      setVisibility(visibility);
      log('Workspace visibility changed', VISIBILITY_COPY[visibility].label);
    },
    chat,
    pushChat,
    clearChat,
    conversations,
    activeConversationId,
    openConversation: (id) => {
      setActiveConversationId(id);
      goTo('ask-neo');
    },
    deleteConversation: (id) => {
      const gone = conversations.find((c) => c.id === id);
      setConversations((previous) => previous.filter((c) => c.id !== id));
      if (activeConversationId === id) setActiveConversationId(null);
      log('Conversation deleted', gone?.title);
    },
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
    editField,
    advanceToMatching,
    advanceToPosting,
    rerunMatching,
    recordOverride,
    rejectInvoice,
    postInvoice,
    markExported,
    setPoNumber,
    attachReference,
    attachHeldDocument,
    heldDocumentsFor,
    setLineCode,
    setErpField,
    simulatePosting,
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
