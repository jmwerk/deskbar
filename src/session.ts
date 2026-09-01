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

/**
 * Seconds actually spent running (not paused) so far. Used both for the
 * live countdown and for how much time gets logged if the session ends
 * early — paused time shouldn't count toward either.
 */
export function activeElapsedS(focus: FocusSession, now: number): number {
  const pausedMs = focus.pausedMs ?? 0;
  const ongoingPauseMs = focus.pausedAt ? now - focus.pausedAt : 0;
  return (now - focus.startedAt - pausedMs - ongoingPauseMs) / 1000;
}

export type SessionState = {
  status: Status;
  focus?: FocusSession;
};

const STORE_KEY = 'deskbar/session';

const DEFAULT_STATE: SessionState = { status: 'available' };

/** Load the persisted status/timer, so a reload or reboot mid-focus-session doesn't lose it. */
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
