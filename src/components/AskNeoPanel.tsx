import * as React from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@neofloai/atoms';
import {
  ArrowSquareOutIcon,
  DatabaseIcon,
  PaperPlaneRightIcon,
  SparkleIcon,
  XIcon,
} from '@neofloai/atoms/icons';
import { useStore } from '../store';
import { useSideBySide } from './layout';
import { answerQuestion, suggestedQuestions } from '../neo';
import type { ChatTurn } from '../types';

/**
 * Ask Neo beside your work, rather than over it.
 *
 * The Ask Neo PRD specifies a widget alongside the dedicated page. A question
 * asked from an invoice is about that invoice, so the panel carries the record
 * you were looking at and answers about it first, without navigating away.
 *
 * It docks with `persistent` where there is room, which pushes the page aside
 * instead of covering it: you are reading an answer against the invoice that
 * prompted it, so both have to be visible. Atoms warns off `persistent` for a
 * sheet that is glanced at and dismissed, and that is the opposite of this. On a
 * narrow window there is no room for both, so it floats instead.
 */
const PANEL_WIDTH_PX = 400;

export function AskNeoPanel() {
  const store = useStore();
  const {
    askNeoOpen,
    closeAskNeo,
    askNeoInvoiceId,
    invoices,
    memory,
    config,
    members,
    panelChat,
    pushPanelChat,
    goTo,
    documents,
    connections,
    takeToFullPage,
  } = store;

  const [draft, setDraft] = React.useState('');
  const [lastAsked, setLastAsked] = React.useState('');
  const endRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const sideBySide = useSideBySide();

  /**
   * A docked drawer is not modal, so Escape does not reach it. Wire it up by
   * hand, because a panel you opened with one key should close with one.
   */
  React.useEffect(() => {
    if (!askNeoOpen || !sideBySide) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAskNeo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [askNeoOpen, sideBySide, closeAskNeo]);

  const focus = askNeoInvoiceId ? invoices.find((i) => i.id === askNeoInvoiceId) ?? null : null;

  /**
   * Docked and closed, the drawer stays mounted so its width can animate, but
   * it must hold nothing focusable: a keyboard user would otherwise tab into an
   * invisible composer, and a screen reader would read a panel that is not there.
   */
  const folded = sideBySide && !askNeoOpen;

  React.useEffect(() => {
    if (askNeoOpen) {
      // Land in the input, so the panel is ready to be typed into.
      const timer = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(timer);
    }
  }, [askNeoOpen]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [panelChat.length]);

  const ask = (question: string) => {
    const trimmed = question.trim();
    if (trimmed === '') return;
    // Workflow scope: this panel stays inside Invoice Processing. Documents,
    // connected systems and other workflows belong to the full page.
    const result = answerQuestion(
      trimmed,
      { invoices, memory, config, members, documents, connections },
      { scope: 'workflow', focus },
    );
    const now = Date.now();
    const turns: ChatTurn[] = [
      { id: `pu-${now}`, role: 'user', text: trimmed },
      {
        id: `pn-${now + 1}`,
        role: 'neo',
        text: result.text,
        citations: result.citations,
        ungrounded: result.ungrounded,
        sourceOff: result.sourceOff,
        outOfScope: result.outOfScope,
      },
    ];
    pushPanelChat(turns);
    setLastAsked(trimmed);
    setDraft('');
  };

  return (
    <Drawer
      anchor="right"
      variant={sideBySide ? 'persistent' : 'temporary'}
      /**
       * A docked drawer reserves its width whether or not it is open, so a
       * closed panel would hold 400px of the page hostage. Driving the width
       * from `size` folds the panel and the space it reserves together, and
       * `size` animates.
       */
      size={sideBySide ? (askNeoOpen ? PANEL_WIDTH_PX : 0) : 'md'}
      open={askNeoOpen}
      onClose={closeAskNeo}
      slotProps={{
        paper: {
          sx: {
            display: 'flex',
            flexDirection: 'column',
            // Docked, the panel sits in the shell's row rather than pinning
            // itself to the window.
            ...(sideBySide ? { position: 'relative', overflow: 'hidden' } : null),
          },
        },
      }}
    >
      {folded ? null : (
        <>
      {/* Header */}
      <Stack
        direction="row"
        sx={{
          px: 3,
          py: 2,
          gap: 1.5,
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <Avatar size="sm" color="primary">
          <SparkleIcon size={14} />
        </Avatar>
        <Stack sx={{ flex: 1, minWidth: 0, gap: 0 }}>
          <Typography variant="body1" weight="medium">
            Ask Neo
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {focus ? `About ${focus.number} · ${focus.vendor}` : 'About this workspace'}
          </Typography>
        </Stack>
        <Tooltip title="Open the full page">
          <IconButton
            variant="secondary"
            appearance="text"
            size="sm"
            aria-label="Open Ask Neo as a full page"
            onClick={() => {
              closeAskNeo();
              goTo('ask-neo');
            }}
          >
            <ArrowSquareOutIcon />
          </IconButton>
        </Tooltip>
        <IconButton
          variant="secondary"
          appearance="text"
          size="sm"
          aria-label="Close Ask Neo"
          onClick={closeAskNeo}
        >
          <XIcon />
        </IconButton>
      </Stack>

      <Divider />

      {/* Conversation */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 3, py: 2.5 }}>
        {panelChat.length === 0 ? (
          <Stack sx={{ gap: 2.5 }}>
            <Typography variant="body2" color="text.secondary">
              {focus
                ? `Ask about ${focus.number}: why it needs you, where the variance is, or who has touched it.`
                : 'Ask about your invoices, vendors, settings or team.'}
            </Typography>
            <Stack sx={{ gap: 1 }}>
              {suggestedQuestions(focus).map((prompt) => (
                <Box key={prompt}>
                  <Chip
                    appearance="outline"
                    variant="secondary"
                    label={prompt}
                    onClick={() => ask(prompt)}
                  />
                </Box>
              ))}
            </Stack>
          </Stack>
        ) : (
          <Stack sx={{ gap: 2.5 }}>
            {panelChat.map((turn) =>
              turn.role === 'user' ? (
                <Stack key={turn.id} direction="row" sx={{ justifyContent: 'flex-end' }}>
                  <Box
                    sx={{
                      px: 2,
                      py: 1.25,
                      borderRadius: 2,
                      backgroundColor: 'primary.subtle',
                      maxWidth: '85%',
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
                  <Stack sx={{ flex: 1, minWidth: 0, gap: 1.25 }}>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {turn.text}
                    </Typography>
                    {turn.ungrounded && (
                      <Alert severity="info" floating title="No grounded source">
                        Nothing in this workflow answers that.
                      </Alert>
                    )}

                    {turn.outOfScope && (
                      <Alert
                        severity="info"
                        floating
                        title="The full page reaches further"
                        action={
                          <Button
                            variant="secondary"
                            appearance="outline"
                            size="sm"
                            startIcon={<ArrowSquareOutIcon size={16} />}
                            onClick={() => takeToFullPage(lastAsked)}
                            sx={{ whiteSpace: 'nowrap' }}
                          >
                            Ask it there
                          </Button>
                        }
                      >
                        It can read your documents and connected systems. I will carry the question over.
                      </Alert>
                    )}
                    {turn.citations && turn.citations.length > 0 && (
                      <Stack sx={{ gap: 0.75 }}>
                        <Typography variant="caption" color="text.secondary">
                          Sources
                        </Typography>
                        <Stack sx={{ gap: 0.5, alignItems: 'flex-start' }}>
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
      </Box>

      <Divider />

      {/* Composer */}
      <Stack sx={{ px: 3, py: 2, gap: 1, flexShrink: 0 }}>
        <Stack direction="row" sx={{ gap: 1, alignItems: 'flex-end' }}>
          <TextField
            inputRef={inputRef}
            aria-label="Ask Neo a question"
            placeholder={focus ? `Ask about ${focus.number}…` : 'Ask about your workspace…'}
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
        <Typography variant="caption" color="text.secondary">
          Answers are cited, and drawn only from this workflow.
        </Typography>
      </Stack>
        </>
      )}
    </Drawer>
  );
}
