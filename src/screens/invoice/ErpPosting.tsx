import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  MenuItem,
  Select,
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
import { FilePdfIcon, ScissorsIcon, UploadSimpleIcon } from '@neofloai/atoms/icons';
import { VAT_CODES, WHT_CODES } from '../../data';
import { useStore } from '../../store';
import { money } from '../../engine';
import type { Invoice } from '../../types';

/**
 * The payload as it will be written to the ERP. Read-only where the value came
 * from matching, editable where a person supplies it.
 */
export function ErpPosting({ invoice }: { invoice: Invoice }) {
  const { setErpField, setLineCode, connections } = useStore();
  const erp = invoice.erp;

  const readOnly = ['Posted', 'Exported', 'Rejected'].includes(invoice.status);
  const missingTax = invoice.lines.filter((l) => l.vat === '' || l.wht === '').length;

  const fixed = (label: string, value: string) => (
    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
      <TextField label={label} value={value} disabled fullWidth />
    </Grid>
  );

  const editable = (label: string, key: keyof typeof erp, placeholder?: string) => (
    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
      <TextField
        label={label}
        placeholder={placeholder}
        value={String(erp[key] ?? '')}
        disabled={readOnly}
        onChange={(event) => setErpField(invoice.id, key, event.target.value)}
        fullWidth
      />
    </Grid>
  );

  return (
    <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <Stack sx={{ p: 3, gap: 3 }}>
        {erp.simulated && (
          <Stack sx={{ gap: 1.5 }}>
            <Alert
              severity={erp.simulated.ok ? 'success' : 'error'}
              title={erp.simulated.ok ? 'Simulation passed' : 'Simulation failed'}
            >
              {erp.simulated.message}
            </Alert>

            {/* The GL account is the ERP's answer, not the user's input, so it
                only exists once the payload has been dry-run. */}
            {erp.simulated.lines.length > 0 && (
              <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Table size="sm">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontFamily: 'mono', width: '100%' }}>
                        Line the ERP will post
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'mono' }}>GL Account</TableCell>
                      <TableCell sx={{ fontFamily: 'mono' }} align="right">
                        Tax
                      </TableCell>
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
            )}
          </Stack>
        )}

        {!connections.zohoBooks && (
          <Alert severity="info" title="No ERP connected">
            Download the matched data as a CSV instead. Posting needs a connected ERP.
          </Alert>
        )}

        <Grid container spacing={2.5}>
          {fixed('PO Number *', erp.poNumber || '—')}
          {fixed('Amount before VAT *', money(erp.amountBeforeVat, invoice.currency))}
          {fixed('Total amount after VAT *', money(erp.totalAfterVat, invoice.currency))}
          {fixed('Reference Number *', erp.referenceNumber)}

          {editable('Text *', 'text')}
          {editable('Ref Key (Head) 1', 'refKeyHead1', 'Enter Ref Key (head) 1')}
          {editable('Ref Key (Head) 2', 'refKeyHead2', 'Label Text')}
          {editable('Assignment', 'assignment', 'Label Text')}

          {editable('Doc Header', 'docHeader')}
          {editable('Ref Key 2', 'refKey2', 'Enter Ref Key 2')}
          {fixed('Variance', money(erp.variance, invoice.currency))}
        </Grid>

        {/* Documents travelling with the posting */}
        <Stack sx={{ gap: 1 }}>
          <Typography variant="body2" weight="medium">
            Documents ({1 + invoice.attachments.length})
          </Typography>
          <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              appearance="outline"
              size="sm"
              startIcon={<UploadSimpleIcon size={16} />}
              disabled={readOnly}
              sx={{ borderStyle: 'dashed' }}
            >
              Upload Files
            </Button>
            <Chip
              size="sm"
              variant="secondary"
              icon={<FilePdfIcon size={12} />}
              label={`${invoice.number.toLowerCase()}.pdf`}
            />
            {invoice.attachments.map((a) => (
              <Chip
                key={a.name}
                size="sm"
                variant="secondary"
                icon={<FilePdfIcon size={12} />}
                label={a.name}
              />
            ))}
          </Stack>
        </Stack>

        {missingTax > 0 && (
          <Alert severity="warning" title={`${missingTax} lines have no tax code`}>
            Every line needs a VAT and WHT code before the ERP will accept the payload.
          </Alert>
        )}

        {/* Line coding, as the posting stage presents it */}
        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Table size="sm">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontFamily: 'mono', width: 48 }}>#</TableCell>
                <TableCell sx={{ fontFamily: 'mono', width: '100%' }}>Description</TableCell>
                <TableCell sx={{ fontFamily: 'mono' }} align="right">
                  Line Total
                </TableCell>
                <TableCell sx={{ fontFamily: 'mono', minWidth: 180 }}>VAT Tax Code *</TableCell>
                <TableCell sx={{ fontFamily: 'mono', minWidth: 160 }}>WHT Tax Code *</TableCell>
                <TableCell padding="checkbox" />
              </TableRow>
            </TableHead>
            <TableBody>
              {invoice.lines.map((l, index) => (
                <TableRow key={l.id}>
                  <TableCell sx={{ fontFamily: 'mono' }}>{index + 1}</TableCell>
                  <TableCell>{l.description}</TableCell>
                  <TableCell align="right">{money(l.invoiceLineTotal, invoice.currency)}</TableCell>
                  <TableCell padding="none" sx={{ pr: 1 }}>
                    <Select
                      label="VAT"
                      value={l.vat}
                      disabled={readOnly}
                      onChange={(event) => setLineCode(invoice.id, l.id, 'vat', String(event.target.value))}
                      fullWidth
                    >
                      {VAT_CODES.map((code) => (
                        <MenuItem key={code} value={code}>
                          {code}
                        </MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell padding="none" sx={{ pr: 1 }}>
                    <Select
                      label="WHT"
                      value={l.wht}
                      disabled={readOnly}
                      onChange={(event) => setLineCode(invoice.id, l.id, 'wht', String(event.target.value))}
                      fullWidth
                    >
                      {WHT_CODES.map((code) => (
                        <MenuItem key={code} value={code}>
                          {code}
                        </MenuItem>
                      ))}
                    </Select>
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

        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'mono' }}>
          Total {invoice.lines.length} items
        </Typography>
      </Stack>
    </Box>
  );
}
