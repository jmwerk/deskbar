import type { JiraConfig } from './jira';
import type { WebhookFormat } from './webhook';

export type Config = {
  jira: JiraConfig | null;
  jiraJql: string;
  focusWebhookUrl?: string;
  focusWebhookFormat: WebhookFormat;
  defaultFocusMinutes: number;
  /**
   * IANA zone name (e.g. "America/New_York"), only set if the user
   * configured one. A headless Car Thing commonly has no timezone set at
   * all, defaulting to UTC — the clock and "Today" bucketing both fall
   * back to the runtime's own local timezone when this is unset, which is
   * correct in a browser (dev/dev:mock) but wrong on a device in that state.
   */
  timezone?: string;
};

const DEFAULT_JQL = 'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC';
const WEBHOOK_FORMATS: WebhookFormat[] = ['json', 'slack', 'teams'];

export const DEFAULT_CONFIG: Config = {
  jira: null,
  jiraJql: DEFAULT_JQL,
  focusWebhookFormat: 'json',
  defaultFocusMinutes: 25,
};

function validTimezone(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value });
    return value;
  } catch {
    return undefined;
  }
}

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
    timezone: validTimezone(raw.timezone),
  };
}
