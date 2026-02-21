"use client";

import { useState, useEffect } from "react";

interface PopupItem {
  id: number;
  text: string;
  subtext?: string;
  x: number;
}

let popupId = 0;

export default function ScorePopup() {
  const [popups, setPopups] = useState<PopupItem[]>([]);

  useEffect(() => {
    const handler = (e: CustomEvent<{ text: string; subtext?: string }>) => {
      const id = ++popupId;
      const x = 40 + Math.random() * 20; // 画面中央付近
      setPopups((prev) => [...prev, { id, text: e.detail.text, subtext: e.detail.subtext, x }]);
      setTimeout(() => {
        setPopups((prev) => prev.filter((p) => p.id !== id));
      }, 1200);
    };

    window.addEventListener("score-popup" as string, handler as EventListener);
    return () => window.removeEventListener("score-popup" as string, handler as EventListener);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      {popups.map((p) => (
        <div
          key={p.id}
          className="absolute animate-float-up-fade"
          style={{ left: `${p.x}%`, top: "40%" }}
        >
          <div className="text-3xl font-black text-[var(--success)] drop-shadow-lg">
            {p.text}
          </div>
          {p.subtext && (
            <div className="text-sm font-bold text-[var(--warning)] text-center">
              {p.subtext}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ヘルパー関数
export function showScorePopup(text: string, subtext?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("score-popup", { detail: { text, subtext } })
  );
}
