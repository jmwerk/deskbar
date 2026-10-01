import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDuration, formatWallClock } from '../format';
import type { HistoryEntry } from '../history';
import { BoltIcon, BusyIcon, CheckIcon } from '../icons';
import { NowPlayingChip, NowPlayingSheet } from '../NowPlaying';
import { HOME_IDLE_TIMEOUT_MS, useIdle, useKeydown, useKeyFlash } from '../physicalControls';
import { Receipt } from '../Receipt';
import type { Status } from '../session';
import { useCountUp } from '../useCountUp';
import type { Player } from '../usePlayer';

export function Home({
  status,
  jiraConfigured,
  todaySeconds,
  now,
  timezone,
  player,
  onSelect,
  onLogNow,
  onOpenHistory,
  receipt,
  onUndoReceipt,
  onDismissReceipt,
}: {
  status: Status;
  jiraConfigured: boolean;
  todaySeconds: number;
  now: number;
  timezone?: string;
  player: Player;
  onSelect: (status: Status) => void;
  onLogNow: () => void;
  onOpenHistory: () => void;
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
  const pressedIndex = useKeyFlash(presetsLive);
  const clock = formatWallClock(now, timezone);
  const shownTodaySeconds = useCountUp(todaySeconds);

  // The Today pill glows briefly when time lands, tying the receipt to the running total.
  const [bumped, setBumped] = useState(false);
  const lastTodayRef = useRef(todaySeconds);
  useEffect(() => {
    const rose = todaySeconds > lastTodayRef.current;
    lastTodayRef.current = todaySeconds;
    if (!rose) return;
    setBumped(true);
    const id = setTimeout(() => setBumped(false), 1400);
    return () => clearTimeout(id);
  }, [todaySeconds]);

  useKeydown(
    useCallback(
      e => {
        // Presets 1-3 mirror the three tiles below; preset 4 opens Log Time Now (needs Jira).
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
        <div className={`button-hint-item button-hint-available ${pressedIndex === 0 ? 'pressed' : ''}`}>
          <span className="button-hint-label">Available</span>
        </div>
        <div className={`button-hint-item button-hint-busy ${pressedIndex === 1 ? 'pressed' : ''}`}>
          <span className="button-hint-label">Busy</span>
        </div>
        <div className={`button-hint-item button-hint-focus ${pressedIndex === 2 ? 'pressed' : ''}`}>
          <span className="button-hint-label">Focus</span>
        </div>
        <div className={`button-hint-item ${pressedIndex === 3 ? 'pressed' : ''}`}>
          {jiraConfigured && <span className="button-hint-label">Log time</span>}
        </div>
      </div>
      <div className={`status-banner status-${status}`}>{statusLabel(status)}</div>
      <div className="tiles">
        <button
          className={`tile tile-available ${status === 'available' ? 'selected' : ''}`}
          onClick={() => onSelect('available')}
        >
          {status === 'available' && (
            <span className="tile-badge">
              <CheckIcon size={18} />
            </span>
          )}
          <CheckIcon />
          <span>Available</span>
        </button>
        <button className={`tile tile-busy ${status === 'busy' ? 'selected' : ''}`} onClick={() => onSelect('busy')}>
          {status === 'busy' && (
            <span className="tile-badge">
              <CheckIcon size={18} />
            </span>
          )}
          <BusyIcon />
          <span>Busy</span>
        </button>
        <button className={`tile tile-focus ${status === 'focus' ? 'selected' : ''}`} onClick={() => onSelect('focus')}>
          {status === 'focus' && (
            <span className="tile-badge">
              <CheckIcon size={18} />
            </span>
          )}
          <BoltIcon />
          <span>Focus</span>
        </button>
      </div>
      {!jiraConfigured && (
        <div className="hint">
          Set your Jira site, email and API token from the Deskbar settings on your phone to enable time tracking.
        </div>
      )}
      {/* Ambient info lives along the bottom: the top-right is under the dial and the toast overlay. */}
      <div className="dock">
        <button className="dock-clock" aria-label="Show clock" onClick={sleepNow}>
          {clock}
        </button>
        <NowPlayingChip player={player} onOpen={() => setPlayerOpen(true)} />
        {jiraConfigured && (
          <button className={`today-bar ${bumped ? 'today-bar-bumped' : ''}`} onClick={onOpenHistory}>
            Today: {formatDuration(shownTodaySeconds)}
          </button>
        )}
      </div>
      {receipt && !idle && (
        <Receipt
          key={receipt.id}
          entry={receipt}
          todaySeconds={todaySeconds}
          backUndoes={presetsLive}
          onUndo={onUndoReceipt}
          onDismiss={onDismissReceipt}
        />
      )}
      {playerOpen && <NowPlayingSheet player={player} enabled={!idle} onDismiss={closePlayer} />}
    </div>
  );
}

function statusLabel(status: Status): string {
  switch (status) {
    case 'available':
      return 'Available';
    case 'busy':
      return 'Busy';
    case 'focus':
      return 'Focus';
  }
}
