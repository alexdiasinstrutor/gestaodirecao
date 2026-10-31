import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/storage';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const checkPendingQueue = useCallback(() => {
    const queue = db.getSyncQueue();
    setPendingCount(queue.length);
  }, []);

  const triggerSync = useCallback(async () => {
    const queue = db.getSyncQueue();
    if (queue.length === 0) return;

    setIsSyncing(true);
    // Simulate real cloud synchronization round-trip with backend
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // Clear queue after successful synchronization
    db.clearSyncQueue();
    setPendingCount(0);
    setIsSyncing(false);
    setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
  }, []);

  useEffect(() => {
    checkPendingQueue();

    const handleOnline = () => {
      setIsOnline(true);
      // Automatically synchronize queued items when returning online
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      checkPendingQueue();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(checkPendingQueue, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [checkPendingQueue, triggerSync]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncTime,
    triggerSync,
    checkPendingQueue
  };
}
