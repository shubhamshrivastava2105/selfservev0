import * as React from 'react';
import { Box, IconButton, Stack, Tooltip, Typography } from '@neofloai/atoms';
import {
  ArrowCounterClockwiseIcon,
  ArrowClockwiseIcon,
  CaretLeftIcon,
  CaretRightIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
} from '@neofloai/atoms/icons';
import type { Invoice } from '../../types';

/**
 * The source document beside its extracted values, with the viewer controls the
 * product carries: zoom, rotate, and page navigation.
 *
 * The page itself is drawn rather than rendered, because there is no real PDF
 * behind this. Everything around it behaves.
 */
export function DocumentPane({ invoice, pages = 6 }: { invoice: Invoice; pages?: number }) {
  const [zoom, setZoom] = React.useState(100);
  const [rotation, setRotation] = React.useState(0);
  const [page, setPage] = React.useState(1);

  return (
    <Stack sx={{ flex: 1, minWidth: 0, borderRight: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 3, backgroundColor: 'action.hover' }}>
        <Box
          sx={{
            width: `${Math.min(zoom, 160)}%`,
            maxWidth: 720,
            mx: 'auto',
            transform: `rotate(${rotation}deg)`,
            transformOrigin: 'top center',
            transition: 'transform 150ms',
            backgroundColor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            p: 3,
            minHeight: 520,
          }}
        >
          {/* A drawn facsimile of the invoice, laid out like the real page. */}
          <Stack sx={{ gap: 2 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Stack sx={{ gap: 0.25 }}>
                <Typography variant="body2" weight="semibold">
                  {invoice.vendor.toUpperCase()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {invoice.invoiceFields.find((f) => f.key === 'vendorCode')?.value}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Page {page} of {pages}
              </Typography>
            </Stack>

            <Typography variant="body2" weight="semibold" align="center">
              INVOICE
            </Typography>

            <Stack direction="row" sx={{ gap: 3, flexWrap: 'wrap' }}>
              {['number', 'date', 'dueDate', 'po'].map((key) => {
                const f = invoice.invoiceFields.find((x) => x.key === key);
                if (!f) return null;
                return (
                  <Stack key={key} sx={{ gap: 0 }}>
                    <Typography variant="caption" color="text.secondary">
                      {f.label}
                    </Typography>
                    <Typography variant="caption">{f.value}</Typography>
                  </Stack>
                );
              })}
            </Stack>

            <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1.5 }}>
              {invoice.lines.map((l) => (
                <Stack
                  key={l.id}
                  direction="row"
                  sx={{ gap: 2, justifyContent: 'space-between', py: 0.5 }}
                >
                  <Typography variant="caption" sx={{ flex: 1, minWidth: 0 }} noWrap>
                    {l.itemNo} · {l.description}
                  </Typography>
                  <Typography variant="caption">{l.invoiceQty}</Typography>
                  <Typography variant="caption" sx={{ width: 72, textAlign: 'right' }}>
                    {l.invoiceLineTotal.toFixed(2)}
                  </Typography>
                </Stack>
              ))}
            </Box>
          </Stack>
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
            {page} <Box component="span" sx={{ color: 'text.secondary' }}>of {pages}</Box>
          </Typography>
          <IconButton
            variant="secondary"
            appearance="text"
            size="sm"
            aria-label="Next page"
            disabled={page === pages}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
          >
            <CaretRightIcon />
          </IconButton>
        </Stack>
      </Stack>
    </Stack>
  );
}
