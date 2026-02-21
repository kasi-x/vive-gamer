import { getAIGuess as getMockGuess, type AIGuessResult } from "./mockAI";

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash-preview-05-20";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

const normalize = (s: string) =>
  s.trim().normalize("NFC").toLowerCase()
    // カタカナ→ひらがな
    .replace(/[\u30A1-\u30F6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));

function checkCorrect(aiText: string, word: string): boolean {
  const a = normalize(aiText);
  const w = normalize(word);
  if (a === w) return true;
  // 完全一致以外にも、AIが正解を含む短い回答をした場合
  if (a.length <= w.length + 3 && a.includes(w)) return true;
  if (w.length <= a.length + 3 && w.includes(a) && a.length >= 2) return true;
  return false;
}

// 回数に応じてヒントの度合いを調整
function buildPrompt(attemptNumber: number): string {
  if (attemptNumber === 0) {
    return "あなたはお絵かきゲームの参加者です。この絵が何を描いているか推測してください。日本語1単語だけで答えてください。説明や句読点は不要です。";
  }
  if (attemptNumber <= 2) {
    return "この絵が何を描いているか、前回とは違う回答を日本語1単語で答えてください。もっと細部や全体の形に注目してください。単語のみ回答。";
  }
  return "この絵が何を描いているか、まだ当てられていません。描かれている物体の形・色・特徴をよく観察して、日本語1単語で推測してください。単語のみ回答。";
}

export async function guessFromImage(
  imageBase64: string,
  currentWord: string,
  attemptNumber: number
): Promise<AIGuessResult> {
  if (!API_KEY) {
    console.log("[AI] APIキー未設定 → mockAIフォールバック");
    return getMockGuess(currentWord, attemptNumber);
  }

  try {
    // data:image/png;base64, プレフィックスを除去
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType: "image/png",
                data: base64Data,
              },
            },
            { text: buildPrompt(attemptNumber) },
          ],
        }],
        generationConfig: {
          temperature: 0.8 + attemptNumber * 0.1, // 回数が増えるとランダム性UP
          maxOutputTokens: 20,
        },
      }),
    });

    if (!res.ok) {
      console.error(`[AI] APIエラー: ${res.status} → mockAIフォールバック`);
      return getMockGuess(currentWord, attemptNumber);
    }

    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts;
    if (!parts || parts.length === 0) {
      console.error("[AI] レスポンスにpartsがない → mockAIフォールバック");
      return getMockGuess(currentWord, attemptNumber);
    }

    const aiText = (parts[0].text || "").trim().replace(/[。、！？\.\!\?]/g, "");
    console.log(`[AI] Gemini回答: "${aiText}" (正解: "${currentWord}", 試行: ${attemptNumber})`);

    const isCorrect = checkCorrect(aiText, currentWord);
    return { text: aiText, isCorrect };
  } catch (error) {
    console.error("[AI] Gemini APIエラー → mockAIフォールバック:", error);
    return getMockGuess(currentWord, attemptNumber);
  }
}
