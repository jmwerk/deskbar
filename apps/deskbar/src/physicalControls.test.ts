import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  adjustedRunningMinutes,
  MODE_TAP_SETTLE_MS,
  useDialPress,
  useIdle,
  useKeydown,
  useModeTap,
  useRotaryStep,
} from './physicalControls';

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
  it('keeps one listener across new handlers and calls the newest, so a press is never dropped mid-swap', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ handler }) => useKeydown(handler), { initialProps: { handler: first } });
    const attached = add.mock.calls.filter(([type]) => type === 'keydown').length;
    rerender({ handler: second });
    expect(add.mock.calls.filter(([type]) => type === 'keydown').length).toBe(attached);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    add.mockRestore();
  });

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
    expect(result.current[0]).toBe(false);

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(result.current[0]).toBe(false);
  });

  it('goes idle once the timeout elapses with no activity', () => {
    const { result } = renderHook(() => useIdle(1000));

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current[0]).toBe(true);
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
    expect(result.current[0]).toBe(false); // only 900ms since the reset

    act(() => {
      window.dispatchEvent(new WheelEvent('wheel', { deltaX: 10 }));
      vi.advanceTimersByTime(1000);
    });
    expect(result.current[0]).toBe(true);
  });

  it('restarts the timer fresh on mount', () => {
    const first = renderHook(() => useIdle(1000));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(first.result.current[0]).toBe(true);
    first.unmount();

    // A fresh mount (e.g. navigating back to Home) shouldn't inherit idle.
    const second = renderHook(() => useIdle(1000));
    expect(second.result.current[0]).toBe(false);
  });

  it('sleeps on demand and wakes on the next input', () => {
    const { result } = renderHook(() => useIdle(1000));

    act(() => {
      result.current[1]();
    });
    expect(result.current[0]).toBe(true);

    act(() => {
      window.dispatchEvent(new PointerEvent('pointerdown'));
    });
    expect(result.current[0]).toBe(false);
  });
});

describe('adjustedRunningMinutes', () => {
  it('applies the delta within the usual 5-240 minute range', () => {
    expect(adjustedRunningMinutes(25, 15, 0)).toBe(40);
    expect(adjustedRunningMinutes(25, -15, 0)).toBe(10);
  });

  it('never shortens a running session to less than a minute remaining', () => {
    // 20 minutes in, a 25 minute session shortened by 15 would otherwise end immediately.
    expect(adjustedRunningMinutes(25, -15, 20 * 60)).toBe(21);
    expect(adjustedRunningMinutes(25, -15, 20 * 60 + 10)).toBe(22);
  });
});

describe('useModeTap', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // Timestamps mirror the device log: a tap is ~220ms down to up; a hold repeats every ~26ms.
  function key(type: 'keydown' | 'keyup', at: number, repeat = false) {
    const e = new KeyboardEvent(type, { key: 'm', repeat });
    Object.defineProperty(e, 'timeStamp', { value: at });
    act(() => {
      window.dispatchEvent(e);
    });
  }

  it('fires once for a lone tap, after the go-home window passes', () => {
    const onTap = vi.fn();
    const { result } = renderHook(() => useModeTap(onTap));
    key('keydown', 1000);
    key('keyup', 1220);
    expect(result.current).toBe(true);
    expect(onTap).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(MODE_TAP_SETTLE_MS));
    expect(onTap).toHaveBeenCalledOnce();
    expect(result.current).toBe(false);
  });

  it('never fires for the five-press go-home gesture', () => {
    const onTap = vi.fn();
    renderHook(() => useModeTap(onTap));
    for (let i = 0; i < 5; i++) {
      key('keydown', 1000 + i * 250);
      key('keyup', 1100 + i * 250);
      act(() => vi.advanceTimersByTime(250));
    }
    act(() => vi.advanceTimersByTime(MODE_TAP_SETTLE_MS * 2));
    expect(onTap).not.toHaveBeenCalled();
  });

  it('never fires for a hold, which autorepeats', () => {
    const onTap = vi.fn();
    renderHook(() => useModeTap(onTap));
    key('keydown', 1000);
    for (let t = 1400; t < 2300; t += 26) key('keydown', t, true);
    key('keyup', 2300);
    act(() => vi.advanceTimersByTime(MODE_TAP_SETTLE_MS * 2));
    expect(onTap).not.toHaveBeenCalled();
  });

  it('cancels a pending tap when m is pressed again', () => {
    const onTap = vi.fn();
    renderHook(() => useModeTap(onTap));
    key('keydown', 1000);
    key('keyup', 1200);
    act(() => vi.advanceTimersByTime(900));
    key('keydown', 2100);
    key('keyup', 2300);
    act(() => vi.advanceTimersByTime(MODE_TAP_SETTLE_MS * 2));
    expect(onTap).not.toHaveBeenCalled();
  });
});

describe('useDialPress', () => {
  function key(type: 'keydown' | 'keyup', k: string, repeat = false) {
    act(() => {
      window.dispatchEvent(new KeyboardEvent(type, { key: k, repeat, cancelable: true }));
    });
  }

  it('taps on release of a short press, for Enter and Space alike', () => {
    const onTap = vi.fn();
    const onHold = vi.fn();
    renderHook(() => useDialPress(onTap, onHold));
    key('keydown', 'Enter');
    expect(onTap).not.toHaveBeenCalled();
    key('keyup', 'Enter');
    key('keydown', ' ');
    key('keyup', ' ');
    expect(onTap).toHaveBeenCalledTimes(2);
    expect(onHold).not.toHaveBeenCalled();
  });

  it('holds once at the first autorepeat and swallows the release', () => {
    const onTap = vi.fn();
    const onHold = vi.fn();
    renderHook(() => useDialPress(onTap, onHold));
    key('keydown', 'Enter');
    key('keydown', 'Enter', true);
    key('keydown', 'Enter', true);
    key('keyup', 'Enter');
    expect(onHold).toHaveBeenCalledOnce();
    expect(onTap).not.toHaveBeenCalled();
  });

  it('ignores a release whose press it never saw', () => {
    const onTap = vi.fn();
    renderHook(() => useDialPress(onTap, vi.fn()));
    key('keyup', 'Enter');
    expect(onTap).not.toHaveBeenCalled();
  });
});
