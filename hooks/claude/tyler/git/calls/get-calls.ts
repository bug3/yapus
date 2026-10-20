import {
  type CommandItem,
  type Item,
  splitCommands,
  type Word,
} from '../shell/split-commands.ts';
import { isGitWord } from './is-git-word.ts';
import { programName } from './program-name.ts';
import { readGitOptions } from './read-git-options.ts';
import { isRunner, type Resplit, readRunner } from './read-runner.ts';
import { type Cursor, readWrapper } from './read-wrapper.ts';

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

    if (found.kind === 'resplit') {
      const nested = readNested(found, home, depth);

      if (nested.kind === 'unjudgeable') {
        return nested;
      }

      calls.push(...nested.calls);
    }
  }

  return { kind: 'calls', calls };
}

function readNested(resplit: Resplit, home: string | undefined, depth: number): Calls {
  if (depth >= MAX_DEPTH) {
    return { kind: 'unjudgeable', reason: 'commands nested too deep', shouldAlwaysDeny: false };
  }

  const split = splitCommands(resplit.text, home);

  if (split.kind === 'failure') {
    return { kind: 'unjudgeable', reason: split.reason, shouldAlwaysDeny: false };
  }

  return collectCalls(split.items, home, depth + 1);
}

function readCommand(
  item: CommandItem,
): CommandCall | NoCall | Resplit | CallsUnjudgeable {
  const cursor: Cursor = { words: item.words, index: 0, assignments: [], appender: undefined };

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

  if (!isGitWord(program.text)) {
    return readRunner(base, words, cursor.index + 1);
  }

  if (base === 'gh') {
    const call: Call = {
      tool: 'gh',
      words: words.slice(cursor.index + 1),
      configs: [],
      assignments,
    };

    return { kind: 'call', call };
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

    return { kind: 'call', call };
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

  return { kind: 'call', call };
}

function refuseAppender(appender: string): CallsUnjudgeable {
  return {
    kind: 'unjudgeable',
    reason: `${ appender } appends arguments the gate cannot read`,
    shouldAlwaysDeny: false,
  };
}
