import type { Config } from './config';
import { dayKey, type HistoryEntry, type NewHistoryEntry } from './history';
import {
  deleteWorklog,
  getMyself,
  logWork,
  recentJiraWorklogs,
  type JiraConfig,
  type JiraUser,
  type RemoteWorklog,
} from './jira';

// The account never changes for a set of credentials, so one lookup serves every sync.
const myselfCache = new Map<string, Promise<JiraUser>>();
function myself(jira: JiraConfig): Promise<JiraUser> {
  const key = `${jira.baseUrl}\n${jira.email}\n${jira.apiToken}`;
  let cached = myselfCache.get(key);
  if (!cached) {
    cached = getMyself(jira);
    myselfCache.set(key, cached);
    cached.catch(() => myselfCache.delete(key));
  }
  return cached;
}

/** Posts a worklog to Jira and returns the history entry it becomes. */
export async function postWorklog(
  config: Config & { jira: JiraConfig },
  issue: { key: string; id?: string; summary?: string },
  seconds: number,
): Promise<NewHistoryEntry> {
  const loggedAt = Date.now();
  const { worklogId, seconds: postedS } = await logWork(config.jira, issue.key, seconds);
  return { issueKey: issue.key, issueSummary: issue.summary, issueId: issue.id, seconds: postedS, loggedAt, worklogId };
}

/** Deletes an entry's worklog from Jira. */
export async function removeWorklog(config: Config & { jira: JiraConfig }, entry: HistoryEntry): Promise<void> {
  if (entry.worklogId) await deleteWorklog(config.jira, entry.issueKey, entry.worklogId);
}

/** Today's worklogs as Jira holds them; `knownKeys` are issues logged to from here today. */
export async function fetchDayWorklogs(
  config: Config & { jira: JiraConfig },
  now: number,
  knownKeys: string[],
): Promise<{ day: string; worklogs: RemoteWorklog[] }> {
  const day = dayKey(now, config.timezone);
  const { accountId } = await myself(config.jira);
  // A day's span in any zone falls within yesterday and today in another, so look a day back and filter here.
  const sinceMs = now - 48 * 3600_000;
  const found = await recentJiraWorklogs(config.jira, accountId, dayKey(sinceMs, config.timezone), sinceMs, knownKeys);
  return { day, worklogs: found.filter(w => dayKey(w.startedAt, config.timezone) === day) };
}
