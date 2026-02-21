"use client";

import { useState } from "react";
import ModeSelect, { type GameMode } from "./ModeSelect";

interface LobbyProps {
  players: { id: string; nickname: string; score: number }[];
  onStartGame: (mode: GameMode) => void;
  myId: string | undefined;
}

export default function Lobby({ players, onStartGame, myId }: LobbyProps) {
  const [selectedMode, setSelectedMode] = useState<GameMode>("battle");
  const canStart = players.length >= 2;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold mb-1">
            <span className="text-[var(--accent)]">Vive</span> Gamer
          </h1>
          <p className="text-[var(--text-dim)]">プレイヤーを待っています...</p>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl p-6 mb-4">
          <h2 className="text-sm text-[var(--text-dim)] mb-3 uppercase tracking-wider">
            プレイヤー ({players.length})
          </h2>
          <div className="space-y-2">
            {players.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg ${
                  p.id === myId
                    ? "bg-[var(--accent)]/20 border border-[var(--accent)]/30"
                    : "bg-[var(--surface-light)]"
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-[var(--accent-2)] flex items-center justify-center text-sm font-bold">
                  {p.nickname[0]}
                </div>
                <span className="font-medium">{p.nickname}</span>
                {p.id === myId && (
                  <span className="text-xs text-[var(--accent)] ml-auto">
                    あなた
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl p-6 mb-4">
          <ModeSelect selectedMode={selectedMode} onSelect={setSelectedMode} />
        </div>

        <button
          onClick={() => onStartGame(selectedMode)}
          disabled={!canStart}
          className="w-full bg-[var(--accent)] hover:bg-[var(--accent)]/80 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-lg transition"
        >
          {canStart
            ? "ゲーム開始！"
            : `あと${2 - players.length}人必要です`}
        </button>
      </div>
    </div>
  );
}
