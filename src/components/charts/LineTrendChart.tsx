import type { ChartPoint } from '../../data/fireAlarmMetrics';

export function LineTrendChart({ data, color = '#2563eb' }: { data: ChartPoint[]; color?: string }) {
  const width = 720;
  const height = 220;
  const padding = 28;
  const max = Math.max(...data.map((item) => item.value), 1);
  const step = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;
  const points = data.map((item, index) => {
    const x = padding + index * step;
    const y = height - padding - (item.value / max) * (height - padding * 2);
    return { ...item, x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

  return (
    <div className="ops-line-chart">
      {data.length > 0 ? (
        <>
          <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Line trend chart">
            <path className="ops-grid-line" d={`M ${padding} ${height - padding} L ${width - padding} ${height - padding}`} />
            <path className="ops-trend-line" d={path} stroke={color} />
            {points.map((point) => <circle key={`${point.label}-${point.value}`} cx={point.x} cy={point.y} r="5" fill={color}><title>{point.label}: {point.value}</title></circle>)}
          </svg>
          <div className="ops-line-labels">{data.map((item) => <span key={item.label}>{item.label}<strong>{item.value}</strong></span>)}</div>
        </>
      ) : <p className="fire-ops-empty">No trend data available for this selection.</p>}
    </div>
  );
}
