import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppBridgeClient, NowPlayingReply } from './mockClient';

export type NowPlayingTrack = {
  title: string;
  artist: string | null;
  album: string | null;
  artUrl: string | null;
};

export type Player = {
  track: NowPlayingTrack | null;
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
};

type Track = NonNullable<NowPlayingReply['state']['track']>;

// What the phone last said, stamped with when we heard it.
type Report = { track: Track; title: string; playing: boolean; positionMs: number; receivedAt: number };

// Re-render cadence while playing; the playhead itself is computed from the clock, not stepped.
const PLAYHEAD_REFRESH_MS = 500;

// Covers kept as object URLs: the current one plus a couple back, so skipping back reuses them.
const ART_CACHE_SIZE = 3;

function toReport({ state }: NowPlayingReply): Report | null {
  const title = state.track?.title;
  if (!state.track || !title) return null;
  return {
    track: state.track,
    title,
    playing: state.playback.state === 'playing',
    positionMs: state.playback.positionMs,
    receivedAt: Date.now(),
  };
}

// Artwork arrives as bytes over the daemon; turn it into object URLs and revoke the oldest past the cap.
function useArtwork(client: AppBridgeClient, artId: string | null): string | null {
  const cache = useRef(new Map<string, string>());
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const urls = cache.current;
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, []);

  useEffect(() => {
    if (!artId) {
      setUrl(null);
      return;
    }
    const urls = cache.current;
    const hit = urls.get(artId);
    if (hit) {
      // Re-insert so Map order stays least-recently-used first.
      urls.delete(artId);
      urls.set(artId, hit);
      setUrl(hit);
      return;
    }
    let stale = false;
    void client.asset.get({ id: artId, requestId: crypto.randomUUID() }).then(res => {
      if (stale || !res.ok) return;
      // Bytes can arrive as a plain number array depending on the transport's decoding.
      const bytes = Uint8Array.from(res.response.bytes as unknown as number[]);
      const created = URL.createObjectURL(new Blob([bytes], { type: res.response.mime ?? 'image/jpeg' }));
      urls.set(artId, created);
      while (urls.size > ART_CACHE_SIZE) {
        const [oldestId, oldestUrl] = urls.entries().next().value!;
        urls.delete(oldestId);
        URL.revokeObjectURL(oldestUrl);
      }
      setUrl(created);
    });
    return () => {
      stale = true;
    };
  }, [client, artId]);

  return url;
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

  const artUrl = useArtwork(client, track?.artworkId ?? null);

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

  const likeUri = track?.uri != null && track.isLikeSupported !== false ? track.uri : null;
  const liked = likeUri == null ? null : likeOverride?.uri === likeUri ? likeOverride.liked : (track?.liked ?? false);

  const toggleLike = useCallback(() => {
    if (likeUri == null || liked == null) return;
    setLikeOverride({ uri: likeUri, liked: !liked });
    const kind = likeUri.startsWith('spotify:episode:') ? 'podcastEpisode' : 'track';
    void client.library.favoritesToggle({ item: { uri: likeUri, kind, persistentId: track?.persistentId ?? null } });
  }, [client, likeUri, liked, track?.persistentId]);

  return {
    track: report && track ? { title: report.title, artist: track.artist, album: track.album, artUrl } : null,
    playing,
    positionMs,
    durationMs,
    liked,
    toggle,
    toggleLike,
    seekBy,
    seekTo,
    skip,
  };
}
