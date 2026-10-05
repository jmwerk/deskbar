import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TuneFocus } from './TuneFocus';

const turn = (deltaX: number) =>
  act(() => {
    window.dispatchEvent(new WheelEvent('wheel', { deltaX, cancelable: true }));
  });
const pressDial = () =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
  });

describe('TuneFocus', () => {
  it('starts on the default length, snapped to the strip', () => {
    render(<TuneFocus defaultMinutes={27} enabled onTune={vi.fn()} />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '25');
  });

  it('steps five minutes per dial detent and hands the tuned length on when the dial is pressed', () => {
    const onTune = vi.fn();
    render(<TuneFocus defaultMinutes={25} enabled onTune={onTune} />);
    turn(120);
    turn(120);
    turn(-120);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '30');
    pressDial();
    expect(onTune).toHaveBeenCalledWith(30);
  });

  it('stays within 5 and 120 minutes', () => {
    render(<TuneFocus defaultMinutes={5} enabled onTune={vi.fn()} />);
    turn(-120);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '5');
  });

  it('ignores the dial while something else owns it, and a tap on the readout still works', () => {
    const onTune = vi.fn();
    render(<TuneFocus defaultMinutes={25} enabled={false} onTune={onTune} />);
    turn(120);
    pressDial();
    expect(onTune).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Set up a 25 minute focus' }));
    expect(onTune).toHaveBeenCalledWith(25);
  });
});
