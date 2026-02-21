"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSocket, destroySocket } from "@/lib/socket";
import Lobby from "@/components/Lobby";
import DrawingCanvas from "@/components/DrawingCanvas";
import ViewCanvas from "@/components/ViewCanvas";
import GuessingPanel from "@/components/GuessingPanel";
import GameHeader from "@/components/GameHeader";
import Scoreboard from "@/components/Scoreboard";
import type { GameMode } from "@/components/ModeSelect";
import type {
  GamePhase,
  LobbyUpdatePayload,
  GameStartPayload,
  RoundEndPayload,
  GameEndPayload,
  ScoreEntry,
} from "@/types/game";

export default function GamePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [players, setPlayers] = useState<
    { id: string; nickname: string; score: number }[]
  >([]);
  const [myId, setMyId] = useState<string>();
  const [round, setRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [drawerId, setDrawerId] = useState("");
  const [drawerNickname, setDrawerNickname] = useState("");
  const [word, setWord] = useState<string>();
  const [remaining, setRemaining] = useState(60);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [roundWord, setRoundWord] = useState("");
  const [finalScores, setFinalScores] = useState<ScoreEntry[]>([]);
  const [winner, setWinner] = useState("");
  const [connected, setConnected] = useState(false);

  const socket = getSocket();
  const isDrawer = myId === drawerId;

  const handleStartGame = useCallback((mode: GameMode) => {
    // 全モード共通: サーバーに mode 付きで emit → サーバーが全員をリダイレクト
    socket.emit("start_game_mode", { mode });
  }, [socket]);

  const handleReturnToLobby = useCallback(() => {
    socket.emit("return_to_lobby");
  }, [socket]);

  useEffect(() => {
    const nickname = sessionStorage.getItem("nickname");
    if (!nickname) {
      router.push("/");
      return;
    }

    socket.connect();

    socket.on("connect", () => {
      setMyId(socket.id);
      setConnected(true);
      socket.emit("join", { nickname });
    });

    socket.on("lobby_update", (data: LobbyUpdatePayload) => {
      setPlayers(data.players);
      setPhase((prev) => (prev === "game_end" ? "lobby" : prev));
    });

    // モード2/3選択時: サーバーからの全員リダイレクト
    socket.on("redirect", ({ path }: { path: string }) => {
      router.push(path);
    });

    socket.on("game_start", (data: GameStartPayload) => {
      setPhase("playing");
      setRound(data.round);
      setTotalRounds(data.totalRounds);
      setDrawerId(data.drawerId);
      setDrawerNickname(data.drawerNickname);
      setRemaining(data.timeLimit);
      setWord(undefined);
    });

    socket.on("your_word", (data: { word: string }) => {
      setWord(data.word);
    });

    socket.on("timer_tick", (data: { remaining: number }) => {
      setRemaining(data.remaining);
    });

    socket.on("round_end", (data: RoundEndPayload) => {
      setPhase("round_end");
      setScores(data.scores);
      setRoundWord(data.word);
    });

    socket.on("game_end", (data: GameEndPayload) => {
      setPhase("game_end");
      setFinalScores(data.finalScores);
      setWinner(data.winner);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("reconnect" as string, () => {
      setMyId(socket.id);
      setConnected(true);
      socket.emit("join", { nickname });
    });

    return () => {
      destroySocket();
    };
  }, [router, socket]);

  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--text-dim)] text-lg">接続中...</p>
        </div>
      </div>
    );
  }

  if (phase === "lobby") {
    return (
      <Lobby
        players={players}
        onStartGame={handleStartGame}
        myId={myId}
      />
    );
  }

  if (phase === "round_end") {
    return <Scoreboard scores={scores} word={roundWord} />;
  }

  if (phase === "game_end") {
    return (
      <Scoreboard
        scores={finalScores}
        isGameEnd
        winner={winner}
        onReturnToLobby={handleReturnToLobby}
      />
    );
  }

  // playing phase
  return (
    <div className="min-h-screen flex flex-col p-2 sm:p-3 gap-2 sm:gap-3 max-w-7xl mx-auto">
      <GameHeader
        round={round}
        totalRounds={totalRounds}
        drawerNickname={drawerNickname}
        remaining={remaining}
        word={isDrawer ? word : undefined}
      />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-2 sm:gap-3 min-h-0">
        <div className="min-h-0">
          {isDrawer ? (
            <DrawingCanvas socket={socket} />
          ) : (
            <ViewCanvas socket={socket} />
          )}
        </div>

        <div className="min-h-0">
          <GuessingPanel socket={socket} disabled={isDrawer} />
        </div>
      </div>
    </div>
  );
}
