"use client";

import { useRef, useEffect } from "react";
import type { Socket } from "socket.io-client";

interface ViewCanvasProps {
  socket: Socket;
}

export default function ViewCanvas({ socket }: ViewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    socket.on("draw", handleDraw);
    socket.on("clear_canvas", handleClear);

    return () => {
      socket.off("draw", handleDraw);
      socket.off("clear_canvas", handleClear);
    };
  }, [socket]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      className="w-full rounded-xl border-2 border-[var(--surface-light)] bg-white"
      style={{ aspectRatio: "4/3" }}
    />
  );
}
