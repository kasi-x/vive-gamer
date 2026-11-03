import { readFileSync } from "fs";
import { resolve } from "path";
import { createServer } from "http";
import next from "next";

// .env.local を手動読み込み（カスタムサーバーではNext.jsの自動読み込みが効かない）
try {
  const envPath = resolve(process.cwd(), ".env.local");
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    const val = trimmed.slice(eqIdx + 1);
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env.local が存在しなくてもOK
}
import { Server } from "socket.io";
import { registerBattleHandlers } from "./src/lib/gameState";
import { registerTeleportHandlers } from "./src/lib/teleportState";
import { registerSketchHandlers } from "./src/lib/sketchState";
import { registerOjamaHandlers } from "./src/lib/ojamaState";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    console.log(`接続: ${socket.id}`);

    registerBattleHandlers(io, socket);
    registerTeleportHandlers(io, socket);
    registerSketchHandlers(io, socket);
    registerOjamaHandlers(io, socket);
  });

  httpServer.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\n[起動エラー] ポート ${port} は既に使用されています。`);
      console.error("以前の開発サーバープロセスが残っている可能性があります。");
      console.error("放置するとメモリを食い続けます。次のコマンドで掃除してから起動してください:\n");
      console.error("  npm run dev:clean\n");
      console.error("手動で止める場合:");
      console.error(`  lsof -ti:${port} | xargs kill -9    (macOS / Linux)`);
      console.error(`  pkill -f "tsx server.ts"            (このプロジェクトの全サーバー)`);
      process.exit(1);
    }
    throw err;
  });

  httpServer.listen(port, () => {
    console.log(`> Vive Gamer running on http://${hostname}:${port}`);
  });
});
