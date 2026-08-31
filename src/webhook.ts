import { client } from './bridgething';

export type WebhookFormat = 'json' | 'slack' | 'teams';

export type WebhookDetail = { issueKey?: string; durationS?: number };

function focusMessage(event: 'focus.started' | 'focus.stopped', detail: WebhookDetail): string {
  const emoji = event === 'focus.started' ? '🎯' : '✅';
  const verb = event === 'focus.started' ? 'Focus started' : 'Focus ended';
  const issue = detail.issueKey ? ` — ${detail.issueKey}` : '';
  const duration = detail.durationS !== undefined ? ` (${Math.round(detail.durationS / 60)}m)` : '';
  return `${emoji} ${verb}${issue}${duration}`;
}

/**
 * Builds the request body for one webhook format. Kept pure and separate
 * from the actual `net.fetch` call so the payload shape can be tested
 * directly, without needing to intercept what the mock client sends.
 */
export function buildWebhookPayload(
  format: WebhookFormat,
  event: 'focus.started' | 'focus.stopped',
  detail: WebhookDetail,
): unknown {
  switch (format) {
    case 'slack':
      // Slack incoming webhooks: https://api.slack.com/messaging/webhooks
      return { text: focusMessage(event, detail) };
    case 'teams':
      // Legacy Office 365 Connector "MessageCard" format Teams incoming
      // webhooks expect: https://learn.microsoft.com/microsoftteams/platform/webhooks-and-connectors/how-to/connectors-using
      return {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        summary: 'Deskbar',
        themeColor: event === 'focus.started' ? '3b82f6' : '2ecc71',
        text: focusMessage(event, detail),
      };
    case 'json':
      return { event, ...detail };
  }
}

/**
 * bridgething has no API for toggling a phone's or PC's system Do Not
 * Disturb — that's outside what the SDK exposes. Instead, when a webhook
 * URL is configured, we POST an event to it on focus start/stop. Point
 * that at a Home Assistant/IFTTT/Shortcuts automation URL (format "json")
 * to trigger phone/PC Do Not Disturb, or at a Slack/Teams incoming webhook
 * (format "slack"/"teams") to post a status message there instead.
 *
 * Returns whether the webhook fired successfully. `true` also covers the
 * "no URL configured" case — there's nothing to report as a failure. Firing
 * itself is still best-effort: a failed automation hook never throws or
 * blocks the focus session, it's left to the caller to decide whether/how
 * to surface the `false` result to the user.
 */
export async function fireFocusWebhook(
  url: string | undefined,
  format: WebhookFormat,
  event: 'focus.started' | 'focus.stopped',
  detail: WebhookDetail,
): Promise<boolean> {
  if (!url) return true;
  try {
    const res = await client.net.fetch({
      request: {
        url,
        method: 'POST',
        headers: [{ name: 'Content-Type', value: 'application/json' }],
        body: new TextEncoder().encode(JSON.stringify(buildWebhookPayload(format, event, detail))),
        timeoutMs: 8000,
        redirect: 'follow',
      },
    });
    // `res.ok` only means the daemon reached the URL and got a response back
    // — the response itself can still be a 4xx/5xx from the target.
    return res.ok && res.response.response.status >= 200 && res.response.response.status < 300;
  } catch (err) {
    console.warn('[deskbar] focus webhook failed', err);
    return false;
  }
}
