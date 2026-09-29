import { useCallback, useState } from 'react';
import { DurationHintBar } from '../DurationPicker';
import { formatClock } from '../format';
import { NowPlayingChip, NowPlayingSheet } from '../NowPlaying';
import { DURATION_STEPS, useKeydown } from '../physicalControls';
import type { Player } from '../usePlayer';

export function FocusRunning({
  issueKey,
  issueSummary,
  elapsedS,
  totalS,
  paused,
  player,
  onTogglePause,
  onExtend,
  onEnd,
}: {
  issueKey?: string;
  issueSummary?: string;
  elapsedS: number;
  /** Planned duration in seconds, or null for an unlimited/stopwatch session. */
  totalS: number | null;
  paused: boolean;
  player: Player;
  onTogglePause: () => void;
  /** Nudge remaining duration by `deltaMinutes`; no-op when unlimited (no total). */
  onExtend: (deltaMinutes: number) => void;
  onEnd: () => void;
}) {
  const timed = totalS != null;
  const [playerOpen, setPlayerOpen] = useState(false);
  const closePlayer = useCallback(() => setPlayerOpen(false), []);
  const { track, toggle: togglePlayback } = player;

  // Back pauses/resumes, not ends; End Focus still exits. Duration buttons extend/shorten while running.
  useKeydown(
    useCallback(
      e => {
        const stepIndex = ['1', '2', '3', '4'].indexOf(e.key);
        if (stepIndex !== -1) {
          if (!timed) return;
          onExtend(DURATION_STEPS[stepIndex]);
        } else if (e.key === 'Escape') {
          onTogglePause();
        } else if (e.key === 'Enter' || e.key === ' ') {
          // Dial push is otherwise unused here, so it controls music without leaving the timer.
          if (!track) return;
          togglePlayback();
        } else {
          return;
        }
        e.preventDefault();
      },
      [timed, track, onExtend, onTogglePause, togglePlayback],
    ),
    !playerOpen,
  );

  const displayS = totalS != null ? Math.max(0, totalS - elapsedS) : elapsedS;
  const eyebrow = paused ? 'Paused' : totalS != null ? 'Focus session' : 'Tracking time';
  return (
    <div className="screen focus-running">
      {timed && <DurationHintBar unlimited={false} onStep={onExtend} />}
      <div className="focus-running-body">
        <div className="focus-eyebrow">{eyebrow}</div>
        <div className={`clock ${paused ? 'clock-paused' : ''}`}>{formatClock(displayS)}</div>
        {issueKey && (
          <div className="issue-tag">
            {issueKey}
            {issueSummary ? ` — ${issueSummary}` : ''}
          </div>
        )}
        {totalS != null && (
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.min(1, Math.max(0, elapsedS / totalS)) * 100}%` }} />
          </div>
        )}
        <div className="actions">
          <button className="btn-secondary" onClick={onTogglePause}>
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button className="btn-danger" onClick={onEnd}>
            End Focus
          </button>
        </div>
      </div>
      <div className="dock">
        <NowPlayingChip player={player} onOpen={() => setPlayerOpen(true)} />
      </div>
      {playerOpen && <NowPlayingSheet player={player} enabled onDismiss={closePlayer} />}
    </div>
  );
}
