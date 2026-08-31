import { PRESET_MINUTES, PRESET_LABELS } from './physicalControls';

export function DurationPicker({ minutes, onChange }: { minutes: number; onChange: (minutes: number) => void }) {
  return (
    <div className="row">
      <label>Duration</label>
      <div className="presets">
        {PRESET_MINUTES.map((p, i) => (
          <button key={p} className={`preset-chip ${minutes === p ? 'selected' : ''}`} onClick={() => onChange(p)}>
            {PRESET_LABELS[i]}
            {p}m
          </button>
        ))}
      </div>
      <div className="stepper">
        <button onClick={() => onChange(Math.max(5, minutes - 5))}>−</button>
        <span>{minutes} min</span>
        <button onClick={() => onChange(Math.min(240, minutes + 5))}>+</button>
      </div>
    </div>
  );
}
