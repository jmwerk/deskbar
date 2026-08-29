import type { ClientSurfaces } from '@bridgething/client';

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

const MOCK_CONFIG: Record<string, string> = {
  jiraBaseUrl: 'https://example.atlassian.net',
  jiraEmail: 'you@example.com',
  jiraApiToken: 'mock-token',
  jiraJql: 'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC',
  focusWebhookUrl: '',
  defaultFocusMinutes: '25',
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

/**
 * Stands in for the on-device daemon so `npm run dev` is fully usable with
 * no Car Thing at all. `store` persists to localStorage (so a reload keeps
 * your status/timer, same as the real device). `net.fetch` fakes just
 * enough of the Jira REST surface for the issue picker and worklog calls to
 * work; anything else (the focus webhook) just reports success.
 */
export const mockClient: AppBridgeClient = {
  config: {
    async list() {
      return { ok: true, response: { entries: Object.entries(MOCK_CONFIG).map(([key, value]) => ({ key, value })) } };
    },
    onChanged() {
      // Mock config never changes after load, so there's nothing to notify.
      return () => {};
    },
  },
  store: {
    async get({ key }) {
      return { ok: true, response: { key, value: localStorage.getItem(STORE_PREFIX + key) } };
    },
    async put({ key, value }) {
      localStorage.setItem(STORE_PREFIX + key, value);
      return { ok: true, response: { key, value } };
    },
  },
  net: {
    async fetch({ request }) {
      const { url, method, body } = request;
      console.log(`[mock] net.fetch ${method} ${url}`);

      if (method === 'POST' && url.endsWith('/rest/api/3/search/jql')) {
        return { ok: true, response: { response: { status: 200, headers: [], body: jsonBody({ issues: MOCK_ISSUES }) } } };
      }

      if (method === 'POST' && /\/rest\/api\/3\/issue\/[^/]+\/worklog$/.test(url)) {
        console.log('[mock] worklog logged:', decodeBody(body));
        return { ok: true, response: { response: { status: 201, headers: [], body: new Uint8Array() } } };
      }

      // The focus webhook (or anything else) — pretend the automation fired.
      return { ok: true, response: { response: { status: 200, headers: [], body: new Uint8Array() } } };
    },
  },
};
