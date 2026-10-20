import type { Word } from '../shell/split-commands.ts';
import type { Unreadable } from './read-wrapper.ts';
import { type RunnerKind, runnerSpecs } from './runner-specs.ts';

// A string the gate must split again, as a shell would read it.
export interface Resplit {
  readonly kind: 'resplit';
  readonly text: string;
}

export interface NoRun {
  readonly kind: 'none';
}

export const NO_RUN: NoRun = { kind: 'none' };

// A program that may run another command: its lower-cased name, the words of its
// command, and the index of the word after the program.
interface Run {
  readonly name: string;
  readonly words: readonly Word[];
  readonly start: number;
}

type Handler = (run: Run) => Resplit | NoRun | Unreadable;

const SHORT_GROUP = /^-[^-]/;
// The letters a short option word starts with, before its first other character.
const LEADING_LETTERS = /^-([A-Za-z]*)/;
const SCRIPT_REASON = 'a shell reading a script or stdin the gate cannot read';
const UNREADABLE_STRING = 'a shell string the gate cannot read';

const HANDLERS = {
  shell: readShell,
  closedShell: refuseRunner,
  evaluator: readEvaluator,
  sourcer: readSourcer,
  executor: refuseRunner,
  finder: readFinder,
  interpreter: readInterpreter,
} satisfies Record<RunnerKind, Handler>;

// Reads a program that may run another command. `base` is the lower-cased program name
// and `start` is the index of the word after it.
export function readRunner(
  base: string,
  words: readonly Word[],
  start: number,
): Resplit | NoRun | Unreadable {
  const name = runnerSpecs.versionedName.exec(base)?.[1] ?? base;
  const group = runnerSpecs.runners.find((candidate) => candidate.names.includes(name));

  return group === undefined ? NO_RUN : HANDLERS[group.kind]({ name, words, start });
}

function readShell({ words, start }: Run): Resplit | NoRun | Unreadable {
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
    // An opaque word may expand to `-c` and a command line.
    return refuseScript(words.slice(start).some((word) => word.isOpaque));
  }

  const command = words[index];

  if (command === undefined) {
    return NO_RUN;
  }

  return command.isOpaque
    ? { kind: 'unjudgeable', reason: UNREADABLE_STRING, shouldAlwaysDeny: true }
    : { kind: 'resplit', text: command.text };
}

function readEvaluator({ words, start }: Run): Resplit | Unreadable {
  const rest = words.slice(start);

  if (rest.some((word) => word.isOpaque)) {
    return {
      kind: 'unjudgeable',
      reason: 'eval of a value the gate cannot read',
      shouldAlwaysDeny: true,
    };
  }

  return { kind: 'resplit', text: rest.map((word) => word.text).join(' ') };
}

function readSourcer({ words, start }: Run): Unreadable {
  return refuseScript(words.slice(start).some((word) => word.isOpaque));
}

function refuseScript(shouldAlwaysDeny: boolean): Unreadable {
  return { kind: 'unjudgeable', reason: SCRIPT_REASON, shouldAlwaysDeny };
}

function refuseRunner({ name }: Run): Unreadable {
  return {
    kind: 'unjudgeable',
    reason: `${ name } runs a command the gate cannot read`,
    shouldAlwaysDeny: false,
  };
}

// `find` runs a command only through an action; an opaque word may be one.
function readFinder(run: Run): NoRun | Unreadable {
  const isRunning = run.words
    .slice(run.start)
    .some((word) => word.isOpaque || runnerSpecs.findActions.includes(word.text));

  return isRunning ? refuseRunner(run) : NO_RUN;
}

// An interpreter runs inline code when a word is an inline option, a long one with an
// attached value (`--eval=x`), or a short option word whose leading letters hold one of
// theirs (`-c'x'`, `-lne`); an opaque word may be any. A script file is not read.
function readInterpreter({ name, words, start }: Run): NoRun | Unreadable {
  const options = [
    ...runnerSpecs.inlineOptions,
    ...(runnerSpecs.ownInlineOptions[name] ?? []),
  ];
  const letters = options
    .filter((option) => SHORT_GROUP.test(option))
    .map((option) => option.charAt(1));
  const isInline = words
    .slice(start)
    .some(
      (word) =>
        word.isOpaque ||
        options.includes(word.text) ||
        options.some((option) => word.text.startsWith(`${ option }=`)) ||
        hasLetter(word.text, letters),
    );

  return isInline
    ? {
      kind: 'unjudgeable',
      reason: `${ name } runs code the gate cannot read`,
      // An opaque word may expand to an inline option and code.
      shouldAlwaysDeny: words.slice(start).some((word) => word.isOpaque),
    }
    : NO_RUN;
}

function hasLetter(text: string, letters: readonly string[]): boolean {
  const leading = SHORT_GROUP.test(text) ? LEADING_LETTERS.exec(text)?.[1] ?? '' : '';

  return letters.some((letter) => leading.includes(letter));
}
