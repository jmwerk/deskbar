import { client } from './bridgething';
import type { RemoteWorklog } from './jira';

export type HistoryEntry = {
  id: string;
  issueKey: string;
  issueSummary?: string;
  seconds: number;
  loggedAt: number; // unix ms
  /** The Jira worklog this entry came from, if any — needed to delete it from Jira too. */
  worklogId?: string;
  /** Jira's numeric issue id, when known. */
  issueId?: string;
};

/** Fields the caller supplies; `id` is assigned when the entry is recorded. */
export type NewHistoryEntry = Omit<HistoryEntry, 'id'>;

const STORE_KEY = 'deskbar/history';

// Rolling buffer, not "today" — Home's ledger ages entries out daily; this bounds storage.
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
export function dayKey(ms: number, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);
}

export function todayEntries(entries: HistoryEntry[], now = Date.now(), timeZone?: string): HistoryEntry[] {
  const today = dayKey(now, timeZone);
  return entries.filter(e => dayKey(e.loggedAt, timeZone) === today);
}

export function totalSeconds(entries: HistoryEntry[]): number {
  return entries.reduce((sum, e) => sum + e.seconds, 0);
}

/**
 * Makes `day`'s worklogs match the tracker: new ones are added, edited ones take the tracker's time, and ones
 * deleted there drop out. Entries posted at or after `keepAfter` stay, since the fetch may predate them.
 */
export function reconcileDay(
  entries: HistoryEntry[],
  remote: RemoteWorklog[],
  day: string,
  timeZone: string | undefined,
  keepAfter: number,
): HistoryEntry[] {
  const remoteById = new Map(remote.map(r => [r.worklogId, r]));
  const matched = new Set<string>();
  const next: HistoryEntry[] = [];
  for (const entry of entries) {
    const tracked = entry.worklogId !== undefined && dayKey(entry.loggedAt, timeZone) === day;
    if (!tracked) {
      next.push(entry);
      continue;
    }
    const match = remoteById.get(entry.worklogId!);
    if (match) {
      matched.add(match.worklogId);
      next.push({
        ...entry,
        seconds: match.seconds,
        issueSummary: entry.issueSummary ?? match.issueSummary,
        issueId: entry.issueId ?? match.issueId,
      });
    } else if (entry.loggedAt >= keepAfter) {
      next.push(entry);
    }
  }
  // An entry filed under another day here can still be this worklog; it isn't new.
  const known = new Set(entries.map(e => e.worklogId));
  for (const r of remote) {
    if (matched.has(r.worklogId) || known.has(r.worklogId)) continue;
    next.push({
      id: crypto.randomUUID(),
      issueKey: r.issueKey,
      issueSummary: r.issueSummary,
      issueId: r.issueId,
      seconds: r.seconds,
      loggedAt: r.startedAt,
      worklogId: r.worklogId,
    });
  }
  return next.sort((a, b) => b.loggedAt - a.loggedAt).slice(0, MAX_ENTRIES);
}

/** Applies a tracker fetch to the stored history, reading it fresh so entries recorded meanwhile survive. */
export async function syncDay(
  remote: RemoteWorklog[],
  day: string,
  timeZone: string | undefined,
  keepAfter: number,
): Promise<HistoryEntry[]> {
  return saveHistory(reconcileDay(await loadHistory(), remote, day, timeZone, keepAfter));
}
