import type { ReactNode } from 'react';
import { formatDuration, formatWallClock } from './format';
import { DURATION_STEPS, useKeyFlash } from './physicalControls';

/** Bound to the same physical buttons; each nudges duration by a fixed delta, not a preset. */
export function DurationHintBar({ unlimited, onStep }: { unlimited: boolean; onStep: (delta: number) => void }) {
  const pressedIndex = useKeyFlash(!unlimited);
  return (
    <div className="preset-hint">
      {DURATION_STEPS.map((delta, i) => (
        <button
          key={delta}
          className={`preset-hint-item ${pressedIndex === i ? 'pressed' : ''}`}
          disabled={unlimited}
          onClick={() => onStep(delta)}
        >
          <span className="preset-hint-label">{delta > 0 ? `+${delta}` : delta}m</span>
        </button>
      ))}
    </div>
  );
}

/** The screen's heading as one sentence, "Focus for 25 min on DESK-1", naming what Start will do. */
export function DurationSentence({
  lead,
  tail,
  minutes,
  unlimited,
  dialFocused,
  dialHint,
}: {
  lead: string;
  /** Names the issue, e.g. "on DESK-1"; omitted when there's no issue to name. */
  tail?: ReactNode;
  minutes: number;
  unlimited: boolean;
  /** True while the physical dial is currently routed to this value, not the issue list. */
  dialFocused?: boolean;
  /** How to hand the dial back, shown only while the dial is on this value. */
  dialHint?: string;
}) {
  return (
    <div className="row setup-sentence">
      <h1 className="sentence">
        {lead}{' '}
        <span className={`duration-value ${dialFocused ? 'dial-focused' : ''}`}>
          {unlimited ? 'no limit' : `${minutes} min`}
        </span>
        {tail && <> {tail}</>}
      </h1>
      {dialFocused && dialHint && <span className="dial-hint">{dialHint}</span>}
    </div>
  );
}

/** The issue as the sentence names it: its key in blue, or a muted placeholder until one is picked. */
export function SentenceIssue({ word, issueKey }: { word: string; issueKey?: string }) {
  return (
    <>
      {word}{' '}
      {issueKey ? <span className="issue-key">{issueKey}</span> : <span className="sentence-muted">an issue</span>}
    </>
  );
}

/** Home's reading carried into setup: today's total, and what it becomes once this time is logged. */
export function SetupMeta({
  lead,
  todaySeconds,
  addSeconds,
  children,
}: {
  lead?: ReactNode;
  /** Omitted when Jira isn't configured, so there's no total to read. */
  todaySeconds?: number;
  addSeconds: number;
  /** Controls that ride on the line, kept off the sentence so it never runs into the toast corner. */
  children?: ReactNode;
}) {
  return (
    <div className="focus-meta setup-meta">
      {lead && <span>{lead}</span>}
      {todaySeconds !== undefined && (
        <span>
          Today {formatDuration(todaySeconds)}
          {addSeconds > 0 && (
            <>
              {' → '}
              <strong>{formatDuration(todaySeconds + addSeconds)}</strong>
            </>
          )}
        </span>
      )}
      {children}
    </div>
  );
}

/** Stays mounted and keeps the dial where it is: the screen's pointerdown routes the dial to the duration,
    and swapping this out mid-tap would swallow the click. */
export function UnlimitedToggle({ unlimited, onToggle }: { unlimited: boolean; onToggle: () => void }) {
  return (
    <button className="btn-toggle" onPointerDown={e => e.stopPropagation()} onClick={onToggle}>
      {unlimited ? 'Set duration' : 'Unlimited'}
    </button>
  );
}

/** Setup's bottom band: Home's wall clock in the dock's spot, then Cancel and the primary action. */
export function SetupBand({
  now,
  timezone,
  onCancel,
  children,
}: {
  now: number;
  timezone?: string;
  onCancel: () => void;
  /** The primary button. */
  children: ReactNode;
}) {
  return (
    <div className="dock setup-band">
      <div className="dock-clock">{formatWallClock(now, timezone)}</div>
      <button className="btn-secondary btn-with-key" onClick={onCancel}>
        Cancel
        <span className="key-cap">Back</span>
      </button>
      {children}
    </div>
  );
}
