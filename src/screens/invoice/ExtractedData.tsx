import * as React from 'react';
import {
  Box,
  Chip,
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
import { SparkleIcon, WarningIcon } from '@neofloai/atoms/icons';
import { useStore } from '../../store';
import { confidenceTone } from '../../components/common';
import { money, num } from '../../engine';
import type { ExtractedField, Invoice } from '../../types';

/**
 * A row in the Field and Value table.
 *
 * The value reads as plain text. No score, no input: selecting the row takes the
 * reader to where it was read from on the document, and the confidence and the
 * correction both happen there, beside the evidence.
 */
function FieldRow({
  field,
  selected,
  onSelect,
  invoiceId,
  readOnly,
}: {
  field: ExtractedField;
  selected: boolean;
  onSelect: () => void;
  invoiceId: string;
  readOnly?: boolean;
}) {
  const { config, editField } = useStore();
  const tone = confidenceTone(field.confidence, config.confidenceThreshold);
  const low = tone === 'amber' || tone === 'red';

  /**
   * Correcting happens here, in the table, and not in the callout on the
   * document. The document is the evidence — you look at it to see what the
   * page actually says — and the table is the record you are putting right.
   */
  const [draft, setDraft] = React.useState(field.value);
  React.useEffect(() => setDraft(field.value), [field.value]);
  const commit = () => {
    if (draft !== field.value) editField(invoiceId, 'invoice', field.key, draft);
  };

  /** A proposal nobody has agreed to yet. Correcting or confirming clears it. */
  const needsReview = Boolean(field.inferred) && field.editedFrom === undefined;

  return (
    <TableRow
      hover
      selected={selected}
      onClick={onSelect}
      sx={{
        cursor: field.region ? 'pointer' : 'default',
        // A suggestion is the one row on this table that wants an answer, so it
        // is the one row that looks different without being pointed at.
        ...(needsReview && {
          backgroundColor: 'warning.subtle',
          '& > td:first-of-type': {
            boxShadow: (theme) => `inset 3px 0 0 0 ${theme.palette.warning.main}`,
          },
        }),
      }}
    >
      <TableCell>
        <Typography variant="body2">
          {field.label}
          {field.mandatory && (
            <Box component="span" sx={{ color: 'error.main', ml: 0.5 }}>
              *
            </Box>
          )}
        </Typography>
      </TableCell>
      <TableCell padding="none" sx={{ pr: 2 }}>
        <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
          {/* Borderless until you are in it, so a column of these still reads
              as values rather than as a form. */}
          <TextField
            aria-label={`${field.label}, currently ${field.value || 'empty'}${
              needsReview ? '. Suggested by Neoflo and not yet checked.' : ''
            }`}
            value={draft}
            disabled={readOnly}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                (event.target as HTMLInputElement).blur();
              }
              if (event.key === 'Escape') setDraft(field.value);
            }}
            onClick={(event) => event.stopPropagation()}
            fullWidth
            sx={{
              flex: 1,
              minWidth: 0,
              '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
              '&:hover .MuiOutlinedInput-notchedOutline': { border: '1px solid' },
              '&:focus-within .MuiOutlinedInput-notchedOutline': { border: '1px solid' },
            }}
          />
          {/* Not read at all, but worked out. Named as such, because agreeing
              to a suggestion and confirming a reading are different acts — and
              the score says how much of a guess it was. */}
          {field.inferred && (
            <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center', flexShrink: 0 }}>
              <Chip
                size="sm"
                variant="purple"
                icon={<SparkleIcon size={12} />}
                label="AI suggested"
              />
              {field.confidence !== null && (
                <Chip
                  size="sm"
                  variant="warning"
                  icon={<WarningIcon size={12} />}
                  label={`${field.confidence}% · verify`}
                />
              )}
            </Stack>
          )}
          {/* A mark, not a number: the number is on the document. */}
          {low && !field.inferred && (
            <Tooltip title="Read with low confidence. Click the row to see it on the document.">
              <Box sx={{ display: 'flex', color: tone === 'red' ? 'error.main' : 'warning.main' }}>
                <WarningIcon size={14} />
              </Box>
            </Tooltip>
          )}
        </Stack>
        {/* The reason, on the row rather than in a tooltip: somebody deciding
            whether to accept a proposal should not have to hover to see what it
            was based on. And a way to agree, because editing is no use when the
            proposal is already right. */}
        {/* The reason, printed rather than tooltipped: somebody weighing a
            proposal should not have to hover to see what it rests on. There is
            nothing to accept — correcting it is the only action, and
            proceeding is how you say it was already right. */}
        {needsReview && field.inferred && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.5, whiteSpace: 'normal' }}
          >
            {field.inferred.because}
          </Typography>
        )}
      </TableCell>
    </TableRow>
  );
}

/** Field and Value, as the extraction stage presents it. */
export function ExtractedData({
  invoice,
  selectedKey,
  onSelect,
  selectedLineId,
  onSelectLine,
  readOnly,
}: {
  invoice: Invoice;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  selectedLineId: string | null;
  onSelectLine: (id: string | null) => void;
  /** A closed record, or an earlier stage being looked back at: values read. */
  readOnly?: boolean;
}) {
  const [tab, setTab] = React.useState<'metadata' | 'lines'>('metadata');
  const { config } = useStore();
  /**
   * How many values want a look. This drives the dot, never a badge — a badge
   * meaning "flagged" beside one meaning "total" is a number nobody can read.
   */
  const flagged = invoice.invoiceFields.filter(
    (f) => f.confidence !== null && f.confidence < config.confidenceThreshold,
  ).length;
  const flaggedLines = invoice.lines.filter((l) => l.confidence < config.confidenceThreshold).length;

  /** A count, with a dot beside it when something on that tab is flagged. */
  const tabLabel = (text: string, needsAttention: number) => (
    <Stack direction="row" sx={{ gap: 0.75, alignItems: 'center' }}>
      <span>{text}</span>
      {needsAttention > 0 && (
        <Tooltip
          title={`${needsAttention} ${needsAttention === 1 ? 'value needs' : 'values need'} a look`}
        >
          <Box
            sx={{ width: 6, height: 6, borderRadius: 999, backgroundColor: 'warning.main' }}
          />
        </Tooltip>
      )}
    </Stack>
  );

  return (
    <Stack sx={{ width: 620, flexShrink: 0, minHeight: 0 }}>
      <Box sx={{ px: 3, pt: 2.5, pb: 0 }}>
        <Typography variant="h6" component="h2">
          Extracted data
        </Typography>
      </Box>

      <Box sx={{ px: 3 }}>
        <Tabs value={tab} onChange={(_, next) => setTab(next)} aria-label="Extracted data">
          {/* No count here. How many metadata fields there are is not a fact
              anybody needs; the dot, which says one of them wants a look, is. */}
          <Tab label={tabLabel('Metadata', flagged)} value="metadata" />
          <Tab
            label={tabLabel('Line items', flaggedLines)}
            value="lines"
            count={invoice.lines.length}
          />
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {tab === 'metadata' ? (
          <TableContainer>
            <Table size="md">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 220 }}>Field</TableCell>
                  <TableCell>Value</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoice.invoiceFields.map((f) => (
                  <FieldRow
                    key={f.key}
                    field={f}
                    invoiceId={invoice.id}
                    readOnly={readOnly}
                    selected={selectedKey === f.key}
                    onSelect={() => onSelect(selectedKey === f.key ? null : f.key)}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <TableContainer>
            <Table size="sm">
              <TableHead>
                <TableRow>
                  <TableCell>Item No.</TableCell>
                  <TableCell sx={{ width: '100%' }}>Description</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Unit Price</TableCell>
                  <TableCell align="right">Line Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoice.lines.map((l) => {
                  const lineLow = l.confidence < config.confidenceThreshold;
                  return (
                    <TableRow
                      key={l.id}
                      hover
                      selected={selectedLineId === l.id}
                      // A line is read off the page like anything else, so it
                      // points at the page like anything else.
                      onClick={() => onSelectLine(selectedLineId === l.id ? null : l.id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell sx={{ fontFamily: 'mono' }}>{l.itemNo}</TableCell>
                      <TableCell>
                        <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
                            {l.description}
                          </Typography>
                          {lineLow && (
                            <Tooltip title="Read with low confidence. Click the row to see it on the document.">
                              <Box sx={{ display: 'flex', color: 'warning.main' }}>
                                <WarningIcon size={14} />
                              </Box>
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell align="right">{num(l.invoiceQty)}</TableCell>
                      <TableCell align="right">{money(l.invoiceUnitPrice, invoice.currency)}</TableCell>
                      <TableCell align="right">{money(l.invoiceLineTotal, invoice.currency)}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow>
                  <TableCell />
                  <TableCell>
                    <Typography variant="body2" weight="medium">
                      Invoice Total
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" weight="medium">
                      {num(invoice.lines.reduce((s, l) => s + l.invoiceQty, 0))}
                    </Typography>
                  </TableCell>
                  <TableCell />
                  <TableCell align="right">
                    <Typography variant="body2" weight="medium">
                      {money(invoice.amount, invoice.currency)}
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Stack>
  );
}
