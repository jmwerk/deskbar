import { describe, expect, it } from 'vitest';
import { defaultIssue, nextDialIndex } from './issueSelection';
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
