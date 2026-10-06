import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HistoryEntry } from './history';
import { Receipt, RECEIPT_MS } from './Receipt';

const entry: HistoryEntry = {
  id: 'e1',
  issueKey: 'DESK-2',
  issueSummary: 'Test the focus timer end to end',
  seconds: 25 * 60,
  loggedAt: 0,
  worklogId: 'w1',
};

function setup(backUndoes = true) {
  const onUndo = vi.fn(() => new Promise<void>(() => {}));
  const onDismiss = vi.fn();
  render(
    <Receipt
      entry={entry}
      todaySeconds={3 * 3600 + 600}
      backUndoes={backUndoes}
      onUndo={onUndo}
      onDismiss={onDismiss}
    />,
  );
  return { onUndo, onDismiss };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Receipt', () => {
  it('says what was logged, where, and the new total for today', () => {
    setup();
    expect(screen.getByText('25m')).toBeInTheDocument();
    expect(screen.getByText('logged to DESK-2')).toBeInTheDocument();
    expect(screen.getByText('Today 3h 10m')).toBeInTheDocument();
  });

  it('dismisses itself once the undo window runs out', () => {
    const { onDismiss } = setup();
    act(() => vi.advanceTimersByTime(RECEIPT_MS));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('undoes on the physical Back button, once, and holds the window while removing', () => {
    const { onUndo, onDismiss } = setup();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onUndo).toHaveBeenCalledExactlyOnceWith(entry);
    expect(screen.getByText('Removing…')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(RECEIPT_MS * 2));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('leaves Back alone while something else on screen owns it', () => {
    const { onUndo } = setup(false);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onUndo).not.toHaveBeenCalled();
    expect(screen.queryByText('Back')).not.toBeInTheDocument();
  });
});

describe('Receipt, Done', () => {
  it('offers the configured status and moves the issue once', async () => {
    const onDone = vi.fn(() => Promise.resolve());
    render(
      <Receipt
        entry={entry}
        todaySeconds={0}
        backUndoes
        doneStatus="Done"
        onUndo={vi.fn(() => Promise.resolve())}
        onDone={onDone}
        onDismiss={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Move DESK-2 to Done'));
    await act(async () => {});
    expect(onDone).toHaveBeenCalledWith(entry, 'Done');
    expect(screen.getByText('Done ✓')).toBeInTheDocument();
  });

  it('has no Done button without a status', () => {
    setup();
    expect(screen.queryByText(/Move to/)).toBeNull();
  });
});
