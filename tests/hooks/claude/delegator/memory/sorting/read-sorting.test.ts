import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  readSorting,
} from '../../../../../../hooks/claude/delegator/memory/sorting/read-sorting.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';

test('reads the approved order with the memory path in each of its places', () => {
  assert.deepEqual(readSorting('/p/.yapus/memory'), {
    kind: 'text',
    text: [
      'Take the first line that fits:',
      '1. The repository or git already shows it: save nothing.',
      '2. It holds for everyone who works in the repository: write it to /p/.yapus/memory/rules/<name>.md and tell the person it is a candidate for the repository (a check first, else a standard, a template or a document); move nothing there yourself.',
      '3. Every session needs it: write this file with a top-level frontmatter line every-session: "<why every session needs it>" and state the rule itself in its MEMORY.md line.',
      '4. It can end, as open or deferred work does: /p/.yapus/memory/work/<name>.md, one file per item; for an item with a plan write what, why and when it was deferred and a frontmatter line plan: "<path of its plan.md>", and copy no slice state.',
      '5. It says how to act in a situation you can name: /p/.yapus/memory/rules/<name>.md, with a frontmatter line event: "gh <group> <action>" or event: "launch <agent type>" when the situation is that call; every other rule is listed at the session\'s start by its description. When it replaces a rule in rules/, keep the old file and add superseded-by: "<new name>" to its frontmatter.',
      '6. Anything else: /p/.yapus/memory/reference/<name>.md.',
      'Start every file with frontmatter description: "<what it holds and when to read it>", for a rule the rule itself and its situation; <name> is lowercase letters, digits and hyphens.',
    ].join('\n'),
  });
});

test('keeps a dollar sign of the memory path as it is', () => {
  const sorting = readSorting('/p$&/.yapus/memory');

  assert.ok(sorting.kind === 'text');
  assert.match(sorting.text, /^6\. Anything else: \/p\$&\/\.yapus\/memory\/reference\/<name>\.md\.$/mu);
});

test('fails on a text file that is not on disk', (t) => {
  const sorting = readSorting('/p/.yapus/memory', join(makeTempDir(t), 'gone.md'));

  assert.ok(sorting.kind === 'failure');
  assert.match(sorting.detail, /^cannot read .*gone\.md: ENOENT/u);
});
