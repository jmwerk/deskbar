import { DURATION_STEPS, useKeyFlash } from './physicalControls';

/**
 * Flush against the screen's true top edge, lined up with the physical
 * preset buttons above it — the same treatment as Home's button-hint,
 * since these buttons are bound to the exact same physical buttons. Each
 * one nudges the duration by a fixed delta (coarse-to-fine, decrement then
 * increment) rather than jumping to an absolute preset, so the on-screen
 * buttons and the hardware buttons above them always do the same thing.
 */
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
