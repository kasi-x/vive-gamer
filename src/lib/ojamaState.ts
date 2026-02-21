import type { Server } from "socket.io";
import { pickOjamaWord, normalizeJapanese, type OjamaWord } from "./ojamaWords";

const ROUND_TIME = 20;
const TOTAL_ROUNDS = 5;
const SPLAT_MAX = 5;
const ROOM = "mode:ojama";

interface OjamaPlayer {
  id: string;
  nickname: string;
  score: number;
  connected: boolean;
  splatCount: number;
}

interface OjamaRoom {
  players: Map<string, OjamaPlayer>;
  phase: "lobby" | "countdown" | "playing" | "round_end" | "game_end";
  currentRound: number;
  currentWord: OjamaWord | null;
  usedWords: string[];
  timer: ReturnType<typeof setInterval> | null;
  countdownTimer: ReturnType<typeof setTimeout> | null;
  remaining: number;
  roundWinnerId: string | null;
}

const room: OjamaRoom = {
  players: new Map(),
  phase: "lobby",
  currentRound: 0,
  currentWord: null,
  usedWords: [],
  timer: null,
  countdownTimer: null,
  remaining: ROUND_TIME,
  roundWinnerId: null,
};

function getPlayerList() {
  return Array.from(room.players.values()).map((p) => ({
    id: p.id,
    nickname: p.nickname,
    score: p.score,
  }));
}

function broadcastLobby(io: Server) {
  io.to(ROOM).emit("ojama:lobby_update", { players: getPlayerList() });
}

function clearTimers() {
  if (room.timer) { clearInterval(room.timer); room.timer = null; }
  if (room.countdownTimer) { clearTimeout(room.countdownTimer); room.countdownTimer = null; }
}

function getDifficulty(round: number): 1 | 2 | 3 {
  if (round <= 2) return 1;
  if (round <= 4) return 2;
  return 3;
}

function startCountdown(io: Server) {
  room.phase = "countdown";
  room.currentRound++;
  room.roundWinnerId = null;

  // 全員のスプラットをリセット
  for (const p of room.players.values()) {
    p.splatCount = 0;
  }

  const difficulty = getDifficulty(room.currentRound);
  room.currentWord = pickOjamaWord(room.usedWords, difficulty);
  room.usedWords.push(room.currentWord.word);

  io.to(ROOM).emit("ojama:countdown", {
    round: room.currentRound,
    totalRounds: TOTAL_ROUNDS,
  });

  // 3秒カウントダウン後にラウンド開始
  let count = 3;
  io.to(ROOM).emit("ojama:countdown_tick", { count });

  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      io.to(ROOM).emit("ojama:countdown_tick", { count });
    } else {
      clearInterval(interval);
      startRound(io);
    }
  }, 1000);

  room.countdownTimer = setTimeout(() => {}, 3000);
}

function startRound(io: Server) {
  room.phase = "playing";
  room.remaining = ROUND_TIME;

  io.to(ROOM).emit("ojama:start", {
    round: room.currentRound,
    totalRounds: TOTAL_ROUNDS,
    hint: room.currentWord!.hint,
    difficulty: room.currentWord!.difficulty,
    timeLimit: ROUND_TIME,
  });

  room.timer = setInterval(() => {
    room.remaining--;
    io.to(ROOM).emit("ojama:timer_tick", { remaining: room.remaining });
    if (room.remaining <= 0) {
      endRound(io);
    }
  }, 1000);
}

function endRound(io: Server) {
  if (room.phase !== "playing") return;
  clearTimers();
  room.phase = "round_end";

  const scores = Array.from(room.players.values())
    .map((p) => ({ id: p.id, nickname: p.nickname, score: p.score }))
    .sort((a, b) => b.score - a.score);

  io.to(ROOM).emit("ojama:round_end", {
    word: room.currentWord!.word,
    winnerId: room.roundWinnerId,
    winnerNickname: room.roundWinnerId ? room.players.get(room.roundWinnerId)?.nickname : null,
    scores,
  });

  if (room.currentRound >= TOTAL_ROUNDS) {
    setTimeout(() => endGame(io), 3000);
  } else {
    setTimeout(() => startCountdown(io), 3000);
  }
}

function endGame(io: Server) {
  room.phase = "game_end";

  const finalScores = Array.from(room.players.values())
    .map((p) => ({ id: p.id, nickname: p.nickname, score: p.score }))
    .sort((a, b) => b.score - a.score);

  io.to(ROOM).emit("ojama:game_end", {
    finalScores,
    winner: finalScores[0]?.nickname || "",
  });
}

function resetRoom() {
  clearTimers();
  room.phase = "lobby";
  room.currentRound = 0;
  room.currentWord = null;
  room.usedWords = [];
  room.remaining = ROUND_TIME;
  room.roundWinnerId = null;
  for (const p of room.players.values()) {
    p.score = 0;
    p.splatCount = 0;
  }
}

export function registerOjamaHandlers(io: Server, socket: import("socket.io").Socket) {
  socket.on("ojama:join", ({ nickname }: { nickname: string }) => {
    socket.join(ROOM);

    if (room.players.has(socket.id)) {
      room.players.get(socket.id)!.connected = true;
      broadcastLobby(io);
      return;
    }

    room.players.set(socket.id, {
      id: socket.id,
      nickname,
      score: 0,
      connected: true,
      splatCount: 0,
    });
    broadcastLobby(io);
    console.log(`[おじゃま] 参加: ${nickname} (${socket.id})`);
  });

  socket.on("ojama:start_game", () => {
    if (room.phase !== "lobby") return;
    if (room.players.size < 2) return;
    resetRoom();
    startCountdown(io);
  });

  socket.on("ojama:guess", ({ text }: { text: string }) => {
    if (room.phase !== "playing") return;
    if (!room.currentWord) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const normalized = normalizeJapanese(text);
    const answer = normalizeJapanese(room.currentWord.word);

    if (normalized === answer) {
      // 正解
      room.roundWinnerId = socket.id;
      const timeBonus = Math.round(50 * (room.remaining / ROUND_TIME));
      const earned = 100 + timeBonus;
      player.score += earned;

      io.to(ROOM).emit("ojama:correct", {
        playerId: socket.id,
        nickname: player.nickname,
        earned,
      });

      // 相手にスプラット送信
      for (const [id, p] of room.players) {
        if (id !== socket.id && p.connected && p.splatCount < SPLAT_MAX) {
          p.splatCount++;
          io.to(id).emit("ojama:splat", {
            fromNickname: player.nickname,
            splatId: Date.now() + Math.random(),
          });
        }
      }

      // 正解したプレイヤーのスプラット1個消去
      if (player.splatCount > 0) {
        player.splatCount--;
        io.to(socket.id).emit("ojama:clear_splat");
      }

      endRound(io);
    } else {
      // 不正解
      io.to(socket.id).emit("ojama:wrong");
    }
  });

  socket.on("ojama:return_to_lobby", () => {
    if (room.phase === "game_end") {
      resetRoom();
      broadcastLobby(io);
    }
  });

  socket.on("disconnect", () => {
    const player = room.players.get(socket.id);
    if (player) {
      player.connected = false;
      if (room.phase === "lobby") {
        room.players.delete(socket.id);
      }
      broadcastLobby(io);
    }
  });
}
