import type { ClientSurfaces, ConfigChanged } from '@bridgething/client';

type FavoriteChanged = Parameters<Parameters<ClientSurfaces['library']['onFavoriteChanged']>[0]>[0];

type PlayerStateReply = Parameters<Parameters<ClientSurfaces['player']['onSnapshot']>[0]>[0];
type MediaItem = NonNullable<PlayerStateReply['state']['track']>;

/** The slice of a player snapshot the now-playing UI reads, so the mock needn't build a full PlayerState. */
export type NowPlayingReply = {
  state: {
    track: Pick<
      MediaItem,
      'uri' | 'persistentId' | 'title' | 'artist' | 'album' | 'artworkId' | 'durationMs' | 'liked' | 'isLikeSupported'
    > | null;
    playback: Pick<PlayerStateReply['state']['playback'], 'state' | 'positionMs'>;
  };
};

type NowPlayingResult = { ok: true; response: NowPlayingReply } | { ok: false };

/** Subset of BridgethingClient the app uses; real & mock both satisfy it, so callers don't care which. */
export type AppBridgeClient = {
  config: Pick<ClientSurfaces['config'], 'list' | 'onChanged'>;
  store: Pick<ClientSurfaces['store'], 'get' | 'put'>;
  net: Pick<ClientSurfaces['net'], 'fetch'>;
  player: Pick<ClientSurfaces['player'], 'pause' | 'resume' | 'skipNext' | 'skipPrev' | 'seekTo'> & {
    onSnapshot(handler: (reply: NowPlayingReply) => void): () => void;
    stateGet(): Promise<NowPlayingResult>;
  };
  asset: Pick<ClientSurfaces['asset'], 'get'>;
  library: Pick<ClientSurfaces['library'], 'favoritesToggle' | 'onFavoriteChanged'>;
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

/** The real client's domain-level net.fetch failure reasons (dispatch.generated.d.ts's NetError). */
export type MockNetErrorType = 'requestFailed' | 'timeout' | 'unavailable' | 'noGateway';

export type MockFetchFault = {
  /** HTTP status the mocked response reports; defaults to 500 unless `throws`/`unreachable` is set. */
  status?: number;
  /** Simulates the request itself failing (DNS/timeout/reset) instead of returning an HTTP response. */
  throws?: boolean;
  /**
   * Simulates a domain-level failure — net.fetch resolves `{ok:false, kind:'domain', ...}` rather
   * than throwing (like `throws`) or returning an HTTP status (like `status`). This is the branch
   * jira.ts's `res.kind === 'domain' ? res.error.error.type : ...` reasons over; nothing else
   * exercises it.
   */
  unreachable?: MockNetErrorType;
};

// Fictional tracks in Deskbar's status colors; the second title is long enough to scroll.
const MOCK_TRACKS = [
  { title: 'Heads Down', artist: 'The Standups', album: 'Office Hours', durationMs: 244_000, color: '#3b82f6' },
  {
    title: 'Five More Minutes (Calendar Invite Declined Remix)',
    artist: 'The Standups featuring Do Not Disturb',
    album: 'Office Hours',
    durationMs: 322_000,
    color: '#e74c3c',
  },
  { title: 'Available', artist: 'The Standups', album: 'Office Hours', durationMs: 247_000, color: '#2ecc71' },
];

type MockPlayback = { index: number; playing: boolean; positionMs: number; at: number };

let currentConfig: Record<string, string> = { ...DEFAULT_MOCK_CONFIG };
let playback: MockPlayback | null = { index: 0, playing: true, positionMs: 42_000, at: Date.now() };
const playerListeners = new Set<(reply: NowPlayingReply) => void>();
const likedUris = new Set<string>();
const favoriteListeners = new Set<(msg: FavoriteChanged) => void>();

const mockUri = (index: number) => `spotify:track:mock-${index}`;
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

function livePositionMs(p: MockPlayback): number {
  const raw = p.positionMs + (p.playing ? Date.now() - p.at : 0);
  return Math.min(raw, MOCK_TRACKS[p.index].durationMs);
}

function nowPlaying(): NowPlayingReply {
  if (!playback) return { state: { track: null, playback: { state: 'stopped', positionMs: 0 } } };
  const t = MOCK_TRACKS[playback.index];
  return {
    state: {
      track: {
        uri: mockUri(playback.index),
        persistentId: null,
        liked: likedUris.has(mockUri(playback.index)),
        isLikeSupported: true,
        title: t.title,
        artist: t.artist,
        album: t.album,
        artworkId: `mock-art-${playback.index}`,
        durationMs: t.durationMs,
      },
      playback: { state: playback.playing ? 'playing' : 'paused', positionMs: livePositionMs(playback) },
    },
  };
}

function setPlayback(next: MockPlayback | null): void {
  playback = next;
  const reply = nowPlaying();
  playerListeners.forEach(fn => fn(reply));
}

// A diagonal gradient with three stacked bars, echoing Home's three status tiles.
function mockArtwork(index: number): Uint8Array {
  const { color } = MOCK_TRACKS[index];
  const bars = [60, 112, 164]
    .map((y, i) => `<rect x="44" y="${y}" width="${160 - i * 36}" height="24" rx="12" fill="rgba(255,255,255,0.85)"/>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="248" height="248"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#0b0d10"/></linearGradient></defs><rect width="248" height="248" fill="url(#g)"/>${bars}</svg>`;
  return new TextEncoder().encode(svg);
}

/** Simulate the phone going away (or coming back with a track), as if Spotify stopped reporting. */
export function setMockNowPlaying(on: boolean): void {
  setPlayback(on ? { index: 0, playing: true, positionMs: 0, at: Date.now() } : null);
}

/** Resets config, faults, and persisted store state, mainly to isolate tests from each other. */
export function resetMockState(): void {
  currentConfig = { ...DEFAULT_MOCK_CONFIG };
  fetchFaults.clear();
  configListeners.clear();
  playerListeners.clear();
  likedUris.clear();
  favoriteListeners.clear();
  playback = { index: 0, playing: true, positionMs: 42_000, at: Date.now() };
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
      if (fault?.unreachable) {
        const type = fault.unreachable;
        // Only 'requestFailed' carries a `data.reason` in the real NetError union; build it
        // per-variant so the literal matches the discriminated union shape exactly.
        const error = type === 'requestFailed' ? { type, data: { reason: 'mock unreachable' } } : { type };
        return { ok: false, kind: 'domain', error: { error } };
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
  player: {
    onSnapshot(handler) {
      playerListeners.add(handler);
      return () => playerListeners.delete(handler);
    },
    async stateGet() {
      return { ok: true, response: nowPlaying() };
    },
    async pause() {
      if (playback) setPlayback({ ...playback, playing: false, positionMs: livePositionMs(playback), at: Date.now() });
    },
    async resume() {
      if (playback) setPlayback({ ...playback, playing: true, at: Date.now() });
    },
    async skipNext() {
      if (playback)
        setPlayback({ ...playback, index: (playback.index + 1) % MOCK_TRACKS.length, positionMs: 0, at: Date.now() });
    },
    async skipPrev() {
      if (!playback) return;
      // Mirrors allowSeeking: a track more than 3s in restarts rather than going back.
      const restart = livePositionMs(playback) > 3000;
      const index = restart ? playback.index : (playback.index - 1 + MOCK_TRACKS.length) % MOCK_TRACKS.length;
      setPlayback({ ...playback, index, positionMs: 0, at: Date.now() });
    },
    async seekTo({ positionMs }) {
      if (playback) setPlayback({ ...playback, positionMs, at: Date.now() });
    },
  },
  library: {
    async favoritesToggle({ item }) {
      const liked = !likedUris.has(item.uri);
      if (liked) likedUris.add(item.uri);
      else likedUris.delete(item.uri);
      favoriteListeners.forEach(fn => fn({ uri: item.uri, liked }));
      setPlayback(playback);
    },
    onFavoriteChanged(handler) {
      favoriteListeners.add(handler);
      return () => favoriteListeners.delete(handler);
    },
  },
  asset: {
    async get({ id, requestId }) {
      const index = Number(id.replace('mock-art-', ''));
      if (!MOCK_TRACKS[index]) return { ok: false, kind: 'domain', error: { requestId, id } };
      return { ok: true, response: { requestId, id, bytes: mockArtwork(index), mime: 'image/svg+xml' } };
    },
  },
};
