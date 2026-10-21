import type { Call } from '../../../calls/get-calls.ts';
import type { Context } from '../../../context/make-context.ts';
import type { CheckResult } from '../../../get-verdict.ts';
import { getGhAction } from '../get-gh-action.ts';
import { ghCommands } from '../gh-commands.ts';
import { findMovingOption } from '../options/find-moving-option.ts';
import { readGhArguments } from '../read-gh-arguments.ts';
import { getFailureDetail } from './get-failure-detail.ts';

const { merge, reasons } = ghCommands;

// A refusal when a `gh pr merge` names another repository, or squashes while the
// repository setting does not allow it, else undefined. The setting is read from the
// git config of the directory of the tool call; a person sets it.
export function getSquashCheck(call: Call, context: Context): CheckResult {
  const spec = ghCommands.actions.get('pr merge');

  if (call.tool !== 'gh' || getGhAction(call.words) !== 'pr merge' || spec === undefined) {
    return undefined;
  }

  const args = readGhArguments(call.words.slice(2), spec);

  if ('refusal' in args) {
    return args;
  }

  const moving = findMovingOption(call, args, ['repo']);

  if (moving !== undefined) {
    return { refusal: reasons.mergeMoving(spec.command, moving) };
  }

  return args.flags.get('squash') === true ? readSetting(context) : undefined;
}

// Git exits 1 for a key that is not set, which is the same as off.
function readSetting(context: Context): CheckResult {
  const result = context.run('git', ['config', '--type=bool', '--get', merge.squashSetting]);

  if ('failure' in result || result.status > 1) {
    return { refusal: reasons.squashSettingUnreadable(getFailureDetail(result)) };
  }

  return result.status === 0 && result.stdout.trim() === 'true'
    ? undefined
    : { refusal: reasons.squashOff };
}
