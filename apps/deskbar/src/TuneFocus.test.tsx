import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TuneFocus } from './TuneFocus';

const turn = (deltaX: number) =>
  act(() => {
    window.dispatchEvent(new WheelEvent('wheel', { deltaX, cancelable: true }));
  });
// 9:50 on a fixed day, in UTC so the wall clock reads the same everywhere.
const NOW = Date.UTC(2026, 9, 6, 9, 50);
const CLOCK = { timeZone: 'UTC', hour12: false };

const pressDial = () =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
  });

describe('TuneFocus', () => {
  it('starts on the default length, snapped to a step', () => {
    render(<TuneFocus defaultMinutes={27} enabled now={NOW} clock={CLOCK} onTune={vi.fn()} />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '25');
  });

  it('steps five minutes per dial detent and hands the tuned length on when the dial is pressed', () => {
    const onTune = vi.fn();
    render(<TuneFocus defaultMinutes={25} enabled now={NOW} clock={CLOCK} onTune={onTune} />);
    turn(120);
    turn(120);
    turn(-120);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '30');
    pressDial();
    expect(onTune).toHaveBeenCalledWith(30);
  });

  it('stays within 5 and 120 minutes', () => {
    render(<TuneFocus defaultMinutes={5} enabled now={NOW} clock={CLOCK} onTune={vi.fn()} />);
    turn(-120);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '5');
  });

  it('ignores the dial while something else owns it, and a tap on the readout still works', () => {
    const onTune = vi.fn();
    render(<TuneFocus defaultMinutes={25} enabled={false} now={NOW} clock={CLOCK} onTune={onTune} />);
    turn(120);
    pressDial();
    expect(onTune).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Set up a 25 minute focus' }));
    expect(onTune).toHaveBeenCalledWith(25);
  });

  it('reads out when the focus would end and labels the half hours ahead', () => {
    render(<TuneFocus defaultMinutes={25} enabled now={NOW} clock={CLOCK} onTune={vi.fn()} />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '25 minutes, until 10:15');
    expect(screen.getByText('10:30')).toBeInTheDocument();
    expect(screen.getByText('11:30')).toBeInTheDocument();
  });

  it('shows AM or PM only on the first label and where it changes', () => {
    const clock = { timeZone: 'UTC', hour12: true };
    render(<TuneFocus defaultMinutes={15} enabled now={Date.UTC(2026, 9, 6, 11, 5)} clock={clock} onTune={vi.fn()} />);
    expect(screen.getByText(/^11:30\sAM$/)).toBeInTheDocument();
    expect(screen.getByText(/^12:00\sPM$/)).toBeInTheDocument();
    expect(screen.getByText('12:30')).toBeInTheDocument();
  });

  it('labels a half hour just past now without its period, and gives the period to the next label', () => {
    const clock = { timeZone: 'UTC', hour12: true };
    render(<TuneFocus defaultMinutes={15} enabled now={Date.UTC(2026, 9, 6, 9, 16)} clock={clock} onTune={vi.fn()} />);
    expect(screen.getByText('9:30')).toBeInTheDocument();
    expect(screen.getByText(/^10:00\sAM$/)).toBeInTheDocument();
  });

  it('draws a half hour too near now for a label as a quarter hour', () => {
    const { container } = render(
      <TuneFocus defaultMinutes={15} enabled now={Date.UTC(2026, 9, 6, 9, 20)} clock={CLOCK} onTune={vi.fn()} />,
    );
    const first = container.querySelector('.tune-tick');
    expect(first).toHaveStyle({ left: `${(10 / 120) * 100}%` });
    expect(first).not.toHaveClass('tune-tick-major');
    expect(first).toBeEmptyDOMElement();
  });

  it('sets the length from a tap along the timeline', () => {
    render(<TuneFocus defaultMinutes={25} enabled now={NOW} clock={CLOCK} onTune={vi.fn()} />);
    const track = screen.getByRole('slider');
    track.setPointerCapture = () => {};
    track.getBoundingClientRect = () => ({ left: 0, width: 600, top: 0, height: 94 }) as DOMRect;
    fireEvent.pointerDown(track, { clientX: 300, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(track, { clientX: 300, clientY: 20, pointerId: 1 });
    expect(track).toHaveAttribute('aria-valuenow', '60');
  });
});
