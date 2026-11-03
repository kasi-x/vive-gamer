// モード2（テレポート）のデモ用画像を事前生成
// Usage: npx tsx scripts/generate-teleport-images.ts

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";

// .env.local読み込み
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    process.env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
  }
}

const API_KEY = process.env.GEMINI_API_KEY!;
const MODEL = "gemini-2.5-flash-image";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

// 生成する組み合わせを明示的に定義（デモ用に厳選）
const TASKS: { prompt: string; style?: string; key: string }[] = [
  // Round 1: プロンプト + スタイル（2人 × 3パターン = 6枚）
  { prompt: "宇宙を泳ぐクジラ", style: "サイバーパンク", key: "r1_whale_cyber" },
  { prompt: "宇宙を泳ぐクジラ", style: "水彩画", key: "r1_whale_watercolor" },
  { prompt: "森の中の城", style: "粘土細工", key: "r1_castle_clay" },
  { prompt: "森の中の城", style: "浮世絵", key: "r1_castle_ukiyoe" },
  { prompt: "空飛ぶ猫", style: "80年代レトロ", key: "r1_cat_retro" },
  { prompt: "空飛ぶ猫", style: "パステル", key: "r1_cat_pastel" },
  { prompt: "海底の街", style: "ドット絵", key: "r1_underwater_pixel" },
  { prompt: "海底の街", style: "アメコミ", key: "r1_underwater_comic" },
  { prompt: "不思議な風景", style: "サイバーパンク", key: "r1_landscape_cyber" },
  { prompt: "不思議な風景", style: "水彩画", key: "r1_landscape_watercolor" },
  { prompt: "雲の上のカフェ", style: "パステル", key: "r1_cafe_pastel" },
  { prompt: "雲の上のカフェ", style: "粘土細工", key: "r1_cafe_clay" },

  // Round 2: 説明文（スタイルなし、6枚）
  { prompt: "青い背景に白い大きな生き物が浮かんでいる", key: "r2_blue_creature" },
  { prompt: "緑の木々に囲まれた大きな建物", key: "r2_building_trees" },
  { prompt: "空に浮かぶふわふわの動物", key: "r2_flying_animal" },
  { prompt: "水の中にビルや家がある不思議な世界", key: "r2_underwater_city" },
  { prompt: "空の上にテーブルや椅子がある場所", key: "r2_sky_cafe" },
  { prompt: "カラフルで不思議な景色", key: "r2_colorful_landscape" },
];

async function generateImage(prompt: string, style?: string): Promise<Buffer | null> {
  const fullPrompt = style
    ? `以下のプロンプトを「${style}」スタイルで画像にしてください。テキストや文字は含めないでください。\n\nプロンプト: ${prompt}`
    : `以下のプロンプトを画像にしてください。テキストや文字は含めないでください。\n\nプロンプト: ${prompt}`;

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    });

    if (!res.ok) {
      console.error(`  [ERR] ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts;
    if (!parts) return null;

    for (const part of parts) {
      if (part.inlineData?.data) {
        return Buffer.from(part.inlineData.data, "base64");
      }
    }
    return null;
  } catch (err) {
    console.error(`  [ERR]`, err);
    return null;
  }
}

async function main() {
  const outDir = resolve(process.cwd(), "public/teleport");
  mkdirSync(outDir, { recursive: true });

  console.log("=== テレポート・デモ画像生成 ===\n");

  const mapping: Record<string, string> = {};

  for (const task of TASKS) {
    const filename = `${task.key}.png`;
    const outPath = resolve(outDir, filename);

    if (existsSync(outPath)) {
      console.log(`[SKIP] ${task.key}`);
      const mapKey = `${task.prompt}|||${task.style || ""}`;
      mapping[mapKey] = `/teleport/${filename}`;
      continue;
    }

    const label = task.style ? `${task.prompt} × ${task.style}` : task.prompt;
    console.log(`[GEN] ${label} ...`);

    const buf = await generateImage(task.prompt, task.style);
    if (buf) {
      writeFileSync(outPath, buf);
      const mapKey = `${task.prompt}|||${task.style || ""}`;
      mapping[mapKey] = `/teleport/${filename}`;
      console.log(`[OK] ${task.key} (${(buf.length / 1024).toFixed(0)} KB)`);
    } else {
      console.log(`[FAIL] ${task.key}`);
    }
  }

  // マッピングファイル
  writeFileSync(resolve(outDir, "mapping.json"), JSON.stringify(mapping, null, 2));
  console.log(`\n[OK] mapping.json (${Object.keys(mapping).length}件)`);
  console.log("\n=== 完了 ===");
}

main().catch(console.error);
