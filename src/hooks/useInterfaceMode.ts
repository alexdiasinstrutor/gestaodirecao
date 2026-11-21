import { useState, useEffect, useCallback } from 'react';

export type DeviceInterfaceType = 'MOBILE' | 'TABLET' | 'DESKTOP';
export type ViewComplexityMode = 'SIMPLIFIED' | 'FULL';

const STORAGE_KEY_OVERRIDE = 'agd_interface_mode_override';

function detectDeviceType(width: number): DeviceInterfaceType {
  if (width < 768) return 'MOBILE';
  if (width < 1024) return 'TABLET';
  return 'DESKTOP';
}

export function useInterfaceMode() {
  const [windowWidth, setWindowWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );

  const [deviceType, setDeviceType] = useState<DeviceInterfaceType>(() =>
    detectDeviceType(typeof window !== 'undefined' ? window.innerWidth : 1280)
  );

  // User manual override ('SIMPLIFIED' | 'FULL' | null for automatic based on device)
  // Persisted in localStorage (with fallback read from sessionStorage) so setup is never lost across restarts/deploys.
  const [manualOverride, setManualOverride] = useState<ViewComplexityMode | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const persistent = localStorage.getItem(STORAGE_KEY_OVERRIDE);
      if (persistent === 'SIMPLIFIED' || persistent === 'FULL') return persistent;
      const legacySession = sessionStorage.getItem(STORAGE_KEY_OVERRIDE);
      if (legacySession === 'SIMPLIFIED' || legacySession === 'FULL') {
        localStorage.setItem(STORAGE_KEY_OVERRIDE, legacySession);
        return legacySession;
      }
    } catch {
      // ignore storage errors
    }
    return null;
  });

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      setWindowWidth(w);
      setDeviceType(detectDeviceType(w));
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Effective view mode: if user clicked "Modo Normal" or "Modo Simplificado", respect it;
  // otherwise default to SIMPLIFIED on MOBILE and FULL on TABLET/DESKTOP.
  const viewMode: ViewComplexityMode =
    manualOverride ?? (deviceType === 'MOBILE' ? 'SIMPLIFIED' : 'FULL');

  const isSimplified = viewMode === 'SIMPLIFIED';

  const setViewMode = useCallback((mode: ViewComplexityMode) => {
    setManualOverride(mode);
    try {
      localStorage.setItem(STORAGE_KEY_OVERRIDE, mode);
      sessionStorage.setItem(STORAGE_KEY_OVERRIDE, mode);
    } catch {
      // ignore storage errors
    }
    window.dispatchEvent(new CustomEvent('agd-view-mode-change', { detail: mode }));
  }, []);

  const toggleViewMode = useCallback(() => {
    const next: ViewComplexityMode = isSimplified ? 'FULL' : 'SIMPLIFIED';
    setViewMode(next);
  }, [isSimplified, setViewMode]);

  const resetToAutoDevice = useCallback(() => {
    setManualOverride(null);
    try {
      localStorage.removeItem(STORAGE_KEY_OVERRIDE);
      sessionStorage.removeItem(STORAGE_KEY_OVERRIDE);
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent('agd-view-mode-change', { detail: null }));
  }, []);

  // Sync across components listening to the same hook
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<ViewComplexityMode | null>;
      setManualOverride(custom.detail);
    };
    window.addEventListener('agd-view-mode-change', handler);
    return () => window.removeEventListener('agd-view-mode-change', handler);
  }, []);

  const deviceLabel =
    deviceType === 'MOBILE'
      ? 'Mobile'
      : deviceType === 'TABLET'
      ? 'Tablet'
      : 'Desktop';

  return {
    deviceType,
    deviceLabel,
    windowWidth,
    viewMode,
    isSimplified,
    isMobileDevice: deviceType === 'MOBILE',
    isTabletDevice: deviceType === 'TABLET',
    isDesktopDevice: deviceType === 'DESKTOP',
    hasManualOverride: manualOverride !== null,
    setViewMode,
    toggleViewMode,
    resetToAutoDevice
  };
}

