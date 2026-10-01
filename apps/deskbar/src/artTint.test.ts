import { describe, expect, it } from 'vitest';
import { vibrantTint, washTextContrast } from './artTint';

function pixels(...rgb: Array<[number, number, number]>): Uint8ClampedArray {
  return new Uint8ClampedArray(rgb.flatMap(([r, g, b]) => [r, g, b, 255]));
}

function hsl(tint: string | null): [number, number, number] {
  const [, h, s, l] = /^hsl\((\d+) (\d+)% (\d+)%\)$/.exec(tint ?? '')!.map(Number);
  return [h, s, l];
}

function hue(tint: string | null): number {
  return Number(/^hsl\((\d+)/.exec(tint ?? '')?.[1]);
}

describe('vibrantTint', () => {
  it('lets the vivid pixels win over a mostly grey image', () => {
    const grey: [number, number, number] = [120, 120, 120];
    const tint = vibrantTint(pixels(grey, grey, grey, grey, grey, [220, 30, 30]));
    expect(hue(tint)).toBe(0);
  });

  it('returns null for greyscale art', () => {
    expect(vibrantTint(pixels([0, 0, 0], [128, 128, 128], [255, 255, 255]))).toBeNull();
  });

  it('lifts a dull color to a saturated wash no lighter than mid', () => {
    const [, s, l] = hsl(vibrantTint(pixels([60, 80, 40], [60, 80, 40])));
    expect(s).toBeGreaterThanOrEqual(60);
    expect(l).toBeLessThanOrEqual(55);
  });

  it('keeps a dark blue at its own lightness, since white already reads on it', () => {
    expect(hsl(vibrantTint(pixels([30, 60, 140])))[2]).toBeGreaterThanOrEqual(38);
  });

  it.each([
    ['yellow', [250, 220, 20]],
    ['green', [46, 204, 113]],
    ['cyan', [20, 220, 230]],
  ] as const)('darkens %s art until the player text holds AA', (_, rgb) => {
    const [h, s, l] = hsl(vibrantTint(pixels([...rgb])));
    expect(washTextContrast(h, s / 100, l / 100)).toBeGreaterThanOrEqual(4.5);
  });

  it('ignores transparent pixels', () => {
    const data = new Uint8ClampedArray([255, 0, 0, 0, 0, 0, 255, 255, 0, 0, 255, 255]);
    expect(hue(vibrantTint(data))).toBe(240);
  });
});
