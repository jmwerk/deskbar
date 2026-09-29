import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { CrossFade } from './CrossFade';
import { formatClock } from './format';
import { ChevronDownIcon, MusicIcon, PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from './icons';
import { Marquee } from './Marquee';
import { useKeydown, useRotaryStep } from './physicalControls';
import type { Player } from './usePlayer';

// One dial detent scrubs this far while the sheet is open.
const SEEK_STEP_MS = 10_000;

// A released scrub keeps its position this long while the daemon catches up with the seek.
const SCRUB_HOLD_MS = 500;

const FADE_MS = 400;

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

// The bar tracks the finger 1:1; the knob only shows while held, at rest the fill's end is the playhead.
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
    <div>
      <div
        ref={bar}
        className={`scrubber ${held ? 'held' : ''}`}
        onPointerDown={grab}
        onPointerMove={move}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <div className="scrubber-rail" />
        <div className="scrubber-fill" style={{ width: `${pct * 100}%` }} />
        <div className="scrubber-knob" style={{ left: `${pct * 100}%` }} />
      </div>
      <div className="scrubber-times">
        <span>{formatClock(elapsedMs / 1000)}</span>
        <span>{durationMs > 0 ? formatClock(durationMs / 1000) : ''}</span>
      </div>
    </div>
  );
}

/**
 * Full-screen player over Home. Owns the physical controls while open: dial seeks, dial push
 * toggles playback, Back closes. Presets stay inert so a status change can't fire unseen.
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
  const { track, playing, toggle, skip, seekBy } = player;

  useKeydown(
    useCallback(
      e => {
        if (e.key === 'Escape') onDismiss();
        else if (e.key === 'Enter' || e.key === ' ') toggle();
        else return;
        e.preventDefault();
      },
      [onDismiss, toggle],
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

  const artUrl = track?.artUrl ?? null;

  return (
    <div className="now-playing-sheet" role="dialog" aria-label="Now playing">
      <div className="now-playing-backdrop" aria-hidden>
        <CrossFade contentKey={artUrl ?? ''} timeout={FADE_MS}>
          {artUrl && (
            <>
              <img src={artUrl} alt="" className="now-playing-glow now-playing-glow-1" />
              <img src={artUrl} alt="" className="now-playing-glow now-playing-glow-2" />
              <img src={artUrl} alt="" className="now-playing-glow now-playing-glow-3" />
            </>
          )}
        </CrossFade>
      </div>

      <div className="now-playing-body">
        <div className="now-playing-art rise">
          <CrossFade contentKey={artUrl ?? ''} timeout={FADE_MS}>
            {artUrl ? (
              <img src={artUrl} alt="" draggable={false} />
            ) : (
              <span className="now-playing-art-placeholder">
                <MusicIcon size={72} />
              </span>
            )}
          </CrossFade>
        </div>
        <div className="now-playing-meta rise" style={{ animationDelay: '80ms' }}>
          <CrossFade contentKey={`${track?.title}|${track?.album}|${track?.artist}`} timeout={FADE_MS}>
            <div className="now-playing-lines">
              <Marquee text={track?.title ?? 'Nothing playing'} className="now-playing-title" />
              {track?.album && <Marquee text={track.album} className="now-playing-sub" />}
              {track?.artist && <Marquee text={track.artist} className="now-playing-sub" />}
            </div>
          </CrossFade>
        </div>
      </div>

      <div className="rise" style={{ animationDelay: '140ms' }}>
        <Scrubber player={player} />
        {/* Close sits bottom-left: the dial occludes the top-right, where a sheet would usually put it. */}
        <div className="transport">
          <button className="transport-close" onClick={onDismiss} aria-label="Close player">
            <ChevronDownIcon size={26} />
          </button>
          <div className="transport-main">
            <button className="transport-btn" onClick={() => skip(-1)} aria-label="Previous track">
              <SkipBackIcon size={38} />
            </button>
            <button className="transport-btn transport-toggle" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? <PauseIcon size={46} /> : <PlayIcon size={46} />}
            </button>
            <button className="transport-btn" onClick={() => skip(1)} aria-label="Next track">
              <SkipForwardIcon size={38} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
