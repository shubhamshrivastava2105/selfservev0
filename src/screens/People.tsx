import * as React from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
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
  DotsThreeIcon,
  ProhibitIcon,
  ShieldIcon,
  TrashIcon,
  UsersThreeIcon,
} from '@neofloai/atoms/icons';
import { useStore } from '../store';
import { PageBody, SectionCard } from '../components/common';
import { ShellBar } from '../components/shell';
import { formatRelative } from '../clock';
import type { Member, WorkflowKey, WorkflowRole } from '../types';

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
  const {
    members,
    inviteMember,
    setMemberRole,
    toggleSuspend,
    removeMember,
    profile,
    goTo,
  } = useStore();

  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteIp, setInviteIp] = React.useState<WorkflowRole>('Agent');
  const [menuFor, setMenuFor] = React.useState<{ el: HTMLElement; member: Member } | null>(null);
  const [confirm, setConfirm] = React.useState<{ member: Member; kind: 'remove' | 'last-role' } | null>(null);

  const emailValid = /.+@.+\..+/.test(inviteEmail);
  const alreadyHere = members.some((m) => m.email.toLowerCase() === inviteEmail.toLowerCase());

  const closeMenu = () => setMenuFor(null);

  /**
   * Removing a member's only workflow role removes their workspace membership,
   * and is confirmed with the actor (Signup PRD §7).
   */
  const changeRole = (member: Member, workflow: WorkflowKey, role: WorkflowRole) => {
    // With one workflow, giving up that role is giving up the workspace.
    if (role === 'None' && !member.isWorkspaceOwner) {
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
              Everyone in {profile.workspaceName || 'this workspace'}, and their role in Invoice
              Processing.
            </Typography>
          </Stack>

          <Card component="section">
            <TableContainer>
              <Table size="md">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: '100%', minWidth: 240 }}>Member</TableCell>
                    <TableCell sx={{ minWidth: 190 }}>Invoice Processing</TableCell>
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
                            <Tooltip title="Tenant owner. Exactly one, mandatory, transferable.">
                              <Chip size="sm" variant="purple" label="Tenant owner" />
                            </Tooltip>
                          )}
                          {member.isWorkspaceOwner && (
                            <Tooltip title="Workspace owner. Exactly one, mandatory, transferable.">
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

                      <TableCell>{formatRelative(member.lastActive)}</TableCell>

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
                description="For temporary cases such as leave."
              >
                <Stack sx={{ gap: 1.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    A suspension blocks this workspace only, keeps their roles, and reverses in one
                    click. Removing someone deletes their membership but keeps their processing
                    history.
                  </Typography>
                  <Box>
                    <Button
                      variant="secondary"
                      appearance="outline"
                      size="sm"
                      onClick={() => goTo('workspace-config')}
                    >
                      Who can join lives in Workspace
                    </Button>
                  </Box>
                </Stack>
              </SectionCard>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <SectionCard
                title="Ownership guard"
                description="A workspace always has exactly one owner, so an owner cannot be removed until ownership is transferred."
              >
                <Typography variant="body2" color="text.secondary">
                  Being an owner does not by itself grant access to invoice data. That always comes
                  from a workflow role, and assigning yourself one is recorded in the audit trail.
                </Typography>
              </SectionCard>
            </Grid>
          </Grid>

          
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
            Resend invite (14-day expiry)
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
          subtitle="The invite is bound to that address and expires in 14 days."
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
                  ? 'This address is already a member here, so inviting again does nothing.'
                  : inviteEmail !== '' && !emailValid
                    ? 'Enter a valid email address'
                    : 'Colleagues from your organization can also find this workspace themselves.'
              }
              fullWidth
            />

            <Divider>Their role</Divider>

            <Select
              label="Invoice Processing"
              value={inviteIp}
              onChange={(event) => setInviteIp(event.target.value as WorkflowRole)}
              helperText="Pre-filled from this workflow's default."
              fullWidth
            >
              {ROLES.map((role) => (
                <MenuItem key={role} value={role}>{role}</MenuItem>
              ))}
            </Select>


            <Alert severity="info" title="All three roles process invoices end to end">
              The difference is administrative: only a workflow admin can change configuration,
              manage memory, or assign roles.
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
              inviteMember(inviteEmail, inviteIp);
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
