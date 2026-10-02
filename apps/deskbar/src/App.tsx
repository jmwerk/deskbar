import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { client, watchConfig } from './bridgething';
import { DEFAULT_CONFIG, parseConfig, type Config } from './config';
import { formatDuration } from './format';
import {
  loadHistory,
  appendHistoryEntry,
  removeHistoryEntry,
  todayEntries,
  totalSeconds,
  type HistoryEntry,
  type NewHistoryEntry,
} from './history';
import { deleteWorklog, logWork, MIN_WORKLOG_S } from './jira';
import { adjustedRunningMinutes } from './physicalControls';
import { loadPendingWorklogs, queuePendingWorklog, removePendingWorklog } from './retryQueue';
import { activeElapsedS, loadSession, saveSession, type SessionState } from './session';
import { Toast, type ToastKind } from './Toast';
import { usePlayer } from './usePlayer';
import { fireFocusWebhook } from './webhook';
import { FocusRunning } from './screens/FocusRunning';
import { FocusSetup } from './screens/FocusSetup';
import { Home } from './screens/Home';
import { LogTimeNow } from './screens/LogTimeNow';

export default function App() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [session, setSession] = useState<SessionState | null>(null);
  const [screen, setScreen] = useState<'home' | 'focusSetup' | 'logTime'>('home');
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<{ message: string; kind: ToastKind } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [receipt, setReceipt] = useState<HistoryEntry | null>(null);
  const player = usePlayer(client);

  const showError = useCallback((message: string) => setToast({ message, kind: 'error' }), []);
  const showSuccess = useCallback((message: string) => setToast({ message, kind: 'success' }), []);
  const showInfo = useCallback((message: string) => setToast({ message, kind: 'info' }), []);

  // A fresh worklog gets an undoable receipt instead of a plain toast.
  const recordWorklog = useCallback(async (entry: NewHistoryEntry) => {
    const next = await appendHistoryEntry(entry);
    setHistory(next);
    setToast(null);
    setReceipt(next[0]);
  }, []);

  const deleteEntry = useCallback(
    async (entry: HistoryEntry) => {
      if (config.jira && entry.worklogId) {
        await deleteWorklog(config.jira, entry.issueKey, entry.worklogId);
      }
      setHistory(await removeHistoryEntry(entry.id));
      setReceipt(current => (current?.id === entry.id ? null : current));
    },
    [config.jira],
  );

  const undoReceipt = useCallback(
    async (entry: HistoryEntry) => {
      try {
        await deleteEntry(entry);
        showInfo(`Removed ${formatDuration(entry.seconds)} from ${entry.issueKey}.`);
      } catch {
        showError(`Couldn't remove it from Jira, so ${entry.issueKey} still has ${formatDuration(entry.seconds)}.`);
      } finally {
        setReceipt(null);
      }
    },
    [deleteEntry, showInfo, showError],
  );
  const dismissReceipt = useCallback(() => setReceipt(null), []);

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

  // History is newest first, so this is the issue most recently logged to.
  const lastIssueKey = history[0]?.issueKey;

  const todayLog = useMemo(() => todayEntries(history, now, config.timezone), [history, now, config.timezone]);
  const todaySeconds = useMemo(() => totalSeconds(todayLog), [todayLog]);

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

  const extendFocus = useCallback(
    (deltaMinutes: number) => {
      if (!session?.focus || session.focus.durationS == null) return;
      const nextMinutes = adjustedRunningMinutes(session.focus.durationS / 60, deltaMinutes, elapsedS);
      update({ status: 'focus', focus: { ...session.focus, durationS: Math.round(nextMinutes * 60) } });
    },
    [session, elapsedS, update],
  );

  // Keyed by start time: a double tap, or a tap racing auto-end, must not log one session twice.
  const endedStartRef = useRef<number | null>(null);
  const endFocus = useCallback(
    async (completed: boolean) => {
      if (!session?.focus || endedStartRef.current === session.focus.startedAt) return;
      endedStartRef.current = session.focus.startedAt;
      const { durationS, issueKey, issueSummary } = session.focus;
      const finalElapsedS = completed && durationS != null ? durationS : activeElapsedS(session.focus, now);
      update({ status: 'available' });
      const webhookOk = await fireFocusWebhook(config.focusWebhookUrl, config.focusWebhookFormat, 'focus.stopped', {
        issueKey,
        durationS: finalElapsedS,
      });
      if (!webhookOk) showError('Focus automation webhook failed to fire.');
      if (config.jira && issueKey) {
        if (finalElapsedS < MIN_WORKLOG_S) {
          showInfo(`Under a minute, so nothing was logged to ${issueKey}.`);
          return;
        }
        try {
          const { worklogId, seconds } = await logWork(config.jira, issueKey, finalElapsedS, 'Logged via Deskbar');
          void recordWorklog({ issueKey, issueSummary, seconds, loggedAt: Date.now(), worklogId });
        } catch (err) {
          console.warn('[deskbar] failed to log work to Jira', err);
          showError(`Couldn't log time to ${issueKey} — the session still ended.`);
          void queuePendingWorklog({ issueKey, issueSummary, seconds: finalElapsedS, createdAt: Date.now() });
        }
      }
    },
    [session, now, config, update, showError, showInfo, recordWorklog],
  );

  // Auto-end at remainingS 0, skipped while paused; null remainingS is unlimited.
  useEffect(() => {
    if (session?.status === 'focus' && !session.focus?.pausedAt && remainingS !== null && remainingS <= 0) {
      void endFocus(true);
    }
  }, [session, remainingS, endFocus]);

  // Retry failed worklogs once on launch, after Jira config loads; not on later config changes.
  const retriedPendingRef = useRef(false);
  useEffect(() => {
    const jiraConfig = config.jira;
    if (!jiraConfig || retriedPendingRef.current) return;
    retriedPendingRef.current = true;
    (async () => {
      for (const entry of await loadPendingWorklogs()) {
        try {
          const { worklogId, seconds } = await logWork(jiraConfig, entry.issueKey, entry.seconds, 'Logged via Deskbar');
          await removePendingWorklog(entry.id);
          void appendHistoryEntry({
            issueKey: entry.issueKey,
            issueSummary: entry.issueSummary,
            seconds,
            loggedAt: entry.createdAt,
            worklogId,
          }).then(setHistory);
          showSuccess(`Recovered ${formatDuration(seconds)} logged to ${entry.issueKey}.`);
        } catch {
          // Still can't reach Jira — leave it queued for the next launch.
        }
      }
    })();
  }, [config.jira, showSuccess]);

  let content: ReactElement;
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
        jiraConfigured={!!config.jira}
        todaySeconds={todaySeconds}
        now={now}
        timezone={config.timezone}
        player={player}
        onTogglePause={togglePause}
        onExtend={extendFocus}
        onEnd={() => void endFocus(false)}
      />
    );
  } else if (screen === 'focusSetup') {
    content = (
      <FocusSetup
        config={config}
        lastIssueKey={lastIssueKey}
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
        lastIssueKey={lastIssueKey}
        onCancel={() => setScreen('home')}
        onLogged={entry => {
          void recordWorklog(entry);
          setScreen('home');
        }}
        onQueued={entry => {
          void queuePendingWorklog({ ...entry, createdAt: entry.loggedAt });
          showError(
            `Couldn't reach Jira. ${formatDuration(entry.seconds)} to ${entry.issueKey} will retry next launch.`,
          );
          setScreen('home');
        }}
      />
    );
  } else {
    content = (
      <Home
        status={session.status}
        jiraConfigured={!!config.jira}
        todaySeconds={todaySeconds}
        todayLog={todayLog}
        now={now}
        timezone={config.timezone}
        player={player}
        onSelect={status => {
          if (status === 'focus') setScreen('focusSetup');
          else update({ status });
        }}
        onLogNow={() => setScreen('logTime')}
        onDeleteEntry={deleteEntry}
        receipt={receipt}
        onUndoReceipt={undoReceipt}
        onDismissReceipt={dismissReceipt}
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
