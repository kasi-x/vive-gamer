/**
 * スケッチモードのヘッドレスE2Eスモークテスト
 *
 * 使い方: npm run dev 起動後に `npx tsx scripts/sketch_e2e.ts`
 *
 * 検証内容:
 * - 2人がロビー参加 → ゲーム開始 → 3ラウンド進行
 * - 全ラウンド「誰も投票しない」→ 20秒の投票タイムアウトで自動集計される(デッドロック防止)
 * - ラウンド3のみ1票投じる → タイムアウト集計でも得点が付く
 * - game_end で勝者が確定する
 */
import { io, type Socket } from "socket.io-client";

const URL = process.env.E2E_URL || "http://localhost:3001";
const t0 = Date.now();
const log = (m: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

function mk(name: string): Socket {
  const s = io(URL, { transports: ["websocket"] });
  s.on("connect", () => log(`${name} 接続`));
  s.on("disconnect", () => log(`${name} 切断`));
  return s;
}

const taro = mk("太郎");
const jiro = mk("次郎");

async function main() {
await Promise.all([
  new Promise<void>((r) => taro.on("connect", () => r())),
  new Promise<void>((r) => jiro.on("connect", () => r())),
]);

taro.emit("sketch:join", { nickname: "太郎" });
jiro.emit("sketch:join", { nickname: "次郎" });
await new Promise((r) => setTimeout(r, 500));

// 前回プレイの部屋状態が残っていればロビーに戻す
taro.emit("sketch:return_to_lobby");
await new Promise((r) => setTimeout(r, 300));

let votingRound = 0;

jiro.on("sketch:phase", (d: {
  phase: string;
  round?: number;
  winner?: string;
  scores?: { nickname: string; score: number }[];
  finalScores?: { nickname: string; score: number }[];
  players?: { id: string; nickname: string }[];
}) => {
  if (d.phase === "drawing") log(`ラウンド${d.round} 描画開始`);
  if (d.phase === "voting") {
    votingRound++;
    log(`ラウンド${d.round} 投票開始(誰も投票しない → タイムアウト集計を待つ)`);
    // 最終ラウンドのみ次郎が1票投じる: タイムアウト併用でも得点が付くことを確認
    if (votingRound === 3) {
      const taroPlayer = d.players?.find((p) => p.nickname === "太郎");
      if (taroPlayer) {
        jiro.emit("sketch:vote", { targetPlayerId: taroPlayer.id });
        log("→ 次郎が太郎に投票(1票のみ)");
      }
    }
  }
  if (d.phase === "result") log(`ラウンド${d.round} 結果: ${JSON.stringify(d.scores)}`);
  if (d.phase === "game_end") {
    log(`game_end winner=${d.winner} final=${JSON.stringify(d.finalScores)}`);
    const total = d.finalScores?.reduce((s, p) => s + p.score, 0) ?? 0;
    if (total === 100 && d.winner === "太郎") {
      console.log("E2E OK: 3ラウンド完走、タイムアウト集計で太郎に100pt");
    } else {
      console.error(`E2E FAIL: total=${total} winner=${d.winner}`);
      process.exit(1);
    }
    taro.emit("sketch:return_to_lobby");
    process.exit(0);
  }
});

taro.emit("sketch:start_game");
log("start_game 送信");

setTimeout(() => {
  console.error("E2E TIMEOUT: 290秒以内に完走しなかった");
  process.exit(1);
}, 290000);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
