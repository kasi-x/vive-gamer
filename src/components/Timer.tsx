"use client";

export default function Timer({ remaining }: { remaining: number }) {
  const urgent = remaining <= 10;
  const critical = remaining <= 5;
  return (
    <div
      className={`text-3xl font-mono font-bold tabular-nums ${
        critical
          ? "text-[var(--accent)] animate-timer-pulse"
          : urgent
          ? "text-[var(--accent)] animate-pulse"
          : "text-[var(--text)]"
      }`}
    >
      {remaining}s
    </div>
  );
}
