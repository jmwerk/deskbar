import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRotaryStep } from './App';

function wheel(deltaX: number, deltaY = 0) {
  window.dispatchEvent(new WheelEvent('wheel', { deltaX, deltaY, cancelable: true }));
}

describe('useRotaryStep', () => {
  it('does nothing until the accumulated horizontal delta crosses the threshold', () => {
    const onStep = vi.fn();
    renderHook(() => useRotaryStep(onStep, true));

    wheel(40);
    wheel(40);
    expect(onStep).not.toHaveBeenCalled();

    wheel(40); // 120 total, crosses the threshold
    expect(onStep).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('steps -1 for a leftward (negative deltaX) rotation', () => {
    const onStep = vi.fn();
    renderHook(() => useRotaryStep(onStep, true));

    wheel(-150);
    expect(onStep).toHaveBeenCalledExactlyOnceWith(-1);
  });

  it('ignores wheel events where vertical delta dominates', () => {
    const onStep = vi.fn();
    renderHook(() => useRotaryStep(onStep, true));

    wheel(150, 200);
    expect(onStep).not.toHaveBeenCalled();
  });

  it('resets its accumulator after firing a step', () => {
    const onStep = vi.fn();
    renderHook(() => useRotaryStep(onStep, true));

    wheel(150); // fires once
    wheel(40); // should not immediately fire again
    expect(onStep).toHaveBeenCalledTimes(1);
  });

  it('does not listen at all when disabled', () => {
    const onStep = vi.fn();
    renderHook(() => useRotaryStep(onStep, false));

    wheel(200);
    expect(onStep).not.toHaveBeenCalled();
  });
});
