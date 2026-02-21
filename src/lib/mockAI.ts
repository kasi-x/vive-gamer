// AIの面白い誤回答パターン
const WRONG_GUESSES: Record<string, string[]> = {
  猫: ["犬", "うさぎ", "ハムスター", "ライオン", "トラ"],
  富士山: ["ピラミッド", "テント", "アイスクリーム", "三角形", "東京タワー"],
  寿司: ["ケーキ", "ハンバーガー", "お弁当", "枕", "本"],
  自転車: ["バイク", "車", "三輪車", "扇風機", "メガネ"],
  ロケット: ["鉛筆", "ニンジン", "東京タワー", "矢印", "アイスクリーム"],
  ひまわり: ["太陽", "目玉焼き", "扇風機", "ライオン", "時計"],
  ピアノ: ["テーブル", "本棚", "はしご", "シマウマ", "キーボード"],
  虹: ["橋", "滑り台", "ベルト", "ヘビ", "アーチ"],
  タコ: ["クラゲ", "太陽", "花", "風船", "手"],
  新幹線: ["電車", "バス", "飛行機", "ミサイル", "弁当箱"],
  アイスクリーム: ["マイク", "電球", "風船", "キノコ", "トーチ"],
  恐竜: ["トカゲ", "ドラゴン", "犬", "カンガルー", "鳥"],
  花火: ["星", "太陽", "爆発", "タコ", "クラゲ"],
  ペンギン: ["雪だるま", "修道女", "ボウリングピン", "スーツの人", "ナス"],
  UFO: ["帽子", "フリスビー", "目玉焼き", "土星", "クラゲ"],
};

// 汎用の間違い回答（お題がリストにない場合）
const GENERIC_WRONG = [
  "何かの動物？",
  "食べ物かな",
  "建物っぽい",
  "乗り物だと思う",
  "よくわからない...",
  "これは...花？",
  "人の顔？",
];

export interface AIGuessResult {
  text: string;
  isCorrect: boolean;
}

export function getAIGuess(word: string, attemptNumber: number): AIGuessResult {
  // AIは3回目の推測で30%の確率で正解する
  if (attemptNumber >= 3 && Math.random() < 0.3) {
    return { text: word, isCorrect: true };
  }

  const wrongGuesses = WRONG_GUESSES[word] || GENERIC_WRONG;
  const index = attemptNumber % wrongGuesses.length;
  return { text: wrongGuesses[index], isCorrect: false };
}

export const AI_NICKNAME = "AI くん";
