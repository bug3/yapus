import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { swapDirectory } from '../../../../hooks/landmark/install/swap-directory.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';

test('puts the new directory in place of the old one', (t) => {
  const { staging, target } = arrange(t);

  swapDirectory(staging, target);

  assert.equal(readFileSync(join(target, 'file'), 'utf8'), 'new');
  assert.equal(existsSync(staging), false);
  assert.equal(existsSync(`${ target }.old`), false);
});

test('puts the old directory back and raises when the second rename fails', (t) => {
  const { staging, target } = arrange(t);

  assert.throws(() => {
    swapDirectory(join(staging, 'missing'), target);
  }, { code: 'ENOENT' });
  assert.equal(readFileSync(join(target, 'file'), 'utf8'), 'old');
  assert.equal(existsSync(`${ target }.old`), false);
});

// A temporary directory with an old target and a staging directory, each holding one file.
function arrange(t: TestContext): { readonly staging: string; readonly target: string } {
  const temp = makeTempDir(t);
  const staging = join(temp, 'hooks.new');
  const target = join(temp, 'hooks');

  mkdirSync(staging);
  mkdirSync(target);
  writeFileSync(join(staging, 'file'), 'new');
  writeFileSync(join(target, 'file'), 'old');

  return { staging, target };
}
