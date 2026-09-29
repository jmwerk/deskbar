import { useLayoutEffect, useRef, useState } from 'react';

// Hold, scroll one pass, wrap onto a second copy; the hold is a keyframe so it repeats every pass.
const MARQUEE_GAP = 48;
const MARQUEE_SPEED = 40;
const MARQUEE_HOLD = 1;

/** One line of text that sits still unless it outgrows its box, then runs as a seamless ticker. */
export function Marquee({ text, className = '' }: { text: string; className?: string }) {
  const viewport = useRef<HTMLSpanElement>(null);
  const track = useRef<HTMLSpanElement>(null);
  const copy = useRef<HTMLSpanElement>(null);
  const [scrolling, setScrolling] = useState(false);

  useLayoutEffect(() => {
    const vp = viewport.current;
    const el = track.current;
    const one = copy.current;
    // jsdom has neither the Web Animations API nor ResizeObserver.
    if (!vp || !el || !one || typeof el.animate !== 'function' || typeof ResizeObserver === 'undefined') return;
    let pass: Animation | null = null;
    const apply = () => {
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const width = one.offsetWidth;
      const over = !still && width > vp.clientWidth;
      setScrolling(over);
      pass?.cancel();
      pass = null;
      if (!over) return;
      const scroll = (width + MARQUEE_GAP) / MARQUEE_SPEED;
      pass = el.animate(
        [
          { transform: 'translateX(0)', offset: 0 },
          { transform: 'translateX(0)', offset: MARQUEE_HOLD / (MARQUEE_HOLD + scroll) },
          { transform: `translateX(-${width + MARQUEE_GAP}px)`, offset: 1 },
        ],
        { duration: (MARQUEE_HOLD + scroll) * 1000, iterations: Infinity },
      );
    };
    apply();
    const seen = new ResizeObserver(apply);
    seen.observe(one);
    seen.observe(vp);
    return () => {
      seen.disconnect();
      pass?.cancel();
    };
  }, [text]);

  return (
    <span ref={viewport} className={`marquee ${className}`}>
      <span ref={track} key={text} className="marquee-track">
        <span ref={copy} className="marquee-copy" style={{ marginRight: MARQUEE_GAP }}>
          {text}
        </span>
        {scrolling && (
          <span aria-hidden className="marquee-copy" style={{ marginRight: MARQUEE_GAP }}>
            {text}
          </span>
        )}
      </span>
    </span>
  );
}
