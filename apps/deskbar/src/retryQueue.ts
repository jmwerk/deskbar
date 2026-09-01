import { client } from './bridgething';

// Session end has nowhere to retry a failed log; Log Time Now keeps state for a manual retry.
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
