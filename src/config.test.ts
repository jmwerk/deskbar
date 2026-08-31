import { describe, expect, it } from 'vitest';
import { parseConfig } from './config';

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
