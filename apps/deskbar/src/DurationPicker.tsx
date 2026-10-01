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

/** The screen's heading as one sentence, "Focus for 25 min on", leading into the issue list below. */
export function DurationSentence({
  lead,
  tail,
  minutes,
  unlimited,
  allowUnlimited,
  onToggleUnlimited,
  dialFocused,
  dialHint,
}: {
  lead: string;
  /** Omitted when there's no issue list for the sentence to lead into. */
  tail?: string;
  minutes: number;
  unlimited: boolean;
  allowUnlimited?: boolean;
  onToggleUnlimited?: () => void;
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
        {tail && ` ${tail}`}
      </h1>
      {allowUnlimited && (
        // Stays mounted and keeps the dial where it is: the screen's pointerdown routes the dial to the
        // duration, and swapping this out mid-tap would swallow the click.
        <button className="btn-toggle" onPointerDown={e => e.stopPropagation()} onClick={onToggleUnlimited}>
          {unlimited ? 'Set duration' : 'Unlimited'}
        </button>
      )}
      {dialFocused && dialHint && <span className="dial-hint">{dialHint}</span>}
    </div>
  );
}
