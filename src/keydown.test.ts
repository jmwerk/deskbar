import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeydown } from './App';

function press(key: string, repeat = false) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, repeat, cancelable: true }));
}

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
