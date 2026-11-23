import { existsSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import { getAutoMemoryFile } from '../../delegator/memory/auto/get-auto-memory-file.ts';
import { getMemoryDirectory } from '../../delegator/memory/get-memory-directory.ts';
import { readFrontmatter } from '../../delegator/memory/read-frontmatter.ts';
import { parseWrite } from './parse-write.ts';
import { readGateText } from './read-gate-text.ts';

export interface Input {
  readonly stdinText: string;
  // Whether the person switched the session off.
  readonly isOff: boolean;
  // CLAUDE_PROJECT_DIR, the directory the session was opened in.
  readonly projectRoot: string | undefined;
  // Claude Code's configuration directory, which holds every auto memory.
  readonly configDirectory: string | undefined;
}

export type Verdict =
  | { readonly kind: 'allow' }
  | { readonly kind: 'deny'; readonly reason: string }
  | { readonly kind: 'failure'; readonly detail: string };

// The frontmatter key under which a file of auto memory says why every
// session needs it.
const DECLARATION_KEY = 'every-session';

const ALLOW: Verdict = { kind: 'allow' };

// Whether the Write or Edit call in stdin may write. One call is denied: the
// one that creates a topic file in auto memory whose text does not say why
// every session needs it. Nothing is judged in a session switched off or in a
// project with no memory directory, so a call that cannot be read is allowed
// there and is a failure elsewhere. Writes no file.
export function getVerdict(input: Input): Verdict {
  const memoryDirectory = getProjectMemoryDirectory(input.projectRoot);

  if (input.isOff || memoryDirectory === undefined) {
    return ALLOW;
  }

  const parsed = parseWrite(input.stdinText);

  if (parsed.kind === 'failure') {
    return {
      kind: 'failure',
      detail: `cannot read the tool call (${ parsed.reason }); the write is not judged`,
    };
  }

  const { filePath, content } = parsed.write;

  if (!isNewTopicFile(filePath, input.configDirectory) || declaresNeed(content)) {
    return ALLOW;
  }

  const gateText = readGateText(basename(filePath), memoryDirectory);

  return gateText.kind === 'failure'
    ? { kind: 'failure', detail: `${ gateText.detail }; reinstall the plugin` }
    : { kind: 'deny', reason: gateText.text };
}

// The project's memory directory, or undefined where the project holds none:
// no project root, no such path, or a file in its place.
function getProjectMemoryDirectory(projectRoot: string | undefined): string | undefined {
  if (projectRoot === undefined || projectRoot === '') {
    return undefined;
  }

  const memoryDirectory = getMemoryDirectory(projectRoot);

  // Asked of existsSync first, which answers false where a stat throws: a
  // path that runs through a file.
  return existsSync(memoryDirectory) && statSync(memoryDirectory).isDirectory()
    ? memoryDirectory
    : undefined;
}

// Whether the path is a topic file of an auto memory that is not on disk
// yet. Without a configuration directory no auto memory is known.
function isNewTopicFile(filePath: string, configDirectory: string | undefined): boolean {
  if (configDirectory === undefined) {
    return false;
  }

  return getAutoMemoryFile(filePath, configDirectory)?.kind === 'topic' && !existsSync(filePath);
}

// An Edit call carries no whole text, so the one that creates a file declares
// nothing.
function declaresNeed(content: string | undefined): boolean {
  if (content === undefined) {
    return false;
  }

  return (readFrontmatter(content).fields.get(DECLARATION_KEY) ?? '') !== '';
}
