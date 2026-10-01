import { useCallback, useEffect, useRef, useState } from 'react';

// Car Thing controls bypass bridgething client: keydown 1-4/m/Escape, wheel deltaX for dial.
// Minute deltas the 4 buttons apply to a duration: coarse-to-fine, decrement then increment.
export const DURATION_STEPS = [-15, -5, 5, 15] as const;

const MIN_DURATION_MINUTES = 5;
const MAX_DURATION_MINUTES = 240;

export function clampMinutes(minutes: number): number {
  return Math.min(MAX_DURATION_MINUTES, Math.max(MIN_DURATION_MINUTES, minutes));
}

// Nudging a running session always leaves at least a minute: a preset press should never end it.
export function adjustedRunningMinutes(currentMinutes: number, deltaMinutes: number, elapsedS: number): number {
  return Math.max(clampMinutes(currentMinutes + deltaMinutes), Math.ceil(elapsedS / 60) + 1);
}

/** How long Home sits untouched before the idle screensaver takes over. */
export const HOME_IDLE_TIMEOUT_MS = 3 * 60_000;

// Keydown listener scoped to the mounted screen; ignores key-repeat, centralizes listener setup.
export function useKeydown(onKeyDown: (e: KeyboardEvent) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      onKeyDown(e);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onKeyDown, enabled]);
}

// True after timeoutMs of no input events; resets on any, restarting fresh on every mount.
// sleepNow goes idle immediately, and the next input wakes it like a timed-out idle would.
export function useIdle(timeoutMs: number): [idle: boolean, sleepNow: () => void] {
  const [idle, setIdle] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    const reset = () => {
      setIdle(false);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setIdle(true), timeoutMs);
    };
    reset();
    window.addEventListener('keydown', reset);
    window.addEventListener('wheel', reset);
    window.addEventListener('pointerdown', reset);
    return () => {
      clearTimeout(timerRef.current);
      window.removeEventListener('keydown', reset);
      window.removeEventListener('wheel', reset);
      window.removeEventListener('pointerdown', reset);
    };
  }, [timeoutMs]);
  const sleepNow = useCallback(() => {
    clearTimeout(timerRef.current);
    setIdle(true);
  }, []);
  return [idle, sleepNow];
}

// The daemon goes home on 5 m presses within 1.5s or on a hold; a hold autorepeats ~400ms in.
const MODE_TAP_MAX_MS = 350;
export const MODE_TAP_SETTLE_MS = 1500;

/**
 * Fires onTap for one deliberate m tap, never for the daemon's go-home gestures: it waits out the
 * daemon's window, and any repeat, long press, or further m press inside it cancels. True while
 * waiting, so the screen can show the tap was heard.
 */
export function useModeTap(onTap: () => void, enabled = true): boolean {
  const [pending, setPending] = useState(false);
  const onTapRef = useRef(onTap);
  useEffect(() => {
    onTapRef.current = onTap;
  }, [onTap]);

  useEffect(() => {
    if (!enabled) return;
    let downAt: number | null = null;
    let prevDownAt = -Infinity;
    let repeated = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => {
      clearTimeout(timer);
      timer = undefined;
      setPending(false);
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.key !== 'm') return;
      if (e.repeat) {
        repeated = true;
        return;
      }
      cancel();
      prevDownAt = downAt ?? prevDownAt;
      downAt = e.timeStamp;
      repeated = false;
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key !== 'm' || downAt === null) return;
      const short = e.timeStamp - downAt <= MODE_TAP_MAX_MS;
      const alone = downAt - prevDownAt > MODE_TAP_SETTLE_MS;
      if (repeated || !short || !alone) return;
      setPending(true);
      timer = setTimeout(() => {
        timer = undefined;
        setPending(false);
        onTapRef.current();
      }, MODE_TAP_SETTLE_MS);
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      cancel();
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [enabled]);

  return pending;
}

const HINT_KEYS = ['1', '2', '3', '4'];

// Index of the pressed hint key, held flashMs to flash the hint, so a quick tap still shows.
export function useKeyFlash(enabled = true, flashMs = 180): number | null {
  const [pressed, setPressed] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    const handler = (e: KeyboardEvent) => {
      const index = HINT_KEYS.indexOf(e.key);
      if (index === -1) return;
      setPressed(index);
      clearTimeout(timer);
      timer = setTimeout(() => setPressed(null), flashMs);
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      clearTimeout(timer);
    };
  }, [enabled, flashMs]);
  return pressed;
}

// Rotary wheel events arrive as a burst of small deltas per detent; accumulate then step.
export function useRotaryStep(onStep: (direction: 1 | -1) => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let accum = 0;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      accum += e.deltaX;
      if (Math.abs(accum) < 100) return;
      onStep(accum > 0 ? 1 : -1);
      accum = 0;
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [onStep, enabled]);
}
