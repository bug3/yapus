import { basename, dirname, join } from 'node:path';
import { listFiles } from '../../helpers/list-files.ts';
import { readUtf8 } from '../../helpers/read-utf8.ts';

const SKILL_FILE = /^plugins\/[a-z0-9-]+\/skills\/[a-z0-9-]+\/SKILL\.md$/;
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;
const FIELD_SEPARATOR = ': ';
const REQUIRED_FIELDS: readonly string[] = ['name', 'description'];
const SHELL_LINE = /^!`(.*)`$/;
const BASH_RULE = /^Bash\((.+):\*\)$/;

// Every way a plugin skill under root leaves its frontmatter limits: a missing
// name or description, or a name that is not its directory's. A session lists
// a skill by these two fields before it is used. A directory outside
// [a-z0-9-] is not seen. A key with no ': ' after it reads as missing, one
// with ': ' as present even when blank or a block scalar; quotes stay in values.
// Also every shell line, a whole line !`<command>`, that the skill's
// allowed-tools value Bash(<prefix>:*) does not allow: a command that is not
// <prefix> or <prefix> and a space, quotes included, or no such value. A
// shell line the rule does not allow is refused outside bypass mode.
export function getSkillProblems(root: string): string[] {
  return listFiles(root, '.md')
    .filter((path) => SKILL_FILE.test(path))
    .flatMap((path) => {
      const text = readUtf8(join(root, path)) ?? '';
      const fields = getFields(text);

      return [
        ...getFileProblems(path, fields),
        ...getShellProblems(path, text, fields.get('allowed-tools') ?? ''),
      ];
    });
}

function getFileProblems(path: string, fields: ReadonlyMap<string, string>): string[] {
  const dir = basename(dirname(path));
  const isNamedOtherwise = fields.has('name') && fields.get('name') !== dir;
  const missingFields = REQUIRED_FIELDS.filter((field) => !fields.has(field));

  return [
    ...missingFields.map((field) => `${ path }: no ${ field }`),
    ...isNamedOtherwise ? [`${ path }: name is not ${ dir }`] : [],
  ];
}

function getShellProblems(path: string, text: string, rule: string): string[] {
  const prefix = BASH_RULE.exec(rule)?.[1];

  return text.split('\n').flatMap((line, index) => {
    const command = SHELL_LINE.exec(line)?.[1];
    const at = `${ path }:${ String(index + 1) }`;

    if (command === undefined) {
      return [];
    }

    if (prefix === undefined) {
      return [`${ at }: a shell line with no allowed-tools Bash rule`];
    }

    return isAllowed(command, prefix)
      ? []
      : [`${ at }: a shell line not allowed by Bash(${ prefix }:*)`];
  });
}

function isAllowed(command: string, prefix: string): boolean {
  return command === prefix || command.startsWith(`${ prefix } `);
}

// The frontmatter's "key: value" lines as a map.
function getFields(text: string): Map<string, string> {
  const head = FRONTMATTER.exec(text)?.[1] ?? '';

  return new Map(head.split('\n').flatMap((line): [string, string][] => {
    const at = line.indexOf(FIELD_SEPARATOR);

    return at > 0 ? [[line.slice(0, at), line.slice(at + FIELD_SEPARATOR.length)]] : [];
  }));
}
