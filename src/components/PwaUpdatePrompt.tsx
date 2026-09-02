import { useEffect, useState } from 'react';
import { Hotel, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppUpdate } from '@/hooks/useAppUpdate';

export function PwaUpdatePrompt() {
  const { updateAvailable, applyUpdate } = useAppUpdate();
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!updateAvailable) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [updateAvailable]);

  if (!updateAvailable) return null;

  const handleUpdate = async () => {
    setUpdating(true);
    await applyUpdate();
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="pwa-update-title"
      aria-describedby="pwa-update-description"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 p-6 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Hotel className="h-7 w-7" />
        </div>
        <h2 id="pwa-update-title" className="text-lg font-semibold">
          Update required
        </h2>
        <p id="pwa-update-description" className="mt-2 text-sm text-muted-foreground">
          A new version of HotelFlow is available. You must update to continue using the app.
        </p>
        <Button className="mt-6 w-full" size="lg" disabled={updating} onClick={() => void handleUpdate()}>
          <RefreshCw className={`h-4 w-4 ${updating ? 'animate-spin' : ''}`} />
          {updating ? 'Updating...' : 'Update app'}
        </Button>
      </div>
    </div>
  );
}
