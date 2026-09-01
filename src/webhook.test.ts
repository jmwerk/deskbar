import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildWebhookPayload, fireFocusWebhook } from './webhook';
import { resetMockState, setMockFetchFault } from './mockClient';

// VITE_MOCK=1 (.env.test) makes bridgething's client the mock; tests use real webhook.ts logic.

beforeEach(() => {
  resetMockState();
});

describe('fireFocusWebhook', () => {
  it('reports success without making a request when no URL is configured', async () => {
    const ok = await fireFocusWebhook(undefined, 'json', 'focus.started', {});
    expect(ok).toBe(true);
  });

  it('reports success when the target responds 2xx', async () => {
    const ok = await fireFocusWebhook('https://example.com/webhook', 'json', 'focus.started', { durationS: 900 });
    expect(ok).toBe(true);
  });

  it('reports failure when the target responds with a non-2xx status', async () => {
    setMockFetchFault('example.com/webhook', { status: 500 });
    const ok = await fireFocusWebhook('https://example.com/webhook', 'json', 'focus.stopped', { durationS: 900 });
    expect(ok).toBe(false);
  });

  it('reports failure and does not throw when the request itself fails', async () => {
    setMockFetchFault('example.com/webhook', { throws: true });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ok = await fireFocusWebhook('https://example.com/webhook', 'json', 'focus.stopped', { durationS: 900 });
    expect(ok).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('buildWebhookPayload', () => {
  it('json format sends the event and detail flat', () => {
    expect(buildWebhookPayload('json', 'focus.started', { issueKey: 'DESK-1', durationS: 900 })).toEqual({
      event: 'focus.started',
      issueKey: 'DESK-1',
      durationS: 900,
    });
  });

  it('slack format sends a plain text message', () => {
    const payload = buildWebhookPayload('slack', 'focus.started', { issueKey: 'DESK-1', durationS: 900 });
    expect(payload).toEqual({ text: '🎯 Focus started — DESK-1 (15m)' });
  });

  it('slack format handles no issue and no duration', () => {
    const payload = buildWebhookPayload('slack', 'focus.stopped', {});
    expect(payload).toEqual({ text: '✅ Focus ended' });
  });

  it('teams format sends a MessageCard', () => {
    const payload = buildWebhookPayload('teams', 'focus.stopped', { issueKey: 'DESK-1', durationS: 1500 });
    expect(payload).toMatchObject({
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      text: '✅ Focus ended — DESK-1 (25m)',
    });
  });
});
