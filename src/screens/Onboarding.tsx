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
import { COUNTRIES, DISCOVERABLE_WORKSPACES, JOB_FUNCTIONS, SIGNED_IN } from '../data';
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
  const { signUp } = useStore();
  const [firstName, setFirstName] = React.useState(SIGNED_IN.firstName);
  const [lastName, setLastName] = React.useState(SIGNED_IN.lastName);
  const [email, setEmail] = React.useState(SIGNED_IN.email);
  const [password, setPassword] = React.useState('correct-horse-battery');
  const [showPassword, setShowPassword] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  const emailValid = /.+@.+\..+/.test(email);
  const canSubmit = firstName.trim() !== '' && lastName.trim() !== '' && emailValid && password.length >= 8;

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
          onClick={() => signUp('google', firstName || 'Shubham', lastName || 'Shrivastava', email)}
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
            helperText={
              touched && !emailValid
                ? 'Enter a valid email address'
                : 'A free provider such as gmail forms its own organisation rather than joining one.'
            }
            fullWidth
          />

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
          onClick={() => {
            setTouched(true);
            if (canSubmit) signUp('password', firstName, lastName, email);
          }}
        >
          Create account
        </Button>

        <Typography variant="caption" color="text.secondary" align="center">
          No workspace name is ever requested during signup. One is created for you and can be
          renamed at any time.
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
  const { profile, joinWorkspace, createOwnWorkspace } = useStore();
  const domain = profile.email.split('@')[1] ?? 'your company';

  return (
    <OnboardingFrame width={620}>
      <Stack sx={{ gap: 3 }}>
        <Stack sx={{ gap: 0.5 }}>
          <Typography variant="h4" component="h1">
            Your organisation is already on Neoflo
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Someone at <strong>{domain}</strong> signed up before you. These are the workspaces open
            to people from your domain. Joining is per workspace — a domain match on its own grants
            no access.
          </Typography>
        </Stack>

        <Card component="section">
          <Stack component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }} divider={<Divider component="li" />}>
            {DISCOVERABLE_WORKSPACES.map((workspace) => (
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
                      variant={workspace.autoApprove ? 'success' : 'warning'}
                      label={workspace.autoApprove ? 'Joins instantly' : 'Needs approval'}
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {workspace.owner} · {workspace.members} members
                  </Typography>
                  {!workspace.autoApprove && (
                    <Typography variant="caption" color="text.secondary">
                      You get your own workspace immediately and the request goes to the owner.
                    </Typography>
                  )}
                </Stack>

                <Button
                  variant="secondary"
                  appearance="outline"
                  size="sm"
                  onClick={() => joinWorkspace(workspace.name, workspace.autoApprove)}
                >
                  Join
                </Button>
              </Stack>
            ))}
          </Stack>
        </Card>

        <Alert severity="info" title="A pending request never blocks you">
          Where a workspace needs approval, one is provisioned for you immediately and the request
          goes to its owner. You start working straight away; if it is approved later, both
          workspaces are kept and a switcher appears.
        </Alert>

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
          Creating your own is never blocked, needs no approval, and puts you in the same
          organisation.
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
    'first-of-domain': 'Your organisation and a workspace were created as you signed in. You own both.',
    joined: profile.pendingRequestFor
      ? `${profile.workspaceName} has been set up for you to work in, and your request to join ${profile.pendingRequestFor} has gone to its owner. You are not waiting on it.`
      : `You have joined ${profile.workspaceName}.`,
    'created-own': `${profile.workspaceName} is ready, and you own it.`,
    invited: `You have been added to ${profile.workspaceName}.`,
  };

  return (
    <OnboardingFrame>
      <Stack sx={{ gap: 3 }}>
        <Stack sx={{ gap: 0.5 }}>
          <Typography variant="h4" component="h1">
            Two questions, {profile.firstName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {pathCopy[profile.routePath ?? 'first-of-domain']} Nothing else is asked, and both of
            these can be changed later.
          </Typography>
        </Stack>

        <Card component="section">
          <CardContent>
            <Stack sx={{ gap: 3 }}>
              <Select
                label="Job function"
                value={jobFunction}
                onChange={(event) => setJobFunction(String(event.target.value))}
                helperText="Optional."
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
                helperText="Required. This sets tax-code defaults for your whole organisation, not just for you."
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

        <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip size="sm" variant="information" label="Invoice Processing is already present" />
          <Chip size="sm" variant="secondary" label="Nothing to select or enable" />
        </Stack>

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
