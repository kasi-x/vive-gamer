"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { soundManager } from "@/lib/sounds";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import ConfettiOverlay from "@/components/ConfettiOverlay";
import VoiceButton from "@/components/VoiceButton";

type OjamaPhase = "lobby" | "countdown" | "playing" | "round_end" | "game_end";

interface OjamaPlayerInfo {
  id: string;
  nickname: string;
  score: number;
}

export default function OjamaPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<OjamaPhase>("lobby");
  const [players, setPlayers] = useState<OjamaPlayerInfo[]>([]);
  const [myId, setMyId] = useState<string>();
  const [myNickname, setMyNickname] = useState<string>();
  const [round, setRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(5);
  const [remaining, setRemaining] = useState(30);
  const [hint, setHint] = useState("");
  const [difficulty, setDifficulty] = useState(1);
  const [image, setImage] = useState<string | null>(null);
  const [countdownNum, setCountdownNum] = useState(3);
  const [input, setInput] = useState("");
  const [shaking, setShaking] = useState(false);
  const [megaSplatActive, setMegaSplatActive] = useState(false);
  const [roundResult, setRoundResult] = useState<{
    answer: string;
    description: string;
    winnerNickname: string | null;
  } | null>(null);
  const [finalScores, setFinalScores] = useState<OjamaPlayerInfo[]>([]);
  const [winner, setWinner] = useState("");
  const [connected, setConnected] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [correctFlash, setCorrectFlash] = useState<string | null>(null);

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
      setMegaSplatActive(false);
      setRoundResult(null);
      setImage(null);
      soundManager?.vsIntro();
    });

    s.on("ojama:countdown_tick", (data: { count: number }) => {
      setCountdownNum(data.count);
      soundManager?.timerTick();
    });

    s.on("ojama:start", (data: {
      hint: string;
      difficulty: number;
      image: string;
      timeLimit: number;
    }) => {
      setPhase("playing");
      setHint(data.hint);
      setDifficulty(data.difficulty);
      setImage(data.image);
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
      setCorrectFlash(data.nickname);
      if (data.playerId === s.id) {
        soundManager?.buzzIn();
      }
      setTimeout(() => setCorrectFlash(null), 2000);
    });

    s.on("ojama:wrong", () => {
      soundManager?.wrong();
      setShaking(true);
      setTimeout(() => setShaking(false), 300);
    });

    s.on("ojama:mega_splat", () => {
      soundManager?.splatHit();
      setMegaSplatActive(true);
    });

    s.on("ojama:round_end", (data: {
      answer: string;
      description: string;
      image: string;
      winnerNickname: string | null;
      scores: OjamaPlayerInfo[];
    }) => {
      setPhase("round_end");
      setRoundResult({
        answer: data.answer,
        description: data.description,
        winnerNickname: data.winnerNickname,
      });
      setImage(data.image);
      setPlayers(data.scores);
      setMegaSplatActive(false);
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
      s.off("ojama:mega_splat");
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
            <p className="text-[var(--text-dim)]">合体生物の名前を当てろ！</p>
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
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold mb-2">ラウンド終了</h2>
            <p className="text-3xl font-black text-[var(--warning)] mb-1">
              {roundResult.answer}
            </p>
            <p className="text-sm text-[var(--text-dim)] mb-2">
              {roundResult.description}
            </p>
            {roundResult.winnerNickname ? (
              <p className="text-[var(--success)] font-bold text-lg">
                {roundResult.winnerNickname} が正解！
              </p>
            ) : (
              <p className="text-[var(--text-dim)] font-bold">
                誰も正解できず...
              </p>
            )}
          </div>

          {/* 正解の画像をもう一度表示 */}
          {image && (
            <div className="flex justify-center mb-4">
              <img
                src={image}
                alt={roundResult.answer}
                className="w-48 h-48 object-cover rounded-xl border-2 border-[var(--surface-light)]"
              />
            </div>
          )}

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

  // プレイ中
  const difficultyLabel = difficulty === 1 ? "かんたん" : difficulty === 2 ? "ふつう" : "むずかしい";
  const difficultyColor = difficulty === 1 ? "text-[var(--success)]" : difficulty === 2 ? "text-[var(--warning)]" : "text-[var(--accent)]";

  return (
    <div className="min-h-screen flex flex-col p-3 sm:p-4 max-w-2xl mx-auto relative">
      {/* メガスプラット（負けた時のインクぶちまけ） */}
      {megaSplatActive && <MegaSplatOverlay />}

      {/* 正解フラッシュ */}
      {correctFlash && (
        <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div className="text-4xl font-black text-[var(--success)] animate-pop-in drop-shadow-lg">
            {correctFlash} 正解！
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <div className="bg-[var(--surface)] rounded-xl px-4 py-3 flex items-center justify-between mb-3">
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

      {/* スコアバー */}
      <div className="flex gap-2 mb-3">
        {players.map((p) => (
          <div
            key={p.id || p.nickname}
            className={`flex-1 text-center px-2 py-1.5 rounded-lg text-sm ${
              p.id === myId
                ? "bg-[var(--accent)]/20 border border-[var(--accent)]/30"
                : "bg-[var(--surface)]"
            }`}
          >
            <div className="font-bold truncate">{p.nickname}</div>
            <div className="text-lg font-bold tabular-nums">{p.score}</div>
          </div>
        ))}
      </div>

      {/* 合体生物の画像 */}
      <div className="relative flex-1 flex flex-col items-center justify-center bg-[var(--surface)] rounded-2xl p-4 mb-3 min-h-[280px]">
        {image && (
          <img
            src={image}
            alt="合体生物"
            className="w-full max-w-[300px] h-auto max-h-[240px] object-contain rounded-xl mb-3"
          />
        )}
        {/* ヒント */}
        <p className="text-2xl sm:text-3xl font-mono font-black tracking-[0.3em] text-[var(--warning)]">
          {hint}
        </p>
      </div>

      {/* 入力エリア */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className={`flex-1 flex gap-2 ${shaking ? "animate-shake" : ""}`}>
          <input
            type="text"
            value={listening ? interim : input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="この生物の名前は？"
            disabled={listening || megaSplatActive}
            className="flex-1 bg-[var(--surface)] text-[var(--text)] rounded-xl px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-[var(--accent)] transition"
            autoFocus
          />
          {supported && (
            <VoiceButton
              listening={listening}
              supported={supported}
              onStart={startVoice}
              onStop={stopVoice}
            />
          )}
        </div>
        <button
          type="submit"
          disabled={(!input.trim() && !listening) || megaSplatActive}
          className="bg-[var(--accent)] hover:bg-[var(--accent)]/80 disabled:opacity-40 text-white font-bold px-6 py-3 rounded-xl text-lg transition"
        >
          回答
        </button>
      </form>

      {/* ビネット */}
      {remaining <= 5 && <div className="vignette-overlay" />}
    </div>
  );
}

/** 負けた時に画面いっぱいにインクがぶちまけられるオーバーレイ */
function MegaSplatOverlay() {
  const splats = useRef(
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: 5 + Math.random() * 90,
      y: 5 + Math.random() * 90,
      size: 80 + Math.random() * 160,
      rotation: Math.random() * 360,
      delay: Math.random() * 0.4,
      color: ["#1a1a2e", "#16213e", "#0f3460", "#533483", "#e94560"][Math.floor(Math.random() * 5)],
    }))
  ).current;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      {splats.map((sp) => (
        <svg
          key={sp.id}
          className="absolute"
          style={{
            left: `${sp.x}%`,
            top: `${sp.y}%`,
            width: sp.size,
            height: sp.size,
            transform: `translate(-50%, -50%) rotate(${sp.rotation}deg) scale(0)`,
            animation: `mega-splat-in 0.3s ${sp.delay}s ease-out forwards`,
          }}
          viewBox="0 0 100 100"
        >
          <path
            d="M50 5 C60 20, 85 15, 80 35 C95 40, 90 65, 75 60 C80 80, 60 90, 50 80 C40 95, 15 85, 25 65 C5 70, 5 45, 20 40 C10 20, 30 10, 50 5Z"
            fill={sp.color}
            opacity={0.85}
          />
        </svg>
      ))}
      {/* 中央テキスト */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ animation: "mega-splat-text 0.5s 0.3s ease-out forwards", opacity: 0 }}
      >
        <p className="text-5xl font-black text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] -rotate-12">
          おじゃまっ！！
        </p>
      </div>
    </div>
  );
}
