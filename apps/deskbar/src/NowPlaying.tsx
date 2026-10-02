import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useArtTint } from './artTint';
import { formatClock, formatDuration } from './format';
import { client } from './bridgething';
import {
  BoltIcon,
  CheckIcon,
  ChevronRightIcon,
  HeartIcon,
  LyricsIcon,
  MoreIcon,
  MusicIcon,
  PauseIcon,
  PlayIcon,
  QueueAddIcon,
  SkipBackIcon,
  SkipForwardIcon,
} from './icons';
import {
  lyricIndex,
  useArtwork,
  useBrowseTracks,
  useLyrics,
  useLyricsPreference,
  type BrowsedTrack,
  type LyricLine,
} from './music';
import { ScrollText } from './ScrollText';
import { useDialPress, useKeydown, useKeyFlash, useRotaryStep } from './physicalControls';
import type { Player } from './usePlayer';

// Keeps the icon tabs the same height as the text tabs on Home and Focus.
const TAB_ICON = 24;

/** The dock's compact now-playing entry; a quiet placeholder when no phone or nothing is playing. */
export function NowPlayingChip({ player, onOpen }: { player: Player; onOpen: () => void }) {
  const { track, playing } = player;
  if (!track) {
    return (
      <div className="now-playing-chip now-playing-chip-empty">
        <span className="now-playing-chip-art now-playing-art-placeholder">
          <MusicIcon size={20} />
        </span>
        <span className="now-playing-chip-title">Nothing playing</span>
      </div>
    );
  }
  return (
    <button className="now-playing-chip" onClick={onOpen}>
      {track.artUrl ? (
        <img className="now-playing-chip-art" src={track.artUrl} alt="" draggable={false} />
      ) : (
        <span className="now-playing-chip-art now-playing-art-placeholder">
          <MusicIcon size={20} />
        </span>
      )}
      <span className="now-playing-chip-text">
        <ScrollText text={track.title} className="now-playing-chip-title" />
        {track.artist && <ScrollText text={track.artist} className="now-playing-chip-artist" />}
      </span>
      <span className={`eq ${playing ? 'eq-playing' : ''}`} role="img" aria-label={playing ? 'Playing' : 'Paused'}>
        <span />
        <span />
        <span />
      </span>
    </button>
  );
}

// Deskbar's progress bar with a native range input laid invisibly over it for touch and keys.
function Scrubber({ player }: { player: Player }) {
  const { positionMs, durationMs, seekTo } = player;
  const [dragMs, setDragMs] = useState<number | null>(null);

  const commit = () => {
    if (dragMs == null) return;
    seekTo(dragMs);
    setDragMs(null);
  };

  const shownMs = dragMs ?? positionMs;
  const pct = durationMs > 0 ? Math.min(100, (shownMs / durationMs) * 100) : 0;

  return (
    <div className="scrubber-block">
      <div className={`scrubber ${dragMs != null ? 'held' : ''}`}>
        <div className="progress-track">
          <div className="progress-fill" style={{ transform: `scaleX(${pct / 100})` }} />
        </div>
        <input
          type="range"
          className="scrubber-input"
          aria-label="Seek"
          min={0}
          max={Math.max(durationMs, 1)}
          step={1000}
          value={Math.round(shownMs)}
          disabled={durationMs <= 0}
          onChange={e => setDragMs(Number(e.target.value))}
          onPointerUp={commit}
          // An interrupted drag (a palm, a system gesture) drops the seek instead of leaving it held.
          onPointerCancel={() => setDragMs(null)}
          onKeyUp={commit}
          onBlur={commit}
        />
      </div>
      <div className="scrubber-times">
        <span>{formatClock(shownMs / 1000)}</span>
        <span>{durationMs > 0 ? formatClock(durationMs / 1000) : ''}</span>
      </div>
    </div>
  );
}

// One dial detent scrubs this far while the player is open.
const SEEK_STEP_MS = 10_000;

// Covers fetched around the top visible row of a list: a screenful and a little either side. Rows are 60px plus
// an 8px gap; group labels make the estimate drift by a row or two, which the margins absorb.
const LIST_ART_BEHIND = 3;
const LIST_ART_AHEAD = 8;
const ROW_PITCH_PX = 68;

// Enough for any playlist someone would scroll with a dial; the browse pages through the phone up to this.
const PLAYLIST_LIMIT = 500;
const ARTIST_TRACK_LIMIT = 30;

// How much of the row above the playing one shows when a list opens on it, hinting there's more above.
const ANCHOR_PEEK_PX = 28;

// The line being sung, with the next one waiting under it. Only for timed lyrics; the sheet leaves it out otherwise.
function LyricsBand({ lines, positionMs }: { lines: LyricLine[]; positionMs: number }) {
  const at = lyricIndex(lines, positionMs);
  const current = at >= 0 ? lines[at].text : '';
  const next = lines[at + 1]?.text ?? '';
  return (
    <div className="lyrics" aria-live="off">
      {/* Keyed by line, so each new line plays its entrance instead of swapping text in place. */}
      <div className="lyrics-current" key={at}>
        {current ? <ScrollText text={current} /> : <MusicIcon size={24} />}
      </div>
      <div className="lyrics-next">{next || '\u00a0'}</div>
    </div>
  );
}

type ListRow = {
  key: string;
  title: string;
  artists: string | null;
  artistUri: string | null;
  artistName: string | null;
  artworkId: string | null;
  playing?: boolean;
  /** Starts a group, shown as a small label above this row. */
  label?: string;
};

// How long a row says "Added to queue" before going back to normal, like the app's own toast.
const ADDED_NOTE_MS = 2000;
// A swipe right past this adds the track to the queue; the row follows the finger up to the cap.
const SWIPE_COMMIT_PX = 72;
const SWIPE_MAX_PX = 150;
// Movement before a touch counts as a swipe (or, mostly vertical, as a scroll).
const SWIPE_SLOP_PX = 10;
// A group label's height plus its gap, kept in view above the playing row when a list opens on it.
const LABEL_PX = 34;

type MenuItem = { label: string; run: (index: number) => void };

/**
 * A full-height track list over the wash, working like Spotify's own track lists. A tap plays the row. A swipe
 * right adds it to the queue, and the row's ⋯ (or holding the dial press, the long-press) opens Add to queue
 * and Go to artist in place. The dial walks the rows and a press plays one; with the menu open it walks the menu.
 * Back closes the menu (via `backRef`, so the sheet's Back doesn't also leave the list). It opens scrolled to
 * `anchor`, the row playing, and the dial starts there.
 */
function TrackList({
  title,
  meta,
  rows,
  anchor,
  note,
  enabled,
  onPick,
  onQueue,
  onArtist,
  backRef,
}: {
  title: string;
  meta: string;
  rows: ListRow[];
  anchor: number | null;
  note: string | null;
  enabled: boolean;
  onPick: (index: number) => void;
  onQueue: (index: number) => void;
  onArtist?: (index: number) => void;
  backRef: { current: (() => boolean) | null };
}) {
  // Held by row key, not position, so a track queued above them doesn't move the dial or an open menu.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [menuAt, setMenuAt] = useState(0);
  const [added, setAdded] = useState<string | null>(null);
  const [swipe, setSwipe] = useState<{ key: string; dx: number } | null>(null);
  const drag = useRef<{ key: string; x0: number; y0: number; active: boolean } | null>(null);
  const swallowClick = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const rowEls = useRef(new Map<string, HTMLElement>());
  const indexOf = (key: string | null) => {
    const i = key == null ? -1 : rows.findIndex(r => r.key === key);
    return i === -1 ? null : i;
  };
  const selected = indexOf(selectedKey);
  const menu = indexOf(menuKey);

  // Covers follow the scroll, which the dial also drives, so touch scrolling fills in art too.
  const [topRow, setTopRow] = useState(anchor ?? 0);
  const from = Math.max(0, topRow - LIST_ART_BEHIND);
  const windowRows = rows.slice(from, topRow + LIST_ART_AHEAD + 1);
  const art = useArtwork(
    client,
    windowRows.map(r => r.artworkId),
    LIST_ART_BEHIND + LIST_ART_AHEAD + 8,
  );
  const artFor = (i: number) => (i >= from && i < from + art.length ? art[i - from] : null);

  const addToQueue = useCallback(
    (i: number) => {
      onQueue(i);
      setAdded(rows[i].key);
    },
    [onQueue, rows],
  );
  const menuItems = (i: number | null): MenuItem[] => {
    const items: MenuItem[] = [{ label: 'Add to queue', run: addToQueue }];
    if (onArtist && i != null && rows[i]?.artistUri) items.push({ label: 'Go to artist', run: onArtist });
    return items;
  };
  const openMenu = useCallback(
    (i: number) => {
      setSelectedKey(rows[i].key);
      setMenuKey(rows[i].key);
      setMenuAt(0);
    },
    [rows],
  );
  const runMenu = (i: number, at: number) => {
    setMenuKey(null);
    menuItems(i)[at]?.run(i);
  };

  useEffect(() => {
    if (!added) return;
    const id = setTimeout(() => setAdded(null), ADDED_NOTE_MS);
    return () => clearTimeout(id);
  }, [added]);

  useEffect(() => {
    backRef.current = () => {
      if (menu == null) return false;
      setMenuKey(null);
      return true;
    };
    return () => {
      backRef.current = null;
    };
  }, [backRef, menu]);

  // Through a ref, so the wheel listener isn't torn down (and a half-turned detent lost) on every render.
  const step = (dir: 1 | -1) => {
    if (menu != null) {
      setMenuAt(a => Math.min(menuItems(menu).length - 1, Math.max(0, a + dir)));
      return;
    }
    if (rows.length === 0) return;
    const next = Math.min(rows.length - 1, Math.max(0, (selected ?? anchor ?? -1) + dir));
    setSelectedKey(rows[next].key);
  };
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  });
  useRotaryStep(
    useCallback((dir: 1 | -1) => stepRef.current(dir), []),
    enabled,
  );
  useDialPress(
    () => {
      if (menu != null) runMenu(menu, menuAt);
      else if (selected != null) onPick(selected);
    },
    () => {
      const at = selected ?? anchor;
      if (menu == null && at != null) openMenu(at);
    },
    enabled,
  );

  useEffect(() => {
    if (selectedKey == null) return;
    rowEls.current.get(selectedKey)?.scrollIntoView({ block: 'nearest' });
  }, [selectedKey]);

  // Once, when the rows arrive: the playing row near the top, its label and a sliver of what's above in view.
  const anchored = useRef(false);
  const anchorKey = anchor == null ? null : (rows[anchor]?.key ?? null);
  const anchorLabelled = anchor != null && !!rows[anchor]?.label;
  useLayoutEffect(() => {
    const list = listRef.current;
    const row = anchorKey == null ? undefined : rowEls.current.get(anchorKey);
    if (anchored.current || !list || !row) return;
    anchored.current = true;
    list.scrollTop = Math.max(0, row.offsetTop - ANCHOR_PEEK_PX - (anchorLabelled ? LABEL_PX : 0));
  }, [anchorKey, anchorLabelled]);
  const refFor = (key: string) => (el: HTMLElement | null) => {
    if (el) rowEls.current.set(key, el);
    else rowEls.current.delete(key);
  };

  // Swipe right to queue, as in the app: horizontal drags past the slop take over; vertical ones stay scrolls.
  const swipeHandlers = (row: ListRow, i: number) => ({
    onPointerDown: (e: ReactPointerEvent) => {
      drag.current = { key: row.key, x0: e.clientX, y0: e.clientY, active: false };
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      const d = drag.current;
      if (!d || d.key !== row.key) return;
      const dx = e.clientX - d.x0;
      const dy = e.clientY - d.y0;
      if (!d.active) {
        if (Math.abs(dy) > SWIPE_SLOP_PX && Math.abs(dy) > Math.abs(dx)) {
          drag.current = null;
          return;
        }
        if (dx <= SWIPE_SLOP_PX) return;
        d.active = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      setSwipe({ key: row.key, dx: Math.max(0, Math.min(dx, SWIPE_MAX_PX)) });
    },
    onPointerUp: (e: ReactPointerEvent) => {
      const d = drag.current;
      drag.current = null;
      if (!d?.active) return;
      // The release still clicks the row underneath; that click must not also play it.
      swallowClick.current = true;
      setTimeout(() => (swallowClick.current = false), 0);
      setSwipe(null);
      if (e.clientX - d.x0 >= SWIPE_COMMIT_PX) addToQueue(i);
    },
    onPointerCancel: () => {
      drag.current = null;
      setSwipe(null);
    },
  });

  const rowArt = (i: number) => {
    const url = artFor(i);
    return url ? (
      <img className="track-row-art" src={url} alt="" draggable={false} />
    ) : (
      <span className="track-row-art now-playing-art-placeholder">
        <MusicIcon size={20} />
      </span>
    );
  };
  const rowText = (row: ListRow) => (
    <span className="track-row-text">
      <span className="track-row-title">{row.title}</span>
      {row.artists && <span className="track-row-artists">{row.artists}</span>}
    </span>
  );

  return (
    <div className="track-list-view">
      <div className="track-list-head">
        <ScrollText text={title} className="track-list-title" />
        <span className="track-list-meta">{meta}</span>
      </div>
      {note ? (
        <div className="lyrics-note track-list-note">{note}</div>
      ) : (
        <div
          className="track-list"
          ref={listRef}
          role="list"
          onScroll={e => setTopRow(Math.floor(e.currentTarget.scrollTop / ROW_PITCH_PX))}
        >
          {rows.map((row, i) => {
            const dx = swipe?.key === row.key ? swipe.dx : 0;
            return [
              row.label && (
                <div key={`label:${row.key}`} className="track-list-label">
                  {row.label}
                </div>
              ),
              <div key={row.key} ref={refFor(row.key)} role="listitem" className="track-row-wrap">
                {menu === i ? (
                  <div className="track-row track-row-open">
                    {rowArt(i)}
                    {rowText(row)}
                    <span className="track-row-actions">
                      {menuItems(i).map((item, at) => (
                        <button
                          key={item.label}
                          className={`track-action ${at === menuAt ? 'selected' : ''}`}
                          onClick={() => runMenu(i, at)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </span>
                  </div>
                ) : (
                  <>
                    {/* The green box the row slides off of, as in the app's swipe to queue. */}
                    <div
                      className={`track-row-reveal ${dx >= SWIPE_COMMIT_PX ? 'armed' : ''}`}
                      style={{ opacity: Math.min(1, dx / SWIPE_COMMIT_PX) }}
                      aria-hidden="true"
                    >
                      <QueueAddIcon size={22} />
                      Add to queue
                    </div>
                    <div
                      className={`track-row ${selected === i ? 'selected' : ''} ${dx ? 'swiping' : ''}`}
                      style={dx ? { transform: `translateX(${dx}px)` } : undefined}
                      {...swipeHandlers(row, i)}
                    >
                      <button
                        className="track-row-play"
                        aria-label={`Play ${row.title}${row.artists ? ` by ${row.artists}` : ''}`}
                        onClick={() => {
                          if (!swallowClick.current) onPick(i);
                        }}
                      >
                        {rowArt(i)}
                        {rowText(row)}
                        {added === row.key ? (
                          <span className="track-row-queued" role="status">
                            <CheckIcon size={18} />
                            Added to queue
                          </span>
                        ) : (
                          row.playing && (
                            <span className="eq eq-playing" role="img" aria-label="Playing">
                              <span />
                              <span />
                              <span />
                            </span>
                          )
                        )}
                      </button>
                      <button
                        className="track-row-more"
                        aria-label={`More for ${row.title}`}
                        onClick={() => openMenu(i)}
                      >
                        <MoreIcon size={22} />
                      </button>
                    </div>
                  </>
                )}
              </div>,
            ];
          })}
        </div>
      )}
    </div>
  );
}

// A row in the queue view: from the playlist itself, or from the queue (`phoneIndex` is its place in the phone's
// queue, null for one added from here that the phone hasn't listed yet).
type QueueEntry = {
  kind: 'playlist' | 'queued';
  uri: string;
  title: string;
  artists: string | null;
  artistUri: string | null;
  artistName: string | null;
  artworkId: string | null;
  phoneIndex: number | null;
};

function fromQueue(q: Player['queue'][number]): QueueEntry {
  return {
    kind: q.queued ? 'queued' : 'playlist',
    uri: q.uri,
    title: q.title,
    artists: q.artist,
    artistUri: q.artistUri,
    artistName: q.artist,
    artworkId: q.artworkId,
    phoneIndex: q.phoneIndex,
  };
}

function fromBrowse(t: BrowsedTrack): QueueEntry {
  return { kind: 'playlist', ...t, phoneIndex: null };
}

// Keyed by uri and which repeat it is, not position, so the dial and an open menu stay put as the queue grows.
function entryRows(entries: QueueEntry[], nowUri: string | null | undefined, labels: Map<number, string>): ListRow[] {
  const repeats = new Map<string, number>();
  return entries.map((e, i) => {
    const n = (repeats.get(`${e.kind}:${e.uri}`) ?? 0) + 1;
    repeats.set(`${e.kind}:${e.uri}`, n);
    return {
      key: `${e.kind}:${e.uri}:${n}`,
      title: e.title,
      artists: e.artists,
      artistUri: e.artistUri,
      artistName: e.artistName,
      artworkId: e.artworkId,
      playing: e.kind === 'playlist' && e.uri === nowUri,
      label: labels.get(i),
    };
  });
}

/**
 * Spotify's queue, laid over the whole playlist: what's been played, then Now playing, Next in queue (tracks
 * added by hand, in the order added) and Next from the playlist. It opens on the track playing. Without a
 * context to browse (or when browsing fails) it shows just the queue.
 */
function QueueView({
  player,
  enabled,
  backRef,
  onArtist,
  onDone,
}: {
  player: Player;
  enabled: boolean;
  backRef: { current: (() => boolean) | null };
  onArtist: (uri: string, name: string) => void;
  onDone: () => void;
}) {
  const { queue, context, contextUri, skipTo, play, addToQueue } = player;
  const nowUri = player.track?.uri;
  const playlist = useBrowseTracks(client, contextUri, PLAYLIST_LIMIT);
  const items = useMemo(() => (playlist.status === 'ready' ? playlist.items : []), [playlist]);
  const full = items.length > 0;
  const anchorAt = full ? items.findIndex(t => t.uri === nowUri) : -1;
  const fromLabel = `Next from: ${context ?? 'the playlist'}`;

  const { entries, labels, anchor } = useMemo(() => {
    const labels = new Map<number, string>();
    const queuedRows = queue.filter(q => q.queued).map(fromQueue);
    if (!full) {
      const rest = queue.filter(q => !q.queued).map(fromQueue);
      if (queuedRows.length > 0) labels.set(0, 'Next in queue');
      if (rest.length > 0) labels.set(queuedRows.length, fromLabel);
      return { entries: [...queuedRows, ...rest], labels, anchor: null };
    }
    // When the track playing isn't in the playlist (one added by hand), the queue leads the list.
    const split = anchorAt + 1;
    const before = items.slice(0, split).map(fromBrowse);
    const after = items.slice(split).map(fromBrowse);
    if (anchorAt >= 0) labels.set(anchorAt, 'Now playing');
    if (queuedRows.length > 0) labels.set(before.length, 'Next in queue');
    if (after.length > 0) labels.set(before.length + queuedRows.length, fromLabel);
    return {
      entries: [...before, ...queuedRows, ...after],
      labels,
      anchor: anchorAt >= 0 ? anchorAt : null,
    };
  }, [full, items, anchorAt, queue, fromLabel]);

  const pick = useCallback(
    (index: number) => {
      const e = entries[index];
      // A queued track the phone has listed is jumped to, as tapping it in the app's queue does; anything else
      // plays within the playlist.
      if (e.kind === 'queued' && e.phoneIndex != null) skipTo(e.phoneIndex);
      else play(e.uri, contextUri);
      onDone();
    },
    [entries, contextUri, play, skipTo, onDone],
  );
  const queueTrack = useCallback(
    (index: number) => {
      const e = entries[index];
      addToQueue({ uri: e.uri, title: e.title, artist: e.artists, artistUri: e.artistUri, artworkId: e.artworkId });
    },
    [addToQueue, entries],
  );
  const goToArtist = useCallback(
    (index: number) => {
      const e = entries[index];
      if (e.artistUri) onArtist(e.artistUri, e.artistName ?? e.artists ?? '');
    },
    [entries, onArtist],
  );

  if (contextUri && playlist.status === 'loading') {
    return (
      <TrackList
        title={context ?? 'Queue'}
        meta=""
        rows={[]}
        anchor={null}
        note={`Loading ${context ?? 'the playlist'} from your phone…`}
        enabled={enabled}
        onPick={pick}
        onQueue={queueTrack}
        backRef={backRef}
      />
    );
  }
  const handCount = queue.filter(q => q.queued).length;
  const queuedMeta = handCount > 0 ? ` · ${handCount} in queue` : '';
  return (
    <TrackList
      title={context ?? 'Queue'}
      meta={
        full
          ? (anchorAt >= 0 ? `${anchorAt + 1} of ${items.length}` : `${items.length} tracks`) + queuedMeta
          : `${queue.length} up next`
      }
      rows={entryRows(entries, nowUri, labels)}
      anchor={anchor}
      note={!full && queue.length === 0 ? 'Nothing queued after this' : null}
      enabled={enabled}
      onPick={pick}
      onQueue={queueTrack}
      onArtist={goToArtist}
      backRef={backRef}
    />
  );
}

function ArtistView({
  player,
  artist,
  enabled,
  backRef,
  onDone,
}: {
  player: Player;
  artist: { uri: string; name: string };
  enabled: boolean;
  backRef: { current: (() => boolean) | null };
  onDone: () => void;
}) {
  const songs = useBrowseTracks(client, artist.uri, ARTIST_TRACK_LIMIT);
  const items = useMemo(() => (songs.status === 'ready' ? songs.items : []), [songs]);
  const { play, addToQueue } = player;
  const pick = useCallback(
    (index: number) => {
      play(items[index].uri, artist.uri);
      onDone();
    },
    [play, items, artist.uri, onDone],
  );
  const queueTrack = useCallback(
    (index: number) => {
      const t = items[index];
      addToQueue({ uri: t.uri, title: t.title, artist: t.artists, artistUri: t.artistUri, artworkId: t.artworkId });
    },
    [addToQueue, items],
  );
  let note: string | null = null;
  if (songs.status === 'loading') note = 'Loading songs from your phone…';
  else if (songs.status === 'error') note = "Couldn't load these songs from your phone";
  else if (items.length === 0) note = `No songs found for ${artist.name}`;
  return (
    <TrackList
      title={artist.name}
      meta="Top tracks"
      rows={entryRows(items.map(fromBrowse), player.track?.uri, new Map())}
      anchor={null}
      note={note}
      enabled={enabled}
      onPick={pick}
      onQueue={queueTrack}
      backRef={backRef}
    />
  );
}

type View = { kind: 'player' } | { kind: 'queue' } | { kind: 'artist'; uri: string; name: string };

/**
 * Full-screen player over Home or Focus Running, laid out like Home: the track reads beside the art, its lyrics
 * follow along under it, and the dock keeps the clock and the day's time. Presets 1-4 are previous, play/pause,
 * next and like everywhere. The dial seeks and dial push toggles; the source line opens the queue and the
 * artist opens their top tracks, where the dial walks the list instead. Back steps out one level.
 */
export function NowPlayingSheet({
  player,
  enabled,
  wallTime,
  todaySeconds,
  focusTimer,
  onDismiss,
}: {
  player: Player;
  enabled: boolean;
  wallTime: string;
  /** Today's logged total, when Jira is set up; the focus timer takes its place while a session runs. */
  todaySeconds?: number;
  /** Remaining (or elapsed) seconds of the focus session running underneath. */
  focusTimer?: { seconds: number; paused: boolean };
  onDismiss: () => void;
}) {
  const { track, playing, liked, context, positionMs, toggle, toggleLike, skip, seekBy } = player;
  const pressedIndex = useKeyFlash(enabled);
  const tint = useArtTint(track?.artUrl ?? null);
  const lyrics = useLyrics(client, track?.uri ?? null);
  const [lyricsOn, toggleLyrics] = useLyricsPreference(client);
  // Untimed lyrics have nothing to follow along with, so they count as none; the toggle only shows with lyrics.
  const lyricLines = lyrics.status === 'synced' ? lyrics.lines : null;
  const showLyrics = lyricLines != null && lyricsOn;
  const [view, setView] = useState<View>({ kind: 'player' });
  const toPlayer = useCallback(() => setView({ kind: 'player' }), []);
  // A list with a row open claims Back first, to close the row instead of the list.
  const listBack = useRef<(() => boolean) | null>(null);
  const onPlayer = view.kind === 'player';

  useKeydown(
    useCallback(
      e => {
        if (e.key === '1') skip(-1);
        else if (e.key === '2') toggle();
        else if (e.key === '3') skip(1);
        else if (e.key === '4') toggleLike();
        else if (e.key === 'Escape') {
          if (onPlayer) onDismiss();
          else if (!listBack.current?.()) toPlayer();
        } else if (onPlayer && (e.key === 'Enter' || e.key === ' ')) toggle();
        else return;
        e.preventDefault();
      },
      [skip, toggle, toggleLike, onPlayer, onDismiss, toPlayer],
    ),
    enabled,
  );
  useRotaryStep(
    useCallback(dir => seekBy(dir * SEEK_STEP_MS), [seekBy]),
    enabled && onPlayer,
  );

  // The phone went away or playback stopped: nothing left to show.
  useEffect(() => {
    if (!track) onDismiss();
  }, [track, onDismiss]);

  const tabs = [
    { label: 'Previous', icon: <SkipBackIcon size={TAB_ICON} />, onClick: () => skip(-1) },
    {
      label: playing ? 'Pause' : 'Play',
      icon: playing ? <PauseIcon size={TAB_ICON} /> : <PlayIcon size={TAB_ICON} />,
      onClick: toggle,
    },
    { label: 'Next', icon: <SkipForwardIcon size={TAB_ICON} />, onClick: () => skip(1) },
  ];
  const source = context ?? track?.album ?? null;
  const artistUri = track?.artistUri ?? null;

  return (
    <div
      className="screen now-playing-screen"
      role="dialog"
      aria-label="Now playing"
      style={tint ? ({ '--art-tint': tint } as CSSProperties) : undefined}
    >
      {/* Same flush tabs as Home and Focus; Like takes Home's green tint while the track is saved. */}
      <div className="preset-hint">
        {tabs.map((tab, i) => (
          <button
            key={i}
            className={`preset-hint-item preset-hint-icon ${pressedIndex === i ? 'pressed' : ''}`}
            aria-label={tab.label}
            onClick={tab.onClick}
          >
            {tab.icon}
          </button>
        ))}
        <button
          className={`preset-hint-item preset-hint-icon ${liked ? 'preset-hint-liked' : ''} ${pressedIndex === 3 ? 'pressed' : ''}`}
          aria-label="Like"
          aria-pressed={liked ?? false}
          disabled={liked == null}
          onClick={toggleLike}
        >
          <HeartIcon size={TAB_ICON} filled={!!liked} />
        </button>
      </div>

      {view.kind === 'queue' && (
        <QueueView
          player={player}
          enabled={enabled}
          backRef={listBack}
          onArtist={(uri, name) => setView({ kind: 'artist', uri, name })}
          onDone={toPlayer}
        />
      )}
      {view.kind === 'artist' && (
        <ArtistView player={player} artist={view} enabled={enabled} backRef={listBack} onDone={toPlayer} />
      )}
      {onPlayer && (
        <div className={`now-playing-body ${showLyrics ? '' : 'now-playing-body-solo'}`}>
          <div className="now-playing-top">
            {track?.artUrl ? (
              <img className="now-playing-art" src={track.artUrl} alt="" draggable={false} />
            ) : (
              <div className="now-playing-art now-playing-art-placeholder">
                <MusicIcon size={72} />
              </div>
            )}
            {/* Runs under the toast corner: toasts pass in ~5s and the dial only covers the tab row above. */}
            <div className="now-playing-track">
              <div className="now-playing-meta">
                <ScrollText text={track?.title ?? 'Nothing playing'} className="now-playing-title" />
                {track?.artist && (
                  <button
                    className="now-playing-link now-playing-artist"
                    disabled={!artistUri}
                    onClick={() => artistUri && setView({ kind: 'artist', uri: artistUri, name: track.artist ?? '' })}
                  >
                    <ScrollText text={track.artist} />
                    {artistUri && <ChevronRightIcon size={20} />}
                  </button>
                )}
                <button className="now-playing-link now-playing-source" onClick={() => setView({ kind: 'queue' })}>
                  {!playing && <span className="now-playing-paused">Paused</span>}
                  {!playing && source && <span aria-hidden="true">·</span>}
                  <ScrollText text={source ?? 'Queue'} />
                  <ChevronRightIcon size={18} />
                </button>
              </div>
              <Scrubber player={player} />
            </div>
          </div>
          {showLyrics && <LyricsBand lines={lyricLines} positionMs={positionMs} />}
        </div>
      )}

      <div className="dock">
        <div className="dock-clock">{wallTime}</div>
        {focusTimer ? (
          <button
            className={`focus-timer-pill ${focusTimer.paused ? 'focus-timer-paused' : ''}`}
            aria-label="Focus timer"
            onClick={onDismiss}
          >
            <BoltIcon size={22} />
            {formatClock(focusTimer.seconds)}
          </button>
        ) : (
          todaySeconds !== undefined && (
            <div className="now-playing-today">
              Today <strong>{formatDuration(todaySeconds)}</strong>
            </div>
          )
        )}
        {onPlayer && lyricLines && (
          <button
            className={`now-playing-lyrics-toggle ${lyricsOn ? 'on' : ''}`}
            aria-pressed={lyricsOn}
            onClick={toggleLyrics}
          >
            <LyricsIcon size={22} />
            Lyrics
          </button>
        )}
        <button className="btn-secondary btn-with-key now-playing-close" onClick={onPlayer ? onDismiss : toPlayer}>
          {onPlayer ? 'Close' : 'Now playing'}
          <span className="key-cap">Back</span>
        </button>
      </div>
    </div>
  );
}
