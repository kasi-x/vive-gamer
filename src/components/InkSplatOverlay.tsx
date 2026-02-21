"use client";

export interface Splat {
  id: number;
  x: number;
  y: number;
  rotation: number;
  fading: boolean;
}

interface InkSplatOverlayProps {
  splats: Splat[];
}

export default function InkSplatOverlay({ splats }: InkSplatOverlayProps) {
  if (splats.length === 0) return null;

  return (
    <>
      {splats.map((splat) => (
        <div
          key={splat.id}
          className={`absolute pointer-events-none ${
            splat.fading ? "animate-splat-fade" : "animate-splat-in"
          }`}
          style={{
            left: `${splat.x}%`,
            top: `${splat.y}%`,
            transform: `rotate(${splat.rotation}deg)`,
          }}
        >
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="30" fill="rgba(15, 15, 26, 0.85)" />
            <circle cx="25" cy="20" r="12" fill="rgba(15, 15, 26, 0.75)" />
            <circle cx="60" cy="55" r="10" fill="rgba(15, 15, 26, 0.7)" />
            <circle cx="55" cy="18" r="8" fill="rgba(15, 15, 26, 0.65)" />
            <circle cx="20" cy="58" r="9" fill="rgba(15, 15, 26, 0.7)" />
          </svg>
        </div>
      ))}
    </>
  );
}
