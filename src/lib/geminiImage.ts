// Gemini 2.5 Flash Image を REST API で直接呼び出し（依存追加不要）
// フォールバック: 事前生成済み画像 → キャッシュ → API → モックSVG

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { generateMockImage } from "./mockImages";
import type { StyleCard } from "../types/game";

// API_KEY は遅延取得（import時にはまだ .env.local が未読み込みの場合がある）
const MODEL = "gemini-2.5-flash-image";
function getApiUrl() {
  return `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
}

const CACHE_REUSE_RATE = 0.5;
const MAX_CACHE_SIZE = 100;

// ランタイムキャッシュ
const imageCache = new Map<string, string[]>();

// 事前生成済み画像マッピング（public/teleport/mapping.json）
let pregenMapping: Record<string, string> | null = null;

function loadPregenMapping(): Record<string, string> {
  if (pregenMapping) return pregenMapping;
  try {
    const mapPath = resolve(process.cwd(), "public/teleport/mapping.json");
    if (existsSync(mapPath)) {
      pregenMapping = JSON.parse(readFileSync(mapPath, "utf-8"));
      console.log(`[画像生成] 事前生成マッピング読み込み: ${Object.keys(pregenMapping!).length}件`);
      return pregenMapping!;
    }
  } catch {
    // 読み込み失敗は無視
  }
  pregenMapping = {};
  return pregenMapping;
}

function cacheKey(prompt: string, styleCard?: StyleCard): string {
  return `${prompt}|||${styleCard || ""}`;
}

function getPregenImage(prompt: string, styleCard?: StyleCard): string | null {
  const mapping = loadPregenMapping();
  const key = cacheKey(prompt, styleCard);
  const path = mapping[key];
  if (!path) return null;

  // publicパスからファイルを読んでbase64化
  const filePath = resolve(process.cwd(), "public", path.replace(/^\//, ""));
  if (!existsSync(filePath)) return null;

  try {
    const buf = readFileSync(filePath);
    const b64 = buf.toString("base64");
    console.log(`[画像生成] 事前生成画像使用: ${prompt.slice(0, 30)}...`);
    return `data:image/png;base64,${b64}`;
  } catch {
    return null;
  }
}

function getCachedImage(prompt: string, styleCard?: StyleCard): string | null {
  const key = cacheKey(prompt, styleCard);
  const cached = imageCache.get(key);
  if (!cached || cached.length === 0) return null;

  if (Math.random() < CACHE_REUSE_RATE) {
    const pick = cached[Math.floor(Math.random() * cached.length)];
    console.log(`[画像生成] キャッシュ再利用: ${prompt.slice(0, 30)}...`);
    return pick;
  }
  return null;
}

function addToCache(prompt: string, styleCard: StyleCard | undefined, image: string) {
  const key = cacheKey(prompt, styleCard);
  const existing = imageCache.get(key) || [];
  existing.push(image);
  if (existing.length > 5) existing.shift();
  imageCache.set(key, existing);

  if (imageCache.size > MAX_CACHE_SIZE) {
    const firstKey = imageCache.keys().next().value;
    if (firstKey) imageCache.delete(firstKey);
  }
}

interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: {
        text?: string;
        inlineData?: { mimeType: string; data: string };
      }[];
    };
  }[];
  error?: { message: string };
}

export async function generateImageFromPrompt(
  prompt: string,
  styleCard?: StyleCard
): Promise<string> {
  // 1. 事前生成済み画像チェック（最優先）
  const pregen = getPregenImage(prompt, styleCard);
  if (pregen) return pregen;

  // 2. ランタイムキャッシュチェック
  const cached = getCachedImage(prompt, styleCard);
  if (cached) return cached;

  // 3. Gemini API
  if (!process.env.GEMINI_API_KEY) {
    console.log("[画像生成] APIキー未設定 → モック画像");
    return generateMockImage(prompt, styleCard);
  }

  const fullPrompt = styleCard
    ? `以下のプロンプトを「${styleCard}」スタイルで画像にしてください。テキストや文字は含めないでください。\n\nプロンプト: ${prompt}`
    : `以下のプロンプトを画像にしてください。テキストや文字は含めないでください。\n\nプロンプト: ${prompt}`;

  try {
    const res = await fetch(getApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      }),
    });

    if (!res.ok) {
      console.error(`[画像生成] APIエラー: ${res.status} ${res.statusText}`);
      return generateMockImage(prompt, styleCard);
    }

    const data: GeminiResponse = await res.json();

    if (data.error) {
      console.error(`[画像生成] Geminiエラー: ${data.error.message}`);
      return generateMockImage(prompt, styleCard);
    }

    const parts = data.candidates?.[0]?.content?.parts;
    if (!parts) {
      console.error("[画像生成] レスポンスにpartsがない");
      return generateMockImage(prompt, styleCard);
    }

    for (const part of parts) {
      if (part.inlineData?.data) {
        const mimeType = part.inlineData.mimeType || "image/png";
        const image = `data:${mimeType};base64,${part.inlineData.data}`;
        console.log(`[画像生成] 新規生成: ${prompt.slice(0, 30)}... (${mimeType})`);
        addToCache(prompt, styleCard, image);
        return image;
      }
    }

    console.error("[画像生成] 画像データが見つからない");
    return generateMockImage(prompt, styleCard);
  } catch (error) {
    console.error("[画像生成] ネットワークエラー:", error);
    return generateMockImage(prompt, styleCard);
  }
}
