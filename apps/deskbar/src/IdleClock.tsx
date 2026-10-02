import { clockWords, formatWallClock, wallParts, type WallClock } from './format';

const TICKS = Array.from({ length: 60 }, (_, i) => i);

function AnalogFace({ h, m, s }: { h: number; m: number; s: number }) {
  const minuteDeg = (m + s / 60) * 6;
  const hourDeg = ((h % 12) + m / 60) * 30;
  return (
    <svg className="idle-analog" viewBox="-100 -100 200 200" aria-hidden="true">
      {TICKS.map(i => {
        const major = i % 5 === 0;
        return (
          <line
            key={i}
            className={major ? 'idle-analog-tick-major' : 'idle-analog-tick'}
            x1="0"
            y1={major ? -96 : -95}
            x2="0"
            y2={major ? -84 : -90}
            transform={`rotate(${i * 6})`}
          />
        );
      })}
      <line className="idle-analog-hour" x1="0" y1="10" x2="0" y2="-50" transform={`rotate(${hourDeg})`} />
      <line className="idle-analog-minute" x1="0" y1="14" x2="0" y2="-80" transform={`rotate(${minuteDeg})`} />
      <circle className="idle-analog-pin" r="4.5" />
    </svg>
  );
}

/** The screensaver's clock, drawn in the face chosen in settings. */
export function IdleClock({ now, clock }: { now: number; clock: WallClock }) {
  const label = formatWallClock(now, clock.timeZone, clock.hour12);

  if (clock.face === 'analog') {
    return (
      <div className="idle-clock" role="timer" aria-label={label}>
        <AnalogFace {...wallParts(now, clock.timeZone)} />
      </div>
    );
  }

  if (clock.face === 'words') {
    const { h, m } = wallParts(now, clock.timeZone);
    const { lead, hour, tail } = clockWords(h, m);
    return (
      <div className="idle-clock idle-words" role="timer" aria-label={label}>
        {lead && <span className="idle-words-lead">{lead}</span>}
        <span className="idle-words-hour">
          {hour}
          {tail && <span className="idle-words-tail"> {tail}</span>}
        </span>
      </div>
    );
  }

  if (clock.face === 'stacked') {
    const { h, m } = wallParts(now, clock.timeZone);
    const shownH = clock.hour12 ? h % 12 || 12 : h;
    return (
      <div className="idle-clock idle-stacked" role="timer" aria-label={label}>
        <span>{String(shownH).padStart(2, '0')}</span>
        <span className="idle-stacked-minutes">{String(m).padStart(2, '0')}</span>
      </div>
    );
  }

  return (
    <div className="idle-clock screensaver-clock" role="timer">
      {label}
    </div>
  );
}
