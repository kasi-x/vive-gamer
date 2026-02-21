"use client";

import { useRef, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";

interface ViewCanvasProps {
  socket: Socket;
}

export default function ViewCanvas({ socket }: ViewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const handleDraw = (data: {
      points: { x: number; y: number }[];
      color: string;
      width: number;
    }) => {
      if (data.points.length < 2) return;
      ctx.strokeStyle = data.color;
      ctx.lineWidth = data.width;
      ctx.beginPath();
      ctx.moveTo(data.points[0].x, data.points[0].y);
      for (let i = 1; i < data.points.length; i++) {
        ctx.lineTo(data.points[i].x, data.points[i].y);
      }
      ctx.stroke();
    };

    const handleClear = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const handleCanvasState = (data: {
      strokes: { points: { x: number; y: number }[]; color: string; width: number }[];
    }) => {
      handleClear();
      for (const stroke of data.strokes) {
        handleDraw(stroke);
      }
    };

    const handleAIScan = () => {
      setScanning(true);
      setTimeout(() => setScanning(false), 1500);
    };

    socket.on("draw", handleDraw);
    socket.on("clear_canvas", handleClear);
    socket.on("canvas_state", handleCanvasState);
    socket.on("ai_scan", handleAIScan);

    return () => {
      socket.off("draw", handleDraw);
      socket.off("clear_canvas", handleClear);
      socket.off("canvas_state", handleCanvasState);
      socket.off("ai_scan", handleAIScan);
    };
  }, [socket]);

  return (
    <div className="relative overflow-hidden rounded-xl">
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="w-full border-2 border-[var(--surface-light)] bg-white rounded-xl"
        style={{ aspectRatio: "4/3" }}
      />

      {/* AIスキャンライト */}
      {scanning && (
        <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden">
          {/* スイープするビーム */}
          <div className="ai-scan-beam" />
          {/* 全体を薄く赤く光らせるフラッシュ */}
          <div className="ai-scan-flash" />
          {/* ラベル */}
          <div className="absolute top-3 right-3 ai-scan-label">
            <div className="flex items-center gap-2 bg-black/70 text-[var(--accent)] text-xs font-bold px-3 py-1.5 rounded-full border border-[var(--accent)]/50">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
              AI SCANNING
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
