import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient, resetMockState, setMockConfig } from './mockClient';

beforeEach(() => {
  resetMockState();
});

describe('mockClient.config', () => {
  it('lists the default mock config', async () => {
    const res = await mockClient.config.list();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const entries = Object.fromEntries(res.response.entries.map(e => [e.key, e.value]));
    expect(entries.jiraBaseUrl).toBe('https://example.atlassian.net');
  });

  it('notifies subscribers when the config changes, and stops after unsubscribing', async () => {
    const seen: Array<{ key: string; value: string | null }> = [];
    const unsubscribe = mockClient.config.onChanged(msg => seen.push(msg));

    setMockConfig({ focusWebhookUrl: 'https://example.com/webhook' });
    expect(seen).toEqual([{ key: 'focusWebhookUrl', value: 'https://example.com/webhook' }]);

    const res = await mockClient.config.list();
    if (!res.ok) throw new Error('expected ok');
    const entries = Object.fromEntries(res.response.entries.map(e => [e.key, e.value]));
    expect(entries.focusWebhookUrl).toBe('https://example.com/webhook');

    unsubscribe();
    setMockConfig({ focusWebhookUrl: 'https://example.com/other' });
    expect(seen).toHaveLength(1);
  });
});

describe('mockClient.store', () => {
  it('round-trips a value through localStorage', async () => {
    await mockClient.store.put({ key: 'deskbar/session', value: '{"status":"busy"}' });
    const res = await mockClient.store.get({ key: 'deskbar/session' });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.response.value).toBe('{"status":"busy"}');
  });

  it('returns null for a key that was never set', async () => {
    const res = await mockClient.store.get({ key: 'deskbar/nope' });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.response.value).toBeNull();
  });
});
