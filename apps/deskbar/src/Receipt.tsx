import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { formatDuration } from './format';
import type { HistoryEntry } from './history';
import { CheckIcon } from './icons';
import { useKeydown } from './physicalControls';

/** How long a fresh worklog stays undoable; the drain line under the receipt shows it running out. */
export const RECEIPT_MS = 8000;

/** Proof a worklog reached Jira: what, where, the day's new total, and a short window to undo it. */
export function Receipt({
  entry,
  todaySeconds,
  backUndoes,
  doneStatus,
  onUndo,
  onDone,
  onDismiss,
}: {
  entry: HistoryEntry;
  todaySeconds: number;
  /** False while something else on screen owns Back (the now-playing sheet, the screensaver). */
  backUndoes: boolean;
  /** The status the issue can be moved to from here; no button without one. */
  doneStatus?: string;
  onUndo: (entry: HistoryEntry) => Promise<void>;
  onDone?: (entry: HistoryEntry, status: string) => Promise<void>;
  onDismiss: () => void;
}) {
  const [undoing, setUndoing] = useState(false);
  const [done, setDone] = useState<'idle' | 'moving' | 'moved'>('idle');

  // The window stops running once an undo is in flight, so the receipt can't vanish mid-request.
  useEffect(() => {
    if (undoing) return;
    const id = setTimeout(onDismiss, RECEIPT_MS);
    return () => clearTimeout(id);
  }, [undoing, onDismiss]);

  const moveToDone = useCallback(() => {
    if (!doneStatus || !onDone || done !== 'idle') return;
    setDone('moving');
    onDone(entry, doneStatus).then(
      () => setDone('moved'),
      () => setDone('idle'),
    );
  }, [doneStatus, done, onDone, entry]);

  const undo = useCallback(() => {
    if (undoing) return;
    setUndoing(true);
    void onUndo(entry);
  }, [undoing, onUndo, entry]);

  useKeydown(
    useCallback(
      e => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        undo();
      },
      [undo],
    ),
    backUndoes && !undoing,
  );

  return (
    <div className="receipt" role="status" style={{ '--receipt-ms': `${RECEIPT_MS}ms` } as CSSProperties}>
      <div className="receipt-head">
        <span className="receipt-check" aria-hidden="true">
          <CheckIcon size={18} />
        </span>
        <span className="receipt-amount">{formatDuration(entry.seconds)}</span>
        <span className="receipt-target">logged to {entry.issueKey}</span>
      </div>
      {entry.issueSummary && <div className="receipt-summary">{entry.issueSummary}</div>}
      <div className="receipt-foot">
        <span className="receipt-today">Today {formatDuration(todaySeconds)}</span>
        {doneStatus && (
          <button
            className="receipt-undo receipt-done"
            aria-label={`Move ${entry.issueKey} to ${doneStatus}`}
            disabled={done !== 'idle' || undoing}
            onClick={moveToDone}
          >
            {done === 'moved' ? `${doneStatus} ✓` : done === 'moving' ? 'Moving…' : `→ ${doneStatus}`}
          </button>
        )}
        <button className="receipt-undo" disabled={undoing} onClick={undo}>
          {undoing ? 'Removing…' : 'Undo'}
          {!undoing && backUndoes && <span className="key-cap">Back</span>}
        </button>
      </div>
      <div className={`receipt-drain ${undoing ? 'receipt-drain-held' : ''}`} aria-hidden="true" />
    </div>
  );
}
