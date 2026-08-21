import * as React from 'react';
import {
  Box,
  Checkbox,
  Chip,
  IconButton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@neofloai/atoms';
import {
  CheckCircleIcon,
  FadersHorizontalIcon,
  MagnifyingGlassIcon,
  WarningCircleIcon,
  XCircleIcon,
} from '@neofloai/atoms/icons';
import { money, num } from '../../engine';
import { useStore } from '../../store';
import type { Invoice, LineMatchState } from '../../types';

/* ── Invoice details: the field-by-field comparison ───────────────────── */

export function InvoiceDetailsTable({ invoice }: { invoice: Invoice }) {
  return (
    <TableContainer>
      <Table size="md">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 240 }}>Field</TableCell>
            <TableCell sx={{ width: '40%' }}>Invoice</TableCell>
            <TableCell>PO</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {invoice.invoiceFields.map((f) => {
            const poValue = f.poValue ?? f.value;
            const differs = poValue !== f.value;
            return (
              <TableRow key={f.key} state={differs ? 'error' : undefined}>
                <TableCell>
                  <Typography variant="body2">
                    {f.label}
                    {f.mandatory && (
                      <Box component="span" sx={{ color: 'error.main', ml: 0.5 }}>
                        *
                      </Box>
                    )}
                  </Typography>
                </TableCell>
                <TableCell>{f.value}</TableCell>
                <TableCell>
                  <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
                    <Typography variant="body2" color={differs ? 'error.main' : undefined}>
                      {poValue}
                    </Typography>
                    {differs && <Chip size="sm" variant="error" label="differs" />}
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/* ── Line item: invoice beside the receipts ───────────────────────────── */

/** The dot at the head of a line: where that line landed. */
function StateDot({ state }: { state: LineMatchState }) {
  if (state === 'matched') {
    return (
      <Box sx={{ display: 'flex', color: 'success.main' }} aria-label="Matched">
        <CheckCircleIcon size={18} />
      </Box>
    );
  }
  if (state === 'warning') {
    return (
      <Box sx={{ display: 'flex', color: 'warning.main' }} aria-label="Within tolerance">
        <WarningCircleIcon size={18} />
      </Box>
    );
  }
  if (state === 'failed') {
    return (
      <Box sx={{ display: 'flex', color: 'error.main' }} aria-label="Beyond tolerance">
        <XCircleIcon size={18} />
      </Box>
    );
  }
  return <Box sx={{ width: 18 }} aria-hidden />;
}

function PanelHeader({ title, filterable }: { title: string; filterable?: boolean }) {
  return (
    <Stack
      direction="row"
      sx={{
        px: 2,
        py: 1.5,
        gap: 1,
        alignItems: 'center',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography variant="body2" weight="medium" sx={{ flex: 1, letterSpacing: '0.04em' }}>
        {title}
      </Typography>
      <IconButton variant="secondary" appearance="text" size="sm" aria-label={`Search ${title}`}>
        <MagnifyingGlassIcon />
      </IconButton>
      {filterable && (
        <IconButton variant="secondary" appearance="text" size="sm" aria-label={`Filter ${title}`}>
          <FadersHorizontalIcon />
        </IconButton>
      )}
    </Stack>
  );
}

export function LineItemComparison({ invoice }: { invoice: Invoice }) {
  const { config } = useStore();
  const [selected, setSelected] = React.useState<string[]>(
    invoice.lines.filter((l) => l.state === 'matched').map((l) => l.id),
  );

  const toggle = (id: string) =>
    setSelected((previous) =>
      previous.includes(id) ? previous.filter((x) => x !== id) : [...previous, id],
    );

  const invoiceQty = invoice.lines.reduce((s, l) => s + l.invoiceQty, 0);
  const invoiceTotal = invoice.lines.reduce((s, l) => s + l.invoiceLineTotal, 0);
  const grnQty = invoice.grnLines.reduce((s, l) => s + l.qty, 0);
  const grnTotal = invoice.grnLines.reduce((s, l) => s + l.lineTotal, 0);
  const variance = Number((invoiceTotal - grnTotal).toFixed(2));
  const balanced = Math.abs(variance) <= config.totalToleranceAbsolute;

  return (
    <Stack sx={{ flex: 1, minHeight: 0 }}>
      <Stack direction="row" sx={{ flex: 1, minHeight: 0 }}>
        {/* Invoice side */}
        <Stack sx={{ flex: 1, minWidth: 0, borderRight: '1px solid', borderColor: 'divider' }}>
          <PanelHeader title="INVOICE" />
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <Table size="sm">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell padding="checkbox" />
                  <TableCell>Item No.</TableCell>
                  <TableCell sx={{ width: '100%' }}>Description</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Unit Price</TableCell>
                  <TableCell align="right">Line Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoice.lines.map((l) => (
                  <TableRow key={l.id} state={l.state === 'failed' ? 'error' : undefined}>
                    <TableCell padding="checkbox">
                      <StateDot state={l.state} />
                    </TableCell>
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="sm"
                        checked={selected.includes(l.id)}
                        onChange={() => toggle(l.id)}
                        aria-label={`Select ${l.itemNo}`}
                      />
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'mono' }}>{l.itemNo}</TableCell>
                    <TableCell>{l.description}</TableCell>
                    <TableCell align="right">{num(l.invoiceQty)}</TableCell>
                    <TableCell align="right">{num(l.invoiceUnitPrice)}</TableCell>
                    <TableCell align="right">{num(l.invoiceLineTotal)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell padding="checkbox" colSpan={3} />
                  <TableCell>
                    <Typography variant="body2" weight="medium">
                      Invoice Total
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" weight="medium">
                      {num(invoiceQty)}
                    </Typography>
                  </TableCell>
                  <TableCell />
                  <TableCell align="right">
                    <Typography variant="body2" weight="medium">
                      {money(invoiceTotal, invoice.currency)}
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Box>
        </Stack>

        {/* Receipt side */}
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <PanelHeader title="GRN" filterable />
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {invoice.grnLines.length === 0 ? (
              <Stack sx={{ p: 3, gap: 0.5 }}>
                <Typography variant="body2" weight="medium">
                  No goods receipt
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Nothing has been received against this purchase order yet.
                </Typography>
              </Stack>
            ) : (
              <Table size="sm">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell padding="checkbox" />
                    <TableCell sx={{ minWidth: 150 }}>PO / GRN</TableCell>
                    <TableCell sx={{ width: '100%' }}>Description</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Unit Price</TableCell>
                    <TableCell align="right">Line Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoice.grnLines.map((g) => (
                    <TableRow key={g.id} state={g.matchedTo ? 'success' : undefined}>
                      <TableCell padding="checkbox">
                        <StateDot state={g.matchedTo ? 'matched' : 'unchecked'} />
                      </TableCell>
                      <TableCell padding="checkbox">
                        <Checkbox size="sm" checked={Boolean(g.matchedTo)} readOnly aria-label={g.grnNo} />
                      </TableCell>
                      {/* One reference, two numbers: the order it came from and
                          the receipt that recorded it. */}
                      <TableCell>
                        <Stack sx={{ gap: 0.25, minWidth: 0 }}>
                          <Chip size="sm" variant="secondary" label={g.poNo} />
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'mono' }}>
                            {g.grnNo}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{g.description}</TableCell>
                      <TableCell align="right">{num(g.qty)}</TableCell>
                      <TableCell align="right">{num(g.unitPrice)}</TableCell>
                      <TableCell align="right">{num(g.lineTotal)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell padding="checkbox" colSpan={3} />
                    <TableCell>
                      <Typography variant="body2" weight="medium">
                        GRN Total
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" weight="medium">
                        {num(grnQty)}
                      </Typography>
                    </TableCell>
                    <TableCell />
                    <TableCell align="right">
                      <Typography variant="body2" weight="medium">
                        {money(grnTotal, invoice.currency)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </Box>
        </Stack>
      </Stack>

      {/* The verdict, always in view */}
      <Stack
        direction="row"
        sx={{
          px: 3,
          py: 2,
          gap: 4,
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          borderTop: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Stack sx={{ gap: 0.25, alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.06em' }}>
            INVOICE
          </Typography>
          <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: balanced ? 'success.main' : 'error.main',
              }}
              aria-hidden
            />
            <Typography variant="h5">{money(invoiceTotal, invoice.currency)}</Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {invoice.lines.length} Lines · {num(invoiceQty)} Qty
          </Typography>
        </Stack>

        <Stack sx={{ gap: 0.5, alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            ↔
          </Typography>
          <Chip
            size="sm"
            variant="secondary"
            label={`Tolerance: ± ${money(config.totalToleranceAbsolute, invoice.currency)}`}
          />
        </Stack>

        <Stack sx={{ gap: 0.25, alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.06em' }}>
            GRN
          </Typography>
          <Typography variant="h5">{money(grnTotal, invoice.currency)}</Typography>
          <Typography variant="caption" color="text.secondary">
            {invoice.grnLines.length} Lines · {num(grnQty)} Qty
          </Typography>
        </Stack>

        <Stack
          sx={{
            gap: 0.25,
            px: 2.5,
            py: 1.5,
            borderRadius: 1,
            border: '1px solid',
            borderColor: balanced ? 'success.main' : 'error.main',
            backgroundColor: balanced ? 'success.subtle' : 'error.subtle',
            minWidth: 200,
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.06em' }}>
            VARIANCE
          </Typography>
          <Typography variant="h6" color={balanced ? 'success.main' : 'error.main'}>
            {balanced ? 'Balanced' : money(Math.abs(variance), invoice.currency)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {balanced ? 'Invoice = GRN' : variance > 0 ? 'Invoice exceeds GRN' : 'GRN exceeds invoice'}
          </Typography>
        </Stack>
      </Stack>
    </Stack>
  );
}

/** The matching stage: the two views the product offers. */
export function MatchingViews({ invoice }: { invoice: Invoice }) {
  const [tab, setTab] = React.useState<'details' | 'lines'>('details');
  const differing = invoice.invoiceFields.filter(
    (f) => (f.poValue ?? f.value) !== f.value,
  ).length;

  return (
    <Stack sx={{ flex: 1, minHeight: 0 }}>
      <Box sx={{ px: 3, pt: 1 }}>
        <Tabs value={tab} onChange={(_, next) => setTab(next)} aria-label="Matching views">
          <Tab label="Invoice details" value="details" count={differing || undefined} />
          <Tab label="Line items" value="lines" count={invoice.lines.length} />
        </Tabs>
      </Box>
      {tab === 'details' ? (
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <InvoiceDetailsTable invoice={invoice} />
        </Box>
      ) : (
        <LineItemComparison invoice={invoice} />
      )}
    </Stack>
  );
}
