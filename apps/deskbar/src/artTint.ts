import { useEffect, useState } from 'react';

const SAMPLE_PX = 16;
const MIN_SATURATION = 0.6;
const MIN_LIGHTNESS = 0.38;
const MAX_LIGHTNESS = 0.55;
// Mean per-pixel color weight below which the art counts as greyscale.
const MIN_MEAN_WEIGHT = 0.01;
// The player's off-white, and the 78% of it its secondary text uses, which must hold AA on the wash.
const TEXT_RGB: [number, number, number] = [245 / 255, 246 / 255, 247 / 255];
const SECONDARY_ALPHA = 0.78;
const MIN_CONTRAST = 4.5;

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

function toRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function mixRgb(a: [number, number, number], b: [number, number, number], p: number): [number, number, number] {
  return [a[0] * p + b[0] * (1 - p), a[1] * p + b[1] * (1 - p), a[2] * p + b[2] * (1 - p)];
}

/** Contrast of the player's secondary text over the wash, which measures at the full tint where text sits. */
export function washTextContrast(h: number, s: number, l: number): number {
  const wash = toRgb(h, s, l);
  const text = mixRgb(TEXT_RGB, wash, SECONDARY_ALPHA);
  return (luminance(text) + 0.05) / (luminance(wash) + 0.05);
}

/**
 * The artwork's most vivid color, pushed saturated enough to read as a background wash.
 * Averaging plain pixels gives mud, so each pixel counts by how saturated and bright it is.
 * Null for greyscale art, where there's no color worth amplifying. Bright hues like yellow are darkened
 * until white text holds AA on them, since equal HSL lightness is far brighter for yellow than for blue.
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
  const hue = Math.round(h);
  const satPct = Math.round(sat * 100);
  let lightPct = Math.round(Math.min(MAX_LIGHTNESS, Math.max(MIN_LIGHTNESS, l)) * 100);
  while (lightPct > 0 && washTextContrast(hue, satPct / 100, lightPct / 100) < MIN_CONTRAST) lightPct--;
  return `hsl(${hue} ${satPct}% ${lightPct}%)`;
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
