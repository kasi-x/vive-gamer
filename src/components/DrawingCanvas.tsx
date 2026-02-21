"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import type { Socket } from "socket.io-client";
import InkGauge from "./InkGauge";
import { soundManager } from "@/lib/sounds";

const COLORS = [
  "#000000", "#ffffff", "#e94560", "#f97316", "#fbbf24",
  "#4ade80", "#3b82f6", "#8b5cf6", "#ec4899", "#78716c",
];
const WIDTHS = [3, 6, 12, 20];

interface DrawingCanvasProps {
  socket: Socket;
}

export default function DrawingCanvas({ socket }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const currentPoints = useRef<{ x: number; y: number }[]>([]);
  const lastSendTime = useRef(0);
  const colorRef = useRef("#000000");
  const widthRef = useRef(6);
  const socketRef = useRef(socket);
  const [color, setColor] = useState("#000000");
  const [width, setWidth] = useState(6);
  const [scanning, setScanning] = useState(false);
  const [inkRemaining, setInkRemaining] = useState(15000);
  const [maxInk] = useState(15000);
  const [inkOut, setInkOut] = useState(false);

  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { widthRef.current = width; }, [width]);
  useEffect(() => { socketRef.current = socket; }, [socket]);

  const getCanvasPos = useCallback(
    (e: PointerEvent): { x: number; y: number } => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * canvas.width,
        y: ((e.clientY - rect.top) / rect.height) * canvas.height,
      };
    },
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const drawSegment = (
      points: { x: number; y: number }[],
      c: string,
      w: number
    ) => {
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
      socketRef.current.emit("draw", {
        points: [...currentPoints.current],
        color: colorRef.current,
        width: widthRef.current,
      });
      currentPoints.current = [
        currentPoints.current[currentPoints.current.length - 1],
      ];
      lastSendTime.current = Date.now();
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      isDrawing.current = true;
      canvas.setPointerCapture(e.pointerId);
      const pos = getCanvasPos(e);
      currentPoints.current = [pos];
      ctx.fillStyle = colorRef.current;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, widthRef.current / 2, 0, Math.PI * 2);
      ctx.fill();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDrawing.current) return;
      e.preventDefault();
      const pos = getCanvasPos(e);
      currentPoints.current.push(pos);

      const pts = currentPoints.current;
      if (pts.length >= 2) {
        drawSegment(
          [pts[pts.length - 2], pts[pts.length - 1]],
          colorRef.current,
          widthRef.current
        );
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

    canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    canvas.addEventListener("pointermove", onPointerMove, { passive: false });
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerUp);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerUp);
    };
  }, [getCanvasPos]);

  // 5秒ごとにキャンバスのスナップショットをサーバーに送信
  useEffect(() => {
    const interval = setInterval(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const imageBase64 = canvas.toDataURL("image/png");
      socketRef.current.emit("canvas_snapshot", { imageBase64 });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // AIスキャンイベント受信
  useEffect(() => {
    const handleAIScan = () => {
      setScanning(true);
      setTimeout(() => setScanning(false), 1500);
    };
    socket.on("ai_scan", handleAIScan);
    return () => { socket.off("ai_scan", handleAIScan); };
  }, [socket]);

  // インク更新
  useEffect(() => {
    const handleInkUpdate = (data: { inkRemaining: number; maxInk: number; strokesRemaining?: number | null }) => {
      setInkRemaining(data.inkRemaining);
    };
    const handleInkDepleted = () => {
      setInkOut(true);
      soundManager?.inkDepleted();
    };
    socket.on("ink_update", handleInkUpdate);
    socket.on("ink_depleted", handleInkDepleted);
    return () => {
      socket.off("ink_update", handleInkUpdate);
      socket.off("ink_depleted", handleInkDepleted);
    };
  }, [socket]);

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    socket.emit("clear_canvas");
  };

  const inkLow = inkRemaining / maxInk <= 0.2;

  return (
    <div className="flex flex-col gap-2 sm:gap-3">
      <div className="relative overflow-hidden rounded-xl">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className={`w-full border-2 cursor-crosshair bg-white touch-none rounded-xl ${
            inkOut
              ? "border-[var(--accent)] cursor-not-allowed"
              : inkLow
              ? "border-[var(--warning)]"
              : "border-[var(--surface-light)]"
          }`}
          style={{ aspectRatio: "4/3", touchAction: "none", pointerEvents: inkOut ? "none" : undefined }}
        />
        {scanning && (
          <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden">
            <div className="ai-scan-beam" />
            <div className="ai-scan-flash" />
            <div className="absolute top-3 left-3 ai-scan-label">
              <div className="flex items-center gap-2 bg-black/70 text-[var(--accent)] text-xs font-bold px-3 py-1.5 rounded-full border border-[var(--accent)]/50">
                <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                AI SCANNING
              </div>
            </div>
          </div>
        )}
        {inkOut && (
          <div className="ink-depleted-overlay">
            <div className="bg-black/80 text-[var(--accent)] font-bold text-lg px-6 py-3 rounded-xl border border-[var(--accent)]/50">
              INK DEPLETED
            </div>
          </div>
        )}
      </div>

      {/* ツールバー */}
      <div className={`flex items-center gap-2 sm:gap-4 bg-[var(--surface)] rounded-xl px-2 sm:px-4 py-2 flex-wrap ${
        inkLow && !inkOut ? "ring-1 ring-[var(--warning)]/50" : ""
      }`}>
        {/* カラー */}
        <div className="flex gap-1 sm:gap-1.5 flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              disabled={inkOut}
              className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 transition ${
                color === c
                  ? "border-[var(--accent)] scale-110"
                  : "border-transparent"
              } ${inkOut ? "opacity-40" : ""}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        {/* 太さ */}
        <div className="flex gap-1.5 items-center border-l border-[var(--surface-light)] pl-2 sm:pl-4">
          {WIDTHS.map((w) => (
            <button
              key={w}
              onClick={() => setWidth(w)}
              disabled={inkOut}
              className={`rounded-full bg-[var(--text)] transition ${
                width === w ? "ring-2 ring-[var(--accent)]" : ""
              } ${inkOut ? "opacity-40" : ""}`}
              style={{ width: w + 8, height: w + 8 }}
            />
          ))}
        </div>

        {/* インクゲージ */}
        <div className="border-l border-[var(--surface-light)] pl-2 sm:pl-4">
          <InkGauge inkRemaining={inkRemaining} maxInk={maxInk} />
        </div>

        {/* クリア */}
        <button
          onClick={handleClear}
          disabled={inkOut}
          className={`ml-auto bg-[var(--surface-light)] hover:bg-[var(--accent)]/30 text-sm px-3 sm:px-4 py-1.5 rounded-lg transition ${
            inkOut ? "opacity-40 cursor-not-allowed" : ""
          }`}
        >
          クリア
        </button>
      </div>
    </div>
  );
}
