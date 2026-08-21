import * as React from 'react';
import {
  Box,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
} from '@neofloai/atoms';
import { WarningIcon } from '@neofloai/atoms/icons';
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
}: {
  field: ExtractedField;
  selected: boolean;
  onSelect: () => void;
}) {
  const { config } = useStore();
  const tone = confidenceTone(field.confidence, config.confidenceThreshold);
  const low = tone === 'amber' || tone === 'red';

  return (
    <TableRow
      hover
      selected={selected}
      onClick={onSelect}
      sx={{ cursor: field.region ? 'pointer' : 'default' }}
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
      <TableCell>
        <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
          <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
            {field.value}
          </Typography>
          {/* A mark, not a number: the number is on the document. */}
          {low && (
            <Tooltip title="Read with low confidence. Click to see it on the document.">
              <Box sx={{ display: 'flex', color: tone === 'red' ? 'error.main' : 'warning.main' }}>
                <WarningIcon size={14} />
              </Box>
            </Tooltip>
          )}
        </Stack>
      </TableCell>
    </TableRow>
  );
}

/** Field and Value, as the extraction stage presents it. */
export function ExtractedData({
  invoice,
  selectedKey,
  onSelect,
}: {
  invoice: Invoice;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
}) {
  const [tab, setTab] = React.useState<'metadata' | 'lines'>('metadata');
  const { config } = useStore();
  const pending = invoice.invoiceFields.filter(
    (f) => f.confidence !== null && f.confidence < config.confidenceThreshold && !f.acknowledged,
  ).length;

  return (
    <Stack sx={{ width: 620, flexShrink: 0, minHeight: 0 }}>
      <Box sx={{ px: 3, pt: 2.5, pb: 0 }}>
        <Typography variant="h6" component="h2">
          Extracted data
        </Typography>
      </Box>

      <Box sx={{ px: 3 }}>
        <Tabs value={tab} onChange={(_, next) => setTab(next)} aria-label="Extracted data">
          <Tab label="Metadata" value="metadata" count={pending || undefined} />
          <Tab label="Line items" value="lines" count={invoice.lines.length} />
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
                {invoice.lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell sx={{ fontFamily: 'mono' }}>{l.itemNo}</TableCell>
                    <TableCell>{l.description}</TableCell>
                    <TableCell align="right">{num(l.invoiceQty)}</TableCell>
                    <TableCell align="right">{money(l.invoiceUnitPrice, invoice.currency)}</TableCell>
                    <TableCell align="right">{money(l.invoiceLineTotal, invoice.currency)}</TableCell>
                  </TableRow>
                ))}
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
