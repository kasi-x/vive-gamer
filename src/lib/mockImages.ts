// プロンプトテキストからモック画像（SVG base64）を生成
// 本番ではGemini画像生成APIに置き換え

import type { StyleCard } from "../types/game";

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const STYLE_COLORS: Record<StyleCard, [string, string]> = {
  "80年代レトロ": ["#ff6ec7", "#7b2ff7"],
  粘土細工: ["#e8a87c", "#85603f"],
  サイバーパンク: ["#00f0ff", "#8b00ff"],
  水彩画: ["#87ceeb", "#dda0dd"],
  ドット絵: ["#4caf50", "#ffeb3b"],
  浮世絵: ["#1a237e", "#e65100"],
  アメコミ: ["#f44336", "#2196f3"],
  パステル: ["#ffc1cc", "#c1f0c1"],
};

export function generateMockImage(
  prompt: string,
  styleCard?: StyleCard
): string {
  const h = hashCode(prompt);
  const hue1 = h % 360;
  const hue2 = (hue1 + 120) % 360;

  let color1: string;
  let color2: string;

  if (styleCard && STYLE_COLORS[styleCard]) {
    [color1, color2] = STYLE_COLORS[styleCard];
  } else {
    color1 = `hsl(${hue1}, 70%, 60%)`;
    color2 = `hsl(${hue2}, 70%, 40%)`;
  }

  // プロンプトの最初の20文字を表示
  const displayText = prompt.length > 20 ? prompt.slice(0, 20) + "…" : prompt;
  const styleLabel = styleCard ? `[ ${styleCard} ]` : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color1}"/>
      <stop offset="100%" style="stop-color:${color2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%">
      <stop offset="0%" style="stop-color:white;stop-opacity:0.3"/>
      <stop offset="100%" style="stop-color:white;stop-opacity:0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)" rx="16"/>
  <rect width="512" height="512" fill="url(#glow)"/>
  <text x="256" y="230" text-anchor="middle" fill="white" font-size="28" font-family="sans-serif" opacity="0.9">${escapeXml(displayText)}</text>
  <text x="256" y="290" text-anchor="middle" fill="white" font-size="18" font-family="sans-serif" opacity="0.6">${escapeXml(styleLabel)}</text>
  <text x="256" y="460" text-anchor="middle" fill="white" font-size="14" font-family="sans-serif" opacity="0.4">AI生成モック画像</text>
</svg>`;

  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
