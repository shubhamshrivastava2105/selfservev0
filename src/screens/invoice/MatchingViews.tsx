import * as React from 'react';
import {
  Box,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
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
  TextField,
  Tooltip,
  Typography,
} from '@neofloai/atoms';
import {
  ArrowsLeftRightIcon,
  CheckCircleIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  QuestionIcon,
  XCircleIcon,
} from '@neofloai/atoms/icons';
import { fontFamilies } from '@neofloai/atoms/tokens';
import { money, num } from '../../engine';
import { useStore } from '../../store';
import type { GrnLine, Invoice, MatchLine } from '../../types';

/* ── The ink ──────────────────────────────────────────────────────────── */

/** Digits that line up down a column. */
const MONO = { fontFamily: fontFamilies.product.mono } as const;

/**
 * Both tables are laid out fixed. A table cell does not wrap by default, so
 * under automatic layout the description column claims its full text width and
 * pushes the money columns off the panel. Widths go on the header cells,
 * because fixed layout reads the first row only.
 */
const TABLE_LAYOUT = { tableLayout: 'fixed' } as const;

const INVOICE_COLS = { mark: 44, itemNo: 84, description: 160, qty: 60 };
const GRN_COLS = { mark: 44, poNo: 122, grnNo: 84, description: 140, qty: 56 };
const DETAILS_COLS = { field: 260, invoice: 340 };

/** The description column is the one column here that is prose, so it wraps. */
const WRAP = { whiteSpace: 'normal' } as const;
const TRUNCATE = { overflow: 'hidden', textOverflow: 'ellipsis' } as const;

/**
 * The header strip and the first column of the details table share one
 * treatment, which is what makes that column read as a list of row names
 * rather than as a third value.
 */
const LABEL_CELL = { backgroundColor: 'background.default', color: 'text.secondary' } as const;

/** The mark on a field extraction must have captured. */
function Required() {
  return (
    <Box component="span" sx={{ color: 'error.main' }}>
      {' *'}
    </Box>
  );
}

/** A reference: present, and quieter than the prose beside it. */
function Reference({ children }: { children: React.ReactNode }) {
  return (
    <Box component="span" sx={{ ...MONO, color: 'text.secondary' }}>
      {children}
    </Box>
  );
}

/** An amount, pushed right so the decimal points line up. */
function Amount({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%', ...MONO }}>
      {children}
    </Box>
  );
}

/** An amount in a column whose header already carries the currency mark. */
function amount(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ── What a line came out as ──────────────────────────────────────────── */

/**
 * How a line stands against the receipts booked under it.
 *
 * Derived on every render rather than stored: a status held in state is one
 * that can disagree with the numbers printed under it.
 *
 * `probable` is the value that earns the screen. The receipts found are
 * plausibly right — same item, same order — but they do not add up to the
 * line. A binary matched/unmatched puts that case in one bucket or the other
 * and loses the only thing worth showing.
 */
type LineStatus = 'matched' | 'probable' | 'no-match';

const STATUS_MARKS: Record<
  LineStatus,
  { icon: React.ReactNode; tone: string; label: string; help: string; row?: 'error' | 'success' }
> = {
  matched: {
    icon: <CheckCircleIcon weight="fill" size={16} />,
    tone: 'success.main',
    label: 'Matched',
    help: 'Quantity and amount both agree with the receipts booked against this line',
    row: 'success',
  },
  probable: {
    icon: <QuestionIcon weight="fill" size={16} />,
    tone: 'warning.main',
    label: 'Probable',
    // No row tint. The row component models error and success and nothing
    // between, so a third state here would be a colour invented at a call
    // site — the glyph and the group's own subtotal carry it instead.
    help: 'Receipts were found for this line, but they do not add up to it',
  },
  'no-match': {
    icon: <XCircleIcon weight="fill" size={16} />,
    tone: 'error.main',
    label: 'No match',
    help: 'No goods receipt has been booked against this line',
    row: 'error',
  },
};

function StatusMark({ status }: { status: LineStatus }) {
  const mark = STATUS_MARKS[status];
  return (
    <Tooltip title={mark.help}>
      <Box component="span" aria-label={mark.label} sx={{ display: 'inline-flex', color: mark.tone }}>
        {mark.icon}
      </Box>
    </Tooltip>
  );
}

const sumQty = (rows: GrnLine[]) => rows.reduce((total, r) => total + r.qty, 0);
const sumTotal = (rows: GrnLine[]) =>
  Number(rows.reduce((total, r) => total + r.lineTotal, 0).toFixed(2));

/**
 * How the receipts differ from the line they satisfy, in both dimensions.
 *
 * Reported separately rather than rolled into one number because they fail
 * independently and mean different things: the right quantity at the wrong
 * price is a pricing dispute, the right price at the wrong quantity is a short
 * delivery.
 */
function varianceFor(line: MatchLine, rows: GrnLine[]) {
  return {
    quantity: sumQty(rows) - line.invoiceQty,
    amount: Number((sumTotal(rows) - line.invoiceLineTotal).toFixed(2)),
  };
}

/**
 * How far apart the two documents may end up and still count as agreeing here.
 * A rounding difference is not a dispute; anything larger is worth reading,
 * even when it is inside the tolerance that decides whether matching blocks.
 * The two thresholds answer different questions and are deliberately not one.
 */
const ROUNDING = 0.01;

function balancedAgainst(line: MatchLine, rows: GrnLine[]): boolean {
  const gap = varianceFor(line, rows);
  return gap.quantity === 0 && Math.abs(gap.amount) <= ROUNDING;
}

function statusFor(line: MatchLine, rows: GrnLine[]): LineStatus {
  if (rows.length === 0) return 'no-match';
  return balancedAgainst(line, rows) ? 'matched' : 'probable';
}

/** The mark on the column header, so the amounts under it carry none. */
function currencySymbol(currency: string): string {
  const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency }).formatToParts(0);
  return parts.find((part) => part.type === 'currency')?.value ?? currency;
}

/** One or many, so a panel footer does not read "1 deliveries". */
function plural(count: number, one: string, many: string): string {
  return `${num(count)} ${count === 1 ? one : many}`;
}

/**
 * The two gaps, worded to fit under the figure each is about. Short means the
 * receipts came to less than the line was billed at; over means more.
 */
function quantityGap(value: number): string {
  if (value === 0) return '';
  return `${num(Math.abs(value))} ${value > 0 ? 'over' : 'short'}`;
}

function amountGap(value: number, currency: string): string {
  if (value === 0) return '';
  return `${money(Math.abs(value), currency)} ${value > 0 ? 'over' : 'short'}`;
}

/* ── Invoice details: the field-by-field comparison ───────────────────── */

/**
 * One field across the documents that carry it.
 *
 * `null` means this document does not carry the field at all, which is a
 * different fact from carrying it and disagreeing — a goods receipt has no
 * vendor tax ID, and printing a blank there would read as a mismatch.
 */
interface CompareRow {
  key: string;
  label: string;
  mandatory: boolean;
  invoice: string | null;
  po: string | null;
  grn: string | null;
}

const grnValue = (invoice: Invoice, key: string) =>
  invoice.grnFields.find((f) => f.key === key)?.value ?? null;

/**
 * The rows of the comparison, and which documents are in it.
 *
 * A goods receipt is a third document, not a second opinion on the purchase
 * order: it is what actually arrived, so once one exists the quantities and
 * the receipt's own references are read from it rather than from the order.
 * The header fields it carries are few — its number, the order it cites and
 * the date it was booked — and the rest of what it settles is per line, which
 * is the other tab.
 */
export function comparisonRows(invoice: Invoice): CompareRow[] {
  const rows: CompareRow[] = invoice.invoiceFields.map((f) => ({
    key: f.key,
    label: f.label,
    mandatory: f.mandatory,
    invoice: f.value,
    po: f.poValue ?? f.value,
    // The one header field all three documents name.
    grn: f.key === 'po' ? grnValue(invoice, 'grnPoRef') : null,
  }));

  // The receipt's own fields, which neither of the other two carries.
  const grnNumber = grnValue(invoice, 'grnNumber');
  if (grnNumber !== null) {
    rows.push({
      key: 'grnNumber',
      label: 'GRN Number',
      mandatory: false,
      invoice: null,
      po: null,
      grn: grnNumber,
    });
  }
  const receiptDate = grnValue(invoice, 'grnDate');
  if (receiptDate !== null) {
    rows.push({
      key: 'grnDate',
      label: 'Receipt Date',
      mandatory: false,
      invoice: null,
      po: null,
      grn: receiptDate,
    });
  }
  return rows;
}

/** Whether the documents that carry this field disagree about it. */
export function rowDiffers(row: CompareRow): boolean {
  const stated = [row.invoice, row.po, row.grn].filter((v): v is string => v !== null);
  return new Set(stated).size > 1;
}

/** A document that does not carry the field, said as absence rather than blank. */
function NotCarried() {
  return (
    <Box component="span" sx={{ color: 'text.disabled' }} aria-label="Not on this document">
      —
    </Box>
  );
}

export function InvoiceDetailsTable({ invoice }: { invoice: Invoice }) {
  const rows = comparisonRows(invoice);
  // A receipt earns a column once there is one. Before that the comparison is
  // two documents and a third empty column would be a promise, not a fact.
  const hasGrn = invoice.grnSource !== 'none' && invoice.grnFields.length > 0;

  return (
    <TableContainer sx={{ height: '100%', overflow: 'auto' }}>
      <Table size="md" sx={{ minWidth: hasGrn ? 900 : 720 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...LABEL_CELL, width: DETAILS_COLS.field }}>Field</TableCell>
            <TableCell sx={{ ...LABEL_CELL, width: DETAILS_COLS.invoice }}>Invoice</TableCell>
            <TableCell sx={LABEL_CELL}>PO</TableCell>
            {hasGrn && <TableCell sx={LABEL_CELL}>GRN</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const differs = rowDiffers(row);
            return (
              // A fill means the row wants something. Twelve green rows would
              // make the one that disagrees harder to find, not easier.
              <TableRow key={row.key} state={differs ? 'error' : undefined}>
                {/* The name of the row rather than one of its values. */}
                <TableCell component="th" scope="row" sx={LABEL_CELL}>
                  {row.label}
                  {row.mandatory && <Required />}
                </TableCell>
                <TableCell sx={TRUNCATE}>
                  {row.invoice ?? <NotCarried />}
                </TableCell>
                <TableCell>
                  <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', minWidth: 0 }}>
                    <Box component="span" sx={TRUNCATE}>
                      {row.po ?? <NotCarried />}
                    </Box>
                    {differs && !hasGrn && <Chip size="sm" variant="error" label="differs" />}
                  </Stack>
                </TableCell>
                {hasGrn && (
                  <TableCell>
                    <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', minWidth: 0 }}>
                      <Box component="span" sx={TRUNCATE}>
                        {row.grn ?? <NotCarried />}
                      </Box>
                      {differs && <Chip size="sm" variant="error" label="differs" />}
                    </Stack>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/* ── Line item: the invoice beside the receipts ───────────────────────── */

function matchesQuery(haystack: string[], query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  return haystack.some((value) => value.toLowerCase().includes(needle));
}

/**
 * A panel's title strip. The search field replaces the icon that opened it
 * rather than appearing beside it, so the strip does not grow a row when you
 * start typing.
 */
function PanelHeader({
  title,
  query,
  onQueryChange,
  searchLabel,
  children,
}: {
  title: string;
  query: string;
  onQueryChange: (value: string) => void;
  searchLabel: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Stack
      direction="row"
      sx={{ alignItems: 'center', gap: 1, px: 2, py: 1.5, minHeight: 56, flexShrink: 0 }}
    >
      {open ? (
        <TextField
          autoFocus
          fullWidth
          value={query}
          placeholder={searchLabel}
          aria-label={searchLabel}
          onChange={(event) => onQueryChange(event.target.value)}
          onBlur={() => {
            if (query === '') setOpen(false);
          }}
        />
      ) : (
        <>
          <Typography variant="body1" weight="medium">
            {title}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <IconButton
            variant="secondary"
            appearance="text"
            size="sm"
            aria-label={searchLabel}
            onClick={() => setOpen(true)}
          >
            <MagnifyingGlassIcon />
          </IconButton>
          {children}
        </>
      )}
    </Stack>
  );
}

/** One invoice line: what it came out as, and what it is for. */
function InvoiceRow({
  line,
  status,
  selected,
  onSelect,
}: {
  line: MatchLine;
  status: LineStatus;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <TableRow
      hover
      selected={selected}
      state={STATUS_MARKS[status].row}
      onClick={onSelect}
      sx={{ cursor: 'pointer' }}
    >
      <TableCell sx={{ width: INVOICE_COLS.mark }} align="right">
        <StatusMark status={status} />
      </TableCell>
      <TableCell sx={{ width: INVOICE_COLS.itemNo }}>
        <Reference>{line.itemNo}</Reference>
      </TableCell>
      <TableCell sx={{ width: INVOICE_COLS.description, ...WRAP }}>{line.description}</TableCell>
      <TableCell sx={{ width: INVOICE_COLS.qty }}>
        <Box component="span" sx={MONO}>
          {num(line.invoiceQty)}
        </Box>
      </TableCell>
      <TableCell align="right">
        <Amount>{amount(line.invoiceUnitPrice)}</Amount>
      </TableCell>
      <TableCell align="right">
        <Amount>{amount(line.invoiceLineTotal)}</Amount>
      </TableCell>
    </TableRow>
  );
}

/** One goods receipt, and the invoice line it was booked against. */
function ReceiptRow({ receipt, selected }: { receipt: GrnLine; selected: boolean }) {
  return (
    <TableRow selected={selected}>
      <TableCell sx={{ width: GRN_COLS.mark }} align="right">
        <Tooltip title="Booked against this invoice line by matching">
          <Box component="span" sx={{ display: 'inline-flex' }}>
            <Checkbox
              size="sm"
              checked
              readOnly
              aria-label={`${receipt.grnNo} is allocated`}
            />
          </Box>
        </Tooltip>
      </TableCell>
      {/* The one value on the row that names another document rather than
          describing this one. */}
      <TableCell sx={{ width: GRN_COLS.poNo }}>
        <Chip size="sm" variant="secondary" label={receipt.poNo} />
      </TableCell>
      <TableCell sx={{ width: GRN_COLS.grnNo }}>
        <Reference>{receipt.grnNo}</Reference>
      </TableCell>
      <TableCell sx={{ width: GRN_COLS.description, ...WRAP }}>{receipt.description}</TableCell>
      <TableCell sx={{ width: GRN_COLS.qty }}>
        <Box component="span" sx={MONO}>
          {num(receipt.qty)}
        </Box>
      </TableCell>
      <TableCell align="right">
        <Amount>{amount(receipt.unitPrice)}</Amount>
      </TableCell>
      <TableCell align="right">
        <Amount>{amount(receipt.lineTotal)}</Amount>
      </TableCell>
    </TableRow>
  );
}

/**
 * The row that closes a group: what the receipts add up to, and how far that
 * is from the invoice line they were booked against. Each gap sits under the
 * figure it is about — the quantity delta under the quantity, the money delta
 * under the money.
 */
function GroupTotalRow({
  line,
  rows,
  currency,
  tolerance,
}: {
  line: MatchLine;
  rows: GrnLine[];
  currency: string;
  tolerance: number;
}) {
  const gap = varianceFor(line, rows);
  const balanced = balancedAgainst(line, rows);
  // Only a gap beyond the line tolerance is one matching would fail on, and
  // only that earns a red band. Between the two, the deltas printed under the
  // figures say it without shouting.
  const beyond = Math.abs(gap.amount) > tolerance;

  return (
    <TableRow state={balanced ? 'success' : beyond ? 'error' : undefined}>
      <TableCell />
      <TableCell />
      <TableCell />
      <TableCell sx={WRAP} secondary={`against ${line.itemNo}`}>
        <Typography variant="body2" weight="semibold">
          Total
        </Typography>
      </TableCell>
      <TableCell secondary={quantityGap(gap.quantity) || undefined}>
        <Typography variant="body2" weight="semibold">
          <Box component="span" sx={MONO}>
            {num(sumQty(rows))}
          </Box>
        </Typography>
      </TableCell>
      <TableCell />
      <TableCell align="right" secondary={amountGap(gap.amount, currency) || undefined}>
        <Typography variant="body2" weight="semibold">
          <Amount>{money(sumTotal(rows), currency)}</Amount>
        </Typography>
      </TableCell>
    </TableRow>
  );
}

/** One side of the comparison: a label, a figure, and what it is made of. */
function SummaryStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Stack sx={{ gap: 0.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.06em' }}>
        {label}
      </Typography>
      <Typography variant="h5">{value}</Typography>
      <Typography variant="caption" color="text.secondary">
        {detail}
      </Typography>
    </Stack>
  );
}

export function LineItemComparison({ invoice }: { invoice: Invoice }) {
  const { config } = useStore();
  const [selectedLineId, setSelectedLineId] = React.useState<string | null>(
    invoice.lines[0]?.id ?? null,
  );
  const [invoiceQuery, setInvoiceQuery] = React.useState('');
  const [grnQuery, setGrnQuery] = React.useState('');
  const [selectedOnly, setSelectedOnly] = React.useState(false);
  const symbol = currencySymbol(invoice.currency);

  const receiptsFor = (lineId: string) => invoice.grnLines.filter((g) => g.matchedTo === lineId);

  const statuses = invoice.lines.map((line) => ({
    line,
    receipts: receiptsFor(line.id),
    status: statusFor(line, receiptsFor(line.id)),
  }));

  const visibleLines = statuses.filter((entry) =>
    matchesQuery([entry.line.itemNo, entry.line.description], invoiceQuery),
  );

  // The receipts, grouped under the invoice line each one was booked against.
  const groups = statuses
    .filter((entry) => !selectedOnly || entry.line.id === selectedLineId)
    .map((entry) => ({
      ...entry,
      visible: entry.receipts.filter((r) =>
        matchesQuery([r.poNo, r.grnNo, r.description], grnQuery),
      ),
    }))
    .filter((group) => group.visible.length > 0);

  const invoiceQty = invoice.lines.reduce((s, l) => s + l.invoiceQty, 0);
  const invoiceTotal = Number(
    invoice.lines.reduce((s, l) => s + l.invoiceLineTotal, 0).toFixed(2),
  );
  const deliveries = new Set(invoice.grnLines.map((g) => g.grnNo)).size;
  const grnQty = sumQty(invoice.grnLines);
  const grnTotal = sumTotal(invoice.grnLines);
  const variance = Number((invoiceTotal - grnTotal).toFixed(2));
  const balanced = Math.abs(variance) <= config.totalToleranceAbsolute;

  return (
    <Stack sx={{ flex: 1, minHeight: 0 }}>
      <Stack direction="row" sx={{ flex: 1, minHeight: 0 }}>
        {/* The invoice: one row per line, and what each row came out as.
            Clicking a line is what points the panel beside it. */}
        <Stack sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          <PanelHeader
            title="INVOICE"
            query={invoiceQuery}
            onQueryChange={setInvoiceQuery}
            searchLabel="Search invoice lines"
          />
          <TableContainer sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <Table size="sm" sx={{ minWidth: 540, ...TABLE_LAYOUT }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...LABEL_CELL, width: INVOICE_COLS.mark }} />
                  <TableCell sx={{ ...LABEL_CELL, width: INVOICE_COLS.itemNo }}>Item No.</TableCell>
                  <TableCell sx={{ ...LABEL_CELL, width: INVOICE_COLS.description }}>
                    Description
                  </TableCell>
                  <TableCell sx={{ ...LABEL_CELL, width: INVOICE_COLS.qty }}>Qty</TableCell>
                  <TableCell align="right" sx={LABEL_CELL}>
                    Unit Price ({symbol})
                  </TableCell>
                  <TableCell align="right" sx={LABEL_CELL}>
                    Line Total ({symbol})
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleLines.map((entry) => (
                  <InvoiceRow
                    key={entry.line.id}
                    line={entry.line}
                    status={entry.status}
                    selected={entry.line.id === selectedLineId}
                    onSelect={() => setSelectedLineId(entry.line.id)}
                  />
                ))}
                <TableRow>
                  <TableCell sx={LABEL_CELL} />
                  <TableCell sx={LABEL_CELL} />
                  <TableCell sx={LABEL_CELL}>
                    <Typography variant="body2" weight="semibold">
                      Invoice Total
                    </Typography>
                  </TableCell>
                  <TableCell sx={LABEL_CELL}>
                    <Typography variant="body2" weight="semibold">
                      <Box component="span" sx={MONO}>
                        {num(invoiceQty)}
                      </Box>
                    </Typography>
                  </TableCell>
                  <TableCell sx={LABEL_CELL} />
                  <TableCell align="right" sx={LABEL_CELL}>
                    <Typography variant="body2" weight="semibold">
                      <Amount>{money(invoiceTotal, invoice.currency)}</Amount>
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
          <Divider />
          <Box sx={{ px: 2, py: 1, flexShrink: 0 }}>
            <Typography variant="caption" color="text.secondary">
              {plural(invoice.lines.length, 'line item', 'line items')}
            </Typography>
          </Box>
        </Stack>

        <Divider orientation="vertical" flexItem />

        {/* The receipts, grouped by the invoice line each was booked against.
            The row that closes each group is what they add up to. */}
        <Stack sx={{ flex: 1.1, minWidth: 0, minHeight: 0 }}>
          <PanelHeader
            title="GRN"
            query={grnQuery}
            onQueryChange={setGrnQuery}
            searchLabel="Search goods receipts"
          >
            <Tooltip
              title={
                selectedOnly
                  ? 'Showing receipts for the selected line only'
                  : 'Show receipts for the selected line only'
              }
            >
              <IconButton
                variant="secondary"
                appearance="text"
                size="sm"
                aria-label="Show receipts for the selected line only"
                aria-pressed={selectedOnly}
                onClick={() => setSelectedOnly((previous) => !previous)}
              >
                <FunnelIcon weight={selectedOnly ? 'fill' : 'regular'} />
              </IconButton>
            </Tooltip>
          </PanelHeader>

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
            <>
              <TableContainer sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                <Table size="sm" sx={{ minWidth: 580, ...TABLE_LAYOUT }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ ...LABEL_CELL, width: GRN_COLS.mark }} />
                      <TableCell sx={{ ...LABEL_CELL, width: GRN_COLS.poNo }}>PO No.</TableCell>
                      <TableCell sx={{ ...LABEL_CELL, width: GRN_COLS.grnNo }}>GRN No.</TableCell>
                      <TableCell sx={{ ...LABEL_CELL, width: GRN_COLS.description }}>
                        Description
                      </TableCell>
                      <TableCell sx={{ ...LABEL_CELL, width: GRN_COLS.qty }}>Qty</TableCell>
                      <TableCell align="right" sx={LABEL_CELL}>
                        Unit Price ({symbol})
                      </TableCell>
                      <TableCell align="right" sx={LABEL_CELL}>
                        Line Total ({symbol})
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {groups.map((group) => (
                      <React.Fragment key={group.line.id}>
                        {group.visible.map((receipt) => (
                          <ReceiptRow
                            key={receipt.id}
                            receipt={receipt}
                            selected={group.line.id === selectedLineId}
                          />
                        ))}
                        <GroupTotalRow
                          line={group.line}
                          rows={group.receipts}
                          currency={invoice.currency}
                          tolerance={config.lineToleranceAbsolute}
                        />
                      </React.Fragment>
                    ))}
                    <TableRow>
                      <TableCell sx={LABEL_CELL} />
                      <TableCell sx={LABEL_CELL} />
                      <TableCell sx={LABEL_CELL} />
                      <TableCell sx={LABEL_CELL}>
                        <Typography variant="body2" weight="semibold">
                          GRN Total
                        </Typography>
                      </TableCell>
                      <TableCell sx={LABEL_CELL}>
                        <Typography variant="body2" weight="semibold">
                          <Box component="span" sx={MONO}>
                            {num(grnQty)}
                          </Box>
                        </Typography>
                      </TableCell>
                      <TableCell sx={LABEL_CELL} />
                      <TableCell align="right" sx={LABEL_CELL}>
                        <Typography variant="body2" weight="semibold">
                          <Amount>{money(grnTotal, invoice.currency)}</Amount>
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              <Divider />
              <Box sx={{ px: 2, py: 1, flexShrink: 0 }}>
                <Typography variant="caption" color="text.secondary">
                  {plural(invoice.grnLines.length, 'receipt', 'receipts')} across{' '}
                  {plural(deliveries, 'delivery', 'deliveries')}
                </Typography>
              </Box>
            </>
          )}
        </Stack>
      </Stack>

      <Divider />

      {/* The one question, under both panels rather than inside either: it is
          about the document, and neither half of the comparison owns it. */}
      <Stack
        direction="row"
        sx={{
          px: 3,
          py: 2,
          gap: 5,
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <SummaryStat
          label="INVOICE"
          value={money(invoiceTotal, invoice.currency)}
          detail={`${plural(invoice.lines.length, 'line', 'lines')} · ${num(invoiceQty)} qty`}
        />

        <Stack sx={{ gap: 0.5, alignItems: 'center' }}>
          <ArrowsLeftRightIcon size={20} />
          <Chip
            size="sm"
            variant="secondary"
            label={`Tolerance: ± ${money(config.totalToleranceAbsolute, invoice.currency)}`}
          />
        </Stack>

        <SummaryStat
          label="GRN"
          value={money(grnTotal, invoice.currency)}
          detail={`${plural(invoice.grnLines.length, 'receipt', 'receipts')} · ${num(grnQty)} qty`}
        />

        <Divider orientation="vertical" flexItem />

        <Card>
          <CardContent>
            <Stack sx={{ gap: 0.5, minWidth: 180 }}>
              <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.06em' }}>
                VARIANCE
              </Typography>
              <Typography variant="h5">
                {balanced ? 'Balanced' : money(Math.abs(variance), invoice.currency)}
              </Typography>
              <Chip
                size="sm"
                variant={balanced ? 'success' : 'error'}
                label={
                  balanced ? 'Invoice = GRN' : variance > 0 ? 'Invoice > GRN' : 'GRN > Invoice'
                }
              />
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Stack>
  );
}

/** The matching stage's views. */
export function MatchingViews({ invoice }: { invoice: Invoice }) {
  const [tab, setTab] = React.useState<'details' | 'lines'>('details');
  const differing = comparisonRows(invoice).filter(rowDiffers).length;

  return (
    <Stack sx={{ flex: 1, minHeight: 0 }}>
      <Box sx={{ px: 3, pt: 1, flexShrink: 0 }}>
        <Tabs value={tab} onChange={(_, next) => setTab(next)} aria-label="Matching views">
          <Tab label="Invoice details" value="details" count={differing || undefined} />
          <Tab label="Line items" value="lines" count={invoice.lines.length} />
        </Tabs>
      </Box>
      {tab === 'details' && (
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <InvoiceDetailsTable invoice={invoice} />
        </Box>
      )}
      {tab === 'lines' && <LineItemComparison invoice={invoice} />}
    </Stack>
  );
}
