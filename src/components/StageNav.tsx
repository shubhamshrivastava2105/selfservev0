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
 *
 * Two states can be true at once and are drawn differently: the stage you are
 * reading carries a fill, and the stage the invoice is actually on carries a
 * ring. Usually they are the same stage and you see one thing.
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
        /**
         * Where the invoice actually is, when you are looking at an earlier
         * stage. The reading and the record are two different facts and the nav
         * is the place that already holds both — a banner explaining it was one
         * more thing to read.
         */
        const isCurrent = stage === reached;

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
                  fontWeight: active || isCurrent ? 600 : 400,
                  color: active || isCurrent ? 'text.primary' : 'text.secondary',
                  backgroundColor: active ? 'action.selected' : undefined,
                  // A ring rather than a fill: the fill means "you are reading
                  // this", the ring means "the invoice is here".
                  boxShadow: isCurrent && !active ? (theme) => `inset 0 0 0 1px ${theme.palette.divider}` : undefined,
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
