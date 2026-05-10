import { tryAviationApiRequest } from './aviationApiClient';
import { isAviationApiPersistenceEnabled } from './aviationRuntimeConfig';

export type AviationUatResult = 'pass' | 'fail' | 'partial' | 'blocked';

export type AviationPilotUatRun = {
  uat_id: string;
  created_at: string;
  session_date: string;
  stakeholder_role: string;
  test_scenario: string;
  result: AviationUatResult;
  issues_found: string;
  notes: string;
};

export type AviationStakeholderDecisionType =
  | 'approved_data_source'
  | 'rejected_data_source'
  | 'role_access_decision'
  | 'governance_decision'
  | 'production_blocker'
  | 'integration_priority_change';

export type AviationStakeholderDecision = {
  decision_id: string;
  created_at: string;
  decision_date: string;
  decision_type: AviationStakeholderDecisionType;
  stakeholder_role: string;
  title: string;
  decision_summary: string;
  affected_area: string;
  follow_up_owner: string;
  due_date?: string | null;
  status: 'open' | 'accepted' | 'superseded' | 'closed';
};

const UAT_KEY = 'fpi_aviation_pilot_uat_runs';
const DECISION_KEY = 'fpi_aviation_stakeholder_decisions';

function readLocal<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T[] : [];
  } catch {
    return [];
  }
}

function writeLocal<T>(key: string, items: T[]) {
  if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(items));
}

export function saveAviationPilotUatRun(run: Omit<AviationPilotUatRun, 'uat_id' | 'created_at'>): AviationPilotUatRun {
  const saved: AviationPilotUatRun = { ...run, uat_id: `UAT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, created_at: new Date().toISOString() };
  writeLocal(UAT_KEY, [saved, ...getAviationPilotUatRuns()]);
  if (isAviationApiPersistenceEnabled()) void tryAviationApiRequest<AviationPilotUatRun>('/aviation/uat-runs', { method: 'POST', body: saved });
  return saved;
}

export function getAviationPilotUatRuns(): AviationPilotUatRun[] {
  return readLocal<AviationPilotUatRun>(UAT_KEY).sort((a, b) => b.session_date.localeCompare(a.session_date));
}

export function updateAviationPilotUatRun(uatId: string, updates: Partial<AviationPilotUatRun>): AviationPilotUatRun | null {
  let updated: AviationPilotUatRun | null = null;
  writeLocal(UAT_KEY, getAviationPilotUatRuns().map((run) => {
    if (run.uat_id !== uatId) return run;
    updated = { ...run, ...updates, uat_id: uatId };
    return updated;
  }));
  if (updated && isAviationApiPersistenceEnabled()) void tryAviationApiRequest<AviationPilotUatRun>(`/aviation/uat-runs/${encodeURIComponent(uatId)}`, { method: 'PATCH', body: updates });
  return updated;
}

export function saveAviationStakeholderDecision(decision: Omit<AviationStakeholderDecision, 'decision_id' | 'created_at'>): AviationStakeholderDecision {
  const saved: AviationStakeholderDecision = { ...decision, decision_id: `DEC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, created_at: new Date().toISOString() };
  writeLocal(DECISION_KEY, [saved, ...getAviationStakeholderDecisions()]);
  if (isAviationApiPersistenceEnabled()) void tryAviationApiRequest<AviationStakeholderDecision>('/aviation/decisions', { method: 'POST', body: saved });
  return saved;
}

export function getAviationStakeholderDecisions(): AviationStakeholderDecision[] {
  return readLocal<AviationStakeholderDecision>(DECISION_KEY).sort((a, b) => b.decision_date.localeCompare(a.decision_date));
}

export function updateAviationStakeholderDecision(decisionId: string, updates: Partial<AviationStakeholderDecision>): AviationStakeholderDecision | null {
  let updated: AviationStakeholderDecision | null = null;
  writeLocal(DECISION_KEY, getAviationStakeholderDecisions().map((decision) => {
    if (decision.decision_id !== decisionId) return decision;
    updated = { ...decision, ...updates, decision_id: decisionId };
    return updated;
  }));
  if (updated && isAviationApiPersistenceEnabled()) void tryAviationApiRequest<AviationStakeholderDecision>(`/aviation/decisions/${encodeURIComponent(decisionId)}`, { method: 'PATCH', body: updates });
  return updated;
}
