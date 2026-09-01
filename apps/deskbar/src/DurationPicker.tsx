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

export function DurationRow({
  minutes,
  unlimited,
  allowUnlimited,
  onToggleUnlimited,
  dialFocused,
}: {
  minutes: number;
  unlimited: boolean;
  allowUnlimited?: boolean;
  onToggleUnlimited?: () => void;
  /** True while the physical dial is currently routed to this value, not the issue list. */
  dialFocused?: boolean;
}) {
  return (
    <div className="row">
      <label>Duration</label>
      <span className={`duration-value ${dialFocused ? 'dial-focused' : ''}`}>
        {unlimited ? 'Unlimited' : `${minutes} min`}
      </span>
      {allowUnlimited && (
        <button className="btn-toggle" onClick={onToggleUnlimited}>
          {unlimited ? 'Set duration' : 'Unlimited'}
        </button>
      )}
    </div>
  );
}
