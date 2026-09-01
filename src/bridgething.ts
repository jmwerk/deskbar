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

// Single app client; auto-reconnects to the daemon. VITE_MOCK=1 swaps in a fake client.
export const client: AppBridgeClient = isMock ? mockClient : new BridgethingClient();

// In mock mode, expose __deskbarMock on the console for fault injection; see README.
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
