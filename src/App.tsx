import { StoreProvider, useStore } from './store';
import { AppShell } from './components/shell';
import { ScenarioSwitcher } from './components/ScenarioSwitcher';
import { ProfileScreen, RoutingScreen, SignInScreen } from './screens/Onboarding';
import { AskNeoScreen } from './screens/AskNeo';
import { QueueScreen } from './screens/Queue';
import { InvoiceDetailScreen } from './screens/InvoiceDetail';
import { WorkflowConfigScreen, WorkspaceConfigScreen } from './screens/Settings';
import { MembersScreen } from './screens/People';
import { ReportingScreen } from './screens/Reporting';
import { DocumentationScreen } from './screens/Documentation';

function Router() {
  const { screen, profile } = useStore();

  // The onboarding screens carry no app chrome.
  // Keyed on the staged address: a scenario applied while already on this screen
  // would otherwise leave the form holding its own local state.
  if (screen === 'signin') return <SignInScreen key={profile.email} />;
  if (screen === 'routing') return <RoutingScreen />;
  if (screen === 'profile') return <ProfileScreen />;

  return (
    <AppShell>
      {screen === 'ask-neo' && <AskNeoScreen />}
      {screen === 'queue' && <QueueScreen />}
      {screen === 'invoice' && <InvoiceDetailScreen />}
      {screen === 'workflow-config' && <WorkflowConfigScreen />}
      {screen === 'workspace-config' && <WorkspaceConfigScreen />}
      {screen === 'members' && <MembersScreen />}
      {screen === 'reporting' && <ReportingScreen />}
      {screen === 'documentation' && <DocumentationScreen />}
    </AppShell>
  );
}

export function App() {
  return (
    <StoreProvider>
      <Router />
      {/* Demo aid. Remove this line and scenarios.ts / ScenarioSwitcher.tsx to strip it. */}
      <ScenarioSwitcher />
    </StoreProvider>
  );
}
