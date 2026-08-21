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
import { VISIBILITY_COPY } from '../data';
import { useStore } from '../store';
import { PageBody, SectionCard } from '../components/common';
import { ShellBar } from '../components/shell';
import { money } from '../engine';
import { formatRelative } from '../clock';
import type { WorkspaceVisibility } from '../types';

/* ── Workflow configuration ───────────────────────────────────────────── */

export function WorkflowConfigScreen() {
  const { config, updateConfig, memory, invoices, connections, goTo } = useStore();

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
              How Invoice Processing reads and matches invoices. Integrations and joining are in
              Workspace.
            </Typography>
          </Stack>

          <Alert severity="info" title="Changes look forward">
            Changes apply to invoices ingested from now on, and to any stage you re-run. Invoices
            already flagged stay flagged until their stage runs again.
            {midProcessing > 0 &&
              ` ${midProcessing} invoice${midProcessing === 1 ? ' is' : 's are'} mid-processing.`}
          </Alert>

          <SectionCard
            title="Match type"
            description="2-way compares the invoice against the PO. 3-way compares it against the PO and the GRN, and both must pass."
          >
            <RadioGroup
              value={config.matchType}
              onChange={(event) => updateConfig({ matchType: event.target.value as '2-way' | '3-way' })}
            >
              <Radio value="3-way" label="3-way: invoice against the PO and the goods receipt (default)" />
              <Radio value="2-way" label="2-way: invoice against the PO only" />
            </RadioGroup>

            <Typography variant="caption" color="text.secondary">
              Applies uniformly to everything that runs after you change it. It is never varied for
              one invoice.
            </Typography>
          </SectionCard>

          <SectionCard
            title="Confidence"
            description="Fields read below this are flagged, and matching waits until you acknowledge or correct them. Applies to invoices and reference documents alike."
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
                Nothing is rejected for a poor scan. You correct what it got wrong.
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
                  label="Total tolerance (amount)"
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
                  label="Total tolerance (%)"
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
                  label="Line tolerance (amount)"
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
                  label="Line tolerance (%)"
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
                  With a clean invoice, a connected ERP and nothing flagged, it posts on its own and
                  never surfaces. Memory learns nothing on this path, since no correction means no
                  acknowledgment.
                </Typography>
              </Stack>

              {/* On rather than off, but with nowhere to post: worth saying out
                  loud, because the setting reads as active and is not. */}
              {config.straightThrough && !connections.zohoBooks && (
                <Alert
                  severity="warning"
                  title="Straight-through processing is on, but inert"
                  action={
                    <Button
                      variant="secondary"
                      appearance="outline"
                      size="sm"
                      onClick={() => goTo('workspace-config')}
                      sx={{ whiteSpace: 'nowrap' }}
                    >
                      Connect an ERP
                    </Button>
                  }
                >
                  No ERP is connected, so every invoice will surface at ERP posting for you to download.
                </Alert>
              )}
            </Stack>
          </SectionCard>

          <SectionCard
            title="Vendor normalization"
            description="Legal-entity suffixes, punctuation, casing and whitespace are ignored when comparing vendor names. Confirming a flagged pair teaches it for next time."
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
            description="Runs across every workspace and workflow in your organization, so the same invoice cannot be paid twice anywhere."
          >
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              {config.duplicateKeys.map((key) => (
                <Chip key={key} size="sm" variant="information" icon={<DatabaseIcon size={12} />} label={key} />
              ))}
            </Stack>
          </SectionCard>

          <SectionCard
            title="Memory"
            description="Acknowledge the same correction enough times and it is remembered, then offered back on that field as a suggestion you accept."
          >
            <Stack sx={{ gap: 3 }}>
              <Stack sx={{ gap: 1, maxWidth: 520 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Acknowledgments before a memory forms</Typography>
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
                        <TableCell align="right">{formatRelative(pattern.lastSeen)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <Typography variant="caption" color="text.secondary">
                Neoflo learns GL, VAT and WHT codes, vendor names, and extraction corrections. It never
                learns per-invoice values such as an invoice number or date, and nothing is shared
                with another workspace.
              </Typography>
            </Stack>
          </SectionCard>
        </Stack>
      </PageBody>
    </>
  );
}

/* ── Connections ──────────────────────────────────────────────────────── */

export function WorkspaceConfigScreen() {
  const {
    connections,
    updateConnections,
    config,
    invoices,
    profile,
    workspaceVisibility,
    setWorkspaceVisibility,
  } = useStore();

  const atPosting = invoices.filter((i) => i.stage === 'posting' && i.status === 'ERP posting').length;

  return (
    <>
      <ShellBar />
      <PageBody maxWidth={860}>
        <Stack sx={{ gap: 3 }}>
          <Stack sx={{ gap: 0.5 }}>
            <Typography variant="h3" component="h1">
              Workspace configuration
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Integrations and joining for {profile.workspaceName || 'this workspace'}, shared by every
              workflow in it. Match type and tolerances are in Workflow.
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
                  Neoflo reads purchase orders, bills, your chart of accounts and tax codes, and writes
                  the finished bill back.
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
                  Without Inventory, a 3-way match needs the goods receipt uploaded as a document.
                  Anything without one will block.
                </Alert>
              )}

              {!connections.zohoBooks && (
                <Alert severity="info" title="No ERP is a supported answer">
                  Match against an uploaded purchase order and download the results as a CSV.
                  {atPosting > 0 &&
                    ` ${atPosting} invoice${atPosting === 1 ? '' : 's'} sitting at the posting stage will stay there. Download becomes available, posting is disabled, and straight-through processing goes inert.`}
                </Alert>
              )}
            </Stack>
          </SectionCard>

          <SectionCard
            title="Mailbox"
            description="Connect Gmail or Outlook and pick one folder. Neoflo reads only what lands there."
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
                      helperText="The mailbox Neoflo reads from."
                      fullWidth
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Folder or label"
                      value={connections.mailboxFolder}
                      onChange={(event) => updateConnections({ mailboxFolder: event.target.value })}
                      helperText="Only this folder is read."
                      fullWidth
                    />
                  </Grid>
                </Grid>
              )}
            </Stack>
          </SectionCard>

          <SectionCard
            title="Ticketing"
            description="For invoices that arrive as tickets rather than mail. Ask Neo can answer from them too."
            action={
              connections.ticketing ? (
                <Chip size="sm" variant="success" icon={<PlugsConnectedIcon size={12} />} label="Connected" />
              ) : (
                <Chip size="sm" variant="secondary" label="Not connected" />
              )
            }
          >
            <Stack sx={{ gap: 2 }}>
              <Stack direction="row" sx={{ gap: 1.5, flexWrap: 'wrap' }}>
                <Button
                  variant={connections.ticketing === 'freshdesk' ? 'primary' : 'secondary'}
                  appearance={connections.ticketing === 'freshdesk' ? 'contained' : 'outline'}
                  size="sm"
                  onClick={() => updateConnections({ ticketing: 'freshdesk' })}
                >
                  Freshdesk
                </Button>
                <Button
                  variant={connections.ticketing === 'zendesk' ? 'primary' : 'secondary'}
                  appearance={connections.ticketing === 'zendesk' ? 'contained' : 'outline'}
                  size="sm"
                  onClick={() => updateConnections({ ticketing: 'zendesk' })}
                >
                  Zendesk
                </Button>
                {connections.ticketing && (
                  <Button
                    variant="error"
                    appearance="text"
                    size="sm"
                    onClick={() => updateConnections({ ticketing: null })}
                  >
                    Disconnect
                  </Button>
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Optional. Upload and mailbox cover most teams.
              </Typography>
            </Stack>
          </SectionCard>

          <SectionCard
            title="Who can join"
            description="Who from your organization can get into this workspace."
          >
            <RadioGroup
              value={workspaceVisibility}
              onChange={(event) => setWorkspaceVisibility(event.target.value as WorkspaceVisibility)}
            >
              {(['public', 'approval', 'private'] as WorkspaceVisibility[]).map((option) => (
                <Stack key={option} sx={{ gap: 0, mb: 1.5 }}>
                  <Radio value={option} label={VISIBILITY_COPY[option].label} />
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 3.5 }}>
                    {VISIBILITY_COPY[option].detail}
                  </Typography>
                </Stack>
              ))}
            </RadioGroup>

            {workspaceVisibility === 'private' && (
              <Alert severity="info" floating title="Nobody can find this workspace now">
                Same-domain colleagues will not see it on the screen they meet after signing up.
                Invite them by email instead.
              </Alert>
            )}
          </SectionCard>
        </Stack>
      </PageBody>
    </>
  );
}
