import { client } from './bridgething';

export type Status = 'available' | 'busy' | 'focus';

export type FocusSession = {
  startedAt: number; // unix ms
  /** Total planned seconds, or null for an unlimited/stopwatch-style session. */
  durationS: number | null;
  issueKey?: string;
  issueSummary?: string;
  /** unix ms when the current pause began, or null/absent while running. */
  pausedAt?: number | null;
  /** Total ms already spent paused across prior pauses this session. */
  pausedMs?: number;
};

// Active elapsed seconds (excludes pauses); clamped at 0 since a stale tick may precede startedAt.
export function activeElapsedS(focus: FocusSession, now: number): number {
  const pausedMs = focus.pausedMs ?? 0;
  const ongoingPauseMs = focus.pausedAt ? now - focus.pausedAt : 0;
  return Math.max(0, (now - focus.startedAt - pausedMs - ongoingPauseMs) / 1000);
}

export type SessionState = {
  status: Status;
  focus?: FocusSession;
};

const STORE_KEY = 'deskbar/session';

const DEFAULT_STATE: SessionState = { status: 'available' };

// Loads the persisted status/timer so a reload or reboot mid-session doesn't lose it.
export async function loadSession(): Promise<SessionState> {
  const res = await client.store.get({ key: STORE_KEY });
  if (!res.ok || !res.response.value) return DEFAULT_STATE;
  try {
    return { ...DEFAULT_STATE, ...JSON.parse(res.response.value) };
  } catch {
    return DEFAULT_STATE;
  }
}

export async function saveSession(state: SessionState): Promise<void> {
  await client.store.put({ key: STORE_KEY, value: JSON.stringify(state) });
}
