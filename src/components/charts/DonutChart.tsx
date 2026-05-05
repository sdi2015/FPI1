import type { BarChartPoint } from '../../data/fireAlarmMetrics';

export function DonutChart({ data }: { data: BarChartPoint[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let offset = 25;

  return (
    <div className="ops-donut-wrap">
      <svg className="ops-donut" viewBox="0 0 42 42" role="img" aria-label="Donut chart">
        <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#e2e8f0" strokeWidth="5" />
        {data.map((item) => {
          const dash = total > 0 ? (item.value / total) * 100 : 0;
          const circle = <circle key={item.label} cx="21" cy="21" r="15.915" fill="transparent" stroke={item.color ?? '#2563eb'} strokeWidth="5" strokeDasharray={`${dash} ${100 - dash}`} strokeDashoffset={offset} />;
          offset -= dash;
          return circle;
        })}
      </svg>
      <div className="ops-donut-legend">
        {data.map((item) => <span key={item.label}><i style={{ background: item.color }} />{item.label}: <strong>{item.value}</strong></span>)}
      </div>
    </div>
  );
}
