import { basename } from 'node:path';
import type { Call } from '../../../calls/get-calls.ts';
import type { Context } from '../../../context/make-context.ts';
import type { CheckResult } from '../../../get-verdict.ts';
import { getGhAction } from '../get-gh-action.ts';
import { ghCommands } from '../gh-commands.ts';
import { findMovingOption } from '../options/find-moving-option.ts';
import { readLiteralValues } from '../options/read-literal-values.ts';
import { readGhArguments, type GhArguments } from '../read-gh-arguments.ts';
import { findBase } from './find-base.ts';
import { findGenerated, getMeasureRefusal } from './find-generated.ts';
import { readCommit } from './read-commit.ts';
import { readNumstat } from './read-numstat.ts';
import { sizeCatalog } from './size-catalog.ts';

const { reasons } = sizeCatalog;

// A refusal when the pull request a `gh pr create` opens changes more than the
// refusal limit, a note above the note limit, else undefined. The size is that of
// HEAD against the base branch on origin, in the directory of the tool call.
export function getSizeCheck(call: Call, context: Context): CheckResult {
  const spec = ghCommands.actions.get('pr create');

  if (call.tool !== 'gh' || getGhAction(call.words) !== 'pr create' || spec === undefined) {
    return undefined;
  }

  const args = readGhArguments(call.words.slice(2), spec);

  if ('refusal' in args) {
    return args;
  }

  const moving = findMovingOption(call, args, sizeCatalog.movingOptions);

  if (moving !== undefined) {
    return { refusal: reasons.moving(spec.command, moving) };
  }

  const lines = countLines(args, spec.command, context);

  if ('refusal' in lines) {
    return lines;
  }

  if (lines.count > sizeCatalog.refuseAbove) {
    return { refusal: reasons.tooBig(spec.command, lines.count, sizeCatalog.refuseAbove) };
  }

  return lines.count > sizeCatalog.noteAbove
    ? { note: reasons.big(lines.count, sizeCatalog.noteAbove) }
    : undefined;
}

interface Counted {
  readonly count: number;
}

interface Refused {
  readonly refusal: string;
}

function countLines(args: GhArguments, command: string, context: Context): Counted | Refused {
  const bases = readLiteralValues(args, command, 'base');

  if ('refusal' in bases) {
    return bases;
  }

  const base = bases.texts.at(-1);

  if (base === undefined) {
    return { refusal: reasons.noBase(command) };
  }

  if (!sizeCatalog.basePattern.test(base)) {
    return { refusal: reasons.badBase(command, base) };
  }

  const from = findBase(context, base);
  const to = readCommit(context, 'HEAD');
  const pushed = readCommit(context, '@{upstream}');

  if ('refusal' in from) {
    return from;
  }

  if (!('commit' in to)) {
    return 'refusal' in to ? to : { refusal: reasons.cannotMeasure('HEAD is not a commit') };
  }

  if (!('commit' in pushed) || pushed.commit !== to.commit) {
    return 'refusal' in pushed ? pushed : { refusal: reasons.unpushed(command) };
  }

  return sumChanges(context, from.commit, to.commit);
}

function sumChanges(context: Context, base: string, head: string): Counted | Refused {
  // Attributes come from the base commit only: a branch that marks its files `-diff`
  // or `binary` would otherwise count them as 0 lines. A low `core.bigFileThreshold`
  // in the repository config would make git treat big files as binary, and `diff.relative`
  // would hide the files outside a directory.
  const diff = context.run('git', [
    `--attr-source=${ base }`, '-c', 'core.attributesFile=/dev/null',
    '-c', 'core.bigFileThreshold=2147483647', '--no-replace-objects',
    'diff', '--numstat', '-z', '--no-ext-diff', '--no-textconv', '--no-renames', '--no-relative',
    `${ base }...${ head }`,
  ], { env: sizeCatalog.attributesEnv });

  if ('failure' in diff || diff.status !== 0) {
    return { refusal: getMeasureRefusal(diff) };
  }

  const changes = readNumstat(diff.stdout);

  if (changes === undefined) {
    return { refusal: reasons.cannotMeasure('git diff printed a line the gate cannot read') };
  }

  const counted = changes.filter(({ path }) =>
    !sizeCatalog.lockfiles.some((lockfile) => lockfile === basename(path)));
  const generated = findGenerated(context, counted.map(({ path }) => path), base);

  if ('refusal' in generated) {
    return generated;
  }

  return {
    count: counted
      .filter(({ path }) => !generated.paths.has(path))
      .reduce((sum, { lines }) => sum + lines, 0),
  };
}
