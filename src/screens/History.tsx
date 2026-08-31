import { useCallback, useMemo, useState } from 'react';
import { formatDuration } from '../format';
import { todayEntries, totalSeconds, type HistoryEntry } from '../history';
import { JiraError } from '../jira';
import { useKeydown } from '../physicalControls';

export function History({
  entries,
  onBack,
  onDelete,
}: {
  entries: HistoryEntry[];
  onBack: () => void;
  onDelete: (entry: HistoryEntry) => Promise<void>;
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useKeydown(
    useCallback(
      e => {
        if (e.key === 'Escape') {
          e.preventDefault();
          if (confirmingId) setConfirmingId(null);
          else onBack();
        }
      },
      [onBack, confirmingId],
    ),
  );

  const today = useMemo(() => todayEntries(entries), [entries]);
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
              <div className="history-row history-row-confirm" key={entry.id}>
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
              // The whole row is the tap target (not a small icon at its
              // edge), AND the visual "x" hint itself sits at the row's
              // LEFT end, not the right. On the 800x480 display the
              // top-right corner sits under the physical dial, which can
              // make that exact spot genuinely unpressable — putting the
              // affordance there would keep inviting a tap right where the
              // dial is, even with the bigger hit area. Duration is plain
              // text, not interactive, so it's fine to sit on the right.
              // See the "Physical controls" note in the README.
              <button
                className="history-row"
                key={entry.id}
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
