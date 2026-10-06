import { client } from './bridgething';
import type { HttpHeader } from '@bridgething/client';

export type JiraConfig = {
  baseUrl: string;
  email: string;
  apiToken: string;
};

export type JiraIssue = {
  key: string;
  /** Numeric id as a string. Absent on issues rebuilt from history. */
  id?: string;
  summary: string;
  projectKey: string;
  projectName: string;
};

/** A failed Jira request; `status` is unset when Jira couldn't be reached at all. */
export class JiraError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

function utf8ToBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function jiraAuthHeader(cfg: JiraConfig): HttpHeader {
  return { name: 'Authorization', value: `Basic ${utf8ToBase64(`${cfg.email}:${cfg.apiToken}`)}` };
}

function bodyToText(body: Uint8Array): string {
  return new TextDecoder().decode(body);
}

function textToBody(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export type CallInit = { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown };

// Every call proxies through client.net.fetch, routed via the phone's network (avoids CORS too).
export async function requestJson(
  service: string,
  url: string,
  auth: HttpHeader,
  init: CallInit = { method: 'GET' },
): Promise<unknown> {
  const headers: HttpHeader[] = [auth, { name: 'Accept', value: 'application/json' }];
  let body: Uint8Array | null = null;
  if (init.body !== undefined) {
    headers.push({ name: 'Content-Type', value: 'application/json' });
    body = textToBody(JSON.stringify(init.body));
  }

  const res = await client.net.fetch({
    request: {
      url,
      method: init.method,
      headers,
      body,
      timeoutMs: 15000,
      redirect: 'follow',
    },
  });

  if (!res.ok) {
    // res.kind is 'domain' (fetch-level NetError, e.g. dns/timeout) or 'protocol' (daemon wire error).
    const detail = res.kind === 'domain' ? res.error.error.type : res.error.type;
    throw new JiraError(`Could not reach ${service} (${detail})`);
  }

  const { status, body: respBody } = res.response.response;
  const text = respBody.length ? bodyToText(respBody) : '';
  const parsed = text ? safeJsonParse(text) : undefined;

  if (status < 200 || status >= 300) {
    throw new JiraError(errorMessage(parsed) || `${service} returned HTTP ${status}`, status);
  }

  return parsed;
}

// Jira answers {errorMessages: [...]}; some Atlassian APIs answer {errors: [{message}]}.
function errorMessage(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== 'object') return undefined;
  const { errorMessages, errors } = parsed as { errorMessages?: unknown; errors?: unknown };
  if (Array.isArray(errorMessages) && errorMessages.length) return errorMessages.join(', ');
  if (Array.isArray(errors) && errors.length) {
    return errors.map(e => (e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e))).join(', ');
  }
  return undefined;
}

function jiraFetch(cfg: JiraConfig, path: string, init?: CallInit): Promise<unknown> {
  return requestJson('Jira', `${cfg.baseUrl.replace(/\/$/, '')}${path}`, jiraAuthHeader(cfg), init);
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// Searches via JQL (default: assigned to me, unresolved); uses search/jql, fetching only page one.
export async function searchIssues(cfg: JiraConfig, jql: string, maxResults = 25): Promise<JiraIssue[]> {
  const data = (await jiraFetch(cfg, '/rest/api/3/search/jql', {
    method: 'POST',
    body: {
      jql,
      maxResults,
      fields: ['summary', 'project'],
    },
  })) as {
    issues?: Array<{
      id: string;
      key: string;
      fields: { summary: string; project: { key: string; name: string } };
    }>;
  };
  return (data.issues ?? []).map(issue => ({
    key: issue.key,
    id: issue.id,
    summary: issue.fields.summary,
    projectKey: issue.fields.project.key,
    projectName: issue.fields.project.name,
  }));
}

/** Jira rejects worklogs under a minute, so shorter sessions are never posted. */
export const MIN_WORKLOG_S = 60;

/** True when retrying later could succeed: Jira unreachable or a server-side failure, not a 4xx. */
export function isTransientJiraError(err: unknown): boolean {
  return !(err instanceof JiraError) || err.status === undefined || err.status >= 500;
}

// Returns the worklog id and the seconds actually posted. adjustEstimate=leave preserves estimates.
export async function logWork(
  cfg: JiraConfig,
  issueKey: string,
  seconds: number,
): Promise<{ worklogId: string; seconds: number }> {
  const postedS = Math.max(MIN_WORKLOG_S, Math.round(seconds));
  const data = (await jiraFetch(cfg, `/rest/api/3/issue/${encodeURIComponent(issueKey)}/worklog?adjustEstimate=leave`, {
    method: 'POST',
    body: { timeSpentSeconds: postedS },
  })) as { id: string };
  return { worklogId: data.id, seconds: postedS };
}

// Deletes a worklog created by logWork; see the adjustEstimate note above for why.
export async function deleteWorklog(cfg: JiraConfig, issueKey: string, worklogId: string): Promise<void> {
  await jiraFetch(
    cfg,
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}/worklog/${encodeURIComponent(worklogId)}?adjustEstimate=leave`,
    { method: 'DELETE' },
  );
}

export type JiraUser = { accountId: string; displayName: string };

export async function getMyself(cfg: JiraConfig): Promise<JiraUser> {
  const data = (await jiraFetch(cfg, '/rest/api/3/myself')) as JiraUser;
  return { accountId: data.accountId, displayName: data.displayName };
}

/** A worklog as the tracker holds it, whichever device or app created it. */
export type RemoteWorklog = {
  worklogId: string;
  issueKey: string;
  issueId?: string;
  issueSummary?: string;
  seconds: number;
  /** unix ms; Deskbar posts with the default start of "now", so this lines up with its own loggedAt. */
  startedAt: number;
};

// Jira writes offsets as +0000, which Date.parse doesn't reliably accept without the colon.
export function parseJiraTime(value: string): number {
  return Date.parse(value.replace(/([+-]\d\d)(\d\d)$/, '$1:$2'));
}

async function issueWorklogs(
  cfg: JiraConfig,
  issue: Pick<RemoteWorklog, 'issueKey' | 'issueId' | 'issueSummary'>,
  accountId: string,
  sinceMs: number,
): Promise<RemoteWorklog[]> {
  let data: {
    worklogs?: Array<{ id: string; author?: { accountId?: string }; started: string; timeSpentSeconds: number }>;
  };
  try {
    data = (await jiraFetch(
      cfg,
      `/rest/api/3/issue/${encodeURIComponent(issue.issueKey)}/worklog?startedAfter=${sinceMs}&maxResults=5000`,
    )) as typeof data;
  } catch (err) {
    // A deleted or hidden issue has no worklogs left to show.
    if (err instanceof JiraError && err.status === 404) return [];
    throw err;
  }
  return (data.worklogs ?? [])
    .filter(w => w.author?.accountId === accountId)
    .map(w => ({ ...issue, worklogId: w.id, seconds: w.timeSpentSeconds, startedAt: parseJiraTime(w.started) }));
}

/**
 * The user's worklogs started on or after `sinceDay` (YYYY-MM-DD). The search finds issues worked on, and each
 * issue's worklog list is read directly, since search lags new worklogs; `knownKeys` covers that lag.
 */
export async function recentJiraWorklogs(
  cfg: JiraConfig,
  accountId: string,
  sinceDay: string,
  sinceMs: number,
  knownKeys: string[],
): Promise<RemoteWorklog[]> {
  const found = await searchIssues(cfg, `worklogAuthor = currentUser() AND worklogDate >= "${sinceDay}"`, 50);
  type IssueRef = Pick<RemoteWorklog, 'issueKey' | 'issueId' | 'issueSummary'>;
  const issues = new Map<string, IssueRef>(
    found.map(i => [i.key, { issueKey: i.key, issueId: i.id, issueSummary: i.summary }]),
  );
  for (const key of knownKeys)
    if (!issues.has(key)) issues.set(key, { issueKey: key, issueId: undefined, issueSummary: undefined });
  const lists = await Promise.all([...issues.values()].map(issue => issueWorklogs(cfg, issue, accountId, sinceMs)));
  return lists.flat();
}

/** Moves an issue to the status named, matching a transition's target status or the transition's own name. */
export async function transitionIssue(
  cfg: JiraConfig,
  issueKey: string,
  statusName: string,
): Promise<'moved' | 'already'> {
  const path = `/rest/api/3/issue/${encodeURIComponent(issueKey)}`;
  const want = statusName.trim().toLowerCase();
  const issue = (await jiraFetch(cfg, `${path}?fields=status`)) as { fields: { status: { name: string } } };
  const current = issue.fields.status.name;
  if (current.toLowerCase() === want) return 'already';
  const data = (await jiraFetch(cfg, `${path}/transitions`)) as {
    transitions?: Array<{ id: string; name: string; to: { name: string } }>;
  };
  const transitions = data.transitions ?? [];
  const match =
    transitions.find(t => t.to.name.toLowerCase() === want) ?? transitions.find(t => t.name.toLowerCase() === want);
  if (!match) throw new JiraError(`${issueKey} can't move to ${statusName.trim()} from ${current}`);
  await jiraFetch(cfg, `${path}/transitions`, { method: 'POST', body: { transition: { id: match.id } } });
  return 'moved';
}
