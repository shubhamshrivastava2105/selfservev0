import * as React from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  Navbar,
  NavbarTitle,
  NeofloLogo,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  ToggleButton,
  Typography,
  Tooltip,
} from '@neofloai/atoms';
import {
  BuildingsIcon,
  CaretUpDownIcon,
  ChatCircleIcon,
  ChartLineIcon,
  FadersHorizontalIcon,
  FilesIcon,
  PlusIcon,
  SidebarSimpleIcon,
  SignOutIcon,
  SparkleIcon,
  SuitcaseSimpleIcon,
  TrashIcon,
  UsersThreeIcon,
} from '@neofloai/atoms/icons';
import { NAVBAR_META_ICON_PX as META_PX } from '@neofloai/atoms';
import { VISIBILITY_COPY } from '../data';
import { useStore } from '../store';
import { AskNeoPanel } from './AskNeoPanel';
import { useRailHasRoom, useSideBySide } from './layout';
import { ColorModeToggle } from './common';
import type { Screen, WorkspaceVisibility } from '../types';

/** Gutter the rail's blocks stretch between. Expanded only. */
const RAIL_GUTTER_PX = 16;
const RAIL_COLLAPSED_PX = 64;

const NAV: { key: Screen; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'ask-neo', label: 'Ask Neo', Icon: ChatCircleIcon },
  { key: 'queue', label: 'Invoices', Icon: FilesIcon },
  { key: 'reporting', label: 'Reporting', Icon: ChartLineIcon },
  { key: 'members', label: 'Members', Icon: UsersThreeIcon },
];

/**
 * Two levels of settings, and they are genuinely different things. Integrations
 * belong to the workspace, which is where an entity and its ERP connection live.
 * Match type and tolerances belong to the workflow.
 */
const FOOTER_NAV: typeof NAV = [
  { key: 'workspace-config', label: 'Workspace', Icon: BuildingsIcon },
  { key: 'workflow-config', label: 'Workflow', Icon: FadersHorizontalIcon },
];

interface ShellState {
  collapsed: boolean;
  toggleCollapsed: () => void;
}

const ShellContext = React.createContext<ShellState>({ collapsed: false, toggleCollapsed: () => {} });

/**
 * One nav row. A pill the width of the block expanded, a square the height of
 * the row collapsed — a wide fill beside a column of icons reads as a rectangle.
 */
function NavRow({
  item,
  collapsed,
  selected,
  onSelect,
}: {
  item: (typeof NAV)[number];
  collapsed: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const { label, Icon } = item;
  return (
    <Tooltip title={collapsed ? label : ''} placement="right">
      <ToggleButton
        value={label}
        selected={selected}
        onChange={onSelect}
        appearance="text"
        size="md"
        sx={{
          height: 28,
          minHeight: 28,
          gap: 1,
          width: collapsed ? 28 : '100%',
          alignSelf: collapsed ? 'center' : 'stretch',
          justifyContent: collapsed ? 'center' : 'flex-start',
          px: collapsed ? 0 : 1,
          textTransform: 'none',
          // The panel is mid-animation while this row is still laid out at its
          // old width. Let the panel clip the label rather than wrap it.
          whiteSpace: 'nowrap',
          '& svg': { flexShrink: 0 },
        }}
      >
        <Icon size={20} />
        {!collapsed && label}
      </ToggleButton>
    </Tooltip>
  );
}

/**
 * Conversations with Neo, in the rail.
 *
 * Here rather than in the bar or on the landing page because it has to survive
 * starting a new question: a list that vanishes the moment you begin is not a
 * history. The rail is the one place on screen that never goes away.
 *
 * Hidden when the rail is collapsed — a 28px square cannot hold a title, and
 * guessing between three truncated threads is worse than opening the rail.
 */
function ThreadList() {
  const { conversations, activeConversationId, screen, openConversation, deleteConversation, clearChat, goTo } =
    useStore();

  const startNew = () => {
    clearChat();
    goTo('ask-neo');
  };

  return (
    <Stack sx={{ flex: 1, minHeight: 0, gap: 0.5, pt: 1 }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5, pl: 1, pr: 0.25 }}>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }} noWrap>
          Threads
        </Typography>
        <Tooltip title="New question" placement="right">
          <IconButton
            variant="secondary"
            appearance="text"
            size="sm"
            aria-label="Start a new question"
            onClick={startNew}
          >
            <PlusIcon size={14} />
          </IconButton>
        </Tooltip>
      </Stack>

      {conversations.length === 0 ? (
        <Typography variant="caption" color="text.disabled" sx={{ px: 1, whiteSpace: 'normal' }}>
          Nothing yet. What you ask Neo shows up here.
        </Typography>
      ) : (
        <Stack sx={{ flex: 1, minHeight: 0, overflowY: 'auto', gap: 0.25 }}>
          {conversations.map((conversation) => {
            const open = screen === 'ask-neo' && conversation.id === activeConversationId;
            return (
              <Stack
                key={conversation.id}
                direction="row"
                sx={{
                  alignItems: 'center',
                  borderRadius: 1,
                  backgroundColor: open ? 'action.selected' : undefined,
                  // The delete only shows on the row you are pointing at, so a
                  // column of threads is titles and not a column of bins.
                  '& .thread-delete': { opacity: 0 },
                  '&:hover .thread-delete': { opacity: 1 },
                  '&:focus-within .thread-delete': { opacity: 1 },
                  '&:hover': { backgroundColor: open ? 'action.selected' : 'action.hover' },
                }}
              >
                <Box
                  component="button"
                  type="button"
                  aria-current={open ? 'page' : undefined}
                  onClick={() => openConversation(conversation.id)}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    font: 'inherit',
                    color: 'inherit',
                    px: 1,
                    py: 0.5,
                  }}
                >
                  <Typography
                    variant="body2"
                    weight={open ? 'medium' : undefined}
                    color={open ? 'text.primary' : 'text.secondary'}
                    noWrap
                    sx={{ display: 'block' }}
                  >
                    {conversation.title}
                  </Typography>
                </Box>
                <Tooltip title="Delete" placement="right">
                  <IconButton
                    className="thread-delete"
                    variant="secondary"
                    appearance="text"
                    size="sm"
                    aria-label={`Delete ${conversation.title}`}
                    onClick={() => deleteConversation(conversation.id)}
                  >
                    <TrashIcon size={14} />
                  </IconButton>
                </Tooltip>
              </Stack>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}

function NavRail() {
  const { screen, goTo, profile, invoices } = useStore();
  const { collapsed } = React.useContext(ShellContext);
  const [switcherAnchor, setSwitcherAnchor] = React.useState<HTMLElement | null>(null);
  const [userAnchor, setUserAnchor] = React.useState<HTMLElement | null>(null);
  const [newWorkspaceOpen, setNewWorkspaceOpen] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  // Public by default, so a colleague who signs up lands somewhere useful.
  const [newVisibility, setNewVisibility] = React.useState<WorkspaceVisibility>('public');

  const needsMe = invoices.filter((i) => i.status === 'Action Required').length;
  const block = {
    px: collapsed ? 0 : `${RAIL_GUTTER_PX}px`,
    alignItems: collapsed ? 'center' : 'stretch',
  } as const;

  const initials =
    (profile.firstName[0] ?? 'S') + (profile.lastName[0] ?? 'S');

  return (
    <Drawer
      variant="permanent"
      size={collapsed ? RAIL_COLLAPSED_PX : 'sm'}
      slotProps={{ paper: { sx: { position: 'relative', py: 2.5 } } }}
    >
      <Stack sx={{ ...block, pb: 2, gap: 2, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', color: 'text.primary' }}>
          <NeofloLogo variant={collapsed ? 'mark' : 'full'} size={collapsed ? 20 : 16} />
        </Box>
        {!collapsed && (
          <Button
            variant="secondary"
            appearance="outline"
            size="sm"
            fullWidth
            startIcon={<SuitcaseSimpleIcon size={16} />}
            endIcon={<CaretUpDownIcon size={14} />}
            onClick={(event) => setSwitcherAnchor(event.currentTarget)}
            sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
          >
            <Box component="span" sx={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile.workspaceName || 'Workspace'}
            </Box>
          </Button>
        )}
      </Stack>

      <Divider />

      {/* Takes the slack, which is what pins the footer group down. */}
      <Stack sx={{ ...block, flex: 1, minHeight: 0, gap: 1, py: 2 }}>
        {NAV.map((item) => (
          <Box key={item.key} sx={{ position: 'relative' }}>
            <NavRow
              item={item}
              collapsed={collapsed}
              selected={screen === item.key || (item.key === 'queue' && screen === 'invoice')}
              onSelect={() => goTo(item.key)}
            />
            {item.key === 'queue' && needsMe > 0 && !collapsed && (
              <Box sx={{ position: 'absolute', right: 4, top: 4, pointerEvents: 'none' }}>
                <Chip size="sm" variant="warning" label={needsMe} />
              </Box>
            )}
          </Box>
        ))}

        {!collapsed && <ThreadList />}
      </Stack>

      <Divider />

      <Stack sx={{ ...block, gap: 1, py: 2, flexShrink: 0 }}>
        {FOOTER_NAV.map((item) => (
          <NavRow
            key={item.key}
            item={item}
            collapsed={collapsed}
            selected={screen === item.key}
            onSelect={() => goTo(item.key)}
          />
        ))}
      </Stack>

      <Divider />

      <Stack sx={{ ...block, pt: 2, flexShrink: 0 }}>
        <Button
          variant="secondary"
          appearance="text"
          fullWidth
          onClick={(event) => setUserAnchor(event.currentTarget)}
          endIcon={collapsed ? undefined : <CaretUpDownIcon size={14} />}
          sx={{ justifyContent: collapsed ? 'center' : 'space-between', textTransform: 'none', px: collapsed ? 0 : 1 }}
        >
          <Stack direction="row" sx={{ gap: 1, alignItems: 'center', minWidth: 0 }}>
            <Avatar size="sm">{initials.toUpperCase()}</Avatar>
            {!collapsed && (
              <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile.firstName || 'You'}
              </Box>
            )}
          </Stack>
        </Button>
      </Stack>

      <Menu
        anchorEl={switcherAnchor}
        open={Boolean(switcherAnchor)}
        onClose={() => setSwitcherAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        sx={{ '& .MuiMenu-paper': { minWidth: 240 } }}
      >
        <MenuItem selected onClick={() => setSwitcherAnchor(null)}>
          {profile.workspaceName || 'Workspace'}
        </MenuItem>
        <MenuItem variant="secondary" disabled>
          Login opens the last-used workspace
        </MenuItem>
        <Divider />
        <MenuItem
          variant="action"
          onClick={() => {
            setSwitcherAnchor(null);
            setNewWorkspaceOpen(true);
          }}
        >
          <PlusIcon size={16} />
          Create a workspace
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={userAnchor}
        open={Boolean(userAnchor)}
        onClose={() => setUserAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        sx={{ '& .MuiMenu-paper': { minWidth: 240 } }}
      >
        <MenuItem variant="secondary" disabled>
          {profile.email}
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { setUserAnchor(null); goTo('members'); }}>
          Members and roles
        </MenuItem>
        <MenuItem onClick={() => { setUserAnchor(null); goTo('workspace-config'); }}>
          Workspace configuration
        </MenuItem>
        <MenuItem onClick={() => { setUserAnchor(null); goTo('workflow-config'); }}>
          Workflow configuration
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => setUserAnchor(null)}>
          <SignOutIcon size={16} />
          Sign out
        </MenuItem>
      </Menu>

      {/* The only place a workspace is named by the user (Signup PRD §7). */}
      <Dialog open={newWorkspaceOpen} onClose={() => setNewWorkspaceOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle
          subtitle="Any member can create one, with no approval. You become its owner."
          onClose={() => setNewWorkspaceOpen(false)}
        >
          Create a workspace
        </DialogTitle>
        <DialogContent>
          <Stack sx={{ gap: 3 }}>
            <TextField
              label="Workspace name"
              placeholder="AP North America"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              helperText="Must be unique within your organization."
              fullWidth
            />

            <Stack sx={{ gap: 1 }}>
              <Typography variant="body2" weight="medium">
                Who can join
              </Typography>
              <RadioGroup
                value={newVisibility}
                onChange={(event) => setNewVisibility(event.target.value as WorkspaceVisibility)}
              >
                {(['public', 'approval', 'private'] as WorkspaceVisibility[]).map((option) => (
                  <Stack key={option} sx={{ gap: 0, mb: 1 }}>
                    <Radio value={option} label={VISIBILITY_COPY[option].label} />
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 3.5 }}>
                      {VISIBILITY_COPY[option].detail}
                    </Typography>
                  </Stack>
                ))}
              </RadioGroup>
              <Typography variant="caption" color="text.secondary">
                You can change this at any time from Members.
              </Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button appearance="text" variant="secondary" size="sm" onClick={() => setNewWorkspaceOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={newName.trim() === ''}
            onClick={() => {
              setNewWorkspaceOpen(false);
              setNewName('');
              setNewVisibility('public');
            }}
          >
            Create workspace
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
}

/**
 * The Ask Neo trigger, present on every screen because a question occurs to you
 * while you are working rather than after you have navigated somewhere else.
 *
 * The label says what it will do here, not just the product name: the rail
 * already has an "Ask Neo" destination, and two controls with one label doing
 * two different things is worse than a longer label.
 */
function AskNeoButton({ invoiceId, label }: { invoiceId?: string | null; label: string }) {
  const { openAskNeo } = useStore();
  return (
    <Button
      variant="primary"
      appearance="outline"
      size="sm"
      startIcon={<SparkleIcon size={16} />}
      onClick={() => openAskNeo(invoiceId ?? null)}
    >
      {label}
    </Button>
  );
}

/**
 * The shell: the rail owns the full height and the bar starts where the rail
 * ends, so the outer box is a row — rail, then a column.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const railHasRoom = useRailHasRoom();
  const [collapsed, setCollapsed] = React.useState(() => !railHasRoom);
  const { askNeoOpen } = useStore();
  const sideBySide = useSideBySide();

  /**
   * Fold the rail when the window gets narrow and unfold it when there is room
   * again. Only crossing the breakpoint moves it, so a manual toggle within one
   * size is left alone.
   */
  // Follow the breakpoint, but leave a manual toggle inside one size alone.
  React.useEffect(() => {
    setCollapsed(!railHasRoom);
  }, [railHasRoom]);

  /**
   * A docked panel folds the rail. The room for it comes out of the chrome
   * rather than out of the invoice, and the rail's destinations are still there
   * as icons. Closing the panel gives the labels back.
   */
  const panelDocked = askNeoOpen && sideBySide;
  const value = React.useMemo(
    () => ({
      collapsed: collapsed || panelDocked,
      toggleCollapsed: () => setCollapsed((previous) => !previous),
    }),
    [collapsed, panelDocked],
  );

  return (
    <ShellContext.Provider value={value}>
      <Stack direction="row" sx={{ height: '100vh' }}>
        <NavRail />
        <Stack sx={{ flex: 1, minWidth: 0 }}>{children}</Stack>
        <AskNeoPanel />
      </Stack>
    </ShellContext.Provider>
  );
}

/**
 * The app bar for a list screen. Carries the one control whose position does
 * not move when the rail folds, then the screen's own trailing controls.
 */
export function ShellBar({ children }: { children?: React.ReactNode }) {
  const { collapsed, toggleCollapsed } = React.useContext(ShellContext);
  const { screen, askNeoOpen } = useStore();
  return (
    <Navbar>
      <IconButton
        variant="secondary"
        appearance="text"
        size="sm"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={toggleCollapsed}
      >
        <SidebarSimpleIcon />
      </IconButton>
      <Box sx={{ flex: 1 }} />
      <Stack
        direction="row"
        sx={{
          gap: 1,
          alignItems: 'center',
          flexShrink: 0,
          '& .MuiButton-root': { whiteSpace: 'nowrap' },
        }}
      >
        {screen !== 'ask-neo' && !askNeoOpen && <AskNeoButton label="Ask Neo" />}
        {children}
        <ColorModeToggle />
      </Stack>
    </Navbar>
  );
}

/**
 * The page header for a record screen — a title, the facts that identify it,
 * and the actions that apply to it. Replaces the app bar rather than stacking
 * under it.
 */
export function RecordBar({
  title,
  meta,
  actions,
  askNeoInvoiceId,
}: {
  title: string;
  meta: { icon?: React.ReactNode; label: string }[];
  actions?: React.ReactNode;
  /** Scopes the Ask Neo panel to the record on screen. */
  askNeoInvoiceId?: string | null;
}) {
  const { collapsed, toggleCollapsed } = React.useContext(ShellContext);
  const { askNeoOpen } = useStore();
  return (
    <Navbar size="md">
      <IconButton
        variant="secondary"
        appearance="text"
        size="sm"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={toggleCollapsed}
      >
        <SidebarSimpleIcon />
      </IconButton>

      {/* Truncates under pressure, but never below a floor: a record screen
          whose header has lost the record is worse than a clipped label. */}
      <NavbarTitle meta={meta} sx={{ ml: 3, minWidth: 200, overflow: 'hidden' }}>
        {title}
      </NavbarTitle>

      <Box sx={{ flex: 1, minWidth: 8 }} />

      <Stack
        direction="row"
        sx={{
          gap: 1.5,
          alignItems: 'center',
          flexShrink: 0,
          '& .MuiButton-root': { whiteSpace: 'nowrap' },
        }}
      >
        {/* Redundant while the panel is already open, and it is the longest
            label in the bar. */}
        {!askNeoOpen && (
          <AskNeoButton
            invoiceId={askNeoInvoiceId}
            label={askNeoInvoiceId ? 'Ask about this invoice' : 'Ask Neo'}
          />
        )}
        {actions}
        <ColorModeToggle />
      </Stack>
    </Navbar>
  );
}

export const META_ICON_PX = META_PX;
