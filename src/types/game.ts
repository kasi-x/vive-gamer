export type GamePhase = "lobby" | "playing" | "round_end" | "game_end";

export interface Player {
  id: string;
  nickname: string;
  score: number;
  hasDrawn: boolean;
  connected: boolean;
  comboCount: number;
}

export interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

export interface GuessMessage {
  nickname: string;
  text: string;
  isCorrect: boolean;
  isAI: boolean;
  timestamp: number;
}

export interface RoundState {
  round: number;
  totalRounds: number;
  drawerId: string;
  drawerNickname: string;
  word: string;
  timeLimit: number;
  remaining: number;
}

export interface ScoreEntry {
  nickname: string;
  score: number;
  roundDelta: number;
  timeBonus?: number;
  comboMultiplier?: number;
  isFirstGuesser?: boolean;
}

export interface CorrectGuessPayload {
  nickname: string;
  isAI: boolean;
  timeBonus: number;
  comboMultiplier: number;
  isFirstGuesser: boolean;
  totalEarned: number;
}

// サウンドエフェクト種別
export type SoundEffect =
  | "correct"
  | "firstGuess"
  | "wrong"
  | "aiCorrect"
  | "timerTick"
  | "roundStart"
  | "gameEnd"
  | "combo"
  | "inkDepleted"
  | "splatHit"
  | "vsIntro"
  | "buzzIn";

// インク設定
export interface InkConfig {
  maxInk: number;
  maxStrokes: number | null;
}

// インク状態ペイロード
export interface InkUpdatePayload {
  inkRemaining: number;
  maxInk: number;
  strokesUsed: number;
  maxStrokes: number | null;
}

// Socket event payloads
export interface DrawPayload {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

export interface LobbyUpdatePayload {
  players: Pick<Player, "id" | "nickname" | "score">[];
}

export interface GameStartPayload {
  round: number;
  totalRounds: number;
  drawerId: string;
  drawerNickname: string;
  timeLimit: number;
}

export interface RoundEndPayload {
  word: string;
  scores: ScoreEntry[];
}

export interface GameEndPayload {
  finalScores: ScoreEntry[];
  winner: string;
}

// ===== モード② プロンプト・テレポート =====

export type TeleportPhase =
  | "lobby"
  | "prompt_write"
  | "ai_generating"
  | "describe"
  | "ai_generating_2"
  | "reveal"
  | "voting"
  | "result";

export const STYLE_CARDS = [
  "80年代レトロ",
  "粘土細工",
  "サイバーパンク",
  "水彩画",
  "ドット絵",
  "浮世絵",
  "アメコミ",
  "パステル",
] as const;

export type StyleCard = (typeof STYLE_CARDS)[number];

export interface TeleportChainItem {
  playerId: string;
  nickname: string;
  originalPrompt: string;
  styleCard: StyleCard;
  mockImage1: string; // base64 SVG
  description: string;
  mockImage2: string; // base64 SVG
}

// ===== モード③ スピード・スケッチ修正 =====

export type SketchPhase =
  | "lobby"
  | "show_incomplete"
  | "drawing"
  | "composite_reveal"
  | "voting"
  | "result"
  | "game_end";

export interface SketchSubject {
  id: string;
  name: string;
  instruction: string;
}

export const SKETCH_SUBJECTS: SketchSubject[] = [
  { id: "face", name: "顔", instruction: "目・鼻・口・髪を描こう！" },
  { id: "house", name: "家", instruction: "窓・ドア・屋根を描こう！" },
  { id: "animal", name: "動物", instruction: "足・顔・尻尾を描こう！" },
  { id: "rocket", name: "ロケット", instruction: "本体・炎・窓を描こう！" },
  { id: "fish", name: "魚", instruction: "ヒレ・目・模様を描こう！" },
];
