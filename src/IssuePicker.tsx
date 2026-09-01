import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Config } from './config';
import { searchIssues, JiraError, type JiraIssue } from './jira';
import { useRotaryStep } from './physicalControls';

/**
 * Fetches and lists Jira issues for `config.jiraJql`, with dial-scroll,
 * touch selection, and (when results span more than one project) tap-to-
 * filter project chips. `allowNone` adds a "No issue" row at the top (Focus
 * Setup can run as a plain timer; Log Time Now always needs an issue).
 * Shared so the fetch/dial/auto-scroll logic isn't duplicated per screen.
 */
export function IssuePicker({
  config,
  selected,
  onSelect,
  allowNone = true,
  dialEnabled = true,
}: {
  config: Config;
  selected: JiraIssue | undefined;
  onSelect: (issue: JiraIssue | undefined) => void;
  allowNone?: boolean;
  /** Screens with their own dial-controlled value (e.g. a duration) pass
   *  this so only one thing on screen responds to a given dial turn. */
  dialEnabled?: boolean;
}) {
  const [issues, setIssues] = useState<JiraIssue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const loadedFor = useRef<string | null>(null);

  const load = useCallback(() => {
    if (!config.jira) return;
    loadedFor.current = config.jiraJql;
    setError(null);
    setIssues(null);
    setProjectFilter(null);
    searchIssues(config.jira, config.jiraJql)
      .then(setIssues)
      .catch(err => setError(err instanceof JiraError ? err.message : 'Could not load Jira issues'));
  }, [config]);

  useEffect(() => {
    if (!config.jira || loadedFor.current === config.jiraJql) return;
    load();
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

  // The rows in on-screen order, for the rotary dial to step through.
  const pickList = useMemo<(JiraIssue | undefined)[]>(
    () => (allowNone ? [undefined, ...filteredIssues] : filteredIssues),
    [filteredIssues, allowNone],
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
  useRotaryStep(onDialStep, dialEnabled && !!config.jira && pickList.length > 0);

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
      {issues && issues.length > 0 && filteredIssues.length === 0 && (
        <div className="hint">No issues in {projectFilter}.</div>
      )}
      {projectKeys.length > 1 && (
        <div className="filter-chips">
          <button className={`filter-chip ${!projectFilter ? 'selected' : ''}`} onClick={() => setProjectFilter(null)}>
            All
          </button>
          {projectKeys.map(key => (
            <button
              key={key}
              className={`filter-chip ${projectFilter === key ? 'selected' : ''}`}
              onClick={() => setProjectFilter(key)}
            >
              {key}
            </button>
          ))}
        </div>
      )}
      <div className="issue-list">
        {allowNone && (
          <button
            ref={!selected ? selectedRowRef : undefined}
            className={`issue-row ${!selected && dialEnabled ? 'selected' : ''}`}
            onClick={() => onSelect(undefined)}
          >
            No issue — just a timer
          </button>
        )}
        {filteredIssues.map(issue => (
          <button
            key={issue.key}
            ref={selected?.key === issue.key ? selectedRowRef : undefined}
            className={`issue-row ${selected?.key === issue.key && dialEnabled ? 'selected' : ''}`}
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
