import type { Server } from "socket.io";
import type { TeleportPhase, StyleCard, TeleportChainItem } from "../types/game";
import { STYLE_CARDS } from "../types/game";
import { generateMockImage } from "./mockImages";

const PROMPT_TIME = 30;
const AI_GEN_TIME = 3;
const DESCRIBE_TIME = 30;

interface TeleportPlayer {
  id: string;
  nickname: string;
  score: number;
  connected: boolean;
}

interface TeleportRoom {
  players: Map<string, TeleportPlayer>;
  phase: TeleportPhase;
  timer: ReturnType<typeof setInterval> | null;
  remaining: number;

  // ゲームデータ
  chainOrder: string[]; // シャッフル済み: chainOrder[i] は players[i] のプロンプトを説明する
  prompts: Map<string, string>;
  styleCards: Map<string, StyleCard>;
  mockImages1: Map<string, string>;
  descriptions: Map<string, string>; // key = 説明者のID
  mockImages2: Map<string, string>;
  votes: Map<string, string>; // voterId → chainOwnerId
  chains: TeleportChainItem[];
}

const room: TeleportRoom = {
  players: new Map(),
  phase: "lobby",
  timer: null,
  remaining: 0,
  chainOrder: [],
  prompts: new Map(),
  styleCards: new Map(),
  mockImages1: new Map(),
  descriptions: new Map(),
  mockImages2: new Map(),
  votes: new Map(),
  chains: [],
};

function getPlayerList() {
  return Array.from(room.players.values()).map((p) => ({
    id: p.id,
    nickname: p.nickname,
    score: p.score,
  }));
}

function broadcastLobby(io: Server) {
  io.emit("teleport:lobby_update", { players: getPlayerList() });
}

function clearTimer() {
  if (room.timer) {
    clearInterval(room.timer);
    room.timer = null;
  }
}

function startCountdown(io: Server, seconds: number, onEnd: () => void) {
  clearTimer();
  room.remaining = seconds;
  io.emit("teleport:timer_tick", { remaining: room.remaining });

  room.timer = setInterval(() => {
    room.remaining--;
    io.emit("teleport:timer_tick", { remaining: room.remaining });
    if (room.remaining <= 0) {
      clearTimer();
      onEnd();
    }
  }, 1000);
}

function assignStyleCards() {
  const cards = [...STYLE_CARDS];
  for (const id of room.players.keys()) {
    const idx = Math.floor(Math.random() * cards.length);
    room.styleCards.set(id, cards[idx % cards.length]);
  }
}

function buildChainOrder() {
  // プレイヤーIDをシャッフルして回し順を作成
  // chainOrder[i] が playerIds[i] のプロンプトを説明する
  const ids = Array.from(room.players.keys());
  const shuffled = [...ids].sort(() => Math.random() - 0.5);
  // 自分自身を説明しないようにずらす
  room.chainOrder = [];
  for (let i = 0; i < ids.length; i++) {
    room.chainOrder.push(shuffled[(i + 1) % shuffled.length]);
  }
}

// === フェーズ遷移 ===

function startPromptWrite(io: Server) {
  room.phase = "prompt_write";
  room.prompts.clear();
  assignStyleCards();
  buildChainOrder();

  const playerIds = Array.from(room.players.keys());
  // 各プレイヤーにスタイルカードを送信
  for (const id of playerIds) {
    io.to(id).emit("teleport:phase", {
      phase: "prompt_write",
      styleCard: room.styleCards.get(id),
      timeLimit: PROMPT_TIME,
    });
  }

  startCountdown(io, PROMPT_TIME, () => startAIGenerating1(io));
}

function startAIGenerating1(io: Server) {
  room.phase = "ai_generating";
  room.mockImages1.clear();

  // 未提出者にはデフォルトプロンプト
  for (const id of room.players.keys()) {
    if (!room.prompts.has(id)) {
      room.prompts.set(id, "不思議な風景");
    }
  }

  // モック画像生成
  for (const [id, prompt] of room.prompts) {
    const style = room.styleCards.get(id);
    room.mockImages1.set(id, generateMockImage(prompt, style));
  }

  io.emit("teleport:phase", { phase: "ai_generating", timeLimit: AI_GEN_TIME });

  setTimeout(() => startDescribe(io), AI_GEN_TIME * 1000);
}

function startDescribe(io: Server) {
  room.phase = "describe";
  room.descriptions.clear();

  const playerIds = Array.from(room.players.keys());

  // 各プレイヤーに、隣の人の画像を送る
  for (let i = 0; i < playerIds.length; i++) {
    const describerId = room.chainOrder[i];
    const originalOwnerId = playerIds[i];
    const image = room.mockImages1.get(originalOwnerId) || "";

    io.to(describerId).emit("teleport:phase", {
      phase: "describe",
      image,
      originalOwnerId,
      timeLimit: DESCRIBE_TIME,
    });
  }

  startCountdown(io, DESCRIBE_TIME, () => startAIGenerating2(io));
}

function startAIGenerating2(io: Server) {
  room.phase = "ai_generating_2";
  room.mockImages2.clear();

  const playerIds = Array.from(room.players.keys());

  // 未提出者にはデフォルト説明
  for (let i = 0; i < playerIds.length; i++) {
    const describerId = room.chainOrder[i];
    if (!room.descriptions.has(describerId)) {
      room.descriptions.set(describerId, "よくわからない画像");
    }
  }

  // 説明文からモック画像を生成
  for (const [describerId, desc] of room.descriptions) {
    room.mockImages2.set(describerId, generateMockImage(desc));
  }

  io.emit("teleport:phase", { phase: "ai_generating_2", timeLimit: AI_GEN_TIME });

  setTimeout(() => startReveal(io), AI_GEN_TIME * 1000);
}

function startReveal(io: Server) {
  room.phase = "reveal";
  room.votes.clear();

  // チェーンを構築
  const playerIds = Array.from(room.players.keys());
  room.chains = [];

  for (let i = 0; i < playerIds.length; i++) {
    const ownerId = playerIds[i];
    const describerId = room.chainOrder[i];
    const owner = room.players.get(ownerId)!;

    room.chains.push({
      playerId: ownerId,
      nickname: owner.nickname,
      originalPrompt: room.prompts.get(ownerId) || "",
      styleCard: room.styleCards.get(ownerId) || "80年代レトロ",
      mockImage1: room.mockImages1.get(ownerId) || "",
      description: room.descriptions.get(describerId) || "",
      mockImage2: room.mockImages2.get(describerId) || "",
    });
  }

  io.emit("teleport:phase", {
    phase: "reveal",
    chains: room.chains,
  });
}

function startVoting(io: Server) {
  room.phase = "voting";
  io.emit("teleport:phase", {
    phase: "voting",
    chains: room.chains,
  });
}

function tallyVotes(io: Server) {
  room.phase = "result";

  // 得票数をカウント
  const voteCounts = new Map<string, number>();
  for (const chainOwnerId of room.votes.values()) {
    voteCounts.set(chainOwnerId, (voteCounts.get(chainOwnerId) || 0) + 1);
  }

  // スコア加算: 1票 = 100点
  for (const [ownerId, count] of voteCounts) {
    const player = room.players.get(ownerId);
    if (player) {
      player.score += count * 100;
    }
  }

  const scores = Array.from(room.players.values())
    .map((p) => ({ nickname: p.nickname, score: p.score }))
    .sort((a, b) => b.score - a.score);

  io.emit("teleport:phase", {
    phase: "result",
    scores,
    voteCounts: Object.fromEntries(voteCounts),
  });
}

function resetGame() {
  clearTimer();
  room.phase = "lobby";
  room.chainOrder = [];
  room.prompts.clear();
  room.styleCards.clear();
  room.mockImages1.clear();
  room.descriptions.clear();
  room.mockImages2.clear();
  room.votes.clear();
  room.chains = [];
  for (const p of room.players.values()) {
    p.score = 0;
  }
}

export function registerTeleportHandlers(io: Server, socket: import("socket.io").Socket) {
  socket.on("teleport:join", ({ nickname }: { nickname: string }) => {
    room.players.set(socket.id, {
      id: socket.id,
      nickname,
      score: 0,
      connected: true,
    });
    broadcastLobby(io);
    console.log(`[テレポート] 参加: ${nickname}`);
  });

  socket.on("teleport:start_game", () => {
    if (room.phase !== "lobby") return;
    if (room.players.size < 2) return;
    resetGame();
    for (const p of room.players.values()) p.score = 0;
    startPromptWrite(io);
  });

  socket.on("teleport:submit_prompt", ({ prompt }: { prompt: string }) => {
    if (room.phase !== "prompt_write") return;
    room.prompts.set(socket.id, prompt.trim() || "不思議な風景");

    if (room.prompts.size >= room.players.size) {
      clearTimer();
      startAIGenerating1(io);
    }
  });

  socket.on("teleport:submit_description", ({ description }: { description: string }) => {
    if (room.phase !== "describe") return;
    room.descriptions.set(socket.id, description.trim() || "よくわからない画像");

    if (room.descriptions.size >= room.players.size) {
      clearTimer();
      startAIGenerating2(io);
    }
  });

  socket.on("teleport:start_voting", () => {
    if (room.phase !== "reveal") return;
    startVoting(io);
  });

  socket.on("teleport:vote", ({ chainOwnerId }: { chainOwnerId: string }) => {
    if (room.phase !== "voting") return;
    if (chainOwnerId === socket.id) return;
    room.votes.set(socket.id, chainOwnerId);

    if (room.votes.size >= room.players.size) {
      tallyVotes(io);
    }
  });

  socket.on("teleport:return_to_lobby", () => {
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
