import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { registerBattleHandlers } from "./src/lib/gameState";
import { registerTeleportHandlers } from "./src/lib/teleportState";
import { registerSketchHandlers } from "./src/lib/sketchState";

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

  // 単一のconnectionハンドラーで全モードのイベントを登録
  io.on("connection", (socket) => {
    console.log(`接続: ${socket.id}`);

    registerBattleHandlers(io, socket);
    registerTeleportHandlers(io, socket);
    registerSketchHandlers(io, socket);
  });

  httpServer.listen(port, () => {
    console.log(`> Vive Gamer running on http://${hostname}:${port}`);
  });
});
