import * as React from 'react';
import { Box, Button, IconButton, Stack, Tooltip, Typography } from '@neofloai/atoms';
import {
  ClockCounterClockwiseIcon,
  FileTextIcon,
  ListIcon,
  ReadCvLogoIcon,
  SparkleIcon,
} from '@neofloai/atoms/icons';

/** The narrow rail beside a record: data, documents, history. */
export type RecordView = 'data' | 'documents' | 'history';

const VIEWS: { key: RecordView; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'data', label: 'Extracted data', Icon: ReadCvLogoIcon },
  { key: 'documents', label: 'Documents', Icon: FileTextIcon },
  { key: 'history', label: 'History', Icon: ClockCounterClockwiseIcon },
];

const RAIL_PX = 76;

/**
 * The icon rail on a record screen. It switches what you are looking at, not
 * which stage the invoice is in: the stage moves forward on the primary action
 * in the header.
 */
export function RecordViewRail({
  view,
  onChange,
}: {
  view: RecordView;
  onChange: (view: RecordView) => void;
}) {
  return (
    <Stack
      sx={{
        width: RAIL_PX,
        flexShrink: 0,
        alignItems: 'center',
        gap: 1,
        pt: 2,
        borderRight: '1px solid',
        borderColor: 'divider',
      }}
    >
      {VIEWS.map(({ key, label, Icon }) => {
        const selected = view === key;
        return (
          <Tooltip key={key} title={label} placement="right">
            <IconButton
              variant="secondary"
              appearance={selected ? 'outline' : 'text'}
              size="md"
              aria-label={label}
              aria-pressed={selected}
              onClick={() => onChange(key)}
              sx={{
                color: selected ? 'text.primary' : 'text.secondary',
                backgroundColor: selected ? 'action.selected' : 'transparent',
              }}
            >
              <Icon size={20} />
            </IconButton>
          </Tooltip>
        );
      })}
    </Stack>
  );
}

/**
 * The record header: a title, the facts that identify the invoice, and the
 * actions for the stage it is on. Laid out as the product does it, with the
 * primary action last and Reject beside it.
 */
export function RecordHeader({
  title,
  meta,
  onToggleRail,
  onAskNeo,
  onReject,
  primary,
  secondary,
}: {
  title: string;
  meta: { icon: React.ReactNode; label: string }[];
  onToggleRail: () => void;
  onAskNeo?: () => void;
  onReject?: () => void;
  /** Proceed, Validate or Post: whatever moves this stage on. */
  primary?: { label: string; disabled?: boolean; onClick: () => void };
  /** Simulate, on the posting stage. */
  secondary?: { label: string; disabled?: boolean; onClick: () => void };
}) {
  return (
    <Stack
      direction="row"
      sx={{
        px: 2.5,
        py: 1.5,
        gap: 2,
        alignItems: 'flex-start',
        borderBottom: '1px solid',
        borderColor: 'divider',
        flexShrink: 0,
      }}
    >
      <IconButton
        variant="secondary"
        appearance="text"
        size="sm"
        aria-label="Toggle navigation"
        onClick={onToggleRail}
        sx={{ mt: 0.5 }}
      >
        <ListIcon />
      </IconButton>

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
          <Button variant="error" appearance="outline" size="sm" onClick={onReject}>
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
          <Button size="sm" disabled={primary.disabled} onClick={primary.onClick}>
            {primary.label}
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
