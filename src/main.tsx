import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ThemeProvider } from '@/components/ThemeProvider'
import './index.css'
import { registerServiceWorker, setupInstallPrompt, requestNotificationPermission, unregisterServiceWorkersDev } from './utils/pwa'
import { setupMobileViewport } from './utils/mobileOptimization'

// Register service worker for PWA functionality (production only)
if (import.meta.env.PROD) {
  registerServiceWorker();
  // Setup install prompt
  setupInstallPrompt();
  // Request notification permission
  requestNotificationPermission();
}
// In development, ensure any previously installed SWs are removed to prevent offline overlays
if (import.meta.env.DEV) {
  unregisterServiceWorkersDev();
}

// Setup mobile viewport and optimizations
setupMobileViewport();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="system" storageKey="champtime-ui-theme">
    <App />
  </ThemeProvider>
);
