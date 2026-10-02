import type { WallClock } from '../format';
import { useCallback, useState, type ReactNode } from 'react';
import type { Config } from '../config';
import {
  DurationHintBar,
  DurationSentence,
  SentenceIssue,
  SetupBand,
  SetupMeta,
  UnlimitedToggle,
} from '../DurationPicker';
import { IssuePicker } from '../IssuePicker';
import type { JiraIssue } from '../jira';
import { clampMinutes, DURATION_STEPS, useKeydown, useRotaryStep } from '../physicalControls';

export function FocusSetup({
  config,
  lastIssueKey,
  todaySeconds,
  now,
  clock,
  onCancel,
  onStart,
}: {
  config: Config;
  lastIssueKey?: string;
  /** Seconds already logged today. */
  todaySeconds: number;
  now: number;
  clock: WallClock;
  onCancel: () => void;
  onStart: (durationS: number | null, issue: JiraIssue | undefined) => void;
}) {
  const [minutes, setMinutes] = useState(config.defaultFocusMinutes);
  const [unlimited, setUnlimited] = useState(false);
  const [selected, setSelected] = useState<JiraIssue | undefined>(undefined);
  // Undefined means "No issue" only once the picker has chosen; before that the list is still loading.
  const [picked, setPicked] = useState(false);
  const pick = useCallback((issue: JiraIssue | undefined) => {
    setSelected(issue);
    setPicked(true);
  }, []);
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

  let sentenceTail: ReactNode;
  if (!config.jira) sentenceTail = undefined;
  else if (selected || !picked) sentenceTail = <SentenceIssue word="on" issueKey={selected?.key} />;
  else sentenceTail = <span className="sentence-muted">{unlimited ? 'and no issue' : 'without an issue'}</span>;

  return (
    <div
      className="screen focus-setup"
      onPointerDown={e => {
        if (!(e.target as Element).closest('.issue-picker')) setDialTarget('duration');
      }}
    >
      <DurationHintBar unlimited={unlimited} onStep={delta => setMinutes(m => clampMinutes(m + delta))} />
      <DurationSentence
        lead={unlimited ? 'Focus with' : 'Focus for'}
        tail={sentenceTail}
        minutes={minutes}
        unlimited={unlimited}
        dialFocused={dialTarget === 'duration'}
        dialHint={listOwnsDial ? 'Press when done' : undefined}
      />
      <SetupMeta
        todaySeconds={config.jira ? todaySeconds : undefined}
        addSeconds={selected && !unlimited ? minutes * 60 : 0}
      >
        <UnlimitedToggle unlimited={unlimited} onToggle={() => setUnlimited(u => !u)} />
      </SetupMeta>

      {config.jira && (
        <div className="issue-picker" onPointerDown={() => setDialTarget('issue')}>
          <IssuePicker
            config={config}
            selected={selected}
            onSelect={pick}
            allowNone
            dialEnabled={dialTarget === 'issue'}
            preferredKey={lastIssueKey}
            onDialPastTop={dialToDuration}
          />
        </div>
      )}

      <SetupBand now={now} clock={clock} onCancel={onCancel}>
        <button className="btn-primary" onClick={() => onStart(unlimited ? null : minutes * 60, selected)}>
          Start
        </button>
      </SetupBand>
    </div>
  );
}
