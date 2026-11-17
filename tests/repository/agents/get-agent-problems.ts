import { basename, join } from 'node:path';
import { listFiles } from '../../helpers/list-files.ts';
import { readUtf8 } from '../../helpers/read-utf8.ts';

const AGENT_FILE = /^plugins\/[a-z0-9-]+\/agents\/[a-z0-9-]+\.md$/;
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;
const FIELD_SEPARATOR = ': ';
const TOOLS_FIELD = 'tools';
const DISALLOWED_FIELD = 'disallowedTools';
const REQUIRED_FIELDS: readonly string[] = ['name', 'description', TOOLS_FIELD, 'model'];
// The roster's agents that hold none of the built-in tools in CHANGING_TOOLS.
const READ_ONLY_AGENTS: readonly string[] = [
  'plan-reviewer', 'reader', 'diff-reviewer', 'web-researcher', 'mcp-operator',
];
const CHANGING_TOOLS: readonly string[] = ['Bash', 'Edit', 'NotebookEdit', 'Write'];
const LAUNCHING_TOOL = 'Agent';
// The roster's agents that may hold LAUNCHING_TOOL.
const LAUNCHING_AGENTS: readonly string[] = ['finisher'];
const COMMAND_TOOL = 'Bash';
// The roster's agents that write files and must not hold COMMAND_TOOL.
const COMMANDLESS_AGENTS: readonly string[] = ['plan-writer'];
const BRACKETED = /^\[(.*)\]$/;
const QUOTED = /^(["'])(.*)\1$/;
const SCOPE = /\(.*$/;

// Every way an agent definition of a plugin under root leaves the roster's
// limits: a missing field (one of tools or disallowedTools is enough), a name
// that is not its file's, a tool that launches agents outside
// LAUNCHING_AGENTS, a tool that runs commands in an agent of
// COMMANDLESS_AGENTS, or a tool that changes
// something in a read-only agent. An agent with a tools line must not list
// those tools, and a scoped entry such as Bash(git *) lists its tool; one
// without it inherits every tool, so its disallowedTools line must name
// them, and a scoped entry there names none. Either line is read so: one
// pair of surrounding brackets is removed, else one pair of surrounding
// quotes; the value is split at commas; each entry is trimmed and loses one
// pair of surrounding quotes; a value with no character is a missing field.
// A YAML block list reads as no tools.
export function getAgentProblems(root: string): string[] {
  return listFiles(root, '.md')
    .filter((path) => AGENT_FILE.test(path))
    .flatMap((path) => getFileProblems(path, getFields(readUtf8(join(root, path)) ?? '')));
}

function getFileProblems(path: string, fields: ReadonlyMap<string, string>): string[] {
  const name = basename(path, '.md');
  const launchingTools = LAUNCHING_AGENTS.includes(name) ? [] : [LAUNCHING_TOOL];
  const commandTools = COMMANDLESS_AGENTS.includes(name) ? [COMMAND_TOOL] : [];
  const deniedTools = READ_ONLY_AGENTS.includes(name)
    ? [...launchingTools, ...CHANGING_TOOLS]
    : [...launchingTools, ...commandTools];
  const isNamedOtherwise = fields.has('name') && fields.get('name') !== name;
  const tools = getEntries(fields.get(TOOLS_FIELD));
  const disallowed = getEntries(fields.get(DISALLOWED_FIELD));
  const hasOnlyDisallowedLine = tools.length === 0 && disallowed.length > 0;
  const hasNoToolsLine = tools.length === 0 && disallowed.length === 0;
  const missingFields = REQUIRED_FIELDS.filter(
    (field) => (field === TOOLS_FIELD ? hasNoToolsLine : !fields.has(field)),
  );
  const listedDenied = tools.filter((entry) => deniedTools.includes(entry.replace(SCOPE, '')));
  const unlistedDenied = hasOnlyDisallowedLine
    ? deniedTools.filter((tool) => !disallowed.includes(tool))
    : [];

  return [
    ...missingFields.map((field) => `${ path }: no ${ field }`),
    ...isNamedOtherwise ? [`${ path }: name is not ${ name }`] : [],
    ...listedDenied.map((entry) => `${ path }: lists ${ entry }`),
    ...unlistedDenied.map((tool) => `${ path }: does not disallow ${ tool }`),
  ];
}

// The entries of a tools or disallowedTools value by the reading rule on
// getAgentProblems, none when the line is absent or its value holds no
// character.
function getEntries(value = ''): string[] {
  const trimmed = value.trim();
  const inner = (BRACKETED.exec(trimmed)?.[1] ?? unquote(trimmed)).trim();

  return inner === '' ? [] : inner.split(',').map((entry) => unquote(entry.trim()));
}

// The text without one pair of surrounding quotes.
function unquote(text: string): string {
  return QUOTED.exec(text)?.[2] ?? text;
}

// The frontmatter's "key: value" lines as a map.
function getFields(text: string): Map<string, string> {
  const head = FRONTMATTER.exec(text)?.[1] ?? '';

  return new Map(head.split('\n').flatMap((line): [string, string][] => {
    const at = line.indexOf(FIELD_SEPARATOR);

    return at > 0 ? [[line.slice(0, at), line.slice(at + FIELD_SEPARATOR.length)]] : [];
  }));
}
