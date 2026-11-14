import { basename, join } from 'node:path';
import { listFiles } from '../../helpers/list-files.ts';
import { readUtf8 } from '../../helpers/read-utf8.ts';

const AGENT_FILE = /^plugins\/[a-z0-9-]+\/agents\/[a-z0-9-]+\.md$/;
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;
const FIELD_SEPARATOR = ': ';
const REQUIRED_FIELDS: readonly string[] = ['name', 'description', 'tools', 'model'];
// The roster's agents that change nothing, read-only by their tool list.
const READ_ONLY_AGENTS: readonly string[] = ['plan-reviewer', 'deacon', 'warden', 'webscribe'];
const CHANGING_TOOLS: readonly string[] = ['Bash', 'Edit', 'NotebookEdit', 'Write'];
const LAUNCHING_TOOL = 'Agent';

// Every way an agent definition of a plugin under root leaves the roster's
// limits: a missing field, a name that is not its file's, a tool that
// launches agents, or a tool that changes something in a read-only agent.
// Tools are one comma-separated line; a YAML list reads as no tools.
export function getAgentProblems(root: string): string[] {
  return listFiles(root, '.md')
    .filter((path) => AGENT_FILE.test(path))
    .flatMap((path) => getFileProblems(path, getFields(readUtf8(join(root, path)) ?? '')));
}

function getFileProblems(path: string, fields: ReadonlyMap<string, string>): string[] {
  const name = basename(path, '.md');
  const tools = (fields.get('tools') ?? '').split(',').map((tool) => tool.trim());
  const deniedTools = READ_ONLY_AGENTS.includes(name)
    ? [LAUNCHING_TOOL, ...CHANGING_TOOLS]
    : [LAUNCHING_TOOL];
  const isNamedOtherwise = fields.has('name') && fields.get('name') !== name;
  const missingFields = REQUIRED_FIELDS.filter((field) => !fields.has(field));
  const listedDenied = tools.filter((tool) => deniedTools.includes(tool));

  return [
    ...missingFields.map((field) => `${ path }: no ${ field }`),
    ...isNamedOtherwise ? [`${ path }: name is not ${ name }`] : [],
    ...listedDenied.map((tool) => `${ path }: lists ${ tool }`),
  ];
}

// The frontmatter's "key: value" lines as a map.
function getFields(text: string): Map<string, string> {
  const head = FRONTMATTER.exec(text)?.[1] ?? '';

  return new Map(head.split('\n').flatMap((line): [string, string][] => {
    const at = line.indexOf(FIELD_SEPARATOR);

    return at > 0 ? [[line.slice(0, at), line.slice(at + FIELD_SEPARATOR.length)]] : [];
  }));
}
