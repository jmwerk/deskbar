import { useCallback, useEffect, useMemo, useState } from 'react';
import { watchConfig } from './bridgething';
import { DEFAULT_CONFIG, parseConfig, type Config } from './config';
import { formatDuration } from './format';
import {
  loadHistory,
  appendHistoryEntry,
  removeHistoryEntry,
  todayEntries,
  totalSeconds,
  type HistoryEntry,
} from './history';
import { deleteWorklog, logWork } from './jira';
import { loadSession, saveSession, type SessionState } from './session';
import { Toast } from './Toast';
import { fireFocusWebhook } from './webhook';
import { FocusRunning } from './screens/FocusRunning';
import { FocusSetup } from './screens/FocusSetup';
import { History } from './screens/History';
import { Home } from './screens/Home';
import { LogTimeNow } from './screens/LogTimeNow';

export default function App() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
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
