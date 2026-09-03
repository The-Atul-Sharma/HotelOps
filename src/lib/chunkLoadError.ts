export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const { message } = error;
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('error loading dynamically imported module') ||
    message.includes('Loading chunk') ||
    message.includes('Loading CSS chunk')
  );
}

const CHUNK_RELOAD_KEY = 'chunk-reload';

export function reloadForStaleChunk(): boolean {
  if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return false;
  sessionStorage.setItem(CHUNK_RELOAD_KEY, 'true');
  const url = new URL(window.location.href);
  url.searchParams.delete('_sw');
  url.searchParams.set('_sw', String(Date.now()));
  window.location.replace(url.toString());
  return true;
}

export function clearChunkReloadFlag(): void {
  sessionStorage.removeItem(CHUNK_RELOAD_KEY);
}
