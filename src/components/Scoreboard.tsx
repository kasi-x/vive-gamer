"use client";

import type { ScoreEntry } from "@/types/game";

interface ScoreboardProps {
  scores: ScoreEntry[];
  title?: string;
  word?: string;
  isGameEnd?: boolean;
  winner?: string;
  onReturnToLobby?: () => void;
}

export default function Scoreboard({
  scores,
  title,
  word,
  isGameEnd,
  winner,
  onReturnToLobby,
}: ScoreboardProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6 animate-pop-in">
          {isGameEnd ? (
            <>
              <h2 className="text-3xl sm:text-4xl font-bold mb-2">ゲーム終了！</h2>
              <p className="text-xl sm:text-2xl text-[var(--warning)]">
                {winner} の勝利！
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl sm:text-2xl font-bold mb-1">{title || "ラウンド終了"}</h2>
              {word && (
                <p className="text-lg text-[var(--text-dim)]">
                  お題: <span className="text-[var(--warning)] font-bold">{word}</span>
                </p>
              )}
            </>
          )}
        </div>

        <div className="bg-[var(--surface)] rounded-2xl p-4 space-y-2">
          {scores.map((entry, i) => (
            <div
              key={entry.nickname}
              className={`flex items-center gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-xl animate-slide-up ${
                i === 0 && isGameEnd
                  ? "bg-[var(--warning)]/20 border border-[var(--warning)]/30"
                  : "bg-[var(--surface-light)]"
              }`}
              style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
            >
              <span className="text-lg font-bold text-[var(--text-dim)] w-8">
                {i + 1}.
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{entry.nickname}</span>
                  {entry.isFirstGuesser && !isGameEnd && (
                    <span className="text-xs bg-[var(--warning)]/20 text-[var(--warning)] px-1.5 py-0.5 rounded font-bold">
                      1st
                    </span>
                  )}
                  {entry.comboMultiplier && entry.comboMultiplier > 1 && !isGameEnd && (
                    <span className="text-xs bg-[var(--accent)]/20 text-[var(--accent)] px-1.5 py-0.5 rounded font-bold animate-combo-flash">
                      x{entry.comboMultiplier}
                    </span>
                  )}
                </div>
                {entry.timeBonus !== undefined && entry.timeBonus > 0 && !isGameEnd && (
                  <div className="text-xs text-[var(--text-dim)] mt-0.5">
                    時間ボーナス +{entry.timeBonus}
                  </div>
                )}
              </div>
              {entry.roundDelta !== 0 && !isGameEnd && (
                <span
                  className={`text-sm font-bold animate-score-pop ${
                    entry.roundDelta > 0
                      ? "text-[var(--success)]"
                      : "text-[var(--accent)]"
                  }`}
                >
                  {entry.roundDelta > 0 ? "+" : ""}
                  {entry.roundDelta}
                </span>
              )}
              <span className="text-xl font-bold tabular-nums">
                {entry.score}
              </span>
            </div>
          ))}
        </div>

        {isGameEnd && onReturnToLobby && (
          <button
            onClick={onReturnToLobby}
            className="w-full mt-4 bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-white font-bold py-3 rounded-xl text-lg transition"
          >
            ロビーに戻る
          </button>
        )}

        {!isGameEnd && (
          <p className="text-center text-[var(--text-dim)] text-sm mt-4">
            次のラウンドまでお待ちください...
          </p>
        )}
      </div>
    </div>
  );
}
