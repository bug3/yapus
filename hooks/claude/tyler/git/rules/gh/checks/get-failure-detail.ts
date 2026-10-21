import { getFirstLine } from '../../../../../../shared/get-first-line.ts';
import type { RunResult } from '../../../context/run.ts';

// What went wrong with a run for a refusal to quote: the failure, or the exit code
// with the first line git or gh said.
export function getFailureDetail(result: RunResult): string {
  return 'failure' in result
    ? result.failure
    : `exit ${ String(result.status) }: ${ getFirstLine(result.stderr.trim()) }`;
}
