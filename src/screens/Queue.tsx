import * as React from 'react';
import {
  Alert,
  Box,
  Button,
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
import { UploadDialog } from '../components/UploadDialog';
import { buildCsv, downloadCsv, money, unacknowledgedFields } from '../engine';
import { ageInDays, formatDate } from '../clock';
import type { Invoice, InvoiceStatus } from '../types';

const CLOSED_STATUSES: InvoiceStatus[] = ['Posted', 'Exported', 'Rejected'];
const OPEN_STATUSES: InvoiceStatus[] = ['Action Required', 'Extraction', 'Matching', 'ERP posting'];

export function QueueScreen() {
  const {
    invoices,
    sources,
    config,
    connections,
    openInvoice,
    runSamples,
    markExported,
  } = useStore();

  const [tab, setTab] = React.useState<'open' | 'closed'>('open');
  const [search, setSearch] = React.useState('');
  const [selection, setSelection] = React.useState<FilterValue>({});
  const [filterAnchor, setFilterAnchor] = React.useState<HTMLElement | null>(null);
  const [addAnchor, setAddAnchor] = React.useState<HTMLElement | null>(null);
  const [uploadOpen, setUploadOpen] = React.useState(false);

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
        options: (tab === 'open' ? OPEN_STATUSES : CLOSED_STATUSES).map((status) => ({
          value: status,
          label: <StatusChip status={status} />,
          searchText: status,
        })),
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
    [vendors, tab],
  );

  const activeCount = countActiveFilters(groups, selection);
  const isFiltered = activeCount > 0 || search.trim() !== '';

  const rows = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const closed = CLOSED_STATUSES.includes(invoice.status);
      if (tab === 'open' && closed) return false;
      if (tab === 'closed' && !closed) return false;

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
  }, [invoices, search, selection, tab]);

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
              {formatDate(row.invoiceDate)} · {ageInDays(row.ingestedAt)}d old
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

  /**
   * A bundle that arrived with no invoice among it is the one thing an invoice
   * row cannot lead you to, so it is surfaced here and only when it exists.
   * Everything else about a source belongs on the invoice that came from it.
   */
  const heldDocuments = React.useMemo(
    () => sources.flatMap((source) => source.heldDocuments),
    [sources],
  );

  const openCount = invoices.filter((i) => !CLOSED_STATUSES.includes(i.status)).length;
  const closedCount = invoices.length - openCount;
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
                {needsMe > 0
                  ? `${needsMe} of ${openCount} open ${openCount === 1 ? 'invoice needs' : 'invoices need'} you.`
                  : `${openCount} open, and nothing needs you.`}{' '}
                
              </Typography>
            </Stack>
          </Stack>
        </Box>

        <Box sx={{ px: 3 }}>
          <Tabs value={tab} onChange={(_, next) => setTab(next)} aria-label="Open or closed invoices">
            <Tab label="Open" value="open" count={openCount} />
            <Tab label="Closed" value="closed" count={closedCount} />
          </Tabs>
        </Box>

        {heldDocuments.length > 0 && (
          <Box sx={{ px: 3, pt: 1 }}>
            <Alert
              severity="warning"
              title={`${heldDocuments.length} document${heldDocuments.length === 1 ? '' : 's'} arrived without an invoice`}
            >
              {heldDocuments.join(', ')}. Nothing is waiting in the queue. A purchase order among them
              can be attached to a later invoice.
            </Alert>
          </Box>
        )}

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
              sx={{ whiteSpace: 'nowrap' }}
            >
              Clear filters
            </Button>
            <Button
              variant="secondary"
              appearance="outline"
              startIcon={<FadersHorizontalIcon />}
              onClick={(event) => setFilterAnchor(event.currentTarget)}
              sx={{ whiteSpace: 'nowrap' }}
            >
              Filter
              {activeCount > 0 && (
                <Chip size="sm" variant="primary" component="span" label={activeCount} />
              )}
            </Button>
          </Stack>
        </Stack>
        <Divider />

        {rows.length === 0 ? (
          <EmptyState
            icon={<FilesIcon size={40} />}
            title={
              isFiltered
                ? 'Nothing matches those filters'
                : tab === 'closed'
                  ? 'Nothing has closed yet'
                  : 'Nothing open'
            }
            description={
              isFiltered
                ? 'Clear the filters to see the rest of the queue.'
                : tab === 'closed'
                  ? 'Posted, exported and rejected invoices collect here.'
                  : 'Upload an invoice with its purchase order and receipt, or run a sample set to see how it works.'
            }
            action={
              isFiltered ? (
                <Button
                  variant="secondary"
                  appearance="outline"
                  onClick={() => {
                    setSelection({});
                    setSearch('');
                  }}
                >
                  Clear filters
                </Button>
              ) : tab === 'closed' ? (
                <Button variant="secondary" appearance="outline" onClick={() => setTab('open')}>
                  Go to the open queue
                </Button>
              ) : (
                <Stack direction="row" sx={{ gap: 1.5 }}>
                  <Button startIcon={<UploadSimpleIcon size={16} />} onClick={() => setUploadOpen(true)}>
                    Upload documents
                  </Button>
                  <Button variant="secondary" appearance="outline" onClick={runSamples}>
                    Run a sample
                  </Button>
                </Stack>
              )
            }
          />
        ) : (
          /* A definite height for the grid to be 100% of. */
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

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />

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
            setUploadOpen(true);
          }}
        >
          <UploadSimpleIcon size={16} />
          Upload invoice and documents
        </MenuItem>
        <MenuItem disabled>
          <EnvelopeSimpleIcon size={16} />
          {connections.mailboxProvider
            ? `Mailbox: reading ${connections.mailboxFolder}`
            : 'Mailbox: not connected'}
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
          Run a sample set
        </MenuItem>
      </Menu>
    </>
  );
}
