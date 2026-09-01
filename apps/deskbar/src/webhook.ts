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

/** Builds one webhook's request body; kept pure and separate from `net.fetch` so it's testable. */
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

/** Best-effort webhook POST for focus events (DND proxy); never throws, false only on failure. */
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
    // `res.ok` only means the daemon got a response — it may still be a 4xx/5xx from the target.
    return res.ok && res.response.response.status >= 200 && res.response.response.status < 300;
  } catch (err) {
    console.warn('[deskbar] focus webhook failed', err);
    return false;
  }
}
