import { formatDuration, formatWallClock, wallParts } from './format';

/** Nearest whole step, never below one step, so a short session still logs something. */
export function roundWorklogSeconds(seconds: number, stepMinutes: number): number {
  if (!stepMinutes) return seconds;
  const step = stepMinutes * 60;
  return Math.max(step, Math.round(seconds / step) * step);
}

// Targets are usually whole hours, where "6h 0m" reads worse than "6h".
const short = (seconds: number) => formatDuration(seconds).replace(/ 0m$/, '');

/** True once the clock has passed `nudgeAt` (HH:MM) today. */
export function pastNudgeTime(now: number, nudgeAt: string, timeZone?: string): boolean {
  const [h, m] = nudgeAt.split(':').map(Number);
  const wall = wallParts(now, timeZone);
  return wall.h * 60 + wall.m >= h * 60 + m;
}

/** A gap shorter than this isn't worth interrupting for. */
export const NUDGE_MIN_GAP_S = 30 * 60;

/** What the end-of-day nudge says, or null when today's logging looks complete. */
export function nudgeMessage({
  now,
  todaySeconds,
  lastLoggedAt,
  dailyTargetS,
  timeZone,
  hour12,
}: {
  now: number;
  todaySeconds: number;
  lastLoggedAt?: number;
  dailyTargetS: number;
  timeZone?: string;
  hour12: boolean;
}): string | null {
  if (dailyTargetS > 0) {
    if (todaySeconds >= dailyTargetS) return null;
    return `${short(dailyTargetS - todaySeconds)} short of your ${short(dailyTargetS)} today`;
  }
  if (lastLoggedAt === undefined) return 'Nothing logged today yet';
  if ((now - lastLoggedAt) / 1000 < NUDGE_MIN_GAP_S) return null;
  return `Unlogged since ${formatWallClock(lastLoggedAt, timeZone, hour12)}`;
}

/** Home's line about the daily target: what's left, or that it's met. */
export function targetProgress(todaySeconds: number, dailyTargetS: number): string | null {
  if (dailyTargetS <= 0) return null;
  if (todaySeconds >= dailyTargetS) return `${short(dailyTargetS)} target met`;
  return `${short(dailyTargetS - todaySeconds)} to go of ${short(dailyTargetS)}`;
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
