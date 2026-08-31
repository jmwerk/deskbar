import { describe, expect, it } from 'vitest';
import { activeElapsedS, type FocusSession } from './session';

function focus(overrides: Partial<FocusSession> = {}): FocusSession {
  return { startedAt: 0, durationS: 1500, ...overrides };
}

describe('activeElapsedS', () => {
  it('equals wall-clock elapsed when never paused', () => {
    expect(activeElapsedS(focus(), 90_000)).toBe(90);
  });

  it('excludes time spent in a completed pause', () => {
    // Ran 30s, paused for 20s (from 30s to 50s), now at 80s wall-clock.
    const f = focus({ pausedMs: 20_000 });
    expect(activeElapsedS(f, 80_000)).toBe(60); // 80s wall - 20s paused = 60s active
  });

  it('excludes time spent in an ongoing pause', () => {
    // Ran 30s, then paused at the 30s mark; now checking at 50s wall-clock
    // while still paused — the 20s spent paused so far should not count.
    const f = focus({ pausedAt: 30_000 });
    expect(activeElapsedS(f, 50_000)).toBe(30);
  });

  it('holds steady across multiple checks while paused', () => {
    const f = focus({ pausedAt: 30_000 });
    expect(activeElapsedS(f, 40_000)).toBe(30);
    expect(activeElapsedS(f, 60_000)).toBe(30);
    expect(activeElapsedS(f, 90_000)).toBe(30);
  });

  it('combines a completed pause and an ongoing one', () => {
    // Ran 10s, paused 5s (pausedMs), ran another 15s, paused again at 30s mark.
    const f = focus({ pausedMs: 5_000, pausedAt: 30_000 });
    expect(activeElapsedS(f, 45_000)).toBe(25); // 45s wall - 5s - 15s(ongoing) = 25s
  });
});
