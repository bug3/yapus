import { getGolangciLintVersion } from '../files/go/get-golangci-lint-version.ts';
import type { Language } from '../language/languages.ts';
import type { PackageMerge } from '../package/merge-package.ts';
import type { ProjectPlan } from '../plan/get-project-plan.ts';

const NEXT_STEPS: Readonly<Record<Language, () => readonly string[]>> = {
  typescript: () => ['npm install', 'npm test', 'commit the changes'],
  go: () => [
    `curl -sSfL https://golangci-lint.run/install.sh | sh -s -- -b "$(go env GOPATH)/bin" ${ getGolangciLintVersion() }`,
    'golangci-lint run ./...',
    'go test ./...',
    'commit the changes',
  ],
};

// What the report needs besides the plan and the written paths: the language
// and the package.json merge, which only a TypeScript run computes.
export interface ReportInput {
  readonly language: Language;
  readonly merge: PackageMerge | undefined;
}

// The approved stdout lines: written paths, removed paths, the package.json
// keys, the next steps and the undo steps. The undo steps name only what the
// run wrote or removed: a planned path left untouched has nothing to undo.
export function formatReport(
  plan: ProjectPlan,
  written: readonly string[],
  { language, merge }: ReportInput,
): string[] {
  const isDone = (path: string): boolean => written.includes(path) || plan.removals.includes(path);
  const changed = plan.changed.filter(isDone);
  const created = plan.created.filter((path) => written.includes(path));

  return [
    `yapus landmark project ${ plan.mode }: wrote`,
    ...indent(written),
    ...plan.removals.length > 0 ? ['removed', ...indent(plan.removals)] : [],
    ...merge === undefined ? [] : getKeysLine(merge),
    'Next:',
    ...indent(NEXT_STEPS[language]()),
    'To undo:',
    ...changed.length > 0 ? [`  git restore --staged --worktree -- ${ changed.join(' ') }`] : [],
    ...created.length > 0 ? [`  remove ${ created.join(' ') }`] : [],
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
