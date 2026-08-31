import { useCallback } from 'react';
import { formatClock } from '../format';
import { useKeydown } from '../physicalControls';

export function FocusRunning({
  issueKey,
  issueSummary,
  remainingS,
  totalS,
  onEnd,
}: {
  issueKey?: string;
  issueSummary?: string;
  remainingS: number;
  totalS: number;
  onEnd: () => void;
}) {
  useKeydown(
    useCallback(
      e => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onEnd();
        }
      },
      [onEnd],
    ),
  );

  const progress = Math.min(1, Math.max(0, 1 - remainingS / totalS));
  return (
    <div className="screen focus-running">
      <div className="focus-eyebrow">Focus session</div>
      <div className="clock">{formatClock(remainingS)}</div>
      {issueKey && (
        <div className="issue-tag">
          {issueKey}
          {issueSummary ? ` — ${issueSummary}` : ''}
        </div>
      )}
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
      </div>
      <button className="btn-danger end-btn" onClick={onEnd}>
        End Focus
      </button>
    </div>
  );
}
