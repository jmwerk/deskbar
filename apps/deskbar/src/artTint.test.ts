import { describe, expect, it } from 'vitest';
import { vibrantTint } from './artTint';

function pixels(...rgb: Array<[number, number, number]>): Uint8ClampedArray {
  return new Uint8ClampedArray(rgb.flatMap(([r, g, b]) => [r, g, b, 255]));
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

  it('lifts a dull color to a saturated, mid-lightness wash', () => {
    const tint = vibrantTint(pixels([60, 80, 40], [60, 80, 40]));
    const [, , s, l] = /^hsl\((\d+) (\d+)% (\d+)%\)$/.exec(tint ?? '')!.map(Number);
    expect(s).toBeGreaterThanOrEqual(60);
    expect(l).toBeGreaterThanOrEqual(38);
    expect(l).toBeLessThanOrEqual(55);
  });

  it('ignores transparent pixels', () => {
    const data = new Uint8ClampedArray([255, 0, 0, 0, 0, 0, 255, 255, 0, 0, 255, 255]);
    expect(hue(vibrantTint(data))).toBe(240);
  });
});
