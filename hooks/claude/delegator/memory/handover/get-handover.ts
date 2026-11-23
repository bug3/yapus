import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isSessionOff } from '../../policy/is-session-off.ts';
import type { MemoryEvent } from '../parse-event.ts';
import { type Entry, readEntries } from '../read-entries.ts';
import { getRecordPath, readHanded, recordHanded } from './record-handed.ts';

const TEXTS_PATH = join(import.meta.dirname, 'handover.md');

const PATH_PLACEHOLDER = '<path>';

const DESCRIPTION_PLACEHOLDER = '<description>';

const PLACEHOLDERS = new RegExp(`${ PATH_PLACEHOLDER }|${ DESCRIPTION_PLACEHOLDER }`, 'gu');

// What one output holds at most, under the cap past which Claude Code shows
// the agent a preview of a hook's text.
export const MAX_CHARACTERS = 8000;

// What stands between two rules of one output.
const SEPARATOR = '\n\n';

// A hooked call, as its gate read it.
export interface Call {
  // The PreToolUse payload.
  readonly stdinText: string;
  // CLAUDE_PLUGIN_DATA, which holds the session's mode and its record of the
  // rules it was handed.
  readonly dataDir: string | undefined;
  // CLAUDE_PROJECT_DIR, the root of the project whose memory is read.
  readonly projectDir: string | undefined;
}

// The hand-over's own words, one line each in the texts file.
interface Texts {
  // The line over a rule's body.
  readonly heading: string;
  // The line that stands for a rule whose body does not fit or was handed to
  // the session before.
  readonly pointer: string;
}

// The text of one output and the rules it holds whole, by their paths.
interface Handover {
  readonly text: string;
  readonly wholePaths: readonly string[];
}

// The PreToolUse output that hands the main agent the rules of the project's
// memory whose event the call is, in name order, or undefined when nothing is
// handed: the project directory is not set or holds no memory, the session is
// switched off, or no rule names the call. A replaced rule is not handed. A
// session gets the body of a rule once: a rule whose body it was handed comes
// as one line, and the record of them is kept in the plugin's data directory;
// with a record that cannot be read or written the body comes again. As many
// of the first other rules as fit come with their bodies and the rest as one
// line each, so the whole stays within MAX_CHARACTERS; when the lines alone
// pass it, nothing is handed. Throws when the memory directory or the texts
// file cannot be read.
export function getHandover(
  call: Call,
  isCalled: (event: MemoryEvent) => boolean,
): string | undefined {
  const { stdinText, dataDir, projectDir } = call;

  if (projectDir === undefined || projectDir === '' || isSessionOff(stdinText, dataDir)) {
    return undefined;
  }

  const rules = readEntries(projectDir).entries.filter(({ event, supersededBy }) => (
    event !== undefined && supersededBy === undefined && isCalled(event)
  ));

  if (rules.length === 0) {
    return undefined;
  }

  const recordPath = getRecordPath(stdinText, dataDir);
  const handover = formatRules(rules, readTexts(), readHanded(recordPath));

  if (handover === undefined) {
    return undefined;
  }

  recordHanded(recordPath, handover.wholePaths);

  return JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: handover.text },
  });
}

function readTexts(): Texts {
  const [heading = '', pointer = ''] = readFileSync(TEXTS_PATH, 'utf8').split('\n');

  return { heading, pointer };
}

// The rules in their order, with the most of the first not handed before
// whole that MAX_CHARACTERS allows, counting the lines of the rest.
function formatRules(
  rules: readonly Entry[],
  texts: Texts,
  handed: ReadonlySet<string>,
): Handover | undefined {
  const fresh = rules.map(({ path }) => path).filter((path) => !handed.has(path));
  // Every count of whole rules, the largest first.
  const wholeCounts = [...fresh.keys(), fresh.length].toReversed();

  return wholeCounts
    .map((count) => {
      const wholePaths = fresh.slice(0, count);
      const parts = rules.map((rule) => (wholePaths.includes(rule.path)
        ? `${ fill(texts.heading, rule) }\n${ rule.body.trim() }`
        : fill(texts.pointer, rule)));

      return { text: parts.join(SEPARATOR), wholePaths };
    })
    .find(({ text }) => text.length <= MAX_CHARACTERS);
}

// A function, since a replacement string would read a `$` of the path or the
// description as a pattern; one pass, so a placeholder written in either is
// left as it is.
function fill(line: string, rule: Entry): string {
  return line.replace(PLACEHOLDERS, (placeholder) => (
    placeholder === PATH_PLACEHOLDER ? rule.path : rule.description
  ));
}
