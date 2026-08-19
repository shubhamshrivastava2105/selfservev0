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
  Stack,
  TextField,
  ToggleButton,
  Tooltip,
} from '@neofloai/atoms';
import {
  CaretUpDownIcon,
  ChatCircleIcon,
  ChartLineIcon,
  FilesIcon,
  GearSixIcon,
  PlugsConnectedIcon,
  PlusIcon,
  SidebarSimpleIcon,
  SignOutIcon,
  SuitcaseSimpleIcon,
  UsersThreeIcon,
} from '@neofloai/atoms/icons';
import { NAVBAR_META_ICON_PX as META_PX } from '@neofloai/atoms';
import { useStore } from '../store';
import { ColorModeToggle } from './common';
import type { Screen } from '../types';

/** Gutter the rail's blocks stretch between. Expanded only. */
const RAIL_GUTTER_PX = 16;
const RAIL_COLLAPSED_PX = 64;

const NAV: { key: Screen; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'ask-neo', label: 'Ask Neo', Icon: ChatCircleIcon },
  { key: 'queue', label: 'Invoices', Icon: FilesIcon },
  { key: 'reporting', label: 'Reporting', Icon: ChartLineIcon },
  { key: 'members', label: 'Members', Icon: UsersThreeIcon },
];

const FOOTER_NAV: typeof NAV = [
  { key: 'config', label: 'Configuration', Icon: GearSixIcon },
  { key: 'connections', label: 'Connections', Icon: PlugsConnectedIcon },
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

function NavRail() {
  const { screen, goTo, profile, invoices } = useStore();
  const { collapsed } = React.useContext(ShellContext);
  const [switcherAnchor, setSwitcherAnchor] = React.useState<HTMLElement | null>(null);
  const [userAnchor, setUserAnchor] = React.useState<HTMLElement | null>(null);
  const [newWorkspaceOpen, setNewWorkspaceOpen] = React.useState(false);
  const [newName, setNewName] = React.useState('');

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
        <MenuItem onClick={() => { setUserAnchor(null); goTo('config'); }}>
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
          <TextField
            label="Workspace name"
            placeholder="AP — North America"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            helperText="Must be unique within your organisation."
            fullWidth
          />
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
 * The shell: the rail owns the full height and the bar starts where the rail
 * ends, so the outer box is a row — rail, then a column.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const value = React.useMemo(
    () => ({ collapsed, toggleCollapsed: () => setCollapsed((previous) => !previous) }),
    [collapsed],
  );

  return (
    <ShellContext.Provider value={value}>
      <Stack direction="row" sx={{ height: '100vh' }}>
        <NavRail />
        <Stack sx={{ flex: 1, minWidth: 0 }}>{children}</Stack>
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
      <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
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
}: {
  title: string;
  meta: { icon?: React.ReactNode; label: string }[];
  actions?: React.ReactNode;
}) {
  const { collapsed, toggleCollapsed } = React.useContext(ShellContext);
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

      <NavbarTitle meta={meta} sx={{ ml: 3 }}>
        {title}
      </NavbarTitle>

      <Box sx={{ flex: 1 }} />

      <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
        {actions}
        <ColorModeToggle />
      </Stack>
    </Navbar>
  );
}

export const META_ICON_PX = META_PX;
