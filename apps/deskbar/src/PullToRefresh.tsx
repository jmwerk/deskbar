import type { CSSProperties, ReactNode } from 'react';
import { RefreshIcon } from './icons';
import { PULL_THRESHOLD_PX, type PullPhase } from './usePullToRefresh';

const PHASE_LABEL: Record<Exclude<PullPhase, 'idle'>, string> = {
  pulling: 'Pull to refresh',
  armed: 'Release to refresh',
  refreshing: 'Refreshing…',
};

/** The strip the content uncovers as it moves down, and the content itself, shifted by `pull`. */
export function PullFrame({ pull, phase, children }: { pull: number; phase: PullPhase; children: ReactNode }) {
  const settling = phase === 'idle' || phase === 'refreshing';
  const shift: CSSProperties = { transform: pull ? `translateY(${pull}px)` : undefined };
  return (
    <>
      {phase !== 'idle' && (
        <div className="pull-indicator" style={{ height: pull }} role="status">
          <span
            className={`pull-icon ${phase === 'refreshing' ? 'pull-icon-spinning' : ''}`}
            style={phase === 'refreshing' ? undefined : { transform: `rotate(${(pull / PULL_THRESHOLD_PX) * 270}deg)` }}
            aria-hidden="true"
          >
            <RefreshIcon size={18} />
          </span>
          {PHASE_LABEL[phase]}
        </div>
      )}
      <div className={`pull-content ${settling ? 'pull-content-settling' : ''}`} style={shift}>
        {children}
      </div>
    </>
  );
}
