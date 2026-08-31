import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeydown, useRotaryStep } from './physicalControls';

function wheel(deltaX: number, deltaY = 0) {
  window.dispatchEvent(new WheelEvent('wheel', { deltaX, deltaY, cancelable: true }));
}

function press(key: string, repeat = false) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, repeat, cancelable: true }));
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

describe('useKeydown', () => {
  it('calls the handler on a keydown', () => {
    const onKeyDown = vi.fn();
    renderHook(() => useKeydown(onKeyDown));

    press('1');
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onKeyDown.mock.calls[0][0].key).toBe('1');
  });

  it('ignores key-repeat events', () => {
    const onKeyDown = vi.fn();
    renderHook(() => useKeydown(onKeyDown));

    press('1', true);
    expect(onKeyDown).not.toHaveBeenCalled();
  });

  it('does not listen when disabled', () => {
    const onKeyDown = vi.fn();
    renderHook(() => useKeydown(onKeyDown, false));

    press('1');
    expect(onKeyDown).not.toHaveBeenCalled();
  });

  it('stops listening after unmount', () => {
    const onKeyDown = vi.fn();
    const { unmount } = renderHook(() => useKeydown(onKeyDown));

    unmount();
    press('1');
    expect(onKeyDown).not.toHaveBeenCalled();
  });
});
