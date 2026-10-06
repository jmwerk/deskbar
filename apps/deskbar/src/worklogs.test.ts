import { beforeEach, describe, expect, it } from 'vitest';
import { parseConfig, type Config } from './config';
import type { JiraConfig } from './jira';
import { resetMockState } from './mockClient';
import { fetchDayWorklogs, postWorklog, removeWorklog } from './worklogs';

const jiraRaw = { jiraBaseUrl: 'https://example.atlassian.net', jiraEmail: 'a@b.com', jiraApiToken: 'tok' };
const configFor = (raw: Record<string, string>) => parseConfig({ ...jiraRaw, ...raw }) as Config & { jira: JiraConfig };

beforeEach(() => {
  resetMockState();
});

describe('worklogs', () => {
  const config = configFor({});

  it('posts a worklog and reads it back as one of today’s', async () => {
    const entry = await postWorklog(config, { key: 'DESK-2', id: '10002', summary: 'Test' }, 1500);
    expect(entry).toMatchObject({ issueKey: 'DESK-2', seconds: 1500 });
    const { worklogs } = await fetchDayWorklogs(config, Date.now(), []);
    expect(worklogs).toEqual([
      expect.objectContaining({ worklogId: entry.worklogId, issueKey: 'DESK-2', seconds: 1500 }),
    ]);
  });

  it('no longer reads back a removed worklog', async () => {
    const entry = await postWorklog(config, { key: 'DESK-2' }, 900);
    await removeWorklog(config, { ...entry, id: 'h1' });
    expect((await fetchDayWorklogs(config, Date.now(), ['DESK-2'])).worklogs).toEqual([]);
  });
});
