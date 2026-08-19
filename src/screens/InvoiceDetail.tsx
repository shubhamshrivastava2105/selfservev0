import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@neofloai/atoms';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowsClockwiseIcon,
  BrainIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  DatabaseIcon,
  DownloadSimpleIcon,
  FilePdfIcon,
  ProhibitIcon,
  SealCheckIcon,
  SparkleIcon,
  UploadSimpleIcon,
  UsersThreeIcon,
  WarningIcon,
} from '@neofloai/atoms/icons';
import { GL_CODES, VAT_CODES, WHT_CODES } from '../data';
import { useStore, type FieldScope } from '../store';
import {
  ConfidenceFieldRow,
  Fact,
  SourceChip,
  StatusChip,
  confidenceTone,
} from '../components/common';
import { RecordBar, META_ICON_PX } from '../components/shell';
import {
  HARD_BLOCK_COPY,
  buildCsv,
  downloadCsv,
  extractionIsClear,
  isOverridden,
  isTerminal,
  matchingIsClear,
  money,
  num,
  outstandingFindings,
  ruleNameForLine,
  ruleNameForMetadata,
  signedMoney,
  unacknowledgedFields,
} from '../engine';
import type { ExtractedField, Invoice, MetadataFinding, Stage } from '../types';

/* ── The document beside the values ───────────────────────────────────── */

function DocumentPane({ label, filename, badge }: { label: string; filename: string; badge?: React.ReactNode }) {
  return (
    <Card component="section" sx={{ height: '100%' }}>
      <CardContent>
        <Stack sx={{ gap: 1.5, height: '100%' }}>
          <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
            <FilePdfIcon size={16} />
            <Typography variant="body2" weight="medium" sx={{ flex: 1, minWidth: 0 }} noWrap>
              {filename}
            </Typography>
            {badge}
          </Stack>
          <Divider />
          {/* The source document is drawn, not rendered — there is no real PDF
              behind this prototype. */}
          <Box
            sx={{
              flex: 1,
              minHeight: 320,
              borderRadius: 1,
              border: '1px dashed',
              borderColor: 'divider',
              backgroundColor: 'action.hover',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              px: 3,
              textAlign: 'center',
            }}
          >
            <Stack sx={{ gap: 0.5, alignItems: 'center' }}>
              <FilePdfIcon size={28} />
              <Typography variant="body2" weight="medium">
                {label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                The source document sits here, beside its extracted values.
                <br />
                Drawn rather than rendered in this prototype.
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

/* ── Extraction ───────────────────────────────────────────────────────── */

function ExtractionPanel({ invoice }: { invoice: Invoice }) {
  const { config, memory, editField, acknowledgeField, acknowledgeAll } = useStore();
  const [docTab, setDocTab] = React.useState<FieldScope>('invoice');

  const readOnly = isTerminal(invoice);
  const pending = unacknowledgedFields(invoice, config.confidenceThreshold);
  const clear = extractionIsClear(invoice, config);

  const fields =
    docTab === 'invoice' ? invoice.invoiceFields : docTab === 'po' ? invoice.poFields : invoice.grnFields;

  const source = docTab === 'invoice' ? 'uploaded' : docTab === 'po' ? invoice.poSource : invoice.grnSource;

  const pendingIn = (scope: FieldScope) => {
    const set = scope === 'invoice' ? invoice.invoiceFields : scope === 'po' ? invoice.poFields : invoice.grnFields;
    return set.filter(
      (f) => f.confidence !== null && f.confidence < config.confidenceThreshold && !f.acknowledged,
    ).length;
  };

  /**
   * A suggestion is only ever offered on a field the system has already
   * flagged, and is always accepted explicitly (Workflow PRD §9).
   */
  const suggestionFor = (f: ExtractedField): string | null => {
    if (!f.learnable) return null;
    const tone = confidenceTone(f.confidence, config.confidenceThreshold);
    if (tone !== 'amber' && tone !== 'red') return null;
    if (f.acknowledged) return null;
    const pattern = memory.find(
      (m) =>
        m.streak >= config.memoryThreshold &&
        m.fieldKey === f.key &&
        m.patternKey.toLowerCase().includes(f.value.toLowerCase().slice(0, 12)),
    );
    if (!pattern || pattern.suggestedValue === f.value) return null;
    return pattern.suggestedValue;
  };

  return (
    <Stack sx={{ gap: 3 }}>
      {source === 'none' ? (
        <Alert severity="warning" title={`No ${docTab === 'po' ? 'purchase order' : 'goods receipt'} on this invoice`}>
          Nothing has been read for this document yet. Attach it from the matching stage, or fetch it
          from Zoho once a PO number is known.
        </Alert>
      ) : null}

      {!clear && !readOnly && (
        <Alert
          severity="warning"
          title={`${pending.length} field${pending.length === 1 ? '' : 's'} below the ${config.confidenceThreshold}% threshold`}
          action={
            <Button variant="secondary" appearance="outline" size="sm" onClick={() => acknowledgeAll(invoice.id)}>
              Acknowledge all
            </Button>
          }
        >
          Matching will not run until every one of these is acknowledged or corrected — on the
          reference documents as much as on the invoice. Nothing is rejected for being badly scanned.
        </Alert>
      )}

      {clear && !readOnly && (
        <Alert severity="success" title="Every field has cleared">
          Confidence exists on both sides of the match, so a variance later can be told apart from a
          misread.
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card component="section">
            <CardContent>
              <Tabs
                value={docTab}
                onChange={(_, next) => setDocTab(next)}
                aria-label="Documents on this invoice"
              >
                <Tab label="Invoice" value="invoice" count={pendingIn('invoice') || undefined} />
                <Tab
                  label="Purchase order"
                  value="po"
                  count={pendingIn('po') || undefined}
                  disabled={invoice.poFields.length === 0}
                />
                <Tab
                  label="Goods receipt"
                  value="grn"
                  count={pendingIn('grn') || undefined}
                  disabled={invoice.grnFields.length === 0}
                />
              </Tabs>

              <Box sx={{ mt: 2 }}>
                {source === 'zoho' && (
                  <Alert severity="info" title="Structured record from Zoho" floating>
                    Ground truth — no confidence score, and nothing here for you to check.
                  </Alert>
                )}

                <Stack sx={{ mt: source === 'zoho' ? 2 : 0 }} divider={<Divider />}>
                  {fields.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      No document of this kind has been read.
                    </Typography>
                  ) : (
                    fields.map((f) => {
                      const suggestion = suggestionFor(f);
                      return (
                        <Box key={f.key}>
                          <ConfidenceFieldRow
                            field={f}
                            threshold={config.confidenceThreshold}
                            readOnly={readOnly}
                            onEdit={(value) => editField(invoice.id, docTab, f.key, value)}
                            onAcknowledge={() => acknowledgeField(invoice.id, docTab, f.key)}
                          />
                          {suggestion && (
                            <Stack
                              direction="row"
                              sx={{ gap: 1, alignItems: 'center', px: 2, pb: 1.5, ml: '180px' }}
                            >
                              <BrainIcon size={14} />
                              <Typography variant="caption" color="text.secondary">
                                Remembered from your corrections:
                              </Typography>
                              <Chip
                                size="sm"
                                variant="purple"
                                label={suggestion}
                                onClick={() => editField(invoice.id, docTab, f.key, suggestion)}
                              />
                              <Typography variant="caption" color="text.secondary">
                                — click to accept
                              </Typography>
                            </Stack>
                          )}
                        </Box>
                      );
                    })
                  )}
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <DocumentPane
            label={docTab === 'invoice' ? 'Invoice' : docTab === 'po' ? 'Purchase order' : 'Goods receipt note'}
            filename={
              docTab === 'invoice'
                ? `${invoice.number.toLowerCase()}.pdf`
                : docTab === 'po'
                  ? invoice.poSource === 'zoho'
                    ? `${invoice.poNumber} · Zoho Books`
                    : `${invoice.poNumber?.toLowerCase()}.pdf`
                  : `${invoice.grnFields[0]?.value.toLowerCase() ?? 'grn'}.pdf`
            }
            badge={
              source === 'zoho' ? (
                <Chip size="sm" variant="information" icon={<DatabaseIcon size={12} />} label="Zoho" />
              ) : (
                <Chip size="sm" variant="secondary" icon={<UploadSimpleIcon size={12} />} label="Read" />
              )
            }
          />
        </Grid>
      </Grid>
    </Stack>
  );
}

/* ── The line table ───────────────────────────────────────────────────── */

/**
 * The lines, in two tables rather than one. The comparison answers "does this
 * match", the coding answers "where does it post" — and one row of eleven
 * columns fits neither on a laptop.
 */
function LineComparison({ invoice }: { invoice: Invoice }) {
  const { config } = useStore();
  const threeWay = (invoice.matchResult?.matchTypeUsed ?? config.matchType) === '3-way';
  const outstanding = outstandingFindings(invoice);

  return (
    <Card component="section">
      <TableContainer>
        <Table size="sm">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '100%', minWidth: 200 }}>Line</TableCell>
              <TableCell align="right">Inv qty</TableCell>
              <TableCell align="right">PO qty</TableCell>
              {threeWay && <TableCell align="right">GRN qty</TableCell>}
              <TableCell align="right">Unit price</TableCell>
              <TableCell align="right">Line total</TableCell>
              <TableCell align="right">vs PO</TableCell>
              {threeWay && <TableCell align="right">vs GRN</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {invoice.lines.map((l) => {
              const findings = outstanding.line.filter((f) => f.lineId === l.id);
              const failed = findings.length > 0;
              const grnTotal = l.grnQty !== null ? Number((l.grnQty * l.poUnitPrice).toFixed(2)) : null;
              const diffPo = Number((l.invoiceLineTotal - l.poLineTotal).toFixed(2));
              const diffGrn = grnTotal !== null ? Number((l.invoiceLineTotal - grnTotal).toFixed(2)) : null;

              const diffCell = (value: number | null) => {
                if (value === null) return <Typography variant="body2" color="text.secondary">—</Typography>;
                if (value === 0) return <Typography variant="body2" color="text.secondary">—</Typography>;
                return (
                  <Typography variant="body2" color="error.main" weight="medium">
                    {signedMoney(value, invoice.currency)}
                  </Typography>
                );
              };

              return (
                <TableRow key={l.id} state={failed ? 'error' : undefined}>
                  <TableCell
                    secondary={
                      failed
                        ? findings
                            .map((f) => (f.field === 'unitPrice' ? 'unit price' : f.field === 'lineTotal' ? 'line total' : 'quantity'))
                            .join(', ') + ' beyond tolerance'
                        : undefined
                    }
                  >
                    {l.description}
                  </TableCell>
                  <TableCell align="right">{num(l.invoiceQty)}</TableCell>
                  <TableCell align="right">{num(l.poQty)}</TableCell>
                  {threeWay && (
                    <TableCell align="right">{l.grnQty === null ? '—' : num(l.grnQty)}</TableCell>
                  )}
                  <TableCell align="right">{money(l.invoiceUnitPrice, invoice.currency)}</TableCell>
                  <TableCell align="right">{money(l.invoiceLineTotal, invoice.currency)}</TableCell>
                  <TableCell align="right">{diffCell(diffPo)}</TableCell>
                  {threeWay && <TableCell align="right">{diffCell(diffGrn)}</TableCell>}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}

/**
 * Coding per line, as labelled fields rather than bare selects in a grid.
 *
 * Atoms' `Select` can only take an accessible name through its visible `label`
 * (it omits `slotProps`, and MUI 9 dropped the nested `SelectProps` forward), so
 * a select sitting in a table cell has no name for a screen reader at all. The
 * labels below are the supported way to give it one — worth an Atoms component
 * request if coding grids become common.
 */
function LineCoding({ invoice, editable }: { invoice: Invoice; editable: boolean }) {
  const { config, memory, setLineCode } = useStore();

  const glSuggestion = memory.find(
    (m) =>
      m.fieldKey === 'gl' &&
      m.streak >= config.memoryThreshold &&
      m.patternKey.toLowerCase().includes(invoice.vendor.toLowerCase()),
  );

  return (
    <Card component="section">
      <Stack component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }} divider={<Divider component="li" />}>
        {invoice.lines.map((l) => {
          const missingGl = l.gl === '';
          return (
            <Stack key={l.id} component="li" sx={{ p: 2, gap: 1.5 }}>
              <Stack direction="row" sx={{ gap: 2, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <Typography variant="body2" weight="medium" sx={{ flex: 1, minWidth: 200 }}>
                  {l.description}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {num(l.invoiceQty)} × {money(l.invoiceUnitPrice, invoice.currency)} ={' '}
                  {money(l.invoiceLineTotal, invoice.currency)}
                </Typography>
              </Stack>

              {editable ? (
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Select
                      label="VAT"
                      value={l.vat}
                      onChange={(event) => setLineCode(invoice.id, l.id, 'vat', String(event.target.value))}
                      fullWidth
                    >
                      {VAT_CODES.map((code) => (
                        <MenuItem key={code} value={code}>{code}</MenuItem>
                      ))}
                    </Select>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Select
                      label="WHT"
                      value={l.wht}
                      onChange={(event) => setLineCode(invoice.id, l.id, 'wht', String(event.target.value))}
                      fullWidth
                    >
                      {WHT_CODES.map((code) => (
                        <MenuItem key={code} value={code}>{code}</MenuItem>
                      ))}
                    </Select>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 5 }}>
                    <Select
                      label="GL account"
                      value={l.gl}
                      status={missingGl ? 'warning' : undefined}
                      helperText={missingGl ? 'Not assigned — needed before posting.' : undefined}
                      onChange={(event) => setLineCode(invoice.id, l.id, 'gl', String(event.target.value))}
                      fullWidth
                    >
                      <MenuItem value="">Not assigned</MenuItem>
                      {GL_CODES.map((code) => (
                        <MenuItem key={code} value={code}>{code}</MenuItem>
                      ))}
                    </Select>
                    {missingGl && glSuggestion && (
                      <Stack direction="row" sx={{ gap: 0.75, alignItems: 'center', mt: 1 }}>
                        <BrainIcon size={14} />
                        <Typography variant="caption" color="text.secondary">
                          Remembered:
                        </Typography>
                        <Chip
                          size="sm"
                          variant="purple"
                          label={glSuggestion.suggestedValue}
                          onClick={() => setLineCode(invoice.id, l.id, 'gl', glSuggestion.suggestedValue)}
                        />
                      </Stack>
                    )}
                  </Grid>
                </Grid>
              ) : (
                <Stack direction="row" sx={{ gap: 3, flexWrap: 'wrap' }}>
                  <Fact label="VAT" value={l.vat} />
                  <Fact label="WHT" value={l.wht} />
                  <Fact label="GL account" value={l.gl || '—'} />
                </Stack>
              )}
            </Stack>
          );
        })}
      </Stack>
    </Card>
  );
}

/* ── Matching ─────────────────────────────────────────────────────────── */

function CheckCard({
  title,
  state,
  description,
  children,
}: {
  title: string;
  state: 'pending' | 'pass' | 'fail' | 'skipped';
  description: string;
  children?: React.ReactNode;
}) {
  const chip =
    state === 'pass' ? (
      <Chip size="sm" variant="success" icon={<SealCheckIcon size={12} />} label="Passed" />
    ) : state === 'fail' ? (
      <Chip size="sm" variant="error" icon={<WarningIcon size={12} />} label="Action Required" />
    ) : state === 'skipped' ? (
      <Chip size="sm" variant="secondary" label="Skipped" />
    ) : (
      <Chip size="sm" variant="secondary" icon={<ClockIcon size={12} />} label="Not run" />
    );

  return (
    <Card component="section" sx={{ height: '100%' }}>
      <CardContent>
        <Stack sx={{ gap: 1.5 }}>
          <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
            <Typography variant="body1" weight="medium" sx={{ flex: 1 }}>
              {title}
            </Typography>
            {chip}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}

function MatchingPanel({ invoice }: { invoice: Invoice }) {
  const { config, connections, rerunMatching, recordOverride, setPoNumber, attachReference, goTo } = useStore();
  const [overrideTarget, setOverrideTarget] = React.useState<{ rule: string; label: string } | null>(null);
  const [reason, setReason] = React.useState('');
  const [poDialogOpen, setPoDialogOpen] = React.useState(false);
  const [poDraft, setPoDraft] = React.useState('');

  const result = invoice.matchResult;
  const readOnly = isTerminal(invoice);

  if (!result) {
    return (
      <Alert severity="info" title="Matching has not run yet">
        Clear the extraction stage first — matching does not run until every low-confidence field is
        acknowledged or corrected.
      </Alert>
    );
  }

  const block = result.hardBlock;
  const threeWay = result.matchTypeUsed === '3-way';
  const stillOpen = outstandingFindings(invoice);

  /**
   * A check reads as passed once every finding it raised has been overridden —
   * the finding is settled, and the frozen result is never rewritten.
   */
  const metadataState =
    result.metadata.state === 'fail' && stillOpen.metadata.length === 0 ? 'pass' : result.metadata.state;
  const lineItemState =
    result.lineItem.state === 'fail' && stillOpen.line.length === 0 ? 'pass' : result.lineItem.state;

  const submitOverride = () => {
    if (!overrideTarget || reason.trim().length < 8) return;
    recordOverride(invoice.id, overrideTarget.rule, reason.trim());
    setOverrideTarget(null);
    setReason('');
  };

  return (
    <Stack sx={{ gap: 3 }}>
      {result.matchTypeUsed !== config.matchType && (
        <Alert severity="info" title={`This result was produced by a ${result.matchTypeUsed} match`}>
          Configuration is now set to {config.matchType}. Nothing is re-evaluated retroactively — the
          new setting reaches this invoice only when its stage runs again.
          <Box sx={{ mt: 1.5 }}>
            <Button
              variant="secondary"
              appearance="outline"
              size="sm"
              startIcon={<ArrowsClockwiseIcon size={16} />}
              onClick={() => rerunMatching(invoice.id)}
            >
              Re-run matching
            </Button>
          </Box>
        </Alert>
      )}

      {block && (
        <Alert
          severity="error"
          title={HARD_BLOCK_COPY[block].title}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              {block === 'no-grn' && !readOnly && (
                <>
                  <Button
                    variant="secondary"
                    appearance="outline"
                    size="sm"
                    startIcon={<UploadSimpleIcon size={16} />}
                    onClick={() => attachReference(invoice.id, 'grn')}
                  >
                    Upload the GRN
                  </Button>
                  <Button variant="secondary" appearance="text" size="sm" onClick={() => goTo('config')}>
                    Change match type
                  </Button>
                </>
              )}
              {block === 'no-po' && !readOnly && (
                <>
                  <Button
                    variant="secondary"
                    appearance="outline"
                    size="sm"
                    onClick={() => setPoDialogOpen(true)}
                  >
                    Type a PO number
                  </Button>
                  <Button
                    variant="secondary"
                    appearance="text"
                    size="sm"
                    onClick={() => attachReference(invoice.id, 'po')}
                  >
                    Upload the PO
                  </Button>
                </>
              )}
            </Stack>
          }
        >
          <Stack sx={{ gap: 1 }}>
            <Typography variant="body2">{HARD_BLOCK_COPY[block].why}</Typography>
            <Typography variant="body2" weight="medium">
              {HARD_BLOCK_COPY[block].next}
            </Typography>
            {block === 'no-grn' && !connections.zohoInventory && (
              <Typography variant="caption" color="text.secondary">
                Receipts live in Zoho Inventory, which is not connected. On Books alone, 3-way only
                works from uploaded GRN documents.
              </Typography>
            )}
          </Stack>
        </Alert>
      )}

      {!block && matchingIsClear(invoice) && (
        <Alert severity="success" title="All checks passed">
          There is no separate approval step. An invoice that clears matching surfaces at ERP posting
          and you post it.
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <CheckCard
            title="1 · Duplicate"
            state={result.duplicate.state}
            description="Runs first, on invoice number, vendor and legal entity. Tenant-wide, so it spans every workspace. On a hit the other two are skipped."
          >
            {result.duplicate.original && (
              <Alert severity="error" title="Already seen" floating>
                <Stack sx={{ gap: 0.5 }}>
                  <Typography variant="body2">
                    {result.duplicate.original.number} · {result.duplicate.original.vendor} ·{' '}
                    {result.duplicate.original.date}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Processed by {result.duplicate.original.processedBy}.
                    {result.duplicate.original.metadataOnly
                      ? ' It sits in a workspace you cannot see, so only metadata is shown — no link, no document.'
                      : ''}
                  </Typography>
                </Stack>
              </Alert>
            )}
          </CheckCard>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <CheckCard
            title="2 · Metadata"
            state={metadataState}
            description="Header and billing fields against the PO, vendor name included. Runs in parallel with the line-item check."
          >
            {result.metadata.findings.length > 0 && (
              <Stack sx={{ gap: 1 }}>
                {result.metadata.findings.map((finding) => (
                  <MetadataFindingRow
                    key={finding.field}
                    invoice={invoice}
                    finding={finding}
                    readOnly={readOnly}
                    onOverride={() =>
                      setOverrideTarget({
                        rule: ruleNameForMetadata(finding),
                        label: `${finding.field}: invoice ${finding.invoiceValue} against PO ${finding.poValue}`,
                      })
                    }
                  />
                ))}
              </Stack>
            )}
          </CheckCard>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <CheckCard
            title="3 · Line item"
            state={lineItemState}
            description={`Quantity, unit price and line total against the PO${threeWay ? ' and the GRN' : ''}. Each field is switchable in configuration.`}
          >
            {result.lineItem.findings.length > 0 && (
              <Stack sx={{ gap: 1 }}>
                {[...new Set(result.lineItem.findings.map((f) => ruleNameForLine(f)))].map((rule) => {
                  const settled = isOverridden(invoice, rule);
                  return (
                    <Stack key={rule} direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Chip
                        size="sm"
                        variant={settled ? 'success' : 'error'}
                        label={settled ? `${rule} — overridden` : rule}
                      />
                      {!settled && !readOnly && (
                        <Button
                          variant="secondary"
                          appearance="text"
                          size="sm"
                          onClick={() => setOverrideTarget({ rule, label: rule })}
                        >
                          Override
                        </Button>
                      )}
                    </Stack>
                  );
                })}
              </Stack>
            )}
          </CheckCard>
        </Grid>
      </Grid>

      {result.lineItem.findings.length > 0 && (
        <Stack sx={{ gap: 1 }}>
          <Typography variant="body1" weight="medium">
            Where the variance is
          </Typography>
          <Card component="section">
            <TableContainer>
              <Table size="sm">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: '100%' }}>Line</TableCell>
                    <TableCell>Field</TableCell>
                    <TableCell align="right">Invoice</TableCell>
                    <TableCell align="right">PO</TableCell>
                    {threeWay && <TableCell align="right">GRN</TableCell>}
                    <TableCell align="right">vs PO</TableCell>
                    {threeWay && <TableCell align="right">vs GRN</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.lineItem.findings.map((f, index) => (
                    <TableRow key={`${f.lineId}-${f.field}-${index}`} state="error">
                      <TableCell>{f.description}</TableCell>
                      <TableCell>
                        {f.field === 'unitPrice' ? 'Unit price' : f.field === 'lineTotal' ? 'Line total' : 'Quantity'}
                      </TableCell>
                      <TableCell align="right">{num(f.invoiceValue)}</TableCell>
                      <TableCell align="right">{num(f.poValue)}</TableCell>
                      {threeWay && (
                        <TableCell align="right">{f.grnValue === null ? '—' : num(f.grnValue)}</TableCell>
                      )}
                      <TableCell align="right">
                        <Typography variant="body2" color="error.main" weight="medium">
                          {f.diffVsPo > 0 ? '+' : '−'}
                          {num(Math.abs(f.diffVsPo))}
                        </Typography>
                      </TableCell>
                      {threeWay && (
                        <TableCell align="right">
                          {f.diffVsGrn === null ? (
                            '—'
                          ) : (
                            <Typography variant="body2" color="error.main" weight="medium">
                              {f.diffVsGrn > 0 ? '+' : '−'}
                              {num(Math.abs(f.diffVsGrn))}
                            </Typography>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
          <Typography variant="caption" color="text.secondary">
            Correct the extraction, override with a written reason, or reject. Tolerance is{' '}
            {money(config.lineToleranceAbsolute)} or {config.lineTolerancePercent}% per line.
          </Typography>
        </Stack>
      )}

      <Stack sx={{ gap: 1 }}>
        <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
          <Typography variant="body1" weight="medium" sx={{ flex: 1 }}>
            Line comparison
          </Typography>
          <Chip
            size="sm"
            variant="information"
            icon={<DatabaseIcon size={12} />}
            label={`PO from ${invoice.poSource === 'zoho' ? 'Zoho' : invoice.poSource === 'uploaded' ? 'an uploaded document' : 'nowhere'}`}
          />
        </Stack>
        <LineComparison invoice={invoice} />
      </Stack>

      <Stack sx={{ gap: 1 }}>
        <Typography variant="body1" weight="medium">
          Coding per line
        </Typography>
        <LineCoding invoice={invoice} editable={!readOnly} />
        <Typography variant="caption" color="text.secondary">
          Tax codes come from Zoho where connected, otherwise from the country defaults for your
          organisation. Assignment stays manual per line, and both tax and GL are learnable.
        </Typography>
      </Stack>

      {invoice.overrides.length > 0 && (
        <Stack sx={{ gap: 1 }}>
          <Typography variant="body1" weight="medium">
            Overrides on this invoice
          </Typography>
          {invoice.overrides.map((o, index) => (
            <Alert key={index} severity="warning" title={o.rule} floating>
              <Stack sx={{ gap: 0.25 }}>
                <Typography variant="body2">“{o.reason}”</Typography>
                <Typography variant="caption" color="text.secondary">
                  {o.actor} · {o.at} · counted by rule in reporting
                </Typography>
              </Stack>
            </Alert>
          ))}
        </Stack>
      )}

      {/* Override with reason — for variances and balances, never for a
          missing document. */}
      <Dialog
        open={overrideTarget !== null}
        onClose={() => setOverrideTarget(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle
          subtitle="Logged with your name, the time, the rule bypassed and the reason. Counted by rule in reporting."
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
              status={reason.length > 0 && reason.trim().length < 8 ? 'error' : undefined}
              helperText={
                reason.length > 0 && reason.trim().length < 8
                  ? 'Say a little more — this is the record of your judgement.'
                  : 'Mandatory. The control here is auditability, not prevention.'
              }
              multiline
              minRows={3}
              maxRows={6}
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

      <Dialog open={poDialogOpen} onClose={() => setPoDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle
          subtitle={
            connections.zohoBooks
              ? 'Once the number is known, the PO and its receipts are fetched from Zoho as structured records.'
              : 'No ERP is connected, so nothing will be fetched — upload the PO instead.'
          }
          onClose={() => setPoDialogOpen(false)}
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
          <Button appearance="text" variant="secondary" size="sm" onClick={() => setPoDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={poDraft.trim() === ''}
            onClick={() => {
              setPoNumber(invoice.id, poDraft.trim());
              setPoDialogOpen(false);
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

function MetadataFindingRow({
  invoice,
  finding,
  readOnly,
  onOverride,
}: {
  invoice: Invoice;
  finding: MetadataFinding;
  readOnly: boolean;
  onOverride: () => void;
}) {
  const rule = ruleNameForMetadata(finding);
  const settled = isOverridden(invoice, rule);

  return (
    <Alert severity={settled ? 'success' : 'warning'} title={finding.field} floating>
      <Stack sx={{ gap: 1 }}>
        <Stack direction="row" sx={{ gap: 3, flexWrap: 'wrap' }}>
          <Fact
            label="Invoice"
            value={
              <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center' }}>
                {finding.invoiceValue}
                {finding.invoiceConfidence !== null && (
                  <Typography variant="caption" color="text.secondary">
                    {finding.invoiceConfidence}%
                  </Typography>
                )}
              </Stack>
            }
          />
          <Fact
            label="Purchase order"
            value={
              <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center' }}>
                {finding.poValue}
                {finding.poConfidence === null ? (
                  <Typography variant="caption" color="text.secondary">
                    ground truth
                  </Typography>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    {finding.poConfidence}%
                  </Typography>
                )}
              </Stack>
            }
          />
        </Stack>

        {finding.kind === 'vendor' && (
          <Typography variant="caption" color="text.secondary">
            Both names shown. Confirming the pair feeds memory, so the same abbreviation is not
            queried twice.
          </Typography>
        )}
        {finding.kind === 'balance' && (
          <Typography variant="caption" color="text.secondary">
            Utilisation shown. No new PO is required — override or reject.
          </Typography>
        )}

        {settled ? (
          <Chip size="sm" variant="success" icon={<CheckCircleIcon size={12} />} label="Overridden" />
        ) : (
          !readOnly && (
            <Box>
              <Button variant="secondary" appearance="outline" size="sm" onClick={onOverride}>
                Override with a reason
              </Button>
            </Box>
          )
        )}
      </Stack>
    </Alert>
  );
}

/* ── ERP posting ──────────────────────────────────────────────────────── */

function PostingPanel({ invoice }: { invoice: Invoice }) {
  const { config, connections, postInvoice, markExported, goTo } = useStore();

  const readOnly = isTerminal(invoice);
  const cleared = matchingIsClear(invoice);
  const missingCodes = invoice.lines.filter((l) => l.gl === '').length;

  const canPost =
    connections.zohoBooks && !invoice.isSample && cleared && missingCodes === 0 && !readOnly;

  const download = () => {
    const csv = buildCsv([invoice], config);
    downloadCsv(`${invoice.number}-matched-data.csv`, csv);
    markExported([invoice.id]);
  };

  return (
    <Stack sx={{ gap: 3 }}>
      {invoice.status === 'Posted' && (
        <Alert severity="success" title={`Posted to Zoho Books · ${invoice.erpReference}`}>
          The original document is attached to the Zoho bill and the document number is stored
          against this record.
          {invoice.stpPosted && ' This one posted by straight-through processing and never surfaced to anyone.'}
        </Alert>
      )}

      {invoice.status === 'Exported' && (
        <Alert severity="info" title="Exported">
          Terminal where no ERP was connected. It can be downloaded again freely, creating no second
          record — but an exported invoice can never be posted.
        </Alert>
      )}

      {invoice.status === 'Rejected' && (
        <Alert severity="error" title="Rejected">
          {invoice.rejectReason}
        </Alert>
      )}

      {!readOnly && !cleared && (
        <Alert severity="warning" title="This invoice has not cleared matching">
          It appears in a bulk download with its current state and stays open in the queue —
          otherwise a single download would silently terminate work you had not finished.
        </Alert>
      )}

      {!readOnly && invoice.isSample && (
        <Alert severity="info" title="Sample data — this will never post to a real ERP">
          A trial must not put invented bills into a real ledger. Sample records are excluded from
          reporting and complete at Exported instead.
        </Alert>
      )}

      {!readOnly && !connections.zohoBooks && !invoice.isSample && (
        <Alert
          severity="info"
          title="No ERP connected"
          action={
            <Button variant="secondary" appearance="outline" size="sm" onClick={() => goTo('connections')}>
              Connect Zoho
            </Button>
          }
        >
          Download CSV is the terminal action here. The export path is first-class, not a downgrade.
        </Alert>
      )}

      {!readOnly && missingCodes > 0 && (
        <Alert severity="warning" title={`${missingCodes} line${missingCodes === 1 ? '' : 's'} have no GL code`}>
          GL is fetched from the connected chart of accounts or entered by hand, per line, and is
          carried into the CSV where no ERP is connected. Assign them on the matching stage.
        </Alert>
      )}

      <Card component="section">
        <CardContent>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Fact label="Invoice total" value={money(invoice.amount, invoice.currency)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Fact label="Purchase order" value={invoice.poNumber ?? '—'} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Fact label="Match type used" value={invoice.matchResult?.matchTypeUsed ?? config.matchType} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Fact
                label="Reference data from"
                value={invoice.poSource === 'zoho' ? 'Zoho Books' : 'Uploaded documents'}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          <Stack direction="row" sx={{ gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              size="md"
              startIcon={<CurrencyDollarIcon size={16} />}
              disabled={!canPost}
              onClick={() => postInvoice(invoice.id)}
            >
              Post to Zoho Books
            </Button>
            <Button
              variant="secondary"
              appearance="outline"
              size="md"
              startIcon={<DownloadSimpleIcon size={16} />}
              onClick={download}
              disabled={invoice.status === 'Rejected'}
            >
              Download matched-data CSV
            </Button>
          </Stack>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            One terminal action, three forms: post where an ERP is connected, download where none is,
            and neither under straight-through processing — which posts on its own. There is no
            separate approval or payload-confirmation step.
          </Typography>
        </CardContent>
      </Card>

      <Stack sx={{ gap: 1 }}>
        <Typography variant="body1" weight="medium">
          What goes in the CSV
        </Typography>
        <Typography variant="body2" color="text.secondary">
          The output of the matching, not a bill-import file: the header, every line, the PO and GRN
          values beside them, and match status and variance per line.
        </Typography>
        <LineComparison invoice={invoice} />
        <Typography variant="body1" weight="medium" sx={{ mt: 2 }}>
          Coding per line
        </Typography>
        <LineCoding invoice={invoice} editable={!readOnly} />
      </Stack>
    </Stack>
  );
}

/* ── Audit trail ──────────────────────────────────────────────────────── */

function AuditPanel({ invoice }: { invoice: Invoice }) {
  return (
    <Card component="section">
      <CardContent>
        <Stack sx={{ gap: 0.5, mb: 2 }}>
          <Typography variant="h6" component="h2">
            Audit trail
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Every stage, correction, acknowledgement, override and terminal action, with the actor and
            the time. Auto-posted invoices carry the same trail, which is what makes unsupervised work
            reviewable.
          </Typography>
        </Stack>

        <Stepper activeStep={-1}>
          {[...invoice.audit].reverse().map((entry, index) => (
            <Step key={`${entry.at}-${index}`} expanded completed>
              <StepLabel optional={`${entry.actor} · ${entry.at}`}>{entry.action}</StepLabel>
              {entry.detail && <StepContent>{entry.detail}</StepContent>}
            </Step>
          ))}
        </Stepper>
      </CardContent>
    </Card>
  );
}

/* ── The screen ───────────────────────────────────────────────────────── */

const STAGE_LABEL: Record<Stage, string> = {
  extraction: 'Extraction',
  matching: 'Matching',
  posting: 'ERP posting',
};

export function InvoiceDetailScreen() {
  const {
    invoices,
    openInvoiceId,
    config,
    goTo,
    advanceToMatching,
    advanceToPosting,
    rejectInvoice,
    goBackToExtraction,
  } = useStore();

  const invoice = invoices.find((i) => i.id === openInvoiceId);
  const [tab, setTab] = React.useState<Stage | 'audit'>('extraction');
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState('');

  // Follow the invoice to the stage it is actually at when it changes.
  React.useEffect(() => {
    if (invoice) setTab(invoice.stage);
  }, [invoice?.id, invoice?.stage]);

  if (!invoice) {
    return (
      <>
        <RecordBar title="No invoice open" meta={[]} />
        <Box sx={{ p: 3 }}>
          <Button onClick={() => goTo('queue')}>Back to the queue</Button>
        </Box>
      </>
    );
  }

  const readOnly = isTerminal(invoice);
  const extractionClear = extractionIsClear(invoice, config);
  const matchClear = matchingIsClear(invoice);

  const primary = (() => {
    if (readOnly) return null;
    if (invoice.stage === 'extraction') {
      return (
        <Button
          size="sm"
          endIcon={<ArrowRightIcon size={16} />}
          disabled={!extractionClear}
          onClick={() => advanceToMatching(invoice.id)}
        >
          Run matching
        </Button>
      );
    }
    if (invoice.stage === 'matching') {
      return (
        <Button
          size="sm"
          endIcon={<ArrowRightIcon size={16} />}
          disabled={!matchClear}
          onClick={() => {
            advanceToPosting(invoice.id);
            setTab('posting');
          }}
        >
          Continue to posting
        </Button>
      );
    }
    return null;
  })();

  return (
    <>
      <RecordBar
        title={tab === 'audit' ? 'Audit trail' : STAGE_LABEL[tab]}
        meta={[
          { icon: <FilePdfIcon size={META_ICON_PX} />, label: invoice.number },
          { icon: <UsersThreeIcon size={META_ICON_PX} />, label: invoice.vendor },
          { icon: <ClockIcon size={META_ICON_PX} />, label: invoice.invoiceDate },
          { icon: <CurrencyDollarIcon size={META_ICON_PX} />, label: money(invoice.amount, invoice.currency) },
        ]}
        actions={
          <>
            <Tooltip title="Back to the queue">
              <IconButton
                variant="secondary"
                appearance="text"
                size="sm"
                aria-label="Back to the queue"
                onClick={() => goTo('queue')}
              >
                <ArrowLeftIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Ask Neo about this invoice">
              <IconButton
                variant="primary"
                appearance="outline"
                size="sm"
                aria-label="Ask Neo about this invoice"
                onClick={() => goTo('ask-neo')}
              >
                <SparkleIcon />
              </IconButton>
            </Tooltip>
            {!readOnly && (
              <Button
                variant="error"
                appearance="outline"
                size="sm"
                startIcon={<ProhibitIcon size={16} />}
                onClick={() => setRejectOpen(true)}
              >
                Reject
              </Button>
            )}
            {primary}
          </>
        }
      />

      <Box sx={{ px: 3, pt: 2 }}>
        <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
          <StatusChip status={invoice.status} />
          <SourceChip kind={invoice.source} />
          {invoice.isSample && <Chip size="sm" variant="purple" label="Sample data" />}
          {invoice.stpPosted && <Chip size="sm" variant="success" label="Posted unsupervised" />}
          {invoice.overrides.length > 0 && (
            <Chip size="sm" variant="warning" label={`${invoice.overrides.length} override${invoice.overrides.length === 1 ? '' : 's'}`} />
          )}
        </Stack>

        <Tabs value={tab} onChange={(_, next) => setTab(next)} aria-label="Invoice stages">
          <Tab
            label="Extraction"
            value="extraction"
            count={unacknowledgedFields(invoice, config.confidenceThreshold).length || undefined}
          />
          <Tab
            label="Matching"
            value="matching"
            disabled={!extractionClear && !invoice.matchResult}
            count={
              invoice.matchResult
                ? (outstandingFindings(invoice).metadata.length + outstandingFindings(invoice).line.length) || undefined
                : undefined
            }
          />
          <Tab label="ERP posting" value="posting" disabled={!matchClear && !readOnly} />
          <Tab label="Audit trail" value="audit" count={invoice.audit.length} />
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <Box sx={{ px: 3, py: 3 }}>
          {tab === 'extraction' && <ExtractionPanel invoice={invoice} />}
          {tab === 'matching' && <MatchingPanel invoice={invoice} />}
          {tab === 'posting' && <PostingPanel invoice={invoice} />}
          {tab === 'audit' && <AuditPanel invoice={invoice} />}

          {tab !== 'extraction' && tab !== 'audit' && !readOnly && (
            <Stack direction="row" sx={{ mt: 3 }}>
              <Button
                variant="secondary"
                appearance="text"
                size="sm"
                startIcon={<ArrowLeftIcon size={16} />}
                onClick={() => {
                  goBackToExtraction(invoice.id);
                  setTab('extraction');
                }}
              >
                Back to extraction — correcting a field re-runs matching
              </Button>
            </Stack>
          )}
        </Box>
      </Box>

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} role="alertdialog" fullWidth maxWidth="sm">
        <DialogTitle
          subtitle="Closed by a person, with the reason on the record. Rejected invoices are retained and still count for duplicate detection."
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
            helperText="Mandatory."
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
    </>
  );
}
