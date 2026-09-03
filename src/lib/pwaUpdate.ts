export const PWA_UPDATE_RELOAD_KEY = 'pwa-update-reload';

export function cacheBustReload() {
  const url = new URL(window.location.href);
  url.searchParams.delete('_sw');
  url.searchParams.set('_sw', String(Date.now()));
  window.location.replace(url.toString());
}

export function markPwaUpdateReload() {
  sessionStorage.setItem(PWA_UPDATE_RELOAD_KEY, String(Date.now()));
}

export function isRecentPwaUpdateReload(maxAgeMs = 15_000) {
  const ts = sessionStorage.getItem(PWA_UPDATE_RELOAD_KEY);
  if (!ts) return false;
  return Date.now() - Number(ts) < maxAgeMs;
}

export function clearPwaUpdateReload() {
  sessionStorage.removeItem(PWA_UPDATE_RELOAD_KEY);
}

export async function forcePwaRefresh() {
  markPwaUpdateReload();
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  } catch {
    return;
  }
  cacheBustReload();
}

export async function recoverStalePwaAfterFailedUpdate() {
  clearPwaUpdateReload();
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) await reg.unregister();
  } catch {
    return;
  }
  window.location.replace(`${window.location.origin}${window.location.pathname}`);
}

export function cleanPwaReloadParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('_sw')) return;
  url.searchParams.delete('_sw');
  window.history.replaceState(null, '', url.toString());
}
