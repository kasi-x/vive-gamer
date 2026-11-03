// AIの面白い誤回答パターン（デモ用に調整済み）
// 試行0-1: 的外れ、試行2: 惜しい、試行3+: 30%で正解
const WRONG_GUESSES: Record<string, string[]> = {
  猫: ["犬", "うさぎ", "ハムスター", "ライオン", "トラ"],
  富士山: ["ピラミッド", "テント", "アイスクリーム", "三角形", "山"],
  寿司: ["ケーキ", "ハンバーガー", "お弁当", "おにぎり", "魚"],
  自転車: ["バイク", "車", "三輪車", "スクーター", "タイヤ"],
  ロケット: ["鉛筆", "ニンジン", "東京タワー", "矢印", "飛行機"],
  ひまわり: ["太陽", "目玉焼き", "扇風機", "花", "たんぽぽ"],
  ピアノ: ["テーブル", "本棚", "はしご", "キーボード", "オルガン"],
  虹: ["橋", "滑り台", "ベルト", "アーチ", "カラフルな線"],
  タコ: ["クラゲ", "太陽", "花", "イカ", "ヒトデ"],
  新幹線: ["電車", "バス", "飛行機", "ミサイル", "モノレール"],
  アイスクリーム: ["マイク", "電球", "風船", "キノコ", "ソフトクリーム"],
  恐竜: ["トカゲ", "ドラゴン", "犬", "カンガルー", "ティラノサウルス"],
  花火: ["星", "太陽", "爆発", "噴水", "打ち上げ花火"],
  ペンギン: ["雪だるま", "鳥", "ボウリングピン", "スーツの人", "アヒル"],
  UFO: ["帽子", "フリスビー", "目玉焼き", "土星", "円盤"],
};

// 汎用の間違い回答
const GENERIC_WRONG = [
  "何かの動物？",
  "食べ物かな",
  "建物っぽい",
  "乗り物だと思う",
  "丸い何か",
  "人の顔？",
  "花？",
];

export interface AIGuessResult {
  text: string;
  isCorrect: boolean;
}

export function getAIGuess(word: string, attemptNumber: number): AIGuessResult {
  // 試行3以降: 40%の確率で正解
  if (attemptNumber >= 3 && Math.random() < 0.4) {
    return { text: word, isCorrect: true };
  }
  // 試行5以降: 60%の確率で正解（デモ用にほぼ確実に当たる）
  if (attemptNumber >= 5 && Math.random() < 0.6) {
    return { text: word, isCorrect: true };
  }

  const wrongGuesses = WRONG_GUESSES[word] || GENERIC_WRONG;
  const index = attemptNumber % wrongGuesses.length;
  return { text: wrongGuesses[index], isCorrect: false };
}

export const AI_NICKNAME = "AI くん";
