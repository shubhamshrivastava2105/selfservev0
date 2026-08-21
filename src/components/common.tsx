import * as React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useColorScheme,
} from '@neofloai/atoms';
import {
  CheckIcon,
  DatabaseIcon,
  EnvelopeSimpleIcon,
  MoonIcon,
  SealCheckIcon,
  SparkleIcon,
  SunIcon,
  UploadSimpleIcon,
  WarningIcon,
} from '@neofloai/atoms/icons';
import type { ChipVariant } from '@neofloai/atoms';
import type { ExtractedField, InvoiceStatus, SourceKind } from '../types';

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
 * A colour per stage, as the product distinguishes them: extraction blue,
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

const SOURCE_ICON: Record<SourceKind, React.ReactNode> = {
  Upload: <UploadSimpleIcon size={12} />,
  Mailbox: <EnvelopeSimpleIcon size={12} />,
  Sample: <SparkleIcon size={12} />,
};

export function SourceChip({ kind }: { kind: SourceKind }) {
  return <Chip size="sm" variant="secondary" icon={SOURCE_ICON[kind] as React.ReactElement} label={kind} />;
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

/**
 * One extracted value: editable, with its confidence beside it, and an
 * acknowledge action while it sits below the threshold.
 */
export function ConfidenceFieldRow({
  field,
  threshold,
  onEdit,
  onAcknowledge,
  readOnly = false,
}: {
  field: ExtractedField;
  threshold: number;
  onEdit: (value: string) => void;
  onAcknowledge: () => void;
  readOnly?: boolean;
}) {
  const [draft, setDraft] = React.useState(field.value);
  React.useEffect(() => setDraft(field.value), [field.value]);

  const tone = confidenceTone(field.confidence, threshold);
  const needsUser = (tone === 'amber' || tone === 'red') && !field.acknowledged;

  const commit = () => {
    if (draft !== field.value) onEdit(draft);
  };

  return (
    <Stack
      direction="row"
      sx={{
        gap: 2,
        alignItems: 'flex-start',
        px: 2,
        py: 1.5,
        borderRadius: 1,
        backgroundColor: needsUser
          ? tone === 'red'
            ? 'error.subtle'
            : 'warning.subtle'
          : 'transparent',
      }}
    >
      <Stack sx={{ width: 180, flexShrink: 0, gap: 0.25, pt: 1 }}>
        <Typography variant="body2" weight="medium">
          {field.label}
          {field.mandatory && (
            <Typography component="span" variant="body2" color="error.main">
              {' '}
              *
            </Typography>
          )}
        </Typography>
        {field.editedFrom !== undefined && (
          <Typography variant="caption" color="text.secondary">
            was “{field.editedFrom}”
          </Typography>
        )}
      </Stack>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <TextField
          aria-label={field.label}
          value={draft}
          disabled={readOnly}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
          }}
          status={needsUser ? (tone === 'red' ? 'error' : 'warning') : undefined}
          helperText={
            needsUser
              ? 'Below the confidence threshold. Correct it, or acknowledge it as read.'
              : undefined
          }
          fullWidth
        />
      </Box>

      <Stack direction="row" sx={{ gap: 1, alignItems: 'center', pt: 1, flexShrink: 0 }}>
        <ConfidenceBadge confidence={field.confidence} threshold={threshold} />
        {needsUser && !readOnly && (
          <Button variant="secondary" appearance="outline" size="sm" onClick={onAcknowledge}>
            Acknowledge
          </Button>
        )}
        {field.acknowledged && tone !== 'clear' && tone !== 'ground-truth' && (
          <Chip size="sm" variant="success" icon={<CheckIcon size={12} />} label="Acknowledged" />
        )}
      </Stack>
    </Stack>
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

/** A labelled fact, for the read-only panels. */
export function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack sx={{ gap: 0.25, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      {/* A div, not the variant's default p: callers pass element values
          (a Stack with a confidence figure beside the number), and a div
          inside a p is invalid HTML. */}
      <Typography variant="body2" weight="medium" component="div">
        {value}
      </Typography>
    </Stack>
  );
}
