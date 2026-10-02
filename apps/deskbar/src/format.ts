export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/** Compact "1h 45m" / "45m" duration label used in the today summary and history rows. */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export type ClockFace = 'digital' | 'analog' | 'words' | 'stacked';

/** How the wall clock reads everywhere it appears; the face only applies to the idle screensaver. */
export type WallClock = { timeZone?: string; hour12: boolean; face: ClockFace };

/** Wall-clock time; pass an IANA zone if system tz is untrusted. */
export function formatWallClock(ms: number, timeZone?: string, hour12 = true): string {
  // hourCycle, not hour12: false, which renders midnight as 24:00 in chromium.
  return new Date(ms).toLocaleTimeString([], {
    hour: hour12 ? 'numeric' : '2-digit',
    minute: '2-digit',
    hourCycle: hour12 ? 'h12' : 'h23',
    timeZone,
  });
}

/** Hour (0-23), minute and second in the given zone. */
export function wallParts(ms: number, timeZone?: string): { h: number; m: number; s: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
    timeZone,
  }).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);
  return { h: get('hour'), m: get('minute'), s: get('second') };
}

const HOUR_WORDS = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];
const PAST_WORDS = ['', 'five past', 'ten past', 'quarter past', 'twenty past', 'twenty-five past', 'half past'];
const TO_WORDS = ['', 'five to', 'ten to', 'quarter to', 'twenty to', 'twenty-five to'];

/** The time to the nearest five minutes in words, split so the hour can be set apart: "twenty to" + "ten". */
export function clockWords(h: number, m: number): { lead: string; hour: string; tail: string } {
  const step = Math.round(m / 5);
  const hour = (step > 6 ? h + 1 : h) % 24;
  if (step === 0 || step === 12) {
    if (hour === 0) return { lead: '', hour: 'midnight', tail: '' };
    if (hour === 12) return { lead: '', hour: 'noon', tail: '' };
    return { lead: '', hour: HOUR_WORDS[hour % 12], tail: "o'clock" };
  }
  const lead = step <= 6 ? PAST_WORDS[step] : TO_WORDS[12 - step];
  return { lead, hour: HOUR_WORDS[hour % 12], tail: '' };
}
