import { useCallback, useState } from 'react';
import { DurationHintBar } from '../DurationPicker';
import { formatClock, formatDuration, formatWallClock } from '../format';
import { MIN_WORKLOG_S } from '../jira';
import { NowPlayingChip, NowPlayingSheet } from '../NowPlaying';
import { DURATION_STEPS, useKeydown, useModeTap } from '../physicalControls';
import { ScrollText } from '../ScrollText';
import type { Player } from '../usePlayer';

export function FocusRunning({
  issueKey,
  issueSummary,
  elapsedS,
  totalS,
  paused,
  jiraConfigured,
  todaySeconds,
  now,
  timezone,
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
  jiraConfigured: boolean;
  /** Seconds already logged today, before this session. */
  todaySeconds: number;
  now: number;
  timezone?: string;
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

  // A lone m tap ends the session; the daemon's own go-home gestures on m never do.
  const ending = useModeTap(onEnd);

  // Back pauses/resumes, not ends; End still exits. Duration buttons extend/shorten while running.
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

  const displayS = timed ? Math.max(0, totalS - elapsedS) : elapsedS;
  const logsToJira = jiraConfigured && !!issueKey;
  const loggable = logsToJira && elapsedS >= MIN_WORKLOG_S;
  // Today reads as if this session were already logged, so the receipt on Home lands on the same number.
  const meta = [
    paused && 'Paused',
    loggable && timed && `+${formatDuration(elapsedS)} so far`,
    jiraConfigured && `Today ${formatDuration(todaySeconds + (loggable ? elapsedS : 0))}`,
  ].filter(Boolean);

  let endLabel = 'End';
  if (ending) endLabel = 'Ending…';
  else if (loggable) endLabel = `End & log ${formatDuration(elapsedS)}`;
  else if (logsToJira) endLabel = 'End · nothing to log';

  return (
    <div className="screen focus-running">
      {timed && <DurationHintBar unlimited={false} onStep={onExtend} />}
      <div className="focus-running-body">
        {issueKey ? (
          <ScrollText issueKey={issueKey} text={issueSummary ?? ''} className="focus-headline" />
        ) : (
          <div className="focus-headline focus-headline-none">No issue — just a timer</div>
        )}
        <div className={`clock ${paused ? 'clock-paused' : ''}`}>{formatClock(displayS)}</div>
        <div className="focus-meta">
          {meta.map((line, i) => (
            <span key={i} className={line === 'Paused' ? 'focus-meta-paused' : undefined}>
              {line}
            </span>
          ))}
        </div>
        {timed && (
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ transform: `scaleX(${Math.min(1, Math.max(0, elapsedS / totalS))})` }}
            />
          </div>
        )}
        <div className="actions">
          <button className="btn-secondary btn-with-key" onClick={onTogglePause}>
            {paused ? 'Resume' : 'Pause'}
            <span className="key-cap">Back</span>
          </button>
          <button className={`btn-danger btn-with-key ${ending ? 'btn-ending' : ''}`} onClick={onEnd}>
            {endLabel}
            <span className="key-cap">M</span>
          </button>
        </div>
      </div>
      <div className="dock">
        <div className="dock-clock">{formatWallClock(now, timezone)}</div>
        <NowPlayingChip player={player} onOpen={() => setPlayerOpen(true)} />
      </div>
      {playerOpen && (
        <NowPlayingSheet player={player} enabled focusTimer={{ seconds: displayS, paused }} onDismiss={closePlayer} />
      )}
    </div>
  );
}
