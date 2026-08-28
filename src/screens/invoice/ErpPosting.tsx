import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  DataGrid,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@neofloai/atoms';
import {
  CaretDownIcon,
  FilePdfIcon,
  ScissorsIcon,
  UploadSimpleIcon,
} from '@neofloai/atoms/icons';
import { fontFamilies } from '@neofloai/atoms/tokens';
import { VAT_CODES, WHT_CODES } from '../../data';
import { CodePicker, ColumnCodePicker } from '../../components/CodePicker';
import { Required } from '../../components/common';
import { useStore } from '../../store';
import { money } from '../../engine';
import { formatDateTime } from '../../clock';
import type { ErpPayload, Invoice, MatchLine } from '../../types';

/** Digits that line up down a column, and headers that read as a ledger's. */
const MONO = { fontFamily: fontFamilies.product.mono } as const;

/** Lines a page holds. Twelve lines is two pages, which is the point of one. */
const PAGE_SIZE = 10;

/** One row of the posting table: the line, plus its place in the document. */
type PostingRow = MatchLine & { index: number };

/**
 * A money cell: the currency mark in caption ink, the digits in mono, both
 * pushed right so the decimal points line up down the column. Lined-up
 * decimals are the only reason a reader can compare two figures without
 * reading either.
 */
function AmountCell({ value, currency }: { value: number; currency: string }) {
  const parts = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).formatToParts(value);
  const mark = parts.find((part) => part.type === 'currency')?.value ?? '';
  const digits = parts
    .filter((part) => part.type !== 'currency')
    .map((part) => part.value)
    .join('')
    .trim();

  return (
    <Box
      component="span"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '2px',
        width: '100%',
      }}
    >
      <Box component="span" sx={{ color: 'text.secondary' }}>
        {mark}
      </Box>
      <Box component="span" sx={MONO}>
        {digits}
      </Box>
    </Box>
  );
}

/**
 * The payload as it will be written to the ERP: the header, the documents
 * traveling with it, and the lines.
 *
 * Deliberately nothing else. A dry run reports back in a dialog rather than
 * stacking a second table above the form, and the screen keeps its shape once
 * the invoice is posted, disabled rather than replaced.
 */
export function ErpPosting({ invoice }: { invoice: Invoice }) {
  const { setErpField, setLineCode } = useStore();
  const erp = invoice.erp;
  const readOnly = ['Posted', 'Exported', 'Rejected'].includes(invoice.status);

  // Opens itself when a run comes back, and is dismissable.
  const [showResult, setShowResult] = React.useState(false);
  const lastRun = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (erp.simulated && erp.simulated.at !== lastRun.current) {
      lastRun.current = erp.simulated.at;
      setShowResult(true);
    }
  }, [erp.simulated]);

  const fixed = (label: string, value: string, required?: boolean, problem?: string) => (
    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
      <TextField
        label={
          <>
            {label}
            {required && <Required />}
          </>
        }
        value={value}
        disabled
        status={problem ? 'error' : undefined}
        helperText={problem}
        fullWidth
      />
    </Grid>
  );

  const editable = (
    label: string,
    key: keyof ErpPayload,
    placeholder?: string,
    required?: boolean,
  ) => (
    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
      <TextField
        label={
          <>
            {label}
            {required && <Required />}
          </>
        }
        placeholder={placeholder}
        value={String(erp[key] ?? '')}
        disabled={readOnly}
        onChange={(event) => setErpField(invoice.id, key, event.target.value)}
        fullWidth
      />
    </Grid>
  );

  const rows: PostingRow[] = React.useMemo(
    () => invoice.lines.map((l, index) => ({ ...l, index: index + 1 })),
    [invoice.lines],
  );

  const columns = React.useMemo<React.ComponentProps<typeof DataGrid>['columns']>(
    () => [
      {
        field: 'index',
        headerName: '#',
        width: 64,
        sortable: false,
        // The line's position rather than one of its fields. It exists so a
        // finding can say "line 3" and be followed.
        renderCell: ({ row }) => (
          <Box component="span" sx={{ ...MONO, color: 'text.secondary' }}>
            {(row as PostingRow).index}
          </Box>
        ),
      },
      { field: 'description', headerName: 'Description', flex: 1.6, minWidth: 180 },
      {
        field: 'invoiceLineTotal',
        headerName: 'Line Total',
        type: 'number',
        width: 150,
        align: 'right',
        headerAlign: 'right',
        renderCell: ({ row }) => (
          <AmountCell value={(row as PostingRow).invoiceLineTotal} currency={invoice.currency} />
        ),
      },
      {
        field: 'vat',
        headerName: 'VAT Tax Code',
        width: 210,
        sortable: false,
        // The caret sets the code on every line at once. It earns its place on
        // a twelve-line invoice, where most lines take the same code and
        // setting it row by row is twelve decisions made the same way.
        renderHeader: () => (
          <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center', minWidth: 0 }}>
            <Box component="span" sx={{ flex: 1 }}>
              VAT Tax Code
              <Required />
            </Box>
            <ColumnCodePicker
              heading="VAT tax code"
              options={VAT_CODES}
              disabled={readOnly}
              onPickAll={(value) =>
                invoice.lines.forEach((l) => setLineCode(invoice.id, l.id, 'vat', value))
              }
            />
          </Stack>
        ),
        renderCell: ({ row }) => (
          <CodePicker
            label="VAT tax code"
            rowLabel={(row as PostingRow).description}
            value={(row as PostingRow).vat}
            options={VAT_CODES}
            disabled={readOnly}
            onPick={(value) => setLineCode(invoice.id, (row as PostingRow).id, 'vat', value)}
            minWidth={160}
          />
        ),
      },
      {
        field: 'wht',
        headerName: 'WHT Tax Code',
        width: 190,
        sortable: false,
        renderHeader: () => (
          <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center', minWidth: 0 }}>
            <Box component="span" sx={{ flex: 1 }}>
              WHT Tax Code
              <Required />
            </Box>
            <ColumnCodePicker
              heading="WHT tax code"
              options={WHT_CODES}
              disabled={readOnly}
              onPickAll={(value) =>
                invoice.lines.forEach((l) => setLineCode(invoice.id, l.id, 'wht', value))
              }
            />
          </Stack>
        ),
        renderCell: ({ row }) => (
          <CodePicker
            label="WHT tax code"
            rowLabel={(row as PostingRow).description}
            value={(row as PostingRow).wht}
            options={WHT_CODES}
            disabled={readOnly}
            onPick={(value) => setLineCode(invoice.id, (row as PostingRow).id, 'wht', value)}
            minWidth={140}
          />
        ),
      },
      {
        // No header. The column holds one control and the control says what it
        // does; a heading over it would name the column after the control.
        field: 'actions',
        headerName: '',
        width: 72,
        sortable: false,
        align: 'center',
        renderCell: ({ row }) => (
          <Tooltip title="Split this line across two cost centres">
            <Box component="span" sx={{ display: 'inline-flex' }}>
              <IconButton
                variant="secondary"
                appearance="text"
                size="sm"
                aria-label={`Split ${(row as PostingRow).description}`}
                disabled={readOnly}
              >
                <ScissorsIcon />
              </IconButton>
            </Box>
          </Tooltip>
        ),
      },
    ],
    [invoice.currency, invoice.id, invoice.lines, readOnly, setLineCode],
  );

  const run = erp.simulated;

  return (
    <Stack sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
      <Box sx={{ flexShrink: 0, overflowY: 'auto', maxHeight: '58%' }}>
        <Stack sx={{ px: 3, pt: 3, pb: 2, gap: 2.5 }}>
          {/* What the dry run said, kept on the screen after the dialog is
              dismissed. Otherwise the only trace of a run is a button that
              quietly started answering. */}
          {run && (
            <Alert
              severity={run.ok ? 'success' : 'error'}
              floating
              action={
                <Button
                  variant="secondary"
                  appearance="text"
                  size="sm"
                  onClick={() => setShowResult(true)}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  Details
                </Button>
              }
            >
              {run.message} Simulated {formatDateTime(run.at)}.
            </Alert>
          )}

          <Grid container spacing={2.5}>
            {fixed('PO Number', erp.poNumber || '—', true)}
            {fixed('Amount before VAT', money(erp.amountBeforeVat, invoice.currency), true)}
            {fixed('Total amount after VAT', money(erp.totalAfterVat, invoice.currency), true)}
            {fixed('Reference Number', erp.referenceNumber, true)}

            {editable('Text', 'text', undefined, true)}
            {editable('Ref Key (Head) 1', 'refKeyHead1', 'Enter Ref Key (head) 1')}
            {editable('Ref Key (Head) 2', 'refKeyHead2', 'Label Text')}
            {editable('Assignment', 'assignment', 'Label Text')}

            {editable('Doc Header', 'docHeader')}
            {editable('Ref Key 2', 'refKey2', 'Enter Ref Key 2')}
            {/* Derived, so it is the one field with no entry in the payload.
                Zero is the only acceptable value, which makes it a check
                rather than a field. */}
            {fixed(
              'Variance',
              money(erp.variance, invoice.currency),
              false,
              erp.variance === 0 ? undefined : 'The lines do not add up to the order',
            )}
          </Grid>

          <Stack sx={{ gap: 1 }}>
            <Typography variant="body2">Documents ({1 + invoice.attachments.length})</Typography>
            <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* One dashed drop zone holding the button and its caret, as the
                  product draws it, rather than two separate controls. */}
              <Stack
                direction="row"
                sx={{
                  alignItems: 'center',
                  border: '1px dashed',
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 0.25,
                }}
              >
                <Button
                  variant="secondary"
                  appearance="text"
                  size="sm"
                  startIcon={<UploadSimpleIcon size={16} />}
                  disabled={readOnly}
                  sx={{ textTransform: 'none' }}
                >
                  Upload Files
                </Button>
                <Box sx={{ width: '1px', alignSelf: 'stretch', backgroundColor: 'divider', mx: 0.25 }} />
                <IconButton
                  variant="secondary"
                  appearance="text"
                  size="sm"
                  aria-label="Other ways to attach a document"
                  disabled={readOnly}
                >
                  <CaretDownIcon />
                </IconButton>
              </Stack>
              <Chip
                size="sm"
                variant="secondary"
                icon={<FilePdfIcon size={12} color="var(--mui-palette-error-main)" />}
                label={`${invoice.number.toLowerCase()}.pdf`}
              />
              {invoice.attachments.map((a) => (
                <Chip
                  key={a.name}
                  size="sm"
                  variant="secondary"
                  icon={<FilePdfIcon size={12} color="var(--mui-palette-error-main)" />}
                  label={a.name}
                />
              ))}
            </Stack>
          </Stack>
        </Stack>
      </Box>

      <Divider />

      {/* The grid fills what is left rather than growing with its rows, so the
          footer that counts them stays on screen. */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          '& .MuiDataGrid-columnHeaderTitle': MONO,
          // Ruled columns, which is what stops a borderless picker reading as
          // loose text: the rule is the field's edge.
          '& .MuiDataGrid-columnHeader:not(:last-of-type)': {
            borderRight: '1px solid',
            borderRightColor: 'divider',
          },
          '& .MuiDataGrid-cell:not(:last-of-type)': {
            borderRight: '1px solid',
            borderRightColor: 'divider',
          },
        }}
      >
        <DataGrid
          size="sm"
          rows={rows}
          columns={columns}
          rowNoun="line items"
          pagination
          initialState={{ pagination: { paginationModel: { pageSize: PAGE_SIZE } } }}
          // A line the ERP will refuse. The message above names it; this is
          // what makes it findable without counting.
          rowState={({ row }) =>
            (row as PostingRow).vat === '' || (row as PostingRow).wht === '' ? 'error' : undefined
          }
          disableColumnMenu
          disableRowSelectionOnClick
        />
      </Box>

      {/* What the ERP said to a dry run. */}
      <Dialog open={showResult} onClose={() => setShowResult(false)} fullWidth maxWidth="sm">
        <DialogTitle
          subtitle={run ? formatDateTime(run.at) : undefined}
          onClose={() => setShowResult(false)}
        >
          {run?.ok ? 'Simulation passed' : 'Simulation failed'}
        </DialogTitle>
        <DialogContent>
          <Stack sx={{ gap: 2 }}>
            <Alert severity={run?.ok ? 'success' : 'error'} floating>
              {run?.message}
            </Alert>

            {run && run.lines.length > 0 && (
              <Stack sx={{ gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  The GL account is derived from the purchase order, so these are the accounts the
                  posting will land in.
                </Typography>
                <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Table size="sm">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: '100%' }}>Line</TableCell>
                        <TableCell>GL Account</TableCell>
                        <TableCell align="right">Tax</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {run.lines.map((l) => (
                        <TableRow key={l.lineId}>
                          <TableCell>{l.description}</TableCell>
                          <TableCell>{l.gl}</TableCell>
                          <TableCell align="right">{money(l.taxAmount, invoice.currency)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button size="sm" onClick={() => setShowResult(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
