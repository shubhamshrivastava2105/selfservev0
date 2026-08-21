import * as React from 'react';
import { Box, Button, Chip, IconButton, Stack, TextField, Tooltip, Typography } from '@neofloai/atoms';
import {
  ArrowClockwiseIcon,
  ArrowCounterClockwiseIcon,
  CaretLeftIcon,
  CaretRightIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  SealCheckIcon,
  WarningIcon,
  XIcon,
} from '@neofloai/atoms/icons';
import { useStore } from '../../store';
import { confidenceTone } from '../../components/common';
import type { ExtractedField, Invoice } from '../../types';

const PAGES = 6;

/**
 * The source document, and the evidence for a value.
 *
 * The page is drawn from the same coordinates the fields carry, so selecting a
 * field always highlights exactly the text it was read from. Confidence lives
 * here, beside the evidence, rather than on the field in the panel: a score is
 * only meaningful next to what produced it.
 */
export function DocumentPane({
  invoice,
  selected,
  onSelect,
  readOnly,
}: {
  invoice: Invoice;
  selected: ExtractedField | null;
  onSelect: (key: string | null) => void;
  /** A closed record, or an earlier stage being looked back at: the callout reads. */
  readOnly?: boolean;
}) {
  const { config, editField } = useStore();
  const [zoom, setZoom] = React.useState(100);
  const [rotation, setRotation] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [draft, setDraft] = React.useState('');

  // Selecting a field takes you to the page it was read from.
  React.useEffect(() => {
    if (selected?.region) setPage(selected.region.page);
    setDraft(selected?.value ?? '');
  }, [selected?.key, selected?.value, selected?.region]);

  const placed = invoice.invoiceFields.filter((f) => f.region && f.region.page === page);
  const tone = selected ? confidenceTone(selected.confidence, config.confidenceThreshold) : 'clear';
  const low = tone === 'amber' || tone === 'red';

  const commit = () => {
    if (selected && draft !== selected.value) editField(invoice.id, 'invoice', selected.key, draft);
  };

  return (
    <Stack sx={{ flex: 1, minWidth: 0, borderRight: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 3, backgroundColor: 'action.hover' }}>
        <Box
          sx={{
            width: `${Math.min(zoom, 150)}%`,
            maxWidth: 760,
            mx: 'auto',
            transform: `rotate(${rotation}deg)`,
            transformOrigin: 'top center',
            transition: 'transform 150ms',
          }}
        >
          {/* The page. Everything on it is positioned, so a highlight lands true. */}
          <Box
            sx={{
              position: 'relative',
              backgroundColor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              aspectRatio: '1 / 1.35',
              fontSize: 11,
            }}
            onClick={() => onSelect(null)}
          >
            <Typography
              variant="caption"
              sx={{ position: 'absolute', left: '6%', top: '19%', fontWeight: 600 }}
            >
              INVOICE
            </Typography>
            <Typography variant="caption" sx={{ position: 'absolute', right: '6%', top: '4%', color: 'text.secondary' }}>
              Page {page} of {PAGES}
            </Typography>

            {/* Field values, drawn where they live */}
            {placed.map((f) => {
              const isSelected = selected?.key === f.key;
              return (
                <Box
                  key={f.key}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(f.key);
                  }}
                  sx={{
                    position: 'absolute',
                    left: `${f.region!.x}%`,
                    top: `${f.region!.y}%`,
                    width: `${f.region!.w}%`,
                    minHeight: `${f.region!.h}%`,
                    px: 0.5,
                    cursor: 'pointer',
                    borderRadius: 0.5,
                    outline: isSelected ? '2px solid' : '1px dashed transparent',
                    outlineColor: isSelected ? 'primary.main' : undefined,
                    backgroundColor: isSelected ? 'primary.subtle' : 'transparent',
                    '&:hover': { backgroundColor: isSelected ? 'primary.subtle' : 'action.hover' },
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                    {f.label}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.3 }}>
                    {f.value}
                  </Typography>
                </Box>
              );
            })}

            {/* Line items */}
            <Box sx={{ position: 'absolute', left: '6%', right: '6%', top: '46%' }}>
              <Stack direction="row" sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 0.25 }}>
                <Typography variant="caption" sx={{ flex: 1, fontWeight: 600 }}>
                  Description
                </Typography>
                <Typography variant="caption" sx={{ width: 40, textAlign: 'right', fontWeight: 600 }}>
                  Qty
                </Typography>
                <Typography variant="caption" sx={{ width: 70, textAlign: 'right', fontWeight: 600 }}>
                  Amount
                </Typography>
              </Stack>
              {invoice.lines.map((l) => (
                <Stack key={l.id} direction="row" sx={{ py: 0.25 }}>
                  <Typography variant="caption" sx={{ flex: 1, minWidth: 0 }} noWrap>
                    {l.itemNo} · {l.description}
                  </Typography>
                  <Typography variant="caption" sx={{ width: 40, textAlign: 'right' }}>
                    {l.invoiceQty}
                  </Typography>
                  <Typography variant="caption" sx={{ width: 70, textAlign: 'right' }}>
                    {l.invoiceLineTotal.toFixed(2)}
                  </Typography>
                </Stack>
              ))}
            </Box>

            {/* The callout: what was read, how sure, and a chance to fix it */}
            {selected?.region && selected.region.page === page && (
              <Box
                onClick={(event) => event.stopPropagation()}
                sx={{
                  position: 'absolute',
                  left: `${Math.min(selected.region.x, 52)}%`,
                  top: `calc(${selected.region.y + selected.region.h}% + 6px)`,
                  width: 260,
                  zIndex: 2,
                  p: 1.5,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: 'background.paper',
                  boxShadow: 3,
                }}
              >
                <Stack sx={{ gap: 1 }}>
                  <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
                    <Typography variant="caption" weight="medium" sx={{ flex: 1 }}>
                      {selected.label}
                    </Typography>
                    <IconButton
                      variant="secondary"
                      appearance="text"
                      size="sm"
                      aria-label="Close"
                      onClick={() => onSelect(null)}
                    >
                      <XIcon />
                    </IconButton>
                  </Stack>

                  {selected.confidence === null ? (
                    <Chip size="sm" variant="information" label="From Zoho · ground truth" />
                  ) : (
                    <Stack direction="row" sx={{ gap: 0.75, alignItems: 'center' }}>
                      <Chip
                        size="sm"
                        variant={low ? (tone === 'red' ? 'error' : 'warning') : 'success'}
                        icon={low ? <WarningIcon size={12} /> : <SealCheckIcon size={12} />}
                        label={`${selected.confidence}% confidence`}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {low ? `below ${config.confidenceThreshold}%` : 'read clearly'}
                      </Typography>
                    </Stack>
                  )}

                  <TextField
                    aria-label={`${selected.label} value`}
                    value={draft}
                    disabled={readOnly}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={commit}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commit();
                    }}
                    status={low ? (tone === 'red' ? 'error' : 'warning') : undefined}
                    fullWidth
                  />

                  {selected.editedFrom !== undefined && (
                    <Typography variant="caption" color="text.secondary">
                      Corrected from “{selected.editedFrom}”
                    </Typography>
                  )}

                  <Stack direction="row" sx={{ gap: 1, justifyContent: 'flex-end' }}>
                    <Button variant="secondary" appearance="text" size="sm" onClick={() => onSelect(null)}>
                      Close
                    </Button>
                    {!readOnly && (
                      <Button size="sm" disabled={draft === selected.value} onClick={commit}>
                        Save
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* Viewer controls */}
      <Stack
        direction="row"
        sx={{
          px: 2,
          py: 1,
          gap: 2,
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center' }}>
          <Tooltip title="Zoom in">
            <IconButton
              variant="secondary"
              appearance="text"
              size="sm"
              aria-label="Zoom in"
              onClick={() => setZoom((z) => Math.min(200, z + 25))}
            >
              <MagnifyingGlassPlusIcon />
            </IconButton>
          </Tooltip>
          <Typography variant="body2" sx={{ minWidth: 44, textAlign: 'center' }}>
            {zoom}%
          </Typography>
          <Tooltip title="Zoom out">
            <IconButton
              variant="secondary"
              appearance="text"
              size="sm"
              aria-label="Zoom out"
              onClick={() => setZoom((z) => Math.max(50, z - 25))}
            >
              <MagnifyingGlassMinusIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center' }}>
          <Tooltip title="Rotate left">
            <IconButton
              variant="secondary"
              appearance="text"
              size="sm"
              aria-label="Rotate left"
              onClick={() => setRotation((r) => r - 90)}
            >
              <ArrowCounterClockwiseIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Rotate right">
            <IconButton
              variant="secondary"
              appearance="text"
              size="sm"
              aria-label="Rotate right"
              onClick={() => setRotation((r) => r + 90)}
            >
              <ArrowClockwiseIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center' }}>
          <IconButton
            variant="secondary"
            appearance="text"
            size="sm"
            aria-label="Previous page"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <CaretLeftIcon />
          </IconButton>
          <Typography variant="body2" sx={{ fontFamily: 'mono' }}>
            {page}{' '}
            <Box component="span" sx={{ color: 'text.secondary' }}>
              of {PAGES}
            </Box>
          </Typography>
          <IconButton
            variant="secondary"
            appearance="text"
            size="sm"
            aria-label="Next page"
            disabled={page === PAGES}
            onClick={() => setPage((p) => Math.min(PAGES, p + 1))}
          >
            <CaretRightIcon />
          </IconButton>
        </Stack>
      </Stack>
    </Stack>
  );
}
