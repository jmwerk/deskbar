import type { HistoryEntry } from './history';
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

export const RECENT_ISSUES = 5;
export const RECENT_MAX_AGE_MS = 7 * 24 * 3600_000;

/** The newest distinct issues logged to within the last week, rebuilt from history for the issue picker. */
export function recentFromHistory(history: HistoryEntry[], now: number): JiraIssue[] {
  const seen = new Map<string, JiraIssue>();
  for (const entry of history) {
    if (seen.size >= RECENT_ISSUES) break;
    if (now - entry.loggedAt > RECENT_MAX_AGE_MS || seen.has(entry.issueKey)) continue;
    const projectKey = entry.issueKey.split('-')[0];
    seen.set(entry.issueKey, {
      key: entry.issueKey,
      id: entry.issueId,
      summary: entry.issueSummary ?? '',
      projectKey,
      projectName: projectKey,
    });
  }
  return [...seen.values()];
}
