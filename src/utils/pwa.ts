// PWA utility functions for service worker registration and offline functionality

export const registerServiceWorker = async (): Promise<void> => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('SW registered: ', registration);
      
      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available, show update notification
              showUpdateNotification();
            }
          });
        }
      });
    } catch (error) {
      console.log('SW registration failed: ', error);
    }
  }
};

export const showUpdateNotification = (): void => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('App Update Available', {
      body: 'A new version of the app is available. Please refresh to update.',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: 'app-update'
    });
  }
};

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    return permission;
  }
  return 'denied';
};

export const checkOnlineStatus = (): boolean => {
  return navigator.onLine;
};

export const subscribeToOnlineStatus = (callback: (isOnline: boolean) => void): (() => void) => {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};

// Dev-only helper: fully unregister any existing service workers and clear caches
export const unregisterServiceWorkersDev = async (): Promise<void> => {
  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) {
        await r.unregister();
      }
    } catch (err) {
      console.warn('SW unregister failed:', err);
    }
  }
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      for (const k of keys) {
        await caches.delete(k);
      }
    } catch (err) {
      console.warn('Cache clear failed:', err);
    }
  }
};

// IndexedDB utilities for offline storage
export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('timesheet-offline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create actions store for offline actions
      if (!db.objectStoreNames.contains('actions')) {
        const actionsStore = db.createObjectStore('actions', { keyPath: 'id', autoIncrement: true });
        actionsStore.createIndex('timestamp', 'timestamp', { unique: false });
        actionsStore.createIndex('type', 'type', { unique: false });
      }
      
      // Create cache store for offline data
      if (!db.objectStoreNames.contains('cache')) {
        const cacheStore = db.createObjectStore('cache', { keyPath: 'key' });
        cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
};

export const saveOfflineAction = async (action: any): Promise<void> => {
  const db = await openDB();
  const transaction = db.transaction(['actions'], 'readwrite');
  const store = transaction.objectStore('actions');
  
  const actionWithTimestamp = {
    ...action,
    timestamp: Date.now(),
    synced: false
  };
  
  store.add(actionWithTimestamp);
};

export const getOfflineActions = async (): Promise<any[]> => {
  const db = await openDB();
  const transaction = db.transaction(['actions'], 'readonly');
  const store = transaction.objectStore('actions');
  
  return new Promise((resolve) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
  });
};

export const clearOfflineActions = async (): Promise<void> => {
  const db = await openDB();
  const transaction = db.transaction(['actions'], 'readwrite');
  const store = transaction.objectStore('actions');
  store.clear();
};

// Install prompt handling
let deferredPrompt: any = null;

export const setupInstallPrompt = (): void => {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });
};

export const showInstallPrompt = async (): Promise<boolean> => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    deferredPrompt = null;
    return result.outcome === 'accepted';
  }
  return false;
};

export const isInstalled = (): boolean => {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true;
};

// Haptic feedback for mobile devices
export const vibrate = (pattern: number | number[]): void => {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

// Performance monitoring
export const measurePerformance = (name: string, fn: () => void): void => {
  if ('performance' in window) {
    const startTime = performance.now();
    fn();
    const endTime = performance.now();
    console.log(`${name} took ${endTime - startTime} milliseconds`);
  } else {
    fn();
  }
};