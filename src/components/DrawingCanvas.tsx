"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import type { Socket } from "socket.io-client";

const COLORS = [
  "#000000",
  "#ffffff",
  "#e94560",
  "#f97316",
  "#fbbf24",
  "#4ade80",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#78716c",
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
  const [color, setColor] = useState("#000000");
  const [width, setWidth] = useState(6);

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

  const sendBatch = useCallback(() => {
    if (currentPoints.current.length < 2) return;
    socket.emit("draw", {
      points: [...currentPoints.current],
      color,
      width,
    });
    // 最後の点を次バッチの開始点として保持
    currentPoints.current = [
      currentPoints.current[currentPoints.current.length - 1],
    ];
    lastSendTime.current = Date.now();
  }, [socket, color, width]);

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

    const onPointerDown = (e: PointerEvent) => {
      isDrawing.current = true;
      canvas.setPointerCapture(e.pointerId);
      currentPoints.current = [getCanvasPos(e)];
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDrawing.current) return;
      const pos = getCanvasPos(e);
      currentPoints.current.push(pos);

      // ローカル描画
      const pts = currentPoints.current;
      if (pts.length >= 2) {
        drawSegment(
          [pts[pts.length - 2], pts[pts.length - 1]],
          color,
          width
        );
      }

      // 50msスロットルでバッチ送信
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
  }, [getCanvasPos, sendBatch, color, width]);

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    socket.emit("clear_canvas");
  };

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="w-full rounded-xl border-2 border-[var(--surface-light)] cursor-crosshair bg-white touch-none"
        style={{ aspectRatio: "4/3" }}
      />

      {/* ツールバー */}
      <div className="flex items-center gap-4 bg-[var(--surface)] rounded-xl px-4 py-2 flex-wrap">
        {/* カラー */}
        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full border-2 transition ${
                color === c
                  ? "border-[var(--accent)] scale-110"
                  : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        {/* 太さ */}
        <div className="flex gap-1.5 items-center border-l border-[var(--surface-light)] pl-4">
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

        {/* クリア */}
        <button
          onClick={handleClear}
          className="ml-auto bg-[var(--surface-light)] hover:bg-[var(--accent)]/30 text-sm px-4 py-1.5 rounded-lg transition"
        >
          クリア
        </button>
      </div>
    </div>
  );
}
