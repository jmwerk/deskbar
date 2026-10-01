import { useCallback, useState } from 'react';
import type { Config } from '../config';
import { DurationHintBar, DurationRow } from '../DurationPicker';
import { IssuePicker } from '../IssuePicker';
import type { JiraIssue } from '../jira';
import { clampMinutes, DURATION_STEPS, useKeydown, useRotaryStep } from '../physicalControls';

export function FocusSetup({
  config,
  lastIssueKey,
  onCancel,
  onStart,
}: {
  config: Config;
  lastIssueKey?: string;
  onCancel: () => void;
  onStart: (durationS: number | null, issue: JiraIssue | undefined) => void;
}) {
  const [minutes, setMinutes] = useState(config.defaultFocusMinutes);
  const [unlimited, setUnlimited] = useState(false);
  const [selected, setSelected] = useState<JiraIssue | undefined>(undefined);
  // Dial is one shared input: route by last-touched section, not both; issue list is default
  // when it exists, otherwise duration is the only thing left for the dial to control.
  const [dialTarget, setDialTarget] = useState<'duration' | 'issue'>(config.jira ? 'issue' : 'duration');
  const listOwnsDial = !!config.jira;
  const dialToDuration = useCallback(() => {
    if (!unlimited) setDialTarget('duration');
  }, [unlimited]);

  useKeydown(
    useCallback(
      e => {
        const stepIndex = ['1', '2', '3', '4'].indexOf(e.key);
        if (stepIndex !== -1) {
          if (unlimited) return;
          setMinutes(m => clampMinutes(m + DURATION_STEPS[stepIndex]));
        } else if (e.key === 'Escape') {
          onCancel();
        } else if (e.key === 'Enter' || e.key === ' ') {
          // Pressing while the dial is on the duration settles it and hands the dial back to the list.
          if (dialTarget === 'duration' && listOwnsDial) setDialTarget('issue');
          else onStart(unlimited ? null : minutes * 60, selected);
        } else {
          return;
        }
        e.preventDefault();
      },
      [unlimited, minutes, selected, onCancel, onStart, dialTarget, listOwnsDial],
    ),
  );

  // Fine-grained ±1 min per detent, atop coarser buttons; mirrors IssuePicker's dial use.
  useRotaryStep(
    useCallback(dir => setMinutes(m => clampMinutes(m + dir)), []),
    dialTarget === 'duration' && !unlimited,
  );

  return (
    <div
      className="screen focus-setup"
      onPointerDown={e => {
        if (!(e.target as Element).closest('.issue-picker')) setDialTarget('duration');
      }}
    >
      <DurationHintBar unlimited={unlimited} onStep={delta => setMinutes(m => clampMinutes(m + delta))} />
      <h1>Start Focus</h1>

      <DurationRow
        minutes={minutes}
        unlimited={unlimited}
        allowUnlimited
        onToggleUnlimited={() => setUnlimited(u => !u)}
        dialFocused={dialTarget === 'duration'}
        dialHint={listOwnsDial ? 'Press to pick the issue' : undefined}
      />

      {config.jira && (
        <div className="issue-picker" onPointerDown={() => setDialTarget('issue')}>
          <label>Log time to</label>
          <IssuePicker
            config={config}
            selected={selected}
            onSelect={setSelected}
            allowNone
            dialEnabled={dialTarget === 'issue'}
            preferredKey={lastIssueKey}
            onDialPastTop={dialToDuration}
          />
        </div>
      )}

      <div className="actions">
        <button className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn-primary" onClick={() => onStart(unlimited ? null : minutes * 60, selected)}>
          Start
        </button>
      </div>
    </div>
  );
}
