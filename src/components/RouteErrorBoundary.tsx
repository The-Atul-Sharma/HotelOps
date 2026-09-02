import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isChunkLoadError } from '@/lib/chunkLoadError';

export function RouteErrorBoundary() {
  const error = useRouteError();
  const chunkError = isChunkLoadError(error);

  let message = 'Something went wrong loading this page.';
  if (isRouteErrorResponse(error)) {
    message = error.statusText || message;
  } else if (error instanceof Error && !chunkError) {
    message = error.message;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="rounded-full bg-muted p-3 text-muted-foreground">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div className="max-w-sm space-y-1">
        <p className="font-medium">
          {chunkError ? 'Update available' : 'Unexpected error'}
        </p>
        <p className="text-sm text-muted-foreground">
          {chunkError
            ? 'A new version of the app was deployed. Refresh to continue.'
            : message}
        </p>
      </div>
      <Button onClick={() => window.location.reload()}>
        <RefreshCw className="h-4 w-4" />
        Refresh app
      </Button>
    </div>
  );
}
