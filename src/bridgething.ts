import { BridgethingClient } from '@bridgething/client';
import { mockClient, type AppBridgeClient } from './mockClient';

/**
 * One client for the whole app. It auto-connects to the on-device daemon
 * over its local WebSocket and auto-reconnects if the connection drops.
 *
 * Defaults to ws://127.0.0.1:8891/ (the daemon on whatever device this page
 * is running on). Set VITE_BRIDGETHING_URL to point `npm run dev` at a real
 * Car Thing's daemon over the network instead, e.g.:
 *   VITE_BRIDGETHING_URL=ws://<car-thing-ip>:8891/ npm run dev
 *
 * Set VITE_MOCK=1 to skip the daemon entirely and run against an in-browser
 * fake (see mockClient.ts) — no Car Thing, no network, useful when there's
 * no device on hand at all:
 *   VITE_MOCK=1 npm run dev
 */
export const client: AppBridgeClient =
  import.meta.env.VITE_MOCK === '1' ? mockClient : new BridgethingClient({ url: import.meta.env.VITE_BRIDGETHING_URL });

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
