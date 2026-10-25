import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPluginVersion } from '../../../shared/read-plugin-version.ts';
import { readTemplates } from '../files/read-templates.ts';
import { mergePackage } from '../package/merge-package.ts';
import { getProjectPlan } from '../plan/get-project-plan.ts';
import { formatReport } from './format-report.ts';
import { writeProject } from './write-project.ts';

const PACKAGE = 'package.json';

// What the program ends with: the exit status and the lines for the stream
// that status names (stdout for 0, stderr for 2).
export interface Outcome {
  readonly status: 0 | 2;
  readonly lines: readonly string[];
}

// Reads the plugin, the templates and the plan, then writes the plan into
// projectDir. The package.json merge is computed before the first write, so
// a package.json that cannot be merged throws with nothing written.
export function applyProject(
  pluginRoot: string,
  projectDir: string,
  env: NodeJS.ProcessEnv,
): Outcome {
  const version = readPluginVersion(pluginRoot);
  const result = getProjectPlan(projectDir, readTemplates(), env);

  if ('refusals' in result) {
    return {
      status: 2,
      lines: ['yapus landmark project: refused, nothing written', ...result.refusals],
    };
  }

  const { plan } = result;
  const packagePath = join(projectDir, PACKAGE);
  const existing = existsSync(packagePath) ? readFileSync(packagePath, 'utf8') : undefined;
  const merge = mergePackage(existing, plan.mode);
  const packageText = merge.text === existing ? undefined : merge.text;
  const written = writeProject(projectDir, { plan, packageText, version });

  return { status: 0, lines: formatReport(plan, merge, written) };
}
