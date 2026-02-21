"use client";

import Timer from "./Timer";
import { soundManager } from "@/lib/sounds";

interface GameHeaderProps {
  round: number;
  totalRounds: number;
  drawerNickname: string;
  remaining: number;
  word?: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export default function GameHeader({
  round,
  totalRounds,
  drawerNickname,
  remaining,
  word,
  soundEnabled,
  onToggleSound,
}: GameHeaderProps) {
  return (
    <div className="bg-[var(--surface)] rounded-xl px-3 py-2 sm:px-6 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
      <div className="text-sm text-[var(--text-dim)]">
        ラウンド{" "}
        <span className="text-[var(--text)] font-bold text-lg">
          {round}/{totalRounds}
        </span>
      </div>

      <div className="flex-1 text-center">
        {word ? (
          <div>
            <span className="text-[var(--text-dim)] text-sm">お題: </span>
            <span className="text-[var(--warning)] font-bold text-xl sm:text-2xl">
              {word}
            </span>
          </div>
        ) : (
          <div className="text-[var(--text-dim)]">
            <span className="font-bold text-[var(--text)]">
              {drawerNickname}
            </span>{" "}
            が描いています...
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSound}
          className="text-lg opacity-60 hover:opacity-100 transition"
          title={soundEnabled ? "サウンドOFF" : "サウンドON"}
        >
          {soundEnabled ? "🔊" : "🔇"}
        </button>
        <Timer remaining={remaining} />
      </div>
    </div>
  );
}
