import { useEffect, useMemo, useState } from 'react';

const WARRANTY_QUEUE_URL = '/data/warranty-roi-queue.csv';

export type WarrantyRoiQueueRecord = {
  ticketId: string;
  cameraId: string;
  storeLocation: string;
  storeCity: string;
  storeState: string;
  siteName: string;
  zone: string;
  banner: string;
  region: string;
  market: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  failureReason: string;
  ticketCreatedDate: string;
  priority: string;
  resolutionDate: string;
  replacementPurchased: string;
  replacementCost: number;
  warrantyStatusAtFailure: string;
  daysUntilWarrantyExpiration: number;
  recommendedAction: string;
  potentialRecoveryValue: number;
};

export type WarrantyRoiSummary = {
  totalTickets: number;
  grossRecoveryOpportunity: number;
  netRecoveryOpportunity: number;
  claimReadyRecovery: number;
  leakageOrTriageCost: number;
  replacementSpend: number;
  claimReadyTickets: number;
  escalationTickets: number;
  rmaEligibilityTickets: number;
  purchasedReplacementTickets: number;
  roiPercent: number;
  averageRecoveryPerTicket: number;
  averageClaimValue: number;
};

export type WarrantyRoiQueueData = {
  records: WarrantyRoiQueueRecord[];
  summary: WarrantyRoiSummary;
  charts: {
    manufacturerRecovery: ChartDatum[];
    actionRecovery: ChartDatum[];
    priorityCounts: ChartDatum[];
    expirationBuckets: ChartDatum[];
    topStoreRecovery: ChartDatum[];
    failureReasons: ChartDatum[];
  };
};

export type ChartDatum = {
  label: string;
  value: number;
  secondaryValue?: number;
};

export type WarrantyRoiQueueState = {
  loading: boolean;
  error: string | null;
  data: WarrantyRoiQueueData | null;
};

export function useWarrantyRoiQueueData(): WarrantyRoiQueueState {
  const [state, setState] = useState<WarrantyRoiQueueState>({ loading: true, error: null, data: null });

  useEffect(() => {
    let ignore = false;

    async function loadWarrantyQueue() {
      try {
        const response = await fetch(WARRANTY_QUEUE_URL);
        if (!response.ok) throw new Error(`Unable to load ${WARRANTY_QUEUE_URL} (${response.status}).`);
        const text = await response.text();
        const records = parseWarrantyQueueCsv(text);
        if (!ignore) setState({ loading: false, error: null, data: buildWarrantyRoiData(records) });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load warranty ROI queue data.';
        if (!ignore) setState({ loading: false, error: message, data: null });
      }
    }

    loadWarrantyQueue();

    return () => {
      ignore = true;
    };
  }, []);

  return state;
}

export function buildWarrantyRoiData(records: WarrantyRoiQueueRecord[]): WarrantyRoiQueueData {
  const claimReady = records.filter((record) => record.recommendedAction === 'Submit Warranty Claim');
  const escalations = records.filter((record) => record.recommendedAction === 'Escalate Before Warranty Expires');
  const rmaChecks = records.filter((record) => record.recommendedAction === 'Check RMA Eligibility');
  const replacementPurchased = records.filter((record) => record.replacementPurchased === 'Yes');
  const grossRecoveryOpportunity = sum(records.filter((record) => record.potentialRecoveryValue > 0).map((record) => record.potentialRecoveryValue));
  const netRecoveryOpportunity = sum(records.map((record) => record.potentialRecoveryValue));
  const leakageOrTriageCost = Math.abs(sum(records.filter((record) => record.potentialRecoveryValue < 0).map((record) => record.potentialRecoveryValue)));
  const replacementSpend = sum(records.map((record) => record.replacementCost));
  const claimReadyRecovery = sum(claimReady.map((record) => record.potentialRecoveryValue));

  return {
    records,
    summary: {
      totalTickets: records.length,
      grossRecoveryOpportunity,
      netRecoveryOpportunity,
      claimReadyRecovery,
      leakageOrTriageCost,
      replacementSpend,
      claimReadyTickets: claimReady.length,
      escalationTickets: escalations.length,
      rmaEligibilityTickets: rmaChecks.length,
      purchasedReplacementTickets: replacementPurchased.length,
      roiPercent: replacementSpend > 0 ? (netRecoveryOpportunity / replacementSpend) * 100 : 0,
      averageRecoveryPerTicket: records.length ? netRecoveryOpportunity / records.length : 0,
      averageClaimValue: claimReady.length ? claimReadyRecovery / claimReady.length : 0,
    },
    charts: {
      manufacturerRecovery: aggregateChart(records, (record) => record.manufacturer, (record) => record.potentialRecoveryValue, 6),
      actionRecovery: aggregateChart(records, (record) => record.recommendedAction, (record) => record.potentialRecoveryValue, 6),
      priorityCounts: aggregateChart(records, (record) => record.priority, () => 1, 6, prioritySort),
      expirationBuckets: expirationBucketChart(records),
      topStoreRecovery: aggregateChart(records, (record) => record.siteName || record.storeLocation, (record) => record.potentialRecoveryValue, 8),
      failureReasons: aggregateChart(records, (record) => record.failureReason || 'Unknown', () => 1, 8),
    },
  };
}

function parseWarrantyQueueCsv(text: string): WarrantyRoiQueueRecord[] {
  const rows = parseCsv(text);
  const [headers, ...body] = rows;
  if (!headers?.length) return [];
  return body.filter((row) => row.length > 1).map((row) => {
    const values = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']));
    return {
      ticketId: values.Ticket_ID,
      cameraId: values.Camera_ID,
      storeLocation: values.Store_Location,
      storeCity: values.Store_City,
      storeState: values.Store_State,
      siteName: values.Site_Name,
      zone: values.Zone,
      banner: values.Banner,
      region: values.Region,
      market: values.Market,
      manufacturer: values.Manufacturer,
      model: values.Model,
      serialNumber: values.Serial_Number,
      failureReason: values.Failure_Reason,
      ticketCreatedDate: values.Ticket_Created_Date,
      priority: values.Priority,
      resolutionDate: values.Resolution_Date,
      replacementPurchased: values.Replacement_Purchased,
      replacementCost: toNumber(values.Replacement_Cost),
      warrantyStatusAtFailure: values.Warranty_Status_At_Failure,
      daysUntilWarrantyExpiration: toNumber(values.Days_Until_Warranty_Expiration),
      recommendedAction: values.Recommended_Action,
      potentialRecoveryValue: toNumber(values.Potential_Recovery_Value),
    };
  });
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(current);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      current = '';
    } else {
      current += char;
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}

function aggregateChart(records: WarrantyRoiQueueRecord[], labelForRecord: (record: WarrantyRoiQueueRecord) => string, valueForRecord: (record: WarrantyRoiQueueRecord) => number, limit: number, sorter?: (a: ChartDatum, b: ChartDatum) => number): ChartDatum[] {
  const map = new Map<string, ChartDatum>();
  records.forEach((record) => {
    const label = labelForRecord(record) || 'Unknown';
    const value = valueForRecord(record);
    const existing = map.get(label) ?? { label, value: 0, secondaryValue: 0 };
    existing.value += value;
    existing.secondaryValue = (existing.secondaryValue ?? 0) + 1;
    map.set(label, existing);
  });
  return Array.from(map.values()).sort(sorter ?? ((a, b) => Math.abs(b.value) - Math.abs(a.value))).slice(0, limit);
}

function expirationBucketChart(records: WarrantyRoiQueueRecord[]): ChartDatum[] {
  const buckets = [
    { label: 'Expired / past due', min: -Infinity, max: -1 },
    { label: '0-90 days', min: 0, max: 90 },
    { label: '91-180 days', min: 91, max: 180 },
    { label: '181-365 days', min: 181, max: 365 },
    { label: '1+ years', min: 366, max: Infinity },
  ];
  return buckets.map((bucket) => ({
    label: bucket.label,
    value: records.filter((record) => record.daysUntilWarrantyExpiration >= bucket.min && record.daysUntilWarrantyExpiration <= bucket.max).length,
  }));
}

function prioritySort(a: ChartDatum, b: ChartDatum): number {
  const order = ['Critical', 'High', 'Medium', 'Low'];
  return order.indexOf(a.label) - order.indexOf(b.label);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
