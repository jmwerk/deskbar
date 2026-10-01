import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDuration } from './format';
import type { HistoryEntry } from './history';
import { JiraError } from './jira';
import { useKeydown, useRotaryStep } from './physicalControls';

/**
 * Today's worklogs on Home, newest first, each deletable in place. The dial walks the rows, a press
 * asks to delete the pointed-at one, a second press deletes it, and Back cancels.
 */
export function TodayLedger({
  entries,
  enabled,
  confirmingId,
  onConfirmingChange,
  onDelete,
}: {
  entries: HistoryEntry[];
  /** False while something else on screen owns the dial and its press (the player, the screensaver). */
  enabled: boolean;
  /** Lifted so Home can tell Back cancels this confirm rather than undoing the receipt. */
  confirmingId: string | null;
  onConfirmingChange: (id: string | null) => void;
  onDelete: (entry: HistoryEntry) => Promise<void>;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The row the dial points at; null until the first turn, so nothing looks selected by default.
  const [dialId, setDialId] = useState<string | null>(null);

  const confirmDelete = useCallback(
    async (entry: HistoryEntry) => {
      setPendingId(entry.id);
      setError(null);
      try {
        await onDelete(entry);
        onConfirmingChange(null);
      } catch (err) {
        setError(`Couldn't delete it from Jira: ${err instanceof JiraError ? err.message : 'unknown error'}`);
      } finally {
        setPendingId(null);
      }
    },
    [onDelete, onConfirmingChange],
  );

  // The dial walks the rows only while no delete is being confirmed, so it can't retarget one.
  useRotaryStep(
    useCallback(
      dir => {
        const index = entries.findIndex(e => e.id === dialId);
        const next = index === -1 ? 0 : Math.min(entries.length - 1, Math.max(0, index + dir));
        setDialId(entries[next].id);
      },
      [entries, dialId],
    ),
    enabled && entries.length > 0 && !confirmingId,
  );

  useKeydown(
    useCallback(
      e => {
        if (e.key === 'Escape') {
          if (!confirmingId) return;
          onConfirmingChange(null);
        } else if (e.key === 'Enter' || e.key === ' ') {
          const entry = entries.find(t => t.id === (confirmingId ?? dialId));
          if (!entry || pendingId) return;
          if (confirmingId) void confirmDelete(entry);
          else onConfirmingChange(entry.id);
        } else {
          return;
        }
        e.preventDefault();
      },
      [confirmingId, dialId, entries, pendingId, confirmDelete, onConfirmingChange],
    ),
    enabled,
  );

  const dialRowRef = useRef<HTMLElement>(null);
  useEffect(() => {
    dialRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [dialId, confirmingId]);

  if (entries.length === 0) {
    return <div className="ledger-empty">Nothing logged yet today. Press 4 to log time or 3 to focus.</div>;
  }

  return (
    <>
      {error && <div className="hint error">{error}</div>}
      <div className="ledger-list">
        {entries.map(entry =>
          confirmingId === entry.id ? (
            <div
              className="history-row history-row-confirm"
              key={entry.id}
              ref={entry.id === dialId || entry.id === confirmingId ? el => void (dialRowRef.current = el) : undefined}
            >
              <span className="history-confirm-label">Delete{entry.worklogId ? ' from Jira' : ''}?</span>
              <div className="history-confirm-actions">
                <button
                  className="history-confirm-cancel"
                  disabled={pendingId === entry.id}
                  onClick={() => onConfirmingChange(null)}
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
            // "x" hint sits at the left, not right; top-right is unpressable under the dial.
            <button
              className={`history-row ${entry.id === dialId ? 'selected' : ''}`}
              key={entry.id}
              ref={entry.id === dialId ? el => void (dialRowRef.current = el) : undefined}
              aria-label={`Delete logged time for ${entry.issueKey}`}
              onClick={() => onConfirmingChange(entry.id)}
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
    </>
  );
}
