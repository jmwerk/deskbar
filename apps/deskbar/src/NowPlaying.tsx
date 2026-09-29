import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { formatClock } from './format';
import { HeartIcon, MusicIcon, PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from './icons';
import { Marquee } from './Marquee';
import { useKeydown, useKeyFlash, useRotaryStep } from './physicalControls';
import type { Player } from './usePlayer';

// One dial detent scrubs this far while the player is open.
const SEEK_STEP_MS = 10_000;

// A released scrub keeps its position this long while the daemon catches up with the seek.
const SCRUB_HOLD_MS = 500;

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
        <Marquee text={track.title} className="now-playing-chip-title" />
        {track.artist && <Marquee text={track.artist} className="now-playing-chip-artist" />}
      </span>
      <span className={`eq ${playing ? 'eq-playing' : ''}`} aria-label={playing ? 'playing' : 'paused'}>
        <span />
        <span />
        <span />
      </span>
    </button>
  );
}

// Deskbar's progress bar, made draggable: the fill tracks the finger 1:1 while held.
function Scrubber({ player }: { player: Player }) {
  const bar = useRef<HTMLDivElement>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [scrub, setScrub] = useState<{ pct: number; held: boolean } | null>(null);

  const { positionMs, durationMs, seekTo } = player;
  const held = scrub?.held ?? false;
  const live = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;
  const pct = scrub ? scrub.pct : live;
  const elapsedMs = durationMs > 0 ? pct * durationMs : positionMs;

  useEffect(() => () => clearTimeout(hold.current), []);

  const at = useCallback((clientX: number) => {
    const el = bar.current;
    if (!el) return 0;
    const { left, width } = el.getBoundingClientRect();
    return width > 0 ? Math.min(1, Math.max(0, (clientX - left) / width)) : 0;
  }, []);

  const grab = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (durationMs <= 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    clearTimeout(hold.current);
    setScrub({ pct: at(e.clientX), held: true });
  };

  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (held) setScrub({ pct: at(e.clientX), held: true });
  };

  const release = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!held) return;
    const p = at(e.clientX);
    seekTo(p * durationMs);
    setScrub({ pct: p, held: false });
    hold.current = setTimeout(() => setScrub(null), SCRUB_HOLD_MS);
  };

  return (
    <div className="scrubber-block">
      <div
        ref={bar}
        className={`scrubber ${held ? 'held' : ''}`}
        onPointerDown={grab}
        onPointerMove={move}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct * 100}%` }} />
        </div>
      </div>
      <div className="scrubber-times">
        <span>{formatClock(elapsedMs / 1000)}</span>
        <span>{durationMs > 0 ? formatClock(durationMs / 1000) : ''}</span>
      </div>
    </div>
  );
}

/**
 * Full-screen player over Home, laid out like Focus Running. Presets 1-4 are previous,
 * play/pause, next and like (labelled in the flush tabs); the dial seeks, dial push toggles, Back closes.
 */
export function NowPlayingSheet({
  player,
  enabled,
  onDismiss,
}: {
  player: Player;
  enabled: boolean;
  onDismiss: () => void;
}) {
  const { track, playing, liked, toggle, toggleLike, skip, seekBy } = player;
  const pressedIndex = useKeyFlash(enabled);

  useKeydown(
    useCallback(
      e => {
        if (e.key === '1') skip(-1);
        else if (e.key === '2' || e.key === 'Enter' || e.key === ' ') toggle();
        else if (e.key === '3') skip(1);
        else if (e.key === '4') toggleLike();
        else if (e.key === 'Escape') onDismiss();
        else return;
        e.preventDefault();
      },
      [skip, toggle, toggleLike, onDismiss],
    ),
    enabled,
  );
  useRotaryStep(
    useCallback(dir => seekBy(dir * SEEK_STEP_MS), [seekBy]),
    enabled,
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

  return (
    <div className="screen now-playing-screen" role="dialog" aria-label="Now playing">
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

      <div className="now-playing-body">
        {track?.artUrl ? (
          <img className="now-playing-art" src={track.artUrl} alt="" draggable={false} />
        ) : (
          <div className="now-playing-art now-playing-art-placeholder">
            <MusicIcon size={64} />
          </div>
        )}
        <div className="now-playing-meta">
          <div className="focus-eyebrow">{playing ? 'Now playing' : 'Paused'}</div>
          <Marquee text={track?.title ?? 'Nothing playing'} className="now-playing-title" />
          {track?.artist && <Marquee text={track.artist} className="issue-tag" />}
          {track?.album && <Marquee text={track.album} className="now-playing-album" />}
        </div>
      </div>

      <Scrubber player={player} />

      <div className="actions">
        <button className="btn-secondary" onClick={onDismiss}>
          Back
        </button>
      </div>
    </div>
  );
}
