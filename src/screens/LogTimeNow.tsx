import { useCallback, useState } from 'react';
import type { Config } from '../config';
import { DurationPicker } from '../DurationPicker';
import type { NewHistoryEntry } from '../history';
import { IssuePicker } from '../IssuePicker';
import { JiraError, logWork, type JiraIssue } from '../jira';
import { PRESET_MINUTES, useKeydown } from '../physicalControls';

export function LogTimeNow({
  config,
  onCancel,
  onLogged,
}: {
  config: Config;
  onCancel: () => void;
  onLogged: (entry: NewHistoryEntry) => void;
}) {
  const [minutes, setMinutes] = useState(config.defaultFocusMinutes);
  const [selected, setSelected] = useState<JiraIssue | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    if (!config.jira || !selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const seconds = minutes * 60;
      const { worklogId } = await logWork(config.jira, selected.key, seconds, 'Logged via Deskbar');
      onLogged({ issueKey: selected.key, issueSummary: selected.summary, seconds, loggedAt: Date.now(), worklogId });
    } catch (err) {
      setError(err instanceof JiraError ? err.message : 'Could not log time to Jira');
      setBusy(false);
    }
  }, [config, selected, minutes, busy, onLogged]);

  useKeydown(
    useCallback(
      e => {
        const presetIndex = ['1', '2', '3', '4'].indexOf(e.key);
        if (presetIndex !== -1) {
          setMinutes(PRESET_MINUTES[presetIndex]);
        } else if (e.key === 'Escape') {
          onCancel();
        } else if (e.key === 'Enter' || e.key === ' ') {
          void submit();
        } else {
          return;
        }
        e.preventDefault();
      },
      [onCancel, submit],
    ),
  );

  return (
    <div className="screen focus-setup">
      <h1>Log Time</h1>

      <DurationPicker minutes={minutes} onChange={setMinutes} />

      <div className="issue-picker">
        <label>Log time to</label>
        <IssuePicker config={config} selected={selected} onSelect={setSelected} allowNone={false} />
        {error && <div className="hint error">{error}</div>}
      </div>

      <div className="actions">
        <button className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn-primary" disabled={!selected || busy} onClick={() => void submit()}>
          {busy ? 'Logging…' : 'Log Time'}
        </button>
      </div>
    </div>
  );
}
