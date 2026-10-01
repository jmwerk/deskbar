import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useArtTint } from './artTint';
import { formatClock } from './format';
import { BoltIcon, HeartIcon, MusicIcon, PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from './icons';
import { ScrollText } from './ScrollText';
import { useKeydown, useKeyFlash, useRotaryStep } from './physicalControls';
import type { Player } from './usePlayer';

// One dial detent scrubs this far while the player is open.
const SEEK_STEP_MS = 10_000;

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
      <span className={`eq ${playing ? 'eq-playing' : ''}`} aria-label={playing ? 'playing' : 'paused'}>
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

/**
 * Full-screen player over Home or Focus Running, laid out like Focus Running. Presets 1-4 are previous,
 * play/pause, next and like (labelled in the flush tabs); the dial seeks, dial push toggles, Back closes.
 */
export function NowPlayingSheet({
  player,
  enabled,
  focusTimer,
  onDismiss,
}: {
  player: Player;
  enabled: boolean;
  /** Shown beside Back while a focus session runs underneath: remaining (or elapsed) seconds. */
  focusTimer?: { seconds: number; paused: boolean };
  onDismiss: () => void;
}) {
  const { track, playing, liked, toggle, toggleLike, skip, seekBy } = player;
  const pressedIndex = useKeyFlash(enabled);
  const tint = useArtTint(track?.artUrl ?? null);

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
          <ScrollText text={track?.title ?? 'Nothing playing'} className="now-playing-title" />
          {track?.artist && <ScrollText text={track.artist} className="issue-tag" />}
          {track?.album && <ScrollText text={track.album} className="now-playing-album" />}
        </div>
      </div>

      <Scrubber player={player} />

      <div className="actions">
        {focusTimer && (
          <button
            className={`focus-timer-pill ${focusTimer.paused ? 'focus-timer-paused' : ''}`}
            aria-label="Focus timer"
            onClick={onDismiss}
          >
            <BoltIcon size={22} />
            {formatClock(focusTimer.seconds)}
          </button>
        )}
        <button className="btn-secondary" onClick={onDismiss}>
          Back
        </button>
      </div>
    </div>
  );
}
