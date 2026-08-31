export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/** Compact "1h 45m" / "45m" duration label, for the today summary and history rows. */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Wall-clock time ("2:47 PM"), for Home's idle screensaver — not a
 * countdown. `timeZone: undefined` falls back to the runtime's own local
 * timezone; pass an explicit IANA zone (from config) when the device's
 * system timezone can't be trusted — see the note in history.ts's dayKey.
 */
export function formatWallClock(ms: number, timeZone?: string): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone });
}
