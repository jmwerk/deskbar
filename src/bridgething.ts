import { BridgethingClient } from '@bridgething/client';

/**
 * One client for the whole app. It auto-connects to the on-device daemon
 * over its local WebSocket and auto-reconnects if the connection drops.
 */
export const client = new BridgethingClient();

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
