import { useEffect, useState } from 'react';

// Car Thing controls bypass bridgething client: keydown 1-4/m/Escape, wheel deltaX for dial.
// Minute deltas the 4 buttons apply to a duration: coarse-to-fine, decrement then increment.
export const DURATION_STEPS = [-15, -5, 5, 15] as const;

const MIN_DURATION_MINUTES = 5;
const MAX_DURATION_MINUTES = 240;

export function clampMinutes(minutes: number): number {
  return Math.min(MAX_DURATION_MINUTES, Math.max(MIN_DURATION_MINUTES, minutes));
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
export function useIdle(timeoutMs: number): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), timeoutMs);
    };
    reset();
    window.addEventListener('keydown', reset);
    window.addEventListener('wheel', reset);
    window.addEventListener('pointerdown', reset);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', reset);
      window.removeEventListener('wheel', reset);
      window.removeEventListener('pointerdown', reset);
    };
  }, [timeoutMs]);
  return idle;
}

const HINT_KEYS = ['1', '2', '3', '4'];

// Index of the pressed hint key, held flashMs to flash the hint; auto-clears (no keyup confirmed).
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
