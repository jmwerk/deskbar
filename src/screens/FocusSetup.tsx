import { useCallback, useState } from 'react';
import type { Config } from '../config';
import { DurationRow, PresetHint } from '../DurationPicker';
import { IssuePicker } from '../IssuePicker';
import type { JiraIssue } from '../jira';
import { PRESET_MINUTES, useKeydown } from '../physicalControls';

export function FocusSetup({
  config,
  onCancel,
  onStart,
}: {
  config: Config;
  onCancel: () => void;
  onStart: (durationS: number, issue: JiraIssue | undefined) => void;
}) {
  const [minutes, setMinutes] = useState(config.defaultFocusMinutes);
  const [selected, setSelected] = useState<JiraIssue | undefined>(undefined);

  useKeydown(
    useCallback(
      e => {
        const presetIndex = ['1', '2', '3', '4'].indexOf(e.key);
        if (presetIndex !== -1) {
          setMinutes(PRESET_MINUTES[presetIndex]);
        } else if (e.key === 'Escape') {
          onCancel();
        } else if (e.key === 'Enter' || e.key === ' ') {
          // The dial's push-button. Confirmed on hardware to fire both Enter and
          // Space, so both are bound. preventDefault below also stops it from
          // re-activating whatever button last happened to hold focus.
          onStart(minutes * 60, selected);
        } else {
          return;
        }
        e.preventDefault();
      },
      [minutes, selected, onCancel, onStart],
    ),
  );

  return (
    <div className="screen focus-setup">
      <PresetHint minutes={minutes} onChange={setMinutes} />
      <h1>Start Focus</h1>

      <DurationRow minutes={minutes} onChange={setMinutes} />

      {config.jira && (
        <div className="issue-picker">
          <label>Log time to</label>
          <IssuePicker config={config} selected={selected} onSelect={setSelected} allowNone />
        </div>
      )}

      <div className="actions">
        <button className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn-primary" onClick={() => onStart(minutes * 60, selected)}>
          Start
        </button>
      </div>
    </div>
  );
}
