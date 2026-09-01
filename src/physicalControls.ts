import { useEffect, useState } from 'react';

/**
 * The Car Thing's physical controls never reach `@bridgething/client` — the
 * kiosk delivers them straight to the page as plain DOM events: preset
 * buttons 1-4 as `keydown` "1".."4", the Mode button as "m", Back as
 * "Escape", and the rotary dial as `wheel` with horizontal `deltaX`.
 */
export const PRESET_MINUTES = [15, 25, 45, 60];

/** How long Home sits untouched before the idle screensaver takes over. */
export const HOME_IDLE_TIMEOUT_MS = 3 * 60_000;

/**
 * Scopes a keydown listener to the mounted screen and ignores key-repeat
 * (holding a button shouldn't repeat-fire whatever it's bound to). Each
 * screen's handler still owns its own key-to-action mapping and
 * `preventDefault` calls — this only centralizes the addEventListener/
 * removeEventListener/repeat-guard boilerplate every screen was repeating.
 */
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

/**
 * True once no keydown/wheel/pointerdown has happened for `timeoutMs`,
 * resetting on any of them — including the one that "wakes" it, so the
 * screen just tracks its own activity rather than needing every caller to
 * remember to report it. Scoped to whichever screen mounts it (Home, for
 * the idle screensaver): the timer restarts fresh each time that screen
 * mounts, so returning to it doesn't immediately show as idle.
 */
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

/** Rotary wheel events arrive as a burst of small deltas per detent; accumulate and step. */
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
