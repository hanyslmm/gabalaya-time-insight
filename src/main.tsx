import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ThemeProvider } from '@/components/ThemeProvider'
import './index.css'
import { registerServiceWorker, setupInstallPrompt, requestNotificationPermission } from './utils/pwa'
import { setupMobileViewport } from './utils/mobileOptimization'

// Register service worker for PWA functionality
registerServiceWorker();

// Setup install prompt
setupInstallPrompt();

// Request notification permission
requestNotificationPermission();

// Setup mobile viewport and optimizations
setupMobileViewport();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="system" storageKey="champtime-ui-theme">
    <App />
  </ThemeProvider>
);
