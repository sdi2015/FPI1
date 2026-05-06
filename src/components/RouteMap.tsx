import { useMemo } from 'react';
import type { EprFacility } from '../data/eprTypes';
import { CONUS_CENTER, CONUS_OUTLINE, MARKET_COORDS } from '../data/marketCoords';

// CONUS canvas — projection always paints into this 960x560 space; the
// rendered viewBox is then cropped to the actual stop bounding box so a
// regional cluster (e.g. Walmart Region 75 in VA/MD) auto-zooms in.
const VB_WIDTH = 960;
const VB_HEIGHT = 560;
const PADDING = 28;

const LNG_MIN = -125;
const LNG_MAX = -66;
const LAT_MIN = 24;
const LAT_MAX = 50;

// Equirectangular projection with cosine correction at the mid latitude.
function project(lat: number, lng: number): [number, number] {
  const midLat = (LAT_MIN + LAT_MAX) / 2;
  const cos = Math.cos((midLat * Math.PI) / 180);
  const usableW = VB_WIDTH - PADDING * 2;
  const usableH = VB_HEIGHT - PADDING * 2;
  const xRange = (LNG_MAX - LNG_MIN) * cos;
  const yRange = LAT_MAX - LAT_MIN;
  const x = PADDING + ((lng - LNG_MIN) * cos / xRange) * usableW;
  const y = PADDING + (1 - (lat - LAT_MIN) / yRange) * usableH;
  return [x, y];
}

function resolveCoords(facility: EprFacility): [number, number] {
  if (typeof facility.latitude === 'number' && typeof facility.longitude === 'number') {
    return [facility.latitude, facility.longitude];
  }
  const market = MARKET_COORDS[facility.market];
  if (market) return market;
  return CONUS_CENTER;
}

function riskTone(score: number): string {
  if (score >= 80) return 'critical';
  if (score >= 70) return 'high';
  return 'moderate';
}

function outlinePath(): string {
  return CONUS_OUTLINE
    .map(([lng, lat], i) => {
      const [x, y] = project(lat, lng);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ') + ' Z';
}

type Stop = {
  facility: EprFacility;
  index: number;
  x: number;
  y: number;
  tone: string;
  labelAbove: boolean;
};

function assignLabelSides(rawStops: Omit<Stop, 'labelAbove'>[], collisionRadius: number): Stop[] {
  return rawStops.map((stop, i) => {
    const earlierCollision = rawStops
      .slice(0, i)
      .some((other) => Math.hypot(other.x - stop.x, other.y - stop.y) < collisionRadius);
    const laterCollision = rawStops
      .slice(i + 1)
      .some((other) => Math.hypot(other.x - stop.x, other.y - stop.y) < collisionRadius);
    const collides = earlierCollision || laterCollision;
    return { ...stop, labelAbove: !(collides && earlierCollision) };
  });
}

// Compute a viewBox that hugs the stops with padding, so a regional
// cluster zooms in instead of showing as dots in the corner of CONUS.
function computeViewBox(stops: Stop[]): { x: number; y: number; w: number; h: number; scale: number } {
  if (stops.length === 0) {
    return { x: 0, y: 0, w: VB_WIDTH, h: VB_HEIGHT, scale: 1 };
  }
  const xs = stops.map((s) => s.x);
  const ys = stops.map((s) => s.y);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);

  // Expand to a comfortable padding around the cluster.
  const pad = 90;
  minX -= pad; maxX += pad; minY -= pad; maxY += pad;

  // Maintain CONUS aspect ratio so labels don't squish.
  const aspect = VB_WIDTH / VB_HEIGHT;
  let w = maxX - minX;
  let h = maxY - minY;
  if (w / h > aspect) {
    const newH = w / aspect;
    minY -= (newH - h) / 2;
    h = newH;
  } else {
    const newW = h * aspect;
    minX -= (newW - w) / 2;
    w = newW;
  }

  // Don't zoom past CONUS extents, and don't zoom in so far the dots tile.
  const minSpan = VB_WIDTH * 0.18;
  if (w < minSpan) {
    const grow = (minSpan - w) / 2;
    minX -= grow;
    w = minSpan;
    minY -= grow / aspect;
    h = minSpan / aspect;
  }
  if (w > VB_WIDTH) {
    minX = 0; w = VB_WIDTH; minY = 0; h = VB_HEIGHT;
  }

  const scale = w / VB_WIDTH;
  return { x: minX, y: minY, w, h, scale };
}

export type RouteMapProps = {
  facilities: EprFacility[];
};

export function RouteMap({ facilities }: RouteMapProps) {
  const stopsRaw = useMemo(
    () =>
      facilities.map((facility, index) => {
        const [lat, lng] = resolveCoords(facility);
        const [x, y] = project(lat, lng);
        return { facility, index, x, y, tone: riskTone(facility.risk_score) };
      }),
    [facilities],
  );

  const view = useMemo(() => computeViewBox(stopsRaw as Stop[]), [stopsRaw]);

  // Stop circle / label sizes scale with the viewBox so they stay readable
  // at any zoom level instead of either disappearing or eating the screen.
  const s = view.scale;
  const circleR = 14 * s;
  const labelFont = 12 * s;
  const nameFont = 11 * s;
  const metaFont = 10 * s;
  const lineWidth = 3 * s;
  const dash = `${6 * s} ${6 * s}`;
  const collisionRadius = 36 * s;

  const stops = useMemo(
    () => assignLabelSides(stopsRaw, collisionRadius),
    [stopsRaw, collisionRadius],
  );

  const linePath = useMemo(() => {
    if (stops.length < 2) return '';
    return stops
      .map((stop, i) => `${i === 0 ? 'M' : 'L'} ${stop.x.toFixed(1)} ${stop.y.toFixed(1)}`)
      .join(' ');
  }, [stops]);

  if (stops.length === 0) return null;

  return (
    <figure className="epr-route-map" aria-label="Draft visit route map">
      <svg
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        role="img"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="eprMapBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(0, 83, 226, 0.10)" />
            <stop offset="100%" stopColor="rgba(0, 83, 226, 0.02)" />
          </linearGradient>
          <filter id="eprStopShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy={1 * s} stdDeviation={2 * s} floodColor="#001a4d" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x={view.x} y={view.y} width={view.w} height={view.h} fill="url(#eprMapBg)" />
        <path
          d={outlinePath()}
          fill="rgba(255,255,255,0.05)"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth={1.4 * s}
          strokeLinejoin="round"
        />

        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="#ffc220"
            strokeWidth={lineWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={dash}
            opacity={0.95}
          />
        )}

        {stops.map((stop) => {
          const nameY = stop.labelAbove ? -22 * s : 28 * s;
          const metaY = stop.labelAbove ? 32 * s : 42 * s;
          return (
            <g key={stop.facility.facility_id} transform={`translate(${stop.x} ${stop.y})`}>
              <circle r={circleR} className={`epr-route-stop epr-route-stop--${stop.tone}`} filter="url(#eprStopShadow)" />
              <text y={5 * s} textAnchor="middle" className="epr-route-stop-label" fontSize={labelFont} fontWeight={800}>
                {stop.index + 1}
              </text>
              <text y={nameY} textAnchor="middle" className="epr-route-stop-name" fontSize={nameFont} fontWeight={700}>
                {stop.facility.facility_name}
              </text>
              <text y={metaY} textAnchor="middle" className="epr-route-stop-meta" fontSize={metaFont}>
                {[stop.facility.city, stop.facility.state].filter(Boolean).join(', ') || stop.facility.market}
                {' · Risk '}{Math.round(stop.facility.risk_score)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="epr-route-map-caption">
        Draft route — {stops.length} stop{stops.length === 1 ? '' : 's'} · auto-zoomed to selection bounds. Demo data; route order matches selection order.
      </figcaption>
    </figure>
  );
}
