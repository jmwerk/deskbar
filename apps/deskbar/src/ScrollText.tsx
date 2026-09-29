import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

// Pixels per second while the text is moving; the pauses at either end are part of the keyframes.
const SCROLL_SPEED = 45;
// Share of each cycle spent moving (the rest is the two end pauses), mirrored in the keyframes.
const MOVING_SHARE = 0.7;

/** One line of text that pans to its end and back when it doesn't fit, and sits still when it does. */
export function ScrollText({ text, className = '' }: { text: string; className?: string }) {
  const outer = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [overflowPx, setOverflowPx] = useState(0);

  useLayoutEffect(() => {
    const box = outer.current;
    const line = inner.current;
    if (!box || !line) return;
    const measure = () => setOverflowPx(Math.max(0, Math.ceil(line.scrollWidth - box.clientWidth)));
    measure();
    // jsdom has no ResizeObserver; the one measurement above is enough there.
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(line);
    return () => observer.disconnect();
  }, [text]);

  const moving = overflowPx > 0;
  const style = moving
    ? ({
        '--scroll-shift': `-${overflowPx}px`,
        '--scroll-duration': `${((2 * overflowPx) / SCROLL_SPEED / MOVING_SHARE).toFixed(2)}s`,
      } as CSSProperties)
    : undefined;

  return (
    <span ref={outer} className={`scroll-text ${moving ? 'scroll-text-moving' : ''} ${className}`}>
      <span ref={inner} key={text} className="scroll-text-line" style={style}>
        {text}
      </span>
    </span>
  );
}
