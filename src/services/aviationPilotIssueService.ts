import { tryAviationApiRequest } from './aviationApiClient';
import { isAviationApiPersistenceEnabled } from './aviationRuntimeConfig';

export type AviationPilotIssue = {
  issue_id: string;
  created_at: string;
  updated_at: string;
  source_feedback_id?: string | null;
  title: string;
  description: string;
  category: 'bug' | 'data_gap' | 'integration_request' | 'ux_improvement' | 'governance' | 'authorization' | 'risk_model' | 'briefing' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
  owner_role: string;
  status: 'open' | 'in_progress' | 'blocked' | 'resolved' | 'deferred';
  resolution_notes?: string;
};

const STORAGE_KEY = 'fpi_aviation_pilot_issues';
function read(): AviationPilotIssue[] { if (typeof window === 'undefined') return []; try { const raw = window.localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) as AviationPilotIssue[] : []; } catch { return []; } }
function write(items: AviationPilotIssue[]) { if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
export function createAviationPilotIssue(issue: Omit<AviationPilotIssue, 'issue_id' | 'created_at' | 'updated_at'>): AviationPilotIssue { const now = new Date().toISOString(); const saved = { ...issue, issue_id: `ISS-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, created_at: now, updated_at: now }; write([saved, ...read()]); if (isAviationApiPersistenceEnabled()) void tryAviationApiRequest<AviationPilotIssue>('/aviation/issues', { method: 'POST', body: saved }); return saved; }
export function getAviationPilotIssues(): AviationPilotIssue[] { return read().sort((a, b) => b.updated_at.localeCompare(a.updated_at)); }
export function updateAviationPilotIssue(issueId: string, updates: Partial<AviationPilotIssue>): AviationPilotIssue | null { let updated: AviationPilotIssue | null = null; write(read().map((issue) => { if (issue.issue_id !== issueId) return issue; updated = { ...issue, ...updates, issue_id: issueId, updated_at: new Date().toISOString() }; return updated; })); if (updated && isAviationApiPersistenceEnabled()) void tryAviationApiRequest<AviationPilotIssue>(`/aviation/issues/${encodeURIComponent(issueId)}`, { method: 'PATCH', body: updates }); return updated; }
export function deleteAviationPilotIssue(issueId: string): void { write(read().filter((issue) => issue.issue_id !== issueId)); if (isAviationApiPersistenceEnabled()) void tryAviationApiRequest<void>(`/aviation/issues/${encodeURIComponent(issueId)}`, { method: 'DELETE' }); }
