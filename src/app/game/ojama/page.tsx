"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { soundManager } from "@/lib/sounds";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import ConfettiOverlay from "@/components/ConfettiOverlay";
import OjamaScreen from "@/components/OjamaScreen";
import type { Splat } from "@/components/InkSplatOverlay";

type OjamaPhase = "lobby" | "countdown" | "playing" | "round_end" | "game_end";

interface OjamaPlayerInfo {
  id: string;
  nickname: string;
  score: number;
}

const SPLAT_LIMIT = 5;

export default function OjamaPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<OjamaPhase>("lobby");
  const [players, setPlayers] = useState<OjamaPlayerInfo[]>([]);
  const [myId, setMyId] = useState<string>();
  const [myNickname, setMyNickname] = useState<string>();
  const [round, setRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(5);
  const [remaining, setRemaining] = useState(20);
  const [hint, setHint] = useState("");
  const [difficulty, setDifficulty] = useState(1);
  const [countdownNum, setCountdownNum] = useState(3);
  const [input, setInput] = useState("");
  const [shaking, setShaking] = useState(false);
  const [mySplats, setMySplats] = useState<Splat[]>([]);
  const [opponentSplats, setOpponentSplats] = useState<Splat[]>([]);
  const [roundResult, setRoundResult] = useState<{ word: string; winnerNickname: string | null } | null>(null);
  const [finalScores, setFinalScores] = useState<OjamaPlayerInfo[]>([]);
  const [winner, setWinner] = useState("");
  const [connected, setConnected] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const socketRef = useRef(getSocket());
  const socket = socketRef.current;

  const handleVoiceResult = useCallback((text: string) => {
    socket.emit("ojama:guess", { text });
  }, [socket]);

  const { listening, interim, supported, start: startVoice, stop: stopVoice } = useVoiceInput({
    onResult: handleVoiceResult,
  });

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
      s.emit("ojama:join", { nickname });
    };

    if (s.connected) doJoin();
    else s.connect();
    s.on("connect", doJoin);

    s.on("ojama:lobby_update", (data: { players: OjamaPlayerInfo[] }) => {
      setPlayers(data.players);
      if (data.players.length > 0) setPhase("lobby");
    });

    s.on("ojama:countdown", (data: { round: number; totalRounds: number }) => {
      setPhase("countdown");
      setRound(data.round);
      setTotalRounds(data.totalRounds);
      setInput("");
      setMySplats([]);
      setOpponentSplats([]);
      setRoundResult(null);
      soundManager?.vsIntro();
    });

    s.on("ojama:countdown_tick", (data: { count: number }) => {
      setCountdownNum(data.count);
      soundManager?.timerTick();
    });

    s.on("ojama:start", (data: { hint: string; difficulty: number; timeLimit: number }) => {
      setPhase("playing");
      setHint(data.hint);
      setDifficulty(data.difficulty);
      setRemaining(data.timeLimit);
      soundManager?.roundStart();
    });

    s.on("ojama:timer_tick", (data: { remaining: number }) => {
      setRemaining(data.remaining);
      if (data.remaining <= 5 && data.remaining > 0) {
        soundManager?.timerTick();
      }
    });

    s.on("ojama:correct", (data: { playerId: string; nickname: string; earned: number }) => {
      if (data.playerId === s.id) {
        soundManager?.buzzIn();
      } else {
        soundManager?.aiCorrect();
      }
    });

    s.on("ojama:wrong", () => {
      soundManager?.wrong();
      setShaking(true);
      setTimeout(() => setShaking(false), 300);
    });

    s.on("ojama:splat", (data: { splatId: number }) => {
      soundManager?.splatHit();
      const newSplat: Splat = {
        id: data.splatId,
        x: 15 + Math.random() * 70,
        y: 15 + Math.random() * 70,
        rotation: Math.random() * 360,
        fading: false,
      };
      setMySplats((prev) => [...prev.slice(-SPLAT_LIMIT + 1), newSplat]);

      const fadeTime = 3000 + Math.random() * 2000;
      setTimeout(() => {
        setMySplats((prev) =>
          prev.map((sp) => (sp.id === data.splatId ? { ...sp, fading: true } : sp))
        );
        setTimeout(() => {
          setMySplats((prev) => prev.filter((sp) => sp.id !== data.splatId));
        }, 500);
      }, fadeTime);
    });

    s.on("ojama:clear_splat", () => {
      setMySplats((prev) => {
        if (prev.length === 0) return prev;
        return prev.slice(1);
      });
    });

    s.on("ojama:round_end", (data: { word: string; winnerNickname: string | null; scores: OjamaPlayerInfo[] }) => {
      setPhase("round_end");
      setRoundResult({ word: data.word, winnerNickname: data.winnerNickname });
      setPlayers(data.scores);
    });

    s.on("ojama:game_end", (data: { finalScores: OjamaPlayerInfo[]; winner: string }) => {
      setPhase("game_end");
      setFinalScores(data.finalScores);
      setWinner(data.winner);
      soundManager?.gameEnd();
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    });

    s.on("disconnect", () => setConnected(false));

    return () => {
      s.off("connect", doJoin);
      s.off("ojama:lobby_update");
      s.off("ojama:countdown");
      s.off("ojama:countdown_tick");
      s.off("ojama:start");
      s.off("ojama:timer_tick");
      s.off("ojama:correct");
      s.off("ojama:wrong");
      s.off("ojama:splat");
      s.off("ojama:clear_splat");
      s.off("ojama:round_end");
      s.off("ojama:game_end");
      s.off("disconnect");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    socket.emit("ojama:guess", { text: trimmed });
    setInput("");
  };

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

  // ロビー
  if (phase === "lobby") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold mb-1">
              <span className="text-[var(--accent)]">おじゃま</span>バトル
            </h1>
            <p className="text-[var(--text-dim)]">穴埋めクイズ対戦！</p>
          </div>

          <div className="bg-[var(--surface)] rounded-2xl p-6 mb-4">
            <h2 className="text-sm text-[var(--text-dim)] mb-3 uppercase tracking-wider">
              プレイヤー ({players.length})
            </h2>
            <div className="space-y-2">
              {players.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg ${
                    p.id === myId
                      ? "bg-[var(--accent)]/20 border border-[var(--accent)]/30"
                      : "bg-[var(--surface-light)]"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-[var(--accent-2)] flex items-center justify-center text-sm font-bold">
                    {p.nickname[0]}
                  </div>
                  <span className="font-medium">{p.nickname}</span>
                  {p.id === myId && (
                    <span className="text-xs text-[var(--accent)] ml-auto">あなた</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => socket.emit("ojama:start_game")}
            disabled={players.length < 2}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent)]/80 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-lg transition"
          >
            {players.length >= 2
              ? "バトル開始！"
              : `あと${2 - players.length}人必要です`}
          </button>
        </div>
      </div>
    );
  }

  // カウントダウン
  if (phase === "countdown") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-[var(--text-dim)] text-lg mb-2">
            ラウンド {round}/{totalRounds}
          </p>
          <div className="text-8xl font-black text-[var(--accent)] animate-vs-flash">
            {countdownNum}
          </div>
        </div>
      </div>
    );
  }

  // ラウンド終了
  if (phase === "round_end" && roundResult) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg animate-pop-in">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2">ラウンド終了</h2>
            <p className="text-lg text-[var(--text-dim)]">
              答え: <span className="text-[var(--warning)] font-bold text-2xl">{roundResult.word}</span>
            </p>
            {roundResult.winnerNickname && (
              <p className="text-[var(--success)] font-bold mt-1">
                {roundResult.winnerNickname} が正解！
              </p>
            )}
          </div>

          <div className="bg-[var(--surface)] rounded-2xl p-4 space-y-2">
            {players.map((p, i) => (
              <div
                key={p.nickname}
                className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[var(--surface-light)] animate-slide-up"
                style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
              >
                <span className="text-lg font-bold text-[var(--text-dim)] w-8">{i + 1}.</span>
                <span className="flex-1 font-medium">{p.nickname}</span>
                <span className="text-xl font-bold tabular-nums">{p.score}</span>
              </div>
            ))}
          </div>

          <p className="text-center text-[var(--text-dim)] text-sm mt-4">
            次のラウンドまでお待ちください...
          </p>
        </div>
      </div>
    );
  }

  // ゲーム終了
  if (phase === "game_end") {
    return (
      <>
        <ConfettiOverlay active={showConfetti} />
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-lg animate-pop-in">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold mb-2">ゲーム終了！</h2>
              <p className="text-xl text-[var(--warning)]">{winner} の勝利！</p>
            </div>

            <div className="bg-[var(--surface)] rounded-2xl p-4 space-y-2">
              {finalScores.map((p, i) => (
                <div
                  key={p.nickname}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl animate-slide-up ${
                    i === 0 ? "bg-[var(--warning)]/20 border border-[var(--warning)]/30" : "bg-[var(--surface-light)]"
                  }`}
                  style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
                >
                  <span className="text-lg font-bold text-[var(--text-dim)] w-8">{i + 1}.</span>
                  <span className="flex-1 font-medium">{p.nickname}</span>
                  <span className="text-xl font-bold tabular-nums">{p.score}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                socket.emit("ojama:return_to_lobby");
                router.push("/game");
              }}
              className="w-full mt-4 bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-white font-bold py-3 rounded-xl text-lg transition"
            >
              ロビーに戻る
            </button>
          </div>
        </div>
      </>
    );
  }

  // プレイ中 — 2分割レイアウト
  const difficultyLabel = difficulty === 1 ? "かんたん" : difficulty === 2 ? "ふつう" : "むずかしい";
  const difficultyColor = difficulty === 1 ? "text-[var(--success)]" : difficulty === 2 ? "text-[var(--warning)]" : "text-[var(--accent)]";

  const me = players.find((p) => p.id === myId);
  const opponents = players.filter((p) => p.id !== myId);

  return (
    <div className="min-h-screen flex flex-col p-2 sm:p-3 max-w-6xl mx-auto">
      {/* ヘッダー: ラウンド + 難易度 + タイマー */}
      <div className="bg-[var(--surface)] rounded-xl px-4 py-2 flex items-center justify-between mb-2">
        <div className="text-sm text-[var(--text-dim)]">
          ラウンド{" "}
          <span className="text-[var(--text)] font-bold text-lg">{round}/{totalRounds}</span>
        </div>
        <div className={`text-xs font-bold ${difficultyColor}`}>{difficultyLabel}</div>
        <div className={`text-3xl font-mono font-bold tabular-nums ${
          remaining <= 5 ? "text-[var(--accent)] animate-timer-pulse" : "text-[var(--text)]"
        }`}>
          {remaining}s
        </div>
      </div>

      {/* 2分割レイアウト: PC横並び / モバイル縦積み */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3 min-h-0">
        {/* 自分の画面 */}
        {me && (
          <div className="min-h-0 flex flex-col" style={{ minHeight: "0" }}>
            <OjamaScreen
              nickname={me.nickname}
              score={me.score}
              hint={hint}
              splats={mySplats}
              input={input}
              onInputChange={setInput}
              onSubmit={handleSubmit}
              shaking={shaking}
              isMe={true}
              listening={listening}
              interim={interim}
              voiceSupported={supported}
              onStartVoice={startVoice}
              onStopVoice={stopVoice}
            />
          </div>
        )}

        {/* 相手の画面 */}
        {opponents.map((opp) => (
          <div key={opp.id} className="min-h-0 flex flex-col" style={{ minHeight: "0" }}>
            <OjamaScreen
              nickname={opp.nickname}
              score={opp.score}
              hint={hint}
              splats={opponentSplats}
              input=""
              onInputChange={() => {}}
              onSubmit={(e) => e.preventDefault()}
              shaking={false}
              isMe={false}
            />
          </div>
        ))}
      </div>

      {/* ビネット */}
      {remaining <= 5 && <div className="vignette-overlay" />}
    </div>
  );
}
