import type { ClientSurfaces, ConfigChanged } from '@bridgething/client';

type FavoriteChanged = Parameters<Parameters<ClientSurfaces['library']['onFavoriteChanged']>[0]>[0];

type PlayerStateReply = Parameters<Parameters<ClientSurfaces['player']['onSnapshot']>[0]>[0];
type MediaItem = NonNullable<PlayerStateReply['state']['track']>;
type QueueItem = PlayerStateReply['state']['queue'][number];

/** The slice of a player snapshot the now-playing UI reads, so the mock needn't build a full PlayerState. */
export type NowPlayingReply = {
  state: {
    track: Pick<
      MediaItem,
      | 'uri'
      | 'persistentId'
      | 'title'
      | 'artist'
      | 'artistUri'
      | 'album'
      | 'artworkId'
      | 'durationMs'
      | 'liked'
      | 'isLikeSupported'
    > | null;
    playback: Pick<PlayerStateReply['state']['playback'], 'state' | 'positionMs'>;
    /** Upcoming tracks in play order. */
    queue?: (Pick<QueueItem, 'uri' | 'title' | 'artist' | 'artworkId'> &
      Partial<Pick<QueueItem, 'queued' | 'artistUri'>>)[];
    context?: Pick<NonNullable<PlayerStateReply['state']['context']>, 'uri' | 'name'> | null;
  };
};

type NowPlayingResult = { ok: true; response: NowPlayingReply } | { ok: false };

/** Subset of BridgethingClient the app uses; real & mock both satisfy it, so callers don't care which. */
export type AppBridgeClient = {
  config: Pick<ClientSurfaces['config'], 'list' | 'onChanged'>;
  store: Pick<ClientSurfaces['store'], 'get' | 'put'>;
  net: Pick<ClientSurfaces['net'], 'fetch'>;
  player: Pick<
    ClientSurfaces['player'],
    | 'play'
    | 'queue'
    | 'queueGet'
    | 'onQueueChanged'
    | 'pause'
    | 'resume'
    | 'skipNext'
    | 'skipPrev'
    | 'skipToIndex'
    | 'seekTo'
  > & {
    onSnapshot(handler: (reply: NowPlayingReply) => void): () => void;
    stateGet(): Promise<NowPlayingResult>;
  };
  asset: Pick<ClientSurfaces['asset'], 'get'>;
  library: Pick<ClientSurfaces['library'], 'browse' | 'favoritesToggle' | 'onFavoriteChanged'>;
  lyrics: Pick<ClientSurfaces['lyrics'], 'get'>;
};

const DEFAULT_MOCK_CONFIG: Record<string, string> = {
  jiraBaseUrl: 'https://example.atlassian.net',
  jiraEmail: 'you@example.com',
  jiraApiToken: 'mock-token',
  jiraJql: 'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC',
  startStatus: 'In Progress',
  doneStatus: 'Done',
  roundTo: 'off',
  dailyTargetHours: '6',
  nudgeAt: '',
  focusWebhookUrl: '',
  focusWebhookFormat: 'json',
  defaultFocusMinutes: '25',
  timezone: '',
  clockFormat: '12h',
  clockFace: 'digital',
};

const MOCK_ISSUES = [
  {
    id: '10001',
    key: 'DESK-1',
    fields: { summary: 'Wire up the mock client', project: { key: 'DESK', name: 'Deskbar' } },
  },
  {
    id: '10002',
    key: 'DESK-2',
    fields: { summary: 'Test the focus timer end to end', project: { key: 'DESK', name: 'Deskbar' } },
  },
  {
    id: '10007',
    key: 'OPS-7',
    fields: { summary: 'Rotate the office wifi password', project: { key: 'OPS', name: 'Operations' } },
  },
];

const MOCK_ACCOUNT_ID = 'mock-account';

const MOCK_TRANSITIONS = [
  { id: '11', name: 'Start progress', to: { name: 'In Progress' } },
  { id: '21', name: 'Back to do', to: { name: 'To Do' } },
  { id: '31', name: 'Resolve', to: { name: 'Done' } },
];

// The fake tracker's worklogs, kept apart from the app's store so sync has something real to read back.
const TRACKER_KEY = 'deskbar-mock-tracker:worklogs';
type MockWorklog = { id: string; issueKey: string; seconds: number; started: number };
const issueStatuses = new Map<string, string>();
let nextWorklogId = 1;

function trackerWorklogs(): MockWorklog[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TRACKER_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTrackerWorklogs(list: MockWorklog[]): void {
  window.localStorage.setItem(TRACKER_KEY, JSON.stringify(list));
}

function addTrackerWorklog(worklog: Omit<MockWorklog, 'id'>): string {
  const id = `mock-${Date.now()}${nextWorklogId++}`;
  saveTrackerWorklogs([...trackerWorklogs(), { ...worklog, id }]);
  return id;
}

function removeTrackerWorklog(id: string): void {
  saveTrackerWorklogs(trackerWorklogs().filter(w => w.id !== id));
}

// Jira's own timestamp shape, offset without a colon.
const jiraTime = (ms: number) => new Date(ms).toISOString().replace('Z', '+0000');

function ok(status: number, data?: unknown) {
  return {
    ok: true as const,
    response: {
      response: { status, headers: [], body: data === undefined ? new Uint8Array() : jsonBody(data) },
    },
  };
}

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
  { title: 'Inbox Zero', artist: 'Auto Reply', album: 'Out of Office', durationMs: 198_000, color: '#a855f7' },
  { title: 'Hard Stop', artist: 'The Standups', album: 'Office Hours', durationMs: 263_000, color: '#f59e0b' },
  { title: 'Async by Default', artist: 'Auto Reply', album: 'Out of Office', durationMs: 231_000, color: '#14b8a6' },
];

const MOCK_CONTEXT = { uri: 'spotify:playlist:mock-deep-work', name: 'Deep Work' };

const mockArtistUri = (artist: string) => `spotify:artist:mock-${artist.toLowerCase().replace(/\W+/g, '-')}`;

// Timed lines for some tracks, plain words for one, nothing for the rest, so every lyrics state shows up.
const MOCK_LYRICS: Record<number, { synced: { startMs: number; text: string }[] | null; plain: string | null }> = {
  0: {
    synced: [
      [0, 'Calendar blocked from nine to noon'],
      [6_000, 'Status set to heads down'],
      [12_000, 'Notifications on the floor'],
      [18_000, 'Nobody needs me now'],
      [24_000, 'Headphones on, the world goes quiet'],
      [30_000, 'Just the cursor and the sound'],
      [36_000, 'Heads down, heads down'],
      [42_000, 'Keep the ticket moving'],
      [48_000, 'Heads down, heads down'],
      [54_000, 'Log it when the timer runs out'],
      [62_000, ''],
      [70_000, 'Standup moved to Thursday'],
      [76_000, 'Inbox can wait a while'],
    ].map(([startMs, text]) => ({ startMs: startMs as number, text: text as string })),
    plain: null,
  },
  2: {
    synced: [
      [0, 'Green light on the desk again'],
      [8_000, 'Door is open, come on in'],
      [16_000, "I'm available, I'm available"],
      [24_000, 'Ask me anything you want'],
    ].map(([startMs, text]) => ({ startMs: startMs as number, text: text as string })),
    plain: null,
  },
  3: { synced: null, plain: 'Zero unread and the light is low\nNothing left in the queue to go' },
};

type MockPlayback = { index: number; playing: boolean; positionMs: number; at: number };

let currentConfig: Record<string, string> = { ...DEFAULT_MOCK_CONFIG };
let playback: MockPlayback | null = { index: 0, playing: true, positionMs: 42_000, at: Date.now() };
// Where the playlist resumes after tracks queued by hand, which play first, as on the phone.
let contextAt = 0;
let userQueue: number[] = [];
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
        artistUri: mockArtistUri(t.artist),
        album: t.album,
        artworkId: `mock-art-${playback.index}`,
        durationMs: t.durationMs,
      },
      playback: { state: playback.playing ? 'playing' : 'paused', positionMs: livePositionMs(playback) },
      queue: [...mockQueue()],
      context: MOCK_CONTEXT,
    },
  };
}

function mockQueueItem(index: number, queued: boolean): QueueItem {
  const q = MOCK_TRACKS[index];
  return {
    uri: mockUri(index),
    title: q.title,
    artist: q.artist,
    artistUri: mockArtistUri(q.artist),
    album: q.album,
    albumUri: null,
    artworkId: `mock-art-${index}`,
    durationMs: q.durationMs,
    persistentId: null,
    queued,
  };
}

// Hand-queued tracks first, then the rest of the playlist, as the phone reports it.
function mockQueue(): QueueItem[] {
  return [
    ...userQueue.map(index => mockQueueItem(index, true)),
    ...MOCK_TRACKS.slice(1).map((_, i) => mockQueueItem((contextAt + 1 + i) % MOCK_TRACKS.length, false)),
  ];
}

function setPlayback(next: MockPlayback | null): void {
  playback = next;
  const reply = nowPlaying();
  playerListeners.forEach(fn => fn(reply));
}

// A diagonal gradient with three stacked bars, standing in for album art.
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
  contextAt = 0;
  userQueue = [];
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
  contextAt = 0;
  userQueue = [];
  playback = { index: 0, playing: true, positionMs: 42_000, at: Date.now() };
  issueStatuses.clear();
  window.localStorage.removeItem(TRACKER_KEY);
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

      const path = new URL(url);
      const issueMatch = /\/rest\/api\/3\/issue\/([^/]+)(\/.*)?$/.exec(path.pathname);
      const issueKey = issueMatch ? decodeURIComponent(issueMatch[1]) : null;
      const issueRest = issueMatch?.[2] ?? '';

      if (method === 'GET' && path.pathname.endsWith('/rest/api/3/myself')) {
        return ok(200, { accountId: MOCK_ACCOUNT_ID, displayName: 'Mock User' });
      }

      if (method === 'POST' && url.endsWith('/rest/api/3/search/jql')) {
        const { jql } = JSON.parse(decodeBody(body)) as { jql: string };
        let issues = MOCK_ISSUES;
        if (jql.startsWith('worklogAuthor')) {
          const keys = new Set(trackerWorklogs().map(w => w.issueKey));
          issues = MOCK_ISSUES.filter(i => keys.has(i.key));
        } else if (/^project = \w+/.test(jql)) {
          const project = /^project = (\w+)/.exec(jql)![1];
          issues = MOCK_ISSUES.filter(i => i.fields.project.key === project);
        }
        return ok(200, { issues });
      }

      if (issueKey && issueRest === '/worklog' && method === 'POST') {
        const { timeSpentSeconds } = JSON.parse(decodeBody(body)) as { timeSpentSeconds: number };
        const worklogId = addTrackerWorklog({ issueKey, seconds: timeSpentSeconds, started: Date.now() });
        console.log('[mock] worklog logged:', decodeBody(body), '-> id', worklogId);
        return ok(201, { id: worklogId });
      }

      if (issueKey && issueRest === '/worklog' && method === 'GET') {
        const since = Number(path.searchParams.get('startedAfter') ?? 0);
        const worklogs = trackerWorklogs()
          .filter(w => w.issueKey === issueKey && w.started >= since)
          .map(w => ({
            id: w.id,
            author: { accountId: MOCK_ACCOUNT_ID },
            started: jiraTime(w.started),
            timeSpentSeconds: w.seconds,
          }));
        return ok(200, { worklogs });
      }

      if (issueKey && issueRest.startsWith('/worklog/') && method === 'DELETE') {
        removeTrackerWorklog(decodeURIComponent(issueRest.slice('/worklog/'.length)));
        console.log('[mock] worklog deleted:', url);
        return ok(204);
      }

      if (issueKey && issueRest === '/transitions') {
        if (method === 'GET') return ok(200, { transitions: MOCK_TRANSITIONS });
        const { transition } = JSON.parse(decodeBody(body)) as { transition: { id: string } };
        const target = MOCK_TRANSITIONS.find(t => t.id === transition.id);
        if (target) issueStatuses.set(issueKey, target.to.name);
        console.log('[mock] issue moved:', issueKey, '->', target?.to.name);
        return ok(204);
      }

      if (issueKey && issueRest === '' && method === 'GET') {
        const issue = MOCK_ISSUES.find(i => i.key === issueKey);
        if (!issue)
          return ok(404, { errorMessages: ['Issue does not exist or you do not have permission to see it.'] });
        return ok(200, {
          id: issue.id,
          key: issue.key,
          fields: { ...issue.fields, status: { name: issueStatuses.get(issueKey) ?? 'To Do' } },
        });
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
      if (!playback) return;
      const queued = userQueue.shift();
      if (queued === undefined) contextAt = (contextAt + 1) % MOCK_TRACKS.length;
      setPlayback({ ...playback, index: queued ?? contextAt, positionMs: 0, at: Date.now() });
    },
    async skipPrev() {
      if (!playback) return;
      // Mirrors allowSeeking: a track more than 3s in restarts rather than going back.
      const restart = livePositionMs(playback) > 3000;
      const index = restart ? playback.index : (playback.index - 1 + MOCK_TRACKS.length) % MOCK_TRACKS.length;
      contextAt = index;
      setPlayback({ ...playback, index, positionMs: 0, at: Date.now() });
    },
    async play({ uri }) {
      const index = MOCK_TRACKS.findIndex((_, i) => mockUri(i) === uri);
      if (index === -1) return;
      contextAt = index;
      setPlayback({ index, playing: true, positionMs: 0, at: Date.now() });
    },
    async queue({ uri, position }) {
      const index = MOCK_TRACKS.findIndex((_, i) => mockUri(i) === uri);
      if (index === -1) return;
      if (position.type === 'next') userQueue.unshift(index);
      else if (position.type === 'append') userQueue.push(index);
      else userQueue.splice(position.data, 0, index);
      // Like the phone: queueing pushes no snapshot, so the app has to read the queue back.
    },
    async queueGet() {
      if (!playback) return { ok: true, response: { current: null, items: [], previous: [] } };
      return {
        ok: true,
        response: { current: mockQueueItem(playback.index, false), items: mockQueue(), previous: [] },
      };
    },
    onQueueChanged() {
      // The phone fires this only sometimes; the mock never does, so the read-back path is what gets exercised.
      return () => {};
    },
    async skipToIndex({ index }) {
      if (!playback) return;
      let next: number;
      if (index < userQueue.length) {
        next = userQueue[index];
        userQueue = userQueue.slice(index + 1);
      } else {
        contextAt = (contextAt + 1 + index - userQueue.length) % MOCK_TRACKS.length;
        userQueue = [];
        next = contextAt;
      }
      setPlayback({ ...playback, index: next, positionMs: 0, at: Date.now() });
    },
    async seekTo({ positionMs }) {
      if (playback) setPlayback({ ...playback, positionMs, at: Date.now() });
    },
  },
  library: {
    async browse({ nodeId }) {
      const tracks = MOCK_TRACKS.flatMap((t, i) => {
        if (nodeId !== MOCK_CONTEXT.uri && mockArtistUri(t.artist) !== nodeId) return [];
        const artist = { id: mockArtistUri(t.artist), name: t.artist, artworkId: null };
        const track = {
          id: mockUri(i),
          name: t.title,
          album: { id: `spotify:album:mock-${i}`, name: t.album, artworkId: `mock-art-${i}` },
          artist,
          artists: [artist],
          durationMs: t.durationMs,
          imageId: `mock-art-${i}`,
          saved: likedUris.has(mockUri(i)),
        };
        return [{ type: 'item' as const, data: { type: 'track' as const, data: track } }];
      });
      if (tracks.length === 0)
        return { ok: false, kind: 'domain', error: { error: { type: 'notFound', data: { uri: nodeId ?? '' } } } };
      return { ok: true, response: { result: { entries: tracks, total: tracks.length, hasMore: false } } };
    },
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
  lyrics: {
    async get() {
      if (!playback) return { ok: false, kind: 'domain', error: { error: { type: 'nothingPlaying' } } };
      const lyrics = MOCK_LYRICS[playback.index];
      return {
        ok: true,
        response: {
          trackUri: mockUri(playback.index),
          trackPersistentId: null,
          lyrics: lyrics ? { ...lyrics, source: 'mock' } : null,
        },
      };
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
