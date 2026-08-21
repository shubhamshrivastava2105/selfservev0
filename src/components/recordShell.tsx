import * as React from 'react';
import { Box, Button, IconButton, Stack, Tooltip, Typography } from '@neofloai/atoms';
import { ColorModeToggle } from './common';
import { useShell } from './shell';
import {
  ArrowRightIcon,
  ClockCounterClockwiseIcon,
  SidebarSimpleIcon,
  SparkleIcon,
} from '@neofloai/atoms/icons';

/**
 * The record header: a title, the facts that identify the invoice, and the
 * actions for the stage it is on. Laid out as the product does it, with the
 * primary action last and Reject beside it.
 */
export function RecordHeader({
  title,
  meta,
  onShowHistory,
  historyActive,
  onAskNeo,
  onReject,
  rejectDisabled,
  primary,
  secondary,
}: {
  title: string;
  meta: { icon: React.ReactNode; label: string }[];
  /** The audit trail, which the PRD requires reachable on every record. */
  onShowHistory: () => void;
  historyActive: boolean;
  onAskNeo?: () => void;
  onReject?: () => void;
  /** Proceed or Validate: whatever moves this stage on. Carries a trailing arrow. */
  primary?: { label: string; disabled?: boolean; onClick: () => void };
  /** Reject shows disabled rather than vanishing once a record is closed. */
  rejectDisabled?: boolean;
  /** Simulate, on the posting stage. */
  secondary?: { label: string; disabled?: boolean; onClick: () => void };
}) {
  const { collapsed, toggleCollapsed } = useShell();
  return (
    <Stack
      direction="row"
      sx={{
        px: 2.5,
        py: 1.5,
        gap: 1.5,
        alignItems: 'center',
        borderBottom: '1px solid',
        borderColor: 'divider',
        flexShrink: 0,
      }}
    >
      {/* This header replaces the app bar, so the rail's own control has to be
          here too — otherwise opening an invoice is a one-way door into a
          collapsed rail. The product puts it in the same corner. */}
      <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        <IconButton
          variant="secondary"
          appearance="text"
          size="sm"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={toggleCollapsed}
        >
          <SidebarSimpleIcon />
        </IconButton>
      </Tooltip>

      <Stack sx={{ flex: 1, minWidth: 0, gap: 0.25 }}>
        <Typography variant="h5" component="h1">
          {title}
        </Typography>
        <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          {meta.map((item, index) => (
            <React.Fragment key={item.label}>
              {index > 0 && (
                <Box sx={{ width: '1px', height: 14, backgroundColor: 'divider' }} aria-hidden />
              )}
              <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center', color: 'text.secondary' }}>
                {item.icon}
                <Typography variant="body2" color="text.secondary" noWrap>
                  {item.label}
                </Typography>
              </Stack>
            </React.Fragment>
          ))}
        </Stack>
      </Stack>

      <Stack
        direction="row"
        sx={{ gap: 1.5, alignItems: 'center', flexShrink: 0, '& .MuiButton-root': { whiteSpace: 'nowrap' } }}
      >
        {/* A record screen replaces the app bar, so without this the theme
            switch would vanish on the three stage screens — and a demo left in
            dark mode could not get back. */}
        <ColorModeToggle />

        <Tooltip title={historyActive ? 'Back to the stage' : 'History'}>
          <IconButton
            variant="secondary"
            appearance={historyActive ? 'outline' : 'text'}
            size="sm"
            aria-label={historyActive ? 'Back to the stage' : 'History'}
            aria-pressed={historyActive}
            onClick={onShowHistory}
          >
            <ClockCounterClockwiseIcon />
          </IconButton>
        </Tooltip>
        {onAskNeo && (
          <Button
            variant="primary"
            appearance="outline"
            size="sm"
            startIcon={<SparkleIcon size={16} />}
            onClick={onAskNeo}
          >
            Ask Neo
          </Button>
        )}
        {onReject && (
          <Button
            variant="error"
            appearance="outline"
            size="sm"
            disabled={rejectDisabled}
            onClick={onReject}
            // Tinted rather than a plain outline, which is how the product
            // weights a destructive action next to the primary one.
            sx={{ backgroundColor: rejectDisabled ? undefined : 'error.subtle' }}
          >
            Reject
          </Button>
        )}
        {secondary && (
          <Button
            variant="secondary"
            appearance="outline"
            size="sm"
            disabled={secondary.disabled}
            onClick={secondary.onClick}
          >
            {secondary.label}
          </Button>
        )}
        {primary && (
          <Button
            size="sm"
            endIcon={<ArrowRightIcon size={16} />}
            disabled={primary.disabled}
            onClick={primary.onClick}
          >
            {primary.label}
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
