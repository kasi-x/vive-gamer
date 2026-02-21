// Gemini 2.5 Flash Image を REST API で直接呼び出し（依存追加不要）
// フォールバック: APIキー未設定 or エラー時はモックSVGを返す
// キャッシュ: 同じプロンプト+スタイルの画像を50%の確率で再利用

import { generateMockImage } from "./mockImages";
import type { StyleCard } from "../types/game";

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash-preview-05-20";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

const CACHE_REUSE_RATE = 0.5; // キャッシュ再利用確率
const MAX_CACHE_SIZE = 100;

// プロンプト+スタイル → 生成済み画像のキャッシュ（複数バリエーション保持）
const imageCache = new Map<string, string[]>();

function cacheKey(prompt: string, styleCard?: StyleCard): string {
  return `${prompt}|||${styleCard || ""}`;
}

function getCachedImage(prompt: string, styleCard?: StyleCard): string | null {
  const key = cacheKey(prompt, styleCard);
  const cached = imageCache.get(key);
  if (!cached || cached.length === 0) return null;

  if (Math.random() < CACHE_REUSE_RATE) {
    const pick = cached[Math.floor(Math.random() * cached.length)];
    console.log(`[画像生成] キャッシュ再利用: ${prompt.slice(0, 30)}... (${cached.length}件中)`);
    return pick;
  }
  return null; // 新規生成
}

function addToCache(prompt: string, styleCard: StyleCard | undefined, image: string) {
  const key = cacheKey(prompt, styleCard);
  const existing = imageCache.get(key) || [];
  existing.push(image);
  // 1キーあたり最大5バリエーション
  if (existing.length > 5) existing.shift();
  imageCache.set(key, existing);

  // 全体サイズ制限
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
  if (!API_KEY) {
    console.log("[画像生成] APIキー未設定 → モック画像");
    return generateMockImage(prompt, styleCard);
  }

  // キャッシュチェック
  const cached = getCachedImage(prompt, styleCard);
  if (cached) return cached;

  const fullPrompt = styleCard
    ? `以下のプロンプトを「${styleCard}」スタイルで画像にしてください。テキストや文字は含めないでください。\n\nプロンプト: ${prompt}`
    : `以下のプロンプトを画像にしてください。テキストや文字は含めないでください。\n\nプロンプト: ${prompt}`;

  try {
    const res = await fetch(API_URL, {
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

    // 画像パートを探す
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
