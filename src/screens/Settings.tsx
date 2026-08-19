import {
  Alert,
  Button,
  Chip,
  Divider,
  Grid,
  Radio,
  RadioGroup,
  Slider,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@neofloai/atoms';
import {
  BrainIcon,
  DatabaseIcon,
  EnvelopeSimpleIcon,
  PlugsConnectedIcon,
  SealCheckIcon,
  WarningIcon,
} from '@neofloai/atoms/icons';
import { useStore } from '../store';
import { PageBody, SectionCard } from '../components/common';
import { ShellBar } from '../components/shell';
import { money } from '../engine';

/* ── Workflow configuration ───────────────────────────────────────────── */

export function ConfigScreen() {
  const { config, updateConfig, memory, invoices } = useStore();

  const midProcessing = invoices.filter(
    (i) => i.status === 'Action Required' || i.status === 'Extraction' || i.status === 'Matching',
  ).length;

  return (
    <>
      <ShellBar />
      <PageBody maxWidth={980}>
        <Stack sx={{ gap: 3 }}>
          <Stack sx={{ gap: 0.5 }}>
            <Typography variant="h3" component="h1">
              Workflow configuration
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Invoice Processing, in this workspace. Editable by a workflow admin, the workspace
              owner, and a tenant owner who is a member here. Every parameter ships with a working
              default.
            </Typography>
          </Stack>

          <Alert severity="info" title="Changes look forward">
            A new setting reaches whatever runs after it — newly ingested invoices, and any stage
            re-run on an existing one. Results already produced are not re-evaluated, so widening a
            tolerance does not retrospectively clear invoices already flagged.
            {midProcessing > 0 && ` ${midProcessing} invoices are mid-processing right now.`}
          </Alert>

          <SectionCard
            title="Match type"
            description="2-way compares the invoice against the PO. 3-way compares it against the PO and the GRN, and both must pass."
          >
            <RadioGroup
              value={config.matchType}
              onChange={(event) => updateConfig({ matchType: event.target.value as '2-way' | '3-way' })}
            >
              <Radio value="3-way" label="3-way — invoice against the PO and the goods receipt (default)" />
              <Radio value="2-way" label="2-way — invoice against the PO only" />
            </RadioGroup>

            <Alert severity="info" title="Why 3-way is the default" floating>
              It is the stricter of the two, and starting strict is recoverable in one click. A
              workspace silently defaulted to 2-way might never notice that receipts were going
              unchecked — which is invisible and permanent. Match type is a workspace-level decision
              applied uniformly, never varied invoice by invoice.
            </Alert>
          </SectionCard>

          <SectionCard
            title="Confidence"
            description="One threshold, applied to invoice fields and reference-document fields alike. Below it, a field is flagged and matching will not run until it is acknowledged or corrected."
          >
            <Stack sx={{ gap: 1, maxWidth: 520 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">Threshold</Typography>
                <Chip size="sm" variant="primary" label={`${config.confidenceThreshold}%`} />
              </Stack>
              <Slider
                aria-label="Confidence threshold"
                value={config.confidenceThreshold}
                min={50}
                max={99}
                valueLabelDisplay="auto"
                marks={[
                  { value: 50, label: '50' },
                  { value: 75, label: '75' },
                  { value: 99, label: '99' },
                ]}
                onChange={(_, value) => updateConfig({ confidenceThreshold: value as number })}
              />
              <Typography variant="caption" color="text.secondary">
                No confidence floor rejects a document outright. A poor scan is usable — you fix what
                the OCR got wrong.
              </Typography>
            </Stack>
          </SectionCard>

          <SectionCard
            title="Tolerance"
            description="A variance clears if it is inside either bound. Amounts are in the workspace currency."
          >
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Total tolerance — absolute"
                  value={String(config.totalToleranceAbsolute)}
                  onChange={(event) =>
                    updateConfig({ totalToleranceAbsolute: Number(event.target.value) || 0 })
                  }
                  helperText={`Currently ${money(config.totalToleranceAbsolute)}`}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Total tolerance — percentage"
                  value={String(config.totalTolerancePercent)}
                  onChange={(event) =>
                    updateConfig({ totalTolerancePercent: Number(event.target.value) || 0 })
                  }
                  helperText="Of the PO total"
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Line tolerance — absolute"
                  value={String(config.lineToleranceAbsolute)}
                  onChange={(event) =>
                    updateConfig({ lineToleranceAbsolute: Number(event.target.value) || 0 })
                  }
                  helperText={`Currently ${money(config.lineToleranceAbsolute)}`}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Line tolerance — percentage"
                  value={String(config.lineTolerancePercent)}
                  onChange={(event) =>
                    updateConfig({ lineTolerancePercent: Number(event.target.value) || 0 })
                  }
                  helperText="Of the PO line"
                  fullWidth
                />
              </Grid>
            </Grid>
          </SectionCard>

          <SectionCard
            title="Line item match fields"
            description="Each is independent, and all three are on by default. In a 3-way match they run against the PO and the GRN."
          >
            <Stack sx={{ gap: 1 }}>
              <Switch
                label="Quantity"
                checked={config.matchQuantity}
                onChange={(_, checked) => updateConfig({ matchQuantity: checked })}
              />
              <Switch
                label="Unit price"
                checked={config.matchUnitPrice}
                onChange={(_, checked) => updateConfig({ matchUnitPrice: checked })}
              />
              <Switch
                label="Line total"
                checked={config.matchLineTotal}
                onChange={(_, checked) => updateConfig({ matchLineTotal: checked })}
              />
            </Stack>
          </SectionCard>

          <SectionCard
            title="Automation"
            description="What the product does without being asked."
          >
            <Stack sx={{ gap: 2 }}>
              <Stack sx={{ gap: 0.5 }}>
                <Switch
                  label="Auto-advance past a stage needing no input"
                  checked={config.autoAdvance}
                  onChange={(_, checked) => updateConfig({ autoAdvance: checked })}
                />
                <Typography variant="caption" color="text.secondary" sx={{ ml: 6 }}>
                  An invoice moves through any stage that needs nothing from you and surfaces at the
                  first one that does. You are shown work, not asked to walk stages.
                </Typography>
              </Stack>

              <Divider />

              <Stack sx={{ gap: 0.5 }}>
                <Switch
                  label="Straight-through processing"
                  checked={config.straightThrough}
                  onChange={(_, checked) => updateConfig({ straightThrough: checked })}
                />
                <Typography variant="caption" color="text.secondary" sx={{ ml: 6 }}>
                  Clean invoice, ERP connected, nothing flagged — it posts on its own and never
                  surfaces. Requires a connected ERP and is otherwise inert. Memory learns nothing on
                  this path, since no correction means no acknowledgement.
                </Typography>
              </Stack>
            </Stack>
          </SectionCard>

          <SectionCard
            title="Vendor normalisation"
            description="A shipped library covers legal-entity suffixes, punctuation, casing and whitespace — no abbreviation list is asked of you. Confirming a flagged pair stores it through memory."
          >
            <Stack sx={{ gap: 1, maxWidth: 520 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">Fuzzy match threshold</Typography>
                <Chip size="sm" variant="primary" label={`${config.vendorFuzzyThreshold}%`} />
              </Stack>
              <Slider
                aria-label="Vendor fuzzy threshold"
                value={config.vendorFuzzyThreshold}
                min={60}
                max={100}
                valueLabelDisplay="auto"
                onChange={(_, value) => updateConfig({ vendorFuzzyThreshold: value as number })}
              />
            </Stack>
          </SectionCard>

          <SectionCard
            title="Duplicate detection"
            description="Tenant-wide, across every workspace and workflow — the same invoice must not be paid twice anywhere in the organisation. Keys are fixed in this version."
          >
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              {config.duplicateKeys.map((key) => (
                <Chip key={key} size="sm" variant="information" icon={<DatabaseIcon size={12} />} label={key} />
              ))}
            </Stack>
          </SectionCard>

          <SectionCard
            title="Memory"
            description="The user acknowledges a correction, a streak builds, and past the threshold it becomes a memory that suggests. No candidate queue and no approver — in a small team the approver is the person doing the work."
          >
            <Stack sx={{ gap: 3 }}>
              <Stack sx={{ gap: 1, maxWidth: 520 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Acknowledgements before a memory forms</Typography>
                  <Chip size="sm" variant="primary" label={config.memoryThreshold} />
                </Stack>
                <Slider
                  aria-label="Memory threshold"
                  value={config.memoryThreshold}
                  min={1}
                  max={8}
                  step={1}
                  marks
                  valueLabelDisplay="auto"
                  onChange={(_, value) => updateConfig({ memoryThreshold: value as number })}
                />
              </Stack>

              <Table size="sm">
                <TableHead>
                  <TableRow>
                    <TableCell>Field</TableCell>
                    <TableCell sx={{ width: '100%' }}>Pattern</TableCell>
                    <TableCell>Suggested value</TableCell>
                    <TableCell align="right">Streak</TableCell>
                    <TableCell align="right">Last seen</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {memory.map((pattern) => {
                    const live = pattern.streak >= config.memoryThreshold;
                    return (
                      <TableRow key={pattern.id} state={live ? 'success' : undefined}>
                        <TableCell icon={<BrainIcon size={16} />}>{pattern.field}</TableCell>
                        <TableCell>{pattern.patternKey}</TableCell>
                        <TableCell>{pattern.suggestedValue}</TableCell>
                        <TableCell align="right">
                          <Chip
                            size="sm"
                            variant={live ? 'success' : 'warning'}
                            icon={live ? <SealCheckIcon size={12} /> : <WarningIcon size={12} />}
                            label={live ? `Live · ${pattern.streak}` : `${pattern.streak} of ${config.memoryThreshold}`}
                          />
                        </TableCell>
                        <TableCell align="right">{pattern.lastSeen}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <Typography variant="caption" color="text.secondary">
                Learnable fields are fixed: GL code, VAT, WHT, vendor mapping, and extraction and
                metadata corrections. Per-transaction fields — invoice number, invoice date, PO number
                — are never learned. Scope is this workflow instance: nothing is shared across
                workspaces or with other workflows.
              </Typography>
            </Stack>
          </SectionCard>

          <Alert severity="warning" title="Not decided in the prototype">
            Configuration defaults, tax codes per country and the pre-computed reference data are
            provided separately by the SME before build. The numbers above stand in for them.
          </Alert>
        </Stack>
      </PageBody>
    </>
  );
}

/* ── Connections ──────────────────────────────────────────────────────── */

export function ConnectionsScreen() {
  const { connections, updateConnections, config, invoices } = useStore();

  const atPosting = invoices.filter((i) => i.stage === 'posting' && i.status === 'ERP posting').length;

  return (
    <>
      <ShellBar />
      <PageBody maxWidth={860}>
        <Stack sx={{ gap: 3 }}>
          <Stack sx={{ gap: 0.5 }}>
            <Typography variant="h3" component="h1">
              Connections
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Each workspace connects its own ERP instance and its own mailbox, set up by the
              workspace owner or the tenant owner.
            </Typography>
          </Stack>

          <SectionCard
            title="Zoho"
            description="Books supplies purchase orders, bills and the chart of accounts. Inventory adds goods receipts."
            action={
              connections.zohoBooks ? (
                <Chip size="sm" variant="success" icon={<PlugsConnectedIcon size={12} />} label="Connected" />
              ) : (
                <Chip size="sm" variant="secondary" label="Not connected" />
              )
            }
          >
            <Stack sx={{ gap: 2 }}>
              <Stack sx={{ gap: 0.5 }}>
                <Switch
                  label="Zoho Books"
                  checked={connections.zohoBooks}
                  onChange={(_, checked) =>
                    updateConnections(
                      checked ? { zohoBooks: true } : { zohoBooks: false, zohoInventory: false },
                    )
                  }
                />
                <Typography variant="caption" color="text.secondary" sx={{ ml: 6 }}>
                  Purchase orders, bills, chart of accounts, vendor master and tax codes are read.
                  The bill is written back to Books.
                </Typography>
              </Stack>

              <Stack sx={{ gap: 0.5 }}>
                <Switch
                  label="Zoho Inventory"
                  checked={connections.zohoInventory}
                  disabled={!connections.zohoBooks}
                  onChange={(_, checked) => updateConnections({ zohoInventory: checked })}
                />
                <Typography variant="caption" color="text.secondary" sx={{ ml: 6 }}>
                  Goods receipts live here.
                </Typography>
              </Stack>

              {connections.zohoBooks && !connections.zohoInventory && config.matchType === '3-way' && (
                <Alert severity="warning" title="3-way needs Inventory for receipts">
                  On Books alone, a 3-way match only works from uploaded GRN documents. Anything with
                  no receipt raised will hard block until you upload one, or lower the match type to
                  2-way.
                </Alert>
              )}

              {!connections.zohoBooks && (
                <Alert severity="info" title="No ERP is a supported answer">
                  Match against an uploaded PO and download the matched-data CSV instead. The export
                  path is first-class, not a downgrade.
                  {atPosting > 0 &&
                    ` ${atPosting} invoice${atPosting === 1 ? '' : 's'} sitting at the posting stage will stay there — download becomes available, posting is disabled, and straight-through processing goes inert.`}
                </Alert>
              )}
            </Stack>
          </SectionCard>

          <SectionCard
            title="Mailbox"
            description="You connect your own Gmail or Outlook and nominate one folder or label — in practice the invoice folder of a shared AP mailbox. Only what lands there is read."
            action={
              connections.mailboxProvider ? (
                <Chip size="sm" variant="success" icon={<EnvelopeSimpleIcon size={12} />} label="Connected" />
              ) : (
                <Chip size="sm" variant="secondary" label="Not connected" />
              )
            }
          >
            <Stack sx={{ gap: 2 }}>
              <Stack direction="row" sx={{ gap: 1.5, flexWrap: 'wrap' }}>
                <Button
                  variant={connections.mailboxProvider === 'gmail' ? 'primary' : 'secondary'}
                  appearance={connections.mailboxProvider === 'gmail' ? 'contained' : 'outline'}
                  size="sm"
                  onClick={() => updateConnections({ mailboxProvider: 'gmail' })}
                >
                  Gmail
                </Button>
                <Button
                  variant={connections.mailboxProvider === 'outlook' ? 'primary' : 'secondary'}
                  appearance={connections.mailboxProvider === 'outlook' ? 'contained' : 'outline'}
                  size="sm"
                  onClick={() => updateConnections({ mailboxProvider: 'outlook' })}
                >
                  Outlook
                </Button>
                {connections.mailboxProvider && (
                  <Button
                    variant="error"
                    appearance="text"
                    size="sm"
                    onClick={() => updateConnections({ mailboxProvider: null })}
                  >
                    Disconnect
                  </Button>
                )}
              </Stack>

              {connections.mailboxProvider && (
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Mailbox"
                      value={connections.mailboxAddress}
                      onChange={(event) => updateConnections({ mailboxAddress: event.target.value })}
                      helperText="Your own mailbox, not an address Neoflo issues."
                      fullWidth
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Folder or label"
                      value={connections.mailboxFolder}
                      onChange={(event) => updateConnections({ mailboxFolder: event.target.value })}
                      helperText="Mail outside this folder is never read."
                      fullWidth
                    />
                  </Grid>
                </Grid>
              )}

              <Alert severity="info" title="The folder is the signal">
                Neoflo does not judge what an email is for — it processes what you have already filed
                as an invoice. That is what lets this version ship with no intent detection on the
                mail itself.
              </Alert>
            </Stack>
          </SectionCard>

          <Alert severity="info" title="One grant, two consumers">
            Ask Neo already connects a mailbox at workspace level, and invoice ingestion now connects
            one too. This should be a single OAuth grant with two consumers rather than two grants —
            flagged for engineering before build. Whether connecting a folder pulls in mail already
            sitting there, or only what arrives after, is also still open.
          </Alert>
        </Stack>
      </PageBody>
    </>
  );
}
