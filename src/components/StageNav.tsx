import * as React from 'react';
import { Box, Button, Stack, Typography } from '@neofloai/atoms';
import { CaretRightIcon, CheckIcon } from '@neofloai/atoms/icons';
import type { Stage } from '../types';

export const STAGE_ORDER: Stage[] = ['extraction', 'matching', 'posting'];

export const STAGE_LABEL: Record<Stage, string> = {
  extraction: 'Extraction',
  matching: 'Matching',
  posting: 'ERP Posting',
};

/**
 * The three stages, with the ones already passed reachable again.
 *
 * A record only ever moves forward, so going back is a read: the invoice keeps
 * the stage it earned and this just changes which view is on screen. A stage
 * ahead of the record is not offered, because nothing has happened there yet.
 */
export function StageNav({
  reached,
  viewing,
  onView,
}: {
  /** The stage the record has actually reached. */
  reached: Stage;
  /** The stage on screen, which may be an earlier one. */
  viewing: Stage;
  onView: (stage: Stage) => void;
}) {
  const reachedIndex = STAGE_ORDER.indexOf(reached);

  return (
    <Stack direction="row" sx={{ gap: 0.25, alignItems: 'center' }} aria-label="Stages">
      {STAGE_ORDER.map((stage, index) => {
        const passed = index < reachedIndex;
        const available = index <= reachedIndex;
        const active = stage === viewing;

        return (
          <React.Fragment key={stage}>
            {index > 0 && (
              <CaretRightIcon size={12} color="var(--mui-palette-text-disabled)" aria-hidden />
            )}
            {available ? (
              <Button
                variant="secondary"
                appearance="text"
                size="sm"
                aria-current={active ? 'step' : undefined}
                startIcon={passed ? <CheckIcon size={12} /> : undefined}
                onClick={() => onView(stage)}
                sx={{
                  textTransform: 'none',
                  fontWeight: active ? 600 : 400,
                  color: active ? 'text.primary' : 'text.secondary',
                  backgroundColor: active ? 'action.selected' : undefined,
                }}
              >
                {STAGE_LABEL[stage]}
              </Button>
            ) : (
              // Not yet reached, so there is nothing to look at.
              <Box sx={{ px: 1.25 }}>
                <Typography variant="body2" color="text.disabled">
                  {STAGE_LABEL[stage]}
                </Typography>
              </Box>
            )}
          </React.Fragment>
        );
      })}
    </Stack>
  );
}
