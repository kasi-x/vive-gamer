"use client";

interface InkGaugeProps {
  inkRemaining: number;
  maxInk: number;
}

export default function InkGauge({ inkRemaining, maxInk }: InkGaugeProps) {
  const pct = Math.max(0, Math.min(100, (inkRemaining / maxInk) * 100));
  const isLow = pct <= 20;
  const isCritical = pct <= 5;

  const barColor = isCritical
    ? "bg-[var(--accent)]"
    : isLow
    ? "bg-[var(--warning)]"
    : "bg-[var(--success)]";

  return (
    <div className="flex items-center gap-2 bg-[var(--surface)] rounded-lg px-3 py-1.5">
      <span className="text-xs text-[var(--text-dim)]">INK</span>
      <div className="w-24 sm:w-32 h-2.5 bg-[var(--surface-light)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor} ${
            isLow ? "animate-pulse" : ""
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`text-xs font-bold tabular-nums ${
          isCritical
            ? "text-[var(--accent)]"
            : isLow
            ? "text-[var(--warning)]"
            : "text-[var(--text-dim)]"
        }`}
      >
        {Math.round(pct)}%
      </span>
    </div>
  );
}
