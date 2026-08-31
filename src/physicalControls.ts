import { useEffect } from 'react';

/**
 * The Car Thing's physical controls never reach `@bridgething/client` — the
 * kiosk delivers them straight to the page as plain DOM events: preset
 * buttons 1-4 as `keydown` "1".."4", the Mode button as "m", Back as
 * "Escape", and the rotary dial as `wheel` with horizontal `deltaX`.
 */
export const PRESET_MINUTES = [15, 25, 45, 60];
export const PRESET_LABELS = ['①', '②', '③', '④'];

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
