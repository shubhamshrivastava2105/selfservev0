import * as React from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useColorScheme,
} from '@neofloai/atoms';
import {
  DatabaseIcon,
  MoonIcon,
  SealCheckIcon,
  SunIcon,
  WarningIcon,
} from '@neofloai/atoms/icons';
import type { ChipVariant } from '@neofloai/atoms';
import type { InvoiceStatus } from '../types';

/* ── Color scheme ────────────────────────────────────────────────────── */

export function ColorModeToggle() {
  const { mode, setMode } = useColorScheme();

  // Undefined on the first render, before the provider has read the stored
  // preference. Render the space, not a guess, or the icon flips after mount.
  if (!mode) {
    return <IconButton aria-label="Color scheme" disabled sx={{ visibility: 'hidden' }} />;
  }

  return (
    <Tooltip title={mode === 'dark' ? 'Switch to light' : 'Switch to dark'}>
      <IconButton
        variant="secondary"
        appearance="text"
        size="sm"
        aria-label={mode === 'dark' ? 'Switch to light' : 'Switch to dark'}
        onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
      >
        {mode === 'dark' ? <SunIcon /> : <MoonIcon />}
      </IconButton>
    </Tooltip>
  );
}

/* ── Status ───────────────────────────────────────────────────────────── */

/**
 * A color per stage, as the product distinguishes them: extraction blue,
 * matching purple, posting indigo, attention amber. Blue appears again on
 * Exported, which only ever shows in the Closed tab where extraction cannot.
 */
const STATUS_VARIANT: Record<InvoiceStatus, ChipVariant> = {
  Extraction: 'information',
  Matching: 'purple',
  'ERP posting': 'primary',
  'Action Required': 'warning',
  Posted: 'success',
  Exported: 'information',
  Rejected: 'error',
};

export function StatusChip({ status }: { status: InvoiceStatus }) {
  return <Chip size="sm" variant={STATUS_VARIANT[status]} label={status} />;
}

/* ── Confidence ───────────────────────────────────────────────────────── */

export type ConfidenceTone = 'ground-truth' | 'clear' | 'amber' | 'red';

export function confidenceTone(confidence: number | null, threshold: number): ConfidenceTone {
  if (confidence === null) return 'ground-truth';
  if (confidence >= threshold) return 'clear';
  return confidence >= threshold - 15 ? 'amber' : 'red';
}

/**
 * The confidence score is shown on the field itself, not only as a color
 * (Workflow PRD §4).
 */
export function ConfidenceBadge({
  confidence,
  threshold,
}: {
  confidence: number | null;
  threshold: number;
}) {
  const tone = confidenceTone(confidence, threshold);

  if (tone === 'ground-truth') {
    return (
      <Tooltip title="Structured record from Zoho. Ground truth — no confidence score, nothing to check.">
        <Chip size="sm" variant="information" icon={<DatabaseIcon size={12} />} label="From Zoho" />
      </Tooltip>
    );
  }
  if (tone === 'clear') {
    return (
      <Chip
        size="sm"
        variant="success"
        icon={<SealCheckIcon size={12} />}
        label={`${confidence}%`}
      />
    );
  }
  return (
    <Chip
      size="sm"
      variant={tone === 'amber' ? 'warning' : 'error'}
      icon={<WarningIcon size={12} />}
      label={`${confidence}%`}
    />
  );
}

/* ── Layout helpers ───────────────────────────────────────────────────── */

/** The scrolling body of a screen inside the shell. */
export function PageBody({ children, maxWidth }: { children: React.ReactNode; maxWidth?: number }) {
  return (
    <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <Box sx={{ px: 3, py: 3, maxWidth, mx: maxWidth ? 'auto' : undefined }}>{children}</Box>
    </Box>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card component="section">
      <CardContent>
        <Stack direction="row" sx={{ gap: 2, alignItems: 'flex-start', mb: 2 }}>
          <Stack sx={{ flex: 1, minWidth: 0, gap: 0.25 }}>
            <Typography variant="h6" component="h2">
              {title}
            </Typography>
            {description && (
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            )}
          </Stack>
          {action}
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Stack
      sx={{
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        py: 8,
        px: 3,
        textAlign: 'center',
      }}
    >
      <Box sx={{ color: 'text.secondary', mb: 1 }}>{icon}</Box>
      <Typography variant="h6" component="p">
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460 }}>
        {description}
      </Typography>
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Stack>
  );
}

/** The red asterisk the ERP puts against a field it will not accept empty. */
export function Required() {
  return (
    <Box component="span" sx={{ color: 'error.main', ml: 0.25 }} aria-hidden>
      *
    </Box>
  );
}
