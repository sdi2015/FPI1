import { novaApprovalKeywords } from './novaAgentPrompts';
import { runCodePuppyTask } from './codePuppyTaskRunner';
import type { NovaAgentRequest, NovaAgentResponse, NovaMessage, NovaResponseSection, NovaTaskPlan } from './novaAgentTypes';

export async function sendNovaMessage(request: NovaAgentRequest): Promise<NovaAgentResponse> {
  await delay(450);
  const requiresApproval = shouldRequireApproval(request.message);
  const taskPlan = requiresApproval ? generateNovaPlan(request.message) : undefined;
  const sections = buildResponseSections(request.message, request.context, taskPlan);
  const message: NovaMessage = {
    id: createId('nova'),
    role: 'nova',
    timestamp: new Date().toISOString(),
    content: requiresApproval
      ? 'I prepared a controlled task plan. I will not execute anything until you approve it.'
      : 'I reviewed the active FPI context and prepared an operational summary.',
    sections,
    taskPlan,
  };

  return { message, taskPlan };
}

export function generateNovaPlan(requestedAction: string): NovaTaskPlan {
  return {
    id: createId('task'),
    title: inferTaskTitle(requestedAction),
    intent: requestedAction.toLowerCase().includes('code puppy') || requestedAction.toLowerCase().includes('cli') ? 'code-puppy-task' : 'task-plan',
    requiresApproval: true,
    status: 'awaiting-approval',
    requestedAction,
    approvalReason: 'This request may create artifacts, run automation, export data, assign work, or eventually route work to Code Puppy CLI. Explicit approval is required.',
    steps: [
      'Confirm scope, stores, and active dashboard module.',
      'Build a non-destructive execution plan with owners, evidence, and success criteria.',
      'Request explicit user approval before running any automation.',
      'Route the approved task to the Code Puppy task runner adapter when the backend is available.',
      'Return status, results, exceptions, and follow-up recommendations.',
    ],
  };
}

export async function approveNovaTask(plan: NovaTaskPlan): Promise<NovaTaskPlan> {
  const runningPlan: NovaTaskPlan = { ...plan, status: 'running' };
  try {
    return await runCodePuppyTask(runningPlan);
  } catch (error) {
    return {
      ...runningPlan,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown Code Puppy task runner error.',
    };
  }
}

export function createNovaMessage(role: NovaMessage['role'], content: string): NovaMessage {
  return {
    id: createId(role),
    role,
    content,
    timestamp: new Date().toISOString(),
  };
}

function buildResponseSections(message: string, context: NovaAgentRequest['context'], taskPlan?: NovaTaskPlan): NovaResponseSection[] {
  const topStores = context.topStores.slice(0, 4);
  const fire = context.fireLifeSafety;
  const summary = [
    `Active module: ${context.activeModule}.`,
    `Current scope: ${context.selectedScope}.`,
    `Portfolio posture is ${context.portfolioPosture}.`,
    context.syntheticDataMode ? 'NOVA is using synthetic/demo dashboard context.' : 'NOVA is using live connected dashboard context.',
  ];

  const keyFindings = [
    ...context.riskSignals.map((signal) => `${signal.label}: ${signal.value}${signal.detail ? ` — ${signal.detail}` : ''}`),
    ...(fire ? [`Fire/Life Safety: ${fire.activeTroubles} active troubles, ${fire.openDeficiencies} open deficiencies, ${fire.overdueInspections} overdue inspections, ${fire.falseAlarms90Days} false/nuisance alarms in 90 days.`] : []),
    ...(topStores.length > 0 ? [`Leadership review candidates: ${topStores.map((store) => `${store.id} (${store.riskLevel ?? 'Unrated'} ${store.riskScore ?? 'N/A'})`).join(', ')}.`] : ['No ranked store context is available for the current scope.']),
  ];

  const lower = message.toLowerCase();
  const actions = lower.includes('vendor')
    ? ['Use Vendor Intelligence to compare providers against the issue category, region, response history, and evidence quality.', 'Prioritize vendors with documented resolution history for the selected store issue type.']
    : lower.includes('fire') || lower.includes('alarm') || lower.includes('inspection')
      ? ['Review active panel/device trouble conditions first.', 'Schedule overdue inspections and collect inspection reports as evidence.', 'Review top nuisance alarm stores for repeat device or environmental root causes.']
      : ['Review high/critical stores with unresolved exceptions.', 'Assign owners to remediation items with evidence requirements and due dates.', 'Use NOVA task planning before exporting reports or triggering automation.'];

  return [
    { title: 'Summary', items: summary },
    { title: 'Key Findings', items: keyFindings },
    { title: 'Why It Matters', items: ['Leadership needs a concise view of safety posture, unresolved exposure, owner accountability, and what is blocked or worsening.', 'Risk should not be communicated only by color; NOVA includes counts, causes, owners, and next steps.'] },
    { title: 'Recommended Actions', items: actions },
    { title: 'Suggested Owner', items: ['Security Operations for critical exceptions.', 'Safety Operations for fire/life-safety troubles and inspections.', 'Program Owner for remediation backlog and governance cadence.', 'Vendor Management for provider score or dispatch decisions.'] },
    { title: 'Evidence Needed', items: ['Store ID, risk tier, current scope, inspection reports, service tickets, device/panel health records, vendor notes, photos, and remediation proof.'] },
    { title: 'Next Steps', items: taskPlan ? ['Review the plan in the task execution panel.', 'Approve only if you want NOVA to route the task to the task runner adapter.', 'No Code Puppy CLI task will run without approval.'] : ['Use a suggested prompt for a deeper drilldown.', 'Ask NOVA to draft a brief or remediation plan if you need an artifact.', 'Use the module filters to narrow stores before requesting store-specific analysis.'] },
  ];
}

function shouldRequireApproval(message: string): boolean {
  const normalized = message.toLowerCase();
  return novaApprovalKeywords.some((keyword) => normalized.includes(keyword));
}

function inferTaskTitle(message: string): string {
  if (message.toLowerCase().includes('executive')) return 'Draft executive FPI brief';
  if (message.toLowerCase().includes('remediation')) return 'Prepare remediation action plan';
  if (message.toLowerCase().includes('code puppy') || message.toLowerCase().includes('cli')) return 'Approved Code Puppy CLI task';
  if (message.toLowerCase().includes('export')) return 'Prepare controlled export task';
  return 'NOVA controlled task plan';
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
