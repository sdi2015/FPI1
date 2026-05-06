import type { NovaTaskPlan } from './novaAgentTypes';

const NOVA_TASK_APPROVAL_ENDPOINT = 'http://localhost:8787/api/nova/task/approve';

export async function runCodePuppyTask(plan: NovaTaskPlan): Promise<NovaTaskPlan> {
  // Guardrail: this function should only be called after explicit user approval.
  // It posts the approved plan to the trusted local NOVA bridge. The browser never
  // receives or executes arbitrary shell commands.
  try {
    const response = await fetch(NOVA_TASK_APPROVAL_ENDPOINT, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });

    if (!response.ok) throw new Error(`NOVA bridge returned ${response.status}`);
    return (await response.json()) as NovaTaskPlan;
  } catch (error) {
    await delay(300);
    return {
      ...plan,
      status: 'failed',
      error: error instanceof Error ? `Unable to reach local NOVA bridge: ${error.message}` : 'Unable to reach local NOVA bridge.',
    };
  }
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
