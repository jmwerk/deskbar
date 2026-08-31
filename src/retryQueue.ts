import { client } from './bridgething';

/**
 * A worklog that failed to log to Jira when a focus session ended. Session
 * end already flips status back to available and returns to Home before
 * the log attempt runs, so a failure there has nowhere to retry from in
 * the moment — the elapsed time would just be gone once the toast fades.
 * Log Time Now doesn't need this: a failure there leaves the user on
 * screen with the same issue/duration still selected, ready to retry by
 * hand, so nothing's actually at risk of being lost.
 */
export type PendingWorklog = {
  id: string;
  issueKey: string;
  issueSummary?: string;
  seconds: number;
  createdAt: number; // unix ms, when the session actually ended
};

const STORE_KEY = 'deskbar/pendingWorklogs';

export async function loadPendingWorklogs(): Promise<PendingWorklog[]> {
  const res = await client.store.get({ key: STORE_KEY });
  if (!res.ok || !res.response.value) return [];
  try {
    const parsed = JSON.parse(res.response.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function savePendingWorklogs(entries: PendingWorklog[]): Promise<void> {
  await client.store.put({ key: STORE_KEY, value: JSON.stringify(entries) });
}

export async function queuePendingWorklog(entry: Omit<PendingWorklog, 'id'>): Promise<void> {
  const existing = await loadPendingWorklogs();
  await savePendingWorklogs([...existing, { ...entry, id: crypto.randomUUID() }]);
}

export async function removePendingWorklog(id: string): Promise<void> {
  const existing = await loadPendingWorklogs();
  await savePendingWorklogs(existing.filter(e => e.id !== id));
}
