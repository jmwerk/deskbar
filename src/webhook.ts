import { client } from './bridgething';

/**
 * bridgething has no API for toggling a phone's or PC's system Do Not
 * Disturb — that's outside what the SDK exposes. Instead, when a webhook
 * URL is configured, we POST a small JSON event to it on focus
 * start/stop. Point that URL at a Home Assistant webhook, an IFTTT
 * Webhooks applet, an Apple Shortcuts personal automation trigger, etc.,
 * and let that automation flip DND / block apps on your phone or PC.
 *
 * Returns whether the webhook fired successfully. `true` also covers the
 * "no URL configured" case — there's nothing to report as a failure. Firing
 * itself is still best-effort: a failed automation hook never throws or
 * blocks the focus session, it's left to the caller to decide whether/how
 * to surface the `false` result to the user.
 */
export async function fireFocusWebhook(
  url: string | undefined,
  event: 'focus.started' | 'focus.stopped',
  detail: { issueKey?: string; durationS?: number },
): Promise<boolean> {
  if (!url) return true;
  try {
    const res = await client.net.fetch({
      request: {
        url,
        method: 'POST',
        headers: [{ name: 'Content-Type', value: 'application/json' }],
        body: new TextEncoder().encode(JSON.stringify({ event, ...detail })),
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
