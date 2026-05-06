// Pure data → file-string converters for visit-route exports.
// Each exporter takes a list of EprFacility (in route order) and returns a
// { filename, mimeType, content } payload that callers turn into a download.
//
// Kept dep-free and side-effect free so it's trivially unit-testable.

import type { EprFacility } from './eprTypes';

export type ExportPayload = {
  filename: string;
  mimeType: string;
  content: string;
};

const todayStamp = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
};

// ---------- CSV ----------
const csvEscape = (value: string | number | undefined | null): string => {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // Quote if contains comma, quote, newline. Double-up internal quotes.
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const exportRouteCsv = (route: EprFacility[]): ExportPayload => {
  const headers = [
    'Stop', 'Facility ID', 'Facility Name', 'Market', 'Region', 'Division',
    'City', 'State', 'Risk Score', 'Risk Tier', 'Open Tasks',
    'Overdue Tasks', 'Critical Tasks', 'Avg Remediation Hours',
    'Latitude', 'Longitude',
  ];
  const rows = route.map((f, i) => [
    String(i + 1).padStart(2, '0'),
    f.facility_id, f.facility_name, f.market, f.region, f.division,
    f.city ?? '', f.state ?? '',
    Math.round(f.risk_score), f.risk_tier ?? '',
    f.open_task_count, f.overdue_task_count, f.critical_task_count,
    f.avg_remediation_hours,
    f.latitude ?? '', f.longitude ?? '',
  ].map(csvEscape).join(','));
  return {
    filename: `epr-visit-route-${todayStamp()}.csv`,
    mimeType: 'text/csv;charset=utf-8',
    content: [headers.join(','), ...rows].join('\r\n') + '\r\n',
  };
};

// ---------- JSON ----------
export const exportRouteJson = (route: EprFacility[]): ExportPayload => ({
  filename: `epr-visit-route-${todayStamp()}.json`,
  mimeType: 'application/json',
  content: JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      generator: 'FPI Executive Protection Readiness — Visit Planner',
      stop_count: route.length,
      stops: route.map((f, i) => ({ stop: i + 1, ...f })),
    },
    null,
    2,
  ),
});

// ---------- GPX (GPS Exchange — Google Maps / Garmin / Apple Maps import) ----------
const xmlEscape = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export const exportRouteGpx = (route: EprFacility[]): ExportPayload => {
  const withCoords = route.filter((f) => f.latitude != null && f.longitude != null);
  const rtepts = withCoords.map((f, i) => {
    const stop = String(i + 1).padStart(2, '0');
    const desc = `Risk ${Math.round(f.risk_score)} · ${f.open_task_count} open tasks · ${f.critical_task_count} critical`;
    return `    <rtept lat="${f.latitude}" lon="${f.longitude}">
      <name>${xmlEscape(`${stop} — ${f.facility_name}`)}</name>
      <desc>${xmlEscape(desc)}</desc>
      <cmt>${xmlEscape(`${f.market} · ${f.region}`)}</cmt>
    </rtept>`;
  }).join('\n');
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="FPI EPR Visit Planner" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Executive Visit Route</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <rte>
    <name>EPR Visit Route — ${todayStamp()}</name>
${rtepts}
  </rte>
</gpx>
`;
  return {
    filename: `epr-visit-route-${todayStamp()}.gpx`,
    mimeType: 'application/gpx+xml',
    content,
  };
};

// ---------- ICS (calendar invites for Outlook / Google Cal / Apple Cal) ----------
// Stops are mocked sequentially: starts tomorrow 9am local, 90 min per stop,
// 30 min travel buffer between. Real schedule TBD by the EP team.
const icsDate = (d: Date): string => {
  // Local-time format (no Z) so calendar apps render it in the user's tz.
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
         `T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

const icsEscape = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;')
   .replace(/,/g, '\\,').replace(/\n/g, '\\n');

const STOP_DURATION_MIN = 90;
const TRAVEL_BUFFER_MIN = 30;

export const exportRouteIcs = (route: EprFacility[]): ExportPayload => {
  const start = new Date();
  start.setDate(start.getDate() + 1); // tomorrow
  start.setHours(9, 0, 0, 0);
  const dtstamp = icsDate(new Date()) + 'Z'; // creation time in UTC-ish

  const events = route.map((f, i) => {
    const stopStart = new Date(start.getTime() + i * (STOP_DURATION_MIN + TRAVEL_BUFFER_MIN) * 60 * 1000);
    const stopEnd = new Date(stopStart.getTime() + STOP_DURATION_MIN * 60 * 1000);
    const stopNum = String(i + 1).padStart(2, '0');
    const summary = `Stop ${stopNum} — ${f.facility_name}`;
    const location = [f.city, f.state].filter(Boolean).join(', ');
    const desc = [
      `Facility ID: ${f.facility_id}`,
      `Market: ${f.market} · Region: ${f.region}`,
      `Risk score: ${Math.round(f.risk_score)}${f.risk_tier ? ` (${f.risk_tier})` : ''}`,
      `Open tasks: ${f.open_task_count} · Overdue: ${f.overdue_task_count} · Critical: ${f.critical_task_count}`,
      `Avg remediation: ${f.avg_remediation_hours}h`,
    ].join('\n');
    return [
      'BEGIN:VEVENT',
      `UID:epr-${f.facility_id}-${dtstamp}@fpi.walmart.com`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${icsDate(stopStart)}`,
      `DTEND:${icsDate(stopEnd)}`,
      `SUMMARY:${icsEscape(summary)}`,
      `LOCATION:${icsEscape(location)}`,
      `DESCRIPTION:${icsEscape(desc)}`,
      'END:VEVENT',
    ].join('\r\n');
  });

  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FPI//EPR Visit Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
    '',
  ].join('\r\n');

  return {
    filename: `epr-visit-route-${todayStamp()}.ics`,
    mimeType: 'text/calendar;charset=utf-8',
    content,
  };
};

// ---------- Browser download helper ----------
export const triggerDownload = (payload: ExportPayload): void => {
  const blob = new Blob([payload.content], { type: payload.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = payload.filename;
  document.body.appendChild(a);
  a.click();
  // Cleanup on next tick — some browsers cancel the download if revoked too fast.
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
};
