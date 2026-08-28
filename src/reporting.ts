/**
 * Every number the reporting screen shows, computed from the records.
 *
 * Kept out of the screen so each metric is a function with a name and a
 * definition, testable without rendering anything — and so a number that looks
 * wrong can be read rather than reverse-engineered out of JSX.
 *
 * Nothing here invents data. Where the records cannot answer a question the
 * metric returns an empty result and the screen says so, because a reporting
 * screen that fills its own gaps is worse than one that admits them.
 */

import type { Invoice, Member, Stage, WorkflowConfig } from './types';
import { NOW } from './clock';

/* ── The window ───────────────────────────────────────────────────────── */

export type RangeKey = 'today' | '7d' | '30d';

export const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: 'today', label: 'Today', days: 1 },
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
];

export interface Window {
  days: number;
  from: number;
  to: number;
  /** The same length of time immediately before, for "vs prior period". */
  priorFrom: number;
  priorTo: number;
}

export function windowFor(range: RangeKey): Window {
  const days = RANGES.find((r) => r.key === range)?.days ?? 7;
  const to = NOW.getTime();
  const span = days * 86_400_000;
  return { days, from: to - span, to, priorFrom: to - 2 * span, priorTo: to - span };
}

const at = (iso: string | null): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
};

const inside = (iso: string | null, from: number, to: number): boolean => {
  const t = at(iso);
  return t !== null && t >= from && t <= to;
};

/** Sample records are excluded from every metric: they never posted anywhere. */
export const reportable = (invoices: Invoice[]): Invoice[] => invoices.filter((i) => !i.isSample);

/* ── Percentiles ──────────────────────────────────────────────────────── */

/** Nearest-rank on the sorted values. Null when there is nothing to rank. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

export interface Percentiles {
  p50: number | null;
  p75: number | null;
  p90: number | null;
  p95: number | null;
  count: number;
}

const percentiles = (values: number[]): Percentiles => ({
  p50: percentile(values, 50),
  p75: percentile(values, 75),
  p90: percentile(values, 90),
  p95: percentile(values, 95),
  count: values.length,
});

/* ── Section 1 · Volume and coverage ──────────────────────────────────── */

export interface Delta {
  now: number;
  prior: number;
  /** Null where there is no prior figure to compare against. */
  changePercent: number | null;
}

const delta = (now: number, prior: number): Delta => ({
  now,
  prior,
  changePercent: prior === 0 ? null : Number((((now - prior) / prior) * 100).toFixed(1)),
});

/**
 * Invoices that finished in the window.
 *
 * Posted and Exported are one outcome counted twice otherwise. Both are the
 * invoice leaving Neoflo with its data settled; which of the two it is depends
 * on whether an ERP is connected, and a workspace without one would otherwise
 * report that it had processed nothing.
 */
export const postedIn = (invoices: Invoice[], from: number, to: number): Invoice[] =>
  reportable(invoices).filter(
    (i) => ['Posted', 'Exported'].includes(i.status) && inside(i.terminalAt, from, to),
  );

export const createdIn = (invoices: Invoice[], from: number, to: number): Invoice[] =>
  reportable(invoices).filter((i) => inside(i.ingestedAt, from, to));

export function volume(invoices: Invoice[], w: Window) {
  return {
    posted: delta(
      postedIn(invoices, w.from, w.to).length,
      postedIn(invoices, w.priorFrom, w.priorTo).length,
    ),
    created: delta(
      createdIn(invoices, w.from, w.to).length,
      createdIn(invoices, w.priorFrom, w.priorTo).length,
    ),
  };
}

/**
 * Posted against the target, pro-rated to the window. The target is the
 * workspace's own, set in workflow configuration, so this is not a number
 * invented here.
 */
export function coverage(invoices: Invoice[], w: Window, monthlyTarget: number) {
  const target = Math.max(1, Math.round((monthlyTarget / 30) * w.days));
  const posted = postedIn(invoices, w.from, w.to).length;
  return { posted, target, percent: Number(((posted / target) * 100).toFixed(1)) };
}

/** One row per day in the window: what arrived, and what posted. */
export function dailyVolume(invoices: Invoice[], w: Window) {
  const days: { day: string; label: string; created: number; posted: number }[] = [];
  for (let i = w.days - 1; i >= 0; i -= 1) {
    const dayStart = new Date(w.to - i * 86_400_000);
    dayStart.setHours(0, 0, 0, 0);
    const from = dayStart.getTime();
    const to = from + 86_399_999;
    days.push({
      day: dayStart.toISOString(),
      label: dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      created: createdIn(invoices, from, to).length,
      posted: postedIn(invoices, from, to).length,
    });
  }
  return days;
}

/** Posted volume per legal entity — which books the work landed in. */
export function postedByEntity(invoices: Invoice[], w: Window) {
  const counts = new Map<string, number>();
  for (const invoice of postedIn(invoices, w.from, w.to)) {
    counts.set(invoice.legalEntity, (counts.get(invoice.legalEntity) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  return [...counts.entries()]
    .map(([entity, count]) => ({ entity, count, percent: total === 0 ? 0 : (count / total) * 100 }))
    .sort((a, b) => b.count - a.count);
}

export const FUNNEL_STAGES: { key: string; label: string }[] = [
  { key: 'extraction', label: 'Extraction' },
  { key: 'matching', label: 'Matching' },
  { key: 'posting', label: 'ERP posting' },
  { key: 'posted', label: 'Finished' },
];

/**
 * How far invoices created in the window have travelled. Counted as "reached at
 * least here", so the shape reads as a funnel rather than a snapshot: an invoice
 * that posted also reached extraction.
 */
export function funnel(invoices: Invoice[], w: Window) {
  const created = createdIn(invoices, w.from, w.to);
  const order: Stage[] = ['extraction', 'matching', 'posting'];
  const reached = (invoice: Invoice, stage: Stage) => {
    if (['Posted', 'Exported'].includes(invoice.status)) return true;
    return order.indexOf(invoice.stage) >= order.indexOf(stage);
  };
  return [
    { label: 'Extraction', count: created.length },
    { label: 'Matching', count: created.filter((i) => reached(i, 'matching')).length },
    { label: 'ERP posting', count: created.filter((i) => reached(i, 'posting')).length },
    {
      label: 'Finished',
      count: created.filter((i) => ['Posted', 'Exported'].includes(i.status)).length,
    },
  ];
}

/** Where invoices left the funnel without posting, and why. */
export function dropOff(invoices: Invoice[], w: Window) {
  const counts = new Map<string, number>();
  for (const invoice of createdIn(invoices, w.from, w.to)) {
    if (invoice.status === 'Rejected') {
      const reason = invoice.rejectReason?.trim();
      counts.set(reason ? shortReason(reason) : 'Rejected, no reason given', (counts.get(reason ? shortReason(reason) : 'Rejected, no reason given') ?? 0) + 1);
      continue;
    }
    const block = invoice.matchResult?.hardBlock;
    if (block) {
      const label = HARD_BLOCK_LABEL[block];
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

const HARD_BLOCK_LABEL: Record<string, string> = {
  duplicate: 'Duplicate of an invoice already seen',
  'no-po': 'No purchase order to match against',
  'no-grn': 'No goods receipt for a 3-way match',
};

/** A reason belongs on a chart axis, so it is trimmed to its first clause. */
function shortReason(reason: string): string {
  const first = reason.split(/[.;]/)[0].trim();
  return first.length > 44 ? `${first.slice(0, 43).trimEnd()}…` : first;
}

/* ── Section 2 · Stage health, live ───────────────────────────────────── */

/** Audit actions that mean "this invoice entered that stage just now". */
const ENTERED: Record<Stage, string[]> = {
  extraction: ['Uploaded', 'Ingested', 'Returned to extraction'],
  matching: ['Advanced to matching', 'Matching re-run'],
  posting: ['Surfaced at ERP posting'],
};

/** When the invoice arrived on the stage it is on now. */
export function enteredStageAt(invoice: Invoice): number | null {
  const markers = ENTERED[invoice.stage] ?? [];
  for (let i = invoice.audit.length - 1; i >= 0; i -= 1) {
    if (markers.includes(invoice.audit[i].action)) return at(invoice.audit[i].at);
  }
  // Nothing moved it, so it has been where it started since it arrived.
  return at(invoice.ingestedAt);
}

export const STUCK_THRESHOLD_MINUTES: Record<Stage, number> = {
  extraction: 5,
  matching: 15,
  posting: 2,
};

/** Open invoices that have sat on a stage longer than that stage allows. */
export function stuck(invoices: Invoice[], stage: Stage) {
  const limit = STUCK_THRESHOLD_MINUTES[stage] * 60_000;
  const now = NOW.getTime();
  return reportable(invoices)
    .filter((i) => i.terminalAt === null && i.stage === stage)
    .map((i) => ({ invoice: i, waitingMs: now - (enteredStageAt(i) ?? now) }))
    .filter((row) => row.waitingMs > limit)
    .sort((a, b) => b.waitingMs - a.waitingMs);
}

/* ── Section 3 · Quality and accuracy ─────────────────────────────────── */

/** Rejections a person initiated, grouped by the reason they typed. */
export function rejectionSplit(invoices: Invoice[], w: Window) {
  const counts = new Map<string, number>();
  for (const invoice of reportable(invoices)) {
    if (invoice.status !== 'Rejected' || !inside(invoice.terminalAt, w.from, w.to)) continue;
    const reason = invoice.rejectReason?.trim();
    const label = reason ? shortReason(reason) : 'No reason given';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

const touched = (invoice: Invoice, actions: string[]) =>
  invoice.audit.some((entry) => actions.includes(entry.action));

/** True where the stage's output was taken as it came, with no intervention. */
export function autoConfirmed(invoice: Invoice, stage: Stage): boolean {
  if (stage === 'extraction') {
    return (
      !invoice.invoiceFields.some((f) => f.editedFrom !== undefined) &&
      !touched(invoice, ['Field corrected', 'Returned to extraction'])
    );
  }
  if (stage === 'matching') {
    return invoice.overrides.length === 0 && !touched(invoice, ['Override recorded', 'PO attached', 'GRN attached']);
  }
  return !touched(invoice, ['Code assigned']);
}

/** Per stage, the share of invoices that reached it and needed nobody. */
export function autoConfirmByStage(invoices: Invoice[], w: Window) {
  const created = createdIn(invoices, w.from, w.to);
  const order: Stage[] = ['extraction', 'matching', 'posting'];
  return order.map((stage) => {
    const arrived = created.filter(
      (i) =>
        ['Posted', 'Exported'].includes(i.status) || order.indexOf(i.stage) >= order.indexOf(stage),
    );
    const clean = arrived.filter((i) => autoConfirmed(i, stage));
    return {
      stage,
      label: stage === 'posting' ? 'ERP posting' : stage === 'matching' ? 'Matching' : 'Extraction',
      arrived: arrived.length,
      clean: clean.length,
      percent: arrived.length === 0 ? null : (clean.length / arrived.length) * 100,
    };
  });
}

/**
 * Invoices that cleared every stage without a person. This is the number that
 * says whether straight-through processing is worth switching on — distinct from
 * how many actually posted unsupervised, which is what stpPosted records.
 */
export function fullAutoConfirm(invoices: Invoice[], w: Window) {
  const closed = reportable(invoices).filter(
    (i) => ['Posted', 'Exported'].includes(i.status) && inside(i.terminalAt, w.from, w.to),
  );
  const eligible = closed.filter(
    (i) =>
      autoConfirmed(i, 'extraction') && autoConfirmed(i, 'matching') && autoConfirmed(i, 'posting'),
  );
  const unsupervised = closed.filter((i) => i.stpPosted);
  return {
    total: closed.length,
    eligible: eligible.length,
    unsupervised: unsupervised.length,
    percent: closed.length === 0 ? null : (eligible.length / closed.length) * 100,
  };
}

/* ── Section 4 · Efficiency and SLA ───────────────────────────────────── */

/** Ingested to terminal: the whole life of an invoice. */
export function endToEnd(invoices: Invoice[], w: Window): Percentiles {
  const durations = reportable(invoices)
    .filter((i) => inside(i.terminalAt, w.from, w.to))
    .map((i) => {
      const start = at(i.ingestedAt);
      const end = at(i.terminalAt);
      return start !== null && end !== null ? end - start : null;
    })
    .filter((d): d is number => d !== null && d >= 0);
  return percentiles(durations);
}

/**
 * First surfaced to terminal: the part a person is answerable for. Invoices that
 * never surfaced are excluded rather than counted as zero — straight-through
 * work would otherwise flatter this number into meaninglessness.
 */
export function reviewToPosted(invoices: Invoice[], w: Window): Percentiles {
  const durations = reportable(invoices)
    .filter((i) => inside(i.terminalAt, w.from, w.to) && i.firstSurfacedAt !== null)
    .map((i) => {
      const start = at(i.firstSurfacedAt);
      const end = at(i.terminalAt);
      return start !== null && end !== null ? end - start : null;
    })
    .filter((d): d is number => d !== null && d >= 0);
  return percentiles(durations);
}

/** The typical case and the tail, day by day, so they can be read together. */
export function slaTrend(invoices: Invoice[], w: Window) {
  const rows: { label: string; p50: number | null; p95: number | null; count: number }[] = [];
  for (let i = w.days - 1; i >= 0; i -= 1) {
    const dayStart = new Date(w.to - i * 86_400_000);
    dayStart.setHours(0, 0, 0, 0);
    const from = dayStart.getTime();
    const to = from + 86_399_999;
    const durations = reportable(invoices)
      .filter((invoice) => inside(invoice.terminalAt, from, to) && invoice.firstSurfacedAt !== null)
      .map((invoice) => (at(invoice.terminalAt) ?? 0) - (at(invoice.firstSurfacedAt) ?? 0))
      .filter((d) => d >= 0);
    rows.push({
      label: dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      p50: percentile(durations, 50),
      p95: percentile(durations, 95),
      count: durations.length,
    });
  }
  return rows;
}

export type ThroughputBand = 'fast' | 'fair' | 'slow';

/** Which side of the SLA a person's median sits on. */
export function bandFor(medianMs: number | null, baselineMinutes: number): ThroughputBand {
  if (medianMs === null) return 'fair';
  const minutes = medianMs / 60_000;
  if (minutes <= baselineMinutes / 2) return 'fast';
  return minutes <= baselineMinutes ? 'fair' : 'slow';
}

/**
 * Who posted what, and how long they took over it.
 *
 * Attributed from the audit entry that recorded the posting, so an invoice that
 * posted itself is credited to nobody rather than to whoever happened to be
 * signed in.
 */
export function perAgent(invoices: Invoice[], members: Member[], w: Window, baselineMinutes: number) {
  const byActor = new Map<string, number[]>();
  for (const invoice of postedIn(invoices, w.from, w.to)) {
    if (invoice.stpPosted) continue;
    // Whichever way the invoice left, the person who sent it is the one the
    // time is credited to.
    const entry = [...invoice.audit]
      .reverse()
      .find((a) => a.action === 'Posted to Zoho Books' || a.action === 'Exported');
    if (!entry) continue;
    const start = at(invoice.firstSurfacedAt);
    const end = at(invoice.terminalAt);
    const list = byActor.get(entry.actor) ?? [];
    if (start !== null && end !== null && end >= start) list.push(end - start);
    byActor.set(entry.actor, list);
  }
  return [...byActor.entries()]
    .map(([actor, durations]) => {
      const median = percentile(durations, 50);
      return {
        actor,
        isMember: members.some((m) => m.name === actor),
        posted: durations.length,
        medianMs: median,
        band: bandFor(median, baselineMinutes),
      };
    })
    .sort((a, b) => b.posted - a.posted);
}

/** Everything the screen needs, in one call, so the sections cannot disagree. */
export function report(
  invoices: Invoice[],
  members: Member[],
  config: WorkflowConfig,
  range: RangeKey,
) {
  const w = windowFor(range);
  const baseline = config.manualBaselineMinutes;
  return {
    window: w,
    volume: volume(invoices, w),
    coverage: coverage(invoices, w, config.monthlyPostingTarget),
    daily: dailyVolume(invoices, w),
    byEntity: postedByEntity(invoices, w),
    funnel: funnel(invoices, w),
    dropOff: dropOff(invoices, w),
    stuck: {
      extraction: stuck(invoices, 'extraction'),
      matching: stuck(invoices, 'matching'),
      posting: stuck(invoices, 'posting'),
    },
    rejections: rejectionSplit(invoices, w),
    autoConfirm: autoConfirmByStage(invoices, w),
    fullAuto: fullAutoConfirm(invoices, w),
    endToEnd: endToEnd(invoices, w),
    reviewToPosted: reviewToPosted(invoices, w),
    slaTrend: slaTrend(invoices, w),
    perAgent: perAgent(invoices, members, w, baseline),
    baselineMinutes: baseline,
  };
}
