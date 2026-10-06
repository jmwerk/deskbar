import { useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { formatWallClock, wallParts, type WallClock } from './format';
import { clampMinutes, useDialPress, useRotaryStep } from './physicalControls';

/** Minutes per detent, so one click of the dial grows the block by one step. */
const TUNE_STEP_MIN = 5;
// The lane spans this much of today from now, so the longest first focus fills it.
const TUNE_MAX_MIN = 120;
const QUARTER_MIN = 15;
// A press that travels less than this is a tap on the timeline, not a drag along it.
const DRAG_SLOP_PX = 6;
// Labels this close to either end would collide with "now" or run under the dial's rim.
const LABEL_MIN_FRACTION = 0.12;
// Closer than LABEL_MIN_FRACTION, a label still fits beside "now" without its AM/PM.
const SHORT_LABEL_MIN_FRACTION = 0.1;
const LABEL_MAX_FRACTION = 0.92;
// A quarter hour this close to now would read as the now mark itself.
const TICK_MIN_FRACTION = 0.06;

/** Snaps to the timeline's 5-minute steps, within its range. */
function tuneMinutes(minutes: number): number {
  return Math.min(TUNE_MAX_MIN, Math.max(TUNE_STEP_MIN, Math.round(minutes / TUNE_STEP_MIN) * TUNE_STEP_MIN));
}

type Tick = { at: number; major: boolean; label: string | null };

// "9:30 AM" -> "9:30"; chromium puts a narrow no-break space before the period, which \s matches.
const stripPeriod = (time: string) => time.replace(/\s*[ap]\.?m\.?$/i, '');

/** The wall clock's quarter hours from now to the end of the timeline, placed as fractions of its width. */
function quarterTicks(minuteStart: number, clock: Pick<WallClock, 'timeZone' | 'hour12'>): Tick[] {
  const { h, m } = wallParts(minuteStart, clock.timeZone);
  const ticks: Tick[] = [];
  // AM/PM only on the first label and where it changes, so the ruler doesn't repeat it on every half hour.
  let shownPeriod: boolean | null = null;
  for (let offset = QUARTER_MIN - (m % QUARTER_MIN); offset <= TUNE_MAX_MIN; offset += QUARTER_MIN) {
    const at = offset / TUNE_MAX_MIN;
    if (at < TICK_MIN_FRACTION) continue;
    const halfHour = (m + offset) % 30 === 0;
    let label: string | null = null;
    if (halfHour && at >= SHORT_LABEL_MIN_FRACTION && at <= LABEL_MAX_FRACTION) {
      label = formatWallClock(minuteStart + offset * 60_000, clock.timeZone, clock.hour12);
      const pm = Math.floor((h * 60 + m + offset) / 720) % 2 === 1;
      // A shortened label shows no period, so the next one still carries it.
      if (at < LABEL_MIN_FRACTION) label = stripPeriod(label);
      else {
        if (clock.hour12 && pm === shownPeriod) label = stripPeriod(label);
        shownPeriod = pm;
      }
    }
    // A half hour too near an end for its label draws as a quarter hour, so it never reads as a missing label.
    ticks.push({ at, major: label !== null, label });
  }
  return ticks;
}

/**
 * Home with nothing logged yet: the next two hours of today as a calendar lane, with the first focus as an event
 * starting now, the worklog it would become. The physical dial (or a drag, or a tap on the timeline) sets its length, and
 * pressing the dial (or tapping the readout) carries it into Focus Setup, where the issue is still picked so the time
 * lands as an accurate worklog.
 */
export function TuneFocus({
  defaultMinutes,
  enabled,
  now,
  clock,
  onTune,
}: {
  defaultMinutes: number;
  /** False while something else on Home owns the dial: the dimmed clock or the player. */
  enabled: boolean;
  now: number;
  clock: Pick<WallClock, 'timeZone' | 'hour12'>;
  onTune: (minutes: number) => void;
}) {
  const [minutes, setMinutes] = useState(() => tuneMinutes(clampMinutes(defaultMinutes)));
  // Bumped on every step so the value ticks in, like a detent catching.
  const [clicks, setClicks] = useState(0);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

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

  // The scale moves once a minute, not on every one-second tick of `now`.
  const minuteStart = Math.floor(now / 60_000) * 60_000;
  const { timeZone, hour12 } = clock;
  const ticks = useMemo(() => quarterTicks(minuteStart, { timeZone, hour12 }), [minuteStart, timeZone, hour12]);
  const until = formatWallClock(now + minutes * 60_000, clock.timeZone, clock.hour12);

  const tuneToPointer = (el: HTMLElement, clientX: number) => {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    tuneTo(((clientX - rect.left) / rect.width) * TUNE_MAX_MIN);
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.abs(e.clientX - d.x) < DRAG_SLOP_PX) return;
    d.moved = true;
    tuneToPointer(e.currentTarget, e.clientX);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    // A downward pull that started here is a pull to refresh, not a tap.
    const still = d && !d.moved && Math.abs(e.clientY - d.y) < DRAG_SLOP_PX;
    if (still) tuneToPointer(e.currentTarget, e.clientX);
  };
  const onPointerCancel = () => {
    drag.current = null;
  };

  return (
    <div className="tune">
      <span className="tune-hint">Turn the dial to plan your first focus, then press it.</span>
      <button className="tune-readout" aria-label={`Set up a ${minutes} minute focus`} onClick={() => onTune(minutes)}>
        <span key={clicks} className="tune-value">
          {minutes}
        </span>
        <span className="tune-unit">min</span>
        <span className="tune-until">
          until <span className="tune-until-time">{until}</span>
        </span>
      </button>
      <div
        className="tune-track"
        role="slider"
        aria-label="First focus length"
        aria-valuemin={TUNE_STEP_MIN}
        aria-valuemax={TUNE_MAX_MIN}
        aria-valuenow={minutes}
        aria-valuetext={`${minutes} minutes, until ${until}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {ticks.map(t => (
          <span
            key={t.at}
            className={`tune-tick ${t.major ? 'tune-tick-major' : ''}`}
            style={{ left: `${t.at * 100}%` }}
          >
            {t.label && <span className="tune-label">{t.label}</span>}
          </span>
        ))}
        <span className="tune-now">now</span>
        <div className="tune-event-clip" style={{ '--tune-fraction': minutes / TUNE_MAX_MIN } as CSSProperties}>
          <div className="tune-event-halo" />
          <div className="tune-event">
            <div className="tune-event-body" />
            <div className="tune-event-end" />
          </div>
        </div>
      </div>
    </div>
  );
}
