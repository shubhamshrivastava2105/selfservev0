import * as React from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  MenuItem,
  NeofloLogo,
  Select,
  Stack,
  TextField,
  Typography,
} from '@neofloai/atoms';
import {
  BuildingsIcon,
  EyeIcon,
  EyeSlashIcon,
  GoogleLogoIcon,
  UsersThreeIcon,
} from '@neofloai/atoms/icons';
import {
  COUNTRIES,
  JOB_FUNCTIONS,
  PENDING_INVITE,
  SIGNED_IN,
  VISIBILITY_COPY,
  readDomain,
} from '../data';
import { useStore } from '../store';
import { ColorModeToggle } from '../components/common';

/** The onboarding screens carry no app chrome — only the mark and the toggle. */
function OnboardingFrame({
  children,
  width = 460,
}: {
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <Stack sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      <Stack
        direction="row"
        sx={{ px: 3, py: 2.5, alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Box sx={{ display: 'flex', color: 'text.primary' }}>
          <NeofloLogo variant="full" size={18} />
        </Box>
        <ColorModeToggle />
      </Stack>

      <Stack
        sx={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          px: 3,
          pb: 8,
        }}
      >
        <Box sx={{ width: '100%', maxWidth: width }}>{children}</Box>
      </Stack>
    </Stack>
  );
}

/* ── Sign up ──────────────────────────────────────────────────────────── */

export function SignupScreen() {
  const { signUp, profile } = useStore();
  // Empty in normal use, as a real signup form is. Seeded from the profile only
  // when a demo scenario has staged an address to show what happens to it.
  const [firstName, setFirstName] = React.useState(profile.firstName);
  const [lastName, setLastName] = React.useState(profile.lastName);
  const [email, setEmail] = React.useState(profile.email);
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  const emailValid = /.+@.+\..+/.test(email);
  const { verdict, domain } = readDomain(email);
  const personalBlocked = emailValid && verdict === 'personal-provider';
  const canSubmit =
    firstName.trim() !== '' &&
    lastName.trim() !== '' &&
    emailValid &&
    password.length >= 8 &&
    !personalBlocked;

  return (
    <OnboardingFrame>
      <Stack sx={{ gap: 3 }}>
        <Stack sx={{ gap: 0.5 }}>
          <Typography variant="h4" component="h1">
            Create your account
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Neoflo reads your invoices, checks them against your purchase orders and receipts, and
            flags only what needs a person.
          </Typography>
        </Stack>

        <Button
          variant="secondary"
          appearance="outline"
          size="lg"
          fullWidth
          startIcon={<GoogleLogoIcon size={18} />}
          disabled={personalBlocked}
          onClick={() =>
            signUp(
              'google',
              firstName || SIGNED_IN.firstName,
              lastName || SIGNED_IN.lastName,
              email || SIGNED_IN.email,
            )
          }
        >
          Continue with Google
        </Button>

        <Divider>or</Divider>

        {/* The name is captured on the form itself, so it exists before the
            workspace that gets named after it (Signup PRD §2). */}
        <Stack sx={{ gap: 2 }}>
          <Stack direction="row" sx={{ gap: 2 }}>
            <TextField
              label="First name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              status={touched && firstName.trim() === '' ? 'error' : undefined}
              helperText={touched && firstName.trim() === '' ? 'Required' : undefined}
              fullWidth
            />
            <TextField
              label="Last name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              status={touched && lastName.trim() === '' ? 'error' : undefined}
              helperText={touched && lastName.trim() === '' ? 'Required' : undefined}
              fullWidth
            />
          </Stack>

          <TextField
            label="Work email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            status={touched && !emailValid ? 'error' : undefined}
            helperText={touched && !emailValid ? 'Enter a valid email address' : undefined}
            fullWidth
          />

          {/* The address decides the whole path, so the form says which one it
              is before you commit to it. */}
          {/* Which path you are on is settled by your domain once you sign in.
              Saying so here, before you commit, is cheaper than a dead end. */}
          {emailValid && (
            <Alert
              severity={
                verdict === 'personal-provider'
                  ? 'error'
                  : verdict === 'existing-tenant'
                    ? 'info'
                    : 'success'
              }
              floating
              title={
                verdict === 'personal-provider'
                  ? 'Use your work email address'
                  : verdict === 'existing-tenant'
                    ? `${domain} is already on Neoflo`
                    : `You will be the first from ${domain}`
              }
            >
              {verdict === 'personal-provider'
                ? `We need a company domain, so ${domain} will not work. Use the address your colleagues would recognize.`
                : verdict === 'existing-tenant'
                  ? 'You will pick a workspace next, or create your own.'
                  : 'Signing in creates your organization and your first workspace, and you own both.'}
            </Alert>
          )}

          <TextField
            label="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type={showPassword ? 'text' : 'password'}
            status={touched && password.length < 8 ? 'error' : undefined}
            helperText={touched && password.length < 8 ? 'At least 8 characters' : 'At least 8 characters.'}
            endAdornment={
              <IconButton
                appearance="text"
                variant="secondary"
                size="sm"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((previous) => !previous)}
              >
                {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
              </IconButton>
            }
            fullWidth
          />
        </Stack>

        <Button
          size="lg"
          fullWidth
          disabled={personalBlocked}
          onClick={() => {
            setTouched(true);
            if (canSubmit) signUp('password', firstName, lastName, email);
          }}
        >
          Create account
        </Button>

        {/* An invited user never reaches this screen by choosing an invitation:
            they arrive on a tokenised link from an email, which this prototype
            has no routes for. The scenario switcher covers that path instead. */}
        <Typography variant="caption" color="text.secondary" align="center">
          You can rename your workspace at any time.
        </Typography>
      </Stack>
    </OnboardingFrame>
  );
}

/* ── Routing ──────────────────────────────────────────────────────────── */

/**
 * Evaluated at authentication, before the profile screen. A domain match only
 * reveals which workspaces exist — joining is per workspace (Signup PRD §3).
 */
export function RoutingScreen() {
  const { profile, joinWorkspace, createOwnWorkspace, discoverableWorkspaces } = useStore();
  const domain = profile.email.split('@')[1] ?? 'your company';

  /**
   * Private workspaces never reach this list, and their existence is not hinted
   * at either. A count would leak that a hidden workspace exists to somebody
   * with no access to it, and there is nothing they could do with the fact.
   */
  const listed = discoverableWorkspaces.filter((w) => w.visibility !== 'private');

  return (
    <OnboardingFrame width={620}>
      <Stack sx={{ gap: 3 }}>
        <Stack sx={{ gap: 0.5 }}>
          <Typography variant="h4" component="h1">
            Your organization is already on Neoflo
          </Typography>
          <Typography variant="body2" color="text.secondary">
            These are the workspaces at <strong>{domain}</strong> open to you. Joining is per
            workspace.
          </Typography>
        </Stack>

        {listed.length === 0 ? (
          <Alert severity="info" title="Nothing here is open to join">
            Every workspace at your organization is invitation only. Create your own below, and a
            colleague can invite you to theirs later.
          </Alert>
        ) : (
        <Card component="section">
          <Stack component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }} divider={<Divider component="li" />}>
            {listed.map((workspace) => {
              const copy = VISIBILITY_COPY[workspace.visibility];
              return (
                <Stack
                  key={workspace.id}
                  component="li"
                  direction="row"
                  sx={{ gap: 2, alignItems: 'center', p: 2 }}
                >
                  <Avatar size="md" color="secondary" shape="mid">
                    <UsersThreeIcon size={16} />
                  </Avatar>

                  <Stack sx={{ flex: 1, minWidth: 0, gap: 0.25 }}>
                    <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Typography variant="body1" weight="medium">
                        {workspace.name}
                      </Typography>
                      <Chip
                        size="sm"
                        variant={workspace.visibility === 'public' ? 'success' : 'warning'}
                        label={copy.short}
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {workspace.owner} · {workspace.members} members
                    </Typography>
                    {workspace.visibility === 'approval' && (
                      <Typography variant="caption" color="text.secondary">
                        You get your own workspace immediately and the request goes to the owner.
                      </Typography>
                    )}
                  </Stack>

                  <Button
                    variant="secondary"
                    appearance="outline"
                    size="sm"
                    onClick={() => joinWorkspace(workspace.name, workspace.visibility)}
                  >
                    {workspace.visibility === 'public' ? 'Join' : 'Request'}
                  </Button>
                </Stack>
              );
            })}
          </Stack>
        </Card>
        )}

        {listed.length > 0 && (
          <Alert severity="info" title="A pending request never blocks you">
          Where a workspace needs approval you get your own to work in immediately, and the request
          goes to its owner. You are never left waiting.
          </Alert>
        )}

        <Divider>or</Divider>

        <Button
          variant="secondary"
          appearance="outline"
          size="lg"
          fullWidth
          startIcon={<BuildingsIcon size={18} />}
          onClick={createOwnWorkspace}
        >
          Create my own workspace
        </Button>

        <Typography variant="caption" color="text.secondary" align="center">
          No approval needed, and you stay in the same organization.
        </Typography>
      </Stack>
    </OnboardingFrame>
  );
}

/* ── Profile ──────────────────────────────────────────────────────────── */

/**
 * One screen after routing, on every path including invited users. The name is
 * not asked here — it is already known from signup (Signup PRD §5).
 */
export function ProfileScreen() {
  const { profile, submitProfile } = useStore();
  const [jobFunction, setJobFunction] = React.useState('');
  const [country, setCountry] = React.useState('US');
  const [touched, setTouched] = React.useState(false);

  const pathCopy: Record<string, string> = {
    'first-of-domain':
      profile.domainVerdict === 'personal-provider'
        ? `You signed up with a personal address, so ${profile.workspaceName} is your own organization. You own it, and you can rename it at any time.`
        : `Nobody from ${profile.domain} had signed up before, so your organization and ${profile.workspaceName} were created as you signed in. You own both, and you can rename the workspace at any time.`,
    joined: profile.pendingRequestFor
      ? `${profile.workspaceName} has been set up for you to work in, and your request to join ${profile.pendingRequestFor} has gone to its owner. You are not waiting on it.`
      : `You have joined ${profile.workspaceName}.`,
    'created-own': `${profile.workspaceName} is ready, and you own it.`,
    invited: `${PENDING_INVITE.invitedBy} invited you to ${profile.workspaceName}, and you are in as ${PENDING_INVITE.invoiceProcessingRole} on Invoice Processing. You were never asked which workspace.`,
  };

  return (
    <OnboardingFrame>
      <Stack sx={{ gap: 3 }}>
        <Stack sx={{ gap: 0.5 }}>
          <Typography variant="h4" component="h1">
            You're set, {profile.firstName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {pathCopy[profile.routePath ?? 'first-of-domain']} These are filled in already — change
            them now if they are wrong, or later in Workspace.
          </Typography>
        </Stack>

        <Card component="section">
          <CardContent>
            <Stack sx={{ gap: 3 }}>
              <Select
                label="Job function"
                value={jobFunction}
                onChange={(event) => setJobFunction(String(event.target.value))}
                helperText="Only used to tune what Neo suggests first."
                fullWidth
              >
                {JOB_FUNCTIONS.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>

              <Select
                label="Location"
                value={country}
                onChange={(event) => setCountry(String(event.target.value))}
                status={touched && !country ? 'error' : undefined}
                helperText="Sets tax-code defaults for the whole organization."
                fullWidth
              >
                {COUNTRIES.map((option) => (
                  <MenuItem key={option.code} value={option.code}>
                    {option.name}
                  </MenuItem>
                ))}
              </Select>
            </Stack>
          </CardContent>
        </Card>

        <Button
          size="lg"
          fullWidth
          onClick={() => {
            setTouched(true);
            if (country) submitProfile(jobFunction, country);
          }}
        >
          Go to my workspace
        </Button>
      </Stack>
    </OnboardingFrame>
  );
}
