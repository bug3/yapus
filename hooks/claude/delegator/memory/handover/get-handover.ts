import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isSessionOff } from '../../policy/is-session-off.ts';
import type { MemoryEvent } from '../parse-event.ts';
import { type Entry, readEntries } from '../read-entries.ts';

const TEXTS_PATH = join(import.meta.dirname, 'handover.md');

const PATH_PLACEHOLDER = '<path>';

const DESCRIPTION_PLACEHOLDER = '<description>';

const PLACEHOLDERS = new RegExp(`${ PATH_PLACEHOLDER }|${ DESCRIPTION_PLACEHOLDER }`, 'gu');

// What one output holds at most, under the 10,000 characters past which
// Claude Code shows the agent a preview of a hook's text.
const MAX_CHARACTERS = 8000;

// What stands between two rules of one output.
const SEPARATOR = '\n\n';

// A hooked call, as its gate read it.
export interface Call {
  // The PreToolUse payload.
  readonly stdinText: string;
  // CLAUDE_PLUGIN_DATA, which holds the session's mode.
  readonly dataDir: string | undefined;
  // CLAUDE_PROJECT_DIR, the root of the project whose memory is read.
  readonly projectDir: string | undefined;
}

// The hand-over's own words, one line each in the texts file.
interface Texts {
  // The line over a rule's body.
  readonly heading: string;
  // The line that stands for a rule whose body does not fit.
  readonly pointer: string;
}

// The PreToolUse output that hands the main agent the rules of the project's
// memory whose event the call is, in name order, or undefined when nothing is
// handed: the project directory is not set or holds no memory, the session is
// switched off, or no rule names the call. A replaced rule is not handed. As
// many of the first rules as fit come with their bodies and the rest as one
// line each, so the whole stays within MAX_CHARACTERS; when the lines alone
// pass it, nothing is handed. The same call gives the same output. Throws when
// the memory directory or the texts file cannot be read.
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
  const additionalContext = rules.length === 0 ? undefined : formatRules(rules, readTexts());

  return additionalContext === undefined
    ? undefined
    : JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext } });
}

function readTexts(): Texts {
  const [heading = '', pointer = ''] = readFileSync(TEXTS_PATH, 'utf8').split('\n');

  return { heading, pointer };
}

// The rules with the most of the first handed whole that MAX_CHARACTERS
// allows, counting the lines of the rest.
function formatRules(rules: readonly Entry[], texts: Texts): string | undefined {
  const wholes = rules.map((rule) => `${ fill(texts.heading, rule) }\n${ rule.body.trim() }`);
  const pointers = rules.map((rule) => fill(texts.pointer, rule));
  // Every count of whole rules, the largest first.
  const wholeCounts = [...rules.keys(), rules.length].toReversed();

  return wholeCounts
    .map((count) => [...wholes.slice(0, count), ...pointers.slice(count)].join(SEPARATOR))
    .find((handover) => handover.length <= MAX_CHARACTERS);
}

// A function, since a replacement string would read a `$` of the path or the
// description as a pattern; one pass, so a placeholder written in either is
// left as it is.
function fill(line: string, rule: Entry): string {
  return line.replace(PLACEHOLDERS, (placeholder) => (
    placeholder === PATH_PLACEHOLDER ? rule.path : rule.description
  ));
}
