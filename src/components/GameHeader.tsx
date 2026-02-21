"use client";

import Timer from "./Timer";

interface GameHeaderProps {
  round: number;
  totalRounds: number;
  drawerNickname: string;
  remaining: number;
  word?: string; // 描き手にのみ表示
}

export default function GameHeader({
  round,
  totalRounds,
  drawerNickname,
  remaining,
  word,
}: GameHeaderProps) {
  return (
    <div className="bg-[var(--surface)] rounded-xl px-6 py-3 flex items-center justify-between gap-4">
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
            <span className="text-[var(--warning)] font-bold text-2xl">
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

      <Timer remaining={remaining} />
    </div>
  );
}
