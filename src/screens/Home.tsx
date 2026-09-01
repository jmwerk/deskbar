import { useCallback, useEffect, useState } from 'react';
import { formatDuration, formatWallClock } from '../format';
import { BoltIcon, BusyIcon, CheckIcon } from '../icons';
import { HOME_IDLE_TIMEOUT_MS, useIdle, useKeydown, useKeyFlash } from '../physicalControls';
import type { Status } from '../session';

export function Home({
  status,
  jiraConfigured,
  todaySeconds,
  timezone,
  onSelect,
  onLogNow,
  onOpenHistory,
}: {
  status: Status;
  jiraConfigured: boolean;
  todaySeconds: number;
  timezone?: string;
  onSelect: (status: Status) => void;
  onLogNow: () => void;
  onOpenHistory: () => void;
}) {
  // A stationary desk display shouldn't just sit on the status tiles
  // forever — after a few idle minutes, dim to a plain clock instead.
  // Any key/wheel/touch wakes it; while idle, presets are disabled below
  // so the very key that wakes it doesn't also act on whatever it's bound
  // to (useIdle's own activity listener already "consumes" that first
  // event, so the preset handler simply never sees it).
  const idle = useIdle(HOME_IDLE_TIMEOUT_MS);
  const pressedIndex = useKeyFlash(!idle);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!idle) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [idle]);

  useKeydown(
    useCallback(
      e => {
        // Presets 1-3 mirror the three tiles below; preset 4 opens Log Time
        // Now (only meaningful once Jira is configured).
        if (e.key === '1') onSelect('available');
        else if (e.key === '2') onSelect('busy');
        else if (e.key === '3') onSelect('focus');
        else if (e.key === '4' && jiraConfigured) onLogNow();
        else return;
        e.preventDefault();
      },
      [onSelect, onLogNow, jiraConfigured],
    ),
    !idle,
  );

  return (
    <div className="screen home">
      {idle && (
        <div className="screensaver">
          <div className="screensaver-clock">{formatWallClock(now, timezone)}</div>
        </div>
      )}
      {/* Flush with the screen's true top/left/right edges (negative
          margins cancel .screen's padding for this element only) — lines
          up with the physical preset buttons directly above it on the
          device. Square top corners read as a continuation of the button
          itself rather than a floating badge; each tab is tinted to match
          the tile it controls, so the color runs button -> tab -> tile. */}
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
      {jiraConfigured && (
        <button className="today-bar" onClick={onOpenHistory}>
          Today: {formatDuration(todaySeconds)} logged
        </button>
      )}
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
