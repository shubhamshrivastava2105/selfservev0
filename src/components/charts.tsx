import * as React from 'react';
import {
  Box,
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@neofloai/atoms';
import { ArrowDownIcon, ArrowUpIcon } from '@neofloai/atoms/icons';

/**
 * The chart pieces reporting is built from.
 *
 * Hand-drawn SVG rather than a charting library: the constraint everywhere else
 * in this prototype is to import only from Atoms, and Atoms has no charts. Every
 * color comes from a theme token, so dark mode is the design system's own chosen
 * step rather than an inverted light one.
 *
 * The specs are fixed and shared: bars cap at 24px with a 4px rounded data-end
 * and a square baseline, lines are 2px, end markers are 8px with a 2px surface
 * ring, gridlines are hairline and recessive, and touching marks are separated
 * by 2px of surface rather than a stroke.
 */

const BAR_MAX = 24;
const GAP = 2;

/**
 * Colors as the design system's own variables rather than resolved values.
 *
 * Atoms exposes no theme hook, and reading a hex would freeze one mode into the
 * markup. A variable is whatever the active scheme says it is, so dark mode gets
 * the step the system chose for dark rather than an inversion of light.
 */
const ink = {
  accent: 'var(--mui-palette-primary-main)',
  accentLight: 'var(--mui-palette-primary-light)',
  /**
   * The second step of the accent, whichever direction has room.
   *
   * Validated against both surfaces: primary.dark carries 2.22:1 on the dark
   * paper, which is not a line anyone can follow, while primary.light clears 3:1
   * on it. So the step goes darker on light and lighter on dark — a chosen pair
   * per mode rather than one pair inverted. Set as a custom property below.
   */
  accentPair: 'var(--chart-accent-pair)',
  success: 'var(--mui-palette-success-main)',
  warning: 'var(--mui-palette-warning-main)',
  error: 'var(--mui-palette-error-main)',
  grid: 'var(--mui-palette-divider)',
  label: 'var(--mui-palette-text-secondary)',
  recede: 'var(--mui-palette-text-disabled)',
  surface: 'var(--mui-palette-background-paper)',
} as const;

/**
 * Declares the mode-aware steps. Spread onto any chart container so the property
 * resolves; Atoms marks dark mode with data-dark on the document element.
 */
export const chartTokens = {
  '--chart-accent-pair': 'var(--mui-palette-primary-dark)',
  '[data-dark] &': { '--chart-accent-pair': 'var(--mui-palette-primary-light)' },
} as const;

/* ── Numbers ──────────────────────────────────────────────────────────── */

/** A duration, in the largest unit that still reads precisely. */
export function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/* ── Stat tile ────────────────────────────────────────────────────────── */

/**
 * A single figure. Deliberately not a one-bar chart: one number wants to be
 * read, not measured against an axis.
 */
export function StatTile({
  label,
  hint,
  value,
  delta,
  footnote,
  hero,
}: {
  label: string;
  hint?: string;
  value: string;
  /** Change against the prior period. Null where there is nothing to compare. */
  delta?: { changePercent: number | null; better: 'up' | 'down' } | null;
  footnote?: string;
  hero?: boolean;
}) {
  const change = delta?.changePercent ?? null;
  const rising = change !== null && change > 0;
  // Whether a rise is good depends on the metric, so the caller says.
  const good = change === null || change === 0 ? null : rising === (delta?.better === 'up');

  return (
    <Stack
      sx={{
        gap: 0.5,
        p: 2,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        height: '100%',
      }}
    >
      <Tooltip title={hint ?? ''} placement="top">
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ cursor: hint ? 'help' : undefined, alignSelf: 'flex-start' }}
        >
          {label}
        </Typography>
      </Tooltip>
      <Typography variant={hero ? 'h3' : 'h5'}>{value}</Typography>
      {change !== null && change === 0 && (
        <Typography variant="caption" color="text.secondary">
          Unchanged from the prior period
        </Typography>
      )}
      {change !== null && change !== 0 && (
        <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center' }}>
          {rising ? <ArrowUpIcon size={12} /> : <ArrowDownIcon size={12} />}
          <Typography variant="caption" color={good ? 'success.main' : 'error.main'}>
            {Math.abs(change)}% vs prior period
          </Typography>
        </Stack>
      )}
      {footnote && (
        <Typography variant="caption" color="text.secondary">
          {footnote}
        </Typography>
      )}
    </Stack>
  );
}

/* ── Meter ────────────────────────────────────────────────────────────── */

/** A single ratio against a limit — a track and a fill, not a two-slice pie. */
export function Meter({
  value,
  max,
  caption,
  tone = 'primary',
}: {
  value: number;
  max: number;
  caption: string;
  tone?: 'primary' | 'success' | 'warning';
}) {
  const share = max <= 0 ? 0 : Math.min(1, value / max);
  return (
    <Stack sx={{ gap: 0.75 }}>
      <Box
        sx={{
          height: 8,
          borderRadius: 999,
          backgroundColor: 'divider',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            width: `${share * 100}%`,
            height: '100%',
            borderRadius: 999,
            backgroundColor: `${tone}.main`,
            transition: 'width 240ms ease',
          }}
        />
      </Box>
      <Typography variant="caption" color="text.secondary">
        {caption}
      </Typography>
    </Stack>
  );
}

/* ── Horizontal bars ──────────────────────────────────────────────────── */

export interface BarDatum {
  label: string;
  value: number;
  /** Printed at the bar's tip. Defaults to the value. */
  display?: string;
  /** A status reading, which always ships with its own text label. */
  status?: { tone: 'success' | 'warning' | 'error'; label: string };
}

/**
 * Magnitude, low to high, one hue.
 *
 * Horizontal because the categories are words — a stage name or a rejection
 * reason has nowhere to go under a vertical axis.
 */
export function BarList({
  data,
  emptyMessage,
  labelWidth = 132,
  max,
}: {
  data: BarDatum[];
  emptyMessage: string;
  labelWidth?: number;
  /** Fixed ceiling, for a percentage axis. Defaults to the largest value. */
  max?: number;
}) {
  if (data.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyMessage}
      </Typography>
    );
  }
  const ceiling = max ?? Math.max(...data.map((d) => d.value), 1);

  return (
    <Stack sx={{ gap: 1 }}>
      {data.map((d) => {
        const share = ceiling <= 0 ? 0 : Math.max(0, Math.min(1, d.value / ceiling));
        const fill = d.status ? ink[d.status.tone] : ink.accent;
        return (
          <Stack key={d.label} direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ width: labelWidth, flexShrink: 0 }}
              noWrap
              title={d.label}
            >
              {d.label}
            </Typography>
            <Box sx={{ flex: 1, minWidth: 0, height: BAR_MAX, position: 'relative' }}>
              {/* The track is a hairline baseline, not a filled slot: the bar's
                  own leftover is air. */}
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
                aria-hidden
              />
              <Box
                sx={{
                  position: 'absolute',
                  left: 0,
                  bottom: 0,
                  top: 0,
                  width: `${share * 100}%`,
                  minWidth: d.value > 0 ? 3 : 0,
                  backgroundColor: fill,
                  // Rounded where the data ends, square where it starts.
                  borderRadius: '0 4px 4px 0',
                }}
              />
            </Box>
            <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexShrink: 0 }}>
              <Typography
                variant="body2"
                sx={{ fontVariantNumeric: 'tabular-nums', minWidth: 44, textAlign: 'right' }}
              >
                {d.display ?? d.value.toLocaleString('en-US')}
              </Typography>
              {/* Status never travels as color alone. */}
              {d.status && <Chip size="sm" variant={d.status.tone} label={d.status.label} />}
            </Stack>
          </Stack>
        );
      })}
    </Stack>
  );
}

/* ── Stacked share bar ────────────────────────────────────────────────── */

/**
 * Part to whole, in one horizontal bar. Segments are separated by 2px of
 * surface rather than a stroke, and each is named in the legend beneath.
 */
export function ShareBar({
  data,
  emptyMessage,
}: {
  data: { label: string; count: number; percent: number }[];
  emptyMessage: string;
}) {
  if (data.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyMessage}
      </Typography>
    );
  }
  // One hue, stepped: these are shares of one measure, not rival series.
  const steps = [ink.accent, ink.accentPair, ink.recede];

  return (
    <Stack sx={{ gap: 1.5, ...chartTokens }}>
      <Stack direction="row" sx={{ height: 16, gap: `${GAP}px` }}>
        {data.map((d, index) => (
          <Tooltip key={d.label} title={`${d.label}: ${d.count} (${d.percent.toFixed(0)}%)`}>
            <Box
              sx={{
                width: `${d.percent}%`,
                minWidth: 4,
                backgroundColor: steps[index % steps.length],
                borderRadius: index === 0 ? '4px 0 0 4px' : index === data.length - 1 ? '0 4px 4px 0' : 0,
              }}
            />
          </Tooltip>
        ))}
      </Stack>
      <Stack sx={{ gap: 0.5 }}>
        {data.map((d, index) => (
          <Stack key={d.label} direction="row" sx={{ gap: 1, alignItems: 'center' }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: 0.5,
                flexShrink: 0,
                backgroundColor: steps[index % steps.length],
              }}
              aria-hidden
            />
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }} noWrap>
              {d.label}
            </Typography>
            <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {d.count}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ width: 44, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
            >
              {d.percent.toFixed(0)}%
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}

/* ── Line chart ───────────────────────────────────────────────────────── */

export interface Series {
  key: string;
  label: string;
  /** Null where there is no figure for that point, which is not zero. */
  points: (number | null)[];
  /** 'accent' carries the story, 'context' recedes, 'pair' is the second step. */
  role: 'accent' | 'context' | 'pair';
  /** Printed on the axis and in the tooltip. */
  format: (value: number) => string;
}

/**
 * Two series at most, over time.
 *
 * One y-scale, always: two measures of different size get two charts. Where the
 * story is "this one moved", the other series recedes to gray rather than
 * competing for a hue.
 */
export function LineChart({
  labels,
  series,
  reference,
  height = 180,
  emptyMessage,
  tableLabel = 'Period',
}: {
  labels: string[];
  series: Series[];
  /** A target or baseline to read against, drawn behind the data. */
  reference?: { value: number; label: string };
  height?: number;
  emptyMessage: string;
  /** The heading over the period column in the table twin. */
  tableLabel?: string;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  /**
   * A table twin. Hover is an enhancement, never the only way to read a figure —
   * so every point stays reachable without a pointer.
   */
  const [asTable, setAsTable] = React.useState(false);
  /**
   * Drawn in real pixels, measured from the container.
   *
   * A percentage viewBox with preserveAspectRatio="none" scales the glyphs with
   * the box, so the axis labels come out stretched several times wide. There is
   * no font size that survives that — the geometry has to be honest instead.
   */
  const box = React.useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = React.useState(560);
  React.useEffect(() => {
    const node = box.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const everything = series.flatMap((s) => s.points).filter((v): v is number => v !== null);
  if (everything.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyMessage}
      </Typography>
    );
  }

  const ceiling = Math.max(...everything, reference?.value ?? 0);
  const top = ceiling === 0 ? 1 : ceiling * 1.15;
  const padLeft = 46;
  const padRight = 16;
  const padTop = 10;
  const padBottom = 24;
  const plotW = Math.max(40, width - padLeft - padRight);

  const x = (index: number) =>
    labels.length <= 1
      ? padLeft + plotW / 2
      : padLeft + (index / (labels.length - 1)) * plotW;
  const y = (value: number) => padTop + (1 - value / top) * (height - padTop - padBottom);

  const colorFor = (role: Series['role']) =>
    role === 'accent' ? ink.accent : role === 'pair' ? ink.accentPair : ink.recede;

  const ticks = [0, top / 2, top];

  if (asTable) {
    return (
      <Stack sx={{ gap: 1 }}>
        <Box>
          <Button
            variant="secondary"
            appearance="text"
            size="sm"
            onClick={() => setAsTable(false)}
            sx={{ textTransform: 'none' }}
          >
            Show the chart
          </Button>
        </Box>
        <TableContainer>
          <Table size="sm">
            <TableHead>
              <TableRow>
                <TableCell>{tableLabel}</TableCell>
                {series.map((sr) => (
                  <TableCell key={sr.key} align="right">
                    {sr.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {labels.map((label, index) => (
                <TableRow key={label + index}>
                  <TableCell>{label}</TableCell>
                  {series.map((sr) => (
                    <TableCell
                      key={sr.key}
                      align="right"
                      sx={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {sr.points[index] === null
                        ? '—'
                        : sr.format(sr.points[index] as number)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    );
  }

  return (
    <Stack sx={{ gap: 1, ...chartTokens }}>
      <Box ref={box} sx={{ width: '100%' }}>
      <Box
        component="svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        sx={{ display: 'block', overflow: 'visible' }}
        role="img"
        aria-label={`${series.map((s) => s.label).join(' and ')} over ${labels.length} days`}
        onMouseLeave={() => setHover(null)}
      >
        {/* Gridlines: hairline, solid, one step off the surface. */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={y(tick)}
              y2={y(tick)}
              stroke={ink.grid}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <text x={0} y={y(tick) + 3} fill={ink.label} style={{ fontSize: 10 }}>
              {series[0].format(tick)}
            </text>
          </g>
        ))}

        {reference && (
          <>
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={y(reference.value)}
              y2={y(reference.value)}
              stroke={ink.recede}
              strokeWidth={1}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={width - padRight}
              y={y(reference.value) - 4}
              textAnchor="end"
              fill={ink.label}
              style={{ fontSize: 10 }}
            >
              {reference.label}
            </text>
          </>
        )}

        {series.map((s) => {
          const drawn = s.points
            .map((value, index) => (value === null ? null : `${x(index)},${y(value)}`))
            .filter((p): p is string => p !== null)
            .join(' ');
          return (
            <polyline
              key={s.key}
              points={drawn}
              fill="none"
              stroke={colorFor(s.role)}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {/* End markers, ringed in the surface color so they stay legible where
            the two lines cross. */}
        {series.map((s) => {
          const lastIndex = [...s.points].reverse().findIndex((v) => v !== null);
          if (lastIndex === -1) return null;
          const index = s.points.length - 1 - lastIndex;
          const value = s.points[index] as number;
          return (
            <circle
              key={`${s.key}-end`}
              cx={x(index)}
              cy={y(value)}
              r={4}
              fill={colorFor(s.role)}
              stroke={ink.surface}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {/* A hit column per point, wider than the mark it selects. */}
        {labels.map((label, index) => (
          <rect
            key={label + index}
            x={x(index) - plotW / Math.max(1, labels.length * 2)}
            y={0}
            width={plotW / Math.max(1, labels.length)}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHover(index)}
          />
        ))}

        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={padTop}
            y2={height - padBottom}
            stroke={ink.recede}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}

        <text
          x={padLeft}
          y={height - 4}
          fill={ink.label}
          style={{ fontSize: 10 }}
        >
          {labels[0]}
        </text>
        {labels.length > 1 && (
          <text
            x={width - padRight}
            y={height - 4}
            textAnchor="end"
            fill={ink.label}
            style={{ fontSize: 10 }}
          >
            {labels[labels.length - 1]}
          </text>
        )}
      </Box>
      </Box>

      <Stack direction="row" sx={{ gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
      {/* A legend for two or more series, always. */}
      {series.length > 1 && (
        <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap' }}>
          {series.map((s) => (
            <Stack key={s.key} direction="row" sx={{ gap: 0.75, alignItems: 'center' }}>
              <Box
                sx={{ width: 12, height: 2, borderRadius: 999, backgroundColor: colorFor(s.role) }}
                aria-hidden
              />
              <Typography variant="caption" color="text.secondary">
                {s.label}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
        <Box sx={{ flex: 1 }} />
        <Button
          variant="secondary"
          appearance="text"
          size="sm"
          onClick={() => setAsTable(true)}
          sx={{ textTransform: 'none' }}
        >
          Table
        </Button>
      </Stack>

      {hover !== null && (
        <Stack
          direction="row"
          sx={{ gap: 2, flexWrap: 'wrap', px: 1.5, py: 1, borderRadius: 1, backgroundColor: 'action.hover' }}
        >
          <Typography variant="caption" weight="medium">
            {labels[hover]}
          </Typography>
          {series.map((s) => (
            <Typography key={s.key} variant="caption" color="text.secondary">
              {s.label}: {s.points[hover] === null ? 'no data' : s.format(s.points[hover] as number)}
            </Typography>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
