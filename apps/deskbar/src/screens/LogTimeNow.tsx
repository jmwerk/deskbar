import { useCallback, useRef, useState } from 'react';
import type { Config } from '../config';
import { DurationHintBar, DurationSentence, SentenceIssue, SetupBand, SetupMeta } from '../DurationPicker';
import type { WallClock } from '../format';
import type { NewHistoryEntry } from '../history';
import { IssuePicker } from '../IssuePicker';
import { isTransientJiraError, JiraError, type JiraIssue } from '../jira';
import { clampMinutes, DURATION_STEPS, useKeydown, useRotaryStep } from '../physicalControls';
import type { PendingWorklog } from '../retryQueue';
import { postWorklog } from '../worklogs';

export function LogTimeNow({
  config,
  lastIssueKey,
  recentIssues,
  todaySeconds,
  now,
  clock,
  onCancel,
  onLogged,
  onQueued,
}: {
  config: Config;
  lastIssueKey?: string;
  recentIssues: JiraIssue[];
  /** Seconds already logged today. */
  todaySeconds: number;
  now: number;
  clock: WallClock;
  onCancel: () => void;
  onLogged: (entry: NewHistoryEntry) => void;
  /** Jira was unreachable, so the worklog was handed to the retry queue instead. */
  onQueued: (entry: Omit<PendingWorklog, 'id'>) => void;
}) {
  const [minutes, setMinutes] = useState(() => clampMinutes(config.defaultFocusMinutes));
  const [selected, setSelected] = useState<JiraIssue | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // A second dial press can land before the re-render that disables Log Time.
  const submittingRef = useRef(false);
  // Shared dial routes to whichever section was last touched; defaults to issue list.
  const [dialTarget, setDialTarget] = useState<'duration' | 'issue'>('issue');
  const dialToDuration = useCallback(() => setDialTarget('duration'), []);

  const submit = useCallback(async () => {
    if (!config.jira || !selected || submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setError(null);
    const seconds = minutes * 60;
    try {
      onLogged(await postWorklog({ ...config, jira: config.jira }, selected, seconds));
    } catch (err) {
      if (isTransientJiraError(err)) {
        onQueued({
          issueKey: selected.key,
          issueSummary: selected.summary,
          issueId: selected.id,
          seconds,
          createdAt: Date.now(),
        });
        return;
      }
      setError(`Couldn't log time to ${selected.key}: ${err instanceof JiraError ? err.message : 'unknown error'}`);
      submittingRef.current = false;
      setBusy(false);
    }
  }, [config, selected, minutes, onLogged, onQueued]);

  useKeydown(
    useCallback(
      e => {
        const stepIndex = ['1', '2', '3', '4'].indexOf(e.key);
        if (stepIndex !== -1) {
          setMinutes(m => clampMinutes(m + DURATION_STEPS[stepIndex]));
        } else if (e.key === 'Escape') {
          onCancel();
        } else if (e.key === 'Enter' || e.key === ' ') {
          // Pressing while the dial is on the duration settles it and hands the dial back to the list.
          if (dialTarget === 'duration') setDialTarget('issue');
          else void submit();
        } else {
          return;
        }
        e.preventDefault();
      },
      [onCancel, submit, dialTarget],
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
      <DurationSentence
        lead="Log"
        tail={<SentenceIssue word="to" issueKey={selected?.key} />}
        minutes={minutes}
        unlimited={false}
        dialFocused={dialTarget === 'duration'}
        dialHint="Press when done"
      />
      <SetupMeta todaySeconds={todaySeconds} addSeconds={selected ? minutes * 60 : 0} />

      <div className="issue-picker" onPointerDown={() => setDialTarget('issue')}>
        <IssuePicker
          config={config}
          selected={selected}
          onSelect={setSelected}
          allowNone={false}
          dialEnabled={dialTarget === 'issue'}
          preferredKey={lastIssueKey}
          recentIssues={recentIssues}
          onDialPastTop={dialToDuration}
        />
        {error && <div className="hint error">{error}</div>}
      </div>

      <SetupBand now={now} clock={clock} onCancel={onCancel}>
        <button className="btn-primary" disabled={!selected || busy} onClick={() => void submit()}>
          {busy ? 'Logging…' : 'Log Time'}
        </button>
      </SetupBand>
    </div>
  );
}
