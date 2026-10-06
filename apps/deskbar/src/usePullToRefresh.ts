import { useCallback, useEffect, useRef, useState } from 'react';

/** How far the content moves before letting go refreshes; the finger travels about twice this. */
export const PULL_THRESHOLD_PX = 56;
const PULL_MAX_PX = 88;
// Finger travel before a press counts as a pull, so a tap on a row still lands as a tap.
const PULL_SLOP_PX = 10;
// A refresh that answers instantly still shows its spinner long enough to read as having happened.
const MIN_REFRESH_MS = 450;

export type PullPhase = 'idle' | 'pulling' | 'armed' | 'refreshing';

/** Content moves at half the finger's speed, as native pull-to-refresh does. */
export function pullDistance(fingerDy: number): number {
  if (fingerDy <= PULL_SLOP_PX) return 0;
  return Math.min(PULL_MAX_PX, (fingerDy - PULL_SLOP_PX) / 2);
}

/**
 * Pull-to-refresh on a column whose list scrolls inside it: a downward drag that starts while the list
 * (the first element matching `scrollSelector`, or nothing) is at its top moves the content down, and
 * letting go past the threshold runs `onRefresh`. Touch drives it on the device; mouse drags work too.
 */
export function usePullToRefresh(onRefresh: () => Promise<unknown>, scrollSelector: string, enabled = true) {
  const ref = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState(0);
  const [phase, setPhase] = useState<PullPhase>('idle');
  const refreshRef = useRef(onRefresh);
  useEffect(() => {
    refreshRef.current = onRefresh;
  });
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  });

  const finish = useCallback(async (distance: number) => {
    if (distance < PULL_THRESHOLD_PX) {
      setPull(0);
      setPhase('idle');
      return;
    }
    setPull(PULL_THRESHOLD_PX);
    setPhase('refreshing');
    const started = Date.now();
    try {
      await refreshRef.current();
    } catch {
      // The caller reports its own failures; the gesture only has to end.
    }
    await new Promise(resolve => setTimeout(resolve, Math.max(0, MIN_REFRESH_MS - (Date.now() - started))));
    setPull(0);
    setPhase('idle');
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let start: { x: number; y: number } | null = null;
    let distance = 0;
    let dragging = false;
    let suppressClick = false;

    const atTop = () => (el.querySelector(scrollSelector)?.scrollTop ?? 0) <= 0;
    const begin = (x: number, y: number) => {
      start = phaseRef.current === 'refreshing' || !atTop() ? null : { x, y };
      distance = 0;
      dragging = false;
    };
    // Returns true while this gesture is a pull, so the caller can stop the list scrolling under it.
    const move = (x: number, y: number): boolean => {
      if (!start) return false;
      const dy = y - start.y;
      if (!dragging) {
        if (dy <= PULL_SLOP_PX || Math.abs(dy) < Math.abs(x - start.x)) {
          if (dy < 0 || Math.abs(x - start.x) > PULL_SLOP_PX) start = null;
          return false;
        }
        dragging = true;
        suppressClick = true;
      }
      distance = pullDistance(dy);
      setPull(distance);
      setPhase(distance >= PULL_THRESHOLD_PX ? 'armed' : 'pulling');
      return true;
    };
    const end = () => {
      if (dragging) void finish(distance);
      start = null;
      dragging = false;
    };

    const onTouchStart = (e: TouchEvent) => begin(e.touches[0].clientX, e.touches[0].clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (move(e.touches[0].clientX, e.touches[0].clientY) && e.cancelable) e.preventDefault();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      begin(e.clientX, e.clientY);
      const onMouseMove = (m: MouseEvent) => void move(m.clientX, m.clientY);
      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        end();
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };
    // A pull that started on a row must not also open or select it when the finger lifts.
    const onClick = (e: MouseEvent) => {
      if (!suppressClick) return;
      suppressClick = false;
      e.stopPropagation();
      e.preventDefault();
    };
    const onPointerDown = () => {
      suppressClick = false;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('pointerdown', onPointerDown, true);
    el.addEventListener('click', onClick, true);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('pointerdown', onPointerDown, true);
      el.removeEventListener('click', onClick, true);
    };
  }, [enabled, scrollSelector, finish]);

  return { ref, pull, phase };
}
