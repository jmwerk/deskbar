import { PRESET_MINUTES } from './physicalControls';

/**
 * Flush against the screen's true top edge, lined up with the physical
 * preset buttons above it — the same treatment as Home's button-hint,
 * since these presets are bound to the exact same buttons. No
 * color-coding here though: unlike a status, a duration has no tile to
 * match, so "selected" is the only state that needs a color.
 */
export function PresetHint({ minutes, onChange }: { minutes: number; onChange: (minutes: number) => void }) {
  return (
    <div className="preset-hint">
      {PRESET_MINUTES.map((p, i) => (
        <button key={p} className={`preset-hint-item ${minutes === p ? 'selected' : ''}`} onClick={() => onChange(p)}>
          <span className="preset-hint-num">{i + 1}</span>
          <span className="preset-hint-label">{p}m</span>
        </button>
      ))}
    </div>
  );
}

export function DurationRow({ minutes, onChange }: { minutes: number; onChange: (minutes: number) => void }) {
  return (
    <div className="row">
      <label>Duration</label>
      <div className="stepper">
        <button onClick={() => onChange(Math.max(5, minutes - 5))}>−</button>
        <span>{minutes} min</span>
        <button onClick={() => onChange(Math.min(240, minutes + 5))}>+</button>
      </div>
    </div>
  );
}
