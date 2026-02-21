# Vive Gamer - 開発TODO

## 目的
マルチプレイヤーAI描画ゲーム「Vive Gamer」のモックプロトタイプ。
AIと人間が対戦する描画バトル（AI解読バトルモード）を最速で動く形にする。

## 技術スタック
- **Next.js** (App Router, TypeScript, Tailwind CSS v4)
- **Socket.io** (リアルタイム描画同期 + 推測)
- **カスタムサーバー** (`server.ts` + `tsx`で直接実行)
- **AI**: ダミー応答（事前定義の面白い誤回答）

## アーキテクチャ方針
- 単一ゲームページで全フェーズ管理（ルート遷移でSocket切断を防止）
- サーバー権威的タイマー（不正防止 + クライアント同期）
- ストローク50msスロットルでバッチ送信（帯域節約）
- 単一ルーム設計（プロトタイプ段階）

## ゲームフロー
1. ニックネーム入力 → `/game`へ遷移
2. ロビー：プレイヤー一覧、2人以上で「ゲーム開始」
3. ラウンド（60秒）：描き手にお題表示→描画→他プレイヤー+AIが推測
4. スコアリング：人間正解(描き手+50/推測者+100)、AI正解(描き手-30)、AI不正解ボーナス(+100)
5. 全員描き終わったらゲーム終了 → 最終スコア

## 完了済み
- [x] プロジェクト初期化（Next.js + Socket.io + Tailwind）
- [x] 型定義 (`src/types/game.ts`)
- [x] お題リスト + AI誤回答パターン (`src/lib/words.ts`, `mockAI.ts`)
- [x] サーバー側ゲームロジック (`src/lib/gameState.ts`)
- [x] カスタムサーバー (`server.ts`)
- [x] クライアントSocket接続 (`src/lib/socket.ts`)
- [x] ニックネーム入力ページ (`src/app/page.tsx`)
- [x] ロビー画面 (`src/components/Lobby.tsx`)
- [x] 描画キャンバス (`src/components/DrawingCanvas.tsx`)
- [x] 閲覧キャンバス (`src/components/ViewCanvas.tsx`)
- [x] 推測パネル (`src/components/GuessingPanel.tsx`)
- [x] タイマー + ヘッダー + スコアボード
- [x] ゲームページ フェーズ管理 (`src/app/game/page.tsx`)
- [x] GitHubリポジトリ作成 (https://github.com/kasi-x/vive-gamer)
- [x] バグ修正: AIタイマーリーク、キャンバスクリア、二重join、endRound再入、Unicode正規化
- [x] ストローク履歴保持 + 途中参加者へのcanvas_state送信
- [x] モバイルレイアウト最適化（レスポンシブpadding/gap/font-size）
- [x] 切断時の再接続処理（Socket.io reconnection + 自動rejoin）
- [x] アニメーション追加（正解フラッシュ、スコアpop、スライドイン、ローディングスピナー）

## 未対応（今後の改善）
- [ ] 複数ルーム対応
- [ ] 実際のAI（Gemini Flash Image）統合
- [ ] Prompt Teleportモード
- [ ] Speed Sketch Fixモード
- [ ] 効果音
- [ ] Redis Pub/Sub（スケーリング用）
- [ ] デプロイ（Render等）

## 起動方法
```bash
npm run dev
```
ブラウザ2タブで `http://localhost:3000` にアクセスし、異なるニックネームで参加。
