import {
  type CommandItem,
  type Item,
  splitCommands,
  type Word,
} from '../shell/split-commands.ts';
import { isGitWord } from './is-git-word.ts';
import { programName } from './program-name.ts';
import { readGitOptions } from './read-git-options.ts';
import type { GitRun } from './git-runs/make-runs.ts';
import { readGitRuns } from './git-runs/read-git-runs.ts';
import { isRunner, type Resplit, readRunner } from './read-runner.ts';
import { type Cursor, readWrapper } from './read-wrapper.ts';
import { readVariableProgram } from './variables/read-variable-program.ts';
import { readVariables } from './variables/read-variables.ts';

export interface Call {
  readonly tool: 'git' | 'gh';
  readonly words: readonly Word[];
  readonly configs: readonly Word[];
  readonly assignments: readonly string[];
}

export interface CallsFound {
  readonly kind: 'calls';
  readonly calls: readonly Call[];
}

// `shouldAlwaysDeny` holds when the part the gate cannot read may itself be the
// program that runs.
export interface CallsUnjudgeable {
  readonly kind: 'unjudgeable';
  readonly reason: string;
  readonly shouldAlwaysDeny: boolean;
}

export type Calls = CallsFound | CallsUnjudgeable;

interface CommandCall {
  readonly kind: 'call';
  readonly call: Call;
  // The commands the call runs itself (`git rebase -x CMD`).
  readonly runs: readonly GitRun[];
}

interface NoCall {
  readonly kind: 'none';
}

const NO_CALL: NoCall = { kind: 'none' };

// How many times a string may be split again inside another one.
const MAX_DEPTH = 2;

export function getCalls(items: readonly Item[], home: string | undefined): Calls {
  return collectCalls(items, home, 0);
}

function collectCalls(
  items: readonly Item[],
  home: string | undefined,
  depth: number,
): Calls {
  const calls: Call[] = [];

  for (const item of items) {
    if (item.kind !== 'command') {
      continue;
    }

    const found = readCommand(item);

    if (found.kind === 'unjudgeable') {
      return found;
    }

    if (found.kind === 'call') {
      calls.push(found.call);
    }

    for (const run of runsOf(found)) {
      const nested = readNested(run, home, depth);

      if (nested.kind === 'unjudgeable') {
        return nested;
      }

      calls.push(...nested.calls);
    }
  }

  return { kind: 'calls', calls };
}

// A string or words to read again as commands.
type Nested = GitRun | Resplit;

function runsOf(found: CommandCall | NoCall | Resplit): readonly Nested[] {
  if (found.kind === 'call') {
    return found.runs;
  }

  return found.kind === 'resplit' ? [found] : [];
}

function readNested(run: Nested, home: string | undefined, depth: number): Calls {
  if (depth >= MAX_DEPTH) {
    return { kind: 'unjudgeable', reason: 'commands nested too deep', shouldAlwaysDeny: false };
  }

  if (run.kind === 'rerun') {
    return collectCalls([{ kind: 'command', words: run.words, heredocs: [] }], home, depth + 1);
  }

  const split = splitCommands(run.text, home);

  // A command git runs is the program itself, so one the gate cannot split is refused.
  if (split.kind === 'failure') {
    return {
      kind: 'unjudgeable',
      reason: split.reason,
      shouldAlwaysDeny: run.kind === 'gitCommand',
    };
  }

  return collectCalls(split.items, home, depth + 1);
}

// Reads a command, then the variables its assignments and wrappers set or remove.
function readCommand(
  item: CommandItem,
): CommandCall | NoCall | Resplit | CallsUnjudgeable {
  const cursor: Cursor = {
    words: item.words,
    index: 0,
    assignments: [],
    settings: [],
    unsets: [],
    appender: undefined,
    clearer: undefined,
  };
  const found = readWords(cursor);

  if (found.kind === 'unjudgeable') {
    return found;
  }

  return readVariables(cursor, found.kind === 'call' ? found.call : undefined) ?? found;
}

function readWords(cursor: Cursor): CommandCall | NoCall | Resplit | CallsUnjudgeable {
  let hasWrapperAfterAppender = false;

  for (;;) {
    const { appender } = cursor;
    const reading = readWrapper(cursor);

    if (reading.kind === 'unjudgeable') {
      return reading;
    }

    hasWrapperAfterAppender ||= reading.kind === 'moved' && appender !== undefined;

    // A wrapper after `xargs` with no program after it runs a program read from stdin.
    if (reading.kind === 'ended') {
      return appender !== undefined && hasWrapperAfterAppender
        ? refuseAppender(appender)
        : NO_CALL;
    }

    if (reading.kind === 'program') {
      return readProgram(cursor);
    }
  }
}

function readProgram(cursor: Cursor): CommandCall | NoCall | Resplit | CallsUnjudgeable {
  const { words } = cursor;
  const program = words[cursor.index];

  if (program === undefined) {
    return NO_CALL;
  }

  if (program.isOpaque) {
    return {
      kind: 'unjudgeable',
      reason: 'a program name the gate cannot read',
      shouldAlwaysDeny: true,
    };
  }

  const base = programName(program.text);
  const { assignments } = cursor;

  // Arguments from stdin may turn a git call or a runner into anything.
  if (cursor.appender !== undefined && (isGitWord(program.text) || isRunner(base))) {
    return refuseAppender(cursor.appender);
  }

  // Without the GIT_CONFIG* variables git runs with no hooks at all, and so does a git
  // call inside a runner, which the line's git mention decides.
  if (cursor.clearer !== undefined && (isGitWord(program.text) || isRunner(base))) {
    return {
      kind: 'unjudgeable',
      reason: `${ cursor.clearer } drops the git config the hooks rely on`,
      shouldAlwaysDeny: isGitWord(program.text),
    };
  }

  if (!isGitWord(program.text)) {
    const variables = readVariableProgram(base, words, cursor.index + 1);

    return variables.kind === 'unjudgeable'
      ? variables
      : readRunner(base, words, cursor.index + 1);
  }

  if (base === 'gh') {
    const call: Call = {
      tool: 'gh',
      words: words.slice(cursor.index + 1),
      configs: [],
      assignments,
    };

    return { kind: 'call', call, runs: [] };
  }

  if (base.startsWith('git-')) {
    const subcommand: Word = {
      text: base.slice('git-'.length),
      isOpaque: false,
      canSplit: false,
    };
    const call: Call = {
      tool: 'git',
      words: [subcommand, ...words.slice(cursor.index + 1)],
      configs: [],
      assignments,
    };

    return readGitCall(call);
  }

  const options = readGitOptions(words, cursor.index + 1);

  if (options.kind === 'unjudgeable') {
    return options;
  }

  const call: Call = {
    tool: 'git',
    words: options.words,
    configs: options.configs,
    assignments,
  };

  return readGitCall(call);
}

function refuseAppender(appender: string): CallsUnjudgeable {
  return {
    kind: 'unjudgeable',
    reason: `${ appender } appends arguments the gate cannot read`,
    shouldAlwaysDeny: false,
  };
}

// A git call with the commands it runs; it stays a call for the rules.
function readGitCall(call: Call): CommandCall | CallsUnjudgeable {
  const runs = readGitRuns(call.words);

  return runs.kind === 'unjudgeable' ? runs : { kind: 'call', call, runs: runs.runs };
}
