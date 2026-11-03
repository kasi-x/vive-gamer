// 合体生物の画像を事前生成して public/ojama/ に保存するスクリプト
// Usage: npx tsx scripts/generate-ojama-images.ts

import { readFileSync, writeFileSync, existsSync } from "fs";
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

const creatures = [
  {
    name: "Hamstree",
    prompt:
      "A creative cartoon illustration of a fictional hybrid creature called 'Hamstree' (Hamster + Tree). A large tree trunk covered in fluffy hamster fur, with sunflower seeds growing on the branch tips, and the tree has an adorable hamster face. Colorful, fun, cute style. No text or labels.",
  },
  {
    name: "Gorillamp",
    prompt:
      "A creative cartoon illustration of a fictional hybrid creature called 'Gorillamp' (Gorilla + Lamp). A muscular gorilla whose head is a large antique lampshade, with glowing eyes. The body is a powerful gorilla but the head/top is an ornate lamp. Colorful, fun style. No text or labels.",
  },
  {
    name: "Octopiano",
    prompt:
      "A creative cartoon illustration of a fictional hybrid creature called 'Octopiano' (Octopus + Piano). A giant octopus with 8 tentacles that are piano keys, or the tentacles are playing a grand piano. Musical and oceanic hybrid. Colorful, fun style. No text or labels.",
  },
  {
    name: "Sharkodile",
    prompt:
      "A creative cartoon illustration of a fictional hybrid creature called 'Sharkodile' (Shark + Crocodile). Has a shark's dorsal fin and sharp teeth, but the body and tail are crocodile-like. The ultimate apex predator of the waterways. Colorful, fun style. No text or labels.",
  },
  {
    name: "Pineapplow",
    prompt:
      "A creative cartoon illustration of a fictional hybrid creature called 'Pineapplow' (Pineapple + Owl). An owl whose body has pineapple-textured scales/surface, with pineapple leaf-like ear tufts on its head. Tropical and cute. Colorful, fun style. No text or labels.",
  },
];

async function generateImage(name: string, prompt: string): Promise<void> {
  const outPath = resolve(process.cwd(), `public/ojama/${name.toLowerCase()}.png`);

  if (existsSync(outPath)) {
    console.log(`[SKIP] ${name} — already exists`);
    return;
  }

  console.log(`[GEN] ${name} — generating...`);

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
  });

  if (!res.ok) {
    console.error(`[ERR] ${name}: ${res.status} ${res.statusText}`);
    return;
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts) {
    console.error(`[ERR] ${name}: no parts in response`);
    return;
  }

  for (const part of parts) {
    if (part.inlineData?.data) {
      const buf = Buffer.from(part.inlineData.data, "base64");
      writeFileSync(outPath, buf);
      console.log(`[OK] ${name} — saved (${(buf.length / 1024).toFixed(0)} KB)`);
      return;
    }
  }

  console.error(`[ERR] ${name}: no image data found`);
}

async function main() {
  console.log("=== 合体生物画像の事前生成 ===\n");

  for (const c of creatures) {
    await generateImage(c.name, c.prompt);
  }

  console.log("\n=== 完了 ===");
}

main().catch(console.error);
