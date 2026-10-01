import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatDuration } from '../format';
import { todayEntries, totalSeconds, type HistoryEntry } from '../history';
import { JiraError } from '../jira';
import { useKeydown, useRotaryStep } from '../physicalControls';

export function History({
  entries,
  timezone,
  onBack,
  onDelete,
}: {
  entries: HistoryEntry[];
  timezone?: string;
  onBack: () => void;
  onDelete: (entry: HistoryEntry) => Promise<void>;
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The row the dial points at; null until the first turn, so nothing looks selected by default.
  const [dialId, setDialId] = useState<string | null>(null);

  const today = useMemo(() => todayEntries(entries, Date.now(), timezone), [entries, timezone]);
  const total = useMemo(() => totalSeconds(today), [today]);

  const confirmDelete = useCallback(
    async (entry: HistoryEntry) => {
      setPendingId(entry.id);
      setError(null);
      try {
        await onDelete(entry);
        setConfirmingId(null);
      } catch (err) {
        setError(err instanceof JiraError ? err.message : "Couldn't delete this from Jira");
      } finally {
        setPendingId(null);
      }
    },
    [onDelete],
  );

  // The dial walks the rows only while no delete is being confirmed, so it can't retarget one.
  useRotaryStep(
    useCallback(
      dir => {
        const index = today.findIndex(e => e.id === dialId);
        const next = index === -1 ? 0 : Math.min(today.length - 1, Math.max(0, index + dir));
        setDialId(today[next].id);
      },
      [today, dialId],
    ),
    today.length > 0 && !confirmingId,
  );

  // Dial press asks to delete the pointed-at row, then confirms; Back always steps out first.
  useKeydown(
    useCallback(
      e => {
        if (e.key === 'Escape') {
          if (confirmingId) setConfirmingId(null);
          else onBack();
        } else if (e.key === 'Enter' || e.key === ' ') {
          const entry = today.find(t => t.id === (confirmingId ?? dialId));
          if (!entry || pendingId) return;
          if (confirmingId) void confirmDelete(entry);
          else setConfirmingId(entry.id);
        } else {
          return;
        }
        e.preventDefault();
      },
      [onBack, confirmingId, dialId, today, pendingId, confirmDelete],
    ),
  );

  const dialRowRef = useRef<HTMLElement>(null);
  useEffect(() => {
    dialRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [dialId, confirmingId]);

  return (
    <div className="screen focus-setup history-screen">
      <h1>Today</h1>
      <div className="history-total">
        {formatDuration(total)} logged
        {today.length > 0 ? ` across ${today.length} session${today.length === 1 ? '' : 's'}` : ''}
      </div>
      {error && <div className="hint error">{error}</div>}

      {today.length === 0 ? (
        <div className="hint">No time logged yet today.</div>
      ) : (
        <div className="history-list">
          {today.map(entry =>
            confirmingId === entry.id ? (
              <div
                className="history-row history-row-confirm"
                key={entry.id}
                ref={entry.id === dialId ? el => void (dialRowRef.current = el) : undefined}
              >
                <span className="history-confirm-label">Delete{entry.worklogId ? ' from Jira' : ''}?</span>
                <div className="history-confirm-actions">
                  <button
                    className="history-confirm-cancel"
                    disabled={pendingId === entry.id}
                    onClick={() => setConfirmingId(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="history-confirm-delete"
                    disabled={pendingId === entry.id}
                    onClick={() => void confirmDelete(entry)}
                  >
                    {pendingId === entry.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            ) : (
              // "x" hint sits at the left, not right; top-right is unpressable under the dial. See README.
              <button
                className={`history-row ${entry.id === dialId ? 'selected' : ''}`}
                key={entry.id}
                ref={entry.id === dialId ? el => void (dialRowRef.current = el) : undefined}
                aria-label={`Delete logged time for ${entry.issueKey}`}
                onClick={() => setConfirmingId(entry.id)}
              >
                <span className="history-delete-hint" aria-hidden="true">
                  ×
                </span>
                <span className="history-issue">{entry.issueKey}</span>
                <span className="history-summary">{entry.issueSummary}</span>
                <span className="history-duration">{formatDuration(entry.seconds)}</span>
              </button>
            ),
          )}
        </div>
      )}

      <div className="actions">
        <button className="btn-secondary" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}
