import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { PwaUpdatePrompt } from '@/components/PwaUpdatePrompt';
import { ThemeProvider } from '@/hooks/useTheme';
import { AuthProvider } from '@/hooks/useAuth';
import { ConfirmProvider } from '@/components/shared/ConfirmDialog';
import { router } from '@/router';
import { bootstrapDataLayer } from '@/services/api';
import { isSupabaseConfigured } from '@/lib/supabase';
import { clearChunkReloadFlag, isChunkLoadError, reloadForStaleChunk } from '@/lib/chunkLoadError';
import { cleanPwaReloadParam } from '@/lib/pwaUpdate';
import './index.css';

clearChunkReloadFlag();
cleanPwaReloadParam();

window.addEventListener('unhandledrejection', (event) => {
  if (isChunkLoadError(event.reason)) {
    event.preventDefault();
    reloadForStaleChunk();
  }
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

async function startApp() {
  if (isSupabaseConfigured()) {
    await bootstrapDataLayer();
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ConfirmProvider>
              <RouterProvider router={router} />
              <Toaster richColors position="top-right" />
              <PwaUpdatePrompt />
            </ConfirmProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}

void startApp();
