import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PullFrame } from './PullToRefresh';
import { pullDistance, PULL_THRESHOLD_PX, usePullToRefresh } from './usePullToRefresh';

function Harness({ onRefresh, onRowClick }: { onRefresh: () => Promise<void>; onRowClick: () => void }) {
  const { ref, pull, phase } = usePullToRefresh(onRefresh, '.list');
  return (
    <div ref={ref} data-testid="area">
      <PullFrame pull={pull} phase={phase}>
        <div className="list">
          <button onClick={onRowClick}>Row</button>
        </div>
      </PullFrame>
    </div>
  );
}

// Finger travel past the slop that moves the content `px` down.
const travelFor = (px: number) => 10 + px * 2;

function drag(target: Element, dy: number) {
  fireEvent.pointerDown(target);
  fireEvent.mouseDown(target, { clientX: 100, clientY: 100, button: 0 });
  fireEvent.mouseMove(window, { clientX: 100, clientY: 100 + dy });
  return () => {
    fireEvent.mouseUp(window, { clientX: 100, clientY: 100 + dy });
    fireEvent.click(target);
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('pullDistance', () => {
  it('ignores the slop, then moves at half the finger and stops at the max', () => {
    expect(pullDistance(8)).toBe(0);
    expect(pullDistance(travelFor(20))).toBe(20);
    expect(pullDistance(1000)).toBe(88);
  });
});

describe('usePullToRefresh', () => {
  it('refreshes when let go past the threshold, without also clicking the row it started on', async () => {
    const onRefresh = vi.fn(() => Promise.resolve());
    const onRowClick = vi.fn();
    render(<Harness onRefresh={onRefresh} onRowClick={onRowClick} />);
    const release = drag(screen.getByText('Row'), travelFor(PULL_THRESHOLD_PX + 4));
    expect(screen.getByRole('status')).toHaveTextContent('Release to refresh');
    release();
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(onRowClick).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Refreshing…');
    await act(async () => vi.advanceTimersByTimeAsync(500));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('springs back without refreshing when let go short of the threshold', async () => {
    const onRefresh = vi.fn(() => Promise.resolve());
    render(<Harness onRefresh={onRefresh} onRowClick={vi.fn()} />);
    const release = drag(screen.getByText('Row'), travelFor(20));
    expect(screen.getByRole('status')).toHaveTextContent('Pull to refresh');
    release();
    expect(onRefresh).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('does nothing when the list is scrolled down, and leaves taps alone', () => {
    const onRefresh = vi.fn(() => Promise.resolve());
    const onRowClick = vi.fn();
    render(<Harness onRefresh={onRefresh} onRowClick={onRowClick} />);
    const list = document.querySelector('.list')!;
    list.scrollTop = 40;
    drag(screen.getByText('Row'), travelFor(PULL_THRESHOLD_PX + 4))();
    expect(onRefresh).not.toHaveBeenCalled();
    onRowClick.mockClear();
    list.scrollTop = 0;
    fireEvent.pointerDown(screen.getByText('Row'));
    fireEvent.click(screen.getByText('Row'));
    expect(onRowClick).toHaveBeenCalledOnce();
  });
});
