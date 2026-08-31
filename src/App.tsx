import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { watchConfig } from './bridgething';
import { loadSession, saveSession, type SessionState, type Status } from './session';
import { searchIssues, logWork, deleteWorklog, JiraError, type JiraConfig, type JiraIssue } from './jira';
import { fireFocusWebhook } from './webhook';
import {
  loadHistory,
  appendHistoryEntry,
  removeHistoryEntry,
  todayEntries,
  totalSeconds,
  type HistoryEntry,
  type NewHistoryEntry,
} from './history';

type Config = {
  jira: JiraConfig | null;
  jiraJql: string;
  focusWebhookUrl?: string;
  defaultFocusMinutes: number;
};

const DEFAULT_JQL = 'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC';

/**
 * The Car Thing's physical controls never reach `@bridgething/client` — the
 * kiosk delivers them straight to the page as plain DOM events: preset
 * buttons 1-4 as `keydown` "1".."4", the Mode button as "m", Back as
 * "Escape", and the rotary dial as `wheel` with horizontal `deltaX`.
 */
const PRESET_MINUTES = [15, 25, 45, 60];
const PRESET_LABELS = ['①', '②', '③', '④'];

/** Rotary wheel events arrive as a burst of small deltas per detent; accumulate and step. */
export function useRotaryStep(onStep: (direction: 1 | -1) => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let accum = 0;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      accum += e.deltaX;
      if (Math.abs(accum) < 100) return;
      onStep(accum > 0 ? 1 : -1);
      accum = 0;
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [onStep, enabled]);
}

export function parseConfig(raw: Record<string, string>): Config {
  const jira =
    raw.jiraBaseUrl && raw.jiraEmail && raw.jiraApiToken
      ? { baseUrl: raw.jiraBaseUrl, email: raw.jiraEmail, apiToken: raw.jiraApiToken }
      : null;
  return {
    jira,
    jiraJql: raw.jiraJql || DEFAULT_JQL,
    focusWebhookUrl: raw.focusWebhookUrl || undefined,
    defaultFocusMinutes: raw.defaultFocusMinutes ? Number(raw.defaultFocusMinutes) : 25,
  };
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/** Compact "1h 45m" / "45m" duration label, for the today summary and history rows. */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function App() {
  const [config, setConfig] = useState<Config>({ jira: null, jiraJql: DEFAULT_JQL, defaultFocusMinutes: 25 });
  const [session, setSession] = useState<SessionState | null>(null);
  const [screen, setScreen] = useState<'home' | 'focusSetup' | 'logTime' | 'history'>('home');
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const showError = useCallback((message: string) => setToast({ message, kind: 'error' }), []);
  const showSuccess = useCallback((message: string) => setToast({ message, kind: 'success' }), []);

  // Auto-dismiss any toast after a few seconds.
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => watchConfig(raw => setConfig(parseConfig(raw))), []);
  useEffect(() => {
    loadSession().then(s => {
      setSession(s);
      if (s.status === 'focus') setScreen('home');
    });
  }, []);
  useEffect(() => {
    loadHistory().then(setHistory);
  }, []);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const todaySeconds = useMemo(() => totalSeconds(todayEntries(history, now)), [history, now]);

  const update = useCallback((next: SessionState) => {
    setSession(next);
    void saveSession(next);
  }, []);

  const remainingS = useMemo(() => {
    if (!session?.focus) return 0;
    return session.focus.durationS - (now - session.focus.startedAt) / 1000;
  }, [session, now]);

  const endFocus = useCallback(
    async (completed: boolean) => {
      if (!session?.focus) return;
      const { startedAt, durationS, issueKey, issueSummary } = session.focus;
      const elapsedS = completed ? durationS : (now - startedAt) / 1000;
      update({ status: 'available' });
      const webhookOk = await fireFocusWebhook(config.focusWebhookUrl, 'focus.stopped', {
        issueKey,
        durationS: elapsedS,
      });
      if (!webhookOk) showError('Focus automation webhook failed to fire.');
      if (config.jira && issueKey) {
        try {
          const { worklogId } = await logWork(config.jira, issueKey, elapsedS, 'Logged via Deskbar');
          void appendHistoryEntry({
            issueKey,
            issueSummary,
            seconds: elapsedS,
            loggedAt: Date.now(),
            worklogId,
          }).then(setHistory);
        } catch (err) {
          console.warn('[deskbar] failed to log work to Jira', err);
          showError(`Couldn't log time to ${issueKey} — the session still ended.`);
        }
      }
    },
    [session, now, config, update, showError],
  );

  // Auto-end when the countdown reaches zero.
  useEffect(() => {
    if (session?.status === 'focus' && remainingS <= 0) {
      void endFocus(true);
    }
  }, [session, remainingS, endFocus]);

  let content: JSX.Element;
  if (!session) {
    content = (
      <div className="screen center loading-screen">
        <div className="spinner" aria-hidden="true" />
        <div className="hint">Loading Deskbar…</div>
      </div>
    );
  } else if (session.status === 'focus' && session.focus) {
    content = (
      <FocusRunning
        issueKey={session.focus.issueKey}
        issueSummary={session.focus.issueSummary}
        remainingS={remainingS}
        totalS={session.focus.durationS}
        onEnd={() => void endFocus(false)}
      />
    );
  } else if (screen === 'focusSetup') {
    content = (
      <FocusSetup
        config={config}
        onCancel={() => setScreen('home')}
        onStart={async (durationS, issue) => {
          const focus = { startedAt: Date.now(), durationS, issueKey: issue?.key, issueSummary: issue?.summary };
          update({ status: 'focus', focus });
          setScreen('home');
          const webhookOk = await fireFocusWebhook(config.focusWebhookUrl, 'focus.started', {
            issueKey: issue?.key,
            durationS,
          });
          if (!webhookOk) showError('Focus automation webhook failed to fire.');
        }}
      />
    );
  } else if (screen === 'logTime') {
    content = (
      <LogTimeNow
        config={config}
        onCancel={() => setScreen('home')}
        onLogged={entry => {
          void appendHistoryEntry(entry).then(setHistory);
          showSuccess(`Logged ${formatDuration(entry.seconds)} to ${entry.issueKey}.`);
          setScreen('home');
        }}
      />
    );
  } else if (screen === 'history') {
    content = (
      <History
        entries={history}
        onBack={() => setScreen('home')}
        onDelete={async entry => {
          if (config.jira && entry.worklogId) {
            await deleteWorklog(config.jira, entry.issueKey, entry.worklogId);
          }
          setHistory(await removeHistoryEntry(entry.id));
        }}
      />
    );
  } else {
    content = (
      <Home
        status={session.status}
        jiraConfigured={!!config.jira}
        todaySeconds={todaySeconds}
        onSelect={status => {
          if (status === 'focus') setScreen('focusSetup');
          else update({ status });
        }}
        onLogNow={() => setScreen('logTime')}
        onOpenHistory={() => setScreen('history')}
      />
    );
  }

  return (
    <>
      {content}
      {toast && <Toast message={toast.message} kind={toast.kind} />}
    </>
  );
}

function Toast({ message, kind }: { message: string; kind: 'success' | 'error' }) {
  return (
    <div className={`toast toast-${kind}`} role="status">
      {message}
    </div>
  );
}

function CheckIcon({ size = 34 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function BusyIcon({ size = 34 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}

function BoltIcon({ size = 34 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <path d="M13 2 3 14h7l-1 8 11-14h-7l1-6Z" />
    </svg>
  );
}

function Home({
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
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      // Presets 1-3 mirror the three tiles below; preset 4 opens Log Time
      // Now (only meaningful once Jira is configured).
      if (e.key === '1') onSelect('available');
      else if (e.key === '2') onSelect('busy');
      else if (e.key === '3') onSelect('focus');
      else if (e.key === '4' && jiraConfigured) onLogNow();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onSelect, onLogNow, jiraConfigured]);

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

function DurationPicker({ minutes, onChange }: { minutes: number; onChange: (minutes: number) => void }) {
  return (
    <div className="row">
      <label>Duration</label>
      <div className="presets">
        {PRESET_MINUTES.map((p, i) => (
          <button key={p} className={`preset-chip ${minutes === p ? 'selected' : ''}`} onClick={() => onChange(p)}>
            {PRESET_LABELS[i]}
            {p}m
          </button>
        ))}
      </div>
      <div className="stepper">
        <button onClick={() => onChange(Math.max(5, minutes - 5))}>−</button>
        <span>{minutes} min</span>
        <button onClick={() => onChange(Math.min(240, minutes + 5))}>+</button>
      </div>
    </div>
  );
}

/**
 * Fetches and lists Jira issues for `config.jiraJql`, with dial-scroll and
 * touch selection. `allowNone` adds a "No issue" row at the top (Focus
 * Setup can run as a plain timer; Log Time Now always needs an issue).
 * Shared so the fetch/dial/auto-scroll logic isn't duplicated per screen.
 */
function IssuePicker({
  config,
  selected,
  onSelect,
  allowNone = true,
}: {
  config: Config;
  selected: JiraIssue | undefined;
  onSelect: (issue: JiraIssue | undefined) => void;
  allowNone?: boolean;
}) {
  const [issues, setIssues] = useState<JiraIssue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadedFor = useRef<string | null>(null);

  const load = useCallback(() => {
    if (!config.jira) return;
    loadedFor.current = config.jiraJql;
    setError(null);
    setIssues(null);
    searchIssues(config.jira, config.jiraJql)
      .then(setIssues)
      .catch(err => setError(err instanceof JiraError ? err.message : 'Could not load Jira issues'));
  }, [config]);

  useEffect(() => {
    if (!config.jira || loadedFor.current === config.jiraJql) return;
    load();
  }, [config, load]);

  // The rows in on-screen order, for the rotary dial to step through.
  const pickList = useMemo<(JiraIssue | undefined)[]>(
    () => (allowNone ? [undefined, ...(issues ?? [])] : (issues ?? [])),
    [issues, allowNone],
  );

  const onDialStep = useCallback(
    (direction: 1 | -1) => {
      const currentIndex = Math.max(
        0,
        pickList.findIndex(i => i?.key === selected?.key),
      );
      const nextIndex = Math.min(pickList.length - 1, Math.max(0, currentIndex + direction));
      onSelect(pickList[nextIndex]);
    },
    [pickList, selected, onSelect],
  );
  useRotaryStep(onDialStep, !!config.jira && pickList.length > 0);

  // Keep the selected row in view when the dial moves the selection off-screen.
  const selectedRowRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!config.jira) return null;

  return (
    <>
      {error && (
        <div className="hint error">
          {error}
          <button className="retry-link" onClick={load}>
            Retry
          </button>
        </div>
      )}
      {!error && !issues && <div className="hint">Loading your Jira issues…</div>}
      {issues && issues.length === 0 && <div className="hint">No matching issues found.</div>}
      <div className="issue-list">
        {allowNone && (
          <button
            ref={!selected ? selectedRowRef : undefined}
            className={`issue-row ${!selected ? 'selected' : ''}`}
            onClick={() => onSelect(undefined)}
          >
            No issue — just a timer
          </button>
        )}
        {issues?.map(issue => (
          <button
            key={issue.key}
            ref={selected?.key === issue.key ? selectedRowRef : undefined}
            className={`issue-row ${selected?.key === issue.key ? 'selected' : ''}`}
            onClick={() => onSelect(issue)}
          >
            <span className="issue-key">{issue.key}</span>
            <span className="issue-summary">{issue.summary}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function FocusSetup({
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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
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
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [minutes, selected, onCancel, onStart]);

  return (
    <div className="screen focus-setup">
      <h1>Start Focus</h1>

      <DurationPicker minutes={minutes} onChange={setMinutes} />

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

function LogTimeNow({
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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
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
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel, submit]);

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

function History({
  entries,
  onBack,
  onDelete,
}: {
  entries: HistoryEntry[];
  onBack: () => void;
  onDelete: (entry: HistoryEntry) => Promise<void>;
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (confirmingId) setConfirmingId(null);
        else onBack();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onBack, confirmingId]);

  const today = useMemo(() => todayEntries(entries), [entries]);
  const total = useMemo(() => totalSeconds(today), [today]);

  const confirmDelete = useCallback(
    async (entry: HistoryEntry) => {
      setPendingId(entry.id);
      setError(null);
      try {
        await onDelete(entry);
        setConfirmingId(null);
      } catch (err) {
        setError(err instanceof JiraError ? err.message : "Couldn't delete this from Jira");
      } finally {
        setPendingId(null);
      }
    },
    [onDelete],
  );

  return (
    <div className="screen focus-setup history-screen">
      <h1>Today</h1>
      <div className="history-total">
        {formatDuration(total)} logged
        {today.length > 0 ? ` across ${today.length} session${today.length === 1 ? '' : 's'}` : ''}
      </div>
      {error && <div className="hint error">{error}</div>}

      {today.length === 0 ? (
        <div className="hint">No time logged yet today.</div>
      ) : (
        <div className="history-list">
          {today.map(entry =>
            confirmingId === entry.id ? (
              <div className="history-row history-row-confirm" key={entry.id}>
                <span className="history-confirm-label">Delete{entry.worklogId ? ' from Jira' : ''}?</span>
                <div className="history-confirm-actions">
                  <button
                    className="history-confirm-cancel"
                    disabled={pendingId === entry.id}
                    onClick={() => setConfirmingId(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="history-confirm-delete"
                    disabled={pendingId === entry.id}
                    onClick={() => void confirmDelete(entry)}
                  >
                    {pendingId === entry.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            ) : (
              // The whole row is the tap target (not a small icon at its
              // edge), AND the visual "x" hint itself sits at the row's
              // LEFT end, not the right. On the 800x480 display the
              // top-right corner sits under the physical dial, which can
              // make that exact spot genuinely unpressable — putting the
              // affordance there would keep inviting a tap right where the
              // dial is, even with the bigger hit area. Duration is plain
              // text, not interactive, so it's fine to sit on the right.
              // See the "Physical controls" note in the README.
              <button
                className="history-row"
                key={entry.id}
                aria-label={`Delete logged time for ${entry.issueKey}`}
                onClick={() => setConfirmingId(entry.id)}
              >
                <span className="history-delete-hint" aria-hidden="true">
                  ×
                </span>
                <span className="history-issue">{entry.issueKey}</span>
                <span className="history-summary">{entry.issueSummary}</span>
                <span className="history-duration">{formatDuration(entry.seconds)}</span>
              </button>
            ),
          )}
        </div>
      )}

      <div className="actions">
        <button className="btn-secondary" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}

function FocusRunning({
  issueKey,
  issueSummary,
  remainingS,
  totalS,
  onEnd,
}: {
  issueKey?: string;
  issueSummary?: string;
  remainingS: number;
  totalS: number;
  onEnd: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onEnd();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onEnd]);

  const progress = Math.min(1, Math.max(0, 1 - remainingS / totalS));
  return (
    <div className="screen focus-running">
      <div className="focus-eyebrow">Focus session</div>
      <div className="clock">{formatClock(remainingS)}</div>
      {issueKey && (
        <div className="issue-tag">
          {issueKey}
          {issueSummary ? ` — ${issueSummary}` : ''}
        </div>
      )}
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
      </div>
      <button className="btn-danger end-btn" onClick={onEnd}>
        End Focus
      </button>
    </div>
  );
}
