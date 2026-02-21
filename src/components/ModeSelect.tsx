"use client";

type GameMode = "battle" | "teleport" | "sketch";

interface ModeSelectProps {
  selectedMode: GameMode;
  onSelect: (mode: GameMode) => void;
}

const MODES: { id: GameMode; title: string; subtitle: string; description: string; icon: string }[] = [
  {
    id: "battle",
    title: "AI解読バトル",
    subtitle: "モード①",
    description: "描いて当てる！AIに読まれない絵を描こう",
    icon: "🎨",
  },
  {
    id: "teleport",
    title: "プロンプト・テレポート",
    subtitle: "モード②",
    description: "プロンプト→AI画像→説明→AI画像の伝言ゲーム",
    icon: "🚀",
  },
  {
    id: "sketch",
    title: "スピード・スケッチ修正",
    subtitle: "モード③",
    description: "不完全な画像を全員で同時に完成させよう",
    icon: "✏️",
  },
];

export default function ModeSelect({ selectedMode, onSelect }: ModeSelectProps) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm text-[var(--text-dim)] uppercase tracking-wider mb-3">
        モード選択
      </h2>
      {MODES.map((mode) => (
        <button
          key={mode.id}
          onClick={() => onSelect(mode.id)}
          className={`w-full text-left px-4 py-3 rounded-xl transition border-2 ${
            selectedMode === mode.id
              ? "border-[var(--accent)] bg-[var(--accent)]/15"
              : "border-transparent bg-[var(--surface-light)] hover:border-[var(--accent)]/30"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{mode.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold">{mode.title}</span>
                <span className="text-xs text-[var(--text-dim)]">{mode.subtitle}</span>
              </div>
              <p className="text-sm text-[var(--text-dim)] mt-0.5">{mode.description}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

export type { GameMode };
