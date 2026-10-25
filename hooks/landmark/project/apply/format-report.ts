import type { PackageMerge } from '../package/merge-package.ts';
import type { ProjectPlan } from '../plan/get-project-plan.ts';

// The approved stdout lines: written paths, removed paths, the package.json
// keys, the next steps and the undo steps.
export function formatReport(
  plan: ProjectPlan,
  merge: PackageMerge,
  written: readonly string[],
): string[] {
  return [
    `yapus landmark project ${ plan.mode }: wrote`,
    ...indent(written),
    ...plan.removals.length > 0 ? ['removed', ...indent(plan.removals)] : [],
    ...getKeysLine(merge),
    'Next:',
    ...indent(['npm install', 'npm test', 'commit the changes']),
    'To undo:',
    ...plan.changed.length > 0
      ? [`  git restore --staged --worktree -- ${ plan.changed.join(' ') }`]
      : [],
    ...plan.created.length > 0 ? [`  remove ${ plan.created.join(' ') }`] : [],
  ];
}

function getKeysLine({ set, removed }: PackageMerge): string[] {
  const parts = [
    ...set.length > 0 ? [`set ${ set.join(', ') }`] : [],
    ...removed.length > 0 ? [`removed ${ removed.join(', ') }`] : [],
  ];

  return parts.length > 0 ? [`package.json: ${ parts.join('; ') }`] : [];
}

function indent(paths: readonly string[]): string[] {
  return paths.map((path) => `  ${ path }`);
}
