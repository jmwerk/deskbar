import type { ClockFace } from './format';
import type { JiraConfig } from './jira';
import { normalizeJiraUrl } from './jiraUrl';
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
  /** Status a focus session's issue moves to when it starts; unset skips the move. */
  startStatus?: string;
  /** Status the receipt offers to move a just-logged issue to; unset hides the button. */
  doneStatus?: string;
  /** Session worklogs round to this many minutes; 0 leaves them exact. */
  roundToMinutes: 0 | 5 | 15;
  /** 0 when no daily target is set. */
  dailyTargetS: number;
  /** HH:MM (24h) after which Home nudges about unlogged time; unset turns the nudge off. */
  nudgeAt?: string;
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
  roundToMinutes: 0,
  dailyTargetS: 0,
};

const NUDGE_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function positiveNumber(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

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
      ? { baseUrl: normalizeJiraUrl(raw.jiraBaseUrl), email: raw.jiraEmail.trim(), apiToken: raw.jiraApiToken.trim() }
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
    startStatus: raw.startStatus?.trim() || undefined,
    doneStatus: raw.doneStatus?.trim() || undefined,
    roundToMinutes: raw.roundTo === '5' ? 5 : raw.roundTo === '15' ? 15 : 0,
    dailyTargetS: Math.round(positiveNumber(raw.dailyTargetHours) * 3600),
    nudgeAt: NUDGE_TIME.test(raw.nudgeAt?.trim() ?? '') ? raw.nudgeAt.trim() : undefined,
  };
}
