import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@neofloai/atoms';
import {
  BuildingsIcon,
  CalendarBlankIcon,
  FilePdfIcon,
  ReceiptIcon,
  UploadSimpleIcon,
} from '@neofloai/atoms/icons';
import { useStore } from '../store';
import { RecordHeader } from '../components/recordShell';
import { StatusChip } from '../components/common';
import { DocumentPane } from './invoice/DocumentPane';
import { ExtractedData } from './invoice/ExtractedData';
import { MatchingViews } from './invoice/MatchingViews';
import { ErpPosting } from './invoice/ErpPosting';
import { formatDate, formatDateTime } from '../clock';
import {
  HARD_BLOCK_COPY,
  buildCsv,
  downloadCsv,
  extractionIsClear,
  isTerminal,
  matchingIsClear,
  outstandingFindings,
  ruleNameForLine,
  ruleNameForMetadata,
} from '../engine';
import { StageNav, STAGE_LABEL } from '../components/StageNav';
import type { Stage } from '../types';

export function InvoiceDetailScreen() {
  const {
    invoices,
    openInvoiceId,
    config,
    connections,
    goTo,
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
    simulatePosting,
    openAskNeo,
  } = useStore();

  const invoice = invoices.find((i) => i.id === openInvoiceId);
  // The stage, or its history. Documents live on the stages that carry them.
  const [showHistory, setShowHistory] = React.useState(false);
  const [selectedFieldKey, setSelectedFieldKey] = React.useState<string | null>(null);
  const [overrideTarget, setOverrideTarget] = React.useState<{ rule: string; label: string } | null>(null);
  const [reason, setReason] = React.useState('');
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState('');
  const [poOpen, setPoOpen] = React.useState(false);
  const [poDraft, setPoDraft] = React.useState('');
  /**
   * An earlier stage the reader has gone back to. Null means the record's own
   * stage, which is the normal case; it clears whenever the record moves so a
   * reader is never left looking at the past after something happened.
   */
  const [viewStage, setViewStage] = React.useState<Stage | null>(null);

  React.useEffect(() => {
    setShowHistory(false);
    setViewStage(null);
  }, [invoice?.id, invoice?.stage]);

  if (!invoice) {
    return (
      <Stack sx={{ p: 3, gap: 2 }}>
        <Typography variant="h6">No invoice open</Typography>
        <Box>
          <Button onClick={() => goTo('queue')}>Back to the dashboard</Button>
        </Box>
      </Stack>
    );
  }

  const readOnly = isTerminal(invoice);
  const stage = invoice.stage;
  // What is on screen. Looking back does not change the record.
  const shown = viewStage ?? stage;
  const lookingBack = shown !== stage;
  const extractionClear = extractionIsClear(invoice, config);
  const matchClear = matchingIsClear(invoice);
  const block = invoice.matchResult?.hardBlock ?? null;
  const outstanding = outstandingFindings(invoice);
  const missingTax = invoice.lines.filter((l) => l.vat === '' || l.wht === '').length;

  /**
   * The stage's own action. A closed record keeps its buttons and shows them
   * disabled: there is no separate posted screen, the same one stops accepting
   * input.
   */
  const primary = (() => {
    if (stage === 'extraction') {
      return {
        label: 'Proceed',
        disabled: readOnly || !extractionClear,
        onClick: () => advanceToMatching(invoice.id),
      };
    }
    if (stage === 'matching') {
      return {
        label: 'Validate',
        disabled: readOnly || !matchClear,
        onClick: () => advanceToPosting(invoice.id),
      };
    }
    // Posting where an ERP is connected, export where none is.
    const posts = connections.zohoBooks && !invoice.isSample;
    return {
      label: posts ? 'Proceed' : 'Download CSV',
      // A dry run comes before a commit, which is why the product shows Proceed
      // grayed next to a live Simulate.
      disabled:
        readOnly || (posts && (!matchClear || missingTax > 0 || !invoice.erp.simulated)),
      onClick: () => {
        if (posts) {
          postInvoice(invoice.id);
        } else {
          downloadCsv(`${invoice.number}-matched-data.csv`, buildCsv([invoice], config));
          markExported([invoice.id]);
        }
      },
    };
  })();

  const secondary =
    stage === 'posting'
      ? { label: 'Simulate', disabled: readOnly, onClick: () => simulatePosting(invoice.id) }
      : undefined;

  const submitOverride = () => {
    if (!overrideTarget || reason.trim().length < 8) return;
    recordOverride(invoice.id, overrideTarget.rule, reason.trim());
    setOverrideTarget(null);
    setReason('');
  };

  return (
    <Stack sx={{ flex: 1, minHeight: 0 }}>
      <RecordHeader
        title={STAGE_LABEL[shown]}
        meta={[
          { icon: <ReceiptIcon size={14} />, label: `#${invoice.number.replace(/\D/g, '').slice(-3)}` },
          { icon: <BuildingsIcon size={14} />, label: invoice.vendor },
          { icon: <CalendarBlankIcon size={14} />, label: formatDate(invoice.invoiceDate) },
        ]}
        onShowHistory={() => setShowHistory((previous) => !previous)}
        historyActive={showHistory}
        onAskNeo={shown === 'posting' ? undefined : () => openAskNeo(invoice.id)}
        onReject={lookingBack ? undefined : () => setRejectOpen(true)}
        rejectDisabled={readOnly}
        primary={lookingBack ? undefined : primary}
        secondary={lookingBack ? undefined : secondary}
      />

      <Stack direction="row" sx={{ flex: 1, minHeight: 0 }}>
        <Stack sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          {/* The stages, then what the PRD adds that the header does not carry. */}
          <Stack
            direction="row"
            sx={{ px: 3, py: 1.5, gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}
          >
            <StageNav
              reached={stage}
              viewing={shown}
              onView={(next) => setViewStage(next === stage ? null : next)}
            />
            {/* The status only earns a chip when it says something the stage
                nav does not: closed, or stopped and waiting on a person. */}
            {!['Extraction', 'Matching', 'ERP posting'].includes(invoice.status) && (
              <>
                <Box sx={{ width: '1px', height: 18, backgroundColor: 'divider' }} aria-hidden />
                <StatusChip status={invoice.status} />
              </>
            )}
            {invoice.isSample && <Chip size="sm" variant="purple" label="Sample data" />}
            {invoice.stpPosted && <Chip size="sm" variant="success" label="Posted unsupervised" />}
            {invoice.overrides.length > 0 && (
              <Chip
                size="sm"
                variant="warning"
                label={`${invoice.overrides.length} override${invoice.overrides.length === 1 ? '' : 's'}`}
              />
            )}
          </Stack>

          {/* A hard block stops the stage it belongs to. Looking back at an
              earlier stage is a read, so the block and its actions stay on the
              stage the invoice is actually on. */}
          {!showHistory && !lookingBack && block && (
            <Box sx={{ px: 3, pb: 2 }}>
              <Alert
                severity="error"
                title={HARD_BLOCK_COPY[block].title}
                action={
                  !readOnly ? (
                    <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                      {block === 'no-grn' && (
                        <Button
                          variant="secondary"
                          appearance="outline"
                          size="sm"
                          startIcon={<UploadSimpleIcon size={16} />}
                          onClick={() => attachReference(invoice.id, 'grn')}
                          sx={{ whiteSpace: 'nowrap' }}
                        >
                          Upload the GRN
                        </Button>
                      )}
                      {block === 'no-po' && (
                        <Button
                          variant="secondary"
                          appearance="outline"
                          size="sm"
                          onClick={() => setPoOpen(true)}
                          sx={{ whiteSpace: 'nowrap' }}
                        >
                          Type a PO number
                        </Button>
                      )}
                    </Stack>
                  ) : undefined
                }
              >
                <Stack sx={{ gap: 1.5 }}>
                  <Typography variant="body2">{HARD_BLOCK_COPY[block].next}</Typography>

                  {/* Documents that arrived without an invoice create no queue
                      row, so this is the moment they are worth showing. */}
                  {!readOnly && block !== 'duplicate' && (() => {
                    const which = block === 'no-po' ? 'po' : 'grn';
                    const held = heldDocumentsFor(which);
                    if (held.length === 0) return null;
                    return (
                      <Stack sx={{ gap: 0.75 }}>
                        <Typography variant="caption" color="text.secondary">
                          {held.length === 1
                            ? 'One document already received could be this one'
                            : `${held.length} documents already received could be this one`}
                        </Typography>
                        <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
                          {held.map((name) => (
                            <Chip
                              key={name}
                              size="sm"
                              variant="information"
                              icon={<FilePdfIcon size={12} />}
                              label={name}
                              onClick={() => attachHeldDocument(invoice.id, which, name)}
                            />
                          ))}
                        </Stack>
                      </Stack>
                    );
                  })()}
                </Stack>
              </Alert>
            </Box>
          )}

          {/* Outstanding variances, with the override the PRD requires. */}
          {!showHistory && shown === 'matching' && !block && !readOnly &&
            (outstanding.metadata.length > 0 || outstanding.line.length > 0) && (
              <Box sx={{ px: 3, pb: 2 }}>
                <Alert severity="warning" title="A variance is beyond tolerance">
                  <Stack sx={{ gap: 1, mt: 0.5 }}>
                    {outstanding.metadata.map((f) => (
                      <Stack key={f.field} direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="body2">
                          {f.field}: {f.invoiceValue} against {f.poValue}
                        </Typography>
                        <Button
                          variant="secondary"
                          appearance="text"
                          size="sm"
                          onClick={() =>
                            setOverrideTarget({
                              rule: ruleNameForMetadata(f),
                              label: `${f.field}: ${f.invoiceValue} against ${f.poValue}`,
                            })
                          }
                        >
                          Override
                        </Button>
                      </Stack>
                    ))}
                    {[...new Set(outstanding.line.map(ruleNameForLine))].map((rule) => (
                      <Stack key={rule} direction="row" sx={{ gap: 1, alignItems: 'center' }}>
                        <Typography variant="body2">{rule}</Typography>
                        <Button
                          variant="secondary"
                          appearance="text"
                          size="sm"
                          onClick={() => setOverrideTarget({ rule, label: rule })}
                        >
                          Override
                        </Button>
                      </Stack>
                    ))}
                  </Stack>
                </Alert>
              </Box>
            )}

          {invoice.matchResult &&
            invoice.matchResult.matchTypeUsed !== config.matchType &&
            !showHistory &&
            !lookingBack && (
            <Box sx={{ px: 3, pb: 2 }}>
              <Alert
                severity="info"
                title={`This result came from a ${invoice.matchResult.matchTypeUsed} match`}
                action={
                  <Button
                    variant="secondary"
                    appearance="outline"
                    size="sm"
                    onClick={() => rerunMatching(invoice.id)}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    Re-run
                  </Button>
                }
              >
                Configuration is now {config.matchType}. Nothing is re-graded until the stage runs again.
              </Alert>
            </Box>
          )}

          {/* The stage itself */}
          {!showHistory && (
            <Stack direction="row" sx={{ flex: 1, minHeight: 0 }}>
              {shown === 'extraction' && (
                <>
                  <DocumentPane
                    invoice={invoice}
                    selected={
                      invoice.invoiceFields.find((f) => f.key === selectedFieldKey) ?? null
                    }
                    onSelect={setSelectedFieldKey}
                    readOnly={readOnly || lookingBack}
                  />
                  <ExtractedData
                    invoice={invoice}
                    selectedKey={selectedFieldKey}
                    onSelect={setSelectedFieldKey}
                  />
                </>
              )}
              {shown === 'matching' && <MatchingViews invoice={invoice} />}
              {shown === 'posting' && <ErpPosting invoice={invoice} />}
            </Stack>
          )}

          {showHistory && (
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 3 }}>
              <Stepper activeStep={-1}>
                {[...invoice.audit].reverse().map((entry, index) => (
                  <Step key={`${entry.at}-${index}`} expanded completed>
                    <StepLabel optional={`${entry.actor} · ${formatDateTime(entry.at)}`}>
                      {entry.action}
                    </StepLabel>
                    {entry.detail && <StepContent>{entry.detail}</StepContent>}
                  </Step>
                ))}
              </Stepper>
            </Box>
          )}
        </Stack>
      </Stack>

      {/* Override with a written reason */}
      <Dialog open={overrideTarget !== null} onClose={() => setOverrideTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle
          subtitle="Recorded against this invoice with your name and the time."
          onClose={() => setOverrideTarget(null)}
        >
          Override with a reason
        </DialogTitle>
        <DialogContent>
          <Stack sx={{ gap: 2 }}>
            <Alert severity="warning" title={overrideTarget?.rule ?? ''}>
              {overrideTarget?.label}
            </Alert>
            <TextField
              label="Why is this acceptable?"
              placeholder="Short shipment agreed with the vendor; the balance was canceled on the PO."
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              helperText="Required."
              multiline
              minRows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button appearance="text" variant="secondary" size="sm" onClick={() => setOverrideTarget(null)}>
            Cancel
          </Button>
          <Button size="sm" disabled={reason.trim().length < 8} onClick={submitOverride}>
            Record override
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject */}
      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} role="alertdialog" fullWidth maxWidth="sm">
        <DialogTitle
          subtitle="The reason is kept on the record, and the invoice still counts for duplicate detection."
          onClose={() => setRejectOpen(false)}
        >
          Reject {invoice.number}?
        </DialogTitle>
        <DialogContent>
          <TextField
            label="Reason"
            placeholder="Already processed in another workspace; the vendor re-sent it in error."
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            multiline
            minRows={3}
            helperText="Required."
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button appearance="text" variant="secondary" size="sm" onClick={() => setRejectOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="error"
            size="sm"
            disabled={rejectReason.trim().length < 8}
            onClick={() => {
              rejectInvoice(invoice.id, rejectReason.trim());
              setRejectOpen(false);
              setRejectReason('');
            }}
          >
            Reject invoice
          </Button>
        </DialogActions>
      </Dialog>

      {/* Supply a PO number */}
      <Dialog open={poOpen} onClose={() => setPoOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle
          subtitle={
            connections.zohoBooks
              ? 'The purchase order and its receipts are fetched from Zoho once the number is known.'
              : 'No ERP is connected, so upload the purchase order instead.'
          }
          onClose={() => setPoOpen(false)}
        >
          Type a PO number
        </DialogTitle>
        <DialogContent>
          <TextField
            label="PO number"
            placeholder="PO-US-00000"
            value={poDraft}
            onChange={(event) => setPoDraft(event.target.value)}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button appearance="text" variant="secondary" size="sm" onClick={() => setPoOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={poDraft.trim() === ''}
            onClick={() => {
              setPoNumber(invoice.id, poDraft.trim());
              setPoOpen(false);
              setPoDraft('');
            }}
          >
            Fetch and re-run
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
