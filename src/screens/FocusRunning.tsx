import { useCallback } from 'react';
import { DurationHintBar } from '../DurationPicker';
import { formatClock } from '../format';
import { DURATION_STEPS, useKeydown } from '../physicalControls';

export function FocusRunning({
  issueKey,
  issueSummary,
  elapsedS,
  totalS,
  paused,
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
  onTogglePause: () => void;
  /** Nudge the remaining duration by `deltaMinutes`. No-op for an unlimited session (no total to extend). */
  onExtend: (deltaMinutes: number) => void;
  onEnd: () => void;
}) {
  const timed = totalS != null;

  // Back toggles pause/resume rather than ending the session outright —
  // a real interruption is the common case, and losing the countdown
  // entirely (and logging whatever time had accrued) shouldn't be the
  // only option. Ending is still one tap/press away via the End Focus
  // button below, from either state. The same 4 buttons that pick a
  // duration on the setup screen extend/shorten it here instead, while
  // running — they'd otherwise sit unused for the whole session.
  useKeydown(
    useCallback(
      e => {
        const stepIndex = ['1', '2', '3', '4'].indexOf(e.key);
        if (stepIndex !== -1) {
          if (!timed) return;
          onExtend(DURATION_STEPS[stepIndex]);
        } else if (e.key === 'Escape') {
          onTogglePause();
        } else {
          return;
        }
        e.preventDefault();
      },
      [timed, onExtend, onTogglePause],
    ),
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
            <div
              className="progress-fill"
              style={{ width: `${Math.min(1, Math.max(0, elapsedS / totalS)) * 100}%` }}
            />
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
    </div>
  );
}
