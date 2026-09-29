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
  toggle: () => void;
  seekBy: (deltaMs: number) => void;
  seekTo: (ms: number) => void;
  skip: (dir: 1 | -1) => void;
};

// Last daemon report plus when it arrived, so the playhead extrapolates between snapshots.
type Snapshot = {
  title: string;
  artist: string | null;
  album: string | null;
  artId: string | null;
  playing: boolean;
  positionMs: number;
  durationMs: number;
  at: number;
};

// A replaced artwork blob stays alive this long so the crossfade off it doesn't blank.
const ARTWORK_LINGER_MS = 700;

const TICK_MS = 250;

function toSnapshot({ state }: NowPlayingReply, at: number): Snapshot | null {
  const { track, playback } = state;
  if (!track?.title) return null;
  return {
    title: track.title,
    artist: track.artist,
    album: track.album,
    artId: track.artworkId,
    playing: playback.state === 'playing',
    positionMs: playback.positionMs,
    durationMs: track.durationMs ?? 0,
    at,
  };
}

/** Now-playing state from the phone's Spotify; `track` is null with no phone or nothing playing. */
export function usePlayer(client: AppBridgeClient): Player {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [artUrl, setArtUrl] = useState<string | null>(null);
  const [positionMs, setPositionMs] = useState(0);

  const retired = useRef<{ url: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const retire = useCallback((url: string) => {
    if (retired.current) {
      clearTimeout(retired.current.timer);
      URL.revokeObjectURL(retired.current.url);
    }
    retired.current = {
      url,
      timer: setTimeout(() => {
        retired.current = null;
        URL.revokeObjectURL(url);
      }, ARTWORK_LINGER_MS),
    };
  }, []);
  useEffect(
    () => () => {
      if (retired.current) URL.revokeObjectURL(retired.current.url);
    },
    [],
  );

  useEffect(() => {
    const off = client.player.onSnapshot(reply => setSnap(toSnapshot(reply, Date.now())));
    void client.player.stateGet().then(res => {
      if (res.ok) setSnap(toSnapshot(res.response, Date.now()));
    });
    return off;
  }, [client]);

  useEffect(() => {
    if (!snap?.artId) {
      setArtUrl(null);
      return;
    }
    let dead = false;
    let url: string | null = null;
    void client.asset.get({ id: snap.artId, requestId: crypto.randomUUID() }).then(res => {
      if (dead || !res.ok) return;
      // msgpack can hand bytes over as a plain number array; Uint8Array.from accepts both.
      const bytes = Uint8Array.from(res.response.bytes as unknown as number[]);
      url = URL.createObjectURL(new Blob([bytes], { type: res.response.mime ?? 'image/jpeg' }));
      setArtUrl(url);
    });
    return () => {
      dead = true;
      if (url) retire(url);
    };
  }, [client, snap?.artId, retire]);

  useEffect(() => {
    if (!snap) return;
    const { positionMs: base, at, playing, durationMs: total } = snap;
    const step = () => {
      const raw = base + (playing ? Date.now() - at : 0);
      setPositionMs(total > 0 ? Math.min(raw, total) : raw);
    };
    step();
    if (!playing) return;
    const id = setInterval(step, TICK_MS);
    return () => clearInterval(id);
  }, [snap]);

  const toggle = useCallback(() => {
    void (snap?.playing ? client.player.pause() : client.player.resume());
  }, [client, snap?.playing]);

  const seekBy = useCallback(
    (deltaMs: number) => {
      const total = snap?.durationMs ?? 0;
      const next = Math.max(0, Math.min(total > 0 ? total : Infinity, positionMs + deltaMs));
      void client.player.seekTo({ positionMs: Math.round(next) });
    },
    [client, snap?.durationMs, positionMs],
  );

  const seekTo = useCallback((ms: number) => seekBy(ms - positionMs), [seekBy, positionMs]);

  const skip = useCallback(
    (dir: 1 | -1) => {
      void (dir === 1 ? client.player.skipNext() : client.player.skipPrev({ allowSeeking: true }));
    },
    [client],
  );

  return {
    track: snap ? { title: snap.title, artist: snap.artist, album: snap.album, artUrl } : null,
    playing: snap?.playing ?? false,
    positionMs,
    durationMs: snap?.durationMs ?? 0,
    toggle,
    seekBy,
    seekTo,
    skip,
  };
}
