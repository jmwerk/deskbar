import type { ClientSurfaces, ConfigChanged } from '@bridgething/client';

/**
 * The subset of BridgethingClient this app actually touches. Both the real
 * client and the mock below satisfy this, so `bridgething.ts` can hand out
 * either one without the rest of the app knowing which.
 */
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
];

const STORE_PREFIX = 'deskbar-mock-store:';

function jsonBody(data: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(data));
}

function decodeBody(body: Uint8Array | null | undefined): string {
  return body ? new TextDecoder().decode(body) : '';
}

// --- Fault injection -------------------------------------------------
//
// The real daemon can fail in ways the happy-path mock above never does:
// a stale config pushed from the phone, a 401/500 from Jira, a webhook
// target that's down. These let you (or a test) simulate that without
// touching real hardware or the mock's own request-matching logic.
//
// From a browser console during `npm run dev:mock`, use
// `window.__deskbarMock` (wired up in bridgething.ts); from a test, import
// these directly.

export type MockFetchFault = {
  /** HTTP status the mocked response reports (default 500 if omitted and not `throws`). */
  status?: number;
  /** Simulate the request itself failing (DNS/timeout/connection reset) rather than getting an HTTP response. */
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

/** Reset config, faults, and persisted store state — mainly for test isolation. */
export function resetMockState(): void {
  currentConfig = { ...DEFAULT_MOCK_CONFIG };
  fetchFaults.clear();
  configListeners.clear();
  // `.key(i)`/`.length` rather than `Object.keys()` — real browser
  // localStorage exposes stored keys as enumerable properties, but that's
  // not guaranteed for every Storage implementation (e.g. a test polyfill).
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

/**
 * Stands in for the on-device daemon so `npm run dev:mock` is fully usable
 * with no Car Thing at all. `store` persists to localStorage (so a reload
 * keeps your status/timer, same as the real device). `net.fetch` fakes just
 * enough of the Jira REST surface for the issue picker and worklog calls to
 * work; anything else (the focus webhook) just reports success — unless a
 * fault has been injected for that URL, see above.
 */
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
