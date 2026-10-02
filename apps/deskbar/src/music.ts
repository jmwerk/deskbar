import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppBridgeClient } from './mockClient';

// Artwork arrives as bytes over the daemon; turn it into object URLs and revoke the oldest past the cap.
export function useArtwork(client: AppBridgeClient, ids: (string | null)[], cacheSize = 4): (string | null)[] {
  const cache = useRef(new Map<string, string>());
  const pending = useRef(new Set<string>());
  const wanted = useRef<(string | null)[]>([]);
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(() => new Map());
  const key = ids.join('|');

  useEffect(() => {
    const owned = cache.current;
    return () => owned.forEach(u => URL.revokeObjectURL(u));
  }, []);

  useEffect(() => {
    const shown = key.split('|').map(id => id || null);
    wanted.current = shown;
    const owned = cache.current;
    for (const id of shown) {
      if (!id || pending.current.has(id)) continue;
      const hit = owned.get(id);
      if (hit) {
        // Re-insert so Map order stays least-recently-used first.
        owned.delete(id);
        owned.set(id, hit);
        continue;
      }
      pending.current.add(id);
      void client.asset.get({ id, requestId: crypto.randomUUID() }).then(res => {
        pending.current.delete(id);
        if (!res.ok || owned.has(id)) return;
        // Bytes can arrive as a plain number array depending on the transport's decoding.
        const bytes = Uint8Array.from(res.response.bytes as unknown as number[]);
        // Cached even if the track moved on meanwhile, so skipping straight back doesn't refetch it.
        owned.set(id, URL.createObjectURL(new Blob([bytes], { type: res.response.mime ?? 'image/jpeg' })));
        for (const [oldId, oldUrl] of owned) {
          if (owned.size <= cacheSize) break;
          if (wanted.current.includes(oldId)) continue;
          owned.delete(oldId);
          URL.revokeObjectURL(oldUrl);
        }
        setUrls(new Map(owned));
      });
    }
  }, [client, key, cacheSize]);

  return ids.map(id => (id ? (urls.get(id) ?? null) : null));
}

export type LyricLine = { startMs: number; text: string };

export type LyricsState =
  | { status: 'loading' }
  | { status: 'synced'; lines: LyricLine[] }
  /** The phone has the words but no timing, so there's nothing to follow along with. */
  | { status: 'unsynced' }
  | { status: 'none' }
  | { status: 'unavailable' };

/** Lyrics for the track playing now, refetched when it changes; a reply for an earlier track is dropped. */
export function useLyrics(client: AppBridgeClient, trackUri: string | null): LyricsState {
  const [result, setResult] = useState<{ uri: string; state: LyricsState } | null>(null);

  useEffect(() => {
    if (!trackUri) return;
    let live = true;
    void client.lyrics.get().then(res => {
      if (!live) return;
      if (!res.ok) {
        setResult({ uri: trackUri, state: { status: 'unavailable' } });
        return;
      }
      if (res.response.trackUri !== trackUri) return;
      const lyrics = res.response.lyrics;
      let state: LyricsState = { status: 'none' };
      if (lyrics?.synced?.length) state = { status: 'synced', lines: lyrics.synced };
      else if (lyrics?.plain) state = { status: 'unsynced' };
      setResult({ uri: trackUri, state });
    });
    return () => {
      live = false;
    };
  }, [client, trackUri]);

  if (!trackUri) return { status: 'none' };
  return result?.uri === trackUri ? result.state : { status: 'loading' };
}

/** The line being sung at `positionMs`: the last one already started, or -1 before the first. */
export function lyricIndex(lines: LyricLine[], positionMs: number): number {
  let found = -1;
  for (let i = 0; i < lines.length && lines[i].startMs <= positionMs; i++) found = i;
  return found;
}

export type BrowsedTrack = {
  uri: string;
  title: string;
  artists: string;
  /** The primary credited artist, for Go to artist. */
  artistUri: string | null;
  artistName: string | null;
  artworkId: string | null;
};

export type ListState<T> = { status: 'loading' } | { status: 'ready'; items: T[] } | { status: 'error' };

// The phone pages a browse at up to 100 entries.
const BROWSE_PAGE = 100;

/**
 * The tracks under a library node, in order: a playlist's or album's tracks, or an artist's top tracks. Pages
 * through the phone's browser up to `max` tracks.
 */
export function useBrowseTracks(client: AppBridgeClient, nodeId: string | null, max: number): ListState<BrowsedTrack> {
  const [result, setResult] = useState<{ nodeId: string; state: ListState<BrowsedTrack> } | null>(null);

  useEffect(() => {
    if (!nodeId) return;
    let live = true;
    void (async () => {
      const items: BrowsedTrack[] = [];
      let failed = false;
      for (let offset = 0; items.length < max;) {
        const res = await client.library.browse({ nodeId, limit: BROWSE_PAGE, offset });
        if (!live) return;
        if (!res.ok) {
          // A later page failing still leaves a usable list; only a failed first page is an error.
          failed = offset === 0;
          break;
        }
        const { entries, hasMore } = res.response.result;
        for (const entry of entries) {
          if (entry.type !== 'item' || entry.data.type !== 'track') continue;
          const t = entry.data.data;
          items.push({
            uri: t.id,
            title: t.name,
            artists: t.artists.map(a => a.name).join(', '),
            artistUri: t.artist.id || null,
            artistName: t.artist.name || null,
            artworkId: t.imageId,
          });
        }
        if (!hasMore || entries.length === 0) break;
        offset += entries.length;
      }
      if (!live) return;
      setResult({ nodeId, state: failed ? { status: 'error' } : { status: 'ready', items: items.slice(0, max) } });
    })();
    return () => {
      live = false;
    };
  }, [client, nodeId, max]);

  if (!nodeId) return { status: 'error' };
  return result?.nodeId === nodeId ? result.state : { status: 'loading' };
}

const LYRICS_PREF_KEY = 'deskbar/lyrics';

/** Whether the player shows lyrics, saved on the device so it survives a restart; on until turned off. */
export function useLyricsPreference(client: AppBridgeClient): [shown: boolean, toggle: () => void] {
  const [shown, setShown] = useState(true);

  useEffect(() => {
    let live = true;
    void client.store.get({ key: LYRICS_PREF_KEY }).then(res => {
      if (live && res.ok && res.response.value === 'off') setShown(false);
    });
    return () => {
      live = false;
    };
  }, [client]);

  const toggle = useCallback(() => {
    setShown(on => {
      void client.store.put({ key: LYRICS_PREF_KEY, value: on ? 'off' : 'on' });
      return !on;
    });
  }, [client]);

  return [shown, toggle];
}
