import {
  type CommandItem,
  type Item,
  splitCommands,
  type Word,
} from '../shell/split-commands.ts';
import { isGitWord } from './is-git-word.ts';
import { programName } from './program-name.ts';
import { readGitOptions } from './read-git-options.ts';
import { type Resplit, readRunner, UNREADABLE_STRING } from './read-runner.ts';
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

export interface CallsUnjudgeable {
  readonly kind: 'unjudgeable';
  readonly reason: string;
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
    return { kind: 'unjudgeable', reason: 'commands nested too deep' };
  }

  const split = splitCommands(resplit.text, home);

  if (split.kind === 'failure') {
    return { kind: 'unjudgeable', reason: split.reason };
  }

  return collectCalls(split.items, home, depth + 1);
}

function readCommand(
  item: CommandItem,
): CommandCall | NoCall | Resplit | CallsUnjudgeable {
  const cursor: Cursor = { index: 0, assignments: [] };

  for (;;) {
    const reading = readWrapper(item.words, cursor);

    if (reading.kind === 'unjudgeable') {
      return reading;
    }

    if (reading.kind === 'ended') {
      return NO_CALL;
    }

    if (reading.kind === 'split') {
      return readSplitString(reading.string, reading.rest);
    }

    if (reading.kind === 'program') {
      return readProgram(item.words, cursor);
    }
  }
}

// `env -S` runs its string with the words after it appended, as a shell line.
function readSplitString(string: Word, rest: readonly Word[]): Resplit | CallsUnjudgeable {
  if (string.isOpaque || rest.some((word) => word.isOpaque)) {
    return { kind: 'unjudgeable', reason: UNREADABLE_STRING };
  }

  return {
    kind: 'resplit',
    text: [string.text, ...rest.map((word) => word.text)].join(' '),
  };
}

function readProgram(
  words: readonly Word[],
  cursor: Cursor,
): CommandCall | NoCall | Resplit | CallsUnjudgeable {
  const program = words[cursor.index];

  if (program === undefined) {
    return NO_CALL;
  }

  if (program.isOpaque) {
    return {
      kind: 'unjudgeable',
      reason: 'a program name the gate cannot read',
    };
  }

  const base = programName(program.text);
  const { assignments } = cursor;

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
    const subcommand: Word = { text: base.slice('git-'.length), isOpaque: false };
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
