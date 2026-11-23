import { isAbsolute, join, relative, sep } from 'node:path';

// A file of an auto memory directory: its index, or a topic file by its name
// without the extension.
export type AutoMemoryFile =
  | { readonly kind: 'index'; readonly memoryDirectory: string }
  | { readonly kind: 'topic'; readonly memoryDirectory: string; readonly name: string };

const MEMORY_DIRECTORY = 'memory';
const INDEX_FILE = 'MEMORY.md';
const TOPIC_EXTENSION = '.md';

// The auto memory file at the absolute path, or undefined for a path that is
// not MEMORY.md or a <name>.md directly in
// <configDirectory>/projects/<slug>/memory/: a transcript beside that
// directory, a file a level deeper, a file under another configuration
// directory. The paths are compared as text, so one that reaches the
// directory through a link is none.
export function getAutoMemoryFile(
  path: string,
  configDirectory: string,
): AutoMemoryFile | undefined {
  if (!isAbsolute(path)) {
    return undefined;
  }

  const projectsDirectory = join(configDirectory, 'projects');
  const [slug, directory, fileName, ...below] = relative(projectsDirectory, path).split(sep);

  // A path outside the projects directory starts with '..', which is no slug.
  if (slug === undefined || slug === '..' || directory !== MEMORY_DIRECTORY) {
    return undefined;
  }

  if (fileName === undefined || below.length > 0) {
    return undefined;
  }

  const memoryDirectory = join(projectsDirectory, slug, MEMORY_DIRECTORY);

  if (fileName === INDEX_FILE) {
    return { kind: 'index', memoryDirectory };
  }

  const name = fileName.slice(0, -TOPIC_EXTENSION.length);

  return fileName.endsWith(TOPIC_EXTENSION) && name !== ''
    ? { kind: 'topic', memoryDirectory, name }
    : undefined;
}
