import { describe, expect, it } from 'vitest';
import { formatClock, formatDuration, formatWallClock } from './format';

describe('formatClock', () => {
  it('formats whole minutes and seconds as m:ss', () => {
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(3661)).toBe('61:01');
  });

  it('clamps negative input to zero rather than going negative', () => {
    expect(formatClock(-5)).toBe('0:00');
  });

  it('rounds fractional seconds', () => {
    expect(formatClock(59.6)).toBe('1:00');
  });
});

describe('formatDuration', () => {
  it('shows minutes only under an hour', () => {
    expect(formatDuration(45 * 60)).toBe('45m');
  });

  it('shows hours and minutes over an hour', () => {
    expect(formatDuration(105 * 60)).toBe('1h 45m');
  });

  it('rounds to the nearest minute', () => {
    expect(formatDuration(89)).toBe('1m');
  });
});

describe('formatWallClock', () => {
  // Locale formatting varies (separators, AM/PM), so check structure, not an exact string.
  it('shows an hour and a two-digit minute, no seconds', () => {
    const noon = new Date(2026, 0, 1, 12, 0, 0).getTime();
    const text = formatWallClock(noon);
    expect(text).toMatch(/^\d{1,2}\D+\d{2}\D*$/);
    expect(text).not.toMatch(/:\d{2}:\d{2}/); // no seconds component
  });

  it('reflects the given minute', () => {
    const time = new Date(2026, 0, 1, 9, 5, 0).getTime();
    expect(formatWallClock(time)).toContain('05');
  });

  it('respects an explicit timezone override, independent of the runtime default', () => {
    const ms = Date.UTC(2026, 0, 1, 12, 0, 0); // noon UTC
    // UTC noon is 7am NY and 9pm Tokyo, so this only passes if timeZone is applied.
    expect(formatWallClock(ms, 'America/New_York')).toMatch(/^7:00/);
    expect(formatWallClock(ms, 'Asia/Tokyo')).toMatch(/^9:00/);
  });
});
