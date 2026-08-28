import { client } from './bridgething';

export type Status = 'available' | 'busy' | 'focus';

export type FocusSession = {
  startedAt: number; // unix ms
  durationS: number;
  issueKey?: string;
  issueSummary?: string;
};

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
