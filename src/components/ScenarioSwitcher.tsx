import * as React from 'react';
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@neofloai/atoms';
import {
  ArrowsClockwiseIcon,
  LightningIcon,
  MagnifyingGlassIcon,
  XIcon,
} from '@neofloai/atoms/icons';
import { useStore } from '../store';
import { load as loadPersisted, save as savePersisted } from '../persist';
import { SCENARIOS, SCENARIO_GROUPS, type ScenarioId } from '../scenarios';

/**
 * Jumps the prototype to any named state in one click.
 *
 * A demo aid rather than a product surface, so it deliberately floats over the
 * app instead of taking a place in the navigation. Remove this file, the
 * `applyScenario` block in `store.tsx`, `scenarios.ts`, and the one line in
 * `App.tsx`, and nothing else has to change.
 *
 * Press S to open it, Escape to close.
 */
export function ScenarioSwitcher() {
  const { applyScenario, screen } = useStore();
  // Ask Neo keeps a composer anchored at the bottom, so the trigger steps above
  // it rather than sitting on the send button.
  /**
   * The composer is docked at the bottom of Ask Neo, and it grows: a notice
   * above it wraps to two lines on a narrow window. A fixed offset guessed at
   * one line and covered the notice's own button, so measure the thing instead
   * of assuming its height. A demo aid has no business sitting on a product
   * control.
   */
  const composerDocked = screen === 'ask-neo';
  const [dockedHeight, setDockedHeight] = React.useState(84);
  React.useEffect(() => {
    if (!composerDocked) return;
    const dock = document.querySelector('[data-composer-dock]');
    if (!dock) return;
    const observer = new ResizeObserver(([entry]) =>
      setDockedHeight(Math.round(entry.contentRect.height) + 20),
    );
    observer.observe(dock);
    return () => observer.disconnect();
  }, [composerDocked]);
  const [open, setOpen] = React.useState(false);
  /**
   * Whether the floating trigger is on screen.
   *
   * Off by default. This is a demo aid, and it was turning up in every
   * screenshot taken of the product — a control nobody outside a demo should
   * see, permanently in the corner of the thing being photographed. S opens the
   * panel from anywhere, so nothing is lost by hiding the button, and the switch
   * inside puts it back for anyone who would rather click.
   */
  const [pinned, setPinned] = React.useState(() => loadPersisted<boolean>('scenarioButton', false));
  React.useEffect(() => savePersisted('scenarioButton', pinned), [pinned]);
  const [query, setQuery] = React.useState('');
  const [lastApplied, setLastApplied] = React.useState<ScenarioId | null>(null);
  const searchRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      // Not while someone is typing into the product.
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (typing) return;
      if (event.key === 's' || event.key === 'S') {
        event.preventDefault();
        setOpen((previous) => !previous);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  React.useEffect(() => {
    if (open) {
      const timer = setTimeout(() => searchRef.current?.focus(), 120);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const q = query.trim().toLowerCase();
  const matches = SCENARIOS.filter(
    (scenario) =>
      q === '' ||
      scenario.label.toLowerCase().includes(q) ||
      scenario.detail.toLowerCase().includes(q) ||
      scenario.group.toLowerCase().includes(q),
  );

  const run = (id: ScenarioId) => {
    applyScenario(id);
    setLastApplied(id);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      {/* Floating trigger, off unless asked for. Bottom right, clear of the
          rail and the app bar. */}
      {pinned && !open && (
        <Box
          sx={{
            position: 'fixed',
            bottom: composerDocked ? dockedHeight : 20,
            right: 20,
            zIndex: 1300,
          }}
        >
          <Tooltip title="Demo scenarios (press S)" placement="left">
            <Button
              size="sm"
              startIcon={<LightningIcon size={16} />}
              onClick={() => setOpen(true)}
              sx={{ boxShadow: 3, whiteSpace: 'nowrap' }}
            >
              Scenarios
            </Button>
          </Tooltip>
        </Box>
      )}

      <Drawer anchor="right" size="md" open={open} onClose={() => setOpen(false)}>
        <Stack direction="row" sx={{ px: 3, py: 2, gap: 1.5, alignItems: 'center', flexShrink: 0 }}>
          <LightningIcon size={18} />
          <Stack sx={{ flex: 1, minWidth: 0, gap: 0 }}>
            <Typography variant="body1" weight="medium">
              Demo scenarios
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Each one resets the prototype, then sets up that state
            </Typography>
          </Stack>
          <IconButton
            variant="secondary"
            appearance="text"
            size="sm"
            aria-label="Close the scenario switcher"
            onClick={() => setOpen(false)}
          >
            <XIcon />
          </IconButton>
        </Stack>

        <Box sx={{ px: 3, pb: 2, flexShrink: 0 }}>
          <TextField
            inputRef={searchRef}
            aria-label="Search scenarios"
            placeholder="Search scenarios…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && matches.length > 0) run(matches[0].id);
            }}
            startAdornment={<MagnifyingGlassIcon size={16} />}
            fullWidth
          />
        </Box>

        <Divider />

        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 3, py: 2 }}>
          {matches.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nothing matches “{query}”.
            </Typography>
          ) : (
            <Stack sx={{ gap: 2.5 }}>
              {SCENARIO_GROUPS.filter((group) => matches.some((m) => m.group === group)).map(
                (group) => (
                  <Stack key={group} sx={{ gap: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {group}
                    </Typography>
                    <Stack sx={{ gap: 0.75 }}>
                      {matches
                        .filter((scenario) => scenario.group === group)
                        .map((scenario) => (
                          <Box
                            key={scenario.id}
                            component="button"
                            onClick={() => run(scenario.id)}
                            sx={{
                              textAlign: 'left',
                              cursor: 'pointer',
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 1,
                              backgroundColor: 'transparent',
                              px: 1.5,
                              py: 1.25,
                              font: 'inherit',
                              color: 'inherit',
                              '&:hover': { backgroundColor: 'action.hover' },
                            }}
                          >
                            <Stack sx={{ gap: 0.25 }}>
                              <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                                <Typography variant="body2" weight="medium">
                                  {scenario.label}
                                </Typography>
                                {lastApplied === scenario.id && (
                                  <Chip size="sm" variant="success" label="Showing" />
                                )}
                              </Stack>
                              <Typography variant="caption" color="text.secondary">
                                {scenario.detail}
                              </Typography>
                            </Stack>
                          </Box>
                        ))}
                    </Stack>
                  </Stack>
                ),
              )}
            </Stack>
          )}
        </Box>

        <Divider />

        <Stack sx={{ px: 3, py: 2, gap: 1.5, flexShrink: 0 }}>
          {/* Always here, so getting back does not mean scrolling to find it. */}
          <Button
            variant="secondary"
            appearance="outline"
            size="sm"
            fullWidth
            startIcon={<ArrowsClockwiseIcon size={16} />}
            onClick={() => run('reset')}
          >
            Back to the opening position
          </Button>
          <Stack
            direction="row"
            sx={{ gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
              Show the Scenarios button on screen. Off by default, so it stays out of screenshots.
            </Typography>
            {/* A button rather than a switch: Atoms' Switch omits inputProps,
                so it cannot be given a name, and this one names itself. */}
            <Button
              variant="secondary"
              appearance="outline"
              size="sm"
              onClick={() => setPinned(!pinned)}
              sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              {pinned ? 'Hide it' : 'Show it'}
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Press S to open this from anywhere. Reloading the page does the same as the opening
            position.
          </Typography>
        </Stack>
      </Drawer>
    </>
  );
}
