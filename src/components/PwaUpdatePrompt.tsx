import { useEffect, useState } from 'react';
import { Hotel, RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';

const UPDATE_CHECK_MS = 60_000;

export function PwaUpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, reg) {
      if (reg) setRegistration(reg);
    },
  });

  useEffect(() => {
    if (!registration) return;

    const checkForUpdates = () => {
      if (registration.installing || registration.waiting) return;
      void registration.update();
    };

    const interval = window.setInterval(checkForUpdates, UPDATE_CHECK_MS);
    const onFocus = () => checkForUpdates();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkForUpdates();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [registration]);

  useEffect(() => {
    if (!needRefresh) return;
    document.body.style.paddingBottom = '4.5rem';
    return () => {
      document.body.style.paddingBottom = '';
    };
  }, [needRefresh]);

  if (!needRefresh) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 border-t bg-card px-4 py-3 shadow-lg sm:px-6"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Hotel className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">Update available</p>
          <p className="truncate text-xs text-muted-foreground">
            A new version of HotelFlow is ready. Refresh to get the latest changes.
          </p>
        </div>
      </div>
      <Button
        size="sm"
        className="shrink-0"
        onClick={() => void updateServiceWorker(true)}
      >
        <RefreshCw className="h-4 w-4" />
        Update app
      </Button>
    </div>
  );
}
