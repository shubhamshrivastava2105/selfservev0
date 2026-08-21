import * as React from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@neofloai/atoms';
import {
  ArrowRightIcon,
  CaretDownIcon,
  CheckIcon,
  DatabaseIcon,
  PaperPlaneRightIcon,
  PaperclipIcon,
  SparkleIcon,
  UploadSimpleIcon,
} from '@neofloai/atoms/icons';
import { useStore } from '../store';
import { classifyFilename } from '../classify';
import { StatusChip } from '../components/common';
import { ShellBar } from '../components/shell';
import { answerQuestion, availableSources, suggestedQuestions } from '../neo';
import { money } from '../engine';
import { formatRelative } from '../clock';
import type { ChatTurn, DocumentKind } from '../types';

/** The column the whole conversation lives in. */
const COLUMN = 780;

function timeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Anything Neo says, in the same shape wherever it comes from: an avatar and a
 * body. The briefing and the activation checklist are Neo talking, so they use
 * this too rather than being cards bolted above the conversation.
 */
function NeoMessage({ children }: { children: React.ReactNode }) {
  return (
    <Stack direction="row" sx={{ gap: 1.5, alignItems: 'flex-start' }}>
      <Avatar size="sm" color="primary" sx={{ mt: 0.25, flexShrink: 0 }}>
        <SparkleIcon size={14} />
      </Avatar>
      <Stack sx={{ flex: 1, minWidth: 0, gap: 1.5 }}>{children}</Stack>
    </Stack>
  );
}

/* ── Neo's opening turn ───────────────────────────────────────────────── */

/** A number and what it counts, with the action that follows from it. */
function Tile({
  value,
  label,
  detail,
  action,
}: {
  value: number;
  label: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <Stack
      sx={{
        flex: '1 1 180px',
        minWidth: 170,
        gap: 0.25,
        p: 2,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography variant="h4">{value}</Typography>
      <Typography variant="body2" weight="medium">
        {label}
      </Typography>
      {detail && (
        <Typography variant="caption" color="text.secondary">
          {detail}
        </Typography>
      )}
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Stack>
  );
}

/**
 * What is waiting, and what happened without you.
 *
 * A tile worth nothing is left out rather than printed as a zero: three zeros
 * are both uninformative and the fastest way to make a new workspace feel like
 * a dashboard someone has to fill in. If there is nothing at all to say, the
 * briefing does not appear.
 */
function BriefingMessage({ firstVisit }: { firstVisit: boolean }) {
  const { invoices, memory, config, profile, goTo, openInvoice } = useStore();
  const needsMe = invoices.filter((i) => i.status === 'Action Required');
  const stp = invoices.filter((i) => i.stpPosted);
  const learned = memory.filter((m) => m.streak >= config.memoryThreshold);
  // With no invoices there is nothing to brief on, whatever else is seeded —
  // the start-here card is what shows instead.
  if (invoices.length === 0) return null;

  // Invoices, but none of them worth a tile. Still say where things stand:
  // a landing page with nothing on it reads as a broken one.
  if (needsMe.length === 0 && stp.length === 0 && learned.length === 0) {
    return (
      <NeoMessage>
        <Typography variant="body2">
          {invoices.length === 1
            ? 'One invoice is in flight and nothing needs you yet.'
            : `${invoices.length} invoices are in flight and nothing needs you yet.`}
        </Typography>
        <Box>
          <Button
            variant="secondary"
            appearance="outline"
            size="sm"
            endIcon={<ArrowRightIcon size={14} />}
            onClick={() => goTo('queue')}
          >
            Open the queue
          </Button>
        </Box>
      </NeoMessage>
    );
  }

  return (
    <NeoMessage>
      {/* On a first visit this is somebody else's work in progress. Calling it
          "your workspace" and "where it stands" claims a history this person
          does not have — they joined a team that was already going. */}
      <Typography variant="body2">
        {firstVisit
          ? `You have joined ${profile.workspaceName || 'a workspace'}, and it is already processing invoices. Here is what is open.`
          : 'Here is what changed while you were away.'}
      </Typography>
      <Stack direction="row" sx={{ gap: 1.5, flexWrap: 'wrap' }}>
        {needsMe.length > 0 && (
          <Tile
            value={needsMe.length}
            label={
              firstVisit
                ? needsMe.length === 1
                  ? 'invoice needs a person'
                  : 'invoices need a person'
                : needsMe.length === 1
                  ? 'invoice needs you'
                  : 'invoices need you'
            }
            detail={needsMe.slice(0, 3).map((i) => i.number).join(', ') || undefined}
            action={
              <Button size="sm" endIcon={<ArrowRightIcon size={14} />} onClick={() => goTo('queue')}>
                Open the queue
              </Button>
            }
          />
        )}
        {stp.length > 0 && (
          <Tile
            value={stp.length}
            label={firstVisit ? 'posted with nobody involved' : 'posted without needing you'}
            detail={stp.map((i) => i.number).join(', ') || undefined}
            action={
              <Button
                variant="secondary"
                appearance="outline"
                size="sm"
                onClick={() => openInvoice(stp[0].id)}
              >
                Open {stp[0].number}
              </Button>
            }
          />
        )}
        {learned.length > 0 && (
          <Tile
            value={learned.length}
            label={learned.length === 1 ? 'pattern learned' : 'patterns learned'}
            detail={learned.map((m) => m.field).join(', ') || undefined}
          />
        )}
      </Stack>
    </NeoMessage>
  );
}

/**
 * The path to a first posted invoice, on a first visit only.
 *
 * Three things, and every one is the product doing its job — nothing about
 * setup, because matching, tolerances and the ERP connection arrive filled in.
 *
 * No progress on it, and that is the point. This shows on a first landing and
 * only then, so by definition none of it has happened yet: a counter would read
 * 0 of 3 every time it was ever seen, and struck-through lines would be
 * claiming credit for work the workspace did before this person arrived. It is
 * an explanation of the shape, which is what somebody who just got here needs.
 */
function FirstStepsMessage() {
  const { invoices, goTo } = useStore();
  const steps = [
    'An invoice arrives, and gets read',
    'You check the reading and the match',
    'It posts to your books',
  ];

  return (
    <NeoMessage>
      <Typography variant="body2">
        Three things happen on the way to your first posted invoice. That is the whole path.
      </Typography>
      <Stack
        sx={{ borderRadius: 1, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}
        divider={<Divider />}
      >
        {steps.map((label, index) => (
          <Stack
            key={label}
            direction="row"
            sx={{ gap: 1.5, alignItems: 'center', px: 2, py: 1.25 }}
          >
            <Box
              sx={{
                width: 20,
                height: 20,
                flexShrink: 0,
                borderRadius: 999,
                display: 'grid',
                placeItems: 'center',
                border: '1px solid',
                borderColor: 'divider',
              }}
              aria-hidden
            >
              <Typography variant="caption" color="text.secondary">
                {index + 1}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ flex: 1 }}>
              {label}
            </Typography>
            {/* One way in, on the step it belongs to. Suppressed while the
                workspace is empty, because the card above already carries it. */}
            {index === 0 && invoices.length > 0 && (
              <Button
                variant="secondary"
                appearance="outline"
                size="sm"
                endIcon={<ArrowRightIcon size={14} />}
                onClick={() => goTo('queue')}
              >
                Open the queue
              </Button>
            )}
          </Stack>
        ))}
      </Stack>
      <Typography variant="caption" color="text.secondary">
        Nothing to configure first — matching, tolerances and your ERP connection are already set.
      </Typography>
    </NeoMessage>
  );
}

/**
 * The only thing a genuinely empty workspace needs: one way in.
 *
 * Everything else is configured already and can be changed later, so there is
 * nothing to set up and no list to work through — the fastest route to seeing
 * what this does is one invoice, or the sample set if you have none to hand.
 */
function StartHereMessage() {
  const { invoices, goTo, runSamples } = useStore();
  if (invoices.length > 0) return null;

  return (
    <NeoMessage>
      <Typography variant="body2">
        Nothing has arrived yet. Send one invoice through and you will see the whole thing work —
        reading, matching against the purchase order, and posting.
      </Typography>
      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
        <Button size="sm" endIcon={<ArrowRightIcon size={14} />} onClick={() => goTo('queue')}>
          Upload an invoice
        </Button>
        <Button
          variant="secondary"
          appearance="outline"
          size="sm"
          onClick={() => {
            runSamples();
            // Straight to where they landed. A click whose result is on another
            // screen reads as a click that did nothing.
            goTo('queue');
          }}
        >
          Run a sample set instead
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        Matching, tolerances and your ERP connection are already set. Change them in Workflow or
        Workspace whenever you like.
      </Typography>
    </NeoMessage>
  );
}

/** The invoice you had open last. */
function ResumeMessage() {
  const { invoices, lastOpenedInvoiceId, openInvoice, config } = useStore();
  const invoice = lastOpenedInvoiceId
    ? invoices.find((i) => i.id === lastOpenedInvoiceId)
    : undefined;
  if (!invoice) return null;

  const closed = ['Posted', 'Exported', 'Rejected'].includes(invoice.status);
  const pending = invoice.invoiceFields.filter(
    (f) => f.confidence !== null && f.confidence < config.confidenceThreshold,
  ).length;

  return (
    <NeoMessage>
      <Typography variant="body2">
        {closed ? 'You finished this one.' : 'You were part way through this one.'}
      </Typography>
      <Stack
        direction="row"
        sx={{
          gap: 2,
          alignItems: 'center',
          flexWrap: 'wrap',
          p: 2,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack sx={{ flex: 1, minWidth: 200, gap: 0.5 }}>
          <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="body2" weight="medium">
              {invoice.number}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {invoice.vendor} · {money(invoice.amount, invoice.currency)}
            </Typography>
            <StatusChip status={invoice.status} />
          </Stack>
          {!closed && (
            <Typography variant="caption" color="text.secondary">
              {invoice.stage === 'extraction'
                ? `At extraction, with ${pending} ${pending === 1 ? 'field' : 'fields'} flagged for a look.`
                : invoice.stage === 'matching'
                  ? 'At matching.'
                  : 'Ready to post or download.'}
            </Typography>
          )}
        </Stack>
        <Button size="sm" endIcon={<ArrowRightIcon size={16} />} onClick={() => openInvoice(invoice.id)}>
          {closed ? 'Open it' : 'Resume'}
        </Button>
      </Stack>
    </NeoMessage>
  );
}

/* ── A conversation turn ──────────────────────────────────────────────── */

function ChatTurnView({ turn }: { turn: ChatTurn }) {
  if (turn.role === 'user') {
    return (
      <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
        <Box
          sx={{ px: 2, py: 1.25, borderRadius: 2, backgroundColor: 'primary.subtle', maxWidth: '80%' }}
        >
          <Typography variant="body2">{turn.text}</Typography>
        </Box>
      </Stack>
    );
  }
  return (
    <NeoMessage>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
        {turn.text}
      </Typography>
      {turn.sourceOff ? (
        <Alert
          severity="info"
          floating
          title={turn.remedy === 'document' ? 'A document is set aside' : 'A source is switched off'}
        >
          {turn.remedy === 'document'
            ? 'Tick it again behind the paperclip, then ask once more.'
            : 'Open the source picker beside the composer and switch it back on.'}
        </Alert>
      ) : (
        turn.ungrounded && (
          <Alert severity="info" floating title="No grounded source">
            Attach a document and it becomes answerable right away.
          </Alert>
        )
      )}
      {turn.citations && turn.citations.length > 0 && (
        <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
          {turn.citations.map((citation, index) => (
            <Chip
              key={`${citation.label}-${index}`}
              size="sm"
              variant="information"
              icon={<DatabaseIcon size={12} />}
              label={`${citation.label} · ${citation.detail}`}
            />
          ))}
        </Stack>
      )}
    </NeoMessage>
  );
}
/* ── Attachments ──────────────────────────────────────────────────────── */

/**
 * Kinds that belong to the invoice workflow rather than here. A purchase order
 * or a receipt note is part of a match, not reading material, so attaching one
 * to a conversation is almost always the wrong door.
 */
const BELONGS_IN_WORKFLOW = new Set<DocumentKind>(['invoice', 'po', 'grn']);

/**
 * What to do about a file attached at the wrong door.
 *
 * It is still indexed — throwing away what someone just picked is worse than a
 * misplaced file — so this offers the other route rather than blocking. Taking
 * it moves the file: it becomes an invoice record and stops being reading
 * material, because being both is the confusion this exists to remove.
 */
function MisfiledNotice({ names, onDismiss }: { names: string[]; onDismiss: () => void }) {
  const { documents, ingestUpload, removeDocument, goTo } = useStore();
  if (names.length === 0) return null;

  const one = names.length === 1;
  const send = () => {
    ingestUpload(names.map((name) => ({ name, kind: classifyFilename(name) })));
    for (const name of names) {
      const doc = documents.find((d) => d.name === name);
      if (doc) removeDocument(doc.id);
    }
    onDismiss();
    goTo('queue');
  };

  return (
    <Alert
      severity="info"
      title={`${one ? 'That looks like' : 'Those look like'} work for Invoice Processing`}
      onClose={onDismiss}
      action={
        <Button variant="secondary" appearance="outline" size="sm" onClick={send}>
          {one ? 'Send it there' : 'Send them there'}
        </Button>
      }
    >
      {names.join(', ')} {one ? 'is' : 'are'} indexed here, so you can ask about{' '}
      {one ? 'it' : 'them'}. Extracting, matching and posting happens in Invoice Processing.
    </Alert>
  );
}

/**
 * The paperclip: reference material to ask questions about.
 *
 * This is not the invoice inbox, and the difference is easy to miss — both take
 * a PDF. So the control says what it is for, and a file that looks like an
 * invoice is caught on the way in and offered the other route rather than
 * quietly becoming something you can only ask about.
 *
 * The picker is the real one: files come off disk, keep their names and sizes,
 * and survive a reload. Where the browser can read a file's text it is chunked
 * into pages and genuinely retrieved against; where it cannot, the document says
 * so instead of offering quotes it does not have.
 */
function AttachmentMenu({ onAttached }: { onAttached: (names: string[]) => void }) {
  const store = useStore();
  const { documents, addDocuments, excludedDocumentIds, setDocumentIncluded } = store;
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const [unread, setUnread] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement | null>(null);
  const totalPages = documents.reduce((sum, d) => sum + d.pages, 0);
  const inScope = documents.filter((d) => !excludedDocumentIds.includes(d.id));
  const scopedPages = inScope.reduce((sum, d) => sum + d.pages, 0);

  const take = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    const picked = Array.from(files);
    const result = await addDocuments(picked);
    setUnread(result.unread);
    setBusy(false);
    // Anything that belongs in the invoice workflow, for the screen to offer.
    onAttached(
      picked.map((f) => f.name).filter((name) => BELONGS_IN_WORKFLOW.has(classifyFilename(name))),
    );
  };

  return (
    <>
      {/* Off-screen rather than hidden, so the click that opens it is the user's
          own and the OS picker is allowed to appear. */}
      <Box
        component="input"
        ref={fileInput}
        type="file"
        multiple
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          void take(event.target.files);
          // Cleared so picking the same file twice fires change both times.
          event.target.value = '';
        }}
        sx={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}
      />

      <Tooltip title="Attach something to ask about">
        <IconButton
          variant="secondary"
          appearance="text"
          size="md"
          aria-label="Attach something to ask about"
          onClick={(event) => setAnchor(event.currentTarget)}
        >
          <PaperclipIcon />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        sx={{ '& .MuiMenu-paper': { minWidth: 380, maxWidth: 460 } }}
      >
        {/* Says what this is for, next to the thing it is not for. */}
        <MenuItem variant="secondary" disabled sx={{ whiteSpace: 'normal' }}>
          <Stack sx={{ gap: 0.25 }}>
            <Typography variant="caption" weight="medium">
              Reading material
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Contracts, policies, reports — anything you want to ask questions about. Invoices to
              extract and post go to the Invoices dashboard instead.
            </Typography>
          </Stack>
        </MenuItem>
        <Divider />
        <MenuItem
          variant="action"
          disabled={busy}
          onClick={() => {
            setUnread([]);
            fileInput.current?.click();
            setAnchor(null);
          }}
        >
          <UploadSimpleIcon size={16} />
          {busy ? 'Indexing…' : 'Attach a document to ask about'}
        </MenuItem>

        <Divider />

        {documents.length === 0 ? (
          <MenuItem variant="secondary" disabled>
            Nothing attached yet. However long it is, it goes in whole.
          </MenuItem>
        ) : (
          <>
            <MenuItem variant="secondary" disabled>
              {inScope.length === documents.length
                ? `All ${documents.length} in scope · ${totalPages.toLocaleString('en-US')} pages`
                : `${inScope.length} of ${documents.length} in scope · ${scopedPages.toLocaleString('en-US')} pages`}
            </MenuItem>
            {documents.map((doc) => {
              const included = !excludedDocumentIds.includes(doc.id);
              return (
                <MenuItem
                  key={doc.id}
                  // Checkable rather than deletable: setting a document aside is
                  // reversible, and losing one to a stray click is not.
                  role="menuitemcheckbox"
                  aria-checked={included}
                  onClick={() => setDocumentIncluded(doc.id, !included)}
                  sx={{ alignItems: 'flex-start' }}
                >
                  <Box sx={{ width: 16, flexShrink: 0, pt: 0.25 }} aria-hidden>
                    {included && <CheckIcon size={16} />}
                  </Box>
                  <Stack sx={{ flex: 1, minWidth: 0, gap: 0 }}>
                    <Typography
                      variant="body2"
                      noWrap
                      color={included ? 'text.primary' : 'text.secondary'}
                    >
                      {doc.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {doc.pages} page{doc.pages === 1 ? '' : 's'} ·{' '}
                      {formatRelative(doc.indexedAt)}
                      {doc.isSample && ' · sample'}
                      {doc.contentRead === false && ' · held, contents not read'}
                      {!included && ' · set aside'}
                    </Typography>
                  </Stack>
                </MenuItem>
              );
            })}
          </>
        )}

        {unread.length > 0 && (
          <>
            <Divider />
            <MenuItem variant="secondary" disabled sx={{ whiteSpace: 'normal' }}>
              <Stack sx={{ gap: 0.25 }}>
                <Typography variant="caption" color="text.secondary">
                  Held but not read: {unread.join(', ')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  This prototype reads text files. A PDF is kept and counted, but nothing is
                  quoted from it.
                </Typography>
              </Stack>
            </MenuItem>
          </>
        )}
      </Menu>
    </>
  );
}

/* ── Sources ──────────────────────────────────────────────────────────── */

/**
 * Which sources a question may draw on.
 *
 * Only workflows this person holds a role in appear, plus the documents they
 * attached by hand. Switching one off is honored in the answer: Neo names the
 * source it would have used rather than pretending the question has no answer.
 */
function SourcePicker() {
  const store = useStore();
  const { selectedSources, setSourceSelected } = store;
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);

  const sources = availableSources({
    invoices: store.invoices,
    memory: store.memory,
    config: store.config,
    members: store.members,
    documents: store.documents,
    connections: store.connections,
    viewer: store.viewer,
  });
  const isOn = (id: (typeof sources)[number]['id']) =>
    selectedSources === null || selectedSources.includes(id);
  const onCount = sources.filter((s) => isOn(s.id)).length;

  return (
    <>
      <Tooltip title="Choose what Neo may read">
        <Button
          variant="secondary"
          appearance="outline"
          size="sm"
          startIcon={<DatabaseIcon size={16} />}
          endIcon={<CaretDownIcon size={14} />}
          onClick={(event) => setAnchor(event.currentTarget)}
          sx={{ textTransform: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          {onCount === sources.length ? 'All sources' : `${onCount} of ${sources.length} sources`}
        </Button>
      </Tooltip>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        sx={{ '& .MuiMenu-paper': { minWidth: 380, maxWidth: 460 } }}
      >
        {sources.map((source) => (
          <MenuItem
            key={source.id}
            // A checkable menu item, rather than a checkbox nested inside one:
            // Atoms' Checkbox omits inputProps, so it could not be named, and a
            // focusable control inside a menuitem is its own problem. The row is
            // the control.
            role="menuitemcheckbox"
            aria-checked={isOn(source.id)}
            onClick={() => setSourceSelected(source.id, !isOn(source.id))}
            sx={{ alignItems: 'flex-start' }}
          >
            <Box sx={{ width: 16, flexShrink: 0, pt: 0.25 }} aria-hidden>
              {isOn(source.id) && <CheckIcon size={16} />}
            </Box>
            <Stack sx={{ flex: 1, minWidth: 0, gap: 0 }}>
              <Typography variant="body2">{source.label}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'normal' }}>
                {source.detail}
              </Typography>
            </Stack>
          </MenuItem>
        ))}
        <Divider />
        <MenuItem variant="secondary" disabled sx={{ whiteSpace: 'normal' }}>
          <Typography variant="caption" color="text.secondary">
            A workflow you hold no role in is not listed. What a workflow reads from — an ERP, a
            mailbox, a ticketing system — comes in through the workflow, so it is not picked
            separately.
          </Typography>
        </MenuItem>
      </Menu>
    </>
  );
}

/* ── The screen ───────────────────────────────────────────────────────── */

export function AskNeoScreen() {
  const store = useStore();
  const {
    invoices,
    chat,
    pushChat,
    profile,
    landingMode,
    handoffQuestion,
    clearHandoff,
  } = store;

  const [draft, setDraft] = React.useState('');
  /** Files just attached that belong in the invoice workflow, not here. */
  const [misfiled, setMisfiled] = React.useState<string[]>([]);
  /** The conversation on screen, if one has been spoken in. */
  const open = store.conversations.find((c) => c.id === store.activeConversationId) ?? null;
  const endRef = React.useRef<HTMLDivElement | null>(null);
  const firstVisit = landingMode === 'first';
  const name = profile.firstName || 'there';

  // Only once a conversation is running. On arrival the greeting is the thing to
  // see, and scrolling to the end would push straight past it.
  React.useEffect(() => {
    if (chat.length === 0) return;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat.length]);

  const ask = React.useCallback(
    (question: string) => {
      const trimmed = question.trim();
      if (trimmed === '') return;
      const result = answerQuestion(
        trimmed,
        {
          invoices,
          memory: store.memory,
          config: store.config,
          members: store.members,
          documents: store.documents,
          connections: store.connections,
          viewer: store.viewer,
          selectedSources: store.selectedSources ?? undefined,
          excludedDocumentIds: store.excludedDocumentIds,
        },
        { scope: 'workspace' },
      );
      const stamp = Date.now();
      pushChat([
        { id: `u-${stamp}`, role: 'user', text: trimmed },
        {
          id: `n-${stamp + 1}`,
          role: 'neo',
          text: result.text,
          citations: result.citations,
          ungrounded: result.ungrounded,
          sourceOff: result.sourceOff,
          remedy: result.remedy,
        },
      ]);
      setDraft('');
    },
    [
      invoices,
      store.memory,
      store.config,
      store.members,
      store.documents,
      store.connections,
      store.viewer,
      store.selectedSources,
      store.excludedDocumentIds,
      pushChat,
    ],
  );

  React.useEffect(() => {
    if (handoffQuestion) {
      ask(handoffQuestion);
      clearHandoff();
    }
  }, [handoffQuestion, ask, clearHandoff]);

  return (
    <>
      {/* Nothing of its own here. Starting a thread and picking one both live
          in the rail's Threads section, which is on screen either way. */}
      <ShellBar />

      {/* The thread. Everything Neo has to say, oldest first. */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <Box sx={{ maxWidth: COLUMN, mx: 'auto', px: 3, pt: 4, pb: 3 }}>
          <Stack sx={{ gap: 3 }}>
            {/* A conversation is headed by what it was about. The greeting and
                the briefing belong to an empty page: once you are reading a
                thread, "here is what changed while you were away" is noise, and
                above a thread from last week it is wrong. */}
            {open ? (
              <Stack sx={{ gap: 0.5 }}>
                <Typography variant="h4" component="h1">
                  {open.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Asked {formatRelative(open.startedAt)}
                </Typography>
              </Stack>
            ) : (
              <>
                <Stack sx={{ gap: 0.5 }}>
                  <Typography variant="h3" component="h1">
                    {firstVisit ? `Welcome to Neoflo, ${name}` : `${timeOfDay()}, ${name}`}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {firstVisit
                      ? 'I read your invoices, check them against your purchase orders and receipts, and bring you only what needs a person.'
                      : 'Ask me anything about your invoices, vendors or documents.'}
                  </Typography>
                </Stack>

                {/* Value first, either way. A first visit gets what is already
                    waiting rather than a list of things to do; an empty
                    workspace gets one way in rather than five. */}
                <StartHereMessage />
                <BriefingMessage firstVisit={firstVisit} />
                {firstVisit && <FirstStepsMessage />}
                {!firstVisit && <ResumeMessage />}
              </>
            )}

            {chat.map((turn) => (
              <ChatTurnView key={turn.id} turn={turn} />
            ))}
            <div ref={endRef} />
          </Stack>
        </Box>
      </Box>

      {/* The composer, where a chat window keeps it. */}
      <Box
        data-composer-dock
        sx={{ flexShrink: 0, borderTop: '1px solid', borderColor: 'divider' }}
      >
        <Box sx={{ maxWidth: COLUMN, mx: 'auto', px: 3, pt: 2, pb: 2 }}>
          <Stack sx={{ gap: 1.5 }}>
            <MisfiledNotice names={misfiled} onDismiss={() => setMisfiled([])} />

            {chat.length === 0 && (
              <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
                {suggestedQuestions()
                  .slice(0, 4)
                  .map((prompt) => (
                    <Chip
                      key={prompt}
                      size="sm"
                      appearance="outline"
                      variant="secondary"
                      label={prompt}
                      onClick={() => ask(prompt)}
                    />
                  ))}
              </Stack>
            )}

            <Stack direction="row" sx={{ gap: 1, alignItems: 'flex-end' }}>
              <AttachmentMenu onAttached={setMisfiled} />
              <SourcePicker />
              <TextField
                aria-label="Ask Neo a question"
                placeholder="Ask about your invoices, contracts, vendors or team…"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    ask(draft);
                  }
                }}
                multiline
                minRows={1}
                maxRows={6}
                fullWidth
              />
              <IconButton
                aria-label="Send"
                size="md"
                disabled={draft.trim() === ''}
                onClick={() => ask(draft)}
              >
                <PaperPlaneRightIcon />
              </IconButton>
            </Stack>
          </Stack>
        </Box>
      </Box>
    </>
  );
}
