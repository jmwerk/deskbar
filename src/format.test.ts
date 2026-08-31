import { describe, expect, it } from 'vitest';
import { formatClock, formatDuration } from './format';

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
