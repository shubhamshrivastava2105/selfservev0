import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  DataGrid,
  Divider,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  countActiveFilters,
} from '@neofloai/atoms';
import {
  DownloadSimpleIcon,
  EnvelopeSimpleIcon,
  FadersHorizontalIcon,
  FilesIcon,
  MagnifyingGlassIcon,
  SparkleIcon,
  UploadSimpleIcon,
  WarningIcon,
} from '@neofloai/atoms/icons';
import type { FilterGroup, FilterValue } from '@neofloai/atoms';
import { Filter } from '@neofloai/atoms';
import { useStore } from '../store';
import { EmptyState, SourceChip, StatusChip } from '../components/common';
import { ShellBar } from '../components/shell';
import { buildCsv, downloadCsv, money, unacknowledgedFields } from '../engine';
import type { Invoice } from '../types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "17 Aug 2026, 09:19" → days before 19 Aug 2026. */
function ageInDays(stampText: string): number {
  const match = /^(\d{1,2}) (\w{3}) (\d{4})/.exec(stampText);
  if (!match) return 0;
  const day = Number(match[1]);
  const month = MONTHS.indexOf(match[2]);
  const year = Number(match[3]);
  if (month < 0) return 0;
  const then = Date.UTC(year, month, day);
  const now = Date.UTC(2026, 7, 19);
  return Math.max(0, Math.round((now - then) / 86_400_000));
}

export function QueueScreen() {
  const {
    invoices,
    sources,
    config,
    connections,
    openInvoice,
    runSamples,
    uploadInvoice,
    markExported,
  } = useStore();

  const [tab, setTab] = React.useState<'invoices' | 'sources'>('invoices');
  const [search, setSearch] = React.useState('');
  const [selection, setSelection] = React.useState<FilterValue>({});
  const [filterAnchor, setFilterAnchor] = React.useState<HTMLElement | null>(null);
  const [addAnchor, setAddAnchor] = React.useState<HTMLElement | null>(null);

  const vendors = React.useMemo(
    () => [...new Set(invoices.map((i) => i.vendor))].sort(),
    [invoices],
  );

  const groups: FilterGroup[] = React.useMemo(
    () => [
      {
        id: 'status',
        label: 'Status',
        disableSearch: true,
        options: [
          { value: 'Action Required', label: <Chip size="sm" variant="warning" label="Action Required" />, searchText: 'Action Required' },
          { value: 'Extraction', label: <Chip size="sm" variant="information" label="Extraction" />, searchText: 'Extraction' },
          { value: 'Matching', label: <Chip size="sm" variant="information" label="Matching" />, searchText: 'Matching' },
          { value: 'ERP posting', label: <Chip size="sm" variant="primary" label="ERP posting" />, searchText: 'ERP posting' },
          { value: 'Posted', label: <Chip size="sm" variant="success" label="Posted" />, searchText: 'Posted' },
          { value: 'Exported', label: <Chip size="sm" variant="purple" label="Exported" />, searchText: 'Exported' },
          { value: 'Rejected', label: <Chip size="sm" variant="error" label="Rejected" />, searchText: 'Rejected' },
        ],
      },
      {
        id: 'source',
        label: 'Source',
        disableSearch: true,
        options: [
          { value: 'Upload', label: 'Upload', searchText: 'Upload' },
          { value: 'Mailbox', label: 'Mailbox', searchText: 'Mailbox' },
          { value: 'Sample', label: 'Sample data', searchText: 'Sample' },
        ],
      },
      {
        id: 'automation',
        label: 'Automation',
        disableSearch: true,
        disableBulkActions: true,
        options: [
          { value: 'stp', label: 'Posted unsupervised', searchText: 'straight-through processing STP unsupervised' },
          { value: 'surfaced', label: 'Surfaced to a person', searchText: 'surfaced touched' },
        ],
      },
      {
        id: 'vendor',
        label: 'Vendor',
        options: vendors.map((v) => ({ value: v, label: v, searchText: v })),
      },
    ],
    [vendors],
  );

  const activeCount = countActiveFilters(groups, selection);
  const isFiltered = activeCount > 0 || search.trim() !== '';

  const rows = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return invoices.filter((invoice) => {
      if (query !== '') {
        const haystack = [invoice.number, invoice.vendor, invoice.poNumber ?? '', invoice.status]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      const statuses = selection.status ?? [];
      if (statuses.length > 0 && !statuses.includes(invoice.status)) return false;

      const sourceKinds = selection.source ?? [];
      if (sourceKinds.length > 0 && !sourceKinds.includes(invoice.source)) return false;

      const automation = selection.automation ?? [];
      if (automation.length > 0) {
        const isStp = invoice.stpPosted;
        const surfaced = invoice.firstSurfacedAt !== null;
        const wantsStp = automation.includes('stp');
        const wantsSurfaced = automation.includes('surfaced');
        if (!((wantsStp && isStp) || (wantsSurfaced && surfaced))) return false;
      }

      const vendorPick = selection.vendor ?? [];
      if (vendorPick.length > 0 && !vendorPick.includes(invoice.vendor)) return false;

      return true;
    });
  }, [invoices, search, selection]);

  const columns = React.useMemo(
    () => [
      {
        field: 'number',
        headerName: 'Invoice',
        width: 165,
        renderCell: ({ row }: { row: Invoice }) => (
          <Stack sx={{ gap: 0, minWidth: 0 }}>
            <Typography variant="body2" weight="medium" noWrap>
              {row.number}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {row.invoiceDate} · {ageInDays(row.ingestedAt)}d old
            </Typography>
          </Stack>
        ),
      },
      { field: 'vendor', headerName: 'Vendor', flex: 1, minWidth: 150 },
      {
        field: 'amount',
        headerName: 'Amount',
        type: 'number' as const,
        width: 120,
        renderCell: ({ row }: { row: Invoice }) => (
          <Typography variant="body2">{money(row.amount, row.currency)}</Typography>
        ),
      },
      {
        field: 'poNumber',
        headerName: 'PO',
        width: 130,
        renderCell: ({ row }: { row: Invoice }) =>
          row.poNumber ? (
            <Typography variant="body2" noWrap>
              {row.poNumber}
            </Typography>
          ) : (
            <Chip size="sm" variant="error" label="None" />
          ),
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 190,
        renderCell: ({ row }: { row: Invoice }) => {
          const pending = unacknowledgedFields(row, config.confidenceThreshold).length;
          return (
            <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center' }}>
              <StatusChip status={row.status} />
              {pending > 0 && (
                <Tooltip title={`${pending} field${pending === 1 ? '' : 's'} below the ${config.confidenceThreshold}% threshold`}>
                  <Chip size="sm" variant="warning" icon={<WarningIcon size={12} />} label={pending} />
                </Tooltip>
              )}
              {row.stpPosted && (
                <Tooltip title="Posted by straight-through processing. Never surfaced to anyone.">
                  <Box sx={{ display: 'flex', color: 'text.secondary' }}>
                    <SparkleIcon size={14} />
                  </Box>
                </Tooltip>
              )}
            </Stack>
          );
        },
      },
      {
        field: 'source',
        headerName: 'Source',
        width: 110,
        renderCell: ({ row }: { row: Invoice }) => <SourceChip kind={row.source} />,
      },
      {
        field: 'matchType',
        headerName: 'Match',
        width: 80,
        sortable: false,
        renderCell: ({ row }: { row: Invoice }) => (
          <Typography variant="body2" color="text.secondary">
            {row.matchResult?.matchTypeUsed ?? config.matchType}
          </Typography>
        ),
      },
      {
        field: 'open',
        headerName: '',
        width: 88,
        sortable: false,
        align: 'right' as const,
        renderCell: ({ row }: { row: Invoice }) => (
          <Button
            variant="secondary"
            appearance="outline"
            size="sm"
            onClick={() => openInvoice(row.id)}
          >
            Open
          </Button>
        ),
      },
    ],
    [config.matchType, config.confidenceThreshold, openInvoice],
  );

  const needsMe = invoices.filter((i) => i.status === 'Action Required').length;

  const exportFiltered = () => {
    const csv = buildCsv(rows, config);
    downloadCsv(`neoflo-matched-data-${rows.length}-invoices.csv`, csv);
    markExported(rows.map((r) => r.id));
  };

  return (
    <>
      <ShellBar>
        <Button
          variant="secondary"
          appearance="outline"
          size="sm"
          startIcon={<DownloadSimpleIcon size={16} />}
          disabled={rows.length === 0}
          onClick={exportFiltered}
        >
          Download CSV
        </Button>
        <Button
          size="sm"
          startIcon={<UploadSimpleIcon size={16} />}
          onClick={(event) => setAddAnchor(event.currentTarget)}
        >
          Add invoices
        </Button>
      </ShellBar>

      <Stack sx={{ flex: 1, minHeight: 0 }}>
        <Box sx={{ px: 3, pt: 3, pb: 2 }}>
          <Stack direction="row" sx={{ gap: 2, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Stack sx={{ flex: 1, gap: 0.25, minWidth: 240 }}>
              <Typography variant="h3" component="h1">
                Invoices
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {invoices.length} records ·{' '}
                {needsMe > 0
                  ? `${needsMe} need you`
                  : 'nothing needs you'}{' '}
                · an invoice moves through any stage needing nothing from you and surfaces at the
                first one that does
              </Typography>
            </Stack>
          </Stack>
        </Box>

        <Box sx={{ px: 3 }}>
          <Tabs value={tab} onChange={(_, next) => setTab(next)} aria-label="Queue views">
            <Tab label="Invoices" value="invoices" count={invoices.length} />
            <Tab label="Sources" value="sources" count={sources.length} />
          </Tabs>
        </Box>

        {tab === 'invoices' ? (
          <>
            <Stack
              direction="row"
              sx={{ px: 3, py: 2, gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}
            >
              <TextField
                placeholder="Search invoice, vendor or PO…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                startAdornment={<MagnifyingGlassIcon size={16} />}
                sx={{ width: 300 }}
              />
              <Stack direction="row" sx={{ gap: 1 }}>
                <Button
                  variant="secondary"
                  appearance="outline"
                  disabled={!isFiltered}
                  onClick={() => {
                    setSelection({});
                    setSearch('');
                  }}
                >
                  Clear Filters
                </Button>
                <Button
                  variant="secondary"
                  appearance="outline"
                  startIcon={<FadersHorizontalIcon />}
                  onClick={(event) => setFilterAnchor(event.currentTarget)}
                >
                  Filter
                  {activeCount > 0 && (
                    <Chip size="sm" variant="primary" component="span" label={activeCount} />
                  )}
                </Button>
              </Stack>
            </Stack>
            <Divider />

            {/* A definite height for the grid to be 100% of. */}
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <DataGrid
                size="sm"
                rows={rows}
                columns={columns}
                rowNoun="invoices"
                pagination
                pageSizeOptions={[10, 25, 50]}
                initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
                rowState={({ row }: { row: Invoice }) => {
                  if (row.status === 'Rejected') return 'disabled';
                  if (row.status === 'Action Required') return 'error';
                  if (row.status === 'Posted' || row.status === 'Exported') return 'success';
                  return undefined;
                }}
                onRowClick={({ row }: { row: Invoice }) => openInvoice(row.id)}
              />
            </Box>
          </>
        ) : (
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 3, py: 3 }}>
            <Stack sx={{ gap: 2 }}>
              <Alert severity="info" title="One upload or one email is a source">
                A source may carry many documents — several invoices, their POs, GRNs and supporting
                files. Each invoice becomes its own record and is processed independently. A source
                shows a count, not a rolled-up status.
              </Alert>

              {sources.map((source) => {
                const theirs = invoices.filter((i) => i.sourceId === source.id);
                const attention = theirs.filter((i) => i.status === 'Action Required').length;
                return (
                  <Card key={source.id} component="article">
                    <Stack sx={{ p: 2, gap: 1.5 }}>
                      <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                        <SourceChip kind={source.kind} />
                        <Typography variant="body2" weight="medium" sx={{ flex: 1, minWidth: 200 }}>
                          {source.label}
                        </Typography>
                        {theirs.length > 0 && (
                          <Chip
                            size="sm"
                            variant={attention > 0 ? 'warning' : 'success'}
                            label={
                              attention > 0
                                ? `${attention} of ${theirs.length} need attention`
                                : `${theirs.length} processed`
                            }
                          />
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        Arrived {source.arrivedAt}
                      </Typography>

                      {source.heldDocuments.length > 0 && (
                        <Alert severity="warning" title="Held on the source">
                          {source.heldDocuments.join(', ')} — no invoice was found among these, so no
                          record was created. They stay attachable to a later invoice in this
                          workspace.
                        </Alert>
                      )}

                      {theirs.length > 0 && (
                        <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
                          {theirs.map((invoice) => (
                            <Chip
                              key={invoice.id}
                              size="sm"
                              variant="secondary"
                              label={invoice.number}
                              onClick={() => openInvoice(invoice.id)}
                            />
                          ))}
                        </Stack>
                      )}
                    </Stack>
                  </Card>
                );
              })}
            </Stack>
          </Box>
        )}

        {tab === 'invoices' && rows.length === 0 && (
          <EmptyState
            icon={<FilesIcon size={40} />}
            title={isFiltered ? 'Nothing matches those filters' : 'No invoices yet'}
            description={
              isFiltered
                ? 'Clear the filters to see the whole queue.'
                : 'Upload an invoice with its PO and GRN, let Neoflo read your nominated mailbox folder, or run the pre-computed sample set for your country.'
            }
            action={
              isFiltered ? (
                <Button variant="secondary" appearance="outline" onClick={() => { setSelection({}); setSearch(''); }}>
                  Clear Filters
                </Button>
              ) : (
                <Button onClick={runSamples}>Run a sample</Button>
              )
            }
          />
        )}
      </Stack>

      <Filter
        groups={groups}
        value={selection}
        onChange={setSelection}
        anchorEl={filterAnchor}
        open={filterAnchor !== null}
        onClose={() => setFilterAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      />

      <Menu
        anchorEl={addAnchor}
        open={Boolean(addAnchor)}
        onClose={() => setAddAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{ '& .MuiMenu-paper': { minWidth: 320 } }}
      >
        <MenuItem
          onClick={() => {
            setAddAnchor(null);
            uploadInvoice();
          }}
        >
          <UploadSimpleIcon size={16} />
          Upload — invoice, PO and GRN together
        </MenuItem>
        <MenuItem disabled>
          <EnvelopeSimpleIcon size={16} />
          {connections.mailboxProvider
            ? `Mailbox — reading ${connections.mailboxFolder}`
            : 'Mailbox — not connected'}
        </MenuItem>
        <Divider />
        <MenuItem
          variant="action"
          onClick={() => {
            setAddAnchor(null);
            runSamples();
          }}
        >
          <SparkleIcon size={16} />
          Run a sample — three US invoices with POs and GRNs
        </MenuItem>
      </Menu>
    </>
  );
}
