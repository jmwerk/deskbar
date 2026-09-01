import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { clampMinutes } from './physicalControls';
import { loadPendingWorklogs, queuePendingWorklog, removePendingWorklog } from './retryQueue';
import { activeElapsedS, loadSession, saveSession, type SessionState } from './session';
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

  const todaySeconds = useMemo(
    () => totalSeconds(todayEntries(history, now, config.timezone)),
    [history, now, config.timezone],
  );

  const update = useCallback((next: SessionState) => {
    setSession(next);
    void saveSession(next);
  }, []);

  const elapsedS = useMemo(() => (session?.focus ? activeElapsedS(session.focus, now) : 0), [session, now]);

  // Null while a session is unlimited (no fixed duration to count down from).
  const remainingS = useMemo(() => {
    if (!session?.focus || session.focus.durationS == null) return null;
    return session.focus.durationS - elapsedS;
  }, [session, elapsedS]);

  const togglePause = useCallback(() => {
    if (!session?.focus) return;
    const focus = session.focus;
    if (focus.pausedAt) {
      // Resume: fold the pause just ending into the running total.
      const pausedMs = (focus.pausedMs ?? 0) + (Date.now() - focus.pausedAt);
      update({ status: 'focus', focus: { ...focus, pausedAt: null, pausedMs } });
    } else {
      update({ status: 'focus', focus: { ...focus, pausedAt: Date.now() } });
    }
  }, [session, update]);

  // Never below what's already elapsed — otherwise the auto-end effect
  // below would fire immediately and log only the shortened total instead
  // of the time actually spent (endFocus's "completed" path trusts
  // durationS as the final tally).
  const extendFocus = useCallback(
    (deltaMinutes: number) => {
      if (!session?.focus || session.focus.durationS == null) return;
      const currentMinutes = session.focus.durationS / 60;
      const elapsedMinutes = elapsedS / 60;
      const nextMinutes = Math.max(clampMinutes(currentMinutes + deltaMinutes), elapsedMinutes);
      update({ status: 'focus', focus: { ...session.focus, durationS: Math.round(nextMinutes * 60) } });
    },
    [session, elapsedS, update],
  );

  const endFocus = useCallback(
    async (completed: boolean) => {
      if (!session?.focus) return;
      const { durationS, issueKey, issueSummary } = session.focus;
      const finalElapsedS = completed && durationS != null ? durationS : activeElapsedS(session.focus, now);
      update({ status: 'available' });
      const webhookOk = await fireFocusWebhook(config.focusWebhookUrl, config.focusWebhookFormat, 'focus.stopped', {
        issueKey,
        durationS: finalElapsedS,
      });
      if (!webhookOk) showError('Focus automation webhook failed to fire.');
      if (config.jira && issueKey) {
        try {
          const { worklogId } = await logWork(config.jira, issueKey, finalElapsedS, 'Logged via Deskbar');
          void appendHistoryEntry({
            issueKey,
            issueSummary,
            seconds: finalElapsedS,
            loggedAt: Date.now(),
            worklogId,
          }).then(setHistory);
        } catch (err) {
          console.warn('[deskbar] failed to log work to Jira', err);
          showError(`Couldn't log time to ${issueKey} — the session still ended.`);
          void queuePendingWorklog({ issueKey, issueSummary, seconds: finalElapsedS, createdAt: Date.now() });
        }
      }
    },
    [session, now, config, update, showError],
  );

  // Auto-end when the countdown reaches zero (never while paused — the math
  // already holds remainingS still then, this is just belt-and-braces).
  // remainingS is null for an unlimited session, which has no zero to hit.
  useEffect(() => {
    if (session?.status === 'focus' && !session.focus?.pausedAt && remainingS !== null && remainingS <= 0) {
      void endFocus(true);
    }
  }, [session, remainingS, endFocus]);

  // Retry any worklogs that failed to log when a past session ended,
  // once on launch — after Jira config actually loads, and only once per
  // app session even if config changes again for an unrelated reason.
  const retriedPendingRef = useRef(false);
  useEffect(() => {
    const jiraConfig = config.jira;
    if (!jiraConfig || retriedPendingRef.current) return;
    retriedPendingRef.current = true;
    (async () => {
      for (const entry of await loadPendingWorklogs()) {
        try {
          const { worklogId } = await logWork(jiraConfig, entry.issueKey, entry.seconds, 'Logged via Deskbar');
          await removePendingWorklog(entry.id);
          void appendHistoryEntry({
            issueKey: entry.issueKey,
            issueSummary: entry.issueSummary,
            seconds: entry.seconds,
            loggedAt: entry.createdAt,
            worklogId,
          }).then(setHistory);
          showSuccess(`Recovered ${formatDuration(entry.seconds)} logged to ${entry.issueKey}.`);
        } catch {
          // Still can't reach Jira — leave it queued for the next launch.
        }
      }
    })();
  }, [config.jira, showSuccess]);

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
        elapsedS={elapsedS}
        totalS={session.focus.durationS}
        paused={!!session.focus.pausedAt}
        onTogglePause={togglePause}
        onExtend={extendFocus}
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
          const webhookOk = await fireFocusWebhook(config.focusWebhookUrl, config.focusWebhookFormat, 'focus.started', {
            issueKey: issue?.key,
            durationS: durationS ?? undefined,
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
        timezone={config.timezone}
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
        timezone={config.timezone}
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
