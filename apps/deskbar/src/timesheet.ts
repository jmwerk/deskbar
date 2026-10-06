import { formatWallClock } from './format';

/** Nearest whole step, never below one step, so a short session still logs something. */
export function roundWorklogSeconds(seconds: number, stepMinutes: number): number {
  if (!stepMinutes) return seconds;
  const step = stepMinutes * 60;
  return Math.max(step, Math.round(seconds / step) * step);
}

/** Where the ledger's sync with the tracker stands; `at` is the last success. */
export type SyncState = { status: 'idle' | 'syncing' | 'error'; at?: number };

/** Home's sync line: how fresh the ledger is, in the words a glance needs. */
export function syncLabel(sync: SyncState, now: number, timeZone?: string, hour12 = true): string {
  if (sync.status === 'syncing') return 'Syncing…';
  if (sync.status === 'error') return "Couldn't sync, tap to retry";
  if (sync.at === undefined) return 'Tap to sync';
  const minutes = Math.floor((now - sync.at) / 60_000);
  if (minutes < 1) return 'Synced just now';
  if (minutes < 60) return `Synced ${minutes} min ago`;
  return `Synced at ${formatWallClock(sync.at, timeZone, hour12)}`;
}
