import type { AgentCall, WorkflowRun } from './run-workflow.ts';

// The call of a run that carries `label`.
export function findCall(run: WorkflowRun, label: string): AgentCall | undefined {
  return run.calls.find((call) => call.options.label === label);
}

// The labels of the calls of the stages whose id starts with `stagePrefix`,
// sorted, since the order of the calls of one barrier is no promise.
export function listLabels(run: WorkflowRun, stagePrefix: string): string[] {
  return run.calls
    .map((call) => String(call.options.label))
    .filter((label) => label.startsWith(stagePrefix))
    .toSorted();
}
