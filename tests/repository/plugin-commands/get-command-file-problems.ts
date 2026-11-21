import { parse } from 'node:path';
import { listAllFiles } from '../../helpers/list-files.ts';

const COMMAND_FILE = /^(plugins\/[^/]+)\/commands\//;

// Every kept file under root in or below the commands folder of a plugin,
// with the skill file to write in its place. A plugin command is written as
// a skill, the one form the skills check reads.
export function getCommandFileProblems(root: string): string[] {
  return listAllFiles(root).flatMap((path) => {
    const plugin = COMMAND_FILE.exec(path)?.[1];
    const skill = `skills/${ parse(path).name }/SKILL.md`;

    return plugin === undefined ? [] : [`${ path }: a command file; write ${ plugin }/${ skill }`];
  });
}
