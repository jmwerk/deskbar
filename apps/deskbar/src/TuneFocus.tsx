import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { clampMinutes, useDialPress, useRotaryStep } from './physicalControls';

/** Minutes per detent and per tick, so one click of the dial moves the needle exactly one tick. */
const TUNE_STEP_MIN = 5;
const TUNE_MAX_MIN = 120;
// Wide enough apart that a finger lands on one number, tight enough that an hour spans most of the strip.
const TICK_PX = 26;
// A drag shorter than this is a tap on a number, not a turn of the strip.
const DRAG_SLOP_PX = 6;

const TICKS = Array.from({ length: TUNE_MAX_MIN / TUNE_STEP_MIN }, (_, i) => (i + 1) * TUNE_STEP_MIN);

/** Snaps to the strip's 5-minute ticks, within its range. */
function tuneMinutes(minutes: number): number {
  return Math.min(TUNE_MAX_MIN, Math.max(TUNE_STEP_MIN, Math.round(minutes / TUNE_STEP_MIN) * TUNE_STEP_MIN));
}

/**
 * Home with nothing logged yet: a radio-style tuning strip under a fixed needle. The physical dial (or a drag, or a
 * tap on a number) tunes the length of a first focus session, and pressing the dial (or tapping the readout) carries
 * it into Focus Setup, where the issue is still picked so the time lands as an accurate worklog.
 */
export function TuneFocus({
  defaultMinutes,
  enabled,
  onTune,
}: {
  defaultMinutes: number;
  /** False while something else on Home owns the dial: the dimmed clock or the player. */
  enabled: boolean;
  onTune: (minutes: number) => void;
}) {
  const [minutes, setMinutes] = useState(() => tuneMinutes(clampMinutes(defaultMinutes)));
  // Bumped on every step so the needle can twitch like a detent catching.
  const [clicks, setClicks] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; from: number; moved: boolean; tapped: number | null } | null>(null);

  const tuneTo = (next: number) => {
    const snapped = tuneMinutes(next);
    if (snapped === minutes) return;
    setMinutes(snapped);
    setClicks(c => c + 1);
  };

  // The hooks call the newest callback, so each detent steps from the minutes on screen.
  useRotaryStep(dir => tuneTo(minutes + dir * TUNE_STEP_MIN), enabled);
  useDialPress(
    () => onTune(minutes),
    () => {},
    enabled,
  );

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    // Read the tick now: once the strip captures the pointer, the release reports the strip, not the tick.
    const tick = (e.target as HTMLElement).closest<HTMLElement>('[data-minutes]');
    drag.current = { x: e.clientX, from: minutes, moved: false, tapped: tick ? Number(tick.dataset.minutes) : null };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < DRAG_SLOP_PX) return;
    if (!d.moved) setDragging(true);
    d.moved = true;
    // Dragging the strip left brings later minutes under the needle, as on a real tuning dial.
    tuneTo(d.from - (dx / TICK_PX) * TUNE_STEP_MIN);
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (d && !d.moved && d.tapped !== null) tuneTo(d.tapped);
  };

  const offset = -((minutes - TUNE_STEP_MIN) / TUNE_STEP_MIN) * TICK_PX;

  return (
    <div className="tune">
      <div className="tune-copy">
        <span className="tune-title">Nothing logged yet today</span>
        <span className="tune-hint">Turn the dial to tune in a first focus, then press it.</span>
      </div>
      <button className="tune-readout" aria-label={`Set up a ${minutes} minute focus`} onClick={() => onTune(minutes)}>
        <span key={clicks} className="tune-value">
          {minutes}
        </span>
        <span className="tune-unit">min</span>
      </button>
      <div
        className={`tune-strip ${dragging ? 'tune-strip-dragging' : ''}`}
        role="slider"
        aria-label="First focus length"
        aria-valuemin={TUNE_STEP_MIN}
        aria-valuemax={TUNE_MAX_MIN}
        aria-valuenow={minutes}
        aria-valuetext={`${minutes} minutes`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="tune-scale"
          style={{ '--tune-offset': `${offset}px`, '--tick-px': `${TICK_PX}px` } as CSSProperties}
        >
          {TICKS.map(m => (
            <span
              key={m}
              data-minutes={m}
              className={`tune-tick ${m % 15 === 0 ? 'tune-tick-major' : ''} ${m === minutes ? 'tune-tick-on' : ''}`}
            >
              {m % 15 === 0 && <span className="tune-label">{m}</span>}
            </span>
          ))}
        </div>
        <span key={clicks} className="tune-needle" aria-hidden="true" />
      </div>
    </div>
  );
}
