export type AviationPilotFeedback = {
  feedback_id: string;
  timestamp: string;
  actor_role: string;
  trip_id?: string | null;
  category: 'usability' | 'data_accuracy' | 'risk_scoring' | 'brief_quality' | 'workflow' | 'authorization' | 'integration' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  details: string;
  suggested_change?: string;
  status: 'new' | 'reviewed' | 'accepted' | 'rejected' | 'implemented';
};

const STORAGE_KEY = 'fpi_aviation_pilot_feedback';
function read(): AviationPilotFeedback[] { if (typeof window === 'undefined') return []; try { const raw = window.localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) as AviationPilotFeedback[] : []; } catch { return []; } }
function write(items: AviationPilotFeedback[]) { if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
export function saveAviationFeedback(feedback: Omit<AviationPilotFeedback, 'feedback_id' | 'timestamp'>): AviationPilotFeedback { const saved = { ...feedback, feedback_id: `FB-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, timestamp: new Date().toISOString() }; write([saved, ...read()]); return saved; }
export function getAviationFeedback(): AviationPilotFeedback[] { return read().sort((a, b) => b.timestamp.localeCompare(a.timestamp)); }
export function getAviationFeedbackForTrip(tripId: string): AviationPilotFeedback[] { return getAviationFeedback().filter((item) => item.trip_id === tripId); }
export function updateAviationFeedbackStatus(feedbackId: string, status: AviationPilotFeedback['status']): AviationPilotFeedback | null { let updated: AviationPilotFeedback | null = null; write(read().map((item) => { if (item.feedback_id !== feedbackId) return item; updated = { ...item, status }; return updated; })); return updated; }
