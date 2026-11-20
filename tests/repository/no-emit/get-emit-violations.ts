import { dirname, join } from 'node:path';
import { listFiles } from '../../helpers/list-files.ts';
import { readUtf8 } from '../../helpers/read-utf8.ts';

const TSCONFIG = 'tsconfig.json';
const MANIFEST = 'package.json';
const NODE_RANGE = '>=24';
const JAVASCRIPT_EXTENSIONS: readonly string[] = ['.js', '.mjs', '.cjs'];
// Claude Code reads the workflow scripts of a plugin as JavaScript alone, so
// one is written by hand, not emitted.
const WORKFLOW_SCRIPT = /^plugins\/[a-z0-9-]+\/workflows\/[a-z0-9-]+\.js$/;

// Every way the repository could stop running as `.ts` on Node 24 or newer:
// a tsconfig that emits, a manifest that admits an older Node, or emitted
// JavaScript kept under root.
export function getEmitViolations(root: string): string[] {
  return [
    ...getTsconfigViolations(root),
    ...getManifestViolations(root),
    ...getJavaScriptFiles(root).map((path) => `${ path }: emitted JavaScript`),
  ];
}

function getTsconfigViolations(root: string): string[] {
  return getNoEmit(root, TSCONFIG, []) === true ? [] : [`${ TSCONFIG }: noEmit is not true`];
}

// The noEmit a tsconfig sets, else the one its relative `extends` set, the
// last base first; `seen` stops a loop of bases.
function getNoEmit(root: string, file: string, seen: readonly string[]): unknown {
  const config = readJson(root, file);
  const own = getField(getField(config, 'compilerOptions'), 'noEmit');

  if (own !== undefined || seen.includes(file)) {
    return own;
  }

  const extended = getField(config, 'extends');
  const bases = (Array.isArray(extended) ? extended : [extended]).reverse();

  for (const base of bases) {
    if (typeof base === 'string' && base.startsWith('.')) {
      const inherited = getNoEmit(root, getBaseFile(file, base), [...seen, file]);

      if (inherited !== undefined) {
        return inherited;
      }
    }
  }

  return undefined;
}

// A base names its file with or without the extension.
function getBaseFile(file: string, base: string): string {
  return join(dirname(file), base.endsWith('.json') ? base : `${ base }.json`);
}

function getManifestViolations(root: string): string[] {
  const nodeRange = getField(getField(readJson(root, MANIFEST), 'engines'), 'node');

  return nodeRange === NODE_RANGE ? [] : [`${ MANIFEST }: engines.node is not ${ NODE_RANGE }`];
}

function getJavaScriptFiles(root: string): string[] {
  return JAVASCRIPT_EXTENSIONS
    .flatMap((extension) => listFiles(root, extension))
    .filter((path) => !WORKFLOW_SCRIPT.test(path));
}

// The parsed file, or undefined when it is missing or not JSON.
function readJson(root: string, file: string): unknown {
  const text = readUtf8(join(root, file));

  if (text === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function getField(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
