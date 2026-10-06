import { useEffect } from 'react';
import { AppState } from 'react-native';

import { track } from './analytics';
import { api } from './api';

// The backend re-syncs every LMS every 3 hours; opening the app pulls changes right away so a due
// date a professor just moved is right when the student looks. Throttled so tab switches are free.
const MIN_GAP_MS = 20 * 60 * 1000;
let lastSync = 0;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** Run after each completed LMS sync (e.g. to refetch deadlines on screen). */
export function onLmsSynced(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function syncLms(force = false): Promise<void> {
  if (inFlight) return inFlight;
  if (!force && Date.now() - lastSync < MIN_GAP_MS) return Promise.resolve();
  lastSync = Date.now();
  inFlight = api<{ synced_count: number }>('/lms/sync', { method: 'POST' })
    .then((r) => {
      if (r.synced_count > 0) {
        track('lms_foreground_sync', { synced: r.synced_count });
        listeners.forEach((fn) => fn());
      }
    })
    .catch(() => {})
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Sync on launch and whenever the app comes back to the foreground. */
export function useLmsForegroundSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    syncLms();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') syncLms();
    });
    return () => sub.remove();
  }, [enabled]);
}
