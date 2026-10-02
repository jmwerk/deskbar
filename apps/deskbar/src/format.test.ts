import { describe, expect, it } from 'vitest';
import { clockWords, formatClock, formatDuration, formatWallClock, wallParts } from './format';

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

describe('formatWallClock hour cycle', () => {
  it('reads 24-hour with a padded hour and midnight as 00', () => {
    expect(formatWallClock(new Date(2026, 0, 1, 21, 41).getTime(), undefined, false)).toBe('21:41');
    expect(formatWallClock(new Date(2026, 0, 1, 9, 5).getTime(), undefined, false)).toBe('09:05');
    expect(formatWallClock(new Date(2026, 0, 1, 0, 7).getTime(), undefined, false)).toBe('00:07');
  });

  it('reads 12-hour with a day period by default', () => {
    expect(formatWallClock(new Date(2026, 0, 1, 21, 41).getTime())).toMatch(/^9:41\s?PM$/i);
  });
});

describe('wallParts', () => {
  it('splits the time in the given zone', () => {
    expect(wallParts(Date.UTC(2026, 0, 1, 12, 34, 56), 'Asia/Tokyo')).toEqual({ h: 21, m: 34, s: 56 });
    expect(wallParts(Date.UTC(2026, 0, 1, 0, 0, 0), 'UTC').h).toBe(0);
  });
});

describe('clockWords', () => {
  const say = (h: number, m: number) => {
    const w = clockWords(h, m);
    return [w.lead, w.hour, w.tail].filter(Boolean).join(' ');
  };

  it('rounds to the nearest five minutes', () => {
    expect(say(9, 41)).toBe('twenty to ten');
    expect(say(9, 43)).toBe('quarter to ten');
    expect(say(9, 12)).toBe('ten past nine');
    expect(say(9, 30)).toBe('half past nine');
  });

  it("rolls over to the next hour's o'clock", () => {
    expect(say(9, 58)).toBe("ten o'clock");
    expect(say(14, 0)).toBe("two o'clock");
  });

  it('names noon and midnight', () => {
    expect(say(11, 59)).toBe('noon');
    expect(say(23, 58)).toBe('midnight');
    expect(say(0, 20)).toBe('twenty past twelve');
  });
});
