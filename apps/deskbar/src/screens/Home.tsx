import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDuration, formatWallClock } from '../format';
import type { HistoryEntry } from '../history';
import { NowPlayingChip, NowPlayingSheet } from '../NowPlaying';
import { HOME_IDLE_TIMEOUT_MS, useIdle, useKeydown, useKeyFlash } from '../physicalControls';
import { Receipt } from '../Receipt';
import { TodayLedger } from '../TodayLedger';
import type { Status } from '../session';
import { useCountUp } from '../useCountUp';
import type { Player } from '../usePlayer';

const STATUS_TABS: { status: Status; label: string }[] = [
  { status: 'available', label: 'Available' },
  { status: 'busy', label: 'Busy' },
  { status: 'focus', label: 'Focus' },
];

export function Home({
  status,
  jiraConfigured,
  todaySeconds,
  todayLog,
  now,
  timezone,
  player,
  onSelect,
  onLogNow,
  onDeleteEntry,
  receipt,
  onUndoReceipt,
  onDismissReceipt,
}: {
  status: Status;
  jiraConfigured: boolean;
  todaySeconds: number;
  /** Today's worklogs, newest first. */
  todayLog: HistoryEntry[];
  now: number;
  timezone?: string;
  player: Player;
  onSelect: (status: Status) => void;
  onLogNow: () => void;
  onDeleteEntry: (entry: HistoryEntry) => Promise<void>;
  /** The worklog just posted, while it can still be undone. */
  receipt: HistoryEntry | null;
  onUndoReceipt: (entry: HistoryEntry) => Promise<void>;
  onDismissReceipt: () => void;
}) {
  // Dims to a clock when idle; presets disable so the wake key can't also fire its action.
  const [idle, sleepNow] = useIdle(HOME_IDLE_TIMEOUT_MS);
  const [playerOpen, setPlayerOpen] = useState(false);
  const closePlayer = useCallback(() => setPlayerOpen(false), []);
  const presetsLive = !idle && !playerOpen;
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const pressedIndex = useKeyFlash(presetsLive);
  const clock = formatWallClock(now, timezone);
  const shownTodaySeconds = useCountUp(todaySeconds);
  // Newest first, so the first entry is the last time anything was logged today.
  const lastLoggedAt = todayLog[0]?.loggedAt;

  // The total glows briefly when time lands, tying the receipt to the running total.
  const [bumped, setBumped] = useState(false);
  const lastTodayRef = useRef(todaySeconds);
  useEffect(() => {
    const rose = todaySeconds > lastTodayRef.current;
    lastTodayRef.current = todaySeconds;
    if (rose) setBumped(true);
  }, [todaySeconds]);
  // Its own effect, so a drop right after a rise (an undo) can't cancel the fade back.
  useEffect(() => {
    if (!bumped) return;
    const id = setTimeout(() => setBumped(false), 1400);
    return () => clearTimeout(id);
  }, [bumped]);

  useKeydown(
    useCallback(
      e => {
        // Presets 1-3 are the status tabs; preset 4 opens Log Time Now (needs Jira).
        if (e.key === '1') onSelect('available');
        else if (e.key === '2') onSelect('busy');
        else if (e.key === '3') onSelect('focus');
        else if (e.key === '4' && jiraConfigured) onLogNow();
        else return;
        e.preventDefault();
      },
      [onSelect, onLogNow, jiraConfigured],
    ),
    presetsLive,
  );

  return (
    <div className="screen home">
      {idle && (
        <div className="screensaver">
          <div className="screensaver-clock">{clock}</div>
          {player.track && player.playing && (
            <div className="screensaver-track">
              {player.track.title}
              {player.track.artist && ` · ${player.track.artist}`}
            </div>
          )}
        </div>
      )}
      {/* Negative margins flush this to the screen's edge, aligning with the preset buttons above. */}
      <div className="button-hint">
        {STATUS_TABS.map((tab, i) => (
          <button
            key={tab.status}
            className={`button-hint-item status-tab status-tab-${tab.status} ${status === tab.status ? 'lit' : ''} ${pressedIndex === i ? 'pressed' : ''}`}
            aria-pressed={status === tab.status}
            onClick={() => onSelect(tab.status)}
          >
            <span className="button-hint-label">{tab.label}</span>
          </button>
        ))}
        <button
          className={`button-hint-item status-tab ${pressedIndex === 3 ? 'pressed' : ''}`}
          disabled={!jiraConfigured}
          onClick={onLogNow}
        >
          {jiraConfigured && <span className="button-hint-label">Log time</span>}
        </button>
      </div>

      {jiraConfigured ? (
        <>
          {/* Kept on the left: the top-right is under the dial and bridgething's toasts. */}
          <div className={`today-total ${bumped ? 'today-total-bumped' : ''}`}>
            <span className="today-total-value">{formatDuration(shownTodaySeconds)}</span>
            <span className="today-total-meta">
              <span className="today-total-label">logged today</span>
              {lastLoggedAt !== undefined && (
                <span className="unlogged">
                  unlogged since <strong>{formatWallClock(lastLoggedAt, timezone)}</strong>
                </span>
              )}
            </span>
          </div>
          <div className="ledger">
            <TodayLedger
              entries={todayLog}
              enabled={presetsLive}
              confirmingId={confirmingId}
              onConfirmingChange={setConfirmingId}
              onDelete={onDeleteEntry}
            />
          </div>
        </>
      ) : (
        <div className="ledger ledger-setup">
          <div className="hint">
            Set your Jira site, email and API token from the Deskbar settings on your phone to enable time tracking.
          </div>
        </div>
      )}

      {/* Ambient info lives along the bottom: the top-right is under the dial and the toast overlay. */}
      <div className="dock">
        <button className="dock-clock" aria-label="Show clock" onClick={sleepNow}>
          {clock}
        </button>
        <NowPlayingChip player={player} onOpen={() => setPlayerOpen(true)} />
      </div>
      {receipt && !idle && (
        <Receipt
          key={receipt.id}
          entry={receipt}
          todaySeconds={todaySeconds}
          backUndoes={presetsLive && !confirmingId}
          onUndo={onUndoReceipt}
          onDismiss={onDismissReceipt}
        />
      )}
      {playerOpen && <NowPlayingSheet player={player} enabled={!idle} onDismiss={closePlayer} />}
    </div>
  );
}
