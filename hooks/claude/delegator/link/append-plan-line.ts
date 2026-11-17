import { closeSync, constants, openSync, readFileSync, writeSync } from 'node:fs';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { isRecord } from '../../../shared/is-record.ts';
import type { PlanFile } from './get-plan-file.ts';

// 'same' is a write of the plan and file the last plan line already names.
export type Appended =
  | { readonly kind: 'written' }
  | { readonly kind: 'same' }
  | { readonly kind: 'failure'; readonly detail: string };

// Read and append, never create: the session's first logged prompt creates
// the file, private, and a file created here would take the default mode.
const READ_AND_APPEND = constants.O_RDWR | constants.O_APPEND;

// Appends {time, plan, file} as one JSON line to the session's file at path,
// unless the last plan line there names the same plan and file; a prompt
// line after that plan line changes nothing. A file that is missing or cannot
// be read or written is a failure with the path.
export function appendPlanLine(path: string, time: string, planFile: PlanFile): Appended {
  try {
    return { kind: isAppended(path, time, planFile) ? 'written' : 'same' };
  } catch (error) {
    return { kind: 'failure', detail: `cannot write ${ path }: ${ getFirstLine(error) }` };
  }
}

function isAppended(path: string, time: string, planFile: PlanFile): boolean {
  const { plan, file } = planFile;
  const descriptor = openSync(path, READ_AND_APPEND);

  try {
    const last = readFileSync(descriptor, 'utf8').split('\n').flatMap(readPlanFile).at(-1);

    if (last?.plan === plan && last.file === file) {
      return false;
    }

    writeSync(descriptor, `${ JSON.stringify({ time, plan, file }) }\n`);

    return true;
  } finally {
    closeSync(descriptor);
  }
}

// The plan and the file of a plan line; a prompt line or a damaged line is
// none.
function readPlanFile(line: string): PlanFile[] {
  let fields: unknown;

  try {
    fields = JSON.parse(line);
  } catch {
    return [];
  }

  if (!isRecord(fields) || typeof fields.plan !== 'string' || typeof fields.file !== 'string') {
    return [];
  }

  return [{ plan: fields.plan, file: fields.file }];
}
