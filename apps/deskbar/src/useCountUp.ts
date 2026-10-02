import { useEffect, useRef, useState } from 'react';

const COUNT_UP_MS = 900;

// Rises toward `value` so a new worklog visibly lands; drops (undo, delete) and reduced motion snap.
export function useCountUp(value: number): number {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);

  useEffect(() => {
    const from = shownRef.current;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (value <= from || reduced) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function step(t) {
      const progress = Math.min(1, (t - start) / COUNT_UP_MS);
      const eased = 1 - Math.pow(2, -10 * progress);
      shownRef.current = from + (value - from) * (progress === 1 ? 1 : eased);
      setShown(shownRef.current);
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return shown;
}
