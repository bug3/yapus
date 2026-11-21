import { spawnSync } from 'node:child_process';
import { writeSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getFirstLine } from '../get-first-line.ts';
import { readLabels, type Label } from './read-labels.ts';

const CATALOGS = join(import.meta.dirname, '..', 'catalogs');
const GH_TIMEOUT_MS = 30_000;

// The person runs it: `node hooks/shared/labels/sync-labels.ts`, in the repository
// whose labels it makes. It creates or updates every catalog label with gh and
// stops at the first failure. Importing the module runs nothing: the tests that
// import every module must not call gh.
export async function syncLabels(): Promise<void> {
  const labels = await readLabels(CATALOGS);

  if ('violation' in labels) {
    fail(`yapus labels: ${ labels.violation }`);

    return;
  }

  for (const label of labels) {
    const failure = sync(label);

    if (failure !== undefined) {
      fail(`yapus labels: ${ label.name }: ${ failure }`);

      return;
    }

    writeSync(process.stdout.fd, `synced ${ label.name }\n`);
  }
}

// The first line gh says about a failure, or undefined when the label was synced.
function sync(label: Label): string | undefined {
  const run = spawnSync('gh', [
    'label', 'create', label.name,
    '--color', label.color,
    '--description', label.description,
    '--force',
  ], { encoding: 'utf8', timeout: GH_TIMEOUT_MS });

  if (run.error !== undefined) {
    return getFirstLine(run.error);
  }

  if (run.status === 0) {
    return undefined;
  }

  return getFirstLine(run.stderr === '' ? `gh exited ${ String(run.status) }` : run.stderr);
}

function fail(line: string): void {
  writeSync(process.stderr.fd, `${ line }\n`);
  process.exitCode = 1;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await syncLabels();
}
