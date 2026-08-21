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
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  DatabaseIcon,
  FilePdfIcon,
  PaperPlaneRightIcon,
  PaperclipIcon,
  SparkleIcon,
  TrashIcon,
  UploadSimpleIcon,
} from '@neofloai/atoms/icons';
import { useStore } from '../store';
import { StatusChip } from '../components/common';
import { ShellBar } from '../components/shell';
import { answerQuestion, groundingSources, suggestedQuestions } from '../neo';
import { money } from '../engine';
import { formatRelative } from '../clock';
import type { ChatTurn } from '../types';

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

/** What changed since the last visit. */
function BriefingMessage() {
  const { invoices, memory, config, goTo, openInvoice } = useStore();
  const needsMe = invoices.filter((i) => i.status === 'Action Required');
  const stp = invoices.filter((i) => i.stpPosted);
  const learned = memory.filter((m) => m.streak >= config.memoryThreshold);

  return (
    <NeoMessage>
      <Typography variant="body2">Here is what changed while you were away.</Typography>
      <Stack direction="row" sx={{ gap: 1.5, flexWrap: 'wrap' }}>
        <Tile
          value={needsMe.length}
          label={needsMe.length === 1 ? 'invoice needs you' : 'invoices need you'}
          detail={needsMe.slice(0, 3).map((i) => i.number).join(', ') || undefined}
          action={
            needsMe.length > 0 ? (
              <Button size="sm" endIcon={<ArrowRightIcon size={14} />} onClick={() => goTo('queue')}>
                Open the queue
              </Button>
            ) : undefined
          }
        />
        <Tile
          value={stp.length}
          label="posted without needing you"
          detail={stp.map((i) => i.number).join(', ') || undefined}
          action={
            stp.length > 0 ? (
              <Button
                variant="secondary"
                appearance="outline"
                size="sm"
                onClick={() => openInvoice(stp[0].id)}
              >
                Open {stp[0].number}
              </Button>
            ) : undefined
          }
        />
        <Tile
          value={learned.length}
          label={learned.length === 1 ? 'pattern learned' : 'patterns learned'}
          detail={learned.map((m) => m.field).join(', ') || undefined}
        />
      </Stack>
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
    (f) => f.confidence !== null && f.confidence < config.confidenceThreshold && !f.acknowledged,
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
                ? `At extraction, with ${pending} ${pending === 1 ? 'field' : 'fields'} still to confirm.`
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

/** The activation checklist, as something Neo offers rather than a panel. */
function ChecklistMessage() {
  const { progress, connections, goTo, dismissChecklist } = useStore();

  const items = [
    { label: 'Connect Zoho', done: connections.zohoBooks, go: () => goTo('workspace-config') },
    { label: 'Upload an invoice or run a sample', done: progress.ingested, go: () => goTo('queue') },
    { label: 'Review extraction and matching', done: progress.reviewed, go: () => goTo('queue') },
    { label: 'Post or download', done: progress.completed, go: () => goTo('queue') },
    { label: 'Invite a colleague', done: progress.invited, go: () => goTo('members') },
  ];
  const doneCount = items.filter((i) => i.done).length;
  if (progress.checklistDismissed || doneCount === items.length) return null;
  const next = items.find((i) => !i.done);

  return (
    <NeoMessage>
      <Typography variant="body2">
        Here is the shortest path to your first posted invoice. {doneCount} of {items.length} done.
      </Typography>
      <Stack
        sx={{ borderRadius: 1, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}
        divider={<Divider />}
      >
        {items.map((item) => (
          <Stack key={item.label} direction="row" sx={{ gap: 1.5, alignItems: 'center', px: 2, py: 1.25 }}>
            <Box sx={{ color: item.done ? 'success.main' : 'text.disabled', display: 'flex' }}>
              <CheckCircleIcon size={18} />
            </Box>
            <Typography
              variant="body2"
              sx={{ flex: 1, textDecoration: item.done ? 'line-through' : 'none' }}
              color={item.done ? 'text.secondary' : 'text.primary'}
            >
              {item.label}
            </Typography>
            {item === next && (
              <Button variant="secondary" appearance="outline" size="sm" onClick={item.go}>
                Start
              </Button>
            )}
          </Stack>
        ))}
      </Stack>
      <Box>
        <Button variant="secondary" appearance="text" size="sm" onClick={dismissChecklist}>
          Hide this
        </Button>
      </Box>
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
      {turn.ungrounded && (
        <Alert severity="info" floating title="No grounded source">
          Attach a document and it becomes answerable right away.
        </Alert>
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
 * The paperclip. Attaching a document is what indexing is, so the documents Neo
 * already holds live behind the same control rather than in a panel of their own.
 */
function AttachmentMenu() {
  const store = useStore();
  const { documents, addDocument, removeDocument } = store;
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const totalPages = documents.reduce((sum, d) => sum + d.pages, 0);
  const sources = groundingSources({
    invoices: store.invoices,
    memory: store.memory,
    config: store.config,
    members: store.members,
    documents: store.documents,
    connections: store.connections,
  });

  return (
    <>
      <Tooltip title="Attach a document">
        <IconButton
          variant="secondary"
          appearance="text"
          size="md"
          aria-label="Attach a document"
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
        <MenuItem
          variant="action"
          onClick={() => {
            addDocument();
            setAnchor(null);
          }}
        >
          <UploadSimpleIcon size={16} />
          Attach a document
        </MenuItem>

        <Divider />

        {documents.length === 0 ? (
          <MenuItem variant="secondary" disabled>
            Nothing attached yet. Long documents go in whole.
          </MenuItem>
        ) : (
          <>
            <MenuItem variant="secondary" disabled>
              {documents.length} attached · {totalPages.toLocaleString('en-US')} pages
            </MenuItem>
            {documents.map((doc) => (
              <MenuItem key={doc.id} sx={{ alignItems: 'flex-start' }}>
                <FilePdfIcon size={16} />
                <Stack sx={{ flex: 1, minWidth: 0, gap: 0 }}>
                  <Typography variant="body2" noWrap>
                    {doc.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {doc.pages} pages · {formatRelative(doc.indexedAt)}
                  </Typography>
                </Stack>
                <Tooltip title="Remove">
                  <IconButton
                    variant="secondary"
                    appearance="text"
                    size="sm"
                    aria-label={`Remove ${doc.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      removeDocument(doc.id);
                    }}
                  >
                    <TrashIcon />
                  </IconButton>
                </Tooltip>
              </MenuItem>
            ))}
          </>
        )}

        <Divider />
        <MenuItem variant="secondary" disabled sx={{ whiteSpace: 'normal' }}>
          <Stack sx={{ gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Neo can also read
            </Typography>
            <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
              {sources
                .filter((s) => s.label !== 'Indexed documents')
                .map((source) => (
                  <Chip
                    key={source.label}
                    size="sm"
                    variant={source.connected ? 'success' : 'secondary'}
                    label={source.label}
                  />
                ))}
            </Stack>
          </Stack>
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
    clearChat,
    profile,
    landingMode,
    handoffQuestion,
    clearHandoff,
  } = store;

  const [draft, setDraft] = React.useState('');
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
        },
      ]);
      setDraft('');
    },
    [invoices, store.memory, store.config, store.members, store.documents, store.connections, pushChat],
  );

  React.useEffect(() => {
    if (handoffQuestion) {
      ask(handoffQuestion);
      clearHandoff();
    }
  }, [handoffQuestion, ask, clearHandoff]);

  return (
    <>
      <ShellBar>
        {chat.length > 0 && (
          <Button
            variant="secondary"
            appearance="outline"
            size="sm"
            startIcon={<ArrowLeftIcon size={16} />}
            onClick={clearChat}
          >
            New question
          </Button>
        )}
      </ShellBar>

      {/* The thread. Everything Neo has to say, oldest first. */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <Box sx={{ maxWidth: COLUMN, mx: 'auto', px: 3, pt: 4, pb: 3 }}>
          <Stack sx={{ gap: 3 }}>
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

            {firstVisit ? (
              <ChecklistMessage />
            ) : (
              <>
                <BriefingMessage />
                <ResumeMessage />
                <ChecklistMessage />
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
      <Box sx={{ flexShrink: 0, borderTop: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ maxWidth: COLUMN, mx: 'auto', px: 3, pt: 2, pb: 2 }}>
          <Stack sx={{ gap: 1.5 }}>
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
              <AttachmentMenu />
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
