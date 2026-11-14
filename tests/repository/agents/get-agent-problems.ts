import { basename, join } from 'node:path';
import { listFiles } from '../../helpers/list-files.ts';
import { readUtf8 } from '../../helpers/read-utf8.ts';

const AGENT_FILE = /^plugins\/[a-z0-9-]+\/agents\/[a-z0-9-]+\.md$/;
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;
const FIELD_SEPARATOR = ': ';
const REQUIRED_FIELDS: readonly string[] = ['name', 'description', 'tools', 'model'];
// The roster's agents that hold no built-in tool that writes a file or runs a command.
const READ_ONLY_AGENTS: readonly string[] = [
  'plan-reviewer', 'reader', 'diff-reviewer', 'web-researcher',
];
const CHANGING_TOOLS: readonly string[] = ['Bash', 'Edit', 'NotebookEdit', 'Write'];
const LAUNCHING_TOOL = 'Agent';

// Every way an agent definition of a plugin under root leaves the roster's
// limits: a missing field (one of tools or disallowedTools is enough), a name
// that is not its file's, a tool that launches agents, or a tool that changes
// something in a read-only agent. An agent with a tools line must not list
// those tools; one without it inherits every tool, so its disallowedTools
// line must name them. Both are one comma-separated line; a YAML list reads
// as no tools.
export function getAgentProblems(root: string): string[] {
  return listFiles(root, '.md')
    .filter((path) => AGENT_FILE.test(path))
    .flatMap((path) => getFileProblems(path, getFields(readUtf8(join(root, path)) ?? '')));
}

function getFileProblems(path: string, fields: ReadonlyMap<string, string>): string[] {
  const name = basename(path, '.md');
  const deniedTools = READ_ONLY_AGENTS.includes(name)
    ? [LAUNCHING_TOOL, ...CHANGING_TOOLS]
    : [LAUNCHING_TOOL];
  const isNamedOtherwise = fields.has('name') && fields.get('name') !== name;
  const hasToolsLine = fields.has('tools');
  const hasOnlyDisallowedLine = !hasToolsLine && fields.has('disallowedTools');
  const missingFields = REQUIRED_FIELDS.filter(
    (field) => !fields.has(field) && !(field === 'tools' && hasOnlyDisallowedLine),
  );
  const listedDenied = getList(fields, 'tools').filter((tool) => deniedTools.includes(tool));
  const disallowed = getList(fields, 'disallowedTools');
  const unlistedDenied = hasOnlyDisallowedLine
    ? deniedTools.filter((tool) => !disallowed.includes(tool))
    : [];

  return [
    ...missingFields.map((field) => `${ path }: no ${ field }`),
    ...isNamedOtherwise ? [`${ path }: name is not ${ name }`] : [],
    ...listedDenied.map((tool) => `${ path }: lists ${ tool }`),
    ...unlistedDenied.map((tool) => `${ path }: does not disallow ${ tool }`),
  ];
}

// The tools of a comma-separated frontmatter line, none when it is absent.
function getList(fields: ReadonlyMap<string, string>, field: string): string[] {
  return (fields.get(field) ?? '').split(',').map((tool) => tool.trim());
}

// The frontmatter's "key: value" lines as a map.
function getFields(text: string): Map<string, string> {
  const head = FRONTMATTER.exec(text)?.[1] ?? '';

  return new Map(head.split('\n').flatMap((line): [string, string][] => {
    const at = line.indexOf(FIELD_SEPARATOR);

    return at > 0 ? [[line.slice(0, at), line.slice(at + FIELD_SEPARATOR.length)]] : [];
  }));
}
