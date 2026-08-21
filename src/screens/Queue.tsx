import * as React from 'react';
import {
  Box,
  Button,
  Chip,
  DataGrid,
  Divider,
  IconButton,
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
  ArrowSquareOutIcon,
  CaretDownIcon,
  DownloadSimpleIcon,
  EnvelopeSimpleIcon,
  FadersHorizontalIcon,
  FilesIcon,
  MagnifyingGlassIcon,
  PaperclipIcon,
  SparkleIcon,
  UploadSimpleIcon,
  WarningIcon,
} from '@neofloai/atoms/icons';
import type { FilterGroup, FilterValue } from '@neofloai/atoms';
import { Filter } from '@neofloai/atoms';
import { useStore } from '../store';
import { EmptyState, StatusChip } from '../components/common';
import { ShellBar } from '../components/shell';
import { UploadDialog } from '../components/UploadDialog';
import { buildCsv, downloadCsv, money, unacknowledgedFields } from '../engine';
import { formatDate, formatTime } from '../clock';
import type { Invoice, InvoiceStatus } from '../types';

const CLOSED_STATUSES: InvoiceStatus[] = ['Posted', 'Exported', 'Rejected'];
const OPEN_STATUSES: InvoiceStatus[] = ['Action Required', 'Extraction', 'Matching', 'ERP posting'];

export function QueueScreen() {
  const {
    invoices,
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
  const [picked, setPicked] = React.useState<FileList | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

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

  /** The dashboard's columns, as the product lays them out. */
  const columns = React.useMemo(
    () => [
      {
        field: 'sourceId',
        headerName: 'Source ID/ Time',
        width: 190,
        renderCell: ({ row }: { row: Invoice }) => (
          <Stack direction="row" sx={{ gap: 1, alignItems: 'flex-start', minWidth: 0 }}>
            <Box sx={{ display: 'flex', color: 'text.secondary', mt: 0.25 }}>
              {row.source === 'Mailbox' ? (
                <EnvelopeSimpleIcon size={14} />
              ) : row.source === 'Sample' ? (
                <SparkleIcon size={14} />
              ) : (
                <UploadSimpleIcon size={14} />
              )}
            </Box>
            <Stack sx={{ gap: 0, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontFamily: 'mono' }} color="primary.main" noWrap>
                #{row.number.replace(/\D/g, '').slice(-4)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'mono' }} noWrap>
                {formatDate(row.ingestedAt)} | {formatTime(row.ingestedAt)}
              </Typography>
            </Stack>
          </Stack>
        ),
      },
      {
        field: 'vendor',
        headerName: 'Vendor / Invoice#',
        flex: 1,
        minWidth: 190,
        renderCell: ({ row }: { row: Invoice }) => (
          <Stack sx={{ gap: 0, minWidth: 0 }}>
            <Typography variant="body2" weight="medium" noWrap>
              {row.vendor}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {row.number}
            </Typography>
          </Stack>
        ),
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 160,
        renderCell: ({ row }: { row: Invoice }) => {
          const pending = unacknowledgedFields(row, config.confidenceThreshold).length;
          return (
            <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center' }}>
              <StatusChip status={row.status} />
              {pending > 0 && (
                <Tooltip title={`${pending} fields below the ${config.confidenceThreshold}% threshold`}>
                  <Chip size="sm" variant="warning" icon={<WarningIcon size={12} />} label={pending} />
                </Tooltip>
              )}
              {row.stpPosted && (
                <Tooltip title="Posted by straight-through processing">
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
        field: 'attachment',
        headerName: 'Invoice attachment',
        width: 210,
        sortable: false,
        renderCell: ({ row }: { row: Invoice }) => (
          <Stack direction="row" sx={{ gap: 0.75, alignItems: 'center', minWidth: 0 }}>
            <Box sx={{ display: 'flex', color: 'text.secondary' }}>
              <PaperclipIcon size={14} />
            </Box>
            <Typography variant="body2" color="text.secondary" noWrap>
              {row.vendor.split(' ')[0]}_{row.number}.pdf
            </Typography>
          </Stack>
        ),
      },
      {
        field: 'amount',
        headerName: 'Amount',
        type: 'number' as const,
        width: 130,
        renderCell: ({ row }: { row: Invoice }) => (
          <Typography variant="body2" sx={{ fontFamily: 'mono' }}>
            {money(row.amount, row.currency)}
          </Typography>
        ),
      },
      {
        field: 'action',
        headerName: 'Action',
        width: 130,
        sortable: false,
        renderCell: ({ row }: { row: Invoice }) => {
          const closed = CLOSED_STATUSES.includes(row.status);
          return (
            <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center' }}>
              <Button
                variant={closed ? 'secondary' : 'primary'}
                appearance="outline"
                size="sm"
                onClick={() => openInvoice(row.id)}
              >
                {closed ? 'View' : 'Review'}
              </Button>
              <Tooltip title="Open the source">
                <IconButton
                  variant="secondary"
                  appearance="text"
                  size="sm"
                  aria-label={`Open the source of ${row.number}`}
                >
                  <ArrowSquareOutIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          );
        },
      },
    ],
    [config.confidenceThreshold, openInvoice],
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
        {/* A real picker, opened by the click itself so the browser allows it. */}
        <Box
          component="input"
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.zip"
          ref={fileInputRef}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            if (event.target.files && event.target.files.length > 0) {
              setPicked(event.target.files);
              setUploadOpen(true);
            }
          }}
          sx={{ display: 'none' }}
        />
        <Button
          size="sm"
          startIcon={<UploadSimpleIcon size={16} />}
          onClick={() => fileInputRef.current?.click()}
        >
          Upload Invoice
        </Button>
        <Tooltip title="Other ways in">
          <IconButton
            variant="secondary"
            appearance="outline"
            size="sm"
            aria-label="Other ways to add invoices"
            onClick={(event) => setAddAnchor(event.currentTarget)}
          >
            <CaretDownIcon />
          </IconButton>
        </Tooltip>
      </ShellBar>

      <Stack sx={{ flex: 1, minHeight: 0 }}>
        <Box sx={{ px: 3, pt: 3, pb: 2 }}>
          <Stack direction="row" sx={{ gap: 2, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Stack sx={{ flex: 1, gap: 0.25, minWidth: 240 }}>
              <Typography variant="h3" component="h1">
                Invoice Dashboard
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

      <UploadDialog
        open={uploadOpen}
        initialFiles={picked}
        onClose={() => {
          setUploadOpen(false);
          setPicked(null);
          // Let the same file be chosen again next time.
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
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
