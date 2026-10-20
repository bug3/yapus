import type { Word } from '../../shell/split-commands.ts';
import { NO_RUN, type NoRun } from '../read-runner.ts';
import type { Unreadable } from '../read-wrapper.ts';
import { variableSpecs } from './variable-specs.ts';

// An operand whose variable name the gate can read: `NAME` or `NAME=...`.
const READABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*(?:[+[]|=|$)/;

const UNREADABLE_NAME: Unreadable = {
  kind: 'unjudgeable',
  reason: 'a variable name the gate cannot read',
  shouldAlwaysDeny: true,
};

const NAMEREF: Unreadable = {
  kind: 'unjudgeable',
  reason: 'a nameref the gate cannot follow',
  shouldAlwaysDeny: false,
};

// Reads a program that sets, exports or removes the variables it names (`export`,
// `unset`). `base` is the lower-cased program name and `start` is the index of the word
// after it. The names it sets are judged with every word of the line; here an opaque
// name, which may be any variable, and a nameref, which may point at one, refuse.
export function readVariableProgram(
  base: string,
  words: readonly Word[],
  start: number,
): NoRun | Unreadable {
  if (!variableSpecs.variablePrograms.includes(base)) {
    return NO_RUN;
  }

  const operands = words.slice(start);

  if (operands.some((word) => word.isOpaque && !READABLE_NAME.test(word.text))) {
    return UNREADABLE_NAME;
  }

  const isNameref = variableSpecs.namerefPrograms.includes(base)
    && operands.some((word) => variableSpecs.namerefOption.test(word.text));

  return isNameref ? NAMEREF : NO_RUN;
}
