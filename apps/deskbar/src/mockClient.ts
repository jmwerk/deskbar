import type { ClientSurfaces, ConfigChanged } from '@bridgething/client';

/** Subset of BridgethingClient the app uses; real & mock both satisfy it, so callers don't care which. */
export type AppBridgeClient = {
  config: Pick<ClientSurfaces['config'], 'list' | 'onChanged'>;
  store: Pick<ClientSurfaces['store'], 'get' | 'put'>;
  net: Pick<ClientSurfaces['net'], 'fetch'>;
};

const DEFAULT_MOCK_CONFIG: Record<string, string> = {
  jiraBaseUrl: 'https://example.atlassian.net',
  jiraEmail: 'you@example.com',
  jiraApiToken: 'mock-token',
  jiraJql: 'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC',
  focusWebhookUrl: '',
  focusWebhookFormat: 'json',
  defaultFocusMinutes: '25',
  timezone: '',
};

const MOCK_ISSUES = [
  { key: 'DESK-1', fields: { summary: 'Wire up the mock client', project: { key: 'DESK', name: 'Deskbar' } } },
  { key: 'DESK-2', fields: { summary: 'Test the focus timer end to end', project: { key: 'DESK', name: 'Deskbar' } } },
  { key: 'OPS-7', fields: { summary: 'Rotate the office wifi password', project: { key: 'OPS', name: 'Operations' } } },
];

const STORE_PREFIX = 'deskbar-mock-store:';

function jsonBody(data: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(data));
}

function decodeBody(body: Uint8Array | null | undefined): string {
  return body ? new TextDecoder().decode(body) : '';
}

// Fault injection: simulate daemon failures (stale config, Jira, webhook down) via console or tests.

export type MockFetchFault = {
  /** HTTP status the mocked response reports; defaults to 500 unless `throws` is set. */
  status?: number;
  /** Simulates the request itself failing (DNS/timeout/reset) instead of returning an HTTP response. */
  throws?: boolean;
};

let currentConfig: Record<string, string> = { ...DEFAULT_MOCK_CONFIG };
const configListeners = new Set<(msg: ConfigChanged) => void>();
const fetchFaults = new Map<string, MockFetchFault>();

/** Push a config change, as if the phone app had just saved new settings. */
export function setMockConfig(patch: Record<string, string>): void {
  currentConfig = { ...currentConfig, ...patch };
  for (const [key, value] of Object.entries(patch)) {
    configListeners.forEach(fn => fn({ key, value }));
  }
}

/** Fail every `net.fetch` whose URL contains `urlSubstring`, until cleared. */
export function setMockFetchFault(urlSubstring: string, fault: MockFetchFault): void {
  fetchFaults.set(urlSubstring, fault);
}

export function clearMockFetchFault(urlSubstring: string): void {
  fetchFaults.delete(urlSubstring);
}

export function clearAllMockFetchFaults(): void {
  fetchFaults.clear();
}

/** Resets config, faults, and persisted store state, mainly to isolate tests from each other. */
export function resetMockState(): void {
  currentConfig = { ...DEFAULT_MOCK_CONFIG };
  fetchFaults.clear();
  configListeners.clear();
  // Use `.key(i)`/`.length`, not `Object.keys()`: some Storage polyfills don't enumerate keys.
  const staleKeys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(STORE_PREFIX)) staleKeys.push(key);
  }
  staleKeys.forEach(key => window.localStorage.removeItem(key));
}

function matchingFault(url: string): MockFetchFault | undefined {
  for (const [pattern, fault] of fetchFaults) {
    if (url.includes(pattern)) return fault;
  }
  return undefined;
}

/** Stands in for the daemon so dev:mock works without a Car Thing; fakes Jira, honors fault injection. */
export const mockClient: AppBridgeClient = {
  config: {
    async list() {
      return { ok: true, response: { entries: Object.entries(currentConfig).map(([key, value]) => ({ key, value })) } };
    },
    onChanged(cb) {
      configListeners.add(cb);
      return () => configListeners.delete(cb);
    },
  },
  store: {
    async get({ key }) {
      return { ok: true, response: { key, value: window.localStorage.getItem(STORE_PREFIX + key) } };
    },
    async put({ key, value }) {
      window.localStorage.setItem(STORE_PREFIX + key, value);
      return { ok: true, response: { key, value } };
    },
  },
  net: {
    async fetch({ request }) {
      const { url, method, body } = request;
      console.log(`[mock] net.fetch ${method} ${url}`, body ? decodeBody(body) : '');

      const fault = matchingFault(url);
      if (fault?.throws) {
        throw new Error(`[mock] simulated network failure for ${url}`);
      }
      if (fault) {
        return {
          ok: true,
          response: {
            response: {
              status: fault.status ?? 500,
              headers: [],
              body: jsonBody({ errorMessages: ['Simulated failure'] }),
            },
          },
        };
      }

      if (method === 'POST' && url.endsWith('/rest/api/3/search/jql')) {
        return {
          ok: true,
          response: { response: { status: 200, headers: [], body: jsonBody({ issues: MOCK_ISSUES }) } },
        };
      }

      if (method === 'POST' && /\/rest\/api\/3\/issue\/[^/]+\/worklog(\?|$)/.test(url)) {
        const worklogId = `mock-${Date.now()}`;
        console.log('[mock] worklog logged:', decodeBody(body), '-> id', worklogId);
        return { ok: true, response: { response: { status: 201, headers: [], body: jsonBody({ id: worklogId }) } } };
      }

      if (method === 'DELETE' && /\/rest\/api\/3\/issue\/[^/]+\/worklog\/[^/]+$/.test(url)) {
        console.log('[mock] worklog deleted:', url);
        return { ok: true, response: { response: { status: 204, headers: [], body: new Uint8Array() } } };
      }

      // The focus webhook (or anything else) — pretend the automation fired.
      return { ok: true, response: { response: { status: 200, headers: [], body: new Uint8Array() } } };
    },
  },
};
