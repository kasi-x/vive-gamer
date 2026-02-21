"use client";

export default function Timer({ remaining }: { remaining: number }) {
  const urgent = remaining <= 10;
  return (
    <div
      className={`text-3xl font-mono font-bold tabular-nums ${
        urgent ? "text-[var(--accent)] animate-pulse" : "text-[var(--text)]"
      }`}
    >
      {remaining}s
    </div>
  );
}
