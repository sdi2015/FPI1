import type { BarChartPoint } from '../../data/fireAlarmMetrics';

export function DonutChart({ data, onSelect }: { data: BarChartPoint[]; onSelect?: (label: string) => void }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let offset = 25;

  return (
    <div className="ops-donut-wrap">
      <div className="ops-donut-stage">
        <svg className="ops-donut" viewBox="0 0 42 42" role="img" aria-label="Donut chart">
          <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="rgba(169,221,247,0.13)" strokeWidth="6" />
          {data.map((item) => {
            const dash = total > 0 ? (item.value / total) * 100 : 0;
            const circle = <circle className={onSelect ? 'ops-donut-segment clickable' : 'ops-donut-segment'} key={item.label} cx="21" cy="21" r="15.915" fill="transparent" stroke={item.color ?? '#2563eb'} strokeWidth="6" strokeDasharray={`${dash} ${100 - dash}`} strokeDashoffset={offset} onClick={() => onSelect?.(item.label)}><title>{item.label}: {item.value} sites</title></circle>;
            offset -= dash;
            return circle;
          })}
        </svg>
        <div className="ops-donut-center"><strong>{total}</strong><span>Total Sites</span></div>
      </div>
      <div className="ops-donut-legend">
        {data.map((item) => <button type="button" key={item.label} onClick={() => onSelect?.(item.label)} disabled={!onSelect}><i style={{ background: item.color }} />{item.label}<strong>{item.value}</strong></button>)}
      </div>
    </div>
  );
}
