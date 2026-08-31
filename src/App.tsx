import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { watchConfig } from './bridgething';
import { loadSession, saveSession, type SessionState, type Status } from './session';
import { searchIssues, logWork, JiraError, type JiraConfig, type JiraIssue } from './jira';
import { fireFocusWebhook } from './webhook';

type Config = {
  jira: JiraConfig | null;
  jiraJql: string;
  focusWebhookUrl?: string;
  defaultFocusMinutes: number;
};

const DEFAULT_JQL = 'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC';

function parseConfig(raw: Record<string, string>): Config {
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

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function App() {
  const [config, setConfig] = useState<Config>({ jira: null, jiraJql: DEFAULT_JQL, defaultFocusMinutes: 25 });
  const [session, setSession] = useState<SessionState | null>(null);
  const [screen, setScreen] = useState<'home' | 'focusSetup'>('home');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => watchConfig(raw => setConfig(parseConfig(raw))), []);
  useEffect(() => {
    loadSession().then(s => {
      setSession(s);
      if (s.status === 'focus') setScreen('home');
    });
  }, []);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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
      const { startedAt, durationS, issueKey } = session.focus;
      const elapsedS = completed ? durationS : (now - startedAt) / 1000;
      update({ status: 'available' });
      await fireFocusWebhook(config.focusWebhookUrl, 'focus.stopped', { issueKey, durationS: elapsedS });
      if (config.jira && issueKey) {
        try {
          await logWork(config.jira, issueKey, elapsedS, 'Logged via Deskbar');
        } catch (err) {
          console.warn('[deskbar] failed to log work to Jira', err);
        }
      }
    },
    [session, now, config, update],
  );

  // Auto-end when the countdown reaches zero.
  useEffect(() => {
    if (session?.status === 'focus' && remainingS <= 0) {
      void endFocus(true);
    }
  }, [session, remainingS, endFocus]);

  if (!session) {
    return (
      <div className="screen center loading-screen">
        <div className="spinner" aria-hidden="true" />
        <div className="hint">Loading Deskbar…</div>
      </div>
    );
  }

  if (session.status === 'focus' && session.focus) {
    return (
      <FocusRunning
        issueKey={session.focus.issueKey}
        issueSummary={session.focus.issueSummary}
        remainingS={remainingS}
        totalS={session.focus.durationS}
        onEnd={() => void endFocus(false)}
      />
    );
  }

  if (screen === 'focusSetup') {
    return (
      <FocusSetup
        config={config}
        onCancel={() => setScreen('home')}
        onStart={async (durationS, issue) => {
          const focus = { startedAt: Date.now(), durationS, issueKey: issue?.key, issueSummary: issue?.summary };
          update({ status: 'focus', focus });
          setScreen('home');
          await fireFocusWebhook(config.focusWebhookUrl, 'focus.started', { issueKey: issue?.key, durationS });
        }}
      />
    );
  }

  return (
    <Home
      status={session.status}
      jiraConfigured={!!config.jira}
      onSelect={status => {
        if (status === 'focus') setScreen('focusSetup');
        else update({ status });
      }}
    />
  );
}

function CheckIcon({ size = 34 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function BusyIcon({ size = 34 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
  onSelect,
}: {
  status: Status;
  jiraConfigured: boolean;
  onSelect: (status: Status) => void;
}) {
  return (
    <div className="screen home">
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
        <div className="hint">Set your Jira site, email and API token from the Deskbar settings on your phone to enable time tracking.</div>
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
  const [issues, setIssues] = useState<JiraIssue[] | null>(null);
  const [selected, setSelected] = useState<JiraIssue | undefined>(undefined);
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

  const presetMinutes = [15, 25, 45, 60];

  return (
    <div className="screen focus-setup">
      <h1>Start Focus</h1>

      <div className="row">
        <label>Duration</label>
        <div className="presets">
          {presetMinutes.map(p => (
            <button key={p} className={`preset-chip ${minutes === p ? 'selected' : ''}`} onClick={() => setMinutes(p)}>
              {p}m
            </button>
          ))}
        </div>
        <div className="stepper">
          <button onClick={() => setMinutes(m => Math.max(5, m - 5))}>−</button>
          <span>{minutes} min</span>
          <button onClick={() => setMinutes(m => Math.min(240, m + 5))}>+</button>
        </div>
      </div>

      {config.jira && (
        <div className="issue-picker">
          <label>Log time to</label>
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
            <button className={`issue-row ${!selected ? 'selected' : ''}`} onClick={() => setSelected(undefined)}>
              No issue — just a timer
            </button>
            {issues?.map(issue => (
              <button
                key={issue.key}
                className={`issue-row ${selected?.key === issue.key ? 'selected' : ''}`}
                onClick={() => setSelected(issue)}
              >
                <span className="issue-key">{issue.key}</span>
                <span className="issue-summary">{issue.summary}</span>
              </button>
            ))}
          </div>
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
