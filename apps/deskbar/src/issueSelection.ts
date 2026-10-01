import type { JiraIssue } from './jira';

/** The issue to preselect: the last one logged to if it's in the list, else the top of the list. */
export function defaultIssue(issues: JiraIssue[], preferredKey?: string): JiraIssue | undefined {
  return issues.find(issue => issue.key === preferredKey) ?? issues[0];
}

// Undefined entries are the "No issue" row; a key not in the list starts the dial at the top.
export function nextDialIndex(
  pickList: (JiraIssue | undefined)[],
  currentKey: string | undefined,
  direction: 1 | -1,
): number {
  const index = pickList.findIndex(issue => issue?.key === currentKey);
  if (index === -1) return 0;
  return Math.min(pickList.length - 1, Math.max(0, index + direction));
}
