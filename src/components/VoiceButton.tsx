"use client";

interface VoiceButtonProps {
  listening: boolean;
  supported: boolean;
  onStart: () => void;
  onStop: () => void;
  size?: "sm" | "md";
}

export default function VoiceButton({
  listening,
  supported,
  onStart,
  onStop,
  size = "md",
}: VoiceButtonProps) {
  if (!supported) return null;

  const sizeClasses = size === "sm"
    ? "px-2.5 py-2 text-sm rounded-lg"
    : "px-4 py-3 text-lg rounded-xl";

  return (
    <button
      type="button"
      onClick={listening ? onStop : onStart}
      className={`transition ${sizeClasses} ${
        listening
          ? "bg-[var(--accent)] text-white animate-mic-pulse"
          : "bg-[var(--surface-light)] text-[var(--text-dim)] hover:text-[var(--text)]"
      }`}
      title={listening ? "音声入力を停止" : "音声で回答"}
    >
      🎤
    </button>
  );
}
