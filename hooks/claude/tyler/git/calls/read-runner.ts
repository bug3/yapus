import type { Word } from '../shell/split-commands.ts';
import { isGitWord } from './is-git-word.ts';
import { programName } from './program-name.ts';
import type { Unreadable } from './read-wrapper.ts';
import { runnerSpecs } from './runner-specs.ts';

// A string the gate must split again, as a shell would read it.
export interface Resplit {
  readonly kind: 'resplit';
  readonly text: string;
}

export interface NoRun {
  readonly kind: 'none';
}

export const NO_RUN: NoRun = { kind: 'none' };

export const UNREADABLE_STRING = 'a shell string the gate cannot read';

const SHORT_GROUP = /^-[^-]/;
const SCRIPT_REASON = 'a shell reading a script or stdin the gate cannot read';

// Reads a program that may run another command. `base` is the lower-cased program name
// and `start` is the index of the word after it.
export function readRunner(
  base: string,
  words: readonly Word[],
  start: number,
): Resplit | NoRun | Unreadable {
  if (runnerSpecs.shells.includes(base)) {
    return readShell(words, start);
  }

  if (runnerSpecs.sourcers.includes(base)) {
    return { kind: 'unjudgeable', reason: SCRIPT_REASON };
  }

  if (runnerSpecs.evaluators.includes(base)) {
    return readEvaluator(words, start);
  }

  if (runnerSpecs.executors.includes(base)) {
    return readExecutor(base, words, start);
  }

  return NO_RUN;
}

function readShell(words: readonly Word[], start: number): Resplit | NoRun | Unreadable {
  let index = start;
  let hasCommandString = false;

  for (;;) {
    const word = words[index];

    if (word === undefined || word.isOpaque) {
      break;
    }

    if (word.text === '--') {
      index += 1;
      break;
    }

    if (!word.text.startsWith('-') && !word.text.startsWith('+')) {
      break;
    }

    if (runnerSpecs.shellValuedOptions.includes(word.text)) {
      index += 2;
      continue;
    }

    hasCommandString ||= SHORT_GROUP.test(word.text) && word.text.includes('c');
    index += 1;
  }

  if (!hasCommandString) {
    return { kind: 'unjudgeable', reason: SCRIPT_REASON };
  }

  const command = words[index];

  if (command === undefined) {
    return NO_RUN;
  }

  return command.isOpaque
    ? { kind: 'unjudgeable', reason: UNREADABLE_STRING }
    : { kind: 'resplit', text: command.text };
}

function readEvaluator(
  words: readonly Word[],
  start: number,
): Resplit | NoRun | Unreadable {
  const rest = words.slice(start);

  if (rest.some((word) => word.isOpaque)) {
    return { kind: 'unjudgeable', reason: 'eval of a value the gate cannot read' };
  }

  return { kind: 'resplit', text: rest.map((word) => word.text).join(' ') };
}

function readExecutor(
  base: string,
  words: readonly Word[],
  start: number,
): NoRun | Unreadable {
  const isRisky = words
    .slice(start)
    .some(
      (word) =>
        word.isOpaque ||
        word.text.split(/\s+/).some(isGitWord) ||
        isCommandRunner(programName(word.text)),
    );

  return isRisky
    ? { kind: 'unjudgeable', reason: `${ base } runs a command the gate cannot read` }
    : NO_RUN;
}

// A program among an executor's words that would run commands the gate never sees.
function isCommandRunner(name: string): boolean {
  const { shells, evaluators, sourcers } = runnerSpecs;

  return [...shells, ...evaluators, ...sourcers].includes(name);
}
