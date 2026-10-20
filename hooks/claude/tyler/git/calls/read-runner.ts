import { posix } from 'node:path';
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
  const unversioned = runnerSpecs.versionedName.exec(base)?.[1] ?? base;
  const group = findGroup(base) ?? findGroup(unversioned);
  const name = findGroup(base) === undefined ? unversioned : base;

  return group === undefined ? NO_RUN : HANDLERS[group.kind]({ name, words, start });
}

// Whether a lower-cased program name is a program that may run another command.
export function isRunner(base: string): boolean {
  const unversioned = runnerSpecs.versionedName.exec(base)?.[1] ?? base;

  return (findGroup(base) ?? findGroup(unversioned)) !== undefined;
}

function findGroup(name: string): (typeof runnerSpecs.runners)[number] | undefined {
  return runnerSpecs.runners.find((candidate) => candidate.names.includes(name));
}

// Without `-c`, a shell runs a script file, which the gate does not read, or reads
// stdin (`-s`, or no operand).
function readShell({ words, start }: Run): Resplit | NoRun | Unreadable {
  let index = start;
  let hasCommandString = false;
  let isReadingStdin = false;

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
      // An opaque value may expand to more words, `-c` and a command line among them.
      if (words[index + 1]?.isOpaque === true) {
        return refuseScript(true);
      }

      index += 2;
      continue;
    }

    const isShortGroup = SHORT_GROUP.test(word.text);

    hasCommandString ||= isShortGroup && word.text.includes('c');
    isReadingStdin ||= isShortGroup && word.text.includes('s');
    index += 1;
  }

  if (!hasCommandString) {
    return readScript(words[index], isReadingStdin);
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

// The file a sourcer runs is not read; the words after it are its arguments.
function readSourcer({ words, start }: Run): NoRun | Unreadable {
  const operand = words[start]?.text === '--' ? start + 1 : start;

  return readScript(words[operand], false);
}

// A literal script file is not read, the same limit as running `./script` directly; an
// opaque one may be `-c` and a command line, and with none the program reads stdin.
function readScript(script: Word | undefined, isReadingStdin: boolean): NoRun | Unreadable {
  if (script === undefined || isReadingStdin) {
    return refuseScript(false);
  }

  if (script.isOpaque) {
    return refuseScript(true);
  }

  return isStdinPath(script.text) ? refuseScript(false) : NO_RUN;
}

function isStdinPath(text: string): boolean {
  const path = posix.normalize(text);

  return runnerSpecs.stdinPaths.includes(path) ||
    runnerSpecs.stdinPrefixes.some((prefix) => path.startsWith(prefix));
}

function refuseScript(shouldAlwaysDeny: boolean): Unreadable {
  return { kind: 'unjudgeable', reason: SCRIPT_REASON, shouldAlwaysDeny };
}

function refuseRunner({ name, words, start }: Run): Unreadable {
  return {
    kind: 'unjudgeable',
    reason: `${ name } runs a command the gate cannot read`,
    // An opaque word may be the program the runner starts.
    shouldAlwaysDeny: words.slice(start).some((word) => word.isOpaque),
  };
}

// `find` runs a command only through an action; an opaque word may be one.
function readFinder(run: Run): NoRun | Unreadable {
  const isRunning = run.words
    .slice(run.start)
    .some((word) => word.isOpaque || runnerSpecs.findActions.includes(word.text));

  return isRunning ? refuseRunner(run) : NO_RUN;
}

// An interpreter runs inline code when one of its own options, before the script, is an
// inline option, a long one with an attached value (`--eval=x`), or a short option word
// that holds one of their letters (`-c'x'`, `-lne`, `-W0c`); an opaque option may be
// any. The script (or the module after `-m`) is not read, nor are the words after it,
// its arguments. With no script, or a script that names stdin, the interpreter reads stdin,
// unless every option prints information or runs tests.
function readInterpreter({ name, words, start }: Run): NoRun | Unreadable {
  const options = [
    ...runnerSpecs.inlineOptions,
    ...(runnerSpecs.ownInlineOptions[name] ?? []),
  ];
  const noStdinOptions = [
    ...runnerSpecs.interpreterNoStdinOptions,
    ...(runnerSpecs.ownNoStdinOptions[name] ?? []),
  ];
  const letters = options
    .filter((option) => SHORT_GROUP.test(option))
    .map((option) => option.charAt(1));
  const refusal = (shouldAlwaysDeny: boolean): Unreadable => ({
    kind: 'unjudgeable',
    reason: `${ name } runs code the gate cannot read`,
    shouldAlwaysDeny,
  });

  let hasOption = false;
  let hasStdinOption = false;
  let hasSubcommand = false;

  for (let index = start; index < words.length; index += 1) {
    const word = words[index];
    const text = word?.text ?? '';

    // An opaque word may expand to an inline option and code.
    if (word?.isOpaque === true) {
      return refusal(true);
    }

    const isInline =
      options.includes(text) ||
      options.some((option) => text.startsWith(`${ option }=`)) ||
      hasLetter(text, letters);

    if (isInline) {
      return refusal(false);
    }

    if (!text.startsWith('-')) {
      const subcommand = hasSubcommand ? 'none' : readSubcommand(name, text);

      if (subcommand === 'script') {
        hasSubcommand = true;
        continue;
      }

      return subcommand === 'stdin' || isStdinPath(text) ? refusal(false) : NO_RUN;
    }

    hasOption = true;
    hasStdinOption ||= !noStdinOptions.includes(text);

    if (runnerSpecs.interpreterValuedOptions.includes(text)) {
      if (words[index + 1]?.isOpaque === true) {
        return refusal(true);
      }

      index += 1;
    }
  }

  return !hasOption || hasStdinOption ? refusal(false) : NO_RUN;
}

// What an interpreter's first operand is when it names a subcommand: one the script
// follows, or one that reads stdin.
function readSubcommand(name: string, text: string): 'script' | 'stdin' | 'none' {
  if ((runnerSpecs.ownScriptSubcommands[name] ?? []).includes(text)) {
    return 'script';
  }

  return (runnerSpecs.ownStdinSubcommands[name] ?? []).includes(text) ? 'stdin' : 'none';
}

// Option letters may follow a value inside a group (`-W0c`), so every letter counts.
function hasLetter(text: string, letters: readonly string[]): boolean {
  return SHORT_GROUP.test(text) && letters.some((letter) => text.slice(1).includes(letter));
}
