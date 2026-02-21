import { GoogleGenerativeAI } from "@google/generative-ai";
import { getAIGuess as getMockGuess, type AIGuessResult } from "./mockAI";

const apiKey = process.env.GEMINI_API_KEY;

const genai = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const model = genai?.getGenerativeModel({ model: "gemini-2.5-flash" }) ?? null;

const normalize = (s: string) => s.trim().normalize("NFC").toLowerCase();

function checkCorrect(aiText: string, word: string): boolean {
  const a = normalize(aiText);
  const w = normalize(word);
  return a === w || a.includes(w) || w.includes(a);
}

export async function guessFromImage(
  imageBase64: string,
  currentWord: string,
  attemptNumber: number
): Promise<AIGuessResult> {
  if (!model) {
    console.log("[AI] APIキー未設定 → mockAIフォールバック");
    return getMockGuess(currentWord, attemptNumber);
  }

  try {
    // data:image/png;base64, プレフィックスを除去
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "image/png",
          data: base64Data,
        },
      },
      {
        text: "あなたはお絵かきゲームの参加者です。この絵が何を描いているか、日本語1単語で答えてください。単語のみを回答し、説明は不要です。",
      },
    ]);

    const response = result.response;
    const aiText = response.text().trim();

    console.log(`[AI] Gemini回答: "${aiText}" (正解: "${currentWord}")`);

    const isCorrect = checkCorrect(aiText, currentWord);
    return { text: aiText, isCorrect };
  } catch (error) {
    console.error("[AI] Gemini APIエラー → mockAIフォールバック:", error);
    return getMockGuess(currentWord, attemptNumber);
  }
}
