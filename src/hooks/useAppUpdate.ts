import { useCallback, useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { router } from '@/router';

function hasWaitingWorker(registration?: ServiceWorkerRegistration) {
  return Boolean(registration?.waiting && navigator.serviceWorker.controller);
}

async function fetchDeployedVersion() {
  const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) return null;
  const data = (await response.json()) as { version?: string };
  return data.version ?? null;
}

export function useAppUpdate() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const {
    needRefresh: [swNeedRefresh, setSwNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onNeedRefresh() {
      setSwNeedRefresh(true);
      setUpdateAvailable(true);
    },
    onRegisteredSW(_swUrl, reg) {
      if (reg) setRegistration(reg);
    },
  });

  const markUpdateAvailable = useCallback(() => {
    setSwNeedRefresh(true);
    setUpdateAvailable(true);
  }, [setSwNeedRefresh]);

  const syncWaitingWorker = useCallback(
    (reg = registration) => {
      if (hasWaitingWorker(reg)) markUpdateAvailable();
    },
    [markUpdateAvailable, registration],
  );

  const checkForUpdates = useCallback(async () => {
    const reg = registration ?? (await navigator.serviceWorker.getRegistration()) ?? undefined;
    if (reg && !registration) setRegistration(reg);

    syncWaitingWorker(reg);

    try {
      const deployedVersion = await fetchDeployedVersion();
      if (deployedVersion && deployedVersion !== __BUILD_ID__) {
        markUpdateAvailable();
        if (reg && !reg.waiting) {
          await reg.update();
          syncWaitingWorker(reg);
        }
        return;
      }
    } catch {
      return;
    }

    if (!reg || reg.installing || reg.waiting) return;
    await reg.update();
    syncWaitingWorker(reg);
  }, [markUpdateAvailable, registration, syncWaitingWorker]);

  const applyUpdate = useCallback(async () => {
    const reload = () => window.location.reload();

    navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });

    const reg = registration ?? (await navigator.serviceWorker.getRegistration()) ?? undefined;

    if (reg?.waiting) {
      await updateServiceWorker(true);
      window.setTimeout(reload, 1500);
      return;
    }

    if (reg) await reg.update();
    reload();
  }, [registration, updateServiceWorker]);

  useEffect(() => {
    if (swNeedRefresh) setUpdateAvailable(true);
  }, [swNeedRefresh]);

  useEffect(() => {
    if (!registration) return;

    const onUpdateFound = () => {
      const installing = registration.installing;
      if (!installing) return;

      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed') syncWaitingWorker(registration);
      });
    };

    registration.addEventListener('updatefound', onUpdateFound);
    syncWaitingWorker(registration);

    return () => registration.removeEventListener('updatefound', onUpdateFound);
  }, [registration, syncWaitingWorker]);

  useEffect(() => {
    void checkForUpdates();

    const onResume = () => void checkForUpdates();

    window.addEventListener('focus', onResume);
    window.addEventListener('pageshow', onResume);
    window.addEventListener('online', onResume);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onResume();
    });

    const unsubscribe = router.subscribe(() => {
      void checkForUpdates();
    });

    return () => {
      window.removeEventListener('focus', onResume);
      window.removeEventListener('pageshow', onResume);
      window.removeEventListener('online', onResume);
      unsubscribe();
    };
  }, [checkForUpdates]);

  return {
    updateAvailable,
    applyUpdate,
  };
}
