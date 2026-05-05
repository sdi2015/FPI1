import type { FireAlarmProgramData } from './fireAlarmTypes';

export type FireAlarmChartDatum = {
  label: string;
  value: number;
  color: string;
  tone: 'red' | 'yellow' | 'green' | 'blue';
};

export type FireAlarmChartModel = {
  riskDistribution: FireAlarmChartDatum[];
  eventTypes: FireAlarmChartDatum[];
  deficiencySeverity: FireAlarmChartDatum[];
  regionRisk: FireAlarmChartDatum[];
  inspectionResults: FireAlarmChartDatum[];
};

const RED = '#ef4444';
const YELLOW = '#ffc220';
const GREEN = '#22c55e';
const BLUE = '#4dbdf5';

export function buildFireAlarmChartModel(data: FireAlarmProgramData): FireAlarmChartModel {
  return {
    riskDistribution: [
      { label: 'Green / 0-49', value: data.sites.filter((site) => site.riskScore < 50).length, color: GREEN, tone: 'green' },
      { label: 'Yellow / 50-74', value: data.sites.filter((site) => site.riskScore >= 50 && site.riskScore < 75).length, color: YELLOW, tone: 'yellow' },
      { label: 'Red / 75+', value: data.sites.filter((site) => site.riskScore >= 75).length, color: RED, tone: 'red' },
    ],
    eventTypes: makeBreakdown(data.events.map((event) => event.type ?? 'Unknown'), 8).map((item, index) => ({
      ...item,
      color: index % 3 === 0 ? RED : index % 3 === 1 ? YELLOW : BLUE,
      tone: index % 3 === 0 ? 'red' : index % 3 === 1 ? 'yellow' : 'blue',
    })),
    deficiencySeverity: ['Critical', 'High', 'Medium', 'Low'].map((severity) => ({
      label: severity,
      value: data.deficiencies.filter((deficiency) => deficiency.severity === severity).length,
      color: severity === 'Critical' || severity === 'High' ? RED : severity === 'Medium' ? YELLOW : GREEN,
      tone: severity === 'Critical' || severity === 'High' ? 'red' : severity === 'Medium' ? 'yellow' : 'green',
    })),
    regionRisk: makeRegionRisk(data),
    inspectionResults: makeBreakdown(data.inspections.map((inspection) => inspection.result ?? 'Unknown'), 6).map((item) => ({
      ...item,
      color: item.label.toLowerCase().includes('fail') || item.label.toLowerCase().includes('deficien') ? RED : item.label.toLowerCase().includes('pass') ? GREEN : YELLOW,
      tone: item.label.toLowerCase().includes('fail') || item.label.toLowerCase().includes('deficien') ? 'red' : item.label.toLowerCase().includes('pass') ? 'green' : 'yellow',
    })),
  };
}

function makeRegionRisk(data: FireAlarmProgramData): FireAlarmChartDatum[] {
  const regions = Array.from(new Set(data.sites.map((site) => site.region))).sort((a, b) => a.localeCompare(b));
  return regions.map((region) => {
    const sites = data.sites.filter((site) => site.region === region);
    const averageRisk = sites.length > 0 ? Math.round(sites.reduce((total, site) => total + site.riskScore, 0) / sites.length) : 0;
    return {
      label: region,
      value: averageRisk,
      color: averageRisk >= 75 ? RED : averageRisk >= 50 ? YELLOW : GREEN,
      tone: averageRisk >= 75 ? 'red' : averageRisk >= 50 ? 'yellow' : 'green',
    };
  });
}

function makeBreakdown(values: string[], limit: number): Array<{ label: string; value: number }> {
  const counts = values.reduce<Record<string, number>>((accumulator, value) => {
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(counts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}
