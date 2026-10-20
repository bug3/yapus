import type { Word } from '../../shell/split-commands.ts';
import { NO_RUN, type NoRun } from '../read-runner.ts';
import { assignedName, type Unreadable } from '../read-wrapper.ts';
import { CONFIG_REFUSAL, isConfigName, refuseSetting } from './refuse-setting.ts';
import { variableSpecs } from './variable-specs.ts';

// An operand whose variable name the gate can read: `NAME` or `NAME=...`.
const READABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*(?:[+[]|=|$)/;

const UNREADABLE_NAME: Unreadable = {
  kind: 'unjudgeable',
  reason: 'a variable name the gate cannot read',
  shouldAlwaysDeny: true,
};

// Reads a program that sets, exports or removes the variables it names (`export`,
// `unset`). `base` is the lower-cased program name and `start` is the index of the word
// after it. A GIT_CONFIG* name refuses with or without a value.
export function readVariableProgram(
  base: string,
  words: readonly Word[],
  start: number,
): NoRun | Unreadable {
  if (!variableSpecs.variablePrograms.includes(base)) {
    return NO_RUN;
  }

  for (const word of words.slice(start)) {
    const refusal = refuseOperand(word);

    if (refusal !== undefined) {
      return refusal;
    }
  }

  return NO_RUN;
}

function refuseOperand(word: Word): Unreadable | undefined {
  const { text } = word;

  if (word.isOpaque && !READABLE_NAME.test(text)) {
    return UNREADABLE_NAME;
  }

  if (text.startsWith('-') || text.startsWith('+')) {
    return undefined;
  }

  if (isConfigName(assignedName(text))) {
    return CONFIG_REFUSAL;
  }

  return text.includes('=') ? refuseSetting(word, false) : undefined;
}
