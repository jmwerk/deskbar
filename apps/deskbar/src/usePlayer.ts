import { useCallback, useEffect, useState } from 'react';
import type { AppBridgeClient, NowPlayingReply } from './mockClient';
import { useArtwork } from './music';

export type NowPlayingTrack = {
  uri: string | null;
  title: string;
  artistUri: string | null;
  artist: string | null;
  album: string | null;
  artUrl: string | null;
};

export type QueuedTrack = {
  uri: string;
  title: string;
  artist: string | null;
  artworkId: string | null;
  artistUri: string | null;
  /** Queued by hand rather than coming up from the playlist; these play first. */
  queued: boolean;
  /** Its place in the phone's own queue, for `skipTo`; null for a track queued here the phone hasn't listed. */
  phoneIndex: number | null;
};

export type Player = {
  track: NowPlayingTrack | null;
  /** Upcoming tracks, in play order; empty when the phone reports none. */
  queue: QueuedTrack[];
  /** The playlist, album or station playing, once the phone has resolved its name. */
  context: string | null;
  contextUri: string | null;
  playing: boolean;
  positionMs: number;
  durationMs: number;
  /** Null when the current item can't be saved to the library. */
  liked: boolean | null;
  toggle: () => void;
  toggleLike: () => void;
  seekBy: (deltaMs: number) => void;
  seekTo: (ms: number) => void;
  skip: (dir: 1 | -1) => void;
  /** Jumps to an upcoming track by its position in `queue`. */
  skipTo: (index: number) => void;
  /** Plays a track within an album, playlist or artist, so next and previous follow that context. */
  play: (uri: string, contextUri: string | null) => void;
  /**
   * Spotify's Add to queue: the track goes to the end of the hand-queued tracks, which play before the playlist
   * resumes, in the order they were added. It shows in `queue` at once and stays until it plays.
   */
  addToQueue: (track: Pick<QueuedTrack, 'uri' | 'title' | 'artist' | 'artistUri' | 'artworkId'>) => void;
};

type Track = NonNullable<NowPlayingReply['state']['track']>;

type Queued = NonNullable<NowPlayingReply['state']['queue']>[number];

// What the phone last said, stamped with when we heard it.
type Report = {
  track: Track;
  title: string;
  playing: boolean;
  positionMs: number;
  queue: Queued[];
  context: string | null;
  contextUri: string | null;
  receivedAt: number;
};

// The phone pushes no snapshot when the queue changes and only sometimes a queue event, so after queueing a
// track the queue is re-read a few times until the phone has applied it.
const QUEUE_REFRESH_MS = [400, 1200, 2500];

// Re-render cadence while playing; the playhead itself is computed from the clock, not stepped.
const PLAYHEAD_REFRESH_MS = 500;

function toReport({ state }: NowPlayingReply): Report | null {
  const title = state.track?.title;
  if (!state.track || !title) return null;
  return {
    track: state.track,
    title,
    playing: state.playback.state === 'playing',
    positionMs: state.playback.positionMs,
    queue: state.queue ?? [],
    context: state.context?.name ?? null,
    contextUri: state.context?.uri ?? null,
    receivedAt: Date.now(),
  };
}

type MergedQueued = Queued & { queued: boolean; phoneIndex: number | null };

/**
 * The phone's queue order is the truth, but its queued flag is not: a track added from here can come back
 * unflagged. So the hand-queued run at the head is every leading track the phone flags or that was added from
 * here; tracks added here that the phone hasn't listed yet follow that run, and the playlist comes after.
 */
export function mergeQueue(reported: Queued[], handQueue: Queued[]): MergedQueued[] {
  const owed = new Map<string, number>();
  for (const q of handQueue) owed.set(q.uri, (owed.get(q.uri) ?? 0) + 1);
  let lead = 0;
  for (; lead < reported.length; lead++) {
    const q = reported[lead];
    const ours = (owed.get(q.uri) ?? 0) > 0;
    if (!q.queued && !ours) break;
    if (ours) owed.set(q.uri, (owed.get(q.uri) ?? 0) - 1);
  }
  const unseen: Queued[] = [];
  for (const q of handQueue) {
    const n = owed.get(q.uri) ?? 0;
    if (n === 0) continue;
    owed.set(q.uri, n - 1);
    unseen.push(q);
  }
  return [
    ...reported.slice(0, lead).map((q, i) => ({ ...q, queued: true, phoneIndex: i })),
    ...unseen.map(q => ({ ...q, queued: true, phoneIndex: null })),
    ...reported.slice(lead).map((q, i) => ({ ...q, queued: false, phoneIndex: lead + i })),
  ];
}

/** Now-playing state from the phone's Spotify; `track` is null with no phone or nothing playing. */
export function usePlayer(client: AppBridgeClient): Player {
  const [report, setReport] = useState<Report | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // A tap here or a change reported elsewhere, keyed by uri so it can't leak onto the next track.
  const [likeOverride, setLikeOverride] = useState<{ uri: string; liked: boolean } | null>(null);

  useEffect(() => {
    const off = client.player.onSnapshot(reply => setReport(toReport(reply)));
    void client.player.stateGet().then(res => {
      if (res.ok) setReport(toReport(res.response));
    });
    return off;
  }, [client]);

  const applyQueue = useCallback((queue: Queued[]) => setReport(r => (r ? { ...r, queue } : r)), []);
  const refreshQueue = useCallback(() => {
    void client.player.queueGet().then(res => {
      if (res.ok) applyQueue(res.response.items);
    });
  }, [client, applyQueue]);
  useEffect(() => client.player.onQueueChanged(reply => applyQueue(reply.items)), [client, applyQueue]);

  // Tracks added from here, oldest first. The phone keeps them in the right place but its queued flag comes and
  // goes, so this is what tells them apart from the playlist until each one plays.
  const [handQueue, setHandQueue] = useState<Queued[]>([]);

  useEffect(() => client.library.onFavoriteChanged(({ uri, liked }) => setLikeOverride({ uri, liked })), [client]);

  const track = report?.track ?? null;
  const playing = report?.playing ?? false;
  const durationMs = track?.durationMs ?? 0;

  // The phone's own report wins once it moves, e.g. a like made on the phone after a tap here.
  useEffect(() => setLikeOverride(null), [track?.uri, track?.liked]);

  useEffect(() => {
    setNow(Date.now());
    if (!playing) return;
    const id = setInterval(() => setNow(Date.now()), PLAYHEAD_REFRESH_MS);
    return () => clearInterval(id);
  }, [playing, report]);

  const [artUrl] = useArtwork(client, [track?.artworkId ?? null]);

  let positionMs = 0;
  if (report) {
    const elapsed = playing ? Math.max(0, now - report.receivedAt) : 0;
    positionMs = report.positionMs + elapsed;
    if (durationMs > 0) positionMs = Math.min(positionMs, durationMs);
  }

  const seekTo = useCallback(
    (ms: number) => {
      const clamped = Math.round(Math.max(0, durationMs > 0 ? Math.min(ms, durationMs) : ms));
      // Move the playhead now rather than on the phone's next report, so every control feels instant.
      setReport(r => (r ? { ...r, positionMs: clamped, receivedAt: Date.now() } : r));
      void client.player.seekTo({ positionMs: clamped });
    },
    [client, durationMs],
  );

  const seekBy = useCallback((deltaMs: number) => seekTo(positionMs + deltaMs), [seekTo, positionMs]);

  const toggle = useCallback(() => {
    void (playing ? client.player.pause() : client.player.resume());
  }, [client, playing]);

  const skip = useCallback(
    (dir: 1 | -1) => {
      void (dir === 1 ? client.player.skipNext() : client.player.skipPrev({ allowSeeking: true }));
    },
    [client],
  );

  const skipTo = useCallback((index: number) => void client.player.skipToIndex({ index }), [client]);
  const play = useCallback(
    (uri: string, contextUri: string | null) =>
      void client.player.play({ uri, context: contextUri ? { contextUri } : null }),
    [client],
  );

  const addToQueue = useCallback(
    (t: Pick<QueuedTrack, 'uri' | 'title' | 'artist' | 'artistUri' | 'artworkId'>) => {
      setHandQueue(h => [...h, { ...t, queued: true }]);
      void client.player.queue({ uri: t.uri, position: { type: 'append' } });
      QUEUE_REFRESH_MS.forEach(ms => setTimeout(refreshQueue, ms));
    },
    [client, refreshQueue],
  );

  // A queued track is done once it plays. Only that one: on Spotify, jumping past queued tracks keeps them queued.
  const trackUri = track?.uri ?? null;
  useEffect(() => {
    if (!trackUri) return;
    setHandQueue(h => {
      const at = h.findIndex(q => q.uri === trackUri);
      return at === -1 ? h : [...h.slice(0, at), ...h.slice(at + 1)];
    });
  }, [trackUri]);

  const queue = mergeQueue(report?.queue ?? [], handQueue);

  const likeUri = track?.uri != null && track.isLikeSupported !== false ? track.uri : null;
  const liked = likeUri == null ? null : likeOverride?.uri === likeUri ? likeOverride.liked : (track?.liked ?? false);

  const toggleLike = useCallback(() => {
    if (likeUri == null || liked == null) return;
    setLikeOverride({ uri: likeUri, liked: !liked });
    const kind = likeUri.startsWith('spotify:episode:') ? 'podcastEpisode' : 'track';
    void client.library.favoritesToggle({ item: { uri: likeUri, kind, persistentId: track?.persistentId ?? null } });
  }, [client, likeUri, liked, track?.persistentId]);

  return {
    track:
      report && track
        ? {
            uri: track.uri,
            title: report.title,
            artist: track.artist,
            artistUri: track.artistUri,
            album: track.album,
            artUrl,
          }
        : null,
    queue: queue.map(q => ({
      uri: q.uri,
      title: q.title ?? 'Untitled',
      artist: q.artist,
      artworkId: q.artworkId,
      artistUri: q.artistUri ?? null,
      queued: q.queued,
      phoneIndex: q.phoneIndex,
    })),
    context: report?.context ?? null,
    contextUri: report?.contextUri ?? null,
    playing,
    positionMs,
    durationMs,
    liked,
    toggle,
    toggleLike,
    seekBy,
    seekTo,
    skip,
    skipTo,
    play,
    addToQueue,
  };
}
