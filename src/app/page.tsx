"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [nickname, setNickname] = useState("");
  const router = useRouter();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed) return;
    sessionStorage.setItem("nickname", trimmed);
    router.push("/game");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-2">
            <span className="text-[var(--accent)]">Vive</span>{" "}
            <span className="text-[var(--text)]">Gamer</span>
          </h1>
          <p className="text-[var(--text-dim)] text-lg">
            AI と対戦する描画バトル
          </p>
        </div>

        <form
          onSubmit={handleJoin}
          className="bg-[var(--surface)] rounded-2xl p-8 shadow-xl"
        >
          <label className="block text-sm text-[var(--text-dim)] mb-2">
            ニックネーム
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="名前を入力..."
            maxLength={12}
            className="w-full bg-[var(--surface-light)] text-[var(--text)] rounded-lg px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-[var(--accent)] transition mb-4"
            autoFocus
          />
          <button
            type="submit"
            disabled={!nickname.trim()}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent)]/80 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg text-lg transition"
          >
            参加する
          </button>
        </form>
      </div>
    </div>
  );
}
