import { getFirstLine } from '../../../shared/get-first-line.ts';
import { applyProject, type Outcome } from './apply-project.ts';

// Applies the project install of the plugin at pluginRoot to projectDir. An
// unexpected throw becomes a crash outcome; nothing is written by a throw
// before the writes begin.
export function runProject(pluginRoot: string, projectDir: string): Outcome {
  try {
    return applyProject(pluginRoot, projectDir);
  } catch (error) {
    return { status: 2, lines: [`yapus landmark project: crashed: ${ getFirstLine(error) }`] };
  }
}
