import { describe, expect, it } from 'vitest';
import type { HistoryEntry } from './history';
import { defaultIssue, nextDialIndex, recentFromHistory, RECENT_MAX_AGE_MS } from './issueSelection';
import type { JiraIssue } from './jira';

const issue = (key: string): JiraIssue => ({ key, summary: key, projectKey: 'DESK', projectName: 'Desk' });
const issues = [issue('DESK-1'), issue('DESK-2'), issue('DESK-3')];

describe('defaultIssue', () => {
  it('prefers the last issue logged to when it is still in the list', () => {
    expect(defaultIssue(issues, 'DESK-2')?.key).toBe('DESK-2');
  });

  it('falls back to the top of the list', () => {
    expect(defaultIssue(issues, 'OTHER-9')?.key).toBe('DESK-1');
    expect(defaultIssue(issues)?.key).toBe('DESK-1');
  });

  it('is undefined for an empty list', () => {
    expect(defaultIssue([], 'DESK-1')).toBeUndefined();
  });
});

describe('nextDialIndex', () => {
  it('lands on the first row, not the second, when nothing is selected yet', () => {
    expect(nextDialIndex(issues, undefined, 1)).toBe(0);
  });

  it('steps and clamps at both ends', () => {
    expect(nextDialIndex(issues, 'DESK-1', 1)).toBe(1);
    expect(nextDialIndex(issues, 'DESK-1', -1)).toBe(0);
    expect(nextDialIndex(issues, 'DESK-3', 1)).toBe(2);
  });

  it('treats the trailing undefined entry as the "No issue" row', () => {
    const withNone = [...issues, undefined];
    expect(nextDialIndex(withNone, undefined, -1)).toBe(2);
    expect(nextDialIndex(withNone, 'DESK-3', 1)).toBe(3);
  });
});

describe('recentFromHistory', () => {
  const now = new Date(2026, 9, 5, 12, 0).getTime();
  const logged = (issueKey: string, ageMs: number): HistoryEntry => ({
    id: `${issueKey}-${ageMs}`,
    issueKey,
    issueSummary: `Summary of ${issueKey}`,
    seconds: 900,
    loggedAt: now - ageMs,
  });

  it('lists distinct issues newest first, up to five', () => {
    const history = ['A-1', 'A-1', 'B-2', 'C-3', 'D-4', 'E-5', 'F-6'].map((key, i) => logged(key, i * 60_000));
    expect(recentFromHistory(history, now).map(i => i.key)).toEqual(['A-1', 'B-2', 'C-3', 'D-4', 'E-5']);
  });

  it('leaves out issues last logged to more than a week ago', () => {
    const history = [
      logged('A-1', 3600_000),
      logged('B-2', RECENT_MAX_AGE_MS - 1),
      logged('C-3', RECENT_MAX_AGE_MS + 1),
    ];
    expect(recentFromHistory(history, now).map(i => i.key)).toEqual(['A-1', 'B-2']);
  });

  it('fills in the project from the key', () => {
    const [recent] = recentFromHistory([logged('OPS-7', 0)], now);
    expect(recent).toMatchObject({ key: 'OPS-7', projectKey: 'OPS', summary: 'Summary of OPS-7' });
  });
});
