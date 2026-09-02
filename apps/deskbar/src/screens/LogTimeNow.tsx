import { useCallback, useState } from 'react';
import type { Config } from '../config';
import { DurationHintBar, DurationRow } from '../DurationPicker';
import type { NewHistoryEntry } from '../history';
import { IssuePicker } from '../IssuePicker';
import { JiraError, logWork, type JiraIssue } from '../jira';
import { clampMinutes, DURATION_STEPS, useKeydown, useRotaryStep } from '../physicalControls';

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
  // Shared dial routes to whichever section was last touched; defaults to issue list.
  const [dialTarget, setDialTarget] = useState<'duration' | 'issue'>('issue');

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
        const stepIndex = ['1', '2', '3', '4'].indexOf(e.key);
        if (stepIndex !== -1) {
          setMinutes(m => clampMinutes(m + DURATION_STEPS[stepIndex]));
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

  // Fine-grained ±1 min per dial detent, on top of the coarser buttons above it.
  useRotaryStep(
    useCallback(dir => setMinutes(m => clampMinutes(m + dir)), []),
    dialTarget === 'duration',
  );

  return (
    <div
      className="screen focus-setup"
      onPointerDown={e => {
        if (!(e.target as Element).closest('.issue-picker')) setDialTarget('duration');
      }}
    >
      <DurationHintBar unlimited={false} onStep={delta => setMinutes(m => clampMinutes(m + delta))} />
      <h1>Log Time</h1>

      <DurationRow minutes={minutes} unlimited={false} dialFocused={dialTarget === 'duration'} />

      <div className="issue-picker" onPointerDown={() => setDialTarget('issue')}>
        <label>Log time to</label>
        <IssuePicker
          config={config}
          selected={selected}
          onSelect={setSelected}
          allowNone={false}
          dialEnabled={dialTarget === 'issue'}
        />
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
