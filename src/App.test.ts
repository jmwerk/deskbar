import { describe, expect, it } from 'vitest';
import { parseConfig, formatClock, formatDuration } from './App';

describe('parseConfig', () => {
  it('leaves jira null when any of the three fields is missing', () => {
    const config = parseConfig({ jiraBaseUrl: 'https://x.atlassian.net', jiraEmail: 'a@b.com' });
    expect(config.jira).toBeNull();
  });

  it('builds jira config once all three fields are present', () => {
    const config = parseConfig({
      jiraBaseUrl: 'https://x.atlassian.net',
      jiraEmail: 'a@b.com',
      jiraApiToken: 'tok',
    });
    expect(config.jira).toEqual({ baseUrl: 'https://x.atlassian.net', email: 'a@b.com', apiToken: 'tok' });
  });

  it('falls back to the default JQL and 25-minute default when unset', () => {
    const config = parseConfig({});
    expect(config.jiraJql).toMatch(/assignee = currentUser/);
    expect(config.defaultFocusMinutes).toBe(25);
  });

  it('parses an overridden default focus length', () => {
    expect(parseConfig({ defaultFocusMinutes: '45' }).defaultFocusMinutes).toBe(45);
  });
});

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
