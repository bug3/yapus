import { isRecord } from '../../../../../../shared/is-record.ts';
import type { Call } from '../../../calls/get-calls.ts';
import type { Context } from '../../../context/make-context.ts';
import type { CheckResult } from '../../../get-verdict.ts';
import { getGhAction } from '../get-gh-action.ts';
import { ghCommands } from '../gh-commands.ts';
import { findMovingOption } from '../options/find-moving-option.ts';
import { readGhArguments } from '../read-gh-arguments.ts';
import { getFailureDetail } from './get-failure-detail.ts';
import { readyCatalog } from './ready-catalog.ts';

interface Check {
  readonly name: string;
  readonly bucket: string;
}

const { reasons } = readyCatalog;

// A refusal when a `gh pr ready` would mark a pull request ready while one of its
// checks has not passed or the checks cannot be read, else undefined. `--undo`
// passes; a pull request with no checks at all passes.
export function getReadyCheck(call: Call, context: Context): CheckResult {
  const spec = ghCommands.actions.get('pr ready');

  if (call.tool !== 'gh' || getGhAction(call.words) !== 'pr ready' || spec === undefined) {
    return undefined;
  }

  const args = readGhArguments(call.words.slice(2), spec);

  if ('refusal' in args) {
    return args;
  }

  if (args.flags.get('undo') === true) {
    return undefined;
  }

  const moving = findMovingOption(call, args, ['repo']);

  if (moving !== undefined) {
    return { refusal: reasons.moving(spec.command, moving) };
  }

  const operands = args.operands.map(({ text }) => text);
  const refusal = judgeChecks(context, spec.command, operands);

  return refusal === undefined ? undefined : { refusal };
}

// The operands go after `--`, so that none is read as an option of `gh pr checks`.
function judgeChecks(
  context: Context,
  command: string,
  operands: readonly string[],
): string | undefined {
  const result = context.run('gh', [
    ...readyCatalog.checksArguments,
    ...operands.length === 0 ? [] : ['--', ...operands],
  ]);

  if ('failure' in result) {
    return reasons.cannotRead(result.failure);
  }

  if (result.stdout.trim() === '') {
    return result.status !== 0 && readyCatalog.noChecksPattern.test(result.stderr.trim())
      ? undefined
      : reasons.cannotRead(getFailureDetail(result));
  }

  const checks = readChecks(result.stdout);

  if (checks === undefined) {
    return reasons.cannotRead('gh printed checks the gate cannot read');
  }

  const notPassed = checks
    .filter(({ bucket }) => !readyCatalog.passingBuckets.some((passing) => passing === bucket))
    .map(({ name, bucket }) => `${ name } (${ bucket })`);

  return notPassed.length === 0 ? undefined : reasons.notPassed(command, notPassed);
}

// The checks in a JSON list of objects with a text name and bucket, else undefined.
function readChecks(stdout: string): Check[] | undefined {
  let parsed: unknown;

  try {
    parsed = JSON.parse(stdout);
  } catch {
    return undefined;
  }

  if (!Array.isArray(parsed)) {
    return undefined;
  }

  const items: unknown[] = parsed;
  const checks: Check[] = [];

  for (const item of items) {
    if (!isRecord(item) || typeof item.name !== 'string' || typeof item.bucket !== 'string') {
      return undefined;
    }

    checks.push({ name: item.name, bucket: item.bucket });
  }

  return checks;
}
