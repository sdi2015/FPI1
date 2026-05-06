import type { NovaTaskPlan } from './novaAgentTypes';

export async function runCodePuppyTask(plan: NovaTaskPlan): Promise<NovaTaskPlan> {
  // TODO: Wire this adapter to the approved backend/Code Puppy CLI task runner.
  // Guardrail: this function should only be called after explicit user approval.
  await delay(900);

  return {
    ...plan,
    status: 'completed',
    resultSummary:
      'Demo task runner completed a simulated execution. No files, data, assignments, reports, exports, or external systems were changed.',
  };
}

export async function getNovaTaskStatus(plan: NovaTaskPlan): Promise<NovaTaskPlan> {
  await delay(150);
  return plan;
}

export function summarizeNovaTaskResults(plan: NovaTaskPlan): string {
  if (plan.status === 'failed') return plan.error ?? 'The task failed before completion.';
  if (plan.status === 'completed') return plan.resultSummary ?? 'The approved task completed successfully.';
  return 'The task is still pending approval or execution.';
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
