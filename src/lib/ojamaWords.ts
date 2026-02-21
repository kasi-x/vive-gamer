export interface OjamaWord {
  word: string;
  hint: string; // 穴埋めヒント
  difficulty: 1 | 2 | 3;
}

function generateHint(word: string): string {
  const chars = [...word];
  if (chars.length <= 2) return chars[0] + "◯".repeat(chars.length - 1);
  // 最初と最後を残し、中間の60%を◯に
  const inner = chars.slice(1, -1);
  const hideCount = Math.max(1, Math.ceil(inner.length * 0.6));
  const indices = inner.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, hideCount);
  const hinted = inner.map((c, i) => (indices.includes(i) ? "◯" : c));
  return chars[0] + hinted.join("") + chars[chars.length - 1];
}

const WORDS: { word: string; difficulty: 1 | 2 | 3 }[] = [
  // 難易度1（簡単）
  { word: "猫", difficulty: 1 },
  { word: "犬", difficulty: 1 },
  { word: "花", difficulty: 1 },
  { word: "山", difficulty: 1 },
  { word: "海", difficulty: 1 },
  { word: "空", difficulty: 1 },
  { word: "雨", difficulty: 1 },
  { word: "星", difficulty: 1 },
  { word: "月", difficulty: 1 },
  { word: "木", difficulty: 1 },
  // 難易度2（普通）
  { word: "寿司", difficulty: 2 },
  { word: "富士山", difficulty: 2 },
  { word: "新幹線", difficulty: 2 },
  { word: "ひまわり", difficulty: 2 },
  { word: "ピアノ", difficulty: 2 },
  { word: "ペンギン", difficulty: 2 },
  { word: "ロケット", difficulty: 2 },
  { word: "自転車", difficulty: 2 },
  { word: "アイス", difficulty: 2 },
  { word: "花火", difficulty: 2 },
  // 難易度3（難しい）
  { word: "アイスクリーム", difficulty: 3 },
  { word: "ひまわり畑", difficulty: 3 },
  { word: "観覧車", difficulty: 3 },
  { word: "トランポリン", difficulty: 3 },
  { word: "サッカーボール", difficulty: 3 },
  { word: "パイナップル", difficulty: 3 },
  { word: "ティラノサウルス", difficulty: 3 },
  { word: "シンデレラ", difficulty: 3 },
  { word: "プラネタリウム", difficulty: 3 },
  { word: "ジェットコースター", difficulty: 3 },
];

export function pickOjamaWord(exclude: string[] = [], difficulty?: 1 | 2 | 3): OjamaWord {
  let pool = WORDS.filter((w) => !exclude.includes(w.word));
  if (difficulty) pool = pool.filter((w) => w.difficulty === difficulty);
  if (pool.length === 0) pool = WORDS;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  return {
    word: picked.word,
    hint: generateHint(picked.word),
    difficulty: picked.difficulty,
  };
}

// カタカナ→ひらがな正規化
export function normalizeJapanese(s: string): string {
  return s
    .trim()
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\u30A1-\u30F6]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0x60)
    );
}
