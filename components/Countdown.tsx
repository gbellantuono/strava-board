'use client';

import { useEffect, useMemo, useState } from 'react';

type Props = {
  // Target date and time. If omitted, defaults to 11 Dec 2025 14:00 local time.
  target?: Date | string;
  label?: string;
  // Update interval in ms; default 50ms for smooth milliseconds without overloading CPU
  tickMs?: number;
};

function toTargetDate(input?: Date | string): Date {
  if (!input) return new Date('2025-12-11T14:00:00'); // local time
  return typeof input === 'string' ? new Date(input) : input;
}

export default function Countdown({ target, label, tickMs = 50 }: Props) {
  const tgt = useMemo(() => toTargetDate(target), [target]);
  // Avoid SSR/CSR hydration mismatches by rendering a stable placeholder
  // on the server and only starting the clock after mount.
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    setHydrated(true);
    let raf: number | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    // Use setInterval; optionally fallback to rAF if tickMs is very small
    if (tickMs && tickMs >= 16) {
      timer = setInterval(() => setNow(new Date()), tickMs);
    } else {
      const loop = () => {
        setNow(new Date());
        raf = window.requestAnimationFrame(loop);
      };
      raf = window.requestAnimationFrame(loop);
    }
    return () => {
      if (timer) clearInterval(timer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [tickMs]);

  const diff = Math.max(0, tgt.getTime() - now.getTime());
  const ms = diff % 1000;
  const totalSeconds = Math.floor(diff / 1000);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const h = totalHours % 24;
  const d = Math.floor(totalHours / 24);

  const title = label ?? 'Time to 11 Dec 2025 14:00';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        justifyContent: 'flex-end',
        whiteSpace: 'nowrap',
        flex: '0 0 auto',
        minWidth: 280,
      }}
    >
      <span style={{ color: '#9aa3b2', fontSize: 14 }}>{title}:</span>
      <strong
        style={{
          fontVariantNumeric: 'tabular-nums',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          display: 'inline-block',
          minWidth: '21ch',
          textAlign: 'right',
        }}
        aria-live="polite"
      >
        {hydrated ? (
          <>
            {String(d).padStart(2, '0')}d {String(h).padStart(2, '0')}h{' '}
            {String(m).padStart(2, '0')}m {String(s).padStart(2, '0')}s{' '}
            {String(ms).padStart(3, '0')}ms
          </>
        ) : (
          // Stable placeholder for SSR and initial client render to prevent hydration mismatch
          <>00d 00h 00m 00s 000ms</>
        )}
      </strong>
    </div>
  );
}
