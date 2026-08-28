import { client } from './bridgething';

/**
 * bridgething has no API for toggling a phone's or PC's system Do Not
 * Disturb — that's outside what the SDK exposes. Instead, when a webhook
 * URL is configured, we POST a small JSON event to it on focus
 * start/stop. Point that URL at a Home Assistant webhook, an IFTTT
 * Webhooks applet, an Apple Shortcuts personal automation trigger, etc.,
 * and let that automation flip DND / block apps on your phone or PC.
 */
export async function fireFocusWebhook(
  url: string | undefined,
  event: 'focus.started' | 'focus.stopped',
  detail: { issueKey?: string; durationS?: number },
): Promise<void> {
  if (!url) return;
  try {
    await client.net.fetch({
      request: {
        url,
        method: 'POST',
        headers: [{ name: 'Content-Type', value: 'application/json' }],
        body: new TextEncoder().encode(JSON.stringify({ event, ...detail })),
        timeoutMs: 8000,
        redirect: 'follow',
      },
    });
  } catch {
    // Best-effort: a failed automation hook shouldn't block the focus session itself.
  }
}
