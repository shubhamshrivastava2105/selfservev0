import * as React from 'react';
import {
  Box,
  Chip,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@neofloai/atoms';
import {
  ArrowClockwiseIcon,
  ArrowCounterClockwiseIcon,
  CaretLeftIcon,
  CaretRightIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  SealCheckIcon,
  SparkleIcon,
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
  selectedLineId,
}: {
  invoice: Invoice;
  selected: ExtractedField | null;
  onSelect: (key: string | null) => void;
  /** A line picked from the table, to mark and scroll to on the page. */
  selectedLineId?: string | null;
}) {
  const { config } = useStore();
  const [zoom, setZoom] = React.useState(100);
  const [rotation, setRotation] = React.useState(0);
  const [page, setPage] = React.useState(1);

  const scroller = React.useRef<HTMLDivElement | null>(null);
  const pageRef = React.useRef<HTMLDivElement | null>(null);

  /**
   * Selecting a field takes you to the page it was read from, and then to the
   * part of the page it sits on. Switching the page alone is not "show me where
   * this came from" when the value is below the fold.
   */
  React.useEffect(() => {
    if (selected?.region) setPage(selected.region.page);
  }, [selected?.key, selected?.region]);

  React.useEffect(() => {
    const region = selected?.region;
    const box = scroller.current;
    const sheet = pageRef.current;
    if (!region || !box || !sheet) return;
    const target = sheet.offsetTop + (sheet.offsetHeight * region.y) / 100;
    // Land the value a third of the way down, not jammed against the top edge.
    box.scrollTo({ top: Math.max(0, target - box.clientHeight / 3), behavior: 'smooth' });
  }, [selected?.key, selected?.region, page, zoom]);

  /** A line picked from the table scrolls to its row on the page. */
  React.useEffect(() => {
    const box = scroller.current;
    if (!selectedLineId || !box) return;
    const row = box.querySelector(`[data-line-id="${selectedLineId}"]`) as HTMLElement | null;
    if (!row) return;
    box.scrollTo({
      top: Math.max(0, row.offsetTop - box.clientHeight / 3),
      behavior: 'smooth',
    });
  }, [selectedLineId]);

  const placed = invoice.invoiceFields.filter((f) => f.region && f.region.page === page);

  /**
   * A field's box and its score, tinted by how sure the read was.
   *
   * Shown on hover and on the selected field, not on every field at once: a page
   * covered in boxes is a debugging view, and this is a document somebody is
   * reading. Point at a value and the annotation appears over it.
   */
  /** The same tinting for a line, which has a score but no field record. */
  const lineTone = (confidence: number) => {
    if (confidence >= config.confidenceThreshold)
      return { line: 'var(--mui-palette-success-main)', fill: 'transparent' };
    return confidence >= config.confidenceThreshold - 15
      ? { line: 'var(--mui-palette-warning-main)', fill: 'var(--mui-palette-warning-subtle)' }
      : { line: 'var(--mui-palette-error-main)', fill: 'var(--mui-palette-error-subtle)' };
  };

  const boxTone = (field: ExtractedField) => {
    const t = confidenceTone(field.confidence, config.confidenceThreshold);
    if (t === 'ground-truth') return { line: 'var(--mui-palette-divider)', fill: 'transparent' };
    if (t === 'red') return { line: 'var(--mui-palette-error-main)', fill: 'var(--mui-palette-error-subtle)' };
    if (t === 'amber') return { line: 'var(--mui-palette-warning-main)', fill: 'var(--mui-palette-warning-subtle)' };
    return { line: 'var(--mui-palette-success-main)', fill: 'transparent' };
  };
  const tone = selected ? confidenceTone(selected.confidence, config.confidenceThreshold) : 'clear';
  const low = tone === 'amber' || tone === 'red';

  return (
    <Stack sx={{ flex: 1, minWidth: 0, borderRight: '1px solid', borderColor: 'divider' }}>
      <Box
        ref={scroller}
        sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 3, backgroundColor: 'action.hover' }}
      >
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
            ref={pageRef}
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
            {/* Everything the extractor does not read: the furniture that makes
                this a document somebody was sent rather than a form dump. The
                read values sit on top of it, positioned from the same regions. */}
            <Box sx={{ position: 'absolute', right: '6%', top: '3%', textAlign: 'right' }}>
              <Typography
                sx={{ fontSize: 22, fontWeight: 300, letterSpacing: '0.22em', lineHeight: 1.1 }}
              >
                INVOICE
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>
                Page {page} of {PAGES}
              </Typography>
            </Box>

            {/* Vendor address, under the read vendor block. */}
            <Box sx={{ position: 'absolute', left: '6%', top: '16.6%', width: '46%' }}>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.45 }}>
                2400 Bridgeway, Suite 210
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.45 }}>
                Sausalito, CA 94965 · United States
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.45 }}>
                ap@sierranetworks.example · +1 415 555 0114
              </Typography>
            </Box>

            <Box sx={{ position: 'absolute', right: '6%', top: '13%', width: '38%', textAlign: 'right' }}>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', letterSpacing: '0.1em' }}>
                BILL TO
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, lineHeight: 1.5 }}>
                {invoice.legalEntity}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.45 }}>
                Accounts Payable
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.45 }}>
                1 Market Street, San Francisco CA 94105
              </Typography>
            </Box>

            {/* The detail strip a printed invoice rules off from the addresses. */}
            <Box
              sx={{
                position: 'absolute',
                left: '5%',
                right: '5%',
                top: '23.5%',
                height: '13.5%',
                borderTop: '1.5px solid',
                borderBottom: '1px solid',
                borderColor: 'text.primary',
                opacity: 0.85,
              }}
              aria-hidden
            />
            <Box sx={{ position: 'absolute', left: '6%', right: '6%', top: '41.5%' }}>
              <Divider />
            </Box>

            {/* Remit-to, where a real invoice puts it. */}
            <Box sx={{ position: 'absolute', left: '6%', right: '40%', top: '74%' }}>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', letterSpacing: '0.1em' }}>
                REMIT TO
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.5 }}>
                Sierra Networks · Golden Gate Bank
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.45 }}>
                Routing 121000248 · Account ••••4417
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.45, mt: 0.75 }}>
                Please quote the invoice number with payment.
              </Typography>
            </Box>

            {/* Rules around the totals block. */}
            <Box
              sx={{
                position: 'absolute',
                left: '64%',
                right: '6%',
                top: '83.4%',
                borderTop: '1px solid',
                borderColor: 'divider',
              }}
              aria-hidden
            />
            <Box
              sx={{
                position: 'absolute',
                left: '64%',
                right: '6%',
                top: '89.4%',
                borderTop: '2px solid',
                borderColor: 'text.primary',
                opacity: 0.85,
              }}
              aria-hidden
            />

            <Typography
              variant="caption"
              sx={{
                position: 'absolute',
                left: '6%',
                right: '6%',
                bottom: '2.5%',
                color: 'text.disabled',
                textAlign: 'center',
                display: 'block',
              }}
            >
              Sierra Networks Inc. · Reg. 84-2199407 · Terms and conditions available on request
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
                    outline: isSelected ? '2px solid' : '1px solid transparent',
                    outlineColor: isSelected ? 'primary.main' : 'transparent',
                    outlineOffset: isSelected ? 0 : '-1px',
                    backgroundColor: isSelected ? 'primary.subtle' : 'transparent',
                    // The score rides the box, so both arrive together.
                    '& .field-score': { opacity: isSelected ? 1 : 0, transition: 'opacity 120ms' },
                    '&:hover': {
                      outlineColor: isSelected ? 'primary.main' : boxTone(f).line,
                      backgroundColor: isSelected ? 'primary.subtle' : boxTone(f).fill,
                      '& .field-score': { opacity: 1 },
                    },
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                    {f.label}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.3 }}>
                    {f.value}
                  </Typography>
                  {f.confidence !== null && (
                    <Box
                      className="field-score"
                      sx={{
                        position: 'absolute',
                        top: -8,
                        right: 2,
                        px: 0.5,
                        borderRadius: 0.5,
                        fontSize: 9,
                        lineHeight: '14px',
                        color: 'background.paper',
                        backgroundColor: boxTone(f).line,
                      }}
                      aria-hidden
                    >
                      {f.confidence}%
                    </Box>
                  )}
                </Box>
              );
            })}

            {/* Line items */}
            <Box sx={{ position: 'absolute', left: '6%', right: '6%', top: '46%' }}>
              <Stack
                direction="row"
                sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 0.25, px: 0.5, mx: -0.5 }}
              >
                <Typography variant="caption" sx={{ width: 52, fontWeight: 600 }}>
                  Item
                </Typography>
                <Typography variant="caption" sx={{ flex: 1, fontWeight: 600 }}>
                  Description
                </Typography>
                <Typography variant="caption" sx={{ width: 34, textAlign: 'right', fontWeight: 600 }}>
                  Qty
                </Typography>
                <Typography variant="caption" sx={{ width: 62, textAlign: 'right', fontWeight: 600 }}>
                  Unit
                </Typography>
                <Typography variant="caption" sx={{ width: 70, textAlign: 'right', fontWeight: 600 }}>
                  Amount
                </Typography>
              </Stack>
              {invoice.lines.map((l) => (
                <Stack
                  key={l.id}
                  data-line-id={l.id}
                  direction="row"
                  // Lines are read too, and carry a score the same way.
                  sx={{
                    position: 'relative',
                    py: 0.25,
                    px: 0.5,
                    mx: -0.5,
                    borderRadius: 0.5,
                    outline: '1px solid transparent',
                    outlineOffset: '-1px',
                    outlineColor: selectedLineId === l.id ? 'primary.main' : 'transparent',
                    backgroundColor: selectedLineId === l.id ? 'primary.subtle' : undefined,
                    '& .line-score': {
                      opacity: selectedLineId === l.id ? 1 : 0,
                      transition: 'opacity 120ms',
                    },
                    '&:hover': {
                      outlineColor: lineTone(l.confidence).line,
                      backgroundColor: lineTone(l.confidence).fill,
                      '& .line-score': { opacity: 1 },
                    },
                  }}
                >
                  <Typography variant="caption" sx={{ width: 52, color: 'text.secondary' }}>
                    {l.itemNo}
                  </Typography>
                  <Typography variant="caption" sx={{ flex: 1, minWidth: 0 }} noWrap>
                    {l.description}
                  </Typography>
                  <Typography variant="caption" sx={{ width: 34, textAlign: 'right' }}>
                    {l.invoiceQty}
                  </Typography>
                  <Typography variant="caption" sx={{ width: 62, textAlign: 'right' }}>
                    {l.invoiceUnitPrice.toFixed(2)}
                  </Typography>
                  <Typography variant="caption" sx={{ width: 70, textAlign: 'right' }}>
                    {l.invoiceLineTotal.toFixed(2)}
                  </Typography>
                  <Box
                    className="line-score"
                    sx={{
                      position: 'absolute',
                      top: -7,
                      right: 2,
                      px: 0.5,
                      borderRadius: 0.5,
                      fontSize: 9,
                      lineHeight: '14px',
                      color: 'background.paper',
                      backgroundColor: lineTone(l.confidence).line,
                    }}
                    aria-hidden
                  >
                    {l.confidence}%
                  </Box>
                </Stack>
              ))}
            </Box>

            {/* Selected, but not on the page. Saying so beats a click that
                appears to do nothing. */}
            {selected?.inferred && (
              <Box
                onClick={(event) => event.stopPropagation()}
                sx={{
                  position: 'absolute',
                  left: '10%',
                  right: '10%',
                  top: '44%',
                  zIndex: 3,
                  p: 1.5,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'purple.main',
                  backgroundColor: 'background.paper',
                  boxShadow: 3,
                }}
              >
                <Stack sx={{ gap: 0.75 }}>
                  <Stack direction="row" sx={{ gap: 0.75, alignItems: 'center' }}>
                    <Chip size="sm" variant="purple" icon={<SparkleIcon size={12} />} label="Suggested" />
                    <Typography variant="caption" weight="medium">
                      {selected.label} is not on this invoice
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {selected.inferred.because}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Change it in the table if the proposal is wrong.
                  </Typography>
                </Stack>
              </Box>
            )}

            {/* The callout: what was read, and how sure */}
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

                  {/* What the page says, as read. Correcting it happens in the
                      table: this side is the evidence, and evidence is not the
                      thing you edit. */}
                  <Typography variant="body2" weight="medium">
                    {selected.value || '—'}
                  </Typography>

                  {selected.editedFrom !== undefined && (
                    <Typography variant="caption" color="text.secondary">
                      Corrected from “{selected.editedFrom}” in the table
                    </Typography>
                  )}
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
