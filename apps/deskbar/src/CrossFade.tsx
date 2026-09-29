import { useEffect, useRef, useState, type ReactNode } from 'react';

type AnimationState = {
  fromNode: ReactNode | null;
  toNode: ReactNode | null;
  swapped: boolean;
};

// Two halves share one grid cell, so a change blends in place; the outgoing half stays mounted for the fade.
export function CrossFade({
  contentKey,
  timeout = 400,
  children,
}: {
  contentKey: string;
  timeout?: number;
  children: ReactNode;
}) {
  const animationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationState = useRef<AnimationState>({ fromNode: null, toNode: children, swapped: false });

  const [previousContentKey, setPreviousContentKey] = useState(contentKey);
  const [previousChildren, setPreviousChildren] = useState(children);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (contentKey === previousContentKey) return;
    // Alternate which half takes the incoming content, so the outgoing half is never remounted.
    animationState.current = {
      fromNode: previousChildren,
      toNode: children,
      swapped: !animationState.current.swapped,
    };
    setAnimating(true);
    if (animationTimer.current) clearTimeout(animationTimer.current);
    animationTimer.current = setTimeout(() => setAnimating(false), timeout);
  }, [contentKey, previousContentKey, children, previousChildren, timeout]);

  useEffect(
    () => () => {
      if (animationTimer.current) clearTimeout(animationTimer.current);
    },
    [],
  );

  useEffect(() => {
    setPreviousChildren(children);
  }, [children]);

  useEffect(() => {
    setPreviousContentKey(contentKey);
  }, [contentKey]);

  const { swapped, fromNode, toNode } = animationState.current;
  // A changed key shows its fade before the effect that starts the timer has run.
  const isAnimating = animating || contentKey !== previousContentKey;
  const layer = { transition: `opacity ${timeout}ms ease-in-out` };

  return (
    <div className="cross-fade">
      <div className={`cross-fade-layer ${swapped ? 'cross-fade-in' : 'cross-fade-out'}`} style={layer}>
        {swapped ? (isAnimating ? toNode : children) : isAnimating ? fromNode : null}
      </div>
      <div className={`cross-fade-layer ${swapped ? 'cross-fade-out' : 'cross-fade-in'}`} style={layer}>
        {swapped ? (isAnimating ? fromNode : null) : isAnimating ? toNode : children}
      </div>
    </div>
  );
}
