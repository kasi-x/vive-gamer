import type { Server } from "socket.io";
import type { Player, ScoreEntry } from "../types/game";
import { pickRandomWord } from "./words";
import { guessFromImage } from "./geminiAI";
import { getAIGuess as getMockGuess, AI_NICKNAME } from "./mockAI";

const ROUND_TIME = 60;
const AI_GUESS_INTERVAL = 8000;
const COMBO_MULTIPLIERS = [1.0, 1.5, 2.0, 2.5, 3.0];
const MAX_INK = 15000;
const MAX_STROKES: number | null = null; // nullで無制限

interface GameRoom {
  players: Map<string, Player>;
  phase: "lobby" | "playing" | "round_end" | "game_end";
  currentRound: number;
  totalRounds: number;
  drawerId: string | null;
  currentWord: string;
  usedWords: string[];
  drawerOrder: string[];
  drawerIndex: number;
  timer: ReturnType<typeof setInterval> | null;
  aiTimer: ReturnType<typeof setInterval> | null;
  aiInitTimer: ReturnType<typeof setTimeout> | null;
  remaining: number;
  correctGuessers: Set<string>;
  aiGuessCount: number;
  aiCorrect: boolean;
  aiGuessing: boolean;
  roundScoreDeltas: Map<string, number>;
  roundScoreDetails: Map<string, { timeBonus: number; comboMultiplier: number; isFirstGuesser: boolean }>;
  strokeHistory: { points: { x: number; y: number }[]; color: string; width: number }[];
  latestSnapshot: string | null;
  firstGuesserId: string | null;
  // インク制限
  inkRemaining: number;
  strokesUsed: number;
  inkDepleted: boolean;
  inkUsedAtFirstGuess: number | null; // 最初の正解時のインク使用量
}

const room: GameRoom = {
  players: new Map(),
  phase: "lobby",
  currentRound: 0,
  totalRounds: 0,
  drawerId: null,
  currentWord: "",
  usedWords: [],
  drawerOrder: [],
  drawerIndex: 0,
  timer: null,
  aiTimer: null,
  aiInitTimer: null,
  remaining: ROUND_TIME,
  correctGuessers: new Set(),
  aiGuessCount: 0,
  aiCorrect: false,
  aiGuessing: false,
  roundScoreDeltas: new Map(),
  roundScoreDetails: new Map(),
  strokeHistory: [],
  latestSnapshot: null,
  firstGuesserId: null,
  inkRemaining: MAX_INK,
  strokesUsed: 0,
  inkDepleted: false,
  inkUsedAtFirstGuess: null,
};

function getPlayerList() {
  return Array.from(room.players.values()).map((p) => ({
    id: p.id,
    nickname: p.nickname,
    score: p.score,
  }));
}

function broadcastLobby(io: Server) {
  io.emit("lobby_update", { players: getPlayerList() });
}

function clearTimers() {
  if (room.timer) { clearInterval(room.timer); room.timer = null; }
  if (room.aiTimer) { clearInterval(room.aiTimer); room.aiTimer = null; }
  if (room.aiInitTimer) { clearTimeout(room.aiInitTimer); room.aiInitTimer = null; }
}

const normalize = (s: string) => s.trim().normalize("NFC");

function calculateStrokeDistance(points: { x: number; y: number }[]): number {
  let dist = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    dist += Math.sqrt(dx * dx + dy * dy);
  }
  return dist;
}

function startRound(io: Server) {
  room.phase = "playing";
  room.currentRound++;
  room.correctGuessers.clear();
  room.aiGuessCount = 0;
  room.aiCorrect = false;
  room.aiGuessing = false;
  room.roundScoreDeltas.clear();
  room.roundScoreDetails.clear();
  room.strokeHistory = [];
  room.latestSnapshot = null;
  room.firstGuesserId = null;
  room.inkRemaining = MAX_INK;
  room.strokesUsed = 0;
  room.inkDepleted = false;
  room.inkUsedAtFirstGuess = null;

  room.drawerId = room.drawerOrder[room.drawerIndex];
  room.drawerIndex++;

  room.currentWord = pickRandomWord(room.usedWords);
  room.usedWords.push(room.currentWord);

  const drawer = room.players.get(room.drawerId);
  if (!drawer) return;

  io.emit("game_start", {
    round: room.currentRound,
    totalRounds: room.totalRounds,
    drawerId: room.drawerId,
    drawerNickname: drawer.nickname,
    timeLimit: ROUND_TIME,
  });

  io.to(room.drawerId).emit("your_word", { word: room.currentWord });

  // インク初期状態を描き手に送信
  io.to(room.drawerId).emit("ink_update", {
    inkRemaining: room.inkRemaining,
    maxInk: MAX_INK,
    strokesUsed: room.strokesUsed,
    maxStrokes: MAX_STROKES,
    strokesRemaining: MAX_STROKES !== null ? MAX_STROKES - room.strokesUsed : null,
  });

  room.remaining = ROUND_TIME;
  room.timer = setInterval(() => {
    room.remaining--;
    io.emit("timer_tick", { remaining: room.remaining });
    if (room.remaining <= 0) {
      endRound(io);
    }
  }, 1000);

  // AI推測タイマー
  const AI_SCAN_DURATION = 1500;
  const triggerAIScan = () => {
    if (room.phase !== "playing" || room.aiCorrect) return;
    io.emit("ai_scan");
    setTimeout(() => doAIGuess(io), AI_SCAN_DURATION);
  };

  room.aiInitTimer = setTimeout(() => {
    room.aiInitTimer = null;
    if (room.phase !== "playing") return;
    triggerAIScan();
    room.aiTimer = setInterval(() => triggerAIScan(), AI_GUESS_INTERVAL);
  }, 5000);
}

async function doAIGuess(io: Server) {
  if (room.aiCorrect || room.phase !== "playing" || room.aiGuessing) return;
  room.aiGuessing = true;

  let result;
  try {
    if (room.latestSnapshot) {
      result = await guessFromImage(room.latestSnapshot, room.currentWord, room.aiGuessCount);
    } else {
      result = getMockGuess(room.currentWord, room.aiGuessCount);
    }
  } catch {
    room.aiGuessing = false;
    return;
  }
  room.aiGuessing = false;
  room.aiGuessCount++;

  if (room.aiCorrect || room.phase !== "playing") return;

  if (result.isCorrect) {
    room.aiCorrect = true;
    io.emit("correct_guess", {
      nickname: AI_NICKNAME,
      isAI: true,
      timeBonus: 0,
      comboMultiplier: 1,
      isFirstGuesser: false,
      totalEarned: 0,
    });

    if (room.drawerId) {
      const drawer = room.players.get(room.drawerId);
      if (drawer) {
        drawer.score -= 30;
        const prev = room.roundScoreDeltas.get(room.drawerId) || 0;
        room.roundScoreDeltas.set(room.drawerId, prev - 30);
      }
    }
  } else {
    io.emit("new_guess", {
      nickname: AI_NICKNAME,
      text: result.text,
      isAI: true,
    });
  }
}

function handleGuess(io: Server, playerId: string, text: string) {
  if (room.phase !== "playing") return;
  if (playerId === room.drawerId) return;
  if (room.correctGuessers.has(playerId)) return;

  const player = room.players.get(playerId);
  if (!player) return;

  const isCorrect = normalize(text) === normalize(room.currentWord);

  if (isCorrect) {
    room.correctGuessers.add(playerId);

    // 1番乗り判定
    const isFirstGuesser = room.firstGuesserId === null;
    if (isFirstGuesser) {
      room.firstGuesserId = playerId;
      // 最初の正解時のインク使用量を記録
      room.inkUsedAtFirstGuess = MAX_INK - room.inkRemaining;
    }

    // コンボ
    player.comboCount++;
    const comboIdx = Math.min(player.comboCount - 1, COMBO_MULTIPLIERS.length - 1);
    const comboMultiplier = COMBO_MULTIPLIERS[comboIdx];

    // タイムボーナス
    const timeBonus = Math.round(100 * (room.remaining / ROUND_TIME));

    // 1番乗りボーナス
    const firstBonus = isFirstGuesser ? 50 : 0;

    // 合計得点
    const totalEarned = Math.round((100 + timeBonus + firstBonus) * comboMultiplier);

    player.score += totalEarned;
    const prevGuesser = room.roundScoreDeltas.get(playerId) || 0;
    room.roundScoreDeltas.set(playerId, prevGuesser + totalEarned);
    room.roundScoreDetails.set(playerId, { timeBonus, comboMultiplier, isFirstGuesser });

    // 描き手ボーナス
    if (room.drawerId) {
      const drawer = room.players.get(room.drawerId);
      if (drawer) {
        const drawerBonus = 50;
        drawer.score += drawerBonus;
        const prevDrawer = room.roundScoreDeltas.get(room.drawerId) || 0;
        room.roundScoreDeltas.set(room.drawerId, prevDrawer + drawerBonus);
      }
    }

    io.emit("correct_guess", {
      nickname: player.nickname,
      isAI: false,
      timeBonus,
      comboMultiplier,
      isFirstGuesser,
      totalEarned,
    });

    // 全人間プレイヤーが正解したらラウンド終了
    const guessers = Array.from(room.players.values()).filter(
      (p) => p.id !== room.drawerId && p.connected
    );
    if (guessers.every((p) => room.correctGuessers.has(p.id))) {
      endRound(io);
    }
  } else {
    io.emit("new_guess", {
      nickname: player.nickname,
      text,
      isAI: false,
    });
    // 不正解フィードバックを送信者のみに
    io.to(playerId).emit("wrong_guess");
  }
}

function endRound(io: Server) {
  if (room.phase !== "playing") return;
  clearTimers();
  room.phase = "round_end";

  // AI不正解ボーナス
  if (!room.aiCorrect && room.drawerId) {
    const drawer = room.players.get(room.drawerId);
    if (drawer) {
      // インク効率ボーナス
      const inkUsed = MAX_INK - room.inkRemaining;
      const efficiencyMultiplier = 1 + (1 - inkUsed / MAX_INK);
      const aiBonus = Math.round(100 * efficiencyMultiplier);
      drawer.score += aiBonus;
      const prev = room.roundScoreDeltas.get(room.drawerId) || 0;
      room.roundScoreDeltas.set(room.drawerId, prev + aiBonus);
    }
  }

  // 不正解者のコンボリセット
  for (const [id, player] of room.players) {
    if (id !== room.drawerId && !room.correctGuessers.has(id)) {
      player.comboCount = 0;
    }
  }

  const scores: ScoreEntry[] = Array.from(room.players.values()).map((p) => {
    const details = room.roundScoreDetails.get(p.id);
    return {
      nickname: p.nickname,
      score: p.score,
      roundDelta: room.roundScoreDeltas.get(p.id) || 0,
      timeBonus: details?.timeBonus,
      comboMultiplier: details?.comboMultiplier,
      isFirstGuesser: details?.isFirstGuesser,
    };
  });

  io.emit("round_end", {
    word: room.currentWord,
    scores: scores.sort((a, b) => b.score - a.score),
  });

  if (room.drawerIndex >= room.drawerOrder.length) {
    setTimeout(() => endGame(io), 4000);
  } else {
    setTimeout(() => startRound(io), 4000);
  }
}

function endGame(io: Server) {
  room.phase = "game_end";

  const finalScores: ScoreEntry[] = Array.from(room.players.values())
    .map((p) => ({ nickname: p.nickname, score: p.score, roundDelta: 0 }))
    .sort((a, b) => b.score - a.score);

  io.emit("game_end", {
    finalScores,
    winner: finalScores[0]?.nickname || "",
  });
}

function resetGame() {
  clearTimers();
  room.phase = "lobby";
  room.currentRound = 0;
  room.totalRounds = 0;
  room.drawerId = null;
  room.currentWord = "";
  room.usedWords = [];
  room.drawerOrder = [];
  room.drawerIndex = 0;
  room.remaining = ROUND_TIME;
  room.correctGuessers.clear();
  room.aiGuessCount = 0;
  room.aiCorrect = false;
  room.aiGuessing = false;
  room.roundScoreDeltas.clear();
  room.roundScoreDetails.clear();
  room.strokeHistory = [];
  room.latestSnapshot = null;
  room.firstGuesserId = null;
  room.inkRemaining = MAX_INK;
  room.strokesUsed = 0;
  room.inkDepleted = false;
  room.inkUsedAtFirstGuess = null;

  for (const player of room.players.values()) {
    player.score = 0;
    player.hasDrawn = false;
    player.comboCount = 0;
  }
}

export function registerBattleHandlers(io: Server, socket: import("socket.io").Socket) {
  socket.on("join", ({ nickname }: { nickname: string }) => {
    if (room.players.has(socket.id)) {
      room.players.get(socket.id)!.connected = true;
      broadcastLobby(io);
      return;
    }
    const player: Player = {
      id: socket.id,
      nickname,
      score: 0,
      hasDrawn: false,
      connected: true,
      comboCount: 0,
    };
    room.players.set(socket.id, player);
    broadcastLobby(io);

    if (room.phase === "playing" && room.strokeHistory.length > 0) {
      socket.emit("canvas_state", { strokes: room.strokeHistory });
    }

    console.log(`[バトル] 参加: ${nickname} (${socket.id})`);
  });

  socket.on("start_game_mode", ({ mode }: { mode: string }) => {
    if (room.phase !== "lobby") return;
    if (room.players.size < 2) return;

    if (mode === "battle") {
      resetGame();
      const playerIds = Array.from(room.players.keys());
      room.drawerOrder = playerIds.sort(() => Math.random() - 0.5);
      room.totalRounds = room.drawerOrder.length;
      startRound(io);
    } else {
      const pathMap: Record<string, string> = {
        teleport: "/game/teleport",
        sketch: "/game/sketch",
        ojama: "/game/ojama",
      };
      const path = pathMap[mode] || "/game/teleport";
      io.emit("redirect", { path });
      setTimeout(() => { room.players.clear(); }, 500);
    }
  });

  socket.on("start_game", () => {
    if (room.phase !== "lobby") return;
    if (room.players.size < 2) return;
    resetGame();
    const playerIds = Array.from(room.players.keys());
    room.drawerOrder = playerIds.sort(() => Math.random() - 0.5);
    room.totalRounds = room.drawerOrder.length;
    startRound(io);
  });

  socket.on("draw", (data: { points: { x: number; y: number }[]; color: string; width: number }) => {
    if (room.phase !== "playing") return;
    if (socket.id !== room.drawerId) return;
    if (room.inkDepleted) return;

    // ストローク数制限チェック
    if (MAX_STROKES !== null && room.strokesUsed >= MAX_STROKES) {
      room.inkDepleted = true;
      socket.emit("ink_depleted");
      return;
    }

    // インク消費計算
    const dist = calculateStrokeDistance(data.points);
    room.inkRemaining -= dist;
    room.strokesUsed++;

    if (room.inkRemaining <= 0) {
      room.inkRemaining = 0;
      room.inkDepleted = true;
      socket.emit("ink_depleted");
    }

    // インク状態を描き手に送信
    socket.emit("ink_update", {
      inkRemaining: room.inkRemaining,
      maxInk: MAX_INK,
      strokesUsed: room.strokesUsed,
      maxStrokes: MAX_STROKES,
      strokesRemaining: MAX_STROKES !== null ? MAX_STROKES - room.strokesUsed : null,
    });

    room.strokeHistory.push(data);
    socket.broadcast.emit("draw", data);
  });

  socket.on("clear_canvas", () => {
    if (room.phase !== "playing") return;
    if (socket.id !== room.drawerId) return;
    room.strokeHistory = [];
    // クリアしてもインクは回復しない
    socket.broadcast.emit("clear_canvas");
  });

  socket.on("canvas_snapshot", ({ imageBase64 }: { imageBase64: string }) => {
    if (room.phase !== "playing") return;
    if (socket.id !== room.drawerId) return;
    room.latestSnapshot = imageBase64;
  });

  socket.on("guess", ({ text }: { text: string }) => {
    handleGuess(io, socket.id, text);
  });

  socket.on("return_to_lobby", () => {
    if (room.phase === "game_end") {
      resetGame();
      broadcastLobby(io);
    }
  });

  socket.on("disconnect", () => {
    const player = room.players.get(socket.id);
    if (player) {
      console.log(`[バトル] 切断: ${player.nickname}`);
      player.connected = false;
      if (room.phase === "lobby") {
        room.players.delete(socket.id);
      }
      broadcastLobby(io);
      if (room.phase === "playing" && socket.id === room.drawerId) {
        endRound(io);
      }
    }
  });
}
