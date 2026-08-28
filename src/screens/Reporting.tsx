import * as React from 'react';
import { Box, Chip, Grid, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@neofloai/atoms';
import { useStore } from '../store';
import { PageBody, SectionCard } from '../components/common';
import { ShellBar } from '../components/shell';
import { BarList, LineChart, Meter, ShareBar, StatTile, formatDuration } from '../components/charts';
import { RANGES, report, STUCK_THRESHOLD_MINUTES, type RangeKey } from '../reporting';

/**
 * Reporting, in four questions.
 *
 * Each section exists to answer one of them, and the question is printed beside
 * the heading so a number nobody can act on has nowhere to hide. Every figure
 * comes from reporting.ts, which computes it from the records — where the records
 * cannot answer, the panel says so rather than showing a zero that reads as a
 * finding.
 */

/** A numbered section with the question it answers. */
function Section({
  index,
  title,
  question,
  live,
  children,
}: {
  index: number;
  title: string;
  question: string;
  live?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Stack component="section" sx={{ gap: 2 }}>
      <Stack
        direction="row"
        sx={{
          gap: 1.5,
          alignItems: 'center',
          flexWrap: 'wrap',
          pb: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{
            width: 22,
            height: 22,
            borderRadius: 999,
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
          }}
          aria-hidden
        >
          <Typography variant="caption" weight="medium">
            {index}
          </Typography>
        </Box>
        <Typography
          variant="caption"
          weight="medium"
          component="h2"
          sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}
        >
          {title}
        </Typography>
        {live && <Chip size="sm" variant="error" label="Live" />}
        <Box sx={{ flex: 1 }} />
        <Typography variant="body2" color="text.secondary">
          {question}
        </Typography>
      </Stack>
      {children}
    </Stack>
  );
}

/** One stage's stuck count, with the invoices behind it named. */
function StuckCard({
  label,
  minutes,
  rows,
}: {
  label: string;
  minutes: number;
  rows: { invoice: { id: string; number: string; vendor: string }; waitingMs: number }[];
}) {
  return (
    <SectionCard title={label} description={`Sitting longer than ${minutes} minutes on this stage.`}>
      {rows.length === 0 ? (
        <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
          <Typography variant="h5">0</Typography>
          <Typography variant="body2" color="text.secondary">
            nothing waiting
          </Typography>
        </Stack>
      ) : (
        <Stack sx={{ gap: 1 }}>
          <Typography variant="h5">{rows.length}</Typography>
          {rows.slice(0, 4).map((row) => (
            <Stack
              key={row.invoice.id}
              direction="row"
              sx={{ gap: 1, alignItems: 'baseline', flexWrap: 'wrap' }}
            >
              <Typography variant="body2" weight="medium">
                {row.invoice.number}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }} noWrap>
                {row.invoice.vendor}
              </Typography>
              <Typography variant="caption" color="warning.main">
                {formatDuration(row.waitingMs)}
              </Typography>
            </Stack>
          ))}
          {rows.length > 4 && (
            <Typography variant="caption" color="text.secondary">
              and {rows.length - 4} more
            </Typography>
          )}
        </Stack>
      )}
    </SectionCard>
  );
}

const BAND_LABEL = { fast: 'Fast', fair: 'Within SLA', slow: 'Over SLA' } as const;
const BAND_TONE = { fast: 'success', fair: 'warning', slow: 'error' } as const;

export function ReportingScreen() {
  const { invoices, members, config, profile, connections } = useStore();
  /**
   * What finishing is called here.
   *
   * The measurement is the same either way — the invoice left Neoflo with its
   * data settled. Only the destination differs, and a workspace with no ERP
   * reporting on how many invoices it "posted" is reporting on something it
   * cannot do.
   */
  const posts = connections.zohoBooks;
  const outcome = posts ? 'posted' : 'completed';
  const outcomeTitle = posts ? 'Posted' : 'Completed';
  const [range, setRange] = React.useState<RangeKey>('7d');
  const r = React.useMemo(
    () => report(invoices, members, config, range),
    [invoices, members, config, range],
  );

  const minutes = (ms: number) => `${Math.round(ms / 60_000)}m`;
  const sampleCount = invoices.filter((i) => i.isSample).length;

  return (
    <>
      <ShellBar>
        <ToggleButtonGroup
          exclusive
          size="sm"
          value={range}
          onChange={(_, next) => next && setRange(next as RangeKey)}
          aria-label="Reporting period"
        >
          {RANGES.map((option) => (
            <ToggleButton key={option.key} value={option.key} sx={{ textTransform: 'none' }}>
              {option.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </ShellBar>

      <PageBody maxWidth={1180}>
        <Stack sx={{ gap: 5 }}>
          <Stack sx={{ gap: 0.5 }}>
            <Typography variant="h3" component="h1">
              Reporting
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {profile.workspaceName || 'This workspace'}, last {r.window.days === 1 ? 'day' : `${r.window.days} days`}
              {sampleCount > 0 &&
                `. ${sampleCount} sample record${sampleCount === 1 ? '' : 's'} left out — they never went anywhere`}
              .
            </Typography>
          </Stack>

          {/* ── 1 ───────────────────────────────────────────────────────── */}
          <Section
            index={1}
            title="Volume and coverage"
            question="Are we processing the volume we said we would?"
          >
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <StatTile
                  label={`Invoices ${outcome}`}
                  hint={`Left Neoflo ${posts ? 'for the ERP' : 'as matched data'} inside this window.`}
                  value={r.volume.posted.now.toLocaleString('en-US')}
                  delta={{ changePercent: r.volume.posted.changePercent, better: 'up' }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <StatTile
                  label="Invoices arrived"
                  hint="Ingested inside this window, however they arrived."
                  value={r.volume.created.now.toLocaleString('en-US')}
                  delta={{ changePercent: r.volume.created.changePercent, better: 'up' }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <Stack
                  sx={{
                    gap: 1,
                    p: 2,
                    height: '100%',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    backgroundColor: 'background.paper',
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Coverage
                  </Typography>
                  <Typography variant="h5">{r.coverage.percent}%</Typography>
                  <Meter
                    value={r.coverage.posted}
                    max={r.coverage.target}
                    tone={r.coverage.percent >= 100 ? 'success' : 'primary'}
                    caption={`${r.coverage.posted} of ${r.coverage.target}, from a target of ${config.monthlyPostingTarget} a month`}
                  />
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <StatTile
                  label="End to end, median"
                  hint="Arrival to a terminal state, for invoices that closed in this window."
                  value={formatDuration(r.endToEnd.p50)}
                  footnote={
                    r.endToEnd.count === 0
                      ? 'Nothing closed in this window'
                      : `Across ${r.endToEnd.count} closed`
                  }
                />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, lg: 7 }}>
                <SectionCard
                  title={`Arrived and ${outcome}, by day`}
                  description={`${outcomeTitle} is the line that matters; arrivals are the demand behind it. The dashed line is the daily share of a ${config.monthlyPostingTarget}-a-month target.`}
                >
                  <LineChart
                    labels={r.daily.map((d) => d.label)}
                    reference={{
                      value: config.monthlyPostingTarget / 30,
                      label: 'Daily target',
                    }}
                    series={[
                      {
                        key: 'posted',
                        label: outcomeTitle,
                        role: 'accent',
                        points: r.daily.map((d) => d.posted),
                        format: (v) => String(Math.round(v)),
                      },
                      {
                        key: 'created',
                        label: 'Arrived',
                        role: 'context',
                        points: r.daily.map((d) => d.created),
                        format: (v) => String(Math.round(v)),
                      },
                    ]}
                    emptyMessage={`Nothing arrived or ${outcome} in this window.`}
                  />
                </SectionCard>
              </Grid>
              <Grid size={{ xs: 12, lg: 5 }}>
                <SectionCard
                  title={`${outcomeTitle} by legal entity`}
                  description="Which set of books the work landed in."
                >
                  <ShareBar
                    data={r.byEntity.map((e) => ({
                      label: e.entity,
                      count: e.count,
                      percent: e.percent,
                    }))}
                    emptyMessage={`Nothing ${outcome} in this window.`}
                  />
                </SectionCard>
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, lg: 7 }}>
                <SectionCard
                  title="How far invoices got"
                  description="Counted as reached-at-least-here, for everything that arrived in this window."
                >
                  <BarList
                    data={r.funnel.map((f) => ({ label: f.label, value: f.count }))}
                    max={r.funnel[0]?.count || 1}
                    emptyMessage="Nothing arrived in this window."
                  />
                </SectionCard>
              </Grid>
              <Grid size={{ xs: 12, lg: 5 }}>
                <SectionCard
                  title="Where they stopped"
                  description={`What is holding back anything that arrived and has not ${outcome}.`}
                >
                  <BarList
                    data={r.dropOff.map((d) => ({ label: d.reason, value: d.count }))}
                    labelWidth={180}
                    emptyMessage="Nothing has stopped in this window."
                  />
                </SectionCard>
              </Grid>
            </Grid>
          </Section>

          {/* ── 2 ───────────────────────────────────────────────────────── */}
          <Section
            index={2}
            title="Stage health"
            question="Where is work sitting right now?"
            live
          >
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <StuckCard
                  label="Waiting at extraction"
                  minutes={STUCK_THRESHOLD_MINUTES.extraction}
                  rows={r.stuck.extraction}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <StuckCard
                  label="Waiting at matching"
                  minutes={STUCK_THRESHOLD_MINUTES.matching}
                  rows={r.stuck.matching}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <StuckCard
                  label="Waiting at ERP posting"
                  minutes={STUCK_THRESHOLD_MINUTES.posting}
                  rows={r.stuck.posting}
                />
              </Grid>
            </Grid>
          </Section>

          {/* ── 3 ───────────────────────────────────────────────────────── */}
          <Section
            index={3}
            title="Quality and accuracy"
            question="Is the reading and matching good enough to leave alone?"
          >
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, lg: 7 }}>
                <SectionCard
                  title="Taken as it came, by stage"
                  description="Share of invoices that reached a stage and needed nobody: no correction, no override, no coding by hand."
                >
                  <BarList
                    max={100}
                    data={r.autoConfirm.map((a) => ({
                      label: a.label,
                      value: a.percent ?? 0,
                      display: a.percent === null ? '—' : `${Math.round(a.percent)}%`,
                    }))}
                    emptyMessage="Nothing reached a stage in this window."
                  />
                  <Stack sx={{ mt: 1.5, gap: 0.25 }}>
                    {r.autoConfirm.map((a) => (
                      <Typography key={a.stage} variant="caption" color="text.secondary">
                        {a.label}: {a.clean} of {a.arrived} needed nobody
                      </Typography>
                    ))}
                  </Stack>
                </SectionCard>
              </Grid>
              <Grid size={{ xs: 12, lg: 5 }}>
                <SectionCard
                  title="Clean all the way through"
                  description="Invoices that cleared every stage untouched. This is the number that says whether straight-through processing is worth switching on."
                >
                  <Stack sx={{ gap: 1.5 }}>
                    <Typography variant="h3">
                      {r.fullAuto.percent === null ? '—' : `${Math.round(r.fullAuto.percent)}%`}
                    </Typography>
                    <Meter
                      value={r.fullAuto.eligible}
                      max={Math.max(1, r.fullAuto.total)}
                      caption={`${r.fullAuto.eligible} of ${r.fullAuto.total} closed invoice${r.fullAuto.total === 1 ? '' : 's'}`}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {posts
                        ? `${r.fullAuto.unsupervised} actually posted without surfacing, which is what straight-through is doing today.`
                        : 'None of them went anywhere unsupervised: straight-through needs an ERP to post to, and none is connected.'}
                    </Typography>
                  </Stack>
                </SectionCard>
              </Grid>
            </Grid>

            <SectionCard
              title="Why people rejected"
              description="Rejections a person initiated, grouped by the reason they gave."
            >
              <BarList
                data={r.rejections.map((d) => ({ label: d.reason, value: d.count }))}
                labelWidth={220}
                emptyMessage="Nobody rejected an invoice in this window."
              />
            </SectionCard>
          </Section>

          {/* ── 4 ───────────────────────────────────────────────────────── */}
          <Section
            index={4}
            title="Efficiency and SLA"
            question={`Faster than the ${r.baselineMinutes}-minute manual baseline?`}
          >
            <SectionCard
              title="Time with a person"
              description={`First surfaced to closed, so straight-through invoices are left out rather than counted as zero. The manual baseline is ${r.baselineMinutes} minutes.`}
            >
              <Grid container spacing={2}>
                {(['p50', 'p75', 'p90', 'p95'] as const).map((key) => (
                  <Grid key={key} size={{ xs: 6, md: 3 }}>
                    <StatTile
                      label={key === 'p50' ? 'Median (p50)' : key.toUpperCase()}
                      value={formatDuration(r.reviewToPosted[key])}
                      footnote={
                        r.reviewToPosted[key] === null
                          ? undefined
                          : (r.reviewToPosted[key] as number) / 60_000 <= r.baselineMinutes
                            ? 'Inside the baseline'
                            : 'Over the baseline'
                      }
                    />
                  </Grid>
                ))}
              </Grid>
              {/* Four identical figures look like a bug. They are what a
                  distribution of one observation is, so say that instead. */}
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {r.reviewToPosted.count === 0
                  ? 'Nothing surfaced to a person and closed in this window, so there is no distribution to read.'
                  : r.reviewToPosted.count < 4
                    ? `Only ${r.reviewToPosted.count} invoice${r.reviewToPosted.count === 1 ? '' : 's'} closed with a person in this window, so the percentiles all land on the same few figures. They separate once there is more to rank.`
                    : `Across ${r.reviewToPosted.count} invoices closed with a person.`}
              </Typography>
            </SectionCard>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, lg: 7 }}>
                <SectionCard
                  title="Typical case and the tail"
                  description="Read together: the median says what a normal day feels like, p95 says how bad the bad ones get."
                >
                  {r.slaTrend.filter((d) => d.count > 0).length < 2 ? (
                    <Typography variant="body2" color="text.secondary">
                      A trend needs at least two days with something in them. So far{' '}
                      {r.slaTrend.filter((d) => d.count > 0).length === 0
                        ? 'no day in this window has a closed invoice.'
                        : 'only one day does.'}
                    </Typography>
                  ) : (
                  <LineChart
                    labels={r.slaTrend.map((d) => d.label)}
                    reference={{ value: r.baselineMinutes * 60_000, label: 'Manual baseline' }}
                    series={[
                      {
                        key: 'p50',
                        label: 'Median (p50)',
                        role: 'accent',
                        points: r.slaTrend.map((d) => d.p50),
                        format: minutes,
                      },
                      {
                        key: 'p95',
                        label: 'p95',
                        role: 'pair',
                        points: r.slaTrend.map((d) => d.p95),
                        format: minutes,
                      },
                    ]}
                    emptyMessage="Nothing closed with a person involved in this window."
                  />
                  )}
                </SectionCard>
              </Grid>
              <Grid size={{ xs: 12, lg: 5 }}>
                <SectionCard
                  title={`${outcomeTitle} per person`}
                  description="Who closed the work, and where their median sits against the baseline."
                >
                  <BarList
                    labelWidth={110}
                    data={r.perAgent.map((a) => ({
                      label: a.actor,
                      value: a.posted,
                      display: `${a.posted} · ${formatDuration(a.medianMs)}`,
                      status: { tone: BAND_TONE[a.band], label: BAND_LABEL[a.band] },
                    }))}
                    emptyMessage="Nobody posted an invoice by hand in this window."
                  />
                </SectionCard>
              </Grid>
            </Grid>

            <SectionCard
              title="Whole life of an invoice"
              description="Arrival to closed, including the time nobody was looking at it."
            >
              <Grid container spacing={2}>
                {(['p50', 'p75', 'p90', 'p95'] as const).map((key) => (
                  <Grid key={key} size={{ xs: 6, md: 3 }}>
                    <StatTile
                      label={key === 'p50' ? 'Median (p50)' : key.toUpperCase()}
                      value={formatDuration(r.endToEnd[key])}
                    />
                  </Grid>
                ))}
              </Grid>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {r.endToEnd.count === 0
                  ? 'Nothing closed in this window.'
                  : `Across ${r.endToEnd.count} closed invoice${r.endToEnd.count === 1 ? '' : 's'}.`}
              </Typography>
            </SectionCard>
          </Section>
        </Stack>
      </PageBody>
    </>
  );
}
