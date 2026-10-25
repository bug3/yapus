import { getFirstLine } from '../../../shared/get-first-line.ts';
import { applyProject, type Outcome, type Request } from './apply-project.ts';

// Applies the project install of the plugin at pluginRoot to projectDir. An
// unexpected throw becomes a crash outcome; nothing is written by a throw
// before the writes begin.
export function runProject(
  pluginRoot: string,
  projectDir: string,
  request: Request,
): Outcome {
  try {
    return applyProject(pluginRoot, projectDir, request);
  } catch (error) {
    return { status: 2, lines: [`yapus landmark project: crashed: ${ getFirstLine(error) }`] };
  }
}
