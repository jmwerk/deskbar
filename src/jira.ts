import { client } from './bridgething';
import type { HttpHeader } from '@bridgething/client';

export type JiraConfig = {
  baseUrl: string;
  email: string;
  apiToken: string;
};

export type JiraIssue = {
  key: string;
  summary: string;
  projectKey: string;
  projectName: string;
};

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

function authHeader(cfg: JiraConfig): HttpHeader {
  return { name: 'Authorization', value: `Basic ${utf8ToBase64(`${cfg.email}:${cfg.apiToken}`)}` };
}

function bodyToText(body: Uint8Array): string {
  return new TextDecoder().decode(body);
}

function textToBody(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

// Every Jira call proxies through client.net.fetch, routed via the phone's network (avoids CORS too).
async function jiraFetch(
  cfg: JiraConfig,
  path: string,
  init: { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown } = { method: 'GET' },
): Promise<unknown> {
  const headers: HttpHeader[] = [authHeader(cfg), { name: 'Accept', value: 'application/json' }];
  let body: Uint8Array | null = null;
  if (init.body !== undefined) {
    headers.push({ name: 'Content-Type', value: 'application/json' });
    body = textToBody(JSON.stringify(init.body));
  }

  const res = await client.net.fetch({
    request: {
      url: `${cfg.baseUrl.replace(/\/$/, '')}${path}`,
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
    throw new JiraError(`Could not reach Jira (${detail})`);
  }

  const { status, body: respBody } = res.response.response;
  const text = respBody.length ? bodyToText(respBody) : '';
  const parsed = text ? safeJsonParse(text) : undefined;

  if (status < 200 || status >= 300) {
    const message =
      (parsed && typeof parsed === 'object' && parsed !== null && 'errorMessages' in parsed
        ? (parsed as { errorMessages?: string[] }).errorMessages?.join(', ')
        : undefined) ?? `Jira returned HTTP ${status}`;
    throw new JiraError(message, status);
  }

  return parsed;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// Searches via JQL (default: assigned to me, unresolved); uses search/jql, fetching only page one.
export async function searchIssues(cfg: JiraConfig, jql: string): Promise<JiraIssue[]> {
  const data = (await jiraFetch(cfg, '/rest/api/3/search/jql', {
    method: 'POST',
    body: {
      jql,
      maxResults: 25,
      fields: ['summary', 'project'],
    },
  })) as {
    issues?: Array<{
      key: string;
      fields: { summary: string; project: { key: string; name: string } };
    }>;
  };
  return (data.issues ?? []).map(issue => ({
    key: issue.key,
    summary: issue.fields.summary,
    projectKey: issue.fields.project.key,
    projectName: issue.fields.project.name,
  }));
}

// Logs time (seconds >= 60); returns worklog id. Uses adjustEstimate=leave to preserve estimates.
export async function logWork(
  cfg: JiraConfig,
  issueKey: string,
  seconds: number,
  comment?: string,
): Promise<{ worklogId: string }> {
  const body: Record<string, unknown> = {
    timeSpentSeconds: Math.max(60, Math.round(seconds)),
  };
  if (comment) {
    body.comment = {
      type: 'doc',
      version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: comment }] }],
    };
  }
  const data = (await jiraFetch(cfg, `/rest/api/3/issue/${encodeURIComponent(issueKey)}/worklog?adjustEstimate=leave`, {
    method: 'POST',
    body,
  })) as { id: string };
  return { worklogId: data.id };
}

// Deletes a worklog created by logWork; see the adjustEstimate note above for why.
export async function deleteWorklog(cfg: JiraConfig, issueKey: string, worklogId: string): Promise<void> {
  await jiraFetch(
    cfg,
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}/worklog/${encodeURIComponent(worklogId)}?adjustEstimate=leave`,
    { method: 'DELETE' },
  );
}
