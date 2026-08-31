import { client } from './bridgething';

export type HistoryEntry = {
  id: string;
  issueKey: string;
  issueSummary?: string;
  seconds: number;
  loggedAt: number; // unix ms
  /** The Jira worklog this entry came from, if any — needed to delete it from Jira too. */
  worklogId?: string;
};

/** Fields the caller supplies; `id` is assigned when the entry is recorded. */
export type NewHistoryEntry = Omit<HistoryEntry, 'id'>;

const STORE_KEY = 'deskbar/history';

// A rolling buffer, not just "today" — old entries age out of the Today
// view on their own once the calendar day rolls over, this just bounds
// how much we ever write to on-device storage.
const MAX_ENTRIES = 100;

export async function loadHistory(): Promise<HistoryEntry[]> {
  const res = await client.store.get({ key: STORE_KEY });
  if (!res.ok || !res.response.value) return [];
  try {
    const parsed = JSON.parse(res.response.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveHistory(entries: HistoryEntry[]): Promise<HistoryEntry[]> {
  await client.store.put({ key: STORE_KEY, value: JSON.stringify(entries) });
  return entries;
}

/** Record a completed worklog and return the updated list. */
export async function appendHistoryEntry(entry: NewHistoryEntry): Promise<HistoryEntry[]> {
  const full: HistoryEntry = { ...entry, id: crypto.randomUUID() };
  const next = [full, ...(await loadHistory())].slice(0, MAX_ENTRIES);
  return saveHistory(next);
}

/** Drop an entry (after its Jira worklog, if any, has already been deleted). */
export async function removeHistoryEntry(id: string): Promise<HistoryEntry[]> {
  const next = (await loadHistory()).filter(e => e.id !== id);
  return saveHistory(next);
}

function isSameLocalDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

export function todayEntries(entries: HistoryEntry[], now = Date.now()): HistoryEntry[] {
  return entries.filter(e => isSameLocalDay(e.loggedAt, now));
}

export function totalSeconds(entries: HistoryEntry[]): number {
  return entries.reduce((sum, e) => sum + e.seconds, 0);
}
