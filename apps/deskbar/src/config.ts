import type { ClockFace } from './format';
import type { JiraConfig } from './jira';
import type { WebhookFormat } from './webhook';

export type Config = {
  jira: JiraConfig | null;
  jiraJql: string;
  focusWebhookUrl?: string;
  focusWebhookFormat: WebhookFormat;
  defaultFocusMinutes: number;
  /** IANA zone name if user-configured; unset falls back to runtime tz, wrong on a headless Car Thing. */
  timezone?: string;
  hour12: boolean;
  clockFace: ClockFace;
};

const DEFAULT_JQL = 'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC';
const WEBHOOK_FORMATS: WebhookFormat[] = ['json', 'slack', 'teams'];
const CLOCK_FACES: ClockFace[] = ['digital', 'analog', 'words', 'stacked'];

export const DEFAULT_CONFIG: Config = {
  jira: null,
  jiraJql: DEFAULT_JQL,
  focusWebhookFormat: 'json',
  defaultFocusMinutes: 25,
  hour12: true,
  clockFace: 'digital',
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
    hour12: raw.clockFormat !== '24h',
    clockFace: CLOCK_FACES.includes(raw.clockFace as ClockFace) ? (raw.clockFace as ClockFace) : 'digital',
  };
}
