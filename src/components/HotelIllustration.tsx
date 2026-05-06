// Inline SVG illustration of a stylised hotel facade.
// Used in place of real photography in the Visit Brief wizard so the cards
// look intentional (Spotnana-style booking cards) without depending on
// outbound image fetches that the corp proxy may block.
import { useMemo } from 'react';

type Palette = {
  sky: string;
  building: string;
  buildingShade: string;
  windowOn: string;
  accent: string;
  ground: string;
};

const BRAND_PALETTES: Record<string, Palette> = {
  Hilton:   { sky: '#0b3d91', building: '#9aa4b1', buildingShade: '#5b6573', windowOn: '#ffd166', accent: '#003d8f', ground: '#1d2a3d' },
  Marriott: { sky: '#1f2a44', building: '#b48a5c', buildingShade: '#7a5a36', windowOn: '#ffe39a', accent: '#a52a2a', ground: '#1a1a1a' },
  Hyatt:    { sky: '#284e6b', building: '#cfd8dc', buildingShade: '#7a8a93', windowOn: '#ffd166', accent: '#0a4d8c', ground: '#1c2a36' },
  IHG:      { sky: '#2c3e50', building: '#d6c7a1', buildingShade: '#937a4f', windowOn: '#ffeaa7', accent: '#005a9c', ground: '#1a1f24' },
  Default:  { sky: '#1a3a6c', building: '#b8c0c8', buildingShade: '#6c757d', windowOn: '#ffc220', accent: '#0053e2', ground: '#1c2434' },
};

function paletteFor(brand: string): Palette {
  return BRAND_PALETTES[brand] ?? BRAND_PALETTES.Default;
}

// Tiny deterministic PRNG so the same hotel always renders identically.
function seedFrom(input: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967296;
  };
}

export type HotelIllustrationProps = {
  hotelId: string;
  brand: string;
  name: string;
};

export function HotelIllustration({ hotelId, brand, name }: HotelIllustrationProps) {
  const palette = paletteFor(brand);
  const variant = useMemo(() => {
    const rng = seedFrom(`${hotelId}|${brand}`);
    const floors = 5 + Math.floor(rng() * 5);          // 5..9 floors
    const cols = 4 + Math.floor(rng() * 4);            // 4..7 window cols
    const litMask: boolean[] = [];
    for (let i = 0; i < floors * cols; i++) litMask.push(rng() < 0.55);
    const hasAwning = rng() < 0.6;
    return { floors, cols, litMask, hasAwning };
  }, [hotelId, brand]);

  const W = 320;
  const H = 200;
  const groundY = H - 26;
  const buildingW = W - 80;
  const buildingX = (W - buildingW) / 2;
  const buildingY = 24;
  const buildingH = groundY - buildingY;

  const cellW = buildingW / variant.cols;
  const cellH = buildingH / variant.floors;
  const winPadX = cellW * 0.22;
  const winPadY = cellH * 0.22;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`Stylised illustration of ${name}`}
      className="vb-hotel-illus"
    >
      <defs>
        <linearGradient id={`sky-${hotelId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.sky} />
          <stop offset="100%" stopColor={palette.ground} />
        </linearGradient>
        <linearGradient id={`bldg-${hotelId}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={palette.building} />
          <stop offset="100%" stopColor={palette.buildingShade} />
        </linearGradient>
      </defs>

      {/* sky + ground */}
      <rect x={0} y={0} width={W} height={H} fill={`url(#sky-${hotelId})`} />
      <rect x={0} y={groundY} width={W} height={H - groundY} fill={palette.ground} />

      {/* neighbour silhouettes */}
      <rect x={6}      y={groundY - 60} width={42} height={60} fill={palette.buildingShade} opacity={0.5} />
      <rect x={W - 60} y={groundY - 80} width={50} height={80} fill={palette.buildingShade} opacity={0.55} />

      {/* main building */}
      <rect x={buildingX} y={buildingY} width={buildingW} height={buildingH} fill={`url(#bldg-${hotelId})`} stroke="rgba(0,0,0,0.25)" />

      {/* roof ledge */}
      <rect x={buildingX - 3} y={buildingY} width={buildingW + 6} height={6} fill={palette.buildingShade} />

      {/* windows */}
      {Array.from({ length: variant.floors }).flatMap((_, row) =>
        Array.from({ length: variant.cols }).map((_, col) => {
          const idx = row * variant.cols + col;
          const lit = variant.litMask[idx];
          const x = buildingX + col * cellW + winPadX;
          const y = buildingY + 8 + row * cellH + winPadY;
          const w = cellW - winPadX * 2;
          const h = cellH - winPadY * 2;
          return (
            <rect
              key={`${row}-${col}`}
              x={x}
              y={y}
              width={w}
              height={h}
              rx={1.5}
              fill={lit ? palette.windowOn : 'rgba(0,0,0,0.45)'}
              opacity={lit ? 0.9 : 0.7}
            />
          );
        }),
      )}

      {/* lobby band */}
      <rect x={buildingX} y={groundY - 22} width={buildingW} height={22} fill={palette.accent} opacity={0.85} />
      <rect x={buildingX + 8} y={groundY - 18} width={buildingW - 16} height={14} fill="rgba(255,255,255,0.18)" />

      {/* awning / brand stripe */}
      {variant.hasAwning && (
        <rect x={buildingX + buildingW * 0.25} y={groundY - 30} width={buildingW * 0.5} height={8} fill={palette.accent} />
      )}

      {/* brand text */}
      <text
        x={W / 2}
        y={H - 8}
        textAnchor="middle"
        fontSize={11}
        fontWeight={800}
        letterSpacing="0.18em"
        fill="#ffffff"
        opacity={0.9}
      >
        {brand.toUpperCase()}
      </text>
    </svg>
  );
}
