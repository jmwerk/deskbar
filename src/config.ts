import type { JiraConfig } from './jira';
import type { WebhookFormat } from './webhook';

export type Config = {
  jira: JiraConfig | null;
  jiraJql: string;
  focusWebhookUrl?: string;
  focusWebhookFormat: WebhookFormat;
  defaultFocusMinutes: number;
};

const DEFAULT_JQL = 'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC';
const WEBHOOK_FORMATS: WebhookFormat[] = ['json', 'slack', 'teams'];

export const DEFAULT_CONFIG: Config = {
  jira: null,
  jiraJql: DEFAULT_JQL,
  focusWebhookFormat: 'json',
  defaultFocusMinutes: 25,
};

export function parseConfig(raw: Record<string, string>): Config {
  const jira =
    raw.jiraBaseUrl && raw.jiraEmail && raw.jiraApiToken
      ? { baseUrl: raw.jiraBaseUrl, email: raw.jiraEmail, apiToken: raw.jiraApiToken }
      : null;
  const format = WEBHOOK_FORMATS.includes(raw.focusWebhookFormat as WebhookFormat)
    ? (raw.focusWebhookFormat as WebhookFormat)
    : 'json';
  return {
    jira,
    jiraJql: raw.jiraJql || DEFAULT_JQL,
    focusWebhookUrl: raw.focusWebhookUrl || undefined,
    focusWebhookFormat: format,
    defaultFocusMinutes: raw.defaultFocusMinutes ? Number(raw.defaultFocusMinutes) : 25,
  };
}
