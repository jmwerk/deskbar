import { describe, expect, it } from 'vitest';
import { roundWorklogSeconds, syncLabel } from './timesheet';

describe('roundWorklogSeconds', () => {
  it('leaves the time exact when rounding is off', () => {
    expect(roundWorklogSeconds(1234, 0)).toBe(1234);
  });

  it('rounds to the nearest step', () => {
    expect(roundWorklogSeconds(22 * 60, 15)).toBe(15 * 60);
    expect(roundWorklogSeconds(23 * 60, 15)).toBe(30 * 60);
    expect(roundWorklogSeconds(27 * 60 + 29, 5)).toBe(25 * 60);
  });

  it('never rounds a short session down to nothing', () => {
    expect(roundWorklogSeconds(3 * 60, 15)).toBe(15 * 60);
  });
});

describe('syncLabel', () => {
  const now = new Date(2026, 9, 5, 15, 0).getTime();

  it('says how long ago the last sync landed', () => {
    expect(syncLabel({ status: 'idle', at: now - 20_000 }, now)).toBe('Synced just now');
    expect(syncLabel({ status: 'idle', at: now - 7 * 60_000 }, now)).toBe('Synced 7 min ago');
    expect(syncLabel({ status: 'idle', at: new Date(2026, 9, 5, 13, 5).getTime() }, now)).toBe('Synced at 1:05 PM');
  });

  it('shows a sync in flight, a failure, and a ledger never synced', () => {
    expect(syncLabel({ status: 'syncing', at: now }, now)).toBe('Syncing…');
    expect(syncLabel({ status: 'error', at: now }, now)).toBe("Couldn't sync, tap to retry");
    expect(syncLabel({ status: 'idle' }, now)).toBe('Tap to sync');
  });
});
