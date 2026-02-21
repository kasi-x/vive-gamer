"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { soundManager } from "@/lib/sounds";
import Lobby from "@/components/Lobby";
import DrawingCanvas from "@/components/DrawingCanvas";
import ViewCanvas from "@/components/ViewCanvas";
import GuessingPanel from "@/components/GuessingPanel";
import GameHeader from "@/components/GameHeader";
import Scoreboard from "@/components/Scoreboard";
import ConfettiOverlay from "@/components/ConfettiOverlay";
import ScorePopup from "@/components/ScorePopup";
import type { GameMode } from "@/components/ModeSelect";
import type {
  GamePhase,
  LobbyUpdatePayload,
  GameStartPayload,
  RoundEndPayload,
  GameEndPayload,
  ScoreEntry,
  CorrectGuessPayload,
} from "@/types/game";

export default function GamePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [players, setPlayers] = useState<
    { id: string; nickname: string; score: number }[]
  >([]);
  const [myId, setMyId] = useState<string>();
  const [myNickname, setMyNickname] = useState<string>();
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
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showVignette, setShowVignette] = useState(false);

  const socketRef = useRef(getSocket());
  const socket = socketRef.current;
  const isDrawer = myId === drawerId;
  const prevRemainingRef = useRef(60);

  const handleStartGame = useCallback((mode: GameMode) => {
    socketRef.current.emit("start_game_mode", { mode });
  }, []);

  const handleReturnToLobby = useCallback(() => {
    socketRef.current.emit("return_to_lobby");
  }, []);

  const handleToggleSound = useCallback(() => {
    const enabled = soundManager?.toggle() ?? false;
    setSoundEnabled(enabled);
  }, []);

  useEffect(() => {
    const nickname = sessionStorage.getItem("nickname");
    if (!nickname) {
      router.push("/");
      return;
    }
    setMyNickname(nickname);

    const s = socketRef.current;
    let joined = false;

    const doJoin = () => {
      if (joined) return;
      joined = true;
      setMyId(s.id);
      setConnected(true);
      s.emit("join", { nickname });
    };

    const onConnect = () => doJoin();

    if (s.connected) {
      doJoin();
    } else {
      s.connect();
    }

    s.on("connect", onConnect);

    s.on("lobby_update", (data: LobbyUpdatePayload) => {
      setPlayers(data.players);
      setPhase((prev) => (prev === "game_end" ? "lobby" : prev));
    });

    s.on("redirect", ({ path }: { path: string }) => {
      router.push(path);
    });

    s.on("game_start", (data: GameStartPayload) => {
      setPhase("playing");
      setRound(data.round);
      setTotalRounds(data.totalRounds);
      setDrawerId(data.drawerId);
      setDrawerNickname(data.drawerNickname);
      setRemaining(data.timeLimit);
      setWord(undefined);
      setShowVignette(false);
      prevRemainingRef.current = data.timeLimit;
      soundManager?.roundStart();
    });

    s.on("your_word", (data: { word: string }) => {
      setWord(data.word);
    });

    s.on("timer_tick", (data: { remaining: number }) => {
      setRemaining(data.remaining);
      // タイマー危険域のサウンド
      if (data.remaining <= 10 && data.remaining > 0 && data.remaining < prevRemainingRef.current) {
        soundManager?.timerTick();
      }
      // ビネット表示
      if (data.remaining <= 5) {
        setShowVignette(true);
      }
      prevRemainingRef.current = data.remaining;
    });

    s.on("correct_guess", (data: CorrectGuessPayload) => {
      if (!data.isAI && data.nickname === nickname) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 2000);
      }
    });

    s.on("round_end", (data: RoundEndPayload) => {
      setPhase("round_end");
      setScores(data.scores);
      setRoundWord(data.word);
      setShowVignette(false);
    });

    s.on("game_end", (data: GameEndPayload) => {
      setPhase("game_end");
      setFinalScores(data.finalScores);
      setWinner(data.winner);
      setShowVignette(false);
      soundManager?.gameEnd();
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    });

    s.on("disconnect", () => {
      setConnected(false);
    });

    return () => {
      s.off("connect", onConnect);
      s.off("lobby_update");
      s.off("redirect");
      s.off("game_start");
      s.off("your_word");
      s.off("timer_tick");
      s.off("correct_guess");
      s.off("round_end");
      s.off("game_end");
      s.off("disconnect");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

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
      <>
        <ConfettiOverlay active={showConfetti} />
        <Scoreboard
          scores={finalScores}
          isGameEnd
          winner={winner}
          onReturnToLobby={handleReturnToLobby}
        />
      </>
    );
  }

  // playing phase
  return (
    <>
      <ConfettiOverlay active={showConfetti} />
      <ScorePopup />
      {showVignette && <div className="vignette-overlay" />}

      <div className="min-h-screen flex flex-col p-2 sm:p-3 gap-2 sm:gap-3 max-w-7xl mx-auto">
        <GameHeader
          round={round}
          totalRounds={totalRounds}
          drawerNickname={drawerNickname}
          remaining={remaining}
          word={isDrawer ? word : undefined}
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
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
            <GuessingPanel socket={socket} disabled={isDrawer} myNickname={myNickname} />
          </div>
        </div>
      </div>
    </>
  );
}
