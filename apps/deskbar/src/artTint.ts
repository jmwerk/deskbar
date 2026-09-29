import { useEffect, useState } from 'react';

const SAMPLE_PX = 16;
const MIN_SATURATION = 0.6;
const MIN_LIGHTNESS = 0.38;
const MAX_LIGHTNESS = 0.55;
// Mean per-pixel color weight below which the art counts as greyscale.
const MIN_MEAN_WEIGHT = 0.01;

function toHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

/**
 * The artwork's most vivid color, pushed saturated enough to read as a background wash.
 * Averaging plain pixels gives mud, so each pixel counts by how saturated and bright it is.
 * Null for greyscale art, where there's no color worth amplifying.
 */
export function vibrantTint(rgba: Uint8ClampedArray): string | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let total = 0;
  let counted = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue;
    counted++;
    const pr = rgba[i] / 255;
    const pg = rgba[i + 1] / 255;
    const pb = rgba[i + 2] / 255;
    const max = Math.max(pr, pg, pb);
    const sat = max === 0 ? 0 : (max - Math.min(pr, pg, pb)) / max;
    const weight = sat * sat * max;
    r += pr * weight;
    g += pg * weight;
    b += pb * weight;
    total += weight;
  }
  if (counted === 0 || total / counted < MIN_MEAN_WEIGHT) return null;
  const [h, s, l] = toHsl(r / total, g / total, b / total);
  const sat = Math.max(s, MIN_SATURATION);
  const light = Math.min(MAX_LIGHTNESS, Math.max(MIN_LIGHTNESS, l));
  return `hsl(${Math.round(h)} ${Math.round(sat * 100)}% ${Math.round(light * 100)}%)`;
}

/** Tint for a blob/data artwork url; keeps the previous tint until the new one resolves. */
export function useArtTint(url: string | null): string | null {
  const [tint, setTint] = useState<string | null>(null);
  useEffect(() => {
    if (!url) {
      setTint(null);
      return;
    }
    let dead = false;
    const img = new Image();
    img.onload = () => {
      if (dead) return;
      const canvas = document.createElement('canvas');
      canvas.width = SAMPLE_PX;
      canvas.height = SAMPLE_PX;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, SAMPLE_PX, SAMPLE_PX);
      setTint(vibrantTint(ctx.getImageData(0, 0, SAMPLE_PX, SAMPLE_PX).data));
    };
    img.src = url;
    return () => {
      dead = true;
    };
  }, [url]);
  return tint;
}
