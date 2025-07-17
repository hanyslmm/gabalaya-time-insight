import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ThemeProvider } from '@/components/ThemeProvider'
import './index.css'
import { registerServiceWorker, setupInstallPrompt, requestNotificationPermission } from './utils/pwa'

// Register service worker for PWA functionality
registerServiceWorker();

// Setup install prompt
setupInstallPrompt();

// Request notification permission
requestNotificationPermission();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="system" storageKey="gabalaya-ui-theme">
    <App />
  </ThemeProvider>
);
