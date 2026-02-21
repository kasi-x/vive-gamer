import type { Server } from "socket.io";
import type { Player, ScoreEntry } from "../types/game";
import { pickRandomWord } from "./words";
import { guessFromImage } from "./geminiAI";
import { getAIGuess as getMockGuess, AI_NICKNAME } from "./mockAI";

const ROUND_TIME = 60;
const AI_GUESS_INTERVAL = 8000; // AIは8秒ごとに推測

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
  aiGuessing: boolean; // API呼び出し中フラグ
  roundScoreDeltas: Map<string, number>;
  strokeHistory: { points: { x: number; y: number }[]; color: string; width: number }[];
  latestSnapshot: string | null;
}

// 単一ルームのゲーム状態
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
  strokeHistory: [],
  latestSnapshot: null,
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
  if (room.timer) {
    clearInterval(room.timer);
    room.timer = null;
  }
  if (room.aiTimer) {
    clearInterval(room.aiTimer);
    room.aiTimer = null;
  }
  if (room.aiInitTimer) {
    clearTimeout(room.aiInitTimer);
    room.aiInitTimer = null;
  }
}

const normalize = (s: string) => s.trim().normalize("NFC");

function startRound(io: Server) {
  room.phase = "playing";
  room.currentRound++;
  room.correctGuessers.clear();
  room.aiGuessCount = 0;
  room.aiCorrect = false;
  room.aiGuessing = false;
  room.roundScoreDeltas.clear();
  room.strokeHistory = [];
  room.latestSnapshot = null;

  // 次の描き手を選択
  room.drawerId = room.drawerOrder[room.drawerIndex];
  room.drawerIndex++;

  // お題を選択
  room.currentWord = pickRandomWord(room.usedWords);
  room.usedWords.push(room.currentWord);

  const drawer = room.players.get(room.drawerId);
  if (!drawer) return;

  // ラウンド開始を全員に通知
  io.emit("game_start", {
    round: room.currentRound,
    totalRounds: room.totalRounds,
    drawerId: room.drawerId,
    drawerNickname: drawer.nickname,
    timeLimit: ROUND_TIME,
  });

  // 描き手にだけお題を送信
  io.to(room.drawerId).emit("your_word", { word: room.currentWord });

  // タイマー開始
  room.remaining = ROUND_TIME;
  room.timer = setInterval(() => {
    room.remaining--;
    io.emit("timer_tick", { remaining: room.remaining });

    if (room.remaining <= 0) {
      endRound(io);
    }
  }, 1000);

  // AI推測タイマー開始（最初のスキャンは5秒後）
  // スキャン演出(1.5秒) → 推測実行の順序
  const AI_SCAN_DURATION = 1500;

  const triggerAIScan = () => {
    if (room.phase !== "playing" || room.aiCorrect) return;
    io.emit("ai_scan"); // クライアントにスキャン演出を通知
    setTimeout(() => doAIGuess(io), AI_SCAN_DURATION);
  };

  room.aiInitTimer = setTimeout(() => {
    room.aiInitTimer = null;
    if (room.phase !== "playing") return;
    triggerAIScan();

    room.aiTimer = setInterval(() => {
      triggerAIScan();
    }, AI_GUESS_INTERVAL);
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

  // 非同期処理中にラウンドが終わっていたら無視
  if (room.aiCorrect || room.phase !== "playing") return;

  if (result.isCorrect) {
    room.aiCorrect = true;
    io.emit("correct_guess", { nickname: AI_NICKNAME, isAI: true });

    // AI正解ペナルティ: 描き手 -30
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

    // スコアリング
    player.score += 100;
    const prevGuesser = room.roundScoreDeltas.get(playerId) || 0;
    room.roundScoreDeltas.set(playerId, prevGuesser + 100);

    if (room.drawerId) {
      const drawer = room.players.get(room.drawerId);
      if (drawer) {
        drawer.score += 50;
        const prevDrawer = room.roundScoreDeltas.get(room.drawerId) || 0;
        room.roundScoreDeltas.set(room.drawerId, prevDrawer + 50);
      }
    }

    io.emit("correct_guess", { nickname: player.nickname, isAI: false });

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
  }
}

function endRound(io: Server) {
  if (room.phase !== "playing") return; // 再入防止
  clearTimers();
  room.phase = "round_end";

  // AI不正解ボーナス
  if (!room.aiCorrect && room.drawerId) {
    const drawer = room.players.get(room.drawerId);
    if (drawer) {
      drawer.score += 100;
      const prev = room.roundScoreDeltas.get(room.drawerId) || 0;
      room.roundScoreDeltas.set(room.drawerId, prev + 100);
    }
  }

  const scores: ScoreEntry[] = Array.from(room.players.values()).map((p) => ({
    nickname: p.nickname,
    score: p.score,
    roundDelta: room.roundScoreDeltas.get(p.id) || 0,
  }));

  io.emit("round_end", {
    word: room.currentWord,
    scores: scores.sort((a, b) => b.score - a.score),
  });

  // 全員が描き終わったか確認
  if (room.drawerIndex >= room.drawerOrder.length) {
    setTimeout(() => endGame(io), 4000);
  } else {
    setTimeout(() => startRound(io), 4000);
  }
}

function endGame(io: Server) {
  room.phase = "game_end";

  const finalScores: ScoreEntry[] = Array.from(room.players.values())
    .map((p) => ({
      nickname: p.nickname,
      score: p.score,
      roundDelta: 0,
    }))
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
  room.strokeHistory = [];
  room.latestSnapshot = null;

  // スコアリセット
  for (const player of room.players.values()) {
    player.score = 0;
    player.hasDrawn = false;
  }
}

export function registerBattleHandlers(io: Server, socket: import("socket.io").Socket) {
  socket.on("join", ({ nickname }: { nickname: string }) => {
    // 同じsocket.idの重複joinを無視
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
    };
    room.players.set(socket.id, player);
    broadcastLobby(io);

    // プレイ中に参加した場合、キャンバス状態を送信
    if (room.phase === "playing" && room.strokeHistory.length > 0) {
      socket.emit("canvas_state", { strokes: room.strokeHistory });
    }

    console.log(`[バトル] 参加: ${nickname} (${socket.id})`);
  });

  // モード付きゲーム開始 → 全員を該当ページへリダイレクト
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
      // モード2/3: 全プレイヤーをリダイレクト後、ロビーをリセット
      const path = mode === "teleport" ? "/game/teleport" : "/game/sketch";
      io.emit("redirect", { path });
      // リダイレクト配信後にクリア（disconnectハンドラーとのレース回避）
      setTimeout(() => { room.players.clear(); }, 500);
    }
  });

  socket.on("start_game", () => {
    if (room.phase !== "lobby") return;
    if (room.players.size < 2) return;

    resetGame();

    // 描き手の順番をシャッフル
    const playerIds = Array.from(room.players.keys());
    room.drawerOrder = playerIds.sort(() => Math.random() - 0.5);
    room.totalRounds = room.drawerOrder.length;

    startRound(io);
  });

  socket.on("draw", (data: { points: { x: number; y: number }[]; color: string; width: number }) => {
    if (room.phase !== "playing") return;
    if (socket.id !== room.drawerId) return;
    room.strokeHistory.push(data);
    socket.broadcast.emit("draw", data);
  });

  socket.on("clear_canvas", () => {
    if (room.phase !== "playing") return;
    if (socket.id !== room.drawerId) return;
    room.strokeHistory = [];
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

      // ロビー中なら削除
      if (room.phase === "lobby") {
        room.players.delete(socket.id);
      }
      broadcastLobby(io);

      // 描き手が切断したらラウンド終了
      if (room.phase === "playing" && socket.id === room.drawerId) {
        endRound(io);
      }
    }
  });
}
