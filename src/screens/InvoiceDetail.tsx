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
  CurrencyDollarIcon,
  FilePdfIcon,
  ReceiptIcon,
  UploadSimpleIcon,
} from '@neofloai/atoms/icons';
import { useStore } from '../store';
import { RecordHeader, RecordViewRail, type RecordView } from '../components/recordShell';
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
  money,
  outstandingFindings,
  ruleNameForLine,
  ruleNameForMetadata,
} from '../engine';
import type { Stage } from '../types';

const STAGE_TITLE: Record<Stage, string> = {
  extraction: 'Extraction',
  matching: 'Matching',
  posting: 'ERP Posting',
};

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
    toggleAppRail,
  } = useStore();

  const invoice = invoices.find((i) => i.id === openInvoiceId);
  const [view, setView] = React.useState<RecordView>('data');
  const [overrideTarget, setOverrideTarget] = React.useState<{ rule: string; label: string } | null>(null);
  const [reason, setReason] = React.useState('');
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState('');
  const [poOpen, setPoOpen] = React.useState(false);
  const [poDraft, setPoDraft] = React.useState('');

  React.useEffect(() => {
    setView('data');
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
  const extractionClear = extractionIsClear(invoice, config);
  const matchClear = matchingIsClear(invoice);
  const block = invoice.matchResult?.hardBlock ?? null;
  const outstanding = outstandingFindings(invoice);
  const missingCodes = invoice.lines.filter((l) => l.gl === '').length;

  /** Proceed, Validate, or Post: whatever moves this stage on. */
  const primary = (() => {
    if (readOnly) return undefined;
    if (stage === 'extraction') {
      return {
        label: 'Proceed',
        disabled: !extractionClear,
        onClick: () => advanceToMatching(invoice.id),
      };
    }
    if (stage === 'matching') {
      return {
        label: 'Validate',
        disabled: !matchClear,
        onClick: () => advanceToPosting(invoice.id),
      };
    }
    const canPost = connections.zohoBooks && !invoice.isSample && matchClear && missingCodes === 0;
    return {
      label: connections.zohoBooks && !invoice.isSample ? 'Proceed' : 'Download CSV',
      disabled: connections.zohoBooks && !invoice.isSample ? !canPost : false,
      onClick: () => {
        if (connections.zohoBooks && !invoice.isSample) {
          postInvoice(invoice.id);
        } else {
          downloadCsv(`${invoice.number}-matched-data.csv`, buildCsv([invoice], config));
          markExported([invoice.id]);
        }
      },
    };
  })();

  const secondary =
    stage === 'posting' && !readOnly
      ? { label: 'Simulate', onClick: () => simulatePosting(invoice.id) }
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
        title={STAGE_TITLE[stage]}
        meta={[
          { icon: <ReceiptIcon size={14} />, label: `#${invoice.number.replace(/\D/g, '').slice(-3)}` },
          { icon: <BuildingsIcon size={14} />, label: invoice.vendor },
          { icon: <CalendarBlankIcon size={14} />, label: formatDate(invoice.invoiceDate) },
          { icon: <CurrencyDollarIcon size={14} />, label: money(invoice.amount, invoice.currency) },
        ]}
        onToggleRail={toggleAppRail}
        onAskNeo={() => openAskNeo(invoice.id)}
        onReject={readOnly ? undefined : () => setRejectOpen(true)}
        primary={primary}
        secondary={secondary}
      />

      <Stack direction="row" sx={{ flex: 1, minHeight: 0 }}>
        <RecordViewRail view={view} onChange={setView} />

        <Stack sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          {/* Status strip: what the PRD adds that the stage header does not carry. */}
          <Stack
            direction="row"
            sx={{ px: 3, py: 1.5, gap: 1, alignItems: 'center', flexWrap: 'wrap' }}
          >
            <StatusChip status={invoice.status} />
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

          {/* A hard block stops the stage, so it sits above whatever view is open. */}
          {view === 'data' && block && (
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
          {view === 'data' && stage === 'matching' && !block && !readOnly &&
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

          {invoice.matchResult && invoice.matchResult.matchTypeUsed !== config.matchType && view === 'data' && (
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
          {view === 'data' && (
            <Stack direction="row" sx={{ flex: 1, minHeight: 0 }}>
              {stage === 'extraction' && (
                <>
                  <DocumentPane invoice={invoice} />
                  <ExtractedData invoice={invoice} />
                </>
              )}
              {stage === 'matching' && <MatchingViews invoice={invoice} />}
              {stage === 'posting' && <ErpPosting invoice={invoice} />}
            </Stack>
          )}

          {view === 'documents' && (
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 3 }}>
              <Stack sx={{ gap: 1.5 }}>
                <Typography variant="body2" weight="medium">
                  Documents on this invoice
                </Typography>
                {[
                  { name: `${invoice.number.toLowerCase()}.pdf`, kind: 'Invoice' },
                  ...(invoice.poNumber ? [{ name: `${invoice.poNumber}.pdf`, kind: `Purchase order · ${invoice.poSource}` }] : []),
                  ...(invoice.grnSource !== 'none' ? [{ name: 'goods-receipt.pdf', kind: `Goods receipt · ${invoice.grnSource}` }] : []),
                  ...invoice.attachments.map((a) => ({ name: a.name, kind: a.kind })),
                ].map((doc) => (
                  <Stack
                    key={doc.name}
                    direction="row"
                    sx={{
                      gap: 1.5,
                      alignItems: 'center',
                      p: 2,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <FilePdfIcon size={18} />
                    <Stack sx={{ flex: 1, minWidth: 0, gap: 0 }}>
                      <Typography variant="body2" weight="medium">
                        {doc.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {doc.kind}
                      </Typography>
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}

          {view === 'history' && (
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
              placeholder="Short shipment agreed with the vendor; the balance was cancelled on the PO."
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
