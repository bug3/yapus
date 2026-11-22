import { getSection, type Section } from './get-section.ts';
import { setValue } from './set-value.ts';

const CHECK_PREFIX = 'npm run check && ';
const INIT_DEFAULT = 'echo "Error: no test specified" && exit 1';
const YAPUS_TEST =
  'NODE_COMPILE_CACHE="${TMPDIR:+$TMPDIR/yapus/ordo/node}" node --test \'tests/**/*.test.ts\'';

// scripts.test at install: the old test runs after the check, and the node
// test runner replaces a missing or npm init default test.
export function setTestScript(root: Section): void {
  const scripts = getSection(root, 'scripts');

  setValue(scripts, 'test', getTestScript(scripts.object.test));
}

function getTestScript(oldTest: unknown): string {
  if (typeof oldTest !== 'string' || oldTest === INIT_DEFAULT) {
    return CHECK_PREFIX + YAPUS_TEST;
  }

  return oldTest.startsWith(CHECK_PREFIX) ? oldTest : CHECK_PREFIX + oldTest;
}
