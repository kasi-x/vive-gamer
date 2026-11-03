/**
 * 残留した開発サーバープロセスの掃除ヘルパー
 *
 * `npm run dev:clean` で実行。predev からも自動呼び出しされる（SKIP_DEV_CLEAN=1 で回避）。
 *
 * やること:
 * 1. このプロジェクトの `tsx server.ts` プロセスを全て停止（他プロジェクトには触らない）
 * 2. PORT(デフォルト3000) を塞いでいるプロセスがあれば停止
 *
 * 背景: `npm run dev` がポート競合で失敗しても、古いサーバーは裏で生き続ける。
 * それが蓄積するとメモリを食い潰してPC全体が不安定になるため、起動前に必ず掃除する。
 */
import { execSync } from "child_process";
import { resolve } from "path";

const projectRoot = resolve(__dirname, "..");
const port = process.env.PORT || "3000";
const isWin = process.platform === "win32";

function killed(pids: number[], label: string) {
  if (pids.length === 0) return;
  for (const pid of pids) {
    try {
      if (isWin) {
        execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
      } else {
        process.kill(pid, "SIGKILL");
      }
      console.log(`  停止: pid=${pid} (${label})`);
    } catch {
      // 既に存在しないプロセスは無視
    }
  }
}

function findProjectServerPids(): number[] {
  try {
    const out = execSync("ps -eo pid=,command=", { encoding: "utf-8" });
    const pids: number[] = [];
    for (const line of out.split("\n")) {
      // このプロジェクトの server.ts プロセスのみ対象（自分自身は除く）
      if (!line.includes("tsx server.ts") && !line.includes("server.ts")) continue;
      if (!line.includes("vive_gamer")) continue;
      const pid = parseInt(line.trim().split(/\s+/)[0], 10);
      if (pid && pid !== process.pid) pids.push(pid);
    }
    return pids;
  } catch {
    return [];
  }
}

function findPortPid(): number | null {
  try {
    if (isWin) {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf-8", shell: "cmd.exe" });
      const line = out.split("\n").find((l) => l.includes("LISTENING"));
      if (!line) return null;
      return parseInt(line.trim().split(/\s+/).pop() || "", 10) || null;
    }
    const out = execSync(`lsof -ti tcp:${port}`, { encoding: "utf-8" });
    return parseInt(out.trim(), 10) || null;
  } catch {
    return null; // 何も塞いでいない / lsof未導入
  }
}

console.log(`[dev:clean] 掃除中... (プロジェクト: ${projectRoot})`);

const serverPids = findProjectServerPids();
killed(serverPids, "このプロジェクトの開発サーバー");

const portPid = findPortPid();
if (portPid) {
  killed([portPid], `ポート${port}の占有プロセス`);
}

if (serverPids.length === 0 && !portPid) {
  console.log("[dev:clean] 残留プロセスなし。クリーンです。");
} else {
  console.log("[dev:clean] 掃除完了。");
}
