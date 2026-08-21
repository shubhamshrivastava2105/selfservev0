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
  CaretLeftIcon,
  CaretRightIcon,
  FilePdfIcon,
  ScissorsIcon,
  UploadSimpleIcon,
} from '@neofloai/atoms/icons';
import { VAT_CODES, WHT_CODES } from '../../data';
import { CodePicker, ColumnCodePicker } from '../../components/CodePicker';
import { Required } from '../../components/common';
import { useStore } from '../../store';
import { money } from '../../engine';
import { formatDateTime } from '../../clock';
import type { ErpPayload, Invoice } from '../../types';

/**
 * The payload as it will be written to the ERP: the header, the documents
 * travelling with it, and the lines.
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
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const lastRun = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (erp.simulated && erp.simulated.at !== lastRun.current) {
      lastRun.current = erp.simulated.at;
      setShowResult(true);
    }
  }, [erp.simulated]);

  const fixed = (label: string, value: string, required?: boolean) => (
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

  return (
    <>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <Stack sx={{ px: 3, pt: 3, pb: 2, gap: 3 }}>
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
            {fixed('Variance', money(erp.variance, invoice.currency))}
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

        <TableContainer
          sx={{
            borderTop: '1px solid',
            borderColor: 'divider',
            // The product's lines breathe; a tight row makes the borderless
            // pickers read as cramped text rather than as fields.
            '& tbody .MuiTableCell-root': { py: 1.25 },
            // Ruled columns, which is what stops a borderless picker reading as
            // loose text: the rule is the field's edge.
            '& thead .MuiTableCell-root:not(:last-of-type)': {
              borderRight: '1px solid',
              borderRightColor: 'divider',
            },
            '& .MuiTableCell-root:first-of-type, & .MuiTableCell-root:last-of-type': {
              borderLeft: '1px solid',
              borderLeftColor: 'divider',
            },
            '& .MuiTableCell-root:first-of-type': { borderLeft: 'none' },
          }}
        >
          <Table size="sm">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontFamily: 'mono', width: 56 }}>#</TableCell>
                <TableCell sx={{ fontFamily: 'mono', width: '31%' }}>Description</TableCell>
                <TableCell sx={{ fontFamily: 'mono', width: '23%' }}>Line Total</TableCell>
                <TableCell sx={{ fontFamily: 'mono', width: '23%' }}>
                  <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center' }}>
                    <Box component="span" sx={{ flex: 1 }}>
                      VAT Tax Code <Required />
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
                </TableCell>
                <TableCell sx={{ fontFamily: 'mono', width: '23%' }}>
                  <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center' }}>
                    <Box component="span" sx={{ flex: 1 }}>
                      WHT Tax Code <Required />
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
                </TableCell>
                <TableCell padding="checkbox" />
              </TableRow>
            </TableHead>
            <TableBody>
              {invoice.lines.map((l, index) => (
                <TableRow key={l.id}>
                  <TableCell sx={{ fontFamily: 'mono' }}>{index + 1}</TableCell>
                  <TableCell>{l.description}</TableCell>
                  <TableCell sx={{ fontFamily: 'mono' }}>
                    {money(l.invoiceLineTotal, invoice.currency)}
                  </TableCell>
                  <TableCell padding="none" sx={{ pr: 1 }}>
                    <CodePicker
                      label="VAT tax code"
                      rowLabel={l.description}
                      value={l.vat}
                      options={VAT_CODES}
                      disabled={readOnly}
                      onPick={(value) => setLineCode(invoice.id, l.id, 'vat', value)}
                      minWidth={160}
                    />
                  </TableCell>
                  <TableCell padding="none" sx={{ pr: 1 }}>
                    <CodePicker
                      label="WHT tax code"
                      rowLabel={l.description}
                      value={l.wht}
                      options={WHT_CODES}
                      disabled={readOnly}
                      onPick={(value) => setLineCode(invoice.id, l.id, 'wht', value)}
                      minWidth={140}
                    />
                  </TableCell>
                  <TableCell padding="checkbox">
                    <Tooltip title="Split this line">
                      <IconButton
                        variant="secondary"
                        appearance="text"
                        size="sm"
                        aria-label={`Split ${l.description}`}
                        disabled={readOnly}
                      >
                        <ScissorsIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* The footer the product carries under a line table. */}
        <Stack
          direction="row"
          sx={{
            px: 3,
            py: 1.5,
            gap: 3,
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'mono' }}>
            Total {invoice.lines.length} items
          </Typography>
          <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'mono' }}>
              Rows per page
            </Typography>
            <CodePicker
              label="Rows per page"
              rowLabel="this table"
              value={String(rowsPerPage)}
              options={['10', '25', '50']}
              onPick={(value) => setRowsPerPage(Number(value))}
              minWidth={72}
              fullWidth={false}
              bordered
            />
          </Stack>
          <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center' }}>
            <IconButton variant="secondary" appearance="text" size="sm" aria-label="Previous page" disabled>
              <CaretLeftIcon />
            </IconButton>
            <Typography variant="body2" sx={{ fontFamily: 'mono' }}>
              01
            </Typography>
            <IconButton variant="secondary" appearance="text" size="sm" aria-label="Next page" disabled>
              <CaretRightIcon />
            </IconButton>
          </Stack>
        </Stack>
      </Box>

      {/* What the ERP said to a dry run. */}
      <Dialog open={showResult} onClose={() => setShowResult(false)} fullWidth maxWidth="sm">
        <DialogTitle
          subtitle={erp.simulated ? formatDateTime(erp.simulated.at) : undefined}
          onClose={() => setShowResult(false)}
        >
          {erp.simulated?.ok ? 'Simulation passed' : 'Simulation failed'}
        </DialogTitle>
        <DialogContent>
          <Stack sx={{ gap: 2 }}>
            <Alert severity={erp.simulated?.ok ? 'success' : 'error'} floating>
              {erp.simulated?.message}
            </Alert>

            {erp.simulated && erp.simulated.lines.length > 0 && (
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
                      {erp.simulated.lines.map((l) => (
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
    </>
  );
}
