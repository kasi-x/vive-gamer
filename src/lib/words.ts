export const WORDS = [
  "猫",
  "富士山",
  "寿司",
  "自転車",
  "ロケット",
  "ひまわり",
  "ピアノ",
  "虹",
  "タコ",
  "新幹線",
  "アイスクリーム",
  "恐竜",
  "花火",
  "ペンギン",
  "UFO",
];

export function pickRandomWord(exclude: string[] = []): string {
  const available = WORDS.filter((w) => !exclude.includes(w));
  if (available.length === 0) return WORDS[Math.floor(Math.random() * WORDS.length)];
  return available[Math.floor(Math.random() * available.length)];
}
