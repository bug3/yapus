import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isRecord } from '../../../../hooks/shared/is-record.ts';
import { renderStandard } from '../../../../hooks/landmark/machine/render-standard.ts';

const MAP: unknown = JSON.parse(
  '{"hooks/git/**": "fixture/git/**", "tests/repository/**": null}',
);
const CATALOG = { map: isRecord(MAP) ? MAP : {} };
const BODY = '\n# Title\n\n## X-1. Keep "hooks/git/**" as written.\n';

test('replaces a mapped paths entry by its adopter path', () => {
  const text = `---\npaths:\n  - "hooks/git/**"\n---\n${ BODY }`;

  const rendered = `---\npaths:\n  - "fixture/git/**"\n---\n${ BODY }`;

  assert.equal(renderStandard(text, CATALOG), rendered);
});

test('drops a paths entry mapped to null', () => {
  const text = `---\npaths:\n  - "tests/repository/**"\n  - "package.json"\n---\n${ BODY }`;

  assert.equal(renderStandard(text, CATALOG), `---\npaths:\n  - "package.json"\n---\n${ BODY }`);
});

test('keeps an entry the map does not name', () => {
  const text = `---\npaths:\n  - "**/*.ts"\n  - "toString"\n---\n${ BODY }`;

  assert.equal(renderStandard(text, CATALOG), text);
});

test('returns a standard with no head as it is', () => {
  const text = '# Principles\n\n  - "hooks/git/**"\n';

  assert.equal(renderStandard(text, CATALOG), text);
});
