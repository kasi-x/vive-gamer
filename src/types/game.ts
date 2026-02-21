export type GamePhase = "lobby" | "playing" | "round_end" | "game_end";

export interface Player {
  id: string;
  nickname: string;
  score: number;
  hasDrawn: boolean;
  connected: boolean;
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
