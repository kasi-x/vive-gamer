import type { Server } from "socket.io";
import type { SketchPhase, SketchSubject } from "../types/game";
import { SKETCH_SUBJECTS } from "../types/game";

const SHOW_TIME = 3;
const DRAW_TIME = 45;
const COMPOSITE_TIME = 5;
const COMPOSITE_INTERVAL = 15; // 15秒ごとに合成
const TOTAL_ROUNDS = 3;

interface SketchPlayer {
  id: string;
  nickname: string;
  score: number;
  connected: boolean;
}

interface SketchRoom {
  players: Map<string, SketchPlayer>;
  phase: SketchPhase;
  timer: ReturnType<typeof setInterval> | null;
  compositeTimer: ReturnType<typeof setInterval> | null;
  remaining: number;
  currentRound: number;
  totalRounds: number;
  currentSubject: SketchSubject | null;
  usedSubjects: string[];
  // 各プレイヤーの全ストローク
  playerStrokes: Map<string, { points: { x: number; y: number }[]; color: string; width: number }[]>;
  votes: Map<string, string>; // voterId → targetPlayerId
  roundScores: Map<string, number>; // ラウンドごとの得票
}

const room: SketchRoom = {
  players: new Map(),
  phase: "lobby",
  timer: null,
  compositeTimer: null,
  remaining: 0,
  currentRound: 0,
  totalRounds: TOTAL_ROUNDS,
  currentSubject: null,
  usedSubjects: [],
  playerStrokes: new Map(),
  votes: new Map(),
  roundScores: new Map(),
};

function getPlayerList() {
  return Array.from(room.players.values()).map((p) => ({
    id: p.id,
    nickname: p.nickname,
    score: p.score,
  }));
}

function broadcastLobby(io: Server) {
  io.emit("sketch:lobby_update", { players: getPlayerList() });
}

function clearTimers() {
  if (room.timer) {
    clearInterval(room.timer);
    room.timer = null;
  }
  if (room.compositeTimer) {
    clearInterval(room.compositeTimer);
    room.compositeTimer = null;
  }
}

function pickSubject(): SketchSubject {
  const available = SKETCH_SUBJECTS.filter((s) => !room.usedSubjects.includes(s.id));
  const pool = available.length > 0 ? available : SKETCH_SUBJECTS;
  const subject = pool[Math.floor(Math.random() * pool.length)];
  room.usedSubjects.push(subject.id);
  return subject;
}

function startCountdown(io: Server, seconds: number, onEnd: () => void) {
  clearTimers();
  room.remaining = seconds;
  io.emit("sketch:timer_tick", { remaining: room.remaining });

  room.timer = setInterval(() => {
    room.remaining--;
    io.emit("sketch:timer_tick", { remaining: room.remaining });
    if (room.remaining <= 0) {
      clearTimers();
      onEnd();
    }
  }, 1000);
}

// === フェーズ遷移 ===

function startRound(io: Server) {
  room.currentRound++;
  room.currentSubject = pickSubject();
  room.playerStrokes.clear();
  room.votes.clear();

  // 各プレイヤーのストローク配列を初期化
  for (const id of room.players.keys()) {
    room.playerStrokes.set(id, []);
  }

  showIncomplete(io);
}

function showIncomplete(io: Server) {
  room.phase = "show_incomplete";

  io.emit("sketch:phase", {
    phase: "show_incomplete",
    subject: room.currentSubject,
    round: room.currentRound,
    totalRounds: room.totalRounds,
    timeLimit: SHOW_TIME,
  });

  setTimeout(() => startDrawing(io), SHOW_TIME * 1000);
}

function startDrawing(io: Server) {
  room.phase = "drawing";

  io.emit("sketch:phase", {
    phase: "drawing",
    subject: room.currentSubject,
    round: room.currentRound,
    totalRounds: room.totalRounds,
    timeLimit: DRAW_TIME,
  });

  // 15秒ごとに全ストロークを合成ブロードキャスト
  room.compositeTimer = setInterval(() => {
    broadcastComposite(io);
  }, COMPOSITE_INTERVAL * 1000);

  startCountdown(io, DRAW_TIME, () => {
    if (room.compositeTimer) {
      clearInterval(room.compositeTimer);
      room.compositeTimer = null;
    }
    showCompositeReveal(io);
  });
}

function broadcastComposite(io: Server) {
  // 全プレイヤーのストロークを集約
  const allStrokes: { playerId: string; strokes: { points: { x: number; y: number }[]; color: string; width: number }[] }[] = [];
  for (const [id, strokes] of room.playerStrokes) {
    const player = room.players.get(id);
    allStrokes.push({ playerId: id, strokes });
  }

  io.emit("sketch:composite", { allStrokes });
}

function showCompositeReveal(io: Server) {
  room.phase = "composite_reveal";

  // 最終合成をブロードキャスト
  const allStrokes: { playerId: string; nickname: string; strokes: { points: { x: number; y: number }[]; color: string; width: number }[] }[] = [];
  for (const [id, strokes] of room.playerStrokes) {
    const player = room.players.get(id);
    allStrokes.push({
      playerId: id,
      nickname: player?.nickname || "???",
      strokes,
    });
  }

  io.emit("sketch:phase", {
    phase: "composite_reveal",
    allStrokes,
    subject: room.currentSubject,
    round: room.currentRound,
    totalRounds: room.totalRounds,
    timeLimit: COMPOSITE_TIME,
  });

  setTimeout(() => startVoting(io), COMPOSITE_TIME * 1000);
}

function startVoting(io: Server) {
  room.phase = "voting";
  room.votes.clear();

  const playerList = Array.from(room.players.values()).map((p) => ({
    id: p.id,
    nickname: p.nickname,
  }));

  io.emit("sketch:phase", {
    phase: "voting",
    players: playerList,
    round: room.currentRound,
    totalRounds: room.totalRounds,
  });
}

function tallyVotes(io: Server) {
  room.phase = "result";

  const voteCounts = new Map<string, number>();
  for (const targetId of room.votes.values()) {
    voteCounts.set(targetId, (voteCounts.get(targetId) || 0) + 1);
  }

  // スコア加算: 1票 = 100点
  for (const [playerId, count] of voteCounts) {
    const player = room.players.get(playerId);
    if (player) {
      player.score += count * 100;
    }
  }

  const scores = Array.from(room.players.values())
    .map((p) => ({ id: p.id, nickname: p.nickname, score: p.score }))
    .sort((a, b) => b.score - a.score);

  io.emit("sketch:phase", {
    phase: "result",
    scores,
    voteCounts: Object.fromEntries(voteCounts),
    round: room.currentRound,
    totalRounds: room.totalRounds,
  });

  // 次ラウンドへ or ゲーム終了
  if (room.currentRound >= room.totalRounds) {
    setTimeout(() => endGame(io), 4000);
  } else {
    setTimeout(() => startRound(io), 4000);
  }
}

function endGame(io: Server) {
  room.phase = "game_end";

  const finalScores = Array.from(room.players.values())
    .map((p) => ({ nickname: p.nickname, score: p.score }))
    .sort((a, b) => b.score - a.score);

  io.emit("sketch:phase", {
    phase: "game_end",
    finalScores,
    winner: finalScores[0]?.nickname || "",
  });
}

function resetGame() {
  clearTimers();
  room.phase = "lobby";
  room.currentRound = 0;
  room.currentSubject = null;
  room.usedSubjects = [];
  room.playerStrokes.clear();
  room.votes.clear();
  room.roundScores.clear();
  for (const p of room.players.values()) {
    p.score = 0;
  }
}

export function registerSketchHandlers(io: Server, socket: import("socket.io").Socket) {
  socket.on("sketch:join", ({ nickname }: { nickname: string }) => {
    room.players.set(socket.id, {
      id: socket.id,
      nickname,
      score: 0,
      connected: true,
    });
    broadcastLobby(io);
    console.log(`[スケッチ] 参加: ${nickname}`);
  });

  socket.on("sketch:start_game", () => {
    if (room.phase !== "lobby") return;
    if (room.players.size < 2) return;
    resetGame();
    for (const p of room.players.values()) p.score = 0;
    startRound(io);
  });

  socket.on("sketch:draw", (data: { points: { x: number; y: number }[]; color: string; width: number }) => {
    if (room.phase !== "drawing") return;
    const strokes = room.playerStrokes.get(socket.id);
    if (strokes) {
      strokes.push(data);
    }
  });

  socket.on("sketch:vote", ({ targetPlayerId }: { targetPlayerId: string }) => {
    if (room.phase !== "voting") return;
    if (targetPlayerId === socket.id) return;
    room.votes.set(socket.id, targetPlayerId);

    if (room.votes.size >= room.players.size) {
      tallyVotes(io);
    }
  });

  socket.on("sketch:return_to_lobby", () => {
    resetGame();
    broadcastLobby(io);
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
