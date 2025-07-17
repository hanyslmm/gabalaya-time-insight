import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WifiOff, Wifi, CloudOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { checkOnlineStatus, subscribeToOnlineStatus, getOfflineActions } from '@/utils/pwa';
import { motion, AnimatePresence } from 'framer-motion';

const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(checkOnlineStatus());
  const [showOfflineAlert, setShowOfflineAlert] = useState(false);
  const [offlineActionsCount, setOfflineActionsCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToOnlineStatus((online) => {
      setIsOnline(online);
      
      if (!online) {
        setShowOfflineAlert(true);
      } else {
        // When coming back online, hide alert after a delay
        setTimeout(() => setShowOfflineAlert(false), 3000);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const updateOfflineActionsCount = async () => {
      try {
        const actions = await getOfflineActions();
        setOfflineActionsCount(actions.length);
      } catch (error) {
        console.error('Failed to get offline actions:', error);
      }
    };

    updateOfflineActionsCount();
    
    // Update count periodically
    const interval = setInterval(updateOfflineActionsCount, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);
    
    // Simulate retry delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if we're back online
    const online = navigator.onLine;
    setIsOnline(online);
    setIsRetrying(false);
    
    if (online) {
      setShowOfflineAlert(false);
    }
  };

  return (
    <>
      {/* Connection Status Badge */}
      <div className="fixed top-4 right-4 z-50">
        <Badge 
          variant={isOnline ? "default" : "destructive"}
          className={cn(
            "flex items-center gap-1 transition-all duration-300",
            isOnline ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"
          )}
        >
          {isOnline ? (
            <Wifi className="w-3 h-3" />
          ) : (
            <WifiOff className="w-3 h-3" />
          )}
          {isOnline ? 'Online' : 'Offline'}
          {offlineActionsCount > 0 && (
            <span className="ml-1 bg-white/20 px-1 rounded text-xs">
              {offlineActionsCount}
            </span>
          )}
        </Badge>
      </div>

      {/* Offline Alert */}
      <AnimatePresence>
        {showOfflineAlert && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-16 left-4 right-4 z-40 md:left-auto md:right-4 md:w-96"
          >
            <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
              <CloudOff className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <AlertDescription className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium text-orange-800 dark:text-orange-200">
                    You're offline
                  </p>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    {offlineActionsCount > 0 
                      ? `${offlineActionsCount} actions will sync when online`
                      : 'Some features may be limited'
                    }
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="ml-2 border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900"
                >
                  {isRetrying ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    'Retry'
                  )}
                </Button>
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Offline Actions Indicator */}
      {offlineActionsCount > 0 && isOnline && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed bottom-20 left-4 right-4 z-40 md:left-auto md:right-4 md:w-80"
        >
          <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
            <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
            <AlertDescription>
              <p className="font-medium text-blue-800 dark:text-blue-200">
                Syncing offline actions...
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {offlineActionsCount} actions pending
              </p>
            </AlertDescription>
          </Alert>
        </motion.div>
      )}
    </>
  );
};

export default OfflineIndicator;