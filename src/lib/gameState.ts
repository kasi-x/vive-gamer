import type { Server } from "socket.io";
import type { Player, ScoreEntry } from "../types/game";
import { pickRandomWord } from "./words";
import { getAIGuess, AI_NICKNAME } from "./mockAI";

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
  remaining: number;
  correctGuessers: Set<string>;
  aiGuessCount: number;
  aiCorrect: boolean;
  roundScoreDeltas: Map<string, number>;
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
  remaining: ROUND_TIME,
  correctGuessers: new Set(),
  aiGuessCount: 0,
  aiCorrect: false,
  roundScoreDeltas: new Map(),
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
}

function startRound(io: Server) {
  room.phase = "playing";
  room.currentRound++;
  room.correctGuessers.clear();
  room.aiGuessCount = 0;
  room.aiCorrect = false;
  room.roundScoreDeltas.clear();

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

  // AI推測タイマー開始（最初の推測は5秒後）
  setTimeout(() => {
    if (room.phase !== "playing") return;
    doAIGuess(io);

    room.aiTimer = setInterval(() => {
      if (room.phase !== "playing" || room.aiCorrect) return;
      doAIGuess(io);
    }, AI_GUESS_INTERVAL);
  }, 5000);
}

function doAIGuess(io: Server) {
  if (room.aiCorrect || room.phase !== "playing") return;

  const result = getAIGuess(room.currentWord, room.aiGuessCount);
  room.aiGuessCount++;

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
  if (playerId === room.drawerId) return; // 描き手は推測不可
  if (room.correctGuessers.has(playerId)) return; // 既に正解済み

  const player = room.players.get(playerId);
  if (!player) return;

  const isCorrect = text.trim() === room.currentWord;

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
  room.roundScoreDeltas.clear();

  // スコアリセット
  for (const player of room.players.values()) {
    player.score = 0;
    player.hasDrawn = false;
  }
}

export function setupSocketHandlers(io: Server) {
  io.on("connection", (socket) => {
    console.log(`接続: ${socket.id}`);

    socket.on("join", ({ nickname }: { nickname: string }) => {
      const player: Player = {
        id: socket.id,
        nickname,
        score: 0,
        hasDrawn: false,
        connected: true,
      };
      room.players.set(socket.id, player);
      broadcastLobby(io);
      console.log(`参加: ${nickname} (${socket.id})`);
    });

    socket.on("start_game", () => {
      if (room.phase !== "lobby") return;
      if (room.players.size < 2) return;

      // 描き手の順番をシャッフル
      const playerIds = Array.from(room.players.keys());
      room.drawerOrder = playerIds.sort(() => Math.random() - 0.5);
      room.totalRounds = room.drawerOrder.length;
      room.drawerIndex = 0;

      resetGame();
      room.drawerOrder = playerIds.sort(() => Math.random() - 0.5);
      room.totalRounds = room.drawerOrder.length;

      startRound(io);
    });

    socket.on("draw", (data: { points: { x: number; y: number }[]; color: string; width: number }) => {
      if (room.phase !== "playing") return;
      if (socket.id !== room.drawerId) return;
      socket.broadcast.emit("draw", data);
    });

    socket.on("clear_canvas", () => {
      if (room.phase !== "playing") return;
      if (socket.id !== room.drawerId) return;
      socket.broadcast.emit("clear_canvas");
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
        console.log(`切断: ${player.nickname}`);
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
  });
}
