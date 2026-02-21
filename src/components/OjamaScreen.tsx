"use client";

import { useRef } from "react";
import InkSplatOverlay, { type Splat } from "./InkSplatOverlay";
import VoiceButton from "./VoiceButton";

interface OjamaScreenProps {
  nickname: string;
  score: number;
  hint: string;
  splats: Splat[];
  input: string;
  onInputChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  shaking: boolean;
  isMe: boolean;
  listening?: boolean;
  interim?: string;
  voiceSupported?: boolean;
  onStartVoice?: () => void;
  onStopVoice?: () => void;
}

export default function OjamaScreen({
  nickname,
  score,
  hint,
  splats,
  input,
  onInputChange,
  onSubmit,
  shaking,
  isMe,
  listening = false,
  interim = "",
  voiceSupported = false,
  onStartVoice,
  onStopVoice,
}: OjamaScreenProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={`flex flex-col h-full rounded-2xl overflow-hidden border ${
      isMe ? "border-[var(--accent)]/30" : "border-[var(--surface-light)]"
    }`}>
      {/* プレイヤー名 + スコア */}
      <div className={`flex items-center justify-between px-4 py-2 ${
        isMe ? "bg-[var(--accent)]/15" : "bg-[var(--surface)]"
      }`}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[var(--accent-2)] flex items-center justify-center text-xs font-bold">
            {nickname[0]}
          </div>
          <span className="font-bold text-sm">{nickname}</span>
          {isMe && <span className="text-[10px] text-[var(--accent)]">YOU</span>}
        </div>
        <span className="text-lg font-bold tabular-nums">{score}</span>
      </div>

      {/* ヒント + スプラットエリア */}
      <div className="relative flex-1 flex items-center justify-center bg-[var(--surface)] p-4 min-h-[120px]">
        <div className="text-center z-10 relative">
          <p className="text-xs text-[var(--text-dim)] mb-1">ヒント</p>
          <p className="text-2xl sm:text-3xl font-black tracking-widest text-[var(--warning)]">
            {hint}
          </p>
        </div>
        <InkSplatOverlay splats={splats} />
      </div>

      {/* 入力エリア（自分のみ） */}
      {isMe && (
        <form onSubmit={onSubmit} className="p-2 bg-[var(--surface-light)]">
          {listening && interim && (
            <div className="text-xs text-[var(--text-dim)] mb-1 px-1 truncate">
              🎤 {interim}
            </div>
          )}
          <div className={`flex gap-2 ${shaking ? "animate-shake" : ""}`}>
            <input
              ref={inputRef}
              type="text"
              value={listening ? interim : input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="答えを入力..."
              disabled={listening}
              className="flex-1 bg-[var(--surface)] text-[var(--text)] rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)] transition"
              autoFocus
            />
            {voiceSupported && onStartVoice && onStopVoice && (
              <VoiceButton
                listening={listening}
                supported={voiceSupported}
                onStart={onStartVoice}
                onStop={onStopVoice}
                size="sm"
              />
            )}
            <button
              type="submit"
              disabled={!input.trim() && !listening}
              className="bg-[var(--accent)] hover:bg-[var(--accent)]/80 disabled:opacity-40 text-white font-bold px-3 py-2 rounded-lg text-sm transition"
            >
              回答
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
