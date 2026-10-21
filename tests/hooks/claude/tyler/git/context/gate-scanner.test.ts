import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  gateScanner,
} from '../../../../../../hooks/claude/tyler/git/context/gate-scanner.ts';

test('reads the scanner of scanner.json', () => {
  assert.ok('program' in gateScanner);
});
