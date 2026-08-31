import { beforeEach, describe, expect, it } from 'vitest';
import {
  appendHistoryEntry,
  loadHistory,
  removeHistoryEntry,
  todayEntries,
  totalSeconds,
  type HistoryEntry,
} from './history';
import { resetMockState } from './mockClient';

beforeEach(() => {
  resetMockState();
});

let nextId = 0;

function entry(loggedAt: number, seconds = 900): HistoryEntry {
  return { id: `test-${nextId++}`, issueKey: 'DESK-1', issueSummary: 'Test', seconds, loggedAt };
}

describe('todayEntries', () => {
  it('keeps entries from the same local calendar day as `now`', () => {
    const now = new Date(2026, 7, 31, 14, 0, 0).getTime(); // Aug 31, 2 pm
    const earlierToday = new Date(2026, 7, 31, 9, 0, 0).getTime();
    const yesterday = new Date(2026, 7, 30, 23, 59, 0).getTime();
    const tomorrow = new Date(2026, 8, 1, 0, 1, 0).getTime();

    const entries = [entry(earlierToday), entry(yesterday), entry(tomorrow)];
    const result = todayEntries(entries, now);

    expect(result).toHaveLength(1);
    expect(result[0].loggedAt).toBe(earlierToday);
  });

  it('returns an empty list when there are no entries', () => {
    expect(todayEntries([], Date.now())).toEqual([]);
  });

  it('buckets by the given IANA timezone, not just wall-clock UTC', () => {
    // A device with no timezone configured (e.g. a headless Car Thing)
    // defaults to UTC — this is exactly the kind of instant that's the
    // same calendar day in UTC but a different one once a real zone is
    // applied, which is what silently mis-bucketed entries near midnight.
    const entryMs = Date.UTC(2026, 7, 31, 2, 0, 0); // Aug 31 02:00 UTC = Aug 30 22:00 EDT
    const nowMs = Date.UTC(2026, 7, 31, 10, 0, 0); // Aug 31 10:00 UTC = Aug 31 06:00 EDT

    expect(todayEntries([entry(entryMs)], nowMs, 'UTC')).toHaveLength(1);
    expect(todayEntries([entry(entryMs)], nowMs, 'America/New_York')).toHaveLength(0);
  });
});

describe('totalSeconds', () => {
  it('sums the seconds across entries', () => {
    expect(totalSeconds([entry(1, 900), entry(2, 300)])).toBe(1200);
  });

  it('is 0 for an empty list', () => {
    expect(totalSeconds([])).toBe(0);
  });
});

describe('appendHistoryEntry / removeHistoryEntry', () => {
  it('assigns an id and persists the entry, newest first', async () => {
    await appendHistoryEntry({ issueKey: 'DESK-1', seconds: 900, loggedAt: 1 });
    const after = await appendHistoryEntry({ issueKey: 'DESK-2', seconds: 300, loggedAt: 2 });

    expect(after).toHaveLength(2);
    expect(after[0].issueKey).toBe('DESK-2');
    expect(after[0].id).toBeTruthy();
    expect(after[0].id).not.toBe(after[1].id);
  });

  it('removes only the entry with the matching id', async () => {
    await appendHistoryEntry({ issueKey: 'DESK-1', seconds: 900, loggedAt: 1 });
    const [toRemove] = await appendHistoryEntry({ issueKey: 'DESK-2', seconds: 300, loggedAt: 2 });

    const after = await removeHistoryEntry(toRemove.id);
    expect(after).toHaveLength(1);
    expect(after[0].issueKey).toBe('DESK-1');
    expect(await loadHistory()).toHaveLength(1);
  });
});
