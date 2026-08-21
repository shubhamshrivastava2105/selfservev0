import * as React from 'react';

/**
 * Shared layout breakpoints.
 *
 * These live apart from the shell so the shell and the panel it renders can both
 * use them without importing each other. That cycle broke module initialisation
 * once already.
 */

/** Below this there is not room for the page and a docked panel side by side. */
export const SIDE_BY_SIDE_PX = 1200;

/** Below this, a 220px nav rail takes too much of the content column. */
export const RAIL_AUTO_COLLAPSE_PX = 1024;

/**
 * Watches a width breakpoint. A hidden or not-yet-laid-out viewport reports 0,
 * which is treated as "no information" rather than "narrow": the resize listener
 * corrects it once the pane actually lays out.
 */
function useWidthAtLeast(px: number, unknownDefault: boolean): boolean {
  const [matches, setMatches] = React.useState(() =>
    window.innerWidth === 0 ? unknownDefault : window.innerWidth >= px,
  );

  React.useEffect(() => {
    const sync = () => {
      const width = window.innerWidth;
      if (width === 0) return;
      setMatches(width >= px);
    };
    const query = window.matchMedia(`(min-width: ${px}px)`);
    query.addEventListener('change', sync);
    window.addEventListener('resize', sync);
    sync();
    return () => {
      query.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
    };
  }, [px]);

  return matches;
}

/** True where a docked panel can sit beside the page rather than over it. */
export function useSideBySide(): boolean {
  return useWidthAtLeast(SIDE_BY_SIDE_PX, true);
}

/** True where the nav rail has room for its labels. */
export function useRailHasRoom(): boolean {
  return useWidthAtLeast(RAIL_AUTO_COLLAPSE_PX, true);
}
