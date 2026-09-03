import { lazy, type ComponentType } from 'react';
import { isChunkLoadError, reloadForStaleChunk } from '@/lib/chunkLoadError';

export function lazyWithRetry<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const module = await importFn();
      return module;
    } catch (error) {
      if (isChunkLoadError(error)) {
        reloadForStaleChunk();
      }
      throw error;
    }
  });
}
