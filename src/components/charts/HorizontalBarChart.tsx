import type { BarChartPoint } from '../../data/fireAlarmMetrics';

export function HorizontalBarChart({ data, maxValue, onSelect }: { data: BarChartPoint[]; maxValue?: number; onSelect?: (label: string) => void }) {
  const max = maxValue ?? Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="ops-bar-chart">
      {data.length > 0 ? data.map((item) => (
        <button
          type="button"
          className={`ops-chart-row tone-${item.tone ?? 'info'}`}
          key={item.label}
          onClick={() => onSelect?.(item.label)}
          disabled={!onSelect}
          title={`${item.label}: ${item.value}`}
        >
          <div><span>{item.label}</span><strong>{item.value}</strong></div>
          <div className="ops-chart-track"><span style={{ width: `${Math.max(4, Math.min(100, (item.value / max) * 100))}%`, background: item.color }} /></div>
        </button>
      )) : <p className="fire-ops-empty">No chart data available for this selection.</p>}
    </div>
  );
}
