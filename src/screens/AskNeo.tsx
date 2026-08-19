import * as React from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@neofloai/atoms';
import {
  ArrowRightIcon,
  CheckCircleIcon,
  DatabaseIcon,
  LightningIcon,
  PaperPlaneRightIcon,
  SparkleIcon,
} from '@neofloai/atoms/icons';
import { LAST_VISIT } from '../data';
import { useStore } from '../store';
import { PageBody, StatusChip } from '../components/common';
import { ShellBar } from '../components/shell';
import { money } from '../engine';
import type { ChatTurn, Citation, Invoice } from '../types';

/* ── The answer engine ────────────────────────────────────────────────── */

interface Answer {
  text: string;
  citations?: Citation[];
  ungrounded?: boolean;
}

/**
 * Answers are grounded in the workspace's own records. Where there is no
 * grounded source the answer is "I don't have enough information", never a
 * guess (Journey §2).
 */
function answer(question: string, invoices: Invoice[], store: ReturnType<typeof useStore>): Answer {
  const q = question.toLowerCase();
  const real = invoices.filter((i) => !i.isSample);
  const cite = (invoice: Invoice): Citation => ({
    label: invoice.number,
    detail: `${invoice.vendor} · ${invoice.invoiceDate} · ${invoice.status}`,
  });

  const needsMe = invoices.filter((i) => i.status === 'Action Required');
  const posted = real.filter((i) => i.status === 'Posted');
  const exported = real.filter((i) => i.status === 'Exported');
  const rejected = real.filter((i) => i.status === 'Rejected');

  if (/need|action|attention|waiting|stuck|blocked/.test(q)) {
    if (needsMe.length === 0) {
      return { text: 'Nothing needs you right now. Every invoice in the queue is either moving on its own or already closed.' };
    }
    const lines = needsMe.map((i) => {
      const block = i.matchResult?.hardBlock;
      const why = block === 'no-grn'
        ? 'no goods receipt, and the match type is 3-way'
        : block === 'no-po'
          ? 'no purchase order'
          : block === 'duplicate'
            ? 'a duplicate of an invoice already processed'
            : i.stage === 'extraction'
              ? 'fields below the confidence threshold'
              : 'a variance beyond tolerance';
      return `• ${i.number} — ${i.vendor}, ${money(i.amount, i.currency)}: ${why}`;
    });
    return {
      text: `${needsMe.length} invoice${needsMe.length === 1 ? '' : 's'} need you:\n\n${lines.join('\n')}`,
      citations: needsMe.map(cite),
    };
  }

  if (/posted|paid|zoho|erp/.test(q)) {
    if (posted.length === 0) return { text: 'Nothing has posted to Zoho from this workspace yet.' };
    const total = posted.reduce((sum, i) => sum + i.amount, 0);
    const stp = posted.filter((i) => i.stpPosted);
    return {
      text: `${posted.length} invoice${posted.length === 1 ? '' : 's'} posted to Zoho Books, totalling ${money(total)}. ${
        stp.length > 0
          ? `${stp.length} of those posted by straight-through processing and never surfaced to anyone.`
          : 'All of them were worked by a person first.'
      }`,
      citations: posted.map(cite),
    };
  }

  if (/duplicate/.test(q)) {
    const dupes = invoices.filter((i) => i.matchResult?.hardBlock === 'duplicate');
    if (dupes.length === 0) return { text: 'No duplicates have been caught in this workspace.' };
    return {
      text: `${dupes.length} invoice${dupes.length === 1 ? ' was' : 's were'} caught as duplicates. Duplicate detection runs first and is tenant-wide, so it spans every workspace in the organisation — and on a hit the other two checks are skipped. A duplicate cannot be overridden; it is rejected by a person, with a reason.`,
      citations: dupes.map(cite),
    };
  }

  if (/override/.test(q)) {
    const withOverrides = invoices.filter((i) => i.overrides.length > 0);
    if (withOverrides.length === 0) return { text: 'No overrides have been recorded in this workspace.' };
    return {
      text: withOverrides
        .flatMap((i) => i.overrides.map((o) => `• ${i.number} — ${o.rule}, by ${o.actor}: “${o.reason}”`))
        .join('\n'),
      citations: withOverrides.map(cite),
    };
  }

  if (/learn|memory|remember|suggest/.test(q)) {
    const live = store.memory.filter((m) => m.streak >= store.config.memoryThreshold);
    const building = store.memory.filter((m) => m.streak < store.config.memoryThreshold);
    return {
      text: `${live.length} pattern${live.length === 1 ? '' : 's'} ${live.length === 1 ? 'is' : 'are'} live and offered back as suggestions:\n\n${live
        .map((m) => `• ${m.field} — ${m.patternKey} → ${m.suggestedValue} (${m.streak} acknowledgements)`)
        .join('\n')}${
        building.length > 0
          ? `\n\n${building.length} more ${building.length === 1 ? 'is' : 'are'} still building a streak, and will be offered at ${store.config.memoryThreshold}:\n\n${building
              .map((m) => `• ${m.field} — ${m.patternKey} (${m.streak} of ${store.config.memoryThreshold})`)
              .join('\n')}`
          : ''
      }\n\nA suggestion is always accepted explicitly. Nothing is ever filled in behind you.`,
      citations: [{ label: 'Workflow memory', detail: `Threshold ${store.config.memoryThreshold} · scoped to this workflow instance` }],
    };
  }

  if (/tolerance|threshold|match type|3-way|2-way|config|setting|straight/.test(q)) {
    const c = store.config;
    return {
      text: `This workflow runs a ${c.matchType} match. Confidence threshold is ${c.confidenceThreshold}% on both invoice and reference fields. Total tolerance is ${money(c.totalToleranceAbsolute)} or ${c.totalTolerancePercent}%, line tolerance ${money(c.lineToleranceAbsolute)} or ${c.lineTolerancePercent}%. Straight-through processing is ${c.straightThrough ? 'on' : 'off'}, and memory forms at ${c.memoryThreshold} acknowledgements.\n\nA change to any of these reaches what runs next — it does not re-grade invoices already decided.`,
      citations: [{ label: 'Workflow configuration', detail: 'Invoice Processing · this workspace' }],
    };
  }

  if (/who|member|team|role|permission/.test(q)) {
    return {
      text: store.members
        .map((m) => `• ${m.name} — Invoice Processing: ${m.invoiceProcessing}, Agentic Search: ${m.agenticSearch} (${m.status})`)
        .join('\n'),
      citations: [{ label: 'Workspace members', detail: `${store.members.length} people` }],
    };
  }

  if (/cycle|touch|how long|how fast|time|metric|report/.test(q)) {
    const surfaced = real.filter((i) => i.firstSurfacedAt !== null && i.terminalAt !== null);
    const fromErp = real.filter((i) => i.poSource === 'zoho').length;
    return {
      text: `Across ${real.length} real invoices: ${posted.length} posted, ${exported.length} exported, ${rejected.length} rejected, ${needsMe.length} still needing a person.\n\n${surfaced.length} of the closed ones surfaced to a user at some point — straight-through invoices are excluded from touch time rather than counted as zero. ${fromErp} of ${real.length} matched against Zoho data rather than uploaded documents.`,
      citations: [{ label: 'Reporting', detail: 'Per workflow, rolled up per workspace' }],
    };
  }

  // Vendor lookup.
  const vendors = [...new Set(invoices.map((i) => i.vendor))];
  const matchedVendor = vendors.find((v) => q.includes(v.toLowerCase().split(' ')[0]));
  if (matchedVendor) {
    const theirs = invoices.filter((i) => i.vendor === matchedVendor);
    const total = theirs.reduce((sum, i) => sum + i.amount, 0);
    return {
      text: `${theirs.length} invoice${theirs.length === 1 ? '' : 's'} from ${matchedVendor}, totalling ${money(total)}:\n\n${theirs
        .map((i) => `• ${i.number} — ${money(i.amount, i.currency)}, ${i.invoiceDate}, ${i.status}`)
        .join('\n')}`,
      citations: theirs.map(cite),
    };
  }

  if (/how many|total|spend|value|queue/.test(q)) {
    const total = real.reduce((sum, i) => sum + i.amount, 0);
    return {
      text: `${invoices.length} invoices in this workspace, ${real.length} of them real and ${invoices.length - real.length} marked as sample data. The real ones total ${money(total)}. Sample records are excluded from reporting and never post to a connected ERP.`,
      citations: [{ label: 'Invoice queue', detail: `${invoices.length} records` }],
    };
  }

  return {
    text: "I don't have enough information to answer that from your workspace. I can only answer from documents you have indexed, your invoice records, and the tools you have connected — and I would rather say so than guess.\n\nIn this version I answer, I do not act.",
    ungrounded: true,
  };
}

/* ── The briefing ─────────────────────────────────────────────────────── */

/**
 * On every visit after the first, the landing opens with what has changed since
 * the user was last here — composed live from their own workspace (Journey §2).
 */
function Briefing() {
  const { invoices, memory, config, goTo, openInvoice } = useStore();

  const needsMe = invoices.filter((i) => i.status === 'Action Required');
  const stp = invoices.filter((i) => i.stpPosted);
  const learned = memory.filter((m) => m.streak >= config.memoryThreshold);

  return (
    <Card component="section">
      <CardContent>
        <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', mb: 2 }}>
          <Avatar size="sm" color="primary">
            <SparkleIcon size={14} />
          </Avatar>
          <Stack sx={{ gap: 0 }}>
            <Typography variant="body1" weight="medium">
              Since you were last here
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {LAST_VISIT}
            </Typography>
          </Stack>
        </Stack>

        <Stepper activeStep={-1}>
          <Step expanded completed={stp.length > 0}>
            <StepLabel>
              {stp.length > 0
                ? `${stp.length} invoice${stp.length === 1 ? '' : 's'} posted without needing you`
                : 'Nothing posted unsupervised'}
            </StepLabel>
            <StepContent>
              <Stack sx={{ gap: 1.5 }}>
                <Typography variant="body2" color="text.secondary">
                  {stp.length > 0
                    ? `Clean invoice, ERP connected, nothing flagged — straight-through processing posted ${stp.length === 1 ? 'it' : 'them'} and ${stp.length === 1 ? 'it' : 'they'} never surfaced. ${stp.map((i) => i.number).join(', ')}. The full audit trail is on each record.`
                    : 'Straight-through processing is on, but nothing has cleared every stage unsupervised yet.'}
                </Typography>
                {stp.length > 0 && (
                  <Box>
                    <Button
                      variant="secondary"
                      appearance="outline"
                      size="sm"
                      onClick={() => openInvoice(stp[0].id)}
                    >
                      Open {stp[0].number}
                    </Button>
                  </Box>
                )}
              </Stack>
            </StepContent>
          </Step>

          <Step expanded completed={false}>
            <StepLabel error={needsMe.length > 0}>
              {needsMe.length > 0
                ? `${needsMe.length} invoice${needsMe.length === 1 ? '' : 's'} need you`
                : 'Nothing needs you'}
            </StepLabel>
            <StepContent>
              <Stack sx={{ gap: 1.5 }}>
                {needsMe.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Every invoice is either moving on its own or already closed.
                  </Typography>
                ) : (
                  <>
                    <Stack sx={{ gap: 0.5 }}>
                      {needsMe.slice(0, 4).map((invoice) => (
                        <Stack
                          key={invoice.id}
                          direction="row"
                          sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}
                        >
                          <Typography variant="body2" weight="medium">
                            {invoice.number}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {invoice.vendor} · {money(invoice.amount, invoice.currency)}
                          </Typography>
                          <StatusChip status={invoice.status} />
                        </Stack>
                      ))}
                    </Stack>
                    <Box>
                      <Button
                        size="sm"
                        endIcon={<ArrowRightIcon size={14} />}
                        onClick={() => goTo('queue')}
                      >
                        Open the queue
                      </Button>
                    </Box>
                  </>
                )}
              </Stack>
            </StepContent>
          </Step>

          <Step expanded completed={learned.length > 0}>
            <StepLabel>
              {learned.length > 0
                ? `${learned.length} pattern${learned.length === 1 ? '' : 's'} learned`
                : 'Nothing learned yet'}
            </StepLabel>
            <StepContent>
              <Typography variant="body2" color="text.secondary">
                {learned.length > 0
                  ? `${learned.map((m) => `${m.field} for ${m.patternKey.split(' · ')[0]}`).join('; ')}. Each is offered back as a suggestion you accept — never filled in behind you.`
                  : `Memory is silent until a correction has been acknowledged ${config.memoryThreshold} times. That is the evidence, and there is no admin gate.`}
              </Typography>
            </StepContent>
          </Step>
        </Stepper>
      </CardContent>
    </Card>
  );
}

/* ── Activation checklist ─────────────────────────────────────────────── */

/** Stays visible until done (Workflow PRD §12). */
function ActivationChecklist() {
  const { progress, connections, goTo, dismissChecklist } = useStore();

  const items = [
    { label: 'Connect Zoho', done: connections.zohoBooks, go: () => goTo('connections'), note: 'Skippable — the CSV export path is first-class.' },
    { label: 'Upload an invoice or run a sample', done: progress.ingested, go: () => goTo('queue'), note: 'Three samples: a clean match, a variance, and a duplicate.' },
    { label: 'Review extraction and matching', done: progress.reviewed, go: () => goTo('queue'), note: 'Confidence per field, variance against the PO and GRN.' },
    { label: 'Post or download', done: progress.completed, go: () => goTo('queue'), note: 'Post to Zoho, or take the matched-data CSV away.' },
    { label: 'Invite a colleague', done: progress.invited, go: () => goTo('members'), note: 'A role per workflow, pre-filled from the default.' },
  ];

  const doneCount = items.filter((i) => i.done).length;
  if (progress.checklistDismissed || doneCount === items.length) return null;

  return (
    <Card component="section">
      <CardContent>
        <Stack direction="row" sx={{ gap: 2, alignItems: 'center', mb: 2 }}>
          <Stack sx={{ flex: 1, gap: 0.25 }}>
            <Typography variant="h6" component="h2">
              Get to your first posted invoice
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {doneCount} of {items.length} done. The target is a first invoice reaching Posted or
              Exported within 7 minutes of first login.
            </Typography>
          </Stack>
          <Chip size="sm" variant={doneCount === items.length ? 'success' : 'primary'} label={`${doneCount}/${items.length}`} />
        </Stack>

        <Stack divider={<Divider />}>
          {items.map((item) => (
            <Stack
              key={item.label}
              direction="row"
              sx={{ gap: 2, alignItems: 'center', py: 1.5 }}
            >
              <Box sx={{ color: item.done ? 'success.main' : 'text.disabled', display: 'flex' }}>
                <CheckCircleIcon size={20} />
              </Box>
              <Stack sx={{ flex: 1, minWidth: 0, gap: 0 }}>
                <Typography
                  variant="body2"
                  weight="medium"
                  sx={{ textDecoration: item.done ? 'line-through' : 'none' }}
                  color={item.done ? 'text.secondary' : 'text.primary'}
                >
                  {item.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.note}
                </Typography>
              </Stack>
              {!item.done && (
                <Button variant="secondary" appearance="text" size="sm" onClick={item.go}>
                  Go
                </Button>
              )}
            </Stack>
          ))}
        </Stack>

        <Stack direction="row" sx={{ justifyContent: 'flex-end', mt: 2 }}>
          <Button variant="secondary" appearance="text" size="sm" onClick={dismissChecklist}>
            Hide this
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

/* ── The screen ───────────────────────────────────────────────────────── */

const SUGGESTED = [
  'What needs me?',
  'What posted while I was away?',
  'Have we caught any duplicates?',
  'What have you learned so far?',
  'What are my tolerances set to?',
  'How much have we had from Redwood?',
];

export function AskNeoScreen() {
  const store = useStore();
  const { invoices, chat, pushChat, profile, visitedAskNeo, markAskNeoVisited } = store;
  const [draft, setDraft] = React.useState('');
  const endRef = React.useRef<HTMLDivElement | null>(null);

  // Captured on mount. Reading `visitedAskNeo` during render would flip to the
  // returning view the moment the effect below fires, so the greeting would
  // appear and vanish in the same paint.
  const firstVisitRef = React.useRef(!visitedAskNeo);
  const firstVisit = firstVisitRef.current;

  React.useEffect(() => {
    markAskNeoVisited();
  }, [markAskNeoVisited]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat.length]);

  const ask = (question: string) => {
    const trimmed = question.trim();
    if (trimmed === '') return;
    const result = answer(trimmed, invoices, store);
    const turns: ChatTurn[] = [
      { id: `u-${Date.now()}`, role: 'user', text: trimmed },
      {
        id: `n-${Date.now() + 1}`,
        role: 'neo',
        text: result.text,
        citations: result.citations,
        ungrounded: result.ungrounded,
      },
    ];
    pushChat(turns);
    setDraft('');
  };

  return (
    <>
      <ShellBar />

      <PageBody maxWidth={860}>
        <Stack sx={{ gap: 3 }}>
          <Stack sx={{ gap: 0.5 }}>
            <Typography variant="h3" component="h1">
              {firstVisit ? `Hello, ${profile.firstName || 'there'}` : 'Ask Neo'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {firstVisit
                ? 'I answer questions about your own data — invoices, purchase orders, receipts and anything you index. Every answer is cited, and every source is permission-checked at the moment you ask.'
                : 'Ask anything about your workspace. Read-only in this version: I answer, I do not act.'}
            </Typography>
          </Stack>

          <ActivationChecklist />

          {!firstVisit && <Briefing />}

          {chat.length === 0 && (
            <Stack sx={{ gap: 1.5 }}>
              <Typography variant="body2" weight="medium">
                Try one of these
              </Typography>
              <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                {SUGGESTED.map((prompt) => (
                  <Chip
                    key={prompt}
                    appearance="outline"
                    variant="secondary"
                    label={prompt}
                    onClick={() => ask(prompt)}
                  />
                ))}
              </Stack>
            </Stack>
          )}

          {chat.length > 0 && (
            <Stack sx={{ gap: 2 }}>
              {chat.map((turn) =>
                turn.role === 'user' ? (
                  <Stack key={turn.id} direction="row" sx={{ justifyContent: 'flex-end' }}>
                    <Box
                      sx={{
                        px: 2,
                        py: 1.5,
                        borderRadius: 2,
                        backgroundColor: 'primary.subtle',
                        maxWidth: '80%',
                      }}
                    >
                      <Typography variant="body2">{turn.text}</Typography>
                    </Box>
                  </Stack>
                ) : (
                  <Stack key={turn.id} direction="row" sx={{ gap: 1.5, alignItems: 'flex-start' }}>
                    <Avatar size="sm" color="primary">
                      <SparkleIcon size={14} />
                    </Avatar>
                    <Stack sx={{ flex: 1, minWidth: 0, gap: 1.5 }}>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {turn.text}
                      </Typography>

                      {turn.ungrounded && (
                        <Alert severity="info" floating title="No grounded source">
                          Nothing in your workspace answers that. Index a document and it becomes
                          answerable straight away.
                        </Alert>
                      )}

                      {turn.citations && turn.citations.length > 0 && (
                        <Stack sx={{ gap: 0.75 }}>
                          <Typography variant="caption" color="text.secondary">
                            Sources
                          </Typography>
                          <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
                            {turn.citations.map((citation, index) => (
                              <Chip
                                key={`${citation.label}-${index}`}
                                size="sm"
                                variant="information"
                                icon={<DatabaseIcon size={12} />}
                                label={`${citation.label} — ${citation.detail}`}
                              />
                            ))}
                          </Stack>
                        </Stack>
                      )}
                    </Stack>
                  </Stack>
                ),
              )}
              <div ref={endRef} />
            </Stack>
          )}

          <Card component="section">
            <CardContent>
              <Stack direction="row" sx={{ gap: 1.5, alignItems: 'flex-start' }}>
                <TextField
                  aria-label="Ask Neo a question"
                  placeholder="Ask about your invoices, vendors, settings or team…"
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
                  maxRows={4}
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
              <Stack direction="row" sx={{ gap: 1, alignItems: 'center', mt: 1.5 }}>
                <LightningIcon size={14} />
                <Typography variant="caption" color="text.secondary">
                  English only in this version. Invoice processing reads English, Mandarin, Bahasa
                  and Filipino — an open question flagged in the journey document.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </PageBody>
    </>
  );
}
