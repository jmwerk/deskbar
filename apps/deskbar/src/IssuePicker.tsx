import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Config } from './config';
import { defaultIssue, nextDialIndex } from './issueSelection';
import { searchIssues, JiraError, type JiraIssue } from './jira';
import { useRotaryStep } from './physicalControls';
import { PullFrame } from './PullToRefresh';
import { usePullToRefresh } from './usePullToRefresh';

/** Shared Jira issue list: dial-scroll, touch select, project chips, optional "No issue" row. */
export function IssuePicker({
  config,
  selected,
  onSelect,
  allowNone = true,
  dialEnabled = true,
  preferredKey,
  recentIssues = [],
  onDialPastTop,
}: {
  config: Config;
  selected: JiraIssue | undefined;
  onSelect: (issue: JiraIssue | undefined) => void;
  allowNone?: boolean;
  /** Set false when the screen owns another dial control, so only one thing responds to turns. */
  dialEnabled?: boolean;
  /** Preselected once issues load, when it's in the list; otherwise the first issue is. */
  preferredKey?: string;
  /** Issues logged to lately, listed after the query's results when the query no longer returns them. */
  recentIssues?: JiraIssue[];
  /** Turning up past the first row hands the dial to whatever sits above the list. */
  onDialPastTop?: () => void;
}) {
  const [issues, setIssues] = useState<JiraIssue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const loadedFor = useRef<string | null>(null);
  const recentKeys = useRef<Set<string>>(new Set());
  // Read at load time only: a fresh worklog shouldn't reshuffle the list mid-pick.
  const recentRef = useRef(recentIssues);
  useEffect(() => {
    recentRef.current = recentIssues;
  });

  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  });

  // A refresh keeps the list and the pick on screen while it loads, and keeps the pick if it's still there.
  const load = useCallback(
    async ({ refresh = false } = {}) => {
      if (!config.jira) return;
      loadedFor.current = config.jiraJql;
      setError(null);
      if (!refresh) {
        setIssues(null);
        setProjectFilter(null);
      }
      try {
        const found = await searchIssues(config.jira, config.jiraJql);
        const keys = new Set(found.map(issue => issue.key));
        const loaded = [...found, ...recentRef.current.filter(issue => !keys.has(issue.key))];
        recentKeys.current = new Set(loaded.slice(found.length).map(issue => issue.key));
        setIssues(loaded);
        const kept = refresh ? loaded.find(issue => issue.key === selectedRef.current?.key) : undefined;
        if (refresh && !selectedRef.current && allowNone) return;
        onSelect(kept ?? defaultIssue(loaded, preferredKey));
      } catch (err) {
        setError(`Couldn't load your Jira issues: ${err instanceof JiraError ? err.message : 'unknown error'}`);
      }
    },
    [config, preferredKey, onSelect, allowNone],
  );
  const refresh = useCallback(() => load({ refresh: true }), [load]);
  const { ref: pullRef, pull, phase } = usePullToRefresh(refresh, '.issue-list', !!config.jira);

  useEffect(() => {
    if (!config.jira || loadedFor.current === config.jiraJql) return;
    void load();
  }, [config, load]);

  // Distinct project keys among the fetched issues, in first-seen order.
  const projectKeys = useMemo(() => {
    const seen = new Set<string>();
    const keys: string[] = [];
    for (const issue of issues ?? []) {
      if (!seen.has(issue.projectKey)) {
        seen.add(issue.projectKey);
        keys.push(issue.projectKey);
      }
    }
    return keys;
  }, [issues]);

  const filteredIssues = useMemo(
    () => (projectFilter ? (issues ?? []).filter(issue => issue.projectKey === projectFilter) : (issues ?? [])),
    [issues, projectFilter],
  );

  // The rows in on-screen order, for the rotary dial to step through. "No issue" goes last so the
  // accurate path (an issue) is where the dial starts.
  const pickList = useMemo<(JiraIssue | undefined)[]>(
    () => (allowNone ? [...filteredIssues, undefined] : filteredIssues),
    [filteredIssues, allowNone],
  );

  // Wheel bursts can step twice before a re-render delivers the new `selected`.
  const pendingKeyRef = useRef<{ key: string | undefined } | null>(null);
  useEffect(() => {
    pendingKeyRef.current = null;
  }, [selected]);

  const onDialStep = useCallback(
    (direction: 1 | -1) => {
      const currentKey = pendingKeyRef.current ? pendingKeyRef.current.key : selected?.key;
      if (direction === -1 && onDialPastTop && pickList.findIndex(i => i?.key === currentKey) <= 0) {
        onDialPastTop();
        return;
      }
      const next = pickList[nextDialIndex(pickList, currentKey, direction)];
      pendingKeyRef.current = { key: next?.key };
      onSelect(next);
    },
    [pickList, selected, onSelect, onDialPastTop],
  );

  // A chip that hides the selected issue moves the selection into what's still visible.
  const filterTo = (key: string | null) => {
    setProjectFilter(key);
    const visible = key ? (issues ?? []).filter(issue => issue.projectKey === key) : (issues ?? []);
    const hidden = selected ? !visible.some(issue => issue.key === selected.key) : !allowNone;
    if (hidden) onSelect(defaultIssue(visible, preferredKey));
  };
  useRotaryStep(onDialStep, dialEnabled && !!config.jira && pickList.length > 0);

  // Keep the selected row in view when the dial moves the selection off-screen.
  const selectedRowRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!config.jira) return null;

  return (
    <div className="pull-area" ref={pullRef}>
      <PullFrame pull={pull} phase={phase}>
        {error && (
          <div className="hint error">
            {error}
            <button className="retry-link" onClick={() => void load()}>
              Retry
            </button>
          </div>
        )}
        {!error && !issues && <div className="hint">Loading your Jira issues…</div>}
        {issues && issues.length === 0 && <div className="hint">No matching issues found.</div>}
        {issues && issues.length > 0 && filteredIssues.length === 0 && (
          <div className="hint">No issues in {projectFilter}.</div>
        )}
        {projectKeys.length > 1 && (
          <div className="filter-chips">
            <button className={`filter-chip ${!projectFilter ? 'selected' : ''}`} onClick={() => filterTo(null)}>
              All
            </button>
            {projectKeys.map(key => (
              <button
                key={key}
                className={`filter-chip ${projectFilter === key ? 'selected' : ''}`}
                onClick={() => filterTo(key)}
              >
                {key}
              </button>
            ))}
          </div>
        )}
        <div className="issue-list">
          {filteredIssues.map(issue => (
            <button
              key={issue.key}
              ref={selected?.key === issue.key ? selectedRowRef : undefined}
              className={`issue-row ${selected?.key === issue.key && dialEnabled ? 'selected' : ''}`}
              onClick={() => onSelect(issue)}
            >
              <span className="issue-key">{issue.key}</span>
              <span className="issue-summary">{issue.summary}</span>
              {recentKeys.current.has(issue.key) && <span className="issue-recent">Recent</span>}
            </button>
          ))}
          {allowNone && (
            <button
              ref={!selected ? selectedRowRef : undefined}
              className={`issue-row ${!selected && dialEnabled ? 'selected' : ''}`}
              onClick={() => onSelect(undefined)}
            >
              No issue, just a timer
            </button>
          )}
        </div>
      </PullFrame>
    </div>
  );
}
