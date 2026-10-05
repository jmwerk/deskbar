import { describe, expect, it } from 'vitest';
import { nudgeMessage, pastNudgeTime, roundWorklogSeconds, syncLabel, targetProgress } from './timesheet';

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

describe('pastNudgeTime', () => {
  const at = (h: number, m: number) => new Date(2026, 9, 5, h, m).getTime();

  it('is false before the time and true from it on', () => {
    expect(pastNudgeTime(at(16, 59), '17:00')).toBe(false);
    expect(pastNudgeTime(at(17, 0), '17:00')).toBe(true);
    expect(pastNudgeTime(at(23, 30), '17:00')).toBe(true);
  });

  it("reads the clock in the configured zone, not the runtime's", () => {
    const noonUtc = Date.UTC(2026, 9, 5, 12, 0);
    expect(pastNudgeTime(noonUtc, '10:00', 'America/New_York')).toBe(false);
    expect(pastNudgeTime(noonUtc, '08:00', 'America/New_York')).toBe(true);
  });
});

describe('nudgeMessage', () => {
  const now = new Date(2026, 9, 5, 17, 0).getTime();
  const base = { now, todaySeconds: 0, dailyTargetS: 0, hour12: true };

  it("says how far short of the target today is, and nothing once it's met", () => {
    expect(nudgeMessage({ ...base, todaySeconds: 4 * 3600, dailyTargetS: 6 * 3600 })).toBe('2h short of your 6h today');
    expect(nudgeMessage({ ...base, todaySeconds: 6 * 3600, dailyTargetS: 6 * 3600 })).toBeNull();
  });

  it('without a target, points at the unlogged gap once it passes half an hour', () => {
    const lastLoggedAt = new Date(2026, 9, 5, 15, 10).getTime();
    expect(nudgeMessage({ ...base, lastLoggedAt })).toBe('Unlogged since 3:10 PM');
    expect(nudgeMessage({ ...base, lastLoggedAt: now - 10 * 60_000 })).toBeNull();
  });

  it('says so when nothing was logged today', () => {
    expect(nudgeMessage(base)).toBe('Nothing logged today yet');
  });
});

describe('targetProgress', () => {
  it("is null without a target, else what's left or that it's met", () => {
    expect(targetProgress(3600, 0)).toBeNull();
    expect(targetProgress(3600, 6 * 3600)).toBe('5h to go of 6h');
    expect(targetProgress(7 * 3600, 6 * 3600)).toBe('6h target met');
    expect(targetProgress(3600, 6.5 * 3600)).toBe('5h 30m to go of 6h 30m');
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
