import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { client, watchConfig } from './bridgething';
import { DEFAULT_CONFIG, parseConfig, type Config } from './config';
import { formatDuration } from './format';
import {
  loadHistory,
  appendHistoryEntry,
  removeHistoryEntry,
  syncDay,
  todayEntries,
  totalSeconds,
  type HistoryEntry,
  type NewHistoryEntry,
} from './history';
import { recentFromHistory } from './issueSelection';
import { JiraError, MIN_WORKLOG_S, transitionIssue } from './jira';
import { adjustedRunningMinutes } from './physicalControls';
import { loadPendingWorklogs, queuePendingWorklog, removePendingWorklog } from './retryQueue';
import { activeElapsedS, loadSession, saveSession, type SessionState } from './session';
import { Toast, type ToastKind } from './Toast';
import { usePlayer } from './usePlayer';
import { roundWorklogSeconds, type SyncState } from './timesheet';
import { fireFocusWebhook } from './webhook';
import { fetchDayWorklogs, postWorklog, removeWorklog } from './worklogs';
import { FocusRunning } from './screens/FocusRunning';
import { FocusSetup } from './screens/FocusSetup';
import { Home } from './screens/Home';
import { LogTimeNow } from './screens/LogTimeNow';

const SYNC_INTERVAL_MS = 10 * 60_000;
// Waking the screen or coming back to Home syncs too, but not more often than this.
const SYNC_MIN_GAP_MS = 30_000;

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
        await removeWorklog({ ...config, jira: config.jira }, entry);
      }
      setHistory(await removeHistoryEntry(entry.id));
      setReceipt(current => (current?.id === entry.id ? null : current));
    },
    [config],
  );

  const moveIssue = useCallback(
    async (issueKey: string, status: string) => {
      if (!config.jira) return;
      try {
        if ((await transitionIssue(config.jira, issueKey, status)) === 'moved') {
          showInfo(`Moved ${issueKey} to ${status}.`);
        }
      } catch (err) {
        showError(
          `Couldn't move ${issueKey} to ${status}: ${err instanceof JiraError ? err.message : 'unknown error'}`,
        );
        throw err;
      }
    },
    [config.jira, showInfo, showError],
  );
  const doneReceipt = useCallback(
    (entry: HistoryEntry, status: string) => moveIssue(entry.issueKey, status),
    [moveIssue],
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

  // Issues logged to this past week, so the picker still offers them after the JQL drops them.
  const recentIssues = useMemo(() => recentFromHistory(history, now), [history, now]);

  const todayLog = useMemo(() => todayEntries(history, now, config.timezone), [history, now, config.timezone]);
  const clock = useMemo(
    () => ({ timeZone: config.timezone, hour12: config.hour12, face: config.clockFace }),
    [config.timezone, config.hour12, config.clockFace],
  );
  const todaySeconds = useMemo(() => totalSeconds(todayLog), [todayLog]);

  // Pulls today's worklogs from the tracker so Home matches it, including time logged elsewhere.
  const historyRef = useRef(history);
  const configRef = useRef(config);
  useEffect(() => {
    historyRef.current = history;
    configRef.current = config;
  });
  const lastSyncRef = useRef(0);
  const syncingRef = useRef(false);
  const [sync, setSync] = useState<SyncState>({ status: 'idle' });
  const syncNow = useCallback(async () => {
    if (!config.jira || syncingRef.current) return;
    syncingRef.current = true;
    const startedAt = Date.now();
    lastSyncRef.current = startedAt;
    setSync(s => ({ ...s, status: 'syncing' }));
    const knownKeys = [
      ...new Set(
        todayEntries(historyRef.current, startedAt, config.timezone)
          .filter(e => e.worklogId)
          .map(e => e.issueKey),
      ),
    ];
    try {
      const { day, worklogs } = await fetchDayWorklogs({ ...config, jira: config.jira }, startedAt, knownKeys);
      setHistory(await syncDay(worklogs, day, config.timezone, startedAt));
      setSync({ status: 'idle', at: Date.now() });
    } catch (err) {
      // Keep what's on screen; Home's sync line says it failed and the next sync tries again.
      console.warn('[deskbar] worklog sync failed', err);
      setSync(s => ({ ...s, status: 'error' }));
    } finally {
      syncingRef.current = false;
    }
  }, [config]);
  useEffect(() => {
    void syncNow();
    const id = setInterval(() => void syncNow(), SYNC_INTERVAL_MS);
    return () => clearInterval(id);
  }, [syncNow]);
  const syncSoon = useCallback(() => {
    if (Date.now() - lastSyncRef.current >= SYNC_MIN_GAP_MS) void syncNow();
  }, [syncNow]);

  // Arriving on Home from another screen or a finished session is when a fresh ledger matters.
  const onHome = !!session && session.status !== 'focus' && screen === 'home';
  const wasOnHomeRef = useRef(onHome);
  useEffect(() => {
    if (onHome && !wasOnHomeRef.current) syncSoon();
    wasOnHomeRef.current = onHome;
  }, [onHome, syncSoon]);

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
      const { durationS, issueKey, issueSummary, issueId } = session.focus;
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
        const seconds = roundWorklogSeconds(finalElapsedS, config.roundToMinutes);
        try {
          const entry = await postWorklog(
            { ...config, jira: config.jira },
            { key: issueKey, id: issueId, summary: issueSummary },
            seconds,
          );
          void recordWorklog(entry);
        } catch (err) {
          console.warn('[deskbar] failed to log work', err);
          showError(`Couldn't log time to ${issueKey} — the session still ended.`);
          void queuePendingWorklog({ issueKey, issueSummary, issueId, seconds, createdAt: Date.now() });
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
    const latest = configRef.current;
    retriedPendingRef.current = true;
    (async () => {
      for (const entry of await loadPendingWorklogs()) {
        try {
          const posted = await postWorklog(
            { ...latest, jira: jiraConfig },
            { key: entry.issueKey, id: entry.issueId, summary: entry.issueSummary },
            entry.seconds,
          );
          await removePendingWorklog(entry.id);
          void appendHistoryEntry(posted).then(setHistory);
          showSuccess(`Recovered ${formatDuration(posted.seconds)} logged to ${entry.issueKey}.`);
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
        clock={clock}
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
        recentIssues={recentIssues}
        todaySeconds={todaySeconds}
        now={now}
        clock={clock}
        onCancel={() => setScreen('home')}
        onStart={async (durationS, issue) => {
          const focus = {
            startedAt: Date.now(),
            durationS,
            issueKey: issue?.key,
            issueSummary: issue?.summary,
            issueId: issue?.id,
          };
          update({ status: 'focus', focus });
          setScreen('home');
          if (issue && config.startStatus) void moveIssue(issue.key, config.startStatus).catch(() => {});
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
        recentIssues={recentIssues}
        todaySeconds={todaySeconds}
        now={now}
        clock={clock}
        onCancel={() => setScreen('home')}
        onLogged={entry => {
          void recordWorklog(entry);
          setScreen('home');
        }}
        onQueued={entry => {
          void queuePendingWorklog(entry);
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
        clock={clock}
        player={player}
        onSelect={status => {
          if (status === 'focus') setScreen('focusSetup');
          else update({ status });
        }}
        onLogNow={() => setScreen('logTime')}
        onDeleteEntry={deleteEntry}
        receipt={receipt}
        onUndoReceipt={undoReceipt}
        onDoneReceipt={doneReceipt}
        onDismissReceipt={dismissReceipt}
        doneStatus={config.doneStatus}
        onWake={syncSoon}
        sync={sync}
        onRefresh={syncNow}
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
