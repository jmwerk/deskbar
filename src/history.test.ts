import { describe, expect, it } from 'vitest';
import { todayEntries, totalSeconds, type HistoryEntry } from './history';

function entry(loggedAt: number, seconds = 900): HistoryEntry {
  return { issueKey: 'DESK-1', issueSummary: 'Test', seconds, loggedAt };
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
});

describe('totalSeconds', () => {
  it('sums the seconds across entries', () => {
    expect(totalSeconds([entry(1, 900), entry(2, 300)])).toBe(1200);
  });

  it('is 0 for an empty list', () => {
    expect(totalSeconds([])).toBe(0);
  });
});
