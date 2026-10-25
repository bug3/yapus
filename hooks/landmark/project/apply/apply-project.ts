import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPluginVersion } from '../../../shared/read-plugin-version.ts';
import { readTemplates } from '../files/read-templates.ts';
import { getLanguage } from '../language/get-language.ts';
import type { Language } from '../language/languages.ts';
import { mergePackage, type PackageMerge } from '../package/merge-package.ts';
import {
  getGoProjectPlan,
  getProjectPlan,
  PACKAGE,
  type PlanResult,
  type ProjectPlan,
} from '../plan/get-project-plan.ts';
import type { Template } from '../files/read-templates.ts';
import { formatReport } from './format-report.ts';
import { writeProject } from './write-project.ts';

// What the program ends with: the exit status and the lines for the stream
// that status names (stdout for 0, stderr for 2).
export interface Outcome {
  readonly status: 0 | 2;
  readonly lines: readonly string[];
}

// One planner per language; the Record type makes a missing language a
// compile error.
const PLANNERS: Readonly<Record<
  Language,
  (root: string, templates: readonly Template[], env: NodeJS.ProcessEnv) => PlanResult
>> = {
  typescript: getProjectPlan,
  go: getGoProjectPlan,
};

// What the person asked for: the environment and the language, which is
// undefined when none was named.
export interface Request {
  readonly env: NodeJS.ProcessEnv;
  readonly requested: Language | undefined;
}

// Reads the plugin, the templates and the plan, then writes the plan into
// projectDir.
// For TypeScript the package.json merge is computed before the first write, so
// a package.json that cannot be merged throws with nothing written.
export function applyProject(
  pluginRoot: string,
  projectDir: string,
  { env, requested }: Request,
): Outcome {
  const version = readPluginVersion(pluginRoot);
  const resolved = getLanguage(projectDir, requested);

  if ('refusal' in resolved) {
    return {
      status: 2,
      lines: ['yapus landmark project: refused, nothing written', resolved.refusal],
    };
  }

  const { language } = resolved;
  const planned = PLANNERS[language](projectDir, readTemplates(language), env);

  if ('refusals' in planned) {
    return {
      status: 2,
      lines: ['yapus landmark project: refused, nothing written', ...planned.refusals],
    };
  }

  const { plan } = planned;
  const merged = language === 'typescript'
    ? mergeProjectPackage(projectDir, plan.mode)
    : undefined;
  const merge = merged?.merge;
  const packageText = merged?.packageText;
  const written = writeProject(projectDir, { plan, packageText, version });

  return { status: 0, lines: formatReport(plan, written, { language, merge }) };
}

function mergeProjectPackage(
  projectDir: string,
  mode: ProjectPlan['mode'],
): { merge: PackageMerge; packageText: string | undefined } {
  const packagePath = join(projectDir, PACKAGE);
  const existing = existsSync(packagePath) ? readFileSync(packagePath, 'utf8') : undefined;
  const merge = mergePackage(existing, mode);

  return { merge, packageText: merge.text === existing ? undefined : merge.text };
}
