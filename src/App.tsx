import { StoreProvider, useStore } from './store';
import { AppShell } from './components/shell';
import { ProfileScreen, RoutingScreen, SignupScreen } from './screens/Onboarding';
import { AskNeoScreen } from './screens/AskNeo';
import { QueueScreen } from './screens/Queue';
import { InvoiceDetailScreen } from './screens/InvoiceDetail';
import { ConfigScreen, ConnectionsScreen } from './screens/Settings';
import { MembersScreen, ReportingScreen } from './screens/People';

function Router() {
  const { screen } = useStore();

  // The onboarding screens carry no app chrome.
  if (screen === 'signup') return <SignupScreen />;
  if (screen === 'routing') return <RoutingScreen />;
  if (screen === 'profile') return <ProfileScreen />;

  return (
    <AppShell>
      {screen === 'ask-neo' && <AskNeoScreen />}
      {screen === 'queue' && <QueueScreen />}
      {screen === 'invoice' && <InvoiceDetailScreen />}
      {screen === 'config' && <ConfigScreen />}
      {screen === 'connections' && <ConnectionsScreen />}
      {screen === 'members' && <MembersScreen />}
      {screen === 'reporting' && <ReportingScreen />}
    </AppShell>
  );
}

export function App() {
  return (
    <StoreProvider>
      <Router />
    </StoreProvider>
  );
}
