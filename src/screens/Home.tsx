import { useCallback } from 'react';
import { formatDuration } from '../format';
import { BoltIcon, BusyIcon, CheckIcon } from '../icons';
import { useKeydown } from '../physicalControls';
import type { Status } from '../session';

export function Home({
  status,
  jiraConfigured,
  todaySeconds,
  onSelect,
  onLogNow,
  onOpenHistory,
}: {
  status: Status;
  jiraConfigured: boolean;
  todaySeconds: number;
  onSelect: (status: Status) => void;
  onLogNow: () => void;
  onOpenHistory: () => void;
}) {
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
  );

  return (
    <div className="screen home">
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
      <div className="button-hint">
        <span>① Available</span>
        <span>② Busy</span>
        <span>③ Focus</span>
        {jiraConfigured && <span>④ Log time</span>}
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
