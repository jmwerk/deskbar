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

// Rolling buffer, not "today" — the Today view ages entries out daily; this bounds storage.
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

// en-CA — comparable YYYY-MM-DD key; pass an IANA zone if system tz untrustworthy (headless boxes).
function dayKey(ms: number, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);
}

export function todayEntries(entries: HistoryEntry[], now = Date.now(), timeZone?: string): HistoryEntry[] {
  const today = dayKey(now, timeZone);
  return entries.filter(e => dayKey(e.loggedAt, timeZone) === today);
}

export function totalSeconds(entries: HistoryEntry[]): number {
  return entries.reduce((sum, e) => sum + e.seconds, 0);
}
