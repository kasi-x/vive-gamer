"use client";

import { useState, useRef, useEffect } from "react";
import type { Socket } from "socket.io-client";
import type { GuessMessage, CorrectGuessPayload } from "@/types/game";
import { soundManager } from "@/lib/sounds";
import { showScorePopup } from "./ScorePopup";

interface GuessingPanelProps {
  socket: Socket;
  disabled?: boolean;
  myNickname?: string;
}

export default function GuessingPanel({ socket, disabled, myNickname }: GuessingPanelProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<GuessMessage[]>([]);
  const [correctFlash, setCorrectFlash] = useState(false);
  const [shaking, setShaking] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleNewGuess = (data: {
      nickname: string;
      text: string;
      isAI: boolean;
    }) => {
      setMessages((prev) => [
        ...prev,
        {
          nickname: data.nickname,
          text: data.text,
          isCorrect: false,
          isAI: data.isAI,
          timestamp: Date.now(),
        },
      ]);
    };

    const handleCorrectGuess = (data: CorrectGuessPayload) => {
      const isMe = data.nickname === myNickname;

      setMessages((prev) => [
        ...prev,
        {
          nickname: data.nickname,
          text: data.isAI
            ? "AI が正解してしまった..."
            : data.isFirstGuesser
            ? `正解！ 1番乗り！ +${data.totalEarned}`
            : `正解！ +${data.totalEarned}`,
          isCorrect: true,
          isAI: data.isAI,
          timestamp: Date.now(),
        },
      ]);

      setCorrectFlash(true);
      setTimeout(() => setCorrectFlash(false), 600);

      if (data.isAI) {
        soundManager?.aiCorrect();
      } else if (isMe) {
        if (data.isFirstGuesser) {
          soundManager?.firstGuess();
        } else {
          soundManager?.correct();
        }
        showScorePopup(`+${data.totalEarned}`,
          data.comboMultiplier > 1 ? `x${data.comboMultiplier} コンボ!` : undefined
        );
        if (data.comboMultiplier > 1) {
          soundManager?.combo();
        }
      }
    };

    const handleWrongGuess = () => {
      soundManager?.wrong();
      setShaking(true);
      setTimeout(() => setShaking(false), 300);
    };

    const handleGameStart = () => {
      setMessages([]);
    };

    socket.on("new_guess", handleNewGuess);
    socket.on("correct_guess", handleCorrectGuess);
    socket.on("wrong_guess", handleWrongGuess);
    socket.on("game_start", handleGameStart);

    return () => {
      socket.off("new_guess", handleNewGuess);
      socket.off("correct_guess", handleCorrectGuess);
      socket.off("wrong_guess", handleWrongGuess);
      socket.off("game_start", handleGameStart);
    };
  }, [socket, myNickname]);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    socket.emit("guess", { text: trimmed });
    setInput("");
  };

  return (
    <div className={`bg-[var(--surface)] rounded-xl flex flex-col h-full transition-colors ${
      correctFlash ? "animate-flash-green" : ""
    }`}>
      <div className="px-4 py-2 border-b border-[var(--surface-light)] text-sm text-[var(--text-dim)]">
        推測チャット
      </div>

      <div
        ref={feedRef}
        className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0 max-h-[250px] sm:max-h-[400px]"
      >
        {messages.length === 0 && (
          <p className="text-[var(--text-dim)] text-sm text-center py-4 sm:py-8">
            {disabled ? "あなたが描いています" : "お題を推測しよう！"}
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-sm px-3 py-1.5 rounded-lg animate-slide-up ${
              msg.isCorrect
                ? msg.isAI
                  ? "bg-[var(--accent)]/20 text-[var(--accent)] font-bold"
                  : "bg-[var(--success)]/20 text-[var(--success)] font-bold"
                : msg.isAI
                ? "bg-[var(--accent-2)]/30"
                : "bg-[var(--surface-light)]"
            }`}
          >
            <span
              className={`font-bold mr-2 ${
                msg.isAI ? "text-[var(--accent)]" : "text-[var(--text)]"
              }`}
            >
              {msg.nickname}
            </span>
            <span>{msg.text}</span>
          </div>
        ))}
      </div>

      {!disabled && (
        <form onSubmit={handleSubmit} className="p-2 sm:p-3 border-t border-[var(--surface-light)]">
          <div className={`flex gap-2 ${shaking ? "animate-shake" : ""}`}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="回答を入力..."
              className="flex-1 bg-[var(--surface-light)] text-[var(--text)] rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)] transition"
              autoFocus
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="bg-[var(--accent)] hover:bg-[var(--accent)]/80 disabled:opacity-40 text-white font-bold px-4 py-2 rounded-lg text-sm transition"
            >
              送信
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
