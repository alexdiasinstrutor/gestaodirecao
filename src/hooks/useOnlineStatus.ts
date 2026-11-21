import { getPendingWrites } from '../lib/cloudOutbox';
import { useState, useEffect, useCallback } from 'react';
import { db, syncFromSupabase } from '../lib/storage';
import { retryDataBackups } from '../lib/dataHistory';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const checkPendingQueue = useCallback(() => {
    const list = (key: string) => { try { return JSON.parse(localStorage.getItem(key) || '[]').length; } catch { return 0; } };
    const saas = ['DEMO', 'BASICO', 'AVANCADO', 'MASTER'].filter(id => localStorage.getItem('agd_pending_saas_' + id)).length;
    setPendingCount(getPendingWrites().length + db.getSyncQueue().length + list('agd_pending_packages') + list('agd_pending_signatures') + saas);
  }, []);
  const triggerSync = useCallback(async (): Promise<boolean> => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const result = await syncFromSupabase();
      if (!result.synced) {
        throw new Error(result.error || 'O banco não confirmou a sincronização.');
      }
      const user = db.getCurrentUser();
      if (user) {
        await retryDataBackups(user).catch(() => {});
      }
      if (result.failedCount && result.failedCount > 0) {
        setSyncError(`${result.failedCount} item(ns) pendente(s) de reenvio.`);
      }
      setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('agd:data-synced'));
      }
      return true;
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      checkPendingQueue();
      setIsSyncing(false);
    }
  }, [checkPendingQueue]);
  useEffect(() => {
    checkPendingQueue();
    const online = () => { setIsOnline(true); void triggerSync(); };
    const offline = () => { setIsOnline(false); checkPendingQueue(); };
    window.addEventListener('online', online); window.addEventListener('offline', offline);
    window.addEventListener('agd:data-synced', checkPendingQueue);
    const interval = setInterval(checkPendingQueue, 3000);
    return () => { clearInterval(interval); window.removeEventListener('online', online); window.removeEventListener('offline', offline); window.removeEventListener('agd:data-synced', checkPendingQueue); };
  }, [checkPendingQueue, triggerSync]);
  return { isOnline, isSyncing, pendingCount, lastSyncTime, syncError, triggerSync, checkPendingQueue };
}
