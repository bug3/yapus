import type { Item, Word } from '../../shell/split-commands.ts';
import type { Unreadable } from '../read-wrapper.ts';
import { variableSpecs } from './variable-specs.ts';

const EVALUATED_WORD: Unreadable = {
  kind: 'unjudgeable',
  reason: 'a word the shell evaluates as arithmetic the gate cannot read',
  shouldAlwaysDeny: true,
};

const DEFERRED_WORD: Unreadable = {
  kind: 'unjudgeable',
  reason: 'a subscript holding a substitution the shell may evaluate later',
  shouldAlwaysDeny: true,
};

// Whether each item stands inside `(( ))` or `$(( ))`, which the splitter gives as two
// opens in a row; a subshell inside a subshell reads the same and is refused alike.
export function findArithmeticItems(items: readonly Item[]): boolean[] {
  const regions: boolean[] = [];

  return items.map((item, index) => {
    if (item.kind === 'open') {
      regions.push(items[index - 1]?.kind === 'open');

      return false;
    }

    if (item.kind === 'close') {
      regions.pop();

      return false;
    }

    return regions.includes(true);
  });
}

// The refusal for a command whose arithmetic words hold a substitution or a parameter
// expansion, or undefined; `isInArithmetic` holds inside `(( ))`.
export function refuseArithmetic(
  words: readonly Word[],
  isInArithmetic: boolean,
): Unreadable | undefined {
  const isEvaluated = readArithmeticWords(words, isInArithmetic)
    .some((word) => variableSpecs.evaluated.test(word.text));

  if (isEvaluated) {
    return EVALUATED_WORD;
  }

  const isDeferred = words.some((word) =>
    !word.isOpaque && variableSpecs.deferredSubscript.test(word.text));

  return isDeferred ? DEFERRED_WORD : undefined;
}

function readArithmeticWords(words: readonly Word[], isInArithmetic: boolean): readonly Word[] {
  const program = words[0]?.text ?? '';
  const operands = words.slice(1);

  if (isInArithmetic) {
    return words;
  }

  if (program === variableSpecs.testCommand) {
    const operators = variableSpecs.arithmeticOperators;

    return words.filter((word, index) =>
      !operators.includes(word.text)
      && (operators.includes(words[index - 1]?.text ?? '')
        || operators.includes(words[index + 1]?.text ?? '')));
  }

  const isInteger = variableSpecs.integerPrograms.includes(program)
    && operands.some((word) => variableSpecs.integerOption.test(word.text));

  return variableSpecs.arithmeticPrograms.includes(program) || isInteger ? operands : [];
}
