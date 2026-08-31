import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireFocusWebhook } from './webhook';
import { resetMockState, setMockFetchFault } from './mockClient';

// VITE_MOCK=1 (see .env.test) makes `client` in bridgething.ts the mock
// client, so these exercise the real webhook.ts logic against it — no
// module mocking needed.

beforeEach(() => {
  resetMockState();
});

describe('fireFocusWebhook', () => {
  it('reports success without making a request when no URL is configured', async () => {
    const ok = await fireFocusWebhook(undefined, 'focus.started', {});
    expect(ok).toBe(true);
  });

  it('reports success when the target responds 2xx', async () => {
    const ok = await fireFocusWebhook('https://example.com/webhook', 'focus.started', { durationS: 900 });
    expect(ok).toBe(true);
  });

  it('reports failure when the target responds with a non-2xx status', async () => {
    setMockFetchFault('example.com/webhook', { status: 500 });
    const ok = await fireFocusWebhook('https://example.com/webhook', 'focus.stopped', { durationS: 900 });
    expect(ok).toBe(false);
  });

  it('reports failure and does not throw when the request itself fails', async () => {
    setMockFetchFault('example.com/webhook', { throws: true });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ok = await fireFocusWebhook('https://example.com/webhook', 'focus.stopped', { durationS: 900 });
    expect(ok).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
