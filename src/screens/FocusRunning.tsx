import { useCallback } from 'react';
import { formatClock } from '../format';
import { useKeydown } from '../physicalControls';

export function FocusRunning({
  issueKey,
  issueSummary,
  elapsedS,
  totalS,
  paused,
  onTogglePause,
  onEnd,
}: {
  issueKey?: string;
  issueSummary?: string;
  elapsedS: number;
  /** Planned duration in seconds, or null for an unlimited/stopwatch session. */
  totalS: number | null;
  paused: boolean;
  onTogglePause: () => void;
  onEnd: () => void;
}) {
  // Back toggles pause/resume rather than ending the session outright —
  // a real interruption is the common case, and losing the countdown
  // entirely (and logging whatever time had accrued) shouldn't be the
  // only option. Ending is still one tap/press away via the End Focus
  // button below, from either state.
  useKeydown(
    useCallback(
      e => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onTogglePause();
        }
      },
      [onTogglePause],
    ),
  );

  const displayS = totalS != null ? Math.max(0, totalS - elapsedS) : elapsedS;
  const eyebrow = paused ? 'Paused' : totalS != null ? 'Focus session' : 'Tracking time';
  return (
    <div className="screen focus-running">
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
  );
}
