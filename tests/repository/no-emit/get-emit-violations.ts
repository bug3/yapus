import { join } from 'node:path';
import { listFiles } from '../../helpers/list-files.ts';
import { readUtf8 } from '../../helpers/read-utf8.ts';

const TSCONFIG = 'tsconfig.json';
const MANIFEST = 'package.json';
const NODE_RANGE = '>=24';
const JAVASCRIPT_EXTENSIONS: readonly string[] = ['.js', '.mjs', '.cjs'];

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
  const noEmit = getField(getField(readJson(root, TSCONFIG), 'compilerOptions'), 'noEmit');

  return noEmit === true ? [] : [`${ TSCONFIG }: noEmit is not true`];
}

function getManifestViolations(root: string): string[] {
  const nodeRange = getField(getField(readJson(root, MANIFEST), 'engines'), 'node');

  return nodeRange === NODE_RANGE ? [] : [`${ MANIFEST }: engines.node is not ${ NODE_RANGE }`];
}

function getJavaScriptFiles(root: string): string[] {
  return JAVASCRIPT_EXTENSIONS.flatMap((extension) => listFiles(root, extension));
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
