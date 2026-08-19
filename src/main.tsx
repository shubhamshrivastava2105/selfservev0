import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { NeofloThemeProvider, SnackbarProvider } from '@neofloai/atoms';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NeofloThemeProvider defaultMode="light">
      <SnackbarProvider>
        <App />
      </SnackbarProvider>
    </NeofloThemeProvider>
  </StrictMode>,
);
