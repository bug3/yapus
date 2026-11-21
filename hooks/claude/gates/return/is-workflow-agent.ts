import { readFileSync } from 'node:fs';
import { join, parse } from 'node:path';
import { isRecord } from '../../../shared/is-record.ts';

const META_SUFFIX = '.meta.json';

// Whether the meta file beside the transcript at path, `<name>.meta.json` for
// `<name>.jsonl`, says the subagent ran in a workflow. A meta file that is
// missing, cannot be read or lacks the field is that of no workflow agent.
export function isWorkflowAgent(transcriptPath: string): boolean {
  const { dir, name } = parse(transcriptPath);
  let meta: unknown;

  try {
    meta = JSON.parse(readFileSync(join(dir, `${ name }${ META_SUFFIX }`), 'utf8'));
  } catch {
    return false;
  }

  return isRecord(meta) && meta.inWorkflowRun === true;
}
