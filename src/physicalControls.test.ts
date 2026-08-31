import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useIdle, useKeydown, useRotaryStep } from './physicalControls';

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

describe('useIdle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts not-idle and stays that way before the timeout elapses', () => {
    const { result } = renderHook(() => useIdle(1000));
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(result.current).toBe(false);
  });

  it('goes idle once the timeout elapses with no activity', () => {
    const { result } = renderHook(() => useIdle(1000));

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(true);
  });

  it('resets on a keydown, wheel, or pointerdown', () => {
    const { result } = renderHook(() => useIdle(1000));

    act(() => {
      vi.advanceTimersByTime(900);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
    });
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(result.current).toBe(false); // only 900ms since the reset

    act(() => {
      window.dispatchEvent(new WheelEvent('wheel', { deltaX: 10 }));
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(true);
  });

  it('restarts the timer fresh on mount', () => {
    const first = renderHook(() => useIdle(1000));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(first.result.current).toBe(true);
    first.unmount();

    // A fresh mount (e.g. navigating back to Home) shouldn't inherit idle.
    const second = renderHook(() => useIdle(1000));
    expect(second.result.current).toBe(false);
  });
});
