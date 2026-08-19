import * as React from 'react';
import {
  Alert,
  Avatar,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@neofloai/atoms';
import {
  ArrowsClockwiseIcon,
  CaretDownIcon,
  ClockIcon,
  DotsThreeIcon,
  LightningIcon,
  PercentIcon,
  ProhibitIcon,
  ScalesIcon,
  ShieldIcon,
  SparkleIcon,
  TrashIcon,
  UsersThreeIcon,
} from '@neofloai/atoms/icons';
import { useStore } from '../store';
import { PageBody, SectionCard } from '../components/common';
import { ShellBar } from '../components/shell';
import { money } from '../engine';
import type { Member, WorkflowRole } from '../types';

const ROLES: WorkflowRole[] = ['Workflow admin', 'Reviewer', 'Agent', 'None'];

/**
 * Role picker for a table cell. A `Select` in a cell cannot be given an
 * accessible name through Atoms' API (its only naming route is a visible
 * `label`, which would repeat down every row), so this is a real button — whose
 * `aria-label` does land — opening a Menu of the roles.
 */
function RolePicker({
  value,
  workflowLabel,
  memberName,
  onPick,
}: {
  value: WorkflowRole;
  workflowLabel: string;
  memberName: string;
  onPick: (role: WorkflowRole) => void;
}) {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);

  return (
    <>
      <Button
        variant="secondary"
        appearance="outline"
        size="sm"
        aria-label={`${workflowLabel} role for ${memberName}: ${value}. Change it.`}
        endIcon={<CaretDownIcon size={14} />}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={{ justifyContent: 'space-between', textTransform: 'none', minWidth: 160 }}
      >
        {value}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        sx={{ '& .MuiMenu-paper': { minWidth: 180 } }}
      >
        {ROLES.map((role) => (
          <MenuItem
            key={role}
            selected={role === value}
            onClick={() => {
              setAnchorEl(null);
              if (role !== value) onPick(role);
            }}
          >
            {role}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

/* ── Members ──────────────────────────────────────────────────────────── */

export function MembersScreen() {
  const { members, inviteMember, setMemberRole, toggleSuspend, removeMember, profile } = useStore();

  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteIp, setInviteIp] = React.useState<WorkflowRole>('Agent');
  const [inviteAs, setInviteAs] = React.useState<WorkflowRole>('Agent');
  const [menuFor, setMenuFor] = React.useState<{ el: HTMLElement; member: Member } | null>(null);
  const [confirm, setConfirm] = React.useState<{ member: Member; kind: 'remove' | 'last-role' } | null>(null);

  const emailValid = /.+@.+\..+/.test(inviteEmail);
  const alreadyHere = members.some((m) => m.email.toLowerCase() === inviteEmail.toLowerCase());

  const closeMenu = () => setMenuFor(null);

  /**
   * Removing a member's only workflow role removes their workspace membership,
   * and is confirmed with the actor (Signup PRD §7).
   */
  const changeRole = (member: Member, workflow: 'invoiceProcessing' | 'agenticSearch', role: WorkflowRole) => {
    const other = workflow === 'invoiceProcessing' ? member.agenticSearch : member.invoiceProcessing;
    if (role === 'None' && other === 'None' && !member.isWorkspaceOwner) {
      setConfirm({ member, kind: 'last-role' });
      return;
    }
    setMemberRole(member.id, workflow, role);
  };

  return (
    <>
      <ShellBar>
        <Button size="sm" startIcon={<UsersThreeIcon size={16} />} onClick={() => setInviteOpen(true)}>
          Invite
        </Button>
      </ShellBar>

      <PageBody>
        <Stack sx={{ gap: 3 }}>
          <Stack sx={{ gap: 0.5 }}>
            <Typography variant="h3" component="h1">
              Members
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Every member, and every workflow in {profile.workspaceName || 'this workspace'},
              regardless of your own roles. Roles are assigned here, grouped by workflow.
            </Typography>
          </Stack>

          <Card component="section">
            <TableContainer>
              <Table size="md">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: '100%', minWidth: 240 }}>Member</TableCell>
                    <TableCell sx={{ minWidth: 190 }}>Invoice Processing</TableCell>
                    <TableCell sx={{ minWidth: 190 }}>Agentic Search</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Last active</TableCell>
                    <TableCell align="right" padding="checkbox" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {members.map((member) => (
                    <TableRow
                      key={member.id}
                      disabled={member.status === 'Suspended'}
                      state={member.status === 'Invite pending' ? undefined : undefined}
                    >
                      <TableCell
                        icon={<Avatar size="sm">{member.name.slice(0, 2).toUpperCase()}</Avatar>}
                        secondary={member.email}
                      >
                        <Stack direction="row" sx={{ gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                          {member.name}
                          {member.isTenantOwner && (
                            <Tooltip title="Tenant owner — exactly one, mandatory, transferable">
                              <Chip size="sm" variant="purple" label="Tenant owner" />
                            </Tooltip>
                          )}
                          {member.isWorkspaceOwner && (
                            <Tooltip title="Workspace owner — exactly one, mandatory, transferable">
                              <Chip size="sm" variant="information" label="Workspace owner" />
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>

                      <TableCell padding="none" sx={{ pr: 1 }}>
                        <RolePicker
                          value={member.invoiceProcessing}
                          workflowLabel="Invoice Processing"
                          memberName={member.name}
                          onPick={(role) => changeRole(member, 'invoiceProcessing', role)}
                        />
                      </TableCell>

                      <TableCell padding="none" sx={{ pr: 1 }}>
                        <RolePicker
                          value={member.agenticSearch}
                          workflowLabel="Agentic Search"
                          memberName={member.name}
                          onPick={(role) => changeRole(member, 'agenticSearch', role)}
                        />
                      </TableCell>

                      <TableCell>
                        <Chip
                          size="sm"
                          variant={
                            member.status === 'Active'
                              ? 'success'
                              : member.status === 'Suspended'
                                ? 'warning'
                                : 'information'
                          }
                          label={member.status}
                        />
                      </TableCell>

                      <TableCell>{member.lastActive}</TableCell>

                      <TableCell align="right" padding="checkbox">
                        <IconButton
                          variant="secondary"
                          appearance="text"
                          size="sm"
                          aria-label={`Actions for ${member.name}`}
                          onClick={(event) => setMenuFor({ el: event.currentTarget, member })}
                        >
                          <DotsThreeIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <SectionCard
                title="Suspend keeps everything"
                description="Membership and every workflow role stay intact, and it is reversible in one click — for temporary cases such as leave. A workspace suspension blocks this workspace only; a tenant suspension, available to the tenant owner alone, blocks sign-in entirely."
              >
                <Typography variant="body2" color="text.secondary">
                  A suspension also freezes anything outstanding for that person — pending invites to
                  them, and join requests they have raised are held rather than expiring, with their
                  clocks paused. Removal cancels them outright.
                </Typography>
              </SectionCard>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <SectionCard
                title="Ownership guard"
                description="Every workspace and tenant must always have an owner, so an owner cannot be removed or suspended until ownership is transferred."
              >
                <Typography variant="body2" color="text.secondary">
                  Administrative authority does not silently grant data access — data access always
                  comes from a workflow role. Nobody is blocked from granting themselves one, but every
                  route is recorded: a self-assignment is flagged in the audit trail, and a tenant
                  owner adding themselves to a workspace notifies its owner. The boundary is
                  auditability, not prevention.
                </Typography>
              </SectionCard>
            </Grid>
          </Grid>

          <Alert severity="info" title="Reaching an existing workspace">
            After onboarding, an existing workspace can only be reached by invitation — there is no
            in-app browse or request. Join requests exist in the onboarding flow only. Creating a new
            workspace is always available. Cross-tenant membership is out of scope, so inviting an
            address that already belongs to another organisation is blocked.
          </Alert>
        </Stack>
      </PageBody>

      <Menu
        anchorEl={menuFor?.el ?? null}
        open={Boolean(menuFor)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{ '& .MuiMenu-paper': { minWidth: 260 } }}
      >
        {menuFor?.member.status === 'Invite pending' && (
          <MenuItem
            onClick={() => {
              closeMenu();
            }}
          >
            <ArrowsClockwiseIcon size={16} />
            Resend invite — 14-day expiry
          </MenuItem>
        )}
        <MenuItem
          disabled={menuFor?.member.isWorkspaceOwner}
          onClick={() => {
            if (menuFor) toggleSuspend(menuFor.member.id);
            closeMenu();
          }}
        >
          <ProhibitIcon size={16} />
          {menuFor?.member.status === 'Suspended' ? 'Unsuspend' : 'Suspend from this workspace'}
        </MenuItem>
        <Divider />
        <MenuItem
          disabled={menuFor?.member.isWorkspaceOwner}
          onClick={() => {
            if (menuFor) setConfirm({ member: menuFor.member, kind: 'remove' });
            closeMenu();
          }}
        >
          <TrashIcon size={16} />
          Remove from workspace
        </MenuItem>
        {menuFor?.member.isWorkspaceOwner && (
          <MenuItem variant="secondary" disabled>
            <ShieldIcon size={16} />
            Transfer ownership first
          </MenuItem>
        )}
      </Menu>

      {/* Invite — a role per workflow, pre-filled from each default. */}
      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle
          subtitle="Bound to that address, 14-day expiry, re-sendable and revocable while pending. Work and personal domains are treated identically."
          onClose={() => setInviteOpen(false)}
        >
          Invite a colleague
        </DialogTitle>
        <DialogContent>
          <Stack sx={{ gap: 3 }}>
            <TextField
              label="Email"
              placeholder="name@company.com"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              status={inviteEmail !== '' && (!emailValid || alreadyHere) ? 'error' : undefined}
              helperText={
                alreadyHere
                  ? 'This address is already a member here — inviting again is a no-op.'
                  : inviteEmail !== '' && !emailValid
                    ? 'Enter a valid email address'
                    : 'Same-domain colleagues can also find this workspace themselves.'
              }
              fullWidth
            />

            <Divider>A role per workflow</Divider>

            <Select
              label="Invoice Processing"
              value={inviteIp}
              onChange={(event) => setInviteIp(event.target.value as WorkflowRole)}
              helperText="Pre-filled from this workflow's default, and adjustable before sending."
              fullWidth
            >
              {ROLES.map((role) => (
                <MenuItem key={role} value={role}>{role}</MenuItem>
              ))}
            </Select>

            <Select
              label="Agentic Search"
              value={inviteAs}
              onChange={(event) => setInviteAs(event.target.value as WorkflowRole)}
              fullWidth
            >
              {ROLES.map((role) => (
                <MenuItem key={role} value={role}>{role}</MenuItem>
              ))}
            </Select>

            <Alert severity="info" title="Reviewer and Agent are identical in this version">
              There is no maker-checker flow — whoever resolves an invoice also posts it. Both names
              exist for later use. All three roles process an invoice end to end; the split is
              administrative.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button appearance="text" variant="secondary" size="sm" onClick={() => setInviteOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!emailValid || alreadyHere}
            onClick={() => {
              inviteMember(inviteEmail, inviteIp, inviteAs);
              setInviteOpen(false);
              setInviteEmail('');
            }}
          >
            Send invite
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} role="alertdialog" fullWidth maxWidth="xs">
        <DialogTitle onClose={() => setConfirm(null)}>
          {confirm?.kind === 'remove' ? `Remove ${confirm.member.name}?` : 'This is their only role here'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirm?.kind === 'remove'
              ? 'Their membership and roles are deleted. Processing history and audit entries are retained, so past work stays attributable.'
              : `Removing it will remove ${confirm?.member.name} from the workspace entirely.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button appearance="text" variant="secondary" size="sm" onClick={() => setConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant="error"
            size="sm"
            onClick={() => {
              if (confirm) removeMember(confirm.member.id);
              setConfirm(null);
            }}
          >
            {confirm?.kind === 'remove' ? 'Remove member' : 'Remove them from the workspace'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

/* ── Reporting ────────────────────────────────────────────────────────── */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "17 Aug 2026, 09:19" → epoch ms. */
function parseStamp(text: string): number | null {
  const match = /^(\d{1,2}) (\w{3}) (\d{4})(?:, (\d{2}):(\d{2}))?/.exec(text);
  if (!match) return null;
  const month = MONTHS.indexOf(match[2]);
  if (month < 0) return null;
  return Date.UTC(
    Number(match[3]),
    month,
    Number(match[1]),
    match[4] ? Number(match[4]) : 0,
    match[5] ? Number(match[5]) : 0,
  );
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function duration(ms: number | null): string {
  if (ms === null) return '—';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function MetricCard({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <Card component="article" sx={{ height: '100%' }}>
      <CardContent>
        <Stack sx={{ gap: 1 }}>
          <Stack direction="row" sx={{ gap: 1, alignItems: 'center', color: 'text.secondary' }}>
            {icon}
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
          </Stack>
          <Typography variant="h4">{value}</Typography>
          <Typography variant="body2" color="text.secondary">
            {note}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function ReportingScreen() {
  const { invoices, activity, profile } = useStore();

  // Sample records are excluded from reporting.
  const real = invoices.filter((i) => !i.isSample);
  const terminal = real.filter((i) => i.terminalAt !== null);

  const cycleTimes = terminal
    .map((i) => {
      const from = parseStamp(i.ingestedAt);
      const to = parseStamp(i.terminalAt!);
      return from !== null && to !== null ? to - from : null;
    })
    .filter((v): v is number => v !== null);

  // Touch time excludes straight-through invoices rather than counting them as zero.
  const touchTimes = terminal
    .filter((i) => !i.stpPosted && i.firstSurfacedAt !== null)
    .map((i) => {
      const from = parseStamp(i.firstSurfacedAt!);
      const to = parseStamp(i.terminalAt!);
      return from !== null && to !== null ? to - from : null;
    })
    .filter((v): v is number => v !== null);

  const overridesByRule = new Map<string, number>();
  for (const invoice of real) {
    for (const o of invoice.overrides) {
      overridesByRule.set(o.rule, (overridesByRule.get(o.rule) ?? 0) + 1);
    }
  }

  const withMatch = real.filter((i) => i.matchResult !== null);
  const fromErp = withMatch.filter((i) => i.poSource === 'zoho').length;
  const erpShare = withMatch.length === 0 ? null : Math.round((fromErp / withMatch.length) * 100);

  const firstTerminal = terminal
    .map((i) => parseStamp(i.terminalAt!))
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b)[0];
  const firstIngest = real
    .map((i) => parseStamp(i.ingestedAt))
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b)[0];

  const posted = real.filter((i) => i.status === 'Posted');
  const stp = posted.filter((i) => i.stpPosted);

  return (
    <>
      <ShellBar />
      <PageBody>
        <Stack sx={{ gap: 3 }}>
          <Stack sx={{ gap: 0.5 }}>
            <Typography variant="h3" component="h1">
              Reporting
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Live, per workflow, rolled up per workspace. {real.length} real invoices —{' '}
              {invoices.length - real.length} sample records are excluded.
            </Typography>
          </Stack>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <MetricCard
                icon={<ClockIcon size={16} />}
                label="Cycle time — median"
                value={duration(median(cycleTimes))}
                note={`Ingestion to terminal state, across all three paths so they stay comparable. ${cycleTimes.length} closed invoices.`}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <MetricCard
                icon={<LightningIcon size={16} />}
                label="Touch time — median"
                value={duration(median(touchTimes))}
                note={`First surfacing to terminal state, for invoices that surfaced at all. ${stp.length} straight-through invoices excluded rather than counted as zero.`}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <MetricCard
                icon={<SparkleIcon size={16} />}
                label="Time to first processed invoice"
                value={
                  firstTerminal !== undefined && firstIngest !== undefined
                    ? duration(firstTerminal - firstIngest)
                    : '—'
                }
                note="From the first invoice arriving to the first one reaching a terminal state."
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <MetricCard
                icon={<PercentIcon size={16} />}
                label="Matched against ERP data"
                value={erpShare === null ? '—' : `${erpShare}%`}
                note={`${fromErp} of ${withMatch.length} matches ran against Zoho records rather than uploaded documents — structured ground truth with no error bars.`}
              />
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <SectionCard
                title="Where invoices ended"
                description="Posted, Exported and Rejected are the three terminal states."
              >
                <Table size="sm">
                  <TableBody>
                    {(['Posted', 'Exported', 'Rejected', 'Action Required', 'Extraction', 'Matching', 'ERP posting'] as const).map(
                      (status) => {
                        const count = real.filter((i) => i.status === status).length;
                        const value = real
                          .filter((i) => i.status === status)
                          .reduce((sum, i) => sum + i.amount, 0);
                        if (count === 0) return null;
                        return (
                          <TableRow key={status}>
                            <TableCell sx={{ width: '100%' }}>{status}</TableCell>
                            <TableCell align="right">{count}</TableCell>
                            <TableCell align="right">{money(value)}</TableCell>
                          </TableRow>
                        );
                      },
                    )}
                  </TableBody>
                </Table>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                  {stp.length} of {posted.length || 0} posted invoices ran unsupervised. A filter and a
                  full audit trail show exactly which.
                </Typography>
              </SectionCard>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <SectionCard
                title="Overrides by rule"
                description="Each override is logged with the actor, the time, the rule bypassed and the reason — and counted here."
              >
                {overridesByRule.size === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No overrides recorded. Missing documents are hard blocks and cannot be overridden
                    at all, so this only ever counts variances and balances.
                  </Typography>
                ) : (
                  <Table size="sm">
                    <TableBody>
                      {[...overridesByRule.entries()].map(([rule, count]) => (
                        <TableRow key={rule}>
                          <TableCell icon={<ScalesIcon size={16} />} sx={{ width: '100%' }}>
                            {rule}
                          </TableCell>
                          <TableCell align="right">
                            <Chip size="sm" variant="warning" label={count} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </SectionCard>
            </Grid>
          </Grid>

          <SectionCard
            title="Activity in this session"
            description={`Everything you have done in ${profile.workspaceName || 'this workspace'} since signing in. Every tenant, workspace, role, override, deletion and restore is logged with actor, target, timestamp and scope.`}
          >
            {activity.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nothing logged yet. Work an invoice, change a setting or invite someone and it appears
                here.
              </Typography>
            ) : (
              <Table size="sm">
                <TableHead>
                  <TableRow>
                    <TableCell>When</TableCell>
                    <TableCell>Actor</TableCell>
                    <TableCell sx={{ width: '100%' }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activity.map((entry, index) => (
                    <TableRow key={`${entry.at}-${index}`}>
                      <TableCell>{entry.at}</TableCell>
                      <TableCell>{entry.actor}</TableCell>
                      <TableCell secondary={entry.detail}>{entry.action}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>

          <Alert severity="info" title="One measurement question still open">
            Whether the 7-minute activation target counts a pre-computed invoice is undecided.
            Samples complete at Exported and never post — measuring on any first invoice is simpler,
            measuring on the first real one is truer.
          </Alert>
        </Stack>
      </PageBody>
    </>
  );
}
