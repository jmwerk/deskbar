import { beforeEach, describe, expect, it } from 'vitest';
import { logWork, deleteWorklog, isTransientJiraError, JiraError, type JiraConfig } from './jira';
import { resetMockState, setMockFetchFault } from './mockClient';

const cfg: JiraConfig = { baseUrl: 'https://example.atlassian.net', email: 'a@b.com', apiToken: 'tok' };

beforeEach(() => {
  resetMockState();
});

describe('logWork', () => {
  it('returns the worklog id Jira assigned, for later deletion', async () => {
    const { worklogId } = await logWork(cfg, 'DESK-1', 900, 'test');
    expect(worklogId).toBeTruthy();
  });

  it('posts at least a minute and returns the seconds it actually posted', async () => {
    expect((await logWork(cfg, 'DESK-1', 20)).seconds).toBe(60);
    expect((await logWork(cfg, 'DESK-1', 900.4)).seconds).toBe(900);
  });

  it('throws a JiraError with the status when Jira rejects the request', async () => {
    setMockFetchFault('/worklog', { status: 403 });
    await expect(logWork(cfg, 'DESK-1', 900)).rejects.toBeInstanceOf(JiraError);
  });

  // Exercises the `res.kind === 'domain'` branch of jiraFetch's error handling — the only place
  // in the app that reasons over net.fetch's typed-result discriminated union — which nothing
  // else here reaches (the `status` fault above resolves ok:true, and `throws` bypasses the
  // typed-result contract entirely).
  it('throws a JiraError naming the reason when the request cannot reach Jira at all', async () => {
    setMockFetchFault('/worklog', { unreachable: 'timeout' });
    await expect(logWork(cfg, 'DESK-1', 900)).rejects.toThrow(/timeout/);
  });
});

describe('deleteWorklog', () => {
  it('resolves without throwing when Jira accepts the deletion', async () => {
    const { worklogId } = await logWork(cfg, 'DESK-1', 900);
    await expect(deleteWorklog(cfg, 'DESK-1', worklogId)).resolves.toBeUndefined();
  });

  it('throws a JiraError when the delete request fails', async () => {
    setMockFetchFault('/worklog/', { status: 404 });
    await expect(deleteWorklog(cfg, 'DESK-1', 'some-id')).rejects.toBeInstanceOf(JiraError);
  });
});

describe('isTransientJiraError', () => {
  it('is true when Jira is unreachable or failed server-side', () => {
    expect(isTransientJiraError(new JiraError('Could not reach Jira (timeout)'))).toBe(true);
    expect(isTransientJiraError(new JiraError('Jira returned HTTP 503', 503))).toBe(true);
    expect(isTransientJiraError(new Error('boom'))).toBe(true);
  });

  it('is false when Jira rejected the request, so retrying would fail the same way', () => {
    expect(isTransientJiraError(new JiraError('Forbidden', 403))).toBe(false);
  });
});
