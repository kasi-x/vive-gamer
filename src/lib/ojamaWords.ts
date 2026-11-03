export interface OjamaWord {
  word: string;
  hint: string; // 穴埋めヒント（例: S _ _ _ _ _ _ _ e）
  difficulty: 1 | 2 | 3;
  description: string; // ビジュアル説明
  image: string; // 事前生成済み画像パス（public/ojama/）
}

function generateHint(word: string): string {
  const chars = [...word];
  if (chars.length <= 2) return chars.join(" ");
  // 最初と最後の文字を表示、中間は _ で埋める
  const blanks = chars.slice(1, -1).map(() => "_");
  return [chars[0], ...blanks, chars[chars.length - 1]].join(" ");
}

const WORDS: Omit<OjamaWord, "hint">[] = [
  {
    word: "Hamstree",
    difficulty: 1,
    description:
      "Hamster（ハムスター）＋ Tree（木）— 木の幹がふわふわの毛に覆われ、枝の先にひまわりの種が実っている、ハムスターのような顔をした奇妙な大木。",
    image: "/ojama/hamstree.png",
  },
  {
    word: "Gorillamp",
    difficulty: 1,
    description:
      "Gorilla（ゴリラ）＋ Lamp（ランプ）— 筋肉隆々のゴリラの頭の部分が、大きなアンティーク調のランプシェードになっており、目が光っている。",
    image: "/ojama/gorillamp.png",
  },
  {
    word: "Octopiano",
    difficulty: 2,
    description:
      "Octopus（タコ）＋ Piano（ピアノ）— 8本の足がそれぞれピアノの鍵盤を叩いているのか、あるいは足自体が鍵盤になっている巨大なタコ。",
    image: "/ojama/octopiano.png",
  },
  {
    word: "Sharkodile",
    difficulty: 2,
    description:
      "Shark（サメ）＋ Crocodile（ワニ）— サメの背びれと鋭い歯を持ちながら、体と尻尾はワニという、水辺の最強ハイブリッド生物。",
    image: "/ojama/sharkodile.png",
  },
  {
    word: "Pineapplow",
    difficulty: 3,
    description:
      "Pineapple（パイナップル）＋ Owl（フクロウ）— 体がパイナップルの表面（鱗状）で、頭にパイナップルの葉のような羽角が生えたフクロウ。",
    image: "/ojama/pineapplow.png",
  },
];

export function pickOjamaWord(
  exclude: string[] = [],
  difficulty?: 1 | 2 | 3
): OjamaWord {
  let pool = WORDS.filter((w) => !exclude.includes(w.word));
  if (difficulty) {
    const filtered = pool.filter((w) => w.difficulty === difficulty);
    if (filtered.length > 0) pool = filtered;
  }
  if (pool.length === 0) pool = WORDS;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  return {
    ...picked,
    hint: generateHint(picked.word),
  };
}

// 大文字小文字を無視して比較
export function normalizeJapanese(s: string): string {
  return s.trim().normalize("NFC").toLowerCase();
}
