"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSocket, destroySocket } from "@/lib/socket";
import type { TeleportChainItem, StyleCard } from "@/types/game";

type Phase = "lobby" | "prompt_write" | "ai_generating" | "describe" | "ai_generating_2" | "reveal" | "voting" | "result";

export default function TeleportPage() {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [myId, setMyId] = useState<string>();
  const [players, setPlayers] = useState<{ id: string; nickname: string; score: number }[]>([]);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [remaining, setRemaining] = useState(0);

  // ゲームデータ
  const [styleCard, setStyleCard] = useState<StyleCard>();
  const [prompt, setPrompt] = useState("");
  const [promptSubmitted, setPromptSubmitted] = useState(false);
  const [describeImage, setDescribeImage] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionSubmitted, setDescriptionSubmitted] = useState(false);
  const [chains, setChains] = useState<TeleportChainItem[]>([]);
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const [scores, setScores] = useState<{ nickname: string; score: number }[]>([]);
  const [revealIndex, setRevealIndex] = useState(0);

  const socket = getSocket();

  const handleStartGame = useCallback(() => {
    socket.emit("teleport:start_game");
  }, [socket]);

  const handleSubmitPrompt = useCallback(() => {
    if (!prompt.trim()) return;
    socket.emit("teleport:submit_prompt", { prompt: prompt.trim() });
    setPromptSubmitted(true);
  }, [socket, prompt]);

  const handleSubmitDescription = useCallback(() => {
    if (!description.trim()) return;
    socket.emit("teleport:submit_description", { description: description.trim() });
    setDescriptionSubmitted(true);
  }, [socket, description]);

  const handleStartVoting = useCallback(() => {
    socket.emit("teleport:start_voting");
  }, [socket]);

  const handleVote = useCallback((chainOwnerId: string) => {
    socket.emit("teleport:vote", { chainOwnerId });
    setVotedFor(chainOwnerId);
  }, [socket]);

  const handleReturnToLobby = useCallback(() => {
    socket.emit("teleport:return_to_lobby");
    // メインロビーに戻る
    router.push("/game");
  }, [socket, router]);

  useEffect(() => {
    const nickname = sessionStorage.getItem("nickname");
    if (!nickname) {
      router.push("/");
      return;
    }

    // join済みフラグで二重join防止
    let joined = false;

    const doJoin = () => {
      if (joined) return;
      joined = true;
      setMyId(socket.id);
      setConnected(true);
      socket.emit("teleport:join", { nickname });
    };

    const onConnect = () => doJoin();

    if (socket.connected) {
      doJoin();
    } else {
      socket.connect();
    }

    socket.on("connect", onConnect);

    socket.on("teleport:lobby_update", (data: { players: typeof players }) => {
      setPlayers(data.players);
    });

    socket.on("teleport:timer_tick", (data: { remaining: number }) => {
      setRemaining(data.remaining);
    });

    socket.on("teleport:phase", (data: {
      phase: Phase;
      styleCard?: StyleCard;
      timeLimit?: number;
      image?: string;
      originalOwnerId?: string;
      chains?: TeleportChainItem[];
      scores?: { nickname: string; score: number }[];
      voteCounts?: Record<string, number>;
    }) => {
      setPhase(data.phase);

      if (data.phase === "prompt_write") {
        setPrompt("");
        setPromptSubmitted(false);
        if (data.styleCard) setStyleCard(data.styleCard);
      }

      if (data.phase === "describe") {
        setDescription("");
        setDescriptionSubmitted(false);
        if (data.image) setDescribeImage(data.image);
      }

      if (data.phase === "reveal" || data.phase === "voting") {
        if (data.chains) setChains(data.chains);
        setVotedFor(null);
        setRevealIndex(0);
      }

      if (data.phase === "result") {
        if (data.scores) setScores(data.scores);
      }
    });

    socket.on("disconnect", () => setConnected(false));

    return () => {
      socket.off("connect", onConnect);
      socket.off("teleport:lobby_update");
      socket.off("teleport:timer_tick");
      socket.off("teleport:phase");
      // 注: destroySocket() はここで呼ばない（StrictModeで二重joinの原因になる）
    };
  }, [router, socket]);

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
              <span className="text-[var(--accent)]">プロンプト</span>・テレポート
            </h1>
            <p className="text-[var(--text-dim)]">プロンプト→AI画像→説明→AI画像の伝言ゲーム</p>
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

  // プロンプト入力
  if (phase === "prompt_write") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <Header title="プロンプトを入力" remaining={remaining} />

          {styleCard && (
            <div className="bg-[var(--accent)]/20 border border-[var(--accent)]/30 rounded-xl px-4 py-3 mb-4 text-center">
              <span className="text-sm text-[var(--text-dim)]">スタイルカード:</span>
              <span className="ml-2 font-bold text-lg">{styleCard}</span>
            </div>
          )}

          <div className="bg-[var(--surface)] rounded-2xl p-6">
            {promptSubmitted ? (
              <div className="text-center py-8">
                <p className="text-2xl mb-2">✅</p>
                <p className="text-[var(--text-dim)]">送信済み！他のプレイヤーを待っています...</p>
              </div>
            ) : (
              <>
                <p className="text-[var(--text-dim)] mb-3">AIに描いてほしい画像のプロンプトを入力してください</p>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="例: 宇宙を泳ぐクジラ"
                  className="w-full bg-[var(--surface-light)] rounded-xl px-4 py-3 text-lg resize-none h-24 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  maxLength={100}
                  autoFocus
                />
                <button
                  onClick={handleSubmitPrompt}
                  disabled={!prompt.trim()}
                  className="w-full mt-3 bg-[var(--accent)] hover:bg-[var(--accent)]/80 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition"
                >
                  送信
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // AI生成中
  if (phase === "ai_generating" || phase === "ai_generating_2") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-2">AI が画像を生成中...</h2>
          <p className="text-[var(--text-dim)]">
            {phase === "ai_generating" ? "プロンプトから画像を生成しています" : "説明文から画像を再生成しています"}
          </p>
        </div>
      </div>
    );
  }

  // 画像説明
  if (phase === "describe") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <Header title="画像を説明しよう" remaining={remaining} />

          <div className="bg-[var(--surface)] rounded-2xl p-4 mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={describeImage}
              alt="AI生成画像"
              className="w-full rounded-xl"
            />
          </div>

          <div className="bg-[var(--surface)] rounded-2xl p-6">
            {descriptionSubmitted ? (
              <div className="text-center py-8">
                <p className="text-2xl mb-2">✅</p>
                <p className="text-[var(--text-dim)]">送信済み！他のプレイヤーを待っています...</p>
              </div>
            ) : (
              <>
                <p className="text-[var(--text-dim)] mb-3">この画像をテキストで説明してください</p>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="この画像は..."
                  className="w-full bg-[var(--surface-light)] rounded-xl px-4 py-3 text-lg resize-none h-24 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  maxLength={200}
                  autoFocus
                />
                <button
                  onClick={handleSubmitDescription}
                  disabled={!description.trim()}
                  className="w-full mt-3 bg-[var(--accent)] hover:bg-[var(--accent)]/80 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition"
                >
                  送信
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // チェーン表示（リビール）
  if (phase === "reveal") {
    const chain = chains[revealIndex];
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold mb-1">チェーン発表！</h2>
            <p className="text-[var(--text-dim)]">{revealIndex + 1} / {chains.length}</p>
          </div>

          {chain && (
            <div className="bg-[var(--surface)] rounded-2xl p-6 space-y-4">
              <div className="text-center">
                <span className="text-sm text-[var(--text-dim)]">{chain.nickname} のチェーン</span>
              </div>

              <Step number={1} label="プロンプト">
                <p className="text-lg font-medium">{chain.originalPrompt}</p>
                <span className="text-sm text-[var(--accent)]">{chain.styleCard}</span>
              </Step>

              <Step number={2} label="AI画像">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={chain.mockImage1} alt="AI画像1" className="w-full rounded-xl max-w-sm mx-auto" />
              </Step>

              <Step number={3} label="説明文">
                <p className="text-lg">{chain.description}</p>
              </Step>

              <Step number={4} label="再生成画像">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={chain.mockImage2} alt="AI画像2" className="w-full rounded-xl max-w-sm mx-auto" />
              </Step>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setRevealIndex(Math.max(0, revealIndex - 1))}
              disabled={revealIndex === 0}
              className="flex-1 bg-[var(--surface)] hover:bg-[var(--surface-light)] disabled:opacity-30 font-bold py-3 rounded-xl transition"
            >
              ← 前へ
            </button>
            {revealIndex < chains.length - 1 ? (
              <button
                onClick={() => setRevealIndex(revealIndex + 1)}
                className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-white font-bold py-3 rounded-xl transition"
              >
                次へ →
              </button>
            ) : (
              <button
                onClick={handleStartVoting}
                className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-white font-bold py-3 rounded-xl transition"
              >
                投票へ！
              </button>
            )}
          </div>
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
            <h2 className="text-2xl font-bold mb-1">ベストチェーンに投票！</h2>
            <p className="text-[var(--text-dim)]">最も面白かったチェーンを選ぼう</p>
          </div>

          {votedFor ? (
            <div className="bg-[var(--surface)] rounded-2xl p-6 text-center">
              <p className="text-2xl mb-2">🗳️</p>
              <p className="text-[var(--text-dim)]">投票済み！結果を待っています...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {chains.filter(c => c.playerId !== myId).map((chain) => (
                <button
                  key={chain.playerId}
                  onClick={() => handleVote(chain.playerId)}
                  className="w-full bg-[var(--surface)] hover:bg-[var(--accent)]/20 border-2 border-transparent hover:border-[var(--accent)]/30 rounded-2xl p-4 text-left transition"
                >
                  <div className="font-bold mb-1">{chain.nickname} のチェーン</div>
                  <p className="text-sm text-[var(--text-dim)]">「{chain.originalPrompt}」→「{chain.description}」</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 結果
  if (phase === "result") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-1">結果発表！</h2>
          </div>

          <div className="bg-[var(--surface)] rounded-2xl p-6 mb-4">
            <div className="space-y-3">
              {scores.map((s, i) => (
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

// === サブコンポーネント ===

function Header({ title, remaining }: { title: string; remaining: number }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className={`text-2xl font-bold tabular-nums ${remaining <= 5 ? "text-red-400" : "text-[var(--accent)]"}`}>
        {remaining}s
      </div>
    </div>
  );
}

function Step({ number, label, children }: { number: number; label: string; children: React.ReactNode }) {
  return (
    <div className="border-l-4 border-[var(--accent)]/30 pl-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-6 h-6 rounded-full bg-[var(--accent)] text-white text-xs flex items-center justify-center font-bold">
          {number}
        </span>
        <span className="text-sm text-[var(--text-dim)] uppercase tracking-wider">{label}</span>
      </div>
      {children}
    </div>
  );
}
