import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDuration, formatWallClock, type WallClock } from '../format';
import type { HistoryEntry } from '../history';
import { NowPlayingChip, NowPlayingSheet } from '../NowPlaying';
import { IdleClock } from '../IdleClock';
import { HOME_IDLE_TIMEOUT_MS, useIdle, useKeydown, useKeyFlash } from '../physicalControls';
import { Receipt } from '../Receipt';
import { TodayLedger } from '../TodayLedger';
import { TuneFocus } from '../TuneFocus';
import type { Status } from '../session';
import { syncLabel, type SyncState } from '../timesheet';
import { RefreshIcon } from '../icons';
import { PullFrame } from '../PullToRefresh';
import { usePullToRefresh } from '../usePullToRefresh';
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
  clock,
  player,
  onSelect,
  onLogNow,
  onTuneFocus,
  defaultFocusMinutes,
  onDeleteEntry,
  receipt,
  onUndoReceipt,
  onDoneReceipt,
  onDismissReceipt,
  doneStatus,
  onWake,
  sync,
  onRefresh,
}: {
  status: Status;
  jiraConfigured: boolean;
  todaySeconds: number;
  /** Today's worklogs, newest first. */
  todayLog: HistoryEntry[];
  now: number;
  clock: WallClock;
  player: Player;
  onSelect: (status: Status) => void;
  onLogNow: () => void;
  /** Opens Focus Setup at the minutes tuned on the empty ledger. */
  onTuneFocus: (minutes: number) => void;
  defaultFocusMinutes: number;
  onDeleteEntry: (entry: HistoryEntry) => Promise<void>;
  /** The worklog just posted, while it can still be undone. */
  receipt: HistoryEntry | null;
  onUndoReceipt: (entry: HistoryEntry) => Promise<void>;
  onDoneReceipt: (entry: HistoryEntry, status: string) => Promise<void>;
  onDismissReceipt: () => void;
  doneStatus?: string;
  /** The screen woke from the idle clock. */
  onWake: () => void;
  sync: SyncState;
  /** Syncs the ledger with the tracker now. */
  onRefresh: () => Promise<void>;
}) {
  // Dims to a clock when idle; presets disable so the wake key can't also fire its action.
  const [idle, sleepNow] = useIdle(HOME_IDLE_TIMEOUT_MS);
  const wasIdleRef = useRef(idle);
  useEffect(() => {
    if (wasIdleRef.current && !idle) onWake();
    wasIdleRef.current = idle;
  }, [idle, onWake]);
  const [playerOpen, setPlayerOpen] = useState(false);
  const closePlayer = useCallback(() => setPlayerOpen(false), []);
  const presetsLive = !idle && !playerOpen;
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const pressedIndex = useKeyFlash(presetsLive);
  const wallTime = formatWallClock(now, clock.timeZone, clock.hour12);
  const shownTodaySeconds = useCountUp(todaySeconds);

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

  // Not while a delete confirm is open: a pull there would read as fumbling the confirm.
  const { ref: pullRef, pull, phase } = usePullToRefresh(onRefresh, '.ledger-list', presetsLive && !confirmingId);

  return (
    <div className="screen home">
      {idle && (
        <div className="screensaver">
          <IdleClock now={now} clock={clock} />
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
              <button
                className={`sync-line ${sync.status === 'error' ? 'sync-line-error' : ''}`}
                disabled={sync.status === 'syncing'}
                onClick={() => void onRefresh()}
              >
                <span
                  className={`sync-icon ${sync.status === 'syncing' ? 'sync-icon-spinning' : ''}`}
                  aria-hidden="true"
                >
                  <RefreshIcon size={16} />
                </span>
                {syncLabel(sync, now, clock.timeZone, clock.hour12)}
              </button>
            </span>
          </div>
          <div className="ledger pull-area" ref={pullRef}>
            <PullFrame pull={pull} phase={phase}>
              {todayLog.length === 0 ? (
                <TuneFocus defaultMinutes={defaultFocusMinutes} enabled={presetsLive} onTune={onTuneFocus} />
              ) : (
                <TodayLedger
                  entries={todayLog}
                  enabled={presetsLive}
                  confirmingId={confirmingId}
                  onConfirmingChange={setConfirmingId}
                  onDelete={onDeleteEntry}
                />
              )}
            </PullFrame>
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
          {wallTime}
        </button>
        <NowPlayingChip player={player} onOpen={() => setPlayerOpen(true)} />
      </div>
      {receipt && !idle && (
        <Receipt
          key={receipt.id}
          entry={receipt}
          todaySeconds={todaySeconds}
          backUndoes={presetsLive && !confirmingId}
          doneStatus={doneStatus}
          onUndo={onUndoReceipt}
          onDone={onDoneReceipt}
          onDismiss={onDismissReceipt}
        />
      )}
      {playerOpen && (
        <NowPlayingSheet
          player={player}
          enabled={!idle}
          wallTime={wallTime}
          todaySeconds={jiraConfigured ? todaySeconds : undefined}
          onDismiss={closePlayer}
        />
      )}
    </div>
  );
}
