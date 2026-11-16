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
  const triggerSync = useCallback(async () => {
    setIsSyncing(true); setSyncError(null);
    try {
      const result = await syncFromSupabase();
      if (!result.synced) throw new Error('O banco não confirmou a sincronização.');
      const user = db.getCurrentUser();
      if (user) await retryDataBackups(user);
      setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
    } catch (error) { setSyncError(String(error)); }
    finally { checkPendingQueue(); setIsSyncing(false); }
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
