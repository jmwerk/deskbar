import { describe, expect, it } from 'vitest';
import { normalizeJiraUrl } from './jiraUrl';

describe('normalizeJiraUrl', () => {
  it('cuts a pasted cloud link down to the site', () => {
    expect(normalizeJiraUrl('https://team.atlassian.net/browse/DESK-2')).toBe('https://team.atlassian.net');
    expect(normalizeJiraUrl('https://team.atlassian.net/jira/software/projects/DESK/boards/1')).toBe(
      'https://team.atlassian.net',
    );
  });

  it('adds https when the scheme is missing and trims space', () => {
    expect(normalizeJiraUrl('  team.atlassian.net/ ')).toBe('https://team.atlassian.net');
  });

  it("keeps a self-hosted site's context path but drops the page after it", () => {
    expect(normalizeJiraUrl('https://example.com/jira/browse/OPS-7')).toBe('https://example.com/jira');
    expect(normalizeJiraUrl('https://jira.example.com/secure/Dashboard.jspa')).toBe('https://jira.example.com');
  });

  it('leaves blank input blank', () => {
    expect(normalizeJiraUrl('   ')).toBe('');
  });
});
