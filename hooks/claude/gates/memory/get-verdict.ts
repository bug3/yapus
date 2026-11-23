import { existsSync } from 'node:fs';
import { basename } from 'node:path';
import { getAutoMemoryFile } from '../../delegator/memory/auto/get-auto-memory-file.ts';
import { findMemoryDirectory } from '../../delegator/memory/find-memory-directory.ts';
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
  const memoryDirectory = findMemoryDirectory(input.projectRoot);

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

  const { filePath, content, newString } = parsed.write;

  if (!isNewTopicFile(filePath, input.configDirectory) || declaresNeed(content ?? newString)) {
    return ALLOW;
  }

  const gateText = readGateText(basename(filePath), memoryDirectory);

  return gateText.kind === 'failure'
    ? { kind: 'failure', detail: `${ gateText.detail }; reinstall the plugin` }
    : { kind: 'deny', reason: gateText.text };
}

// Whether the path is a topic file of an auto memory that is not on disk
// yet. Without a configuration directory no auto memory is known.
function isNewTopicFile(filePath: string, configDirectory: string | undefined): boolean {
  if (configDirectory === undefined) {
    return false;
  }

  return getAutoMemoryFile(filePath, configDirectory)?.kind === 'topic' && !existsSync(filePath);
}

// Asked of a file that is not on disk alone, whose whole text is the content
// of a Write call or the new text of an Edit call; a call with neither
// declares nothing.
function declaresNeed(text: string | undefined): boolean {
  if (text === undefined) {
    return false;
  }

  return (readFrontmatter(text).fields.get(DECLARATION_KEY) ?? '') !== '';
}
