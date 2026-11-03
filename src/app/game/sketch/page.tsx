"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { soundManager } from "@/lib/sounds";
import ConfettiOverlay from "@/components/ConfettiOverlay";
import type { SketchSubject } from "@/types/game";

type Phase = "lobby" | "show_incomplete" | "drawing" | "composite_reveal" | "voting" | "result" | "game_end";

interface StrokeData {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

// 不完全画像の描画（実線=お題の土台、破線=描き足すべき場所のヒント）
function drawIncompleteImage(ctx: CanvasRenderingContext2D, subjectId: string) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.lineWidth = 3;

  const solid = () => {
    ctx.setLineDash([]);
    ctx.strokeStyle = "#888888";
  };
  const hint = () => {
    ctx.setLineDash([10, 10]);
    ctx.strokeStyle = "#c8c8c8";
  };

  ctx.beginPath();
  ctx.setLineDash([]);

  switch (subjectId) {
    case "face":
      solid();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 150, 0, Math.PI * 2);
      ctx.stroke();
      hint();
      ctx.beginPath();
      ctx.arc(w / 2 - 50, h / 2 - 40, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w / 2 + 50, h / 2 - 40, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w / 2, h / 2 - 10);
      ctx.lineTo(w / 2, h / 2 + 20);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2 + 45, 42, 0, Math.PI);
      ctx.stroke();
      break;
    case "house":
      solid();
      ctx.strokeRect(w / 2 - 120, h / 2 - 60, 240, 180);
      hint();
      ctx.beginPath();
      ctx.moveTo(w / 2 - 140, h / 2 - 60);
      ctx.lineTo(w / 2, h / 2 - 160);
      ctx.lineTo(w / 2 + 140, h / 2 - 60);
      ctx.closePath();
      ctx.stroke();
      ctx.strokeRect(w / 2 - 25, h / 2 + 40, 50, 80);
      ctx.strokeRect(w / 2 - 95, h / 2 - 30, 55, 50);
      break;
    case "animal":
      solid();
      ctx.beginPath();
      ctx.ellipse(w / 2 + 30, h / 2 + 20, 180, 100, 0, 0, Math.PI * 2);
      ctx.stroke();
      hint();
      ctx.beginPath();
      ctx.arc(w / 2 - 180, h / 2 - 40, 58, 0, Math.PI * 2);
      ctx.stroke();
      for (const lx of [w / 2 - 90, w / 2 - 30, w / 2 + 90, w / 2 + 150]) {
        ctx.beginPath();
        ctx.moveTo(lx, h / 2 + 105);
        ctx.lineTo(lx, h / 2 + 170);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(w / 2 + 205, h / 2 - 10);
      ctx.quadraticCurveTo(w / 2 + 260, h / 2 - 70, w / 2 + 230, h / 2 - 130);
      ctx.stroke();
      break;
    case "rocket":
      solid();
      ctx.beginPath();
      ctx.moveTo(w / 2, h / 2 - 160);
      ctx.lineTo(w / 2 + 80, h / 2 + 100);
      ctx.lineTo(w / 2 - 80, h / 2 + 100);
      ctx.closePath();
      ctx.stroke();
      hint();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2 - 30, 32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w / 2 - 80, h / 2 + 100);
      ctx.lineTo(w / 2 - 140, h / 2 + 160);
      ctx.lineTo(w / 2 - 40, h / 2 + 140);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w / 2 + 80, h / 2 + 100);
      ctx.lineTo(w / 2 + 140, h / 2 + 160);
      ctx.lineTo(w / 2 + 40, h / 2 + 140);
      ctx.stroke();
      break;
    case "fish":
      solid();
      ctx.beginPath();
      ctx.ellipse(w / 2 + 40, h / 2, 170, 90, 0, 0, Math.PI * 2);
      ctx.stroke();
      hint();
      ctx.beginPath();
      ctx.moveTo(w / 2 - 125, h / 2);
      ctx.lineTo(w / 2 - 210, h / 2 - 70);
      ctx.lineTo(w / 2 - 210, h / 2 + 70);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w / 2 + 120, h / 2 - 30, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w / 2 + 20, h / 2 - 85);
      ctx.quadraticCurveTo(w / 2 + 70, h / 2 - 150, w / 2 + 110, h / 2 - 80);
      ctx.stroke();
      break;
  }
  ctx.setLineDash([]);
}

// ストロークをキャンバスに描画
function drawStrokes(ctx: CanvasRenderingContext2D, strokes: StrokeData[]) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  }
}

const COLORS = ["#000000", "#e94560", "#f97316", "#fbbf24", "#4ade80", "#3b82f6", "#8b5cf6", "#ec4899"];
const WIDTHS = [3, 6, 12, 20];

export default function SketchPage() {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [myId, setMyId] = useState<string>();
  const [players, setPlayers] = useState<{ id: string; nickname: string; score: number }[]>([]);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [remaining, setRemaining] = useState(0);
  const [round, setRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(3);
  const [subject, setSubject] = useState<SketchSubject | null>(null);
  const [allPlayerStrokes, setAllPlayerStrokes] = useState<{ playerId: string; nickname: string; strokes: StrokeData[] }[]>([]);
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const [votePlayers, setVotePlayers] = useState<{ id: string; nickname: string }[]>([]);
  const [scores, setScores] = useState<{ id: string; nickname: string; score: number }[]>([]);
  const [finalScores, setFinalScores] = useState<{ nickname: string; score: number }[]>([]);
  const [winner, setWinner] = useState("");
  const [color, setColor] = useState("#000000");
  const [width, setWidth] = useState(6);
  const [liveComposite, setLiveComposite] = useState<{ playerId: string; strokes: StrokeData[] }[] | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const currentPoints = useRef<{ x: number; y: number }[]>([]);
  const lastSendTime = useRef(0);
  const colorRef = useRef(color);
  const widthRef = useRef(width);
  const socketRef = useRef(getSocket());

  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { widthRef.current = width; }, [width]);

  const socket = socketRef.current;

  const getCanvasPos = useCallback((e: PointerEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }, []);

  // Drawing event handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d")!;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const drawSegment = (points: { x: number; y: number }[], c: string, w: number) => {
      if (points.length < 2) return;
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
    };

    const sendBatch = () => {
      if (currentPoints.current.length < 2) return;
      socketRef.current.emit("sketch:draw", {
        points: [...currentPoints.current],
        color: colorRef.current,
        width: widthRef.current,
      });
      currentPoints.current = [currentPoints.current[currentPoints.current.length - 1]];
      lastSendTime.current = Date.now();
    };

    const onPointerDown = (e: PointerEvent) => {
      isDrawing.current = true;
      canvas.setPointerCapture(e.pointerId);
      currentPoints.current = [getCanvasPos(e)];
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDrawing.current) return;
      const pos = getCanvasPos(e);
      currentPoints.current.push(pos);
      const pts = currentPoints.current;
      if (pts.length >= 2) {
        drawSegment([pts[pts.length - 2], pts[pts.length - 1]], colorRef.current, widthRef.current);
      }
      if (Date.now() - lastSendTime.current > 50) {
        sendBatch();
      }
    };

    const onPointerUp = () => {
      if (isDrawing.current) {
        sendBatch();
        isDrawing.current = false;
        currentPoints.current = [];
      }
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerUp);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerUp);
    };
  }, [getCanvasPos]);

  // Draw incomplete image when phase changes to drawing
  useEffect(() => {
    if ((phase === "drawing" || phase === "show_incomplete") && subject && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d")!;
      drawIncompleteImage(ctx, subject.id);
    }
  }, [phase, subject]);

  // Draw composite
  useEffect(() => {
    if (phase === "composite_reveal" && compositeCanvasRef.current && subject) {
      const ctx = compositeCanvasRef.current.getContext("2d")!;
      drawIncompleteImage(ctx, subject.id);
      for (const ps of allPlayerStrokes) {
        drawStrokes(ctx, ps.strokes);
      }
    }
  }, [phase, allPlayerStrokes, subject]);

  // 描画中のライブ合成プレビュー（15秒ごとにサーバーから配信）
  useEffect(() => {
    if (phase === "drawing" && liveCanvasRef.current && subject && liveComposite) {
      const ctx = liveCanvasRef.current.getContext("2d")!;
      drawIncompleteImage(ctx, subject.id);
      for (const ps of liveComposite) {
        drawStrokes(ctx, ps.strokes);
      }
    }
  }, [phase, liveComposite, subject]);

  // フェーズ転換の効果音
  useEffect(() => {
    if (phase === "drawing") soundManager?.roundStart();
    if (phase === "result") soundManager?.correct();
    if (phase === "game_end") soundManager?.gameEnd();
  }, [phase]);

  // Socket events
  useEffect(() => {
    const nickname = sessionStorage.getItem("nickname");
    if (!nickname) {
      router.push("/");
      return;
    }

    let joined = false;

    const s = socketRef.current;

    const doJoin = () => {
      if (joined) return;
      joined = true;
      setMyId(s.id);
      setConnected(true);
      s.emit("sketch:join", { nickname });
    };

    const onConnect = () => doJoin();

    if (s.connected) {
      doJoin();
    } else {
      s.connect();
    }

    s.on("connect", onConnect);

    s.on("sketch:lobby_update", (data: { players: typeof players }) => {
      setPlayers(data.players);
    });

    s.on("sketch:timer_tick", (data: { remaining: number }) => {
      setRemaining(data.remaining);
    });

    s.on("sketch:composite", (data: { allStrokes: { playerId: string; strokes: StrokeData[] }[] }) => {
      setLiveComposite(data.allStrokes);
    });

    s.on("sketch:phase", (data: {
      phase: Phase;
      subject?: SketchSubject;
      round?: number;
      totalRounds?: number;
      timeLimit?: number;
      allStrokes?: { playerId: string; nickname: string; strokes: StrokeData[] }[];
      players?: { id: string; nickname: string }[];
      scores?: { id: string; nickname: string; score: number }[];
      finalScores?: { nickname: string; score: number }[];
      winner?: string;
      voteCounts?: Record<string, number>;
    }) => {
      setPhase(data.phase);
      if (data.subject) setSubject(data.subject);
      if (data.round !== undefined) setRound(data.round);
      if (data.totalRounds !== undefined) setTotalRounds(data.totalRounds);

      if (data.phase === "drawing") {
        setLiveComposite(null);
      }

      if (data.phase === "composite_reveal" && data.allStrokes) {
        setAllPlayerStrokes(data.allStrokes);
      }

      if (data.phase === "voting") {
        setVotedFor(null);
        if (data.players) setVotePlayers(data.players);
      }

      if (data.phase === "result") {
        if (data.scores) setScores(data.scores);
      }

      if (data.phase === "game_end") {
        if (data.finalScores) setFinalScores(data.finalScores);
        if (data.winner) setWinner(data.winner);
      }
    });

    s.on("disconnect", () => setConnected(false));

    return () => {
      s.off("connect", onConnect);
      s.off("sketch:lobby_update");
      s.off("sketch:timer_tick");
      s.off("sketch:composite");
      s.off("sketch:phase");
      s.off("disconnect");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handleStartGame = useCallback(() => {
    socketRef.current.emit("sketch:start_game");
  }, []);

  const handleVote = useCallback((targetPlayerId: string) => {
    socketRef.current.emit("sketch:vote", { targetPlayerId });
    setVotedFor(targetPlayerId);
  }, []);

  const handleReturnToLobby = useCallback(() => {
    socketRef.current.emit("sketch:return_to_lobby");
    router.push("/game");
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

  // ロビー
  if (phase === "lobby") {
    const canStart = players.length >= 2;
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold mb-1">
              <span className="text-[var(--accent)]">スピード</span>・スケッチ修正
            </h1>
            <p className="text-[var(--text-dim)]">不完全な画像を全員で同時に完成させよう</p>
          </div>

          <div className="bg-[var(--surface)] rounded-2xl p-6 mb-4">
            <h2 className="text-sm text-[var(--text-dim)] mb-3 uppercase tracking-wider">
              プレイヤー ({players.length})
            </h2>
            <div className="space-y-2">
              {players.map((p) => (
                <div key={p.id} className={`flex items-center gap-3 px-4 py-2 rounded-lg ${
                  p.id === myId ? "bg-[var(--accent)]/20 border border-[var(--accent)]/30" : "bg-[var(--surface-light)]"
                }`}>
                  <div className="w-8 h-8 rounded-full bg-[var(--accent-2)] flex items-center justify-center text-sm font-bold">
                    {p.nickname[0]}
                  </div>
                  <span className="font-medium">{p.nickname}</span>
                  {p.id === myId && <span className="text-xs text-[var(--accent)] ml-auto">あなた</span>}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleStartGame}
            disabled={!canStart}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent)]/80 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-lg transition"
          >
            {canStart ? "ゲーム開始！" : `あと${2 - players.length}人必要です`}
          </button>

          <button
            onClick={() => router.push("/game")}
            className="w-full mt-2 text-[var(--text-dim)] hover:text-[var(--text)] py-2 text-sm transition"
          >
            ← モード選択に戻る
          </button>
        </div>
      </div>
    );
  }

  // お題表示
  if (phase === "show_incomplete") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg text-center">
          <div className="text-6xl mb-4">
            {subject?.id === "face" ? "😶" : subject?.id === "house" ? "🏠" : subject?.id === "animal" ? "🐾" : subject?.id === "rocket" ? "🚀" : "🐟"}
          </div>
          <h2 className="text-3xl font-bold mb-2">ラウンド {round}/{totalRounds}</h2>
          <p className="text-xl text-[var(--text-dim)] mb-2">お題: <span className="text-[var(--accent)] font-bold">{subject?.name}</span></p>
          <p className="text-lg">{subject?.instruction}</p>
        </div>
      </div>
    );
  }

  // 描画フェーズ
  if (phase === "drawing") {
    return (
      <div className="min-h-screen flex flex-col p-2 sm:p-3 gap-2 sm:gap-3 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-[var(--text-dim)]">ラウンド {round}/{totalRounds}</span>
            <span className="ml-3 font-bold">{subject?.name}</span>
            <span className="ml-2 text-sm text-[var(--text-dim)]">{subject?.instruction}</span>
          </div>
          <div className={`text-2xl font-bold tabular-nums ${remaining <= 10 ? "text-red-400" : "text-[var(--accent)]"}`}>
            {remaining}s
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="w-full rounded-xl border-2 border-[var(--surface-light)] cursor-crosshair bg-white touch-none"
          style={{ aspectRatio: "4/3" }}
        />

        <div className="flex items-center gap-2 sm:gap-4 bg-[var(--surface)] rounded-xl px-2 sm:px-4 py-2 flex-wrap">
          <div className="flex gap-1 sm:gap-1.5 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 transition ${
                  color === c ? "border-[var(--accent)] scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex gap-1.5 items-center border-l border-[var(--surface-light)] pl-2 sm:pl-4">
            {WIDTHS.map((w) => (
              <button
                key={w}
                onClick={() => setWidth(w)}
                className={`rounded-full bg-[var(--text)] transition ${
                  width === w ? "ring-2 ring-[var(--accent)]" : ""
                }`}
                style={{ width: w + 8, height: w + 8 }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 bg-[var(--surface)] rounded-xl px-3 py-2">
          <div className="flex-shrink-0">
            <canvas
              ref={liveCanvasRef}
              width={400}
              height={300}
              className="rounded-lg border border-[var(--surface-light)] bg-white w-28 sm:w-36"
              style={{ aspectRatio: "4/3" }}
            />
          </div>
          <div className="text-xs sm:text-sm text-[var(--text-dim)]">
            <p className="font-bold text-[var(--text)] mb-0.5">みんなの合成（ライブ）</p>
            {liveComposite ? (
              <p>全員の絵が15秒ごとに重なっていく…！</p>
            ) : (
              <p>最初の合成は15秒後に表示されます</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 合成結果表示
  if (phase === "composite_reveal") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-2xl text-center">
          <h2 className="text-2xl font-bold mb-4">合成結果！</h2>
          <p className="text-[var(--text-dim)] mb-4">お題: {subject?.name}</p>
          <canvas
            ref={compositeCanvasRef}
            width={800}
            height={600}
            className="w-full rounded-xl border-2 border-[var(--surface-light)] bg-white mx-auto"
            style={{ aspectRatio: "4/3", maxWidth: "600px" }}
          />
          <p className="text-sm text-[var(--text-dim)] mt-3">
            {allPlayerStrokes.map(ps => ps.nickname).join("・")} の合作
          </p>
        </div>
      </div>
    );
  }

  // 投票
  if (phase === "voting") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-1">ベスト描画に投票！</h2>
            <p className="text-[var(--text-dim)]">最も上手に描いたプレイヤーを選ぼう</p>
          </div>

          {votedFor ? (
            <div className="bg-[var(--surface)] rounded-2xl p-6 text-center">
              <p className="text-2xl mb-2">🗳️</p>
              <p className="text-[var(--text-dim)]">投票済み！結果を待っています...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {votePlayers.filter(p => p.id !== myId).map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleVote(p.id)}
                  className="w-full bg-[var(--surface)] hover:bg-[var(--accent)]/20 border-2 border-transparent hover:border-[var(--accent)]/30 rounded-2xl p-4 text-left transition"
                >
                  <span className="font-bold">{p.nickname}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ラウンド結果
  if (phase === "result") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-1">ラウンド {round} 結果</h2>
          </div>

          <div className="bg-[var(--surface)] rounded-2xl p-6">
            <div className="space-y-3">
              {scores.map((s, i) => (
                <div key={s.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
                  i === 0 ? "bg-[var(--accent)]/20 border border-[var(--accent)]/30" : "bg-[var(--surface-light)]"
                }`}>
                  <span className="text-2xl font-bold w-8">{i === 0 ? "👑" : `${i + 1}`}</span>
                  <span className="font-medium flex-1">{s.nickname}</span>
                  <span className="font-bold text-[var(--accent)]">{s.score}pt</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-[var(--text-dim)] mt-4">
            {round < totalRounds ? "次のラウンドが始まります..." : "最終結果を集計中..."}
          </p>
        </div>
      </div>
    );
  }

  // ゲーム終了
  if (phase === "game_end") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <ConfettiOverlay active />
        <div className="w-full max-w-lg">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold mb-2">🏆 最終結果</h2>
            <p className="text-xl text-[var(--accent)]">優勝: {winner}</p>
          </div>

          <div className="bg-[var(--surface)] rounded-2xl p-6 mb-4">
            <div className="space-y-3">
              {finalScores.map((s, i) => (
                <div key={s.nickname} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
                  i === 0 ? "bg-[var(--accent)]/20 border border-[var(--accent)]/30" : "bg-[var(--surface-light)]"
                }`}>
                  <span className="text-2xl font-bold w-8">{i === 0 ? "👑" : `${i + 1}`}</span>
                  <span className="font-medium flex-1">{s.nickname}</span>
                  <span className="font-bold text-[var(--accent)]">{s.score}pt</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleReturnToLobby}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-white font-bold py-3 rounded-xl text-lg transition"
          >
            ロビーに戻る
          </button>
        </div>
      </div>
    );
  }

  return null;
}
