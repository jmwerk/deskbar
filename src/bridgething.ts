import { BridgethingClient } from '@bridgething/client';
import {
  mockClient,
  setMockConfig,
  setMockFetchFault,
  clearMockFetchFault,
  clearAllMockFetchFaults,
  type AppBridgeClient,
} from './mockClient';

const isMock = import.meta.env.VITE_MOCK === '1';

/**
 * One client for the whole app. It auto-connects to the on-device daemon
 * over its local WebSocket and auto-reconnects if the connection drops.
 *
 * Set VITE_MOCK=1 to skip the daemon entirely and run against an in-browser
 * fake (see mockClient.ts) — no Car Thing, no network, useful when there's
 * no device on hand at all:
 *   VITE_MOCK=1 npm run dev
 */
export const client: AppBridgeClient = isMock ? mockClient : new BridgethingClient();

/**
 * In mock mode only, expose fault injection on the console so you can
 * exercise error paths (a config push, a failed Jira/webhook request)
 * without editing mockClient.ts. E.g.:
 *   __deskbarMock.setFetchFault('/worklog', { status: 500 })
 *   __deskbarMock.setConfig({ focusWebhookUrl: 'https://example.com' })
 * See README's "Testing failure paths" section.
 */
if (isMock) {
  (window as unknown as { __deskbarMock: unknown }).__deskbarMock = {
    setConfig: setMockConfig,
    setFetchFault: setMockFetchFault,
    clearFetchFault: clearMockFetchFault,
    clearAllFetchFaults: clearAllMockFetchFaults,
  };
}

/** Read every declared `config` value the gateway has set for this webapp. */
export async function readConfig(): Promise<Record<string, string>> {
  const res = await client.config.list();
  if (!res.ok) return {};
  const out: Record<string, string> = {};
  for (const entry of res.response.entries) out[entry.key] = entry.value;
  return out;
}

/** Subscribe to config changes, calling `onChange` with the full config map each time. */
export function watchConfig(onChange: (config: Record<string, string>) => void): () => void {
  readConfig().then(onChange);
  return client.config.onChanged(() => {
    readConfig().then(onChange);
  });
}
