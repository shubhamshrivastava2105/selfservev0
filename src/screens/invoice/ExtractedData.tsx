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
import { BrainIcon, WarningIcon } from '@neofloai/atoms/icons';
import { useStore } from '../../store';
import { confidenceTone } from '../../components/common';
import { money, num } from '../../engine';
import type { ExtractedField, Invoice } from '../../types';

/** A field label with the asterisk the product puts on mandatory fields. */
function FieldLabel({ field }: { field: ExtractedField }) {
  return (
    <Typography variant="body2">
      {field.label}
      {field.mandatory && (
        <Box component="span" sx={{ color: 'error.main', ml: 0.5 }}>
          *
        </Box>
      )}
    </Typography>
  );
}

/**
 * One value cell. Reads as plain text, as the product does, and only becomes an
 * input when the extraction scored it below the threshold and the user has to
 * deal with it.
 */
function ValueCell({
  invoice,
  field,
  scope,
}: {
  invoice: Invoice;
  field: ExtractedField;
  scope: 'invoice' | 'po' | 'grn';
}) {
  const { config, memory, editField } = useStore();
  const [draft, setDraft] = React.useState(field.value);
  React.useEffect(() => setDraft(field.value), [field.value]);

  const tone = confidenceTone(field.confidence, config.confidenceThreshold);
  // Flagged, not blocking: a low read is editable and marked, nothing more.
  const needsUser = tone === 'amber' || tone === 'red';

  const suggestion = React.useMemo(() => {
    if (!needsUser || !field.learnable) return null;
    const pattern = memory.find(
      (m) =>
        m.streak >= config.memoryThreshold &&
        m.fieldKey === field.key &&
        m.patternKey.toLowerCase().includes(field.value.toLowerCase().slice(0, 12)),
    );
    return pattern && pattern.suggestedValue !== field.value ? pattern.suggestedValue : null;
  }, [needsUser, field, memory, config.memoryThreshold]);

  if (!needsUser) {
    return (
      <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
        <Typography variant="body2">{field.value}</Typography>
        {field.editedFrom !== undefined && (
          <Tooltip title={`Corrected from "${field.editedFrom}"`}>
            <Chip size="sm" variant="secondary" label="edited" />
          </Tooltip>
        )}
      </Stack>
    );
  }

  const commit = () => {
    if (draft !== field.value) editField(invoice.id, scope, field.key, draft);
  };

  return (
    <Stack sx={{ gap: 1, py: 0.5 }}>
      <Stack direction="row" sx={{ gap: 1, alignItems: 'flex-start' }}>
        <TextField
          aria-label={field.label}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
          }}
          status={tone === 'red' ? 'error' : 'warning'}
          sx={{ maxWidth: 320 }}
          fullWidth
        />
        <Tooltip
          title={`Read at ${field.confidence}% confidence, below the ${config.confidenceThreshold}% threshold. Correct it if it is wrong.`}
        >
          <Chip
            size="sm"
            variant={tone === 'red' ? 'error' : 'warning'}
            icon={<WarningIcon size={12} />}
            label={`${field.confidence}%`}
          />
        </Tooltip>
      </Stack>

      {suggestion && (
        <Stack direction="row" sx={{ gap: 0.75, alignItems: 'center' }}>
          <BrainIcon size={14} />
          <Typography variant="caption" color="text.secondary">
            Remembered:
          </Typography>
          <Chip
            size="sm"
            variant="purple"
            label={suggestion}
            onClick={() => editField(invoice.id, scope, field.key, suggestion)}
          />
        </Stack>
      )}
    </Stack>
  );
}

/** Field and Value, as the extraction stage presents it. */
export function ExtractedData({ invoice }: { invoice: Invoice }) {
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
                  <TableRow key={f.key}>
                    <TableCell>
                      <FieldLabel field={f} />
                    </TableCell>
                    <TableCell>
                      <ValueCell invoice={invoice} field={f} scope="invoice" />
                    </TableCell>
                  </TableRow>
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
