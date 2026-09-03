import { useCallback, useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { router } from '@/router';
import {
  cacheBustReload,
  clearPwaUpdateReload,
  isRecentPwaUpdateReload,
  markPwaUpdateReload,
  recoverStalePwaAfterFailedUpdate,
} from '@/lib/pwaUpdate';

function hasWaitingWorker(registration?: ServiceWorkerRegistration) {
  return Boolean(registration?.waiting && navigator.serviceWorker.controller);
}

async function fetchDeployedVersion() {
  const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) return null;
  const data = (await response.json()) as { version?: string };
  return data.version ?? null;
}

async function waitForWaitingWorker(reg: ServiceWorkerRegistration, timeoutMs = 4000) {
  if (hasWaitingWorker(reg)) return true;

  return new Promise<boolean>((resolve) => {
    let settled = false;

    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      reg.removeEventListener('updatefound', onUpdateFound);
      window.clearTimeout(timeout);
      resolve(value);
    };

    const onUpdateFound = () => {
      const installing = reg.installing;
      if (!installing) return;

      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed') finish(hasWaitingWorker(reg));
      });
    };

    reg.addEventListener('updatefound', onUpdateFound);
    const timeout = window.setTimeout(() => finish(hasWaitingWorker(reg)), timeoutMs);
  });
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

  const clearUpdateAvailable = useCallback(() => {
    setSwNeedRefresh(false);
    setUpdateAvailable(false);
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

    let deployedVersion: string | null = null;
    try {
      deployedVersion = await fetchDeployedVersion();
    } catch {
      return;
    }

    if (deployedVersion && deployedVersion === __BUILD_ID__) {
      clearPwaUpdateReload();
      clearUpdateAvailable();
      return;
    }

    if (deployedVersion && deployedVersion !== __BUILD_ID__) {
      if (isRecentPwaUpdateReload()) {
        await recoverStalePwaAfterFailedUpdate();
        return;
      }

      if (reg && !reg.waiting && !reg.installing) {
        try {
          await reg.update();
        } catch {
          return;
        }
      }

      if (reg && (reg.installing || (!reg.waiting && !reg.installing))) {
        await waitForWaitingWorker(reg);
      }

      if (hasWaitingWorker(reg) || !reg?.installing) {
        markUpdateAvailable();
      }
      return;
    }

    syncWaitingWorker(reg);

    if (!reg || reg.installing || reg.waiting) return;

    try {
      await reg.update();
    } catch {
      return;
    }

    syncWaitingWorker(reg);
  }, [
    clearUpdateAvailable,
    markUpdateAvailable,
    registration,
    syncWaitingWorker,
  ]);

  const applyUpdate = useCallback(async () => {
    markPwaUpdateReload();

    let reloaded = false;
    const doReload = () => {
      if (reloaded) return;
      reloaded = true;
      cacheBustReload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', doReload, { once: true });

    const reg = registration ?? (await navigator.serviceWorker.getRegistration()) ?? undefined;

    if (reg?.waiting) {
      await updateServiceWorker(true);
    } else if (reg) {
      try {
        await reg.update();
      } catch {
        doReload();
        return;
      }
    }

    window.setTimeout(doReload, 1500);
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
